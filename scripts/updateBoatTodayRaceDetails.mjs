import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { getJstTimestampParts, normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const todayOutputPath = path.join(projectRoot, "public", "data", "boatrace", "today.generated.json");
const outputPath = path.join(projectRoot, "public", "data", "boatrace", "today-race-details.generated.json");

const OFFICIAL_ORIGIN = "https://www.boatrace.jp";
const ENABLE_REMOTE_FETCH = process.env.BOAT_RACE_ENABLE_REMOTE_FETCH !== "0";
const MAX_DETAILED_RESULTS_PER_VENUE = Number.parseInt(process.env.BOAT_RACE_MAX_DETAILED_RESULTS_PER_VENUE ?? "12", 10);

const OFFICIAL_ENDPOINTS = {
	todayRaceIndex: () => `${OFFICIAL_ORIGIN}/owpc/pc/race/index`,
	venueRaceCard: (venueCode, dateKey, raceNo = 1) => `${OFFICIAL_ORIGIN}/owpc/pc/race/racelist?rno=${raceNo}&jcd=${venueCode}&hd=${dateKey}`,
	venueBeforeInfo: (venueCode, dateKey, raceNo = 1) => `${OFFICIAL_ORIGIN}/owpc/pc/race/beforeinfo?rno=${raceNo}&jcd=${venueCode}&hd=${dateKey}`,
	venueOdds: (venueCode, dateKey, raceNo = 1) => `${OFFICIAL_ORIGIN}/owpc/pc/race/odds3t?rno=${raceNo}&jcd=${venueCode}&hd=${dateKey}`,
	venueOdds2tf: (venueCode, dateKey, raceNo = 1) => `${OFFICIAL_ORIGIN}/owpc/pc/race/odds2tf?rno=${raceNo}&jcd=${venueCode}&hd=${dateKey}`,
	venueResultList: (venueCode, dateKey) => `${OFFICIAL_ORIGIN}/owpc/pc/race/resultlist?jcd=${venueCode}&hd=${dateKey}`,
	venueResult: (venueCode, dateKey, raceNo = 1) => `${OFFICIAL_ORIGIN}/owpc/pc/race/raceresult?rno=${raceNo}&jcd=${venueCode}&hd=${dateKey}`,
};

const WIND_DIRECTION_LABELS = {
	1: "北",
	2: "北北東",
	3: "北東",
	4: "東北東",
	5: "東",
	6: "東南東",
	7: "南東",
	8: "南南東",
	9: "南",
	10: "南南西",
	11: "南西",
	12: "西南西",
	13: "西",
	14: "西北西",
	15: "北西",
	16: "北北西",
	17: "無風",
};

const RACE_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);
const UPDATE_MODES = new Set(["initial", "active", "results", "final"]);
const TARGET_SESSIONS = new Set(["auto", "morning", "day", "night"]);
const FETCH_SECTION_KEYS = ["raceTitles", "resultList", "detailedResults", "odds", "beforeInfo", "venueWeather"];

function createDefaultFetchSections() {
	return {
		raceTitles: true,
		resultList: true,
		detailedResults: true,
		odds: true,
		beforeInfo: true,
		venueWeather: true,
	};
}

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = {};

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}

		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];

		switch (key) {
			case "mode":
			case "target-session":
			case "targetSession":
			case "target-date":
			case "targetDate":
			case "target-venues":
			case "target-races":
			case "fetch-sections":
			case "skip-sections":
				parsed[key] = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			default:
				break;
		}
	}

	return parsed;
}

function parseCsvList(value) {
	return String(value ?? "")
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);
}

function normalizeMode(value) {
	return UPDATE_MODES.has(value) ? value : "initial";
}

function normalizeTargetSession(value) {
	return TARGET_SESSIONS.has(value) ? value : "auto";
}

function normalizeTargetRaceNumbers(values) {
	return Array.from(
		new Set(
			values
				.map((value) => Number.parseInt(String(value), 10))
				.filter((value) => Number.isInteger(value) && value >= 1 && value <= 12),
		),
	).sort((left, right) => left - right);
}

function normalizeFetchSections(value) {
	const sections = createDefaultFetchSections();
	if (!value || typeof value !== "object") {
		return sections;
	}

	for (const key of FETCH_SECTION_KEYS) {
		if (typeof value[key] === "boolean") {
			sections[key] = value[key];
		}
	}

	return sections;
}

function parseFetchSectionOptions(includeText, skipText) {
	const includeList = parseCsvList(includeText).filter((key) => FETCH_SECTION_KEYS.includes(key));
	const skipList = parseCsvList(skipText).filter((key) => FETCH_SECTION_KEYS.includes(key));

	if (!includeList.length && !skipList.length) {
		return null;
	}

	const sections = includeList.length
		? Object.fromEntries(FETCH_SECTION_KEYS.map((key) => [key, false]))
		: createDefaultFetchSections();

	for (const key of includeList) {
		sections[key] = true;
	}

	for (const key of skipList) {
		sections[key] = false;
	}

	return sections;
}

function normalizeUpdateOptions(rawOptions = {}) {
	const fetchSections = normalizeFetchSections(rawOptions.fetchSections);
	return {
		mode: normalizeMode(rawOptions.mode),
		targetSession: normalizeTargetSession(rawOptions.targetSession),
		effectiveTargetSession: normalizeTargetSession(rawOptions.effectiveTargetSession ?? rawOptions.targetSession),
		targetDate: normalizeTargetDate(rawOptions.targetDate),
		targetVenues: Array.from(new Set(parseCsvList(rawOptions.targetVenues).map((item) => item.toLowerCase()))),
		targetRaceNumbers: normalizeTargetRaceNumbers(Array.isArray(rawOptions.targetRaceNumbers) ? rawOptions.targetRaceNumbers : parseCsvList(rawOptions.targetRaceNumbers)),
		fetchSections,
	};
}

export function parseUpdateOptionsFromArgv(argv = process.argv.slice(2), env = process.env) {
	const cliArgs = parseCliArgs(argv);
	return normalizeUpdateOptions({
		mode: cliArgs.mode ?? env.BOAT_RACE_MODE,
		targetSession: cliArgs["target-session"] ?? env.BOAT_RACE_TARGET_SESSION,
		targetDate: cliArgs["target-date"] ?? env.BOAT_RACE_TARGET_DATE,
		targetVenues: cliArgs["target-venues"] ?? env.BOAT_RACE_TARGET_VENUES,
		targetRaceNumbers: cliArgs["target-races"] ?? env.BOAT_RACE_TARGET_RACES,
		fetchSections: parseFetchSectionOptions(cliArgs["fetch-sections"] ?? env.BOAT_RACE_FETCH_SECTIONS, cliArgs["skip-sections"] ?? env.BOAT_RACE_SKIP_SECTIONS),
	});
}

function createEmbeddedFallbackFeed({ date, generatedAt }) {
	return {
		version: 1,
		generatedAt,
		date,
		source: "manual-sample",
		venues: [
			{
				id: "kiryu",
				venueCode: "01",
				venueName: "桐生",
				title: "サンプル開催",
				date,
				session: "night",
				status: "scheduled",
				weatherActual: {
					weather: "確認中",
					windDirection: "確認中",
					windSpeed: "確認中",
					waveHeight: "確認中",
					temperature: "確認中",
					waterTemperature: "確認中",
					source: "manual-sample",
					updatedAt: generatedAt,
				},
				races: [],
			},
		],
	};
}

async function readExistingFeed(timestamps) {
	const date = timestamps?.date ?? getJstTimestampParts().date;
	const generatedAt = timestamps?.generatedAt ?? getJstTimestampParts().generatedAt;

	try {
		const raw = await readFile(outputPath, "utf8");
		return JSON.parse(raw);
	} catch {
		return createEmbeddedFallbackFeed({ date, generatedAt });
	}
}

function compactText(value) {
	return String(value ?? "")
		.replace(/&nbsp;/g, " ")
		.replace(/\u00a0/g, " ")
		.replace(/[\t\n\r]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function compactInlineValue(value) {
	return compactText(value).replace(/\s+/g, "");
}

function normalizeMoney(value) {
	const text = compactText(value);

	if (!text || text === "-" || text === "--") {
		return null;
	}

	const normalized = text.replace(/[¥￥]/g, "").replace(/円/g, "").replace(/\s+/g, "");
	return normalized ? `${normalized}円` : null;
}

function parseRaceNo(value) {
	const match = compactText(value).match(/(\d{1,2})\s*R/i);
	return match ? Number.parseInt(match[1], 10) : null;
}

function parseTime(value) {
	const match = compactText(value).match(/(\d{1,2}):(\d{2})/);
	if (!match) {
		return null;
	}

	return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function buildJstTimestamp(date, time) {
	const normalizedTime = parseTime(time);
	return normalizedTime ? `${date}T${normalizedTime}:00+09:00` : null;
}

function timeToMinutes(time) {
	const normalized = parseTime(time);
	if (!normalized) {
		return null;
	}

	const [hours, minutes] = normalized.split(":").map((value) => Number.parseInt(value, 10));
	return hours * 60 + minutes;
}

function venueMatchesTarget(venue, fallbackVenue, targetVenues) {
	if (!targetVenues.length) {
		return true;
	}

	const candidates = [venue?.venueCode, venue?.venueName, fallbackVenue?.venueCode, fallbackVenue?.venueName]
		.filter(Boolean)
		.map((value) => String(value).toLowerCase());

	return targetVenues.some((target) => candidates.includes(target));
}

function resolveActiveTargetSession(targetSession, raceIndex, existingFeed, timestamps) {
	if (targetSession !== "auto") {
		return targetSession;
	}

	const activeVenue = (raceIndex?.venues ?? []).find((venue) => venue?.status === "selling" || venue?.status === "in-progress");
	if (activeVenue?.session && activeVenue.session !== "unknown") {
		return activeVenue.session;
	}

	const sessionSet = new Set(
		[...(raceIndex?.venues ?? []), ...(existingFeed?.venues ?? [])]
			.map((venue) => venue?.session)
			.filter((session) => TARGET_SESSIONS.has(session) && session !== "auto"),
	);

	if (timestamps.hour < 12 && sessionSet.has("morning")) {
		return "morning";
	}

	if (timestamps.hour < 18 && sessionSet.has("day")) {
		return "day";
	}

	if (sessionSet.has("night")) {
		return "night";
	}

	if (sessionSet.has("day")) {
		return "day";
	}

	if (sessionSet.has("morning")) {
		return "morning";
	}

	return "auto";
}

function selectActiveRaceNumbers({ raceTitles, fallbackVenue, timestamps }) {
	const nowMinutes = timestamps.hour * 60 + timestamps.minute;
	const candidateRaces = dedupeByRaceNo([...(raceTitles ?? []), ...((fallbackVenue?.races ?? []).map((race) => ({ raceNo: race.raceNo, deadlineTime: race.deadlineTime })))]);
	const nearRaceNumbers = candidateRaces
		.map((race) => ({ raceNo: race.raceNo, deadlineMinutes: timeToMinutes(race.deadlineTime) }))
		.filter((race) => Number.isInteger(race.deadlineMinutes))
		.filter((race) => race.deadlineMinutes >= nowMinutes - 20 && race.deadlineMinutes <= nowMinutes + 25)
		.map((race) => race.raceNo);

	const nextRace = candidateRaces
		.map((race) => ({ raceNo: race.raceNo, deadlineMinutes: timeToMinutes(race.deadlineTime) }))
		.filter((race) => Number.isInteger(race.deadlineMinutes) && race.deadlineMinutes > nowMinutes)
		.sort((left, right) => left.deadlineMinutes - right.deadlineMinutes)[0]?.raceNo;

	const selected = Array.from(new Set([...nearRaceNumbers, ...(nextRace ? [nextRace] : [])]));
	return selected.length ? selected.sort((left, right) => left - right) : [];
}

function isFinalizedResultStatus(status) {
	return status === "confirmed" || status === "finished";
}

function getResultStartInfos(result) {
	if (Array.isArray(result?.startInfos)) {
		return result.startInfos;
	}

	if (Array.isArray(result?.startInfo)) {
		return result.startInfo;
	}

	return [];
}

function hasResultFinishers(result) {
	return Array.isArray(result?.finishers) && result.finishers.length > 0;
}

function hasResultPayouts(result) {
	return Boolean(
		(Array.isArray(result?.payoutsFull) && result.payoutsFull.length > 0) ||
		(Array.isArray(result?.payouts) && result.payouts.length > 0) ||
		result?.payout3tan ||
		result?.payout2tan ||
		result?.payout3fuku ||
		result?.payout2fuku ||
		(Array.isArray(result?.payoutWide) && result.payoutWide.length > 0) ||
		result?.payoutWin ||
		(Array.isArray(result?.payoutPlace) && result.payoutPlace.length > 0),
	);
}

function hasResultFinalOdds(result) {
	if (!result?.finalOdds || typeof result.finalOdds !== "object") {
		return false;
	}

	return ["trifectaTop", "exactaTop", "quinellaTop", "trifectaAll", "exactaAll", "quinellaAll"].some((key) => {
		const value = result.finalOdds[key];
		return Array.isArray(value) && value.length > 0;
	});
}

function hasResultWeather(result) {
	return hasResolvedWeatherActual(result?.weatherActual);
}

function resultNeedsCompletion(result) {
	if (!result || typeof result !== "object") {
		return true;
	}

	const status = String(result.status ?? "");
	if (!status || status === "pending" || status === "unavailable" || status === "empty") {
		return true;
	}

	if (!isFinalizedResultStatus(status)) {
		return false;
	}

	return !hasResultFinishers(result) || !getResultStartInfos(result).length || !hasResultPayouts(result) || !hasResultWeather(result) || !hasResultFinalOdds(result);
}

function normalizeRaceNo(value) {
	const raceNo = Number.parseInt(String(value ?? ""), 10);
	return Number.isInteger(raceNo) && raceNo >= 1 && raceNo <= 12 ? raceNo : null;
}

function getDetailResult(detail) {
	if (!detail || typeof detail !== "object") {
		return null;
	}

	return detail.result && typeof detail.result === "object" ? detail.result : detail;
}

function hasResultTop3(result) {
	if (Array.isArray(result?.finishOrder) && result.finishOrder.filter(Boolean).length >= 3) {
		return true;
	}

	if (Array.isArray(result?.resultTop3) && result.resultTop3.filter(Boolean).length >= 3) {
		return true;
	}

	if (typeof result?.resultTop3 === "string" && result.resultTop3.trim()) {
		return true;
	}

	if (Array.isArray(result?.top3) && result.top3.filter(Boolean).length >= 3) {
		return true;
	}

	if (typeof result?.top3 === "string" && result.top3.trim()) {
		return true;
	}

	if (!Array.isArray(result?.finishers)) {
		return false;
	}

	const topRanks = new Set(
		result.finishers
			.map((item) => String(item?.rank ?? item?.arrival ?? item?.order ?? "").trim())
			.filter((rank) => rank === "1" || rank === "2" || rank === "3"),
	);
	return topRanks.size >= 3;
}

function payoutItemIsComplete(item, knownBetType = "") {
	if (!item || typeof item !== "object") {
		return false;
	}

	const betType = String(item.betType ?? item.type ?? knownBetType ?? "");
	const combination = compactInlineValue(item.combination ?? item.numbers ?? item.result ?? item.ticket);
	const payout = compactInlineValue(item.payout ?? item.payoff ?? item.odds ?? item.amount);
	const hasPopularityField = Object.hasOwn(item, "popularity") || Object.hasOwn(item, "popular") || Object.hasOwn(item, "rank");
	const popularityValue = item.popularity ?? item.popular ?? item.rank;
	const hasRequiredPopularity = !hasPopularityField || (popularityValue !== null && popularityValue !== undefined && String(popularityValue).trim() !== "");

	return Boolean(betType && combination && payout && hasRequiredPopularity);
}

function resultPayoutItems(result) {
	const items = [];
	if (Array.isArray(result?.payoutsFull)) {
		items.push(...result.payoutsFull);
	}
	if (Array.isArray(result?.payouts)) {
		items.push(...result.payouts);
	}
	return items;
}

function hasPayoutType(result, labels, fallbackValue = null, fallbackBetType = "") {
	if (payoutItemIsComplete(fallbackValue, fallbackBetType)) {
		return true;
	}

	return resultPayoutItems(result).some((item) => {
		const betType = String(item?.betType ?? item?.type ?? "");
		return labels.some((label) => betType.includes(label)) && payoutItemIsComplete(item);
	});
}

function hasSpecialResultCase(result) {
	const refundItems = Array.isArray(result?.refunds) ? result.refunds : [];
	if (refundItems.length || compactInlineValue(result?.refundText)) {
		return true;
	}

	const joinedText = [
		result?.remarks,
		result?.notes,
		...refundItems,
	]
		.map((item) => compactInlineValue(item))
		.filter(Boolean)
		.join(" ");
	const specialTokens = [
		"\u8fd4\u9084",
		"\u6b20\u5834",
		"\u4e0d\u6210\u7acb",
		"\u4e2d\u6b62",
		"\u5931\u683c",
		"\u59a8\u5bb3",
		"\u30d5\u30e9\u30a4\u30f3\u30b0",
	];

	return specialTokens.some((token) => joinedText.includes(token));
}

export function isRaceResultComplete(detail) {
	const result = getDetailResult(detail);
	if (!result || typeof result !== "object") {
		return false;
	}

	if (hasSpecialResultCase(result)) {
		return false;
	}

	const status = String(result.status ?? "");
	const hasFinalStatus = isFinalizedResultStatus(status);
	const hasTop3 = hasResultTop3(result);
	const hasDecision = Boolean(result.kimarite ?? result.winningMethod ?? result.winningMove ?? result.decidingMove);
	const hasTrifecta = hasPayoutType(result, ["3\u9023\u5358"], result.payout3tan, "3\u9023\u5358");
	const hasExacta = hasPayoutType(result, ["2\u9023\u5358"], result.payout2tan, "2\u9023\u5358");
	const hasQuinella = hasPayoutType(result, ["2\u9023\u8907"], result.payout2fuku, "2\u9023\u8907");
	const hasTrio = hasPayoutType(result, ["3\u9023\u8907"], result.payout3fuku, "3\u9023\u8907");
	const hasWide = hasPayoutType(result, ["\u62e1\u9023\u8907", "\u30ef\u30a4\u30c9"], Array.isArray(result.payoutWide) ? result.payoutWide.find(Boolean) : result.payoutWide, "\u62e1\u9023\u8907");

	return (hasFinalStatus || hasTop3) && hasTop3 && hasDecision && hasTrifecta && hasExacta && hasQuinella && hasTrio && hasWide;
}

export function buildCompletedRaceKey(venueName, raceNo) {
	return `${compactInlineValue(venueName) || "unknown"}#${normalizeRaceNo(raceNo) ?? "?"}`;
}

export function shouldSkipRaceUpdate(existingRaceDetail, mode) {
	return (mode === "active" || mode === "results" || mode === "final") && isRaceResultComplete(existingRaceDetail);
}

function selectResultsRaceNumbers({ raceTitles, resultListRaces, fallbackVenue, timestamps, mode }) {
	if (mode === "final") {
		return [...RACE_NUMBERS];
	}

	const nowMinutes = timestamps.hour * 60 + timestamps.minute;
	const fallbackRaceMap = new Map((fallbackVenue?.races ?? []).map((race) => [race.raceNo, race]));
	const resultListRaceMap = new Map((resultListRaces ?? []).map((race) => [race.raceNo, race]));
	const titleMap = new Map((raceTitles ?? []).map((race) => [race.raceNo, race]));
	const candidateRaceNos = new Set([...RACE_NUMBERS, ...Array.from(fallbackRaceMap.keys()), ...Array.from(resultListRaceMap.keys()), ...Array.from(titleMap.keys())]);
	const candidates = [];

	for (const raceNo of candidateRaceNos) {
		const fallbackRace = fallbackRaceMap.get(raceNo) ?? null;
		const resultListRace = resultListRaceMap.get(raceNo) ?? null;
		const deadlineTime = titleMap.get(raceNo)?.deadlineTime ?? fallbackRace?.deadlineTime ?? resultListRace?.deadlineTime ?? "";
		const deadlineMinutes = timeToMinutes(deadlineTime);
		const mergedResult = mergeRaceResult(fallbackRace?.result, resultListRace?.result);
		const needsCompletion = resultNeedsCompletion(mergedResult);
		const finalized = isFinalizedResultStatus(resultListRace?.result?.status ?? mergedResult?.status);
		const recentClosed = Number.isInteger(deadlineMinutes) && deadlineMinutes <= nowMinutes && deadlineMinutes >= nowMinutes - 60;
		const pastDue = Number.isInteger(deadlineMinutes) && deadlineMinutes <= nowMinutes;

		if (recentClosed && (needsCompletion || finalized)) {
			candidates.push({ raceNo, priority: 0, deadlineMinutes: deadlineMinutes ?? -1 });
			continue;
		}

		if (finalized && needsCompletion) {
			candidates.push({ raceNo, priority: 1, deadlineMinutes: deadlineMinutes ?? -1 });
			continue;
		}

		if (pastDue && needsCompletion) {
			candidates.push({ raceNo, priority: 2, deadlineMinutes: deadlineMinutes ?? -1 });
		}
	}

	if (!candidates.length) {
		return chooseDetailedRaceTargets(resultListRaces);
	}

	return candidates
		.sort((left, right) => left.priority - right.priority || right.deadlineMinutes - left.deadlineMinutes || right.raceNo - left.raceNo)
		.slice(0, Number.isFinite(MAX_DETAILED_RESULTS_PER_VENUE) ? MAX_DETAILED_RESULTS_PER_VENUE : 12)
		.map((item) => item.raceNo);
}

function getBeforeInfoTargetRaceNumbers(targetRaceNumbers, options) {
	if (options.mode === "final") {
		return [...RACE_NUMBERS];
	}

	return targetRaceNumbers;
}

function shouldFetchVenueForOptions(venue, fallbackVenue, options) {
	const matchesTargetVenue = venueMatchesTarget(venue, fallbackVenue, options.targetVenues);
	if (!matchesTargetVenue) {
		return false;
	}

	if (options.mode === "initial") {
		return true;
	}

	if (!fallbackVenue) {
		return true;
	}

	const targetSession = options.effectiveTargetSession;
	if (targetSession === "auto") {
		return true;
	}

	const session = venue?.session ?? fallbackVenue?.session ?? "unknown";
	if (options.mode === "active" || options.mode === "results" || options.mode === "final") {
		return session === targetSession;
	}

	return session === targetSession;
}

function buildFilteredFallbackVenue(venue, fallbackVenue, timestamps, source) {
	if (!fallbackVenue) {
		return {
			id: venue.id ?? `venue-${venue.venueCode}`,
			venueCode: venue.venueCode,
			venueName: venue.venueName,
			title: venue.title ?? "",
			date: timestamps.date,
			session: venue.session ?? "unknown",
			status: venue.status ?? "scheduled",
			dayText: venue.dayText ?? "",
			statusText: venue.statusText ?? "",
			currentRaceNo: venue.currentRaceNo ?? null,
			source,
			weatherActual: undefined,
			races: [],
		};
	}

	return {
		...fallbackVenue,
		id: venue.id ?? fallbackVenue.id,
		venueCode: venue.venueCode ?? fallbackVenue.venueCode,
		venueName: venue.venueName ?? fallbackVenue.venueName,
		title: venue.title ?? fallbackVenue.title,
		date: timestamps.date,
		session: venue.session ?? fallbackVenue.session,
		status: venue.status ?? fallbackVenue.status,
		dayText: venue.dayText ?? fallbackVenue.dayText,
		statusText: venue.statusText ?? fallbackVenue.statusText,
		currentRaceNo: venue.currentRaceNo ?? fallbackVenue.currentRaceNo,
		source: fallbackVenue.source ?? source,
	};
}

function extractQueryParam(url, key) {
	try {
		const parsed = new URL(url, OFFICIAL_ORIGIN);
		return parsed.searchParams.get(key);
	} catch {
		return null;
	}
}

function toAbsoluteUrl(url) {
	if (!url) {
		return null;
	}

	try {
		return new URL(url, OFFICIAL_ORIGIN).toString();
	} catch {
		return null;
	}
}

function venueIdFrom(venueCode, fallbackVenue, venueName) {
	if (fallbackVenue?.id) {
		return fallbackVenue.id;
	}

	if (venueCode) {
		return `venue-${venueCode}`;
	}

	const normalizedName = compactInlineValue(venueName).toLowerCase();
	return normalizedName ? `venue-${normalizedName}` : "venue-unknown";
}

function classifyVenueStatus(statusText) {
	const text = compactText(statusText);

	if (/終了|全レース終了/.test(text)) {
		return "finished";
	}

	if (/発売中|投票|オッズ|直前/.test(text)) {
		return "selling";
	}

	return "scheduled";
}

function classifySession(className) {
	const classes = compactText(className);

	if (classes.includes("is-nighter")) {
		return "night";
	}

	if (classes.includes("is-morning")) {
		return "morning";
	}

	return "day";
}

function classifyGrade(className) {
	const classes = compactText(className);

	if (classes.includes("is-sg")) {
		return "SG";
	}

	if (classes.includes("is-g1")) {
		return "G1";
	}

	if (classes.includes("is-g2")) {
		return "G2";
	}

	if (classes.includes("is-g3")) {
		return "G3";
	}

	if (classes.includes("is-vs")) {
		return "ヴィーナスシリーズ";
	}

	if (classes.includes("is-ippan")) {
		return "一般";
	}

	return null;
}

function cleanRaceTitle(text) {
	const normalized = compactText(text).replace(/1800m/gi, "").trim();
	return normalized || null;
}

function readNumberSetCombination($scope) {
	const numberSetText = compactText($scope.find(".numberSet1_row").first().text());
	return numberSetText ? numberSetText.replace(/\s+/g, "") : compactInlineValue($scope.text());
}

function parsePopularity(value) {
	const match = compactText(value).match(/\d+/);
	return match ? Number.parseInt(match[0], 10) : undefined;
}

function parseOddsNumber(value) {
	const text = compactText(value).replace(/,/g, "");
	if (!text || text === "-" || text === "--") {
		return null;
	}

	const number = Number.parseFloat(text);
	return Number.isFinite(number) ? number : null;
}

function parseMeasurement(value) {
	const text = compactText(value);
	return text || null;
}

function parseRaceNoFromTitle(value) {
	const match = compactText(value).match(/(\d{1,2})R時点/);
	return match ? Number.parseInt(match[1], 10) : null;
}

function parseWindDirectionFromIconClass(value) {
	const match = compactText(value).match(/(?:is-wind|icon_wind1_)(\d+)/);
	if (!match) {
		return null;
	}

	return WIND_DIRECTION_LABELS[Number.parseInt(match[1], 10)] ?? null;
}

function createPayoutItem(betType, combination, payout, popularity) {
	if (!combination || !payout) {
		return null;
	}

	const item = {
		betType,
		combination,
		payout,
	};

	if (typeof popularity === "number" && Number.isFinite(popularity)) {
		item.popularity = popularity;
	}

	return item;
}

function dedupeByRaceNo(races) {
	const raceMap = new Map();

	for (const race of races ?? []) {
		if (!race || typeof race.raceNo !== "number") {
			continue;
		}

		raceMap.set(race.raceNo, race);
	}

	return Array.from(raceMap.values()).sort((left, right) => left.raceNo - right.raceNo);
}

function normalizeWeatherActual(weatherActual, generatedAt, source) {
	if (!weatherActual || typeof weatherActual !== "object") {
		return {
			weather: "確認中",
			windDirection: "確認中",
			windSpeed: "確認中",
			waveHeight: "確認中",
			temperature: "確認中",
			waterTemperature: "確認中",
			source,
			updatedAt: generatedAt,
		};
	}

	return {
		weather: weatherActual.weather ?? "確認中",
		windDirection: weatherActual.windDirection ?? "確認中",
		windSpeed: weatherActual.windSpeed ?? "確認中",
		waveHeight: weatherActual.waveHeight ?? "確認中",
		temperature: weatherActual.temperature ?? "確認中",
		waterTemperature: weatherActual.waterTemperature ?? "確認中",
		source: weatherActual.source ?? source,
		updatedAt: weatherActual.updatedAt ?? weatherActual.fetchedAt ?? generatedAt,
	};
}

function hasResolvedWeatherActual(weatherActual) {
	if (!weatherActual || typeof weatherActual !== "object") {
		return false;
	}

	return [
		weatherActual.weather,
		weatherActual.windDirection,
		weatherActual.windSpeed,
		weatherActual.waveHeight,
		weatherActual.temperature,
		weatherActual.waterTemperature,
	].some((value) => value && value !== "確認中");
}

function normalizeOddsItems(items) {
	if (!Array.isArray(items)) {
		return [];
	}

	return items
		.filter((item) => item && typeof item.combination === "string" && typeof item.odds === "string")
		.map((item) => ({
			combination: item.combination,
			odds: item.odds,
			popularity: item.popularity,
		}));
}

function normalizeOddsPreview(oddsPreview, generatedAt) {
	if (Array.isArray(oddsPreview)) {
		const trifectaAll = normalizeOddsItems(
			oddsPreview
				.filter((item) => item?.betType === "3連単")
				.map((item) => ({
					combination: item.combination ?? "",
					odds: item.odds ?? item.payout ?? "",
					popularity: item.popularity,
				})),
		);

		const exactaAll = normalizeOddsItems(
			oddsPreview
				.filter((item) => item?.betType === "2連単")
				.map((item) => ({
					combination: item.combination ?? "",
					odds: item.odds ?? item.payout ?? "",
					popularity: item.popularity,
				})),
		);

		const quinellaAll = normalizeOddsItems(
			oddsPreview
				.filter((item) => item?.betType === "2連複")
				.map((item) => ({
					combination: item.combination ?? "",
					odds: item.odds ?? item.payout ?? "",
					popularity: item.popularity,
				})),
		);

		return {
			trifectaTop: collectTopOdds(trifectaAll, 5),
			exactaTop: collectTopOdds(exactaAll, 3),
			quinellaTop: collectTopOdds(quinellaAll, 3),
			trifectaAll,
			exactaAll,
			quinellaAll,
			updatedAt: generatedAt,
		};
	}

	if (!oddsPreview || typeof oddsPreview !== "object") {
		return {
			trifectaTop: [],
			exactaTop: [],
			quinellaTop: [],
			trifectaAll: [],
			exactaAll: [],
			quinellaAll: [],
			updatedAt: generatedAt,
		};
	}

	const trifectaAll = normalizeOddsItems(oddsPreview.trifectaAll);
	const exactaAll = normalizeOddsItems(oddsPreview.exactaAll);
	const quinellaAll = normalizeOddsItems(oddsPreview.quinellaAll);

	const trifectaTop = normalizeOddsItems(oddsPreview.trifectaTop);
	const exactaTop = normalizeOddsItems(oddsPreview.exactaTop);
	const quinellaTop = normalizeOddsItems(oddsPreview.quinellaTop);

	return {
		trifectaTop: trifectaTop.length ? trifectaTop : collectTopOdds(trifectaAll, 5),
		exactaTop: exactaTop.length ? exactaTop : collectTopOdds(exactaAll, 3),
		quinellaTop: quinellaTop.length ? quinellaTop : collectTopOdds(quinellaAll, 3),
		trifectaAll,
		exactaAll,
		quinellaAll,
		updatedAt: oddsPreview.updatedAt ?? generatedAt,
	};
}

function normalizeResult(result, generatedAt) {
	if (!result || typeof result !== "object") {
		return {
			status: "pending",
			notes: "結果未取得",
		};
	}

	const payoutsFull = Array.isArray(result.payoutsFull)
		? result.payoutsFull
		: Array.isArray(result.payouts)
			? result.payouts
			: [];
	const startInfos = Array.isArray(result.startInfos)
		? result.startInfos
		: Array.isArray(result.startInfo)
			? result.startInfo
			: [];
	const status = result.status ?? (Array.isArray(result.finishOrder) && result.finishOrder.length >= 3 ? "confirmed" : "pending");

	return {
		status,
		finishOrder: Array.isArray(result.finishOrder) ? result.finishOrder : [],
		finishers: Array.isArray(result.finishers) ? result.finishers : [],
		startInfo: startInfos,
		startInfos,
		kimarite: result.kimarite ?? result.winningMethod,
		winningMethod: result.winningMethod ?? result.kimarite,
		winningMove: result.winningMove ?? result.winningMethod ?? result.kimarite,
		payout3tan: result.payout3tan ?? null,
		payout2tan: result.payout2tan ?? null,
		payout3fuku: result.payout3fuku ?? null,
		payout2fuku: result.payout2fuku ?? null,
		payoutWide: Array.isArray(result.payoutWide) ? result.payoutWide : result.payoutWide ? [result.payoutWide] : null,
		payoutWin: result.payoutWin ?? null,
		payoutPlace: Array.isArray(result.payoutPlace) ? result.payoutPlace : result.payoutPlace ? [result.payoutPlace] : null,
		payouts: Array.isArray(result.payouts) ? result.payouts : payoutsFull,
		payoutsFull,
		refunds: Array.isArray(result.refunds) ? result.refunds : [],
		refundText: result.refundText,
		remarks: result.remarks,
		notes: result.notes ?? result.remarks,
		weatherActual: result.weatherActual,
		finalizedAt: result.finalizedAt ?? (isFinalizedResultStatus(status) ? generatedAt : undefined),
		finalOdds: result.finalOdds ?? null,
	};
}

function normalizeRaceData(rawRace, venue, generatedAt, source) {
	return {
		raceNo: rawRace?.raceNo ?? 0,
		raceId: rawRace?.raceId ?? `${venue.id}-${String(rawRace?.raceNo ?? 0).padStart(2, "0")}`,
		title: rawRace?.title ?? `${rawRace?.raceNo ?? 0}R`,
		deadlineTime: rawRace?.deadlineTime ?? "",
		startTime: rawRace?.startTime ?? "",
		status: rawRace?.status ?? "scheduled",
		racers: Array.isArray(rawRace?.racers) ? rawRace.racers : [],
		exhibitions: Array.isArray(rawRace?.exhibitions) ? rawRace.exhibitions : [],
		oddsPreview: normalizeOddsPreview(rawRace?.oddsPreview, generatedAt),
		result: normalizeResult(rawRace?.result, generatedAt),
		weatherActual: rawRace?.weatherActual ? normalizeWeatherActual(rawRace.weatherActual, generatedAt, source) : undefined,
	};
}

function normalizeVenueData(rawVenue, generatedAt, source) {
	const venueId = rawVenue?.id ?? `venue-${rawVenue?.venueCode ?? "unknown"}`;
	const venueDate = normalizeTargetDate(rawVenue?.date);

	return {
	id: venueId,
	venueCode: rawVenue?.venueCode ?? "",
	venueName: rawVenue?.venueName ?? rawVenue?.name ?? "不明会場",
	title: rawVenue?.title ?? "",
	date: venueDate,
	session: rawVenue?.session ?? "unknown",
	status: rawVenue?.status ?? "scheduled",
	dayText: rawVenue?.dayText ?? "",
	statusText: rawVenue?.statusText ?? "",
	currentRaceNo: rawVenue?.currentRaceNo ?? null,
	source: rawVenue?.source ?? source,
	generatedAt,
	weatherActual: normalizeWeatherActual(rawVenue?.weatherActual, generatedAt, source),
	races: dedupeByRaceNo(rawVenue?.races).map((race) => normalizeRaceData(race, { id: venueId }, generatedAt, source)),
};
}

async function fetchOfficialHtml(url) {
	if (!ENABLE_REMOTE_FETCH || !url) {
		return null;
	}

	try {
		const response = await fetch(url, {
			headers: {
				"user-agent": "boatrace-datalavo/0.1 update-script",
				accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"accept-language": "ja,en-US;q=0.9,en;q=0.8",
			},
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			return null;
		}

		return response.text();
	} catch {
		return null;
	}
}

function parseIndexVenueRows(html, { date, dateKey, fallbackVenueByCode }) {
	const $ = load(html);
	const venues = [];

	$("tr").each((_, element) => {
		const row = $(element);
		const titleLink = row.find('a[href*="/owpc/pc/race/raceindex?jcd="]').first();

		if (!titleLink.length) {
			return;
		}

		const titleCell = titleLink.closest("td");
		const venueName = compactText(row.find("img[alt]").first().attr("alt"));
		const venueCode = extractQueryParam(titleLink.attr("href"), "jcd") ?? "";
		const fallbackVenue = fallbackVenueByCode.get(venueCode) ?? null;
		const sessionCell = titleCell.prev("td");
		const gradeCell = sessionCell.prev("td");
		const currentRaceCell = gradeCell.prevAll("td").eq(1);
		const statusCell = gradeCell.prevAll("td").eq(2);
		const dayCell = titleCell.next("td");
		const linksCell = dayCell.next("td");
		const readLink = (label) => {
			const anchor = linksCell.find("a").filter((__, link) => compactText($(link).text()) === label).first();
			return toAbsoluteUrl(anchor.attr("href"));
		};

		const currentRaceNo = parseRaceNo(currentRaceCell.text()) ?? 1;
		const title = compactText(titleLink.text());

		venues.push({
			id: venueIdFrom(venueCode, fallbackVenue, venueName),
			venueCode,
			venueName: venueName || fallbackVenue?.venueName || "不明会場",
			title: title || fallbackVenue?.title || "",
			date,
			session: classifySession(sessionCell.attr("class")),
			status: classifyVenueStatus(statusCell.text()),
			source: "official:owpc-html",
			grade: classifyGrade(gradeCell.attr("class")),
			dayText: compactText(dayCell.text()),
			statusText: compactText(statusCell.text()),
			currentRaceNo,
			links: {
				raceIndexUrl: toAbsoluteUrl(titleLink.attr("href")),
				raceListUrl: readLink("出走表") ?? OFFICIAL_ENDPOINTS.venueRaceCard(venueCode, dateKey, currentRaceNo),
				oddsUrl: readLink("オッズ") ?? OFFICIAL_ENDPOINTS.venueOdds(venueCode, dateKey, currentRaceNo),
				resultListUrl: readLink("結果一覧") ?? OFFICIAL_ENDPOINTS.venueResultList(venueCode, dateKey),
			},
		});
	});

	return venues;
}

function readNumericTokens(value) {
	return compactText(value).match(/\d+(?:\.\d+)?/g) ?? [];
}

function readSpaceSeparatedTokens(value) {
	return compactText(value).split(/\s+/).filter(Boolean);
}

function normalizeOfficialAverageStart(value) {
	const text = compactText(value);

	if (!text || text === "-" || text === "--") {
		return "-";
	}

	if (/^\.\d{2}$/.test(text)) {
		return `0${text}`;
	}

	return text;
}

function findFrameNumber(row, fallbackIndex) {
	const firstCellText = compactInlineValue(row.children("td,th").first().text());
	const firstCellMatch = firstCellText.match(/^[1-6]$/);
	if (firstCellMatch) {
		return Number.parseInt(firstCellMatch[0], 10);
	}

	return fallbackIndex + 1;
}

function parseBranchOrigin(value) {
	const match = compactText(value).match(/([^\s/]+)\/([^\s/]+)/);
	return {
		branch: match?.[1] ?? "",
		hometown: match?.[2] ?? "",
	};
}

function normalizeZenkakuDigits(value) {
	return String(value ?? "").replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function readCleanLines($scope) {
	return String($scope.text() ?? "")
		.split(/[\r\n]+/)
		.map((line) => compactText(line))
		.filter(Boolean);
}

function parseFrameLine(value) {
	const normalized = normalizeZenkakuDigits(compactInlineValue(value));
	return /^[1-6]$/.test(normalized) ? Number.parseInt(normalized, 10) : null;
}

function firstNumericToken(value) {
	return readNumericTokens(value)[0] ?? "";
}

function parseRacerRowsFromTextLines(lines) {
	const rows = [];
	const joinedText = normalizeZenkakuDigits(compactText((lines ?? []).join(" ")));
	const endCut = joinedText.search(/今節成績|モーター・ボート変更時/);
	const scopedText = endCut >= 0 ? joinedText.slice(0, endCut) : joinedText;
	const registrationPattern = /(\d{4})\s*\/\s*([AB]\d)/g;
	const matches = Array.from(scopedText.matchAll(registrationPattern));

	for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
		if (rows.length >= 6) {
			break;
		}

		const match = matches[matchIndex];
		const nextMatch = matches[matchIndex + 1];
		const registrationNo = match[1];
		const grade = match[2];
		const blockStart = (match.index ?? 0) + match[0].length;
		const blockEnd = nextMatch?.index ?? scopedText.length;
		const block = compactText(scopedText.slice(blockStart, blockEnd));

		const statsMatch = block.match(/\s+\d+歳\/[\d.]+kg\s+F(\d+)\s+L(\d+)\s+(.+)$/);
		if (!statsMatch) {
			continue;
		}

		const headerText = compactText(block.slice(0, statsMatch.index ?? 0));
		const branchOriginMatch = headerText.match(/([^\s/]+\s*\/\s*[^\s/]+)$/);
		if (!branchOriginMatch) {
			continue;
		}

		const frame = rows.length + 1;
		const branchOriginText = compactText(branchOriginMatch[1]);
		const name = compactText(headerText.slice(0, Math.max(0, headerText.length - branchOriginText.length))) || `枠${frame}`;
		const branchOrigin = parseBranchOrigin(branchOriginText);
		const branch = compactText(branchOrigin.branch);
		const hometown = compactText(branchOrigin.hometown);
		const fCount = Number.parseInt(statsMatch[1], 10) || 0;
		const lCount = Number.parseInt(statsMatch[2], 10) || 0;
		const statTokens = readSpaceSeparatedTokens(statsMatch[3]);

		const averageStart = normalizeOfficialAverageStart(statTokens[0] ?? "");
		const winRate = statTokens[1] ?? "";
		const nationalSecondRate = statTokens[2] ?? "";
		const localWinRate = statTokens[4] ?? "";
		const localSecondRate = statTokens[5] ?? "";
		const motorNo = statTokens[7] ?? "";
		const motorSecondRate = statTokens[8] ?? "";
		const boatNo = statTokens[10] ?? "";
		const boatSecondRate = statTokens[11] ?? "";

		rows.push({
			frame,
			frameNo: frame,
			lane: frame,
			boatNumber: frame,
			registrationNo,
			racerId: registrationNo,
			name,
			playerName: name,
			boatRacerName: name,
			branch,
			hometown,
			grade,
			class: grade,
			rank: grade,
			fCount,
			lCount,
			st: averageStart,
			avgSt: averageStart,
			averageSt: averageStart,
			averageStart,
			winRate,
			winningRate: winRate,
			twoRate: nationalSecondRate,
			secondRate: nationalSecondRate,
			quinellaRate: nationalSecondRate,
			localWinRate,
			localSecondRate,
			motorNo,
			motorNumber: motorNo,
			motorTwoRate: motorSecondRate,
			motorSecondRate,
			motorQuinellaRate: motorSecondRate,
			boatNo,
			boatMotorNo: boatNo,
			boatEquipmentNo: boatNo,
			boatTwoRate: boatSecondRate,
			boatSecondRate,
			boatQuinellaRate: boatSecondRate,
		});
	}

	return rows;
}

function parseRacerRowsFromRaceList($) {
	const racerTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("ボートレーサー") && text.includes("全国") && text.includes("モーター") && text.includes("ボート");
	});

	const tableLines = racerTable ? readCleanLines($(racerTable)) : [];
	const textParsedRows = parseRacerRowsFromTextLines(tableLines);
	if (textParsedRows.length) {
		return textParsedRows;
	}

	const pageLines = readCleanLines($("body"));
	return parseRacerRowsFromTextLines(pageLines);
}

function parseRaceListPage(html, currentRaceNo) {
	const $ = load(html);
	const deadlineHeader = $("td,th").filter((_, element) => /締切予定\s*時刻/.test(compactText($(element).text()))).first();
	const deadlines = [];

	if (deadlineHeader.length) {
		deadlineHeader.closest("tr").children("td,th").slice(1).each((index, cell) => {
			const deadlineTime = parseTime($(cell).text());
			if (!deadlineTime) {
				return;
			}

			deadlines.push({ raceNo: index + 1, deadlineTime });
		});
	}

	const selectedRaceTitle = cleanRaceTitle($(".title16_titleDetail__add2020").first().text());
	const racers = parseRacerRowsFromRaceList($);

	return {
		deadlines,
		selectedRaceTitle,
		currentRaceNo,
		racers,
	};
}

function parseResultListPage(html) {
	const $ = load(html);
	const raceMap = new Map();

	const resultTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("決まり手") && text.includes("着順");
	});

	if (resultTable) {
		$(resultTable).find("tbody").each((_, body) => {
			const rows = $(body).find("tr");
			const firstRow = rows.first();
			const secondRow = rows.eq(1);
			const raceNo = parseRaceNo(firstRow.find("a").first().text());

			if (!raceNo) {
				return;
			}

			const firstRowCells = firstRow.children("td,th");
			const finishOrder = secondRow.find(".numberSet3_number").toArray().map((element) => compactText($(element).text())).filter(Boolean).slice(0, 3);
			const kimarite = compactText(firstRowCells.eq(firstRowCells.length - 2).text()) || null;
			const notes = compactText(firstRowCells.eq(firstRowCells.length - 1).text()) || undefined;

			raceMap.set(raceNo, {
				raceNo,
				title: compactText(firstRowCells.eq(1).text()) || null,
				resultUrl: toAbsoluteUrl(firstRow.find("a").first().attr("href")),
				result: {
					status: finishOrder.length >= 3 ? "confirmed" : "pending",
					finishOrder,
					kimarite,
					winningMethod: kimarite,
					notes,
				},
			});
		});
	}

	const payoutTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("3連勝単式") && text.includes("2連勝単式");
	});

	if (payoutTable) {
		$(payoutTable).find("tbody tr").each((_, rowElement) => {
			const row = $(rowElement);
			const cells = row.children("td");
			const raceNo = parseRaceNo(cells.eq(0).text());

			if (!raceNo) {
				return;
			}

			const existing = raceMap.get(raceNo) ?? { raceNo, result: { status: "pending" } };
			const payout3tan = createPayoutItem("3連単", readNumberSetCombination(cells.eq(1)), normalizeMoney(cells.eq(2).text()));
			const payout2tan = createPayoutItem("2連単", readNumberSetCombination(cells.eq(3)), normalizeMoney(cells.eq(4).text()));

			raceMap.set(raceNo, {
				...existing,
				result: {
					...existing.result,
					payout3tan: payout3tan ?? existing.result?.payout3tan ?? null,
					payout2tan: payout2tan ?? existing.result?.payout2tan ?? null,
					notes: compactText(cells.eq(5).text()) || existing.result?.notes,
				},
			});
		});
	}

	return Array.from(raceMap.values()).sort((left, right) => left.raceNo - right.raceNo);
}

function parseResultRankText(value) {
	const normalized = normalizeZenkakuDigits(compactInlineValue(value));

	if (/^[1-6]$/.test(normalized)) {
		return normalized;
	}

	if (/^[ＦＦLＦＬFLS転妨失欠]$/.test(normalized)) {
		return normalized.replace("Ｆ", "F").replace("Ｌ", "L");
	}

	if (/^F$|^L$|^転$|^妨$|^失$|^欠$/.test(normalized)) {
		return normalized;
	}

	return "";
}

function parseRacerNameFromResultText(value) {
	const text = compactText(value);
	const registrationMatch = text.match(/\d{4}/);
	const registrationNo = registrationMatch?.[0] ?? "";
	const name = registrationNo ? compactText(text.replace(registrationNo, "")) : text;

	return {
		registrationNo,
		name,
	};
}

function parseFinishersFromDetailedResult($) {
	const finishers = [];

	const finisherTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("ボートレーサー") && text.includes("レースタイム");
	});

	if (!finisherTable) {
		return finishers;
	}

	$(finisherTable).find("tbody tr, tr").each((_, rowElement) => {
		const row = $(rowElement);
		const cells = row.children("td,th").toArray();

		if (cells.length < 3) {
			return;
		}

		const rank = parseResultRankText($(cells[0]).text());
		const frameNo = parseFrameLine($(cells[1]).text());
		const racerText = compactText($(cells[2]).text());
		const raceTime = compactText($(cells[3]).text());

		if (!rank || !frameNo || !racerText || racerText.includes("ボートレーサー")) {
			return;
		}

		const parsedRacer = parseRacerNameFromResultText(racerText);
		const decision = /^[1-6]$/.test(String(rank)) ? "" : String(rank);

		finishers.push({
			rank,
			frameNo,
			frame: frameNo,
			lane: frameNo,
			boatNumber: frameNo,
			registrationNo: parsedRacer.registrationNo,
			racerId: parsedRacer.registrationNo,
			name: parsedRacer.name,
			playerName: parsedRacer.name,
			boatRacerName: parsedRacer.name,
			raceTime,
			decision,
			isFlying: decision === "F",
			isLate: decision === "L",
		});
	});

	return finishers;
}

function parseStartInfoFromDetailedResult($) {
	const startInfo = [];
	const lines = readCleanLines($("body"));
	const startIndex = lines.findIndex((line) => compactText(line).includes("スタート情報"));

	if (startIndex < 0) {
		return startInfo;
	}

	const endIndex = lines.findIndex((line, index) => {
		if (index <= startIndex) {
			return false;
		}

		const text = compactText(line);
		return text.includes("勝式") || text.includes("払戻金") || text.includes("水面気象情報");
	});

	const scopedLines = lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined);

	for (let index = 0; index < scopedLines.length; index += 1) {
		const frameNo = parseFrameLine(scopedLines[index]);

		if (!frameNo) {
			continue;
		}

		let startTiming = "";
		let note = "";

		for (let lookAhead = index + 1; lookAhead < Math.min(index + 5, scopedLines.length); lookAhead += 1) {
			const candidate = compactText(scopedLines[lookAhead]);
			const timing = normalizeStartTiming(candidate);

			if (timing) {
				startTiming = timing;
				continue;
			}

			if (
				startTiming &&
				candidate &&
				!parseFrameLine(candidate) &&
				!candidate.includes("勝式") &&
				!candidate.includes("払戻金")
			) {
				note = candidate;
				break;
			}
		}

		if (!startTiming) {
			continue;
		}

		const flag = startTiming.startsWith("F") ? "F" : startTiming.startsWith("L") ? "L" : "";
		const st = startTiming.replace(/^[FL]/, "");

		startInfo.push({
			frameNo,
			frame: frameNo,
			lane: frameNo,
			boatNumber: frameNo,
			course: String(frameNo),
			entryCourse: String(frameNo),
			approachCourse: String(frameNo),
			st,
			flag,
			stDisplay: startTiming,
			startTiming,
			note,
		});
	}

	return startInfo;
}

function parseResultWeatherFromDetailedResult($) {
	const weatherRoot = $(".weather1").first();

	if (weatherRoot.length) {
		const temperature = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-direction .weather1_bodyUnitLabelData").first().text());
		const weather = compactText(weatherRoot.find(".weather1_bodyUnit.is-weather .weather1_bodyUnitLabelTitle").first().text()) || null;
		const windSpeed = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-wind .weather1_bodyUnitLabelData").first().text());
		const windDirection = parseWindDirectionFromIconClass(weatherRoot.find(".weather1_bodyUnit.is-windDirection .weather1_bodyUnitImage").attr("class"));
		const waterTemperature = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-waterTemperature .weather1_bodyUnitLabelData").first().text());
		const waveHeight = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-wave .weather1_bodyUnitLabelData").first().text());

		if (weather || windDirection || windSpeed || waveHeight || temperature || waterTemperature) {
			return {
				weather,
				windDirection,
				windSpeed,
				waveHeight,
				temperature,
				waterTemperature,
				source: "official:owpc-html+raceresult",
			};
		}
	}

	const lines = readCleanLines($("body"));
	const startIndex = lines.findIndex((line) => compactText(line).includes("水面気象情報"));

	if (startIndex < 0) {
		return null;
	}

	const scopedLines = lines.slice(startIndex, startIndex + 20).map((line) => compactText(line));
	const joined = scopedLines.join(" ");

	const temperature = joined.match(/気温\s*([\d.]+℃)/)?.[1] ?? null;
	const waterTemperature = joined.match(/水温\s*([\d.]+℃)/)?.[1] ?? null;
	const windSpeed = joined.match(/風速\s*([\d.]+m)/)?.[1] ?? null;
	const waveHeight = joined.match(/波高\s*([\d.]+cm)/)?.[1] ?? null;
	const weather = scopedLines.find((line) => /晴|曇|雨|雪/.test(line)) ?? null;

	if (!temperature && !waterTemperature && !windSpeed && !waveHeight && !weather) {
		return null;
	}

	return {
		weather,
		windDirection: null,
		windSpeed,
		waveHeight,
		temperature,
		waterTemperature,
		source: "official:owpc-html+raceresult",
	};
}

function parseSimpleResultValue($, label) {
	const table = $("table").toArray().find((candidate) => {
		const text = compactText($(candidate).text());
		return text.startsWith(label) || text.includes(label);
	});

	if (!table) {
		return "";
	}

	const cells = $(table).find("td,th").toArray().map((cell) => compactText($(cell).text())).filter(Boolean);
	const labelIndex = cells.findIndex((text) => text === label || text.includes(label));

	if (labelIndex >= 0) {
		return cells.slice(labelIndex + 1).find((text) => text && text !== label) ?? "";
	}

	return cells.at(-1) ?? "";
}

function normalizeResultCombinationText($scope) {
	const combination = readNumberSetCombination($scope);
	return combination ? combination.replace(/\s+/g, "") : "";
}

function parseDetailedResultPage(html) {
	const $ = load(html);
	const detailedResult = {};
	const finishers = parseFinishersFromDetailedResult($);
	const startInfo = parseStartInfoFromDetailedResult($);
	const resultWeatherActual = parseResultWeatherFromDetailedResult($);
	const refundsText = parseSimpleResultValue($, "返還");
	const remarksText = parseSimpleResultValue($, "備考");
	const winningMethodFromTable = parseSimpleResultValue($, "決まり手");

	const startInfoMap = new Map(startInfo.map((item) => [item.frameNo, item]));

	if (finishers.length) {
		detailedResult.finishers = finishers.map((item) => {
			const relatedStartInfo = startInfoMap.get(item.frameNo) ?? null;
			const decision = item.decision ?? (/^[1-6]$/.test(String(item.rank)) ? "" : String(item.rank));
			return {
				...item,
				course: relatedStartInfo?.course ? Number(relatedStartInfo.course) : item.course ?? item.frameNo,
				st: relatedStartInfo?.st ?? item.st ?? "",
				startTiming: relatedStartInfo?.startTiming ?? item.startTiming ?? "",
				decision,
				isFlying: decision === "F",
				isLate: decision === "L",
			};
		});
		detailedResult.finishOrder = finishers
			.filter((item) => /^[1-3]$/.test(String(item.rank)))
			.sort((left, right) => Number(left.rank) - Number(right.rank))
			.map((item) => String(item.frameNo))
			.slice(0, 3);
	}

	if (startInfo.length) {
		detailedResult.startInfo = startInfo;
		detailedResult.startInfos = startInfo;
	}

	if (resultWeatherActual) {
		detailedResult.weatherActual = resultWeatherActual;
	}

	if (winningMethodFromTable) {
		detailedResult.kimarite = winningMethodFromTable;
		detailedResult.winningMethod = winningMethodFromTable;
		detailedResult.winningMove = winningMethodFromTable;
	}

	if (refundsText) {
		detailedResult.refunds = refundsText
			.split(/[、,\s]+/)
			.map((item) => compactInlineValue(item))
			.filter(Boolean);
		detailedResult.refundText = refundsText;
	}

	if (remarksText) {
		detailedResult.remarks = remarksText;
		detailedResult.notes = remarksText;
	}

	const payoutTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("勝式") && text.includes("払戻金") && text.includes("人気");
	});

	if (!payoutTable) {
		return detailedResult;
	}

	const payoutsFull = [];

	$(payoutTable).find("tbody").each((_, body) => {
		const rows = $(body).find("tr");
		const firstRow = rows.first();
		const betType = compactText(firstRow.children("td").first().text());

		if (!betType) {
			return;
		}

		const items = [];

		rows.each((rowIndex, rowElement) => {
			const cells = $(rowElement).children("td");
			const combinationCell = rowIndex === 0 ? cells.eq(1) : cells.eq(0);
			const payoutCell = rowIndex === 0 ? cells.eq(2) : cells.eq(1);
			const popularityCell = rowIndex === 0 ? cells.eq(3) : cells.eq(2);
			const combination = normalizeResultCombinationText(combinationCell);
			const payout = normalizeMoney(payoutCell.text());

			if (!combination || !payout) {
				return;
			}

			const item = createPayoutItem(betType, combination, payout, parsePopularity(popularityCell.text()));
			if (item) {
				items.push(item);
				payoutsFull.push(item);
			}
		});

		const filteredItems = items.filter(Boolean);
		if (!filteredItems.length) {
			return;
		}

		switch (betType) {
			case "3連単":
			case "3連勝単式":
				detailedResult.payout3tan = filteredItems[0];
				break;
			case "3連複":
			case "3連勝複式":
				detailedResult.payout3fuku = filteredItems[0];
				break;
			case "2連単":
			case "2連勝単式":
				detailedResult.payout2tan = filteredItems[0];
				break;
			case "2連複":
			case "2連勝複式":
				detailedResult.payout2fuku = filteredItems[0];
				break;
			case "拡連複":
				detailedResult.payoutWide = filteredItems;
				break;
			case "単勝":
				detailedResult.payoutWin = filteredItems[0];
				break;
			case "複勝":
				detailedResult.payoutPlace = filteredItems;
				break;
			default:
				break;
		}
	});

	if (payoutsFull.length) {
		detailedResult.payouts = payoutsFull;
		detailedResult.payoutsFull = payoutsFull;
	}

	return detailedResult;
}

function createFinalOddsSnapshot(oddsPreview) {
	if (!oddsPreview) {
		return null;
	}

	const normalized = normalizeOddsPreview(oddsPreview, oddsPreview?.updatedAt ?? "");
	const hasOdds = (normalized.trifectaTop?.length ?? 0) > 0 || (normalized.exactaTop?.length ?? 0) > 0 || (normalized.quinellaTop?.length ?? 0) > 0 || (normalized.trifectaAll?.length ?? 0) > 0;

	if (!hasOdds) {
		return null;
	}

	return {
		trifectaTop: normalized.trifectaTop,
		exactaTop: normalized.exactaTop,
		quinellaTop: normalized.quinellaTop,
		trifectaAll: normalized.trifectaAll,
		exactaAll: normalized.exactaAll,
		quinellaAll: normalized.quinellaAll,
		updatedAt: normalized.updatedAt,
	};
}

function attachFinalOddsToResult(result, oddsPreview) {
	if (!result || !isFinalizedResultStatus(result.status) || hasResultFinalOdds(result)) {
		return result;
	}

	const finalOdds = createFinalOddsSnapshot(oddsPreview);
	return finalOdds ? { ...result, finalOdds } : result;
}

function parseOddsPreviewPage(html, date) {
	const $ = load(html);
	const refreshText = compactText($(".tab4_refreshText").first().text());
	const updatedTime = parseTime(refreshText);
	return { updatedAt: buildJstTimestamp(date, updatedTime) };
}

function findOddsTableByLabel($, label) {
	const title = $(".title7_mainLabel")
		.filter((_, element) => compactText($(element).text()).includes(label))
		.first();

	if (!title.length) {
		return null;
	}

	const table = title.closest(".title7").nextAll(".table1").first().find("table").first();
	return table.length ? table : null;
}

function extractOddsHeaders($table, $) {
	const headers = [];
	$table.find("thead th").each((_, element) => {
		const text = compactText($(element).text());
		if (/^[1-6]$/.test(text)) {
			headers.push(text);
		}
	});

	return headers;
}

function collectTopOdds(items, limit) {
	return items
		.filter((item) => item && typeof item.combination === "string" && typeof item.odds === "string")
		.sort((left, right) => {
			const leftValue = parseOddsNumber(left.odds) ?? Number.POSITIVE_INFINITY;
			const rightValue = parseOddsNumber(right.odds) ?? Number.POSITIVE_INFINITY;
			return leftValue - rightValue;
		})
		.slice(0, limit)
		.map((item, index) => ({
			combination: item.combination,
			odds: item.odds,
			popularity: index + 1,
		}));
}

function createOddsItem(combination, odds) {
	if (!combination || !odds) {
		return null;
	}

	return {
		combination,
		odds,
	};
}

function parseOddsUpdatedAt($, date, deadlineTime) {
	const refreshText = compactText($(".tab4_refreshText").first().text());
	const refreshTime = parseTime(refreshText);
	if (refreshTime) {
		return buildJstTimestamp(date, refreshTime);
	}

	const tabTimeText = compactText($(".tab4_time").first().text());
	if (tabTimeText.includes("締切時オッズ") && deadlineTime) {
		return buildJstTimestamp(date, deadlineTime);
	}

	return null;
}

function parseTrifectaOddsTable($table, $) {
	const headers = extractOddsHeaders($table, $);
	if (!headers.length) {
		return [];
	}

	const items = [];

	$table.find("tbody").each((_, bodyElement) => {
		const activeSecond = Array.from({ length: headers.length }, () => null);

		$(bodyElement).find("tr").each((__, rowElement) => {
			const cells = $(rowElement).children("td").toArray();
			let cellIndex = 0;

			for (let groupIndex = 0; groupIndex < headers.length; groupIndex += 1) {
				let secondBoat = activeSecond[groupIndex]?.value ?? null;

				if (!secondBoat) {
					const secondCell = cells[cellIndex];
					if (!secondCell) {
						break;
					}

					secondBoat = compactText($(secondCell).text());
					const rowspan = Number.parseInt($(secondCell).attr("rowspan") ?? "1", 10);
					activeSecond[groupIndex] = {
						value: secondBoat,
						remaining: Number.isFinite(rowspan) ? rowspan : 1,
					};
					cellIndex += 1;
				}

				const thirdCell = cells[cellIndex];
				const oddsCell = cells[cellIndex + 1];
				cellIndex += 2;

				if (!thirdCell || !oddsCell) {
					break;
				}

				const firstBoat = headers[groupIndex];
				const thirdBoat = compactText($(thirdCell).text());
				const odds = compactText($(oddsCell).text());
				if (firstBoat && secondBoat && thirdBoat && odds) {
					items.push(createOddsItem(`${firstBoat}-${secondBoat}-${thirdBoat}`, odds));
				}

				if (activeSecond[groupIndex]) {
					activeSecond[groupIndex].remaining -= 1;
					if (activeSecond[groupIndex].remaining <= 0) {
						activeSecond[groupIndex] = null;
					}
				}
			}
		});
	});

	return items.filter(Boolean);
}

function parseExactaLikeOddsTable($table, $, betType) {
	const headers = extractOddsHeaders($table, $);
	if (!headers.length) {
		return [];
	}

	const items = [];
	$table.find("tbody tr").each((_, rowElement) => {
		const cells = $(rowElement).children("td").toArray();
		for (let pairIndex = 0; pairIndex < headers.length; pairIndex += 1) {
			const boatCell = cells[pairIndex * 2];
			const oddsCell = cells[pairIndex * 2 + 1];
			if (!boatCell || !oddsCell) {
				continue;
			}

			const firstBoat = headers[pairIndex];
			const secondBoat = compactText($(boatCell).text());
			const odds = compactText($(oddsCell).text());
			if (!firstBoat || !secondBoat || !odds) {
				continue;
			}

			const combination =
				betType === "2連複"
					? [firstBoat, secondBoat].sort((left, right) => Number(left) - Number(right)).join("=")
					: `${firstBoat}-${secondBoat}`;
			items.push(createOddsItem(combination, odds));
		}
	});

	const deduped = new Map();
	for (const item of items.filter(Boolean)) {
		if (!deduped.has(item.combination)) {
			deduped.set(item.combination, item);
		}
	}

	return Array.from(deduped.values());
}

function parseOddsPage(html, { date, deadlineTime, betType }) {
	const $ = load(html);
	const updatedAt = parseOddsUpdatedAt($, date, deadlineTime);

	if (betType === "3連単") {
		const table = findOddsTableByLabel($, "3連単オッズ");
		return {
			items: table ? parseTrifectaOddsTable(table, $) : [],
			updatedAt,
		};
	}

	return {
		items: {
			exacta: (() => {
				const table = findOddsTableByLabel($, "2連単オッズ");
				return table ? parseExactaLikeOddsTable(table, $, "2連単") : [];
			})(),
			quinella: (() => {
				const table = findOddsTableByLabel($, "2連複オッズ");
				return table ? parseExactaLikeOddsTable(table, $, "2連複") : [];
			})(),
		},
		updatedAt,
	};
}

function mergeUpdatedAt(...values) {
	for (const value of values) {
		if (value) {
			return value;
		}
	}

	return null;
}

function mergeVenueWeather(baseWeatherActual, officialWeatherActual, generatedAt, source) {
	const base = normalizeWeatherActual(baseWeatherActual, generatedAt, source);
	if (!officialWeatherActual) {
		return base;
	}

	return normalizeWeatherActual(
		{
			weather: officialWeatherActual.weather ?? base.weather,
			windDirection: officialWeatherActual.windDirection ?? base.windDirection,
			windSpeed: officialWeatherActual.windSpeed ?? base.windSpeed,
			waveHeight: officialWeatherActual.waveHeight ?? base.waveHeight,
			temperature: officialWeatherActual.temperature ?? base.temperature,
			waterTemperature: officialWeatherActual.waterTemperature ?? base.waterTemperature,
			source: officialWeatherActual.source ?? base.source,
			updatedAt: officialWeatherActual.updatedAt ?? base.updatedAt,
		},
		generatedAt,
		officialWeatherActual.source ?? source,
	);
}

function mergeOddsIntoRace(baseOddsPreview, officialOddsPreview, generatedAt) {
	const base = normalizeOddsPreview(baseOddsPreview, generatedAt);
	if (!officialOddsPreview) {
		return base;
	}

	const official = normalizeOddsPreview(officialOddsPreview, generatedAt);

	return {
		trifectaTop: official.trifectaTop.length ? official.trifectaTop : base.trifectaTop,
		exactaTop: official.exactaTop.length ? official.exactaTop : base.exactaTop,
		quinellaTop: official.quinellaTop.length ? official.quinellaTop : base.quinellaTop,
		trifectaAll: official.trifectaAll.length ? official.trifectaAll : base.trifectaAll,
		exactaAll: official.exactaAll.length ? official.exactaAll : base.exactaAll,
		quinellaAll: official.quinellaAll.length ? official.quinellaAll : base.quinellaAll,
		updatedAt: official.updatedAt ?? base.updatedAt ?? generatedAt,
	};
}

function enrichRaceTitles(races, titleMap) {
	return races.map((race) => {
		const officialTitle = titleMap.get(race.raceNo);
		return {
			...race,
			title: officialTitle?.title ?? race.title ?? `${race.raceNo}R`,
			deadlineTime: officialTitle?.deadlineTime ?? race.deadlineTime,
		};
	});
}

async function fetchRaceTitles(venue, timestamps) {
	const results = await Promise.all(
		RACE_NUMBERS.map(async (raceNo) => {
			const html = await fetchOfficialHtml(OFFICIAL_ENDPOINTS.venueRaceCard(venue.venueCode, timestamps.dateKey, raceNo));
			if (!html) {
				return null;
			}

			const raceListInfo = parseRaceListPage(html, raceNo);
			const deadline = raceListInfo.deadlines.find((item) => item.raceNo === raceNo)?.deadlineTime ?? null;
			return {
				raceNo,
				title: raceListInfo.selectedRaceTitle,
				deadlineTime: deadline,
				racers: raceListInfo.racers,
			};
		}),
	);

	return results.filter(Boolean);
}

async function fetchRaceOdds(venue, raceNo, { timestamps, deadlineTime }) {
	const [trifectaHtml, twoTicketHtml] = await Promise.all([
		fetchOfficialHtml(OFFICIAL_ENDPOINTS.venueOdds(venue.venueCode, timestamps.dateKey, raceNo)),
		fetchOfficialHtml(OFFICIAL_ENDPOINTS.venueOdds2tf(venue.venueCode, timestamps.dateKey, raceNo)),
	]);

	if (!trifectaHtml && !twoTicketHtml) {
		return null;
	}

	const trifecta = trifectaHtml
		? parseOddsPage(trifectaHtml, { date: timestamps.date, deadlineTime, betType: "3連単" })
		: { items: [], updatedAt: null };
	const twoTicket = twoTicketHtml
		? parseOddsPage(twoTicketHtml, { date: timestamps.date, deadlineTime, betType: "2連単・2連複" })
		: { items: { exacta: [], quinella: [] }, updatedAt: null };

	const trifectaAll = normalizeOddsItems(trifecta.items);
    const exactaAll = normalizeOddsItems(twoTicket.items.exacta);
    const quinellaAll = normalizeOddsItems(twoTicket.items.quinella);
    const updatedAt = mergeUpdatedAt(trifecta.updatedAt, twoTicket.updatedAt);

return {
	raceNo,
	oddsPreview: {
		trifectaTop: collectTopOdds(trifectaAll, 5),
		exactaTop: collectTopOdds(exactaAll, 3),
		quinellaTop: collectTopOdds(quinellaAll, 3),
		trifectaAll,
		exactaAll,
		quinellaAll,
		updatedAt,
	},
};
}

function normalizeStartTiming(value) {
	const normalized = normalizeZenkakuDigits(compactInlineValue(value))
		.replace(/^Ｆ/i, "F")
		.replace(/^Ｌ/i, "L")
		.replace(/^f/i, "F")
		.replace(/^l/i, "L");

	const match = normalized.match(/^(?:[FL])?\.\d{2}$/);
	return match ? match[0] : "";
}

function readBoatFrameNumberFromElement($, element, fallbackFrame) {
	if (!element) {
		return fallbackFrame;
	}

	const scope = $(element);
	const attrText = scope
		.find("*")
		.addBack()
		.toArray()
		.map((node) =>
			[
				$(node).attr("class"),
				$(node).attr("alt"),
				$(node).attr("title"),
				$(node).attr("src"),
			]
				.filter(Boolean)
				.join(" "),
		)
		.join(" ");

	const attrMatch = attrText.match(/(?:boat|Boat|BOAT|boatrace|number|Number|num|Num|waku|frame|is-boat|boatColor)[^0-9]*([1-6])(?:\D|$)/);
	if (attrMatch) {
		return Number.parseInt(attrMatch[1], 10);
	}

	const text = compactInlineValue(scope.text());
	const textMatch = text.match(/^[1-6]$/);
	if (textMatch) {
		return Number.parseInt(textMatch[0], 10);
	}

	return fallbackFrame;
}

function dedupeStartExhibitionRows(rows) {
	const rowMap = new Map();

	for (const row of rows) {
		const frameNo = Number(row?.frameNo ?? row?.frame);
		if (!Number.isFinite(frameNo) || frameNo < 1 || frameNo > 6) {
			continue;
		}

		if (!rowMap.has(frameNo)) {
			rowMap.set(frameNo, {
				...row,
				frame: frameNo,
				frameNo,
				lane: frameNo,
				boatNumber: frameNo,
			});
		}
	}

	return Array.from(rowMap.values()).sort((left, right) => left.frameNo - right.frameNo);
}

function parseStartExhibitionRowsFromBeforeInfo($) {
	const rows = [];

	const startTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("コース") && text.includes("並び") && text.includes("ST") && !text.includes("展示タイム");
	});

	if (startTable) {
		$(startTable).find("tbody tr, tr").each((index, rowElement) => {
			const row = $(rowElement);
			const cells = row.children("td,th").toArray();

			const course = cells
				.map((cell) => normalizeZenkakuDigits(compactInlineValue($(cell).text())))
				.find((text) => /^[1-6]$/.test(text));

			const startTiming =
				cells.map((cell) => normalizeStartTiming($(cell).text())).find(Boolean) ??
				normalizeStartTiming(row.text());

			if (!course || !startTiming) {
				return;
			}

			const boatCell =
				cells.find((cell) => {
					const attrText = $(cell)
						.find("*")
						.addBack()
						.toArray()
						.map((node) =>
							[
								$(node).attr("class"),
								$(node).attr("alt"),
								$(node).attr("title"),
								$(node).attr("src"),
							]
								.filter(Boolean)
								.join(" "),
						)
						.join(" ");

					return /boat|Boat|BOAT|number|Number|num|Num|waku|frame|is-boat|boatColor/.test(attrText);
				}) ?? null;

			const frame = readBoatFrameNumberFromElement($, boatCell, rows.length + 1);

			rows.push({
				frame,
				frameNo: frame,
				lane: frame,
				boatNumber: frame,
				course,
				entryCourse: course,
				approachCourse: course,
				stDisplay: startTiming,
				startTiming,
			});
		});
	}

	if (rows.length) {
		return dedupeStartExhibitionRows(rows);
	}

	const lines = readCleanLines($("body"));
	const startIndex = lines.findIndex((line) => compactText(line).includes("スタート展示"));
	const endIndex = lines.findIndex((line, index) => index > startIndex && compactText(line).includes("水面気象情報"));

	if (startIndex < 0) {
		return [];
	}

	const scopedLines = lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined);

	for (let index = 0; index < scopedLines.length; index += 1) {
		const course = parseFrameLine(scopedLines[index]);
		const startTiming = normalizeStartTiming(scopedLines[index + 1]);

		if (!course || !startTiming) {
			continue;
		}

		const frame = rows.length + 1;

		rows.push({
			frame,
			frameNo: frame,
			lane: frame,
			boatNumber: frame,
			course: String(course),
			entryCourse: String(course),
			approachCourse: String(course),
			stDisplay: startTiming,
			startTiming,
		});

		index += 1;
	}

	return dedupeStartExhibitionRows(rows);
}

function parseExhibitionRowsFromBeforeInfo($) {
	const rows = [];
	const startExhibitionMap = new Map(
		parseStartExhibitionRowsFromBeforeInfo($).map((item) => [item.frameNo, item]),
	);

	const beforeInfoTable = $("table").toArray().find((table) => {
		const text = compactText($(table).text());
		return text.includes("ボートレーサー") && text.includes("展示") && text.includes("チルト");
	});

	if (!beforeInfoTable) {
		return rows;
	}

	$(beforeInfoTable).find("tbody tr").each((index, rowElement) => {
		const row = $(rowElement);
		const cells = row.children("td,th").toArray();
		const racerCellIndex = cells.findIndex((cell) => $(cell).find('a[href*="racersearch"], a[href*="profile"]').length > 0);

		if (racerCellIndex < 0) {
			return;
		}

		const frame = findFrameNumber(row, index);
		const name = compactText($(cells[racerCellIndex]).find('a[href*="racersearch"], a[href*="profile"]').first().text()) || `枠${frame}`;
		const rowText = compactText(row.text());
		const afterRacerCells = cells.slice(racerCellIndex + 1).map((cell) => compactText($(cell).text()));
		const exhibitionTime = afterRacerCells.find((text) => /^\d\.\d{2}$/.test(text)) ?? "";
		const tilt = afterRacerCells.find((text) => /^[+-]?\d+\.\d$/.test(text)) ?? rowText.match(/[+-]?\d+\.\d(?!\d)/)?.[0] ?? "";
		const partsExchange = row.find("li").toArray().map((element) => compactText($(element).text())).filter(Boolean).join("、");
		const startInfo = startExhibitionMap.get(frame) ?? null;
		const course = startInfo?.course ?? "";
		const startTiming = startInfo?.startTiming ?? startInfo?.stDisplay ?? "";

		rows.push({
			frame,
			frameNo: frame,
			lane: frame,
			boatNumber: frame,
			name,
			playerName: name,
			boatRacerName: name,
			exhibitionTime,
			displayTime: exhibitionTime,
			time: exhibitionTime,
			tilt,
			stDisplay: startTiming,
			startTiming,
			course,
			entryCourse: course,
			approachCourse: course,
			evaluation: "unknown",
			memo: partsExchange ? `部品交換: ${partsExchange}` : "",
			partsExchange,
		});
	});

	return rows;
}

function parseBeforeInfoPage(html, { date, raceNo, deadlineTime, fallbackUpdatedAt, source }) {
	const $ = load(html);
	const raceDeadlineMap = new Map([[raceNo, deadlineTime]]);

	return {
		raceNo,
		exhibitions: parseExhibitionRowsFromBeforeInfo($),
		weatherActual: parseVenueWeatherPage(html, {
			date,
			raceDeadlineMap,
			fallbackUpdatedAt,
			source,
		}),
	};
}

function parseVenueWeatherPage(html, { date, raceDeadlineMap, fallbackUpdatedAt, source }) {
	const $ = load(html);
	const weatherRoot = $(".weather1").first();
	if (!weatherRoot.length) {
		return null;
	}

	const title = compactText(weatherRoot.find(".weather1_title").first().text());
	const atRaceNo = parseRaceNoFromTitle(title);
	const updatedAt = atRaceNo ? buildJstTimestamp(date, raceDeadlineMap.get(atRaceNo)) ?? fallbackUpdatedAt : fallbackUpdatedAt;
	const temperature = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-direction .weather1_bodyUnitLabelData").first().text());
	const weather = compactText(weatherRoot.find(".weather1_bodyUnit.is-weather .weather1_bodyUnitLabelTitle").first().text()) || null;
	const windSpeed = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-wind .weather1_bodyUnitLabelData").first().text());
	const windDirection = parseWindDirectionFromIconClass(weatherRoot.find(".weather1_bodyUnit.is-windDirection .weather1_bodyUnitImage").attr("class"));
	const waterTemperature = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-waterTemperature .weather1_bodyUnitLabelData").first().text());
	const waveHeight = parseMeasurement(weatherRoot.find(".weather1_bodyUnit.is-wave .weather1_bodyUnitLabelData").first().text());

	if (!weather && !windDirection && !windSpeed && !waveHeight && !temperature && !waterTemperature) {
		return null;
	}

	return {
		weather,
		windDirection,
		windSpeed,
		waveHeight,
		temperature,
		waterTemperature,
		source,
		updatedAt,
	};
}

async function fetchRaceBeforeInfo(venue, raceNo, { timestamps, deadlineTime, fallbackUpdatedAt }) {
	const html = await fetchOfficialHtml(OFFICIAL_ENDPOINTS.venueBeforeInfo(venue.venueCode, timestamps.dateKey, raceNo));
	if (!html) {
		return null;
	}

	return parseBeforeInfoPage(html, {
		date: timestamps.date,
		raceNo,
		deadlineTime,
		fallbackUpdatedAt,
		source: "official:owpc-html+beforeinfo",
	});
}

async function fetchVenueWeather(venue, { timestamps, raceTitles, fallbackVenue }) {
	const targetRaceNo = venue.currentRaceNo ?? fallbackVenue?.races?.at(-1)?.raceNo ?? 12;
	const raceDeadlineMap = new Map((raceTitles ?? []).map((race) => [race.raceNo, race.deadlineTime]));
	const fallbackUpdatedAt = fallbackVenue?.weatherActual?.updatedAt ?? timestamps.generatedAt;
	const html = await fetchOfficialHtml(OFFICIAL_ENDPOINTS.venueBeforeInfo(venue.venueCode, timestamps.dateKey, targetRaceNo));
	if (!html) {
		return null;
	}

	return parseVenueWeatherPage(html, {
		date: timestamps.date,
		raceDeadlineMap,
		fallbackUpdatedAt,
		source: "official:owpc-html+odds+venue-weather",
	});
}

function mergeOddsPreview(baseOddsPreview, officialOddsPreview) {
	if (!officialOddsPreview) {
		return baseOddsPreview ?? null;
	}

	return {
		...(baseOddsPreview ?? {}),
		...officialOddsPreview,
	};
}

function mergeRaceResult(baseResult, officialResult) {
	if (!officialResult) {
		return baseResult ?? null;
	}

	const startInfos = officialResult.startInfos?.length
		? officialResult.startInfos
		: officialResult.startInfo?.length
			? officialResult.startInfo
			: baseResult?.startInfos?.length
				? baseResult.startInfos
				: baseResult?.startInfo ?? [];
	const payouts = officialResult.payouts?.length
		? officialResult.payouts
		: officialResult.payoutsFull?.length
			? officialResult.payoutsFull
			: baseResult?.payouts?.length
				? baseResult.payouts
				: baseResult?.payoutsFull ?? [];

	return {
		...(baseResult ?? {}),
		...officialResult,
		finishOrder: officialResult.finishOrder?.length ? officialResult.finishOrder : baseResult?.finishOrder ?? [],
		finishers: officialResult.finishers?.length ? officialResult.finishers : baseResult?.finishers ?? [],
		startInfo: startInfos,
		startInfos,
		payout3tan: officialResult.payout3tan ?? baseResult?.payout3tan ?? null,
		payout2tan: officialResult.payout2tan ?? baseResult?.payout2tan ?? null,
		payout3fuku: officialResult.payout3fuku ?? baseResult?.payout3fuku ?? null,
		payout2fuku: officialResult.payout2fuku ?? baseResult?.payout2fuku ?? null,
		payoutWide: officialResult.payoutWide ?? baseResult?.payoutWide ?? null,
		payoutWin: officialResult.payoutWin ?? baseResult?.payoutWin ?? null,
		payoutPlace: officialResult.payoutPlace ?? baseResult?.payoutPlace ?? null,
		payouts,
		payoutsFull: officialResult.payoutsFull?.length ? officialResult.payoutsFull : baseResult?.payoutsFull ?? [],
		refunds: officialResult.refunds?.length ? officialResult.refunds : baseResult?.refunds ?? [],
		refundText: officialResult.refundText ?? baseResult?.refundText,
		remarks: officialResult.remarks ?? baseResult?.remarks,
		notes: officialResult.notes ?? officialResult.remarks ?? baseResult?.notes,
		winningMove: officialResult.winningMove ?? officialResult.winningMethod ?? officialResult.kimarite ?? baseResult?.winningMove ?? baseResult?.winningMethod ?? baseResult?.kimarite,
		weatherActual: officialResult.weatherActual ?? baseResult?.weatherActual,
		finalizedAt: officialResult.finalizedAt ?? baseResult?.finalizedAt,
		finalOdds: officialResult.finalOdds ?? baseResult?.finalOdds ?? null,
	};
}

function inferRaceStatus(raceNo, venue, result, fallbackStatus) {
	if (result?.status === "confirmed") {
		return "finished";
	}

	if (venue?.currentRaceNo === raceNo && venue?.status === "selling") {
		return "selling";
	}

	if (typeof venue?.currentRaceNo === "number" && raceNo < venue.currentRaceNo && venue?.status !== "scheduled") {
		return fallbackStatus ?? "closed";
	}

	return fallbackStatus ?? "scheduled";
}

function hasValidRacerRows(racers) {
	if (!Array.isArray(racers) || racers.length === 0) {
		return false;
	}

	return racers.length >= 6 && racers.every((racer) => {
		const frameNo = Number(racer?.frameNo ?? racer?.frame);
		const name = compactText(racer?.name ?? racer?.playerName ?? racer?.boatRacerName);
		const registrationNo = compactText(racer?.registrationNo ?? racer?.racerId);

		return (
			frameNo >= 1 &&
			frameNo <= 6 &&
			!/^\s*枠\d+\s*$/.test(name) &&
			/^\d{4}$/.test(registrationNo)
		);
	});
}

function mergeVenueRaces(venue, fallbackVenue, raceTitles, resultListRaces, raceOddsMap, raceBeforeInfoMap, date, generatedAt) {
	const fallbackRaceMap = new Map((fallbackVenue?.races ?? []).map((race) => [race.raceNo, race]));
	const raceTitleMap = new Map((raceTitles ?? []).map((race) => [race.raceNo, race]));
	const officialRaceMap = new Map();

	for (const titleEntry of raceTitles ?? []) {
		officialRaceMap.set(titleEntry.raceNo, {
			raceNo: titleEntry.raceNo,
			title: titleEntry.title,
			deadlineTime: titleEntry.deadlineTime,
			racers: Array.isArray(titleEntry.racers) ? titleEntry.racers : [],
		});
	}

	for (const race of resultListRaces ?? []) {
		const existing = officialRaceMap.get(race.raceNo) ?? { raceNo: race.raceNo };
		officialRaceMap.set(race.raceNo, { ...existing, ...race, result: mergeRaceResult(existing.result, race.result) });
	}

	const raceNumbers = new Set([...fallbackRaceMap.keys(), ...officialRaceMap.keys()]);
	for (let raceNo = 1; raceNo <= 12; raceNo += 1) {
		raceNumbers.add(raceNo);
	}

	const merged = Array.from(raceNumbers).filter((raceNo) => typeof raceNo === "number" && Number.isFinite(raceNo)).sort((left, right) => left - right).map((raceNo) => {
		const fallbackRace = fallbackRaceMap.get(raceNo) ?? null;
		const officialRace = officialRaceMap.get(raceNo) ?? null;
		const officialOdds = raceOddsMap.get(raceNo)?.oddsPreview ?? null;
		const officialBeforeInfo = raceBeforeInfoMap.get(raceNo) ?? null;
		const officialRacers = Array.isArray(officialRace?.racers) ? officialRace.racers : [];
		const officialExhibitions = Array.isArray(officialBeforeInfo?.exhibitions) ? officialBeforeInfo.exhibitions : [];
		const oddsPreview = mergeOddsIntoRace(fallbackRace?.oddsPreview, officialOdds, generatedAt);
		const mergedResult = attachFinalOddsToResult(mergeRaceResult(fallbackRace?.result, officialRace?.result), oddsPreview);

		return {
			raceNo,
			raceId: fallbackRace?.raceId ?? `${date.replace(/-/g, "")}-${venue.id}-${String(raceNo).padStart(2, "0")}`,
			title: officialRace?.title ?? raceTitleMap.get(raceNo)?.title ?? fallbackRace?.title ?? `${raceNo}R`,
			deadlineTime: officialRace?.deadlineTime ?? fallbackRace?.deadlineTime ?? "",
			startTime: fallbackRace?.startTime ?? "",
			status: inferRaceStatus(raceNo, venue, officialRace?.result, fallbackRace?.status),
            racers: hasValidRacerRows(officialRacers)
               ? officialRacers
               : hasValidRacerRows(fallbackRace?.racers)
                 ? fallbackRace.racers
                 : [],
			exhibitions: officialExhibitions.length ? officialExhibitions : fallbackRace?.exhibitions ?? [],
			oddsPreview,
			result: mergedResult,
			weatherActual: officialBeforeInfo?.weatherActual ?? fallbackRace?.weatherActual,
		};
	});

	return enrichRaceTitles(merged, raceTitleMap);
}

function chooseDetailedRaceTargets(races) {
	return (races ?? [])
		.filter((race) => race?.result?.status === "confirmed")
		.map((race) => race.raceNo)
		.sort((left, right) => right - left)
		.slice(0, Number.isFinite(MAX_DETAILED_RESULTS_PER_VENUE) ? MAX_DETAILED_RESULTS_PER_VENUE : 12);
}

function mergeDetailedResults(resultListRaces, detailedRaceResults) {
	const detailedMap = new Map(detailedRaceResults.map((item) => [item.raceNo, item.result]));
	return (resultListRaces ?? []).map((race) => ({ ...race, result: mergeRaceResult(race.result, detailedMap.get(race.raceNo)) }));
}

export async function fetchTodayRaceIndex({ existingFeed, timestamps }) {
	const fallbackVenueByCode = new Map((existingFeed?.venues ?? []).map((venue) => [venue.venueCode, venue]));
	const html = await fetchOfficialHtml(OFFICIAL_ENDPOINTS.todayRaceIndex());

	if (html) {
		const venues = parseIndexVenueRows(html, { date: timestamps.date, dateKey: timestamps.dateKey, fallbackVenueByCode });
		if (venues.length) {
			return { venues, source: "official:owpc-html" };
		}
	}

	return {
		venues: Array.isArray(existingFeed?.venues) ? existingFeed.venues.map((venue) => ({ id: venue.id, venueCode: venue.venueCode, venueName: venue.venueName, title: venue.title, date: venue.date, session: venue.session, status: venue.status, source: venue.source })) : [],
		fallbackVenues: existingFeed?.venues ?? [],
		source: existingFeed?.source ? `fallback:${existingFeed.source}` : "fallback:existing-json",
	};
}

export async function fetchVenueRaceDetails(venue, { fallbackVenueByCode, timestamps, updateOptions = {} }) {
	const options = normalizeUpdateOptions(updateOptions);
	const foundFallbackVenue = fallbackVenueByCode.get(venue.venueCode) ?? null;
	const fallbackVenue = foundFallbackVenue?.date === timestamps.date ? foundFallbackVenue : null;
	if (!shouldFetchVenueForOptions(venue, fallbackVenue, options)) {
		return buildFilteredFallbackVenue(venue, fallbackVenue, timestamps, fallbackVenue?.source ?? "fallback:filtered-venue");
	}

	const resultListUrl = venue?.links?.resultListUrl ?? OFFICIAL_ENDPOINTS.venueResultList(venue.venueCode, timestamps.dateKey);
	const raceTitles = options.fetchSections.raceTitles ? await fetchRaceTitles(venue, timestamps) : [];
	const resultListHtml = options.fetchSections.resultList ? await fetchOfficialHtml(resultListUrl) : null;
	let resultListRaces = resultListHtml ? parseResultListPage(resultListHtml) : [];
	const completedRaceNumbers = new Set(
		(fallbackVenue?.races ?? [])
			.filter((race) => shouldSkipRaceUpdate(race, options.mode))
			.map((race) => normalizeRaceNo(race.raceNo))
			.filter((raceNo) => raceNo !== null),
	);
	const completedRaceKeys = new Map(
		(fallbackVenue?.races ?? [])
			.filter((race) => shouldSkipRaceUpdate(race, options.mode))
			.map((race) => [normalizeRaceNo(race.raceNo), buildCompletedRaceKey(fallbackVenue?.venueName ?? venue.venueName, race.raceNo)])
			.filter(([raceNo]) => raceNo !== null),
	);
	const plannedTargetRaceNumbers = options.targetRaceNumbers.length
		? options.targetRaceNumbers
		: options.mode === "active"
			? selectActiveRaceNumbers({ raceTitles, fallbackVenue, timestamps })
			: options.mode === "results" || options.mode === "final"
				? selectResultsRaceNumbers({ raceTitles, resultListRaces, fallbackVenue, timestamps, mode: options.mode })
				: RACE_NUMBERS;
	const skippedTargetRaceNumbers = plannedTargetRaceNumbers.filter((raceNo) => completedRaceNumbers.has(raceNo));
	const targetRaceNumbers = plannedTargetRaceNumbers.filter((raceNo) => !completedRaceNumbers.has(raceNo));
	const beforeInfoTargetRaceNumbers = getBeforeInfoTargetRaceNumbers(targetRaceNumbers, options).filter((raceNo) => !completedRaceNumbers.has(raceNo));
	const detailedTargets = options.fetchSections.detailedResults
		? (options.mode === "results" || options.mode === "final"
			? targetRaceNumbers
			: chooseDetailedRaceTargets(resultListRaces).filter((raceNo) => targetRaceNumbers.includes(raceNo)))
		: [];
	const completedSkipStats = {
		skipped: skippedTargetRaceNumbers.length,
		updated: targetRaceNumbers.length,
		keys: skippedTargetRaceNumbers.map((raceNo) => completedRaceKeys.get(raceNo)).filter(Boolean),
	};
	const detailedRaceResults = [];

	for (const raceNo of detailedTargets) {
		const detailedHtml = await fetchOfficialHtml(OFFICIAL_ENDPOINTS.venueResult(venue.venueCode, timestamps.dateKey, raceNo));
		if (!detailedHtml) {
			continue;
		}

		const detailedResult = parseDetailedResultPage(detailedHtml);
		if (Object.keys(detailedResult).length > 0) {
			detailedResult.status = detailedResult.status ?? "confirmed";
			detailedResult.finalizedAt = detailedResult.finalizedAt ?? timestamps.generatedAt;
		}

		detailedRaceResults.push({ raceNo, result: detailedResult });
	}

	if (detailedRaceResults.length) {
		resultListRaces = mergeDetailedResults(resultListRaces, detailedRaceResults);
	}

	const titleMap = new Map(raceTitles.map((race) => [race.raceNo, race]));
	const raceOddsResults = options.fetchSections.odds
		? await Promise.all(
			targetRaceNumbers.map((raceNo) =>
			fetchRaceOdds(venue, raceNo, {
				timestamps,
				deadlineTime:
					titleMap.get(raceNo)?.deadlineTime ??
					fallbackVenue?.races?.find((race) => race.raceNo === raceNo)?.deadlineTime ??
					null,
			}),
			),
		)
		: [];
	const raceOddsMap = new Map(raceOddsResults.filter(Boolean).map((item) => [item.raceNo, item]));
	const raceBeforeInfoResults = options.fetchSections.beforeInfo
		? await Promise.all(
			beforeInfoTargetRaceNumbers.map((raceNo) =>
			fetchRaceBeforeInfo(venue, raceNo, {
				timestamps,
				deadlineTime:
					titleMap.get(raceNo)?.deadlineTime ??
					fallbackVenue?.races?.find((race) => race.raceNo === raceNo)?.deadlineTime ??
					null,
				fallbackUpdatedAt: fallbackVenue?.weatherActual?.updatedAt ?? timestamps.generatedAt,
			}),
			),
		)
		: [];
	const raceBeforeInfoMap = new Map(raceBeforeInfoResults.filter(Boolean).map((item) => [item.raceNo, item]));
	const mergedRaces = mergeVenueRaces(venue, fallbackVenue, raceTitles, resultListRaces, raceOddsMap, raceBeforeInfoMap, timestamps.date, timestamps.generatedAt);
	const officialVenueWeather =
		Array.from(raceBeforeInfoMap.values()).find((item) => hasResolvedWeatherActual(item.weatherActual))?.weatherActual ??
		(options.fetchSections.venueWeather ? await fetchVenueWeather(venue, { timestamps, raceTitles, fallbackVenue }) : null);
	const mergedVenueWeather = mergeVenueWeather(
		fallbackVenue?.weatherActual,
		officialVenueWeather,
		timestamps.generatedAt,
		officialVenueWeather?.source ?? venue.source ?? "official:owpc-html",
	);
	const usedOfficial = Boolean(raceTitles.length || resultListHtml || raceOddsMap.size);
	const oddsRaceCount = mergedRaces.filter((race) => {
		const oddsPreview = race.oddsPreview ?? {};
		return (oddsPreview.trifectaTop?.length ?? 0) > 0 || (oddsPreview.exactaTop?.length ?? 0) > 0 || (oddsPreview.quinellaTop?.length ?? 0) > 0;
	}).length;
	const hasVenueWeather = hasResolvedWeatherActual(mergedVenueWeather);

	return {
		id: venue.id ?? venueIdFrom(venue.venueCode, fallbackVenue, venue.venueName),
		venueCode: venue.venueCode,
		venueName: venue.venueName ?? fallbackVenue?.venueName ?? "不明会場",
		title: venue.title ?? fallbackVenue?.title ?? "",
		date: timestamps.date,
		session: venue.session ?? fallbackVenue?.session ?? "unknown",
		status: venue.status ?? fallbackVenue?.status ?? "scheduled",
		dayText: venue.dayText ?? fallbackVenue?.dayText ?? "",
		statusText: venue.statusText ?? fallbackVenue?.statusText ?? "",
		currentRaceNo: venue.currentRaceNo ?? fallbackVenue?.currentRaceNo ?? null,
		updateStats: {
			completedSkip: completedSkipStats,
		},
		source: usedOfficial
			? hasVenueWeather
				? oddsRaceCount > 0
					? "official:owpc-html+odds+venue-weather"
					: "official:owpc-html+venue-weather"
				: oddsRaceCount > 0
					? "official:owpc-html+odds"
					: "official:owpc-html"
			: fallbackVenue?.source ?? "fallback:empty-venue",
		weatherActual: mergedVenueWeather,
		races: mergedRaces,
	};
}

export function buildTodayRaceDetailsFeed({ raceIndex, venueDetails, generatedAt, date }) {
	const officialVenueCount = venueDetails.filter((venue) => String(venue?.source ?? "").startsWith("official:")).length;
	const weatherVenueCount = venueDetails.filter((venue) => hasResolvedWeatherActual(venue.weatherActual)).length;
	const totalRaceCount = venueDetails.reduce((count, venue) => count + (venue.races?.length ?? 0), 0);
	const oddsRaceCount = venueDetails.reduce((count, venue) => count + (venue.races ?? []).filter((race) => {
		const oddsPreview = race.oddsPreview ?? {};
		return (oddsPreview.trifectaTop?.length ?? 0) > 0 || (oddsPreview.exactaTop?.length ?? 0) > 0 || (oddsPreview.quinellaTop?.length ?? 0) > 0;
	}).length, 0);
	const baseSource = officialVenueCount > 0 ? officialVenueCount === venueDetails.length ? "official:owpc-html" : "official:owpc-html-partial" : raceIndex.source;
	const source = baseSource.startsWith("official:")
		? oddsRaceCount === 0
			? weatherVenueCount > 0
				? `${baseSource}+venue-weather`
				: baseSource
			: oddsRaceCount === totalRaceCount
				? weatherVenueCount > 0
					? `${baseSource}+odds+venue-weather`
					: `${baseSource}+odds`
				: weatherVenueCount > 0
					? `${baseSource}+partial-odds+venue-weather`
					: `${baseSource}+partial-odds`
		: baseSource;

	return {
		version: 2,
		generatedAt,
		date,
		source,
		venues: venueDetails,
	};
}

export async function writeTodayRaceDetailsJson(feed) {
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
	await writeFile(todayOutputPath, `${JSON.stringify(feed, null, 2)}\n`, "utf8");
	return [outputPath, todayOutputPath];
}

export async function main(rawOptions = {}) {
	const baseOptions = normalizeUpdateOptions(rawOptions);
	const timestamps = getJstTimestampParts(baseOptions.targetDate);
	const existingFeedRaw = await readExistingFeed(timestamps);
	const existingFeed = existingFeedRaw?.date === timestamps.date ? existingFeedRaw : null;
	if (existingFeedRaw?.date && existingFeedRaw.date !== timestamps.date) {
		console.log(`[update-today-race-details] ignore existing feed for ${existingFeedRaw.date}; targetDate is ${timestamps.date}`);
	}
	const raceIndex = await fetchTodayRaceIndex({ existingFeed, timestamps });
	const updateOptions = normalizeUpdateOptions({
		...baseOptions,
		effectiveTargetSession:
			baseOptions.mode === "active"
				? resolveActiveTargetSession(baseOptions.targetSession, raceIndex, existingFeed, timestamps)
				: baseOptions.targetSession,
	});
	const fallbackVenueByCode = new Map((existingFeed?.venues ?? []).map((venue) => [venue.venueCode, venue]));
	const normalizedVenueDetails = [];
	const completedSkipSummary = {
		skipped: 0,
		updated: 0,
		keys: [],
	};

	for (const venue of raceIndex.venues ?? []) {
		const rawVenue = await fetchVenueRaceDetails(venue, { fallbackVenueByCode, timestamps, updateOptions });
		const completedSkip = rawVenue?.updateStats?.completedSkip;
		if (completedSkip) {
			completedSkipSummary.skipped += completedSkip.skipped ?? 0;
			completedSkipSummary.updated += completedSkip.updated ?? 0;
			completedSkipSummary.keys.push(...(completedSkip.keys ?? []));
		}
		normalizedVenueDetails.push(normalizeVenueData(rawVenue, timestamps.generatedAt, raceIndex.source));
	}

	const feed = buildTodayRaceDetailsFeed({ raceIndex, venueDetails: normalizedVenueDetails, generatedAt: timestamps.generatedAt, date: timestamps.date });
	const writtenPaths = await writeTodayRaceDetailsJson(feed);
	for (const writtenPath of writtenPaths) {
		console.log(`updated: ${writtenPath}`);
	}
	console.log(`source: ${feed.source}`);
	console.log(`venues: ${feed.venues.length}`);
	console.log(`mode: ${updateOptions.mode}`);
	console.log(`targetSession: ${updateOptions.effectiveTargetSession}`);
	console.log(`targetDate: ${timestamps.date}`);
	if (updateOptions.mode === "active" || updateOptions.mode === "results" || updateOptions.mode === "final") {
		console.log(`[boat details] completed skip count=${completedSkipSummary.skipped} / update count=${completedSkipSummary.updated}`);
		if (process.env.BOAT_RACE_DEBUG_COMPLETED_SKIP === "1" && completedSkipSummary.keys.length) {
			console.log(`[boat details] completed skip races=${completedSkipSummary.keys.slice(0, 24).join(", ")}`);
		}
	}
	return feed;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
	main(parseUpdateOptionsFromArgv()).catch((error) => {
		console.error("failed to update today race details feed");
		console.error(error);
		process.exitCode = 1;
	});
}
