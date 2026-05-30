import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { BoatPredictionRecord, BoatPredictionTicket } from "../lib/boatraceTypes";
import { BoatGptMaterialPanel } from "../components/boatrace/BoatGptMaterialPanel";
import { BoatPracticeResultPanel } from "../components/boatrace/BoatPracticeResultPanel";
import { BoatPredictionPastePanel } from "../components/boatrace/BoatPredictionPastePanel";
import { BoatPredictionVenueRaceChooser } from "../components/boatrace/BoatPredictionVenueRaceChooser";
import { PageShell } from "../components/layout/PageShell";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import {
	emptyBoatBetSummary,
	parseBoatBets,
	type ParsedBoatBet,
	type ParsedBoatBetSummary,
} from "../lib/boatBetParser";
import { buildBoatPredictionMaterial } from "../lib/boatPredictionMaterial";
import { parseBoatPredictionTickets } from "../lib/boatPredictionParser";
import {
	findBoatRaceResultForPractice,
	settleBoatPredictionResult,
	type BoatPracticeResultStatus,
	type BoatRaceResultLookupDebug,
	type BoatResultLookupStatus,
} from "../lib/boatResultSettlement";
import {
	findSelectedRaceExtra,
	findSelectedVenueExtra,
	loadBoatVenueExtrasFeed,
	type BoatVenueExtrasFeed,
} from "../lib/boatVenueExtrasFeed";
import {
	loadBoatVenueFeatureIndex,
	loadBoatVenueFeatureNote,
	loadBoatVenueUserInsights,
	type BoatVenueFeatureIndex,
	type BoatVenueFeatureNote,
	type BoatVenueUserInsight,
} from "../lib/boatVenueFeatures";
import type { BoatPracticeResultRecord } from "../lib/boatPracticeResultStorage";
import { withBasePath } from "../lib/assetPath";
import { pruneBoatLocalRecordsByDate } from "../lib/boatLocalStorageMaintenance";
import { getBoatOperationDate, resolveActiveBoatOperationDate, shiftBoatOperationDate } from "../lib/boatOperationDate";
import {
	compactBoatPracticeResultRecords,
	calculateBoatPracticeProfitLoss,
	deleteBoatPracticeResultRecord,
	findBoatPracticeResultRecord,
	isBoatPracticeHit,
	loadBoatPracticeResultRecords,
	saveBoatPracticeResultRecords,
	upsertBoatPracticeResultRecord,
} from "../lib/boatPracticeResultStorage";
import {
	buildBoatPredictionRaceKey,
	deleteBoatPredictionRecord,
	findBoatPredictionRecord,
	hydrateBoatPredictionRecord,
	loadBoatPredictionRecords,
	upsertBoatPredictionRecord,
} from "../lib/boatPredictionStorage";
import {
	buildBoatJohnsonGeneratedPayload,
	buildBoatJohnsonRecordsFromPredictionRecords,
	loadBoatJohnsonPredictionRecords,
	saveBoatJohnsonPredictionRecords,
} from "../lib/boatJohnsonPredictionStorage";

const panelGridClassName = "prediction-page-main-panels";

const savedMessageStyle = {
	margin: "-4px 0 0",
	fontSize: "0.9rem",
	fontWeight: 700,
	color: "#2c5b7a",
};

const practiceMessageStyle = {
	margin: "6px 0 -4px",
	fontSize: "0.9rem",
	fontWeight: 700,
	color: "#7a4a5f",
};

const autoSettleChipRowStyle = {
	display: "flex",
	gap: "10px",
	flexWrap: "wrap" as const,
	alignItems: "center",
};

const autoSettleChipStyle = {
	padding: "8px 12px",
	borderRadius: "999px",
	background: "rgba(240, 248, 253, 0.94)",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	color: "#2c7fa3",
	fontSize: "0.78rem",
	fontWeight: 800,
};

const autoSettleButtonStyle = {
	...autoSettleChipStyle,
	cursor: "pointer",
	background: "rgba(255, 255, 255, 0.98)",
};

const johnsonActionRowStyle = {
	display: "flex",
	gap: "10px",
	flexWrap: "wrap" as const,
	alignItems: "center",
	justifyContent: "flex-end",
};

const johnsonPrimaryButtonStyle = {
	padding: "10px 14px",
	borderRadius: "14px",
	border: "1px solid rgba(17, 64, 92, 0.08)",
	background: "linear-gradient(135deg, #12344f 0%, #1e5778 100%)",
	color: "#ffffff",
	fontSize: "0.82rem",
	fontWeight: 900,
	cursor: "pointer",
	boxShadow: "0 12px 24px rgba(18, 52, 79, 0.16)",
};

const johnsonSecondaryButtonStyle = {
	padding: "10px 14px",
	borderRadius: "14px",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	background: "rgba(255, 255, 255, 0.96)",
	color: "#12344f",
	fontSize: "0.82rem",
	fontWeight: 900,
	cursor: "pointer",
	boxShadow: "0 10px 20px rgba(17, 64, 92, 0.06)",
};

const johnsonSummaryStyle = {
	display: "flex",
	gap: "8px",
	flexWrap: "wrap" as const,
	justifyContent: "flex-end",
	alignItems: "center",
	margin: "2px 0 0",
	fontSize: "0.76rem",
	fontWeight: 800,
	color: "#345166",
};

const johnsonSummaryChipStyle = {
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(240, 248, 253, 0.96)",
	border: "1px solid rgba(93, 199, 232, 0.18)",
};

const MAX_AUTO_SETTLE_PER_RUN = 12;
const AUTO_SETTLE_STORAGE_LIMIT_KB = 4500;
const LOCAL_STORAGE_WARNING_KB = 4000;
const MIN_HIT_TICKER_CARD_COUNT = 6;

const getRaceKey = (venueId: string, raceId: string | undefined, raceNo: number) => raceId ?? `${venueId}-${raceNo}`;

const PREDICTION_SELECTION_STORAGE_KEY = "kurari-boat-data-labo-prediction-selected-race";

type BoatPredictionTodayFeed = typeof sampleBoatTodayFeed;
type BoatPredictionVenue = BoatPredictionTodayFeed["venues"][number];
type BoatPredictionRace = BoatPredictionVenue["races"][number];
type PredictionRaceExhibitionStatus = {
	level: "ready" | "partial" | "waiting";
	title: string;
	shortLabel: string;
	detail: string;
};

const toArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const getVenueRaces = (venue: BoatPredictionVenue | undefined): BoatPredictionRace[] =>
	toArray<BoatPredictionRace>((venue as { races?: unknown } | undefined)?.races);

const toPredictionTickets = (bets: ReturnType<typeof parseBoatBets>["bets"]): BoatPredictionTicket[] =>
	bets.map((bet, index) => ({
		index: String(index + 1).padStart(2, "0"),
		betType: bet.type === "trifecta" ? "3連単" : bet.type === "exacta" ? "2連単" : bet.label,
		combination: bet.normalized,
		note: bet.sourceLine,
	}));

const inferParsedBetTypeFromTicket = (ticket: BoatPredictionTicket): ParsedBoatBet["type"] | null => {
	if (ticket.betType.includes("3連単")) {
		return "trifecta";
	}

	if (ticket.betType.includes("2連単")) {
		return "exacta";
	}

	if (ticket.betType.includes("3連複")) {
		return "trio";
	}

	if (ticket.betType.includes("2連複")) {
		return "quinella";
	}

	if (ticket.betType.includes("拡連複") || ticket.betType.toLowerCase().includes("wide")) {
		return "wide";
	}

	const count = ticket.combination.split("-").filter(Boolean).length;
	return count >= 3 ? "trifecta" : count === 2 ? "exacta" : null;
};

const buildParsedBetSummaryFromTickets = (tickets: BoatPredictionTicket[]): ParsedBoatBetSummary => {
	const bets = tickets.flatMap<ParsedBoatBet>((ticket) => {
		const type = inferParsedBetTypeFromTicket(ticket);
		const numbers = ticket.combination
			.split("-")
			.map((value) => Number(value))
			.filter((value) => Number.isFinite(value));

		if (!type || numbers.length < 2) {
			return [];
		}

		return [{
			type,
			label: ticket.betType,
			numbers,
			normalized: ticket.combination,
			amountYen: 100,
			sourceLine: ticket.note || `${ticket.index} ${ticket.betType} ${ticket.combination}`,
		}];
	});

	return {
		bets,
		totalBets: bets.length,
		trifectaCount: bets.filter((bet) => bet.type === "trifecta").length,
		exactaCount: bets.filter((bet) => bet.type === "exacta").length,
		totalStakeYen: bets.length * 100,
	};
};

const buildStoredPredictionBetSummary = (record: BoatPredictionRecord | undefined): ParsedBoatBetSummary | null => {
	if (!record) {
		return null;
	}

	if (record.betSummary && Array.isArray(record.betSummary.bets) && record.betSummary.bets.length > 0) {
		return record.betSummary;
	}

	if (Array.isArray(record.parsedBets) && record.parsedBets.length > 0) {
		return {
			bets: record.parsedBets,
			totalBets: record.betSummary?.totalBets ?? record.parsedBets.length,
			trifectaCount:
				record.betSummary?.trifectaCount ?? record.parsedBets.filter((bet) => bet.type === "trifecta").length,
			exactaCount:
				record.betSummary?.exactaCount ?? record.parsedBets.filter((bet) => bet.type === "exacta").length,
			totalStakeYen:
				record.totalStakeYen ??
				record.betSummary?.totalStakeYen ??
				record.parsedBets.reduce((sum, bet) => sum + (bet.amountYen || 100), 0),
		};
	}

	if (Array.isArray(record.tickets) && record.tickets.length > 0) {
		return buildParsedBetSummaryFromTickets(record.tickets);
	}

	return null;
};

const readPracticeNumber = (value: unknown): number => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value.replace(/[^\d.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
};

const formatPracticeYen = (value: unknown): string => `${readPracticeNumber(value).toLocaleString("ja-JP")}円`;

const formatPracticeProfit = (value: unknown): string => {
	const amount = readPracticeNumber(value);
	const prefix = amount > 0 ? "+" : "";
	return `${prefix}${amount.toLocaleString("ja-JP")}円`;
};

const formatPracticeRoi = (value: unknown): string => `${readPracticeNumber(value).toFixed(1)}%`;

const formatJohnsonHitBetNumbers = (value: unknown): string => {
	if (Array.isArray(value)) {
		return value.map((item) => readPracticeNumber(item)).filter((item) => item > 0).join("-");
	}

	return String(value ?? "")
		.trim()
		.replace(/[\s,、/]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
};

// localStorage だけではスマホや GitHub Actions から読めないため、watcher が拾う JSON も書き出す。
const downloadJsonFile = (filename: string, text: string): void => {
	if (typeof window === "undefined") {
		return;
	}

	const blob = new Blob([text], { type: "application/json;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.append(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
};

const buildDownloadableJohnsonPayloadText = (payload: unknown): string | null => {
	try {
		const safePayload = JSON.parse(JSON.stringify(payload));
		return `${JSON.stringify(safePayload, null, 2)}\n`;
	} catch (error) {
		console.error("[boat-johnson-export] failed to serialize payload", error);
		return null;
	}
};

const resolvePracticeStakeYen = (record: BoatPracticeResultRecord): number =>
	readPracticeNumber(record.totalStakeYen ?? record.betSummary?.totalStakeYen ?? record.investmentAmount);

const resolvePracticePayoutYen = (record: BoatPracticeResultRecord): number =>
	readPracticeNumber(record.payoutYen ?? record.payoutAmount);

const resolvePracticeProfitYen = (record: BoatPracticeResultRecord): number => {
	const storedProfit = record.profitYen ?? record.profitLoss;
	if (storedProfit !== undefined) {
		return readPracticeNumber(storedProfit);
	}

	return resolvePracticePayoutYen(record) - resolvePracticeStakeYen(record);
};

const isPracticeSummaryRecord = (record: BoatPracticeResultRecord, date: string | undefined): boolean => {
	if (!date || record.date !== date) {
		return false;
	}

	if (record.resultStatus === "pending" || record.resultStatus === "missing") {
		return false;
	}

	return record.resultStatus === "confirmed" || resolvePracticePayoutYen(record) > 0 || Boolean(record.actualFinishOrderText);
};

const buildPracticeLookupDebugText = (debug: BoatRaceResultLookupDebug | undefined): string => {
	if (!debug) {
		return "";
	}

	return [
		`targetDate=${debug.targetDate ?? "-"}`,
		`feedDate=${debug.feedDate ?? "-"}`,
		`venue=${debug.targetVenueName ?? "-"}(${debug.targetVenueCode ?? "-"})`,
		`matched=${debug.matchedVenueName ?? "-"}(${debug.matchedVenueCode ?? "-"})`,
		`race=${debug.raceNo ?? "-"}`,
		`raceFound=${debug.raceFound ? "yes" : "no"}`,
		`result=${debug.resultFound ? "yes" : "no"}`,
		`payout=${debug.payoutFound ? "yes" : "no"}`,
		`order=${debug.finishOrderText ?? "-"}`,
		`3tan=${debug.trifectaPayout ?? "-"}`,
		`2tan=${debug.exactaPayout ?? "-"}`,
	].join(" / ");
};

const readPracticeHitBetLabel = (record: BoatPracticeResultRecord): string => {
	const hitBet = Array.isArray(record.hitBets) ? record.hitBets[0] : undefined;
	if (hitBet) {
		return `${hitBet.label} ${hitBet.normalized}`;
	}

	if (record.hitBetType && Array.isArray(record.hitBetNumbers) && record.hitBetNumbers.length > 0) {
		return `${record.hitBetType} ${record.hitBetNumbers.join("-")}`;
	}

	if (Array.isArray(record.hitBetNumbers) && record.hitBetNumbers.length > 0) {
		return record.hitBetNumbers.join("-");
	}

	return record.actualFinishOrderText || "-";
};

const normalizeBoatCombinationText = (value: unknown): string =>
	String(value ?? "")
		.normalize("NFKC")
		.replace(/[=＝]/g, "-")
		.replace(/[‐-‒–—―−－ーｰ~〜～>＞]/g, "-")
		.replace(/[^\d-]/g, "")
		.replace(/-+/g, "-")
		.replace(/^-+|-+$/g, "");

const findHitBetsByFinishOrder = (
	finishOrderText: string,
	parsedBets: ParsedBoatBet[],
): ParsedBoatBet[] => {
	const normalizedFinish = normalizeBoatCombinationText(finishOrderText);

	if (!normalizedFinish) {
		return [];
	}

	return parsedBets.filter((bet) => {
		const normalizedBet = normalizeBoatCombinationText(bet.normalized || bet.numbers?.join("-"));

		if (!normalizedBet) {
			return false;
		}

		if (bet.type === "trifecta" || bet.type === "exacta") {
			return normalizedBet === normalizedFinish;
		}

		return false;
	});
};

const mergePracticePayouts = (...sources: unknown[]): unknown[] => {
	const seen = new Set<string>();
	const merged: unknown[] = [];

	for (const source of sources) {
		for (const item of toArray<unknown>(source)) {
			const key = typeof item === "object" && item !== null
				? JSON.stringify(item)
				: String(item);

			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			merged.push(item);
		}
	}

	return merged;
};

const buildPracticeResultFingerprint = (params: {
	date: string;
	venueCode?: string;
	venueName: string;
	raceNo: number;
	finishOrderText: string;
	hitBetNumbers?: string;
	payoutYen: number;
	resultLookupStatus?: BoatResultLookupStatus;
}) => [
	params.date,
	params.venueCode || params.venueName,
	String(params.raceNo),
	params.finishOrderText,
	params.hitBetNumbers ?? "",
	String(params.payoutYen),
	params.resultLookupStatus ?? "",
].join("|");

const getLocalStorageSizeKb = (): number => {
	if (typeof window === "undefined") {
		return 0;
	}

	return Object.keys(window.localStorage).reduce((sum, key) => {
		const value = window.localStorage.getItem(key) ?? "";
		return sum + key.length + value.length;
	}, 0) / 1024;
};

const compactHitBetsForRecord = (bets: ParsedBoatBet[]): ParsedBoatBet[] | undefined => {
	if (bets.length <= 0) {
		return undefined;
	}

	return bets.slice(0, 3).map((bet) => ({
		type: bet.type,
		label: bet.label,
		numbers: bet.numbers,
		normalized: bet.normalized,
		amountYen: bet.amountYen,
		sourceLine: "",
	}));
};

type PredictionHeroTimeBand = "morning" | "day" | "night";

const predictionHeroImageSrcMap: Record<PredictionHeroTimeBand, string> = {
	morning: withBasePath("prediction-page/hero/prediction-hero-morning-kurari-funako-naughty.png"),
	day: withBasePath("prediction-page/hero/prediction-hero-day-kurari-funako-naughty.png"),
	night: withBasePath("prediction-page/hero/prediction-hero-night-kurari-funako-naughty.png"),
};

const predictionPageBackgroundImageSrc = withBasePath(
	"prediction-page/backgrounds/prediction-bg-water-sparkle.png",
);

const getPredictionHeroTimeBand = (venue: BoatPredictionVenue | undefined): PredictionHeroTimeBand => {
	const session = String((venue as { session?: unknown } | undefined)?.session ?? "").trim().toLowerCase();
	const title = String((venue as { title?: unknown } | undefined)?.title ?? "").replace(/\s+/g, "").toLowerCase();

	if (session === "morning" || title.includes("モーニング")) {
		return "morning";
	}

	if (session === "night" || session === "midnight" || title.includes("ナイター") || title.includes("ミッドナイト")) {
		return "night";
	}

	return "day";
};

const formatJstDateTimeLabel = (value: string | undefined): string => {
	if (!value) {
		return "未取得";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
};

const inferHitNotificationBetType = (record: BoatPracticeResultRecord, hitBetNumbers: string): string => {
	const explicitType = String(record.hitBetType ?? "").trim();
	if (explicitType) {
		return explicitType;
	}

	const hitBetLabel = String(record.hitBets?.[0]?.label ?? "").trim();
	if (hitBetLabel) {
		return hitBetLabel;
	}

	const parts = hitBetNumbers.split("-").map((value) => value.trim()).filter(Boolean);
	if (parts.length >= 3) {
		return "3連単";
	}

	if (parts.length === 2) {
		return "2連単";
	}

	return "券種未設定";
};

const hasRaceOddsPreview = (race: BoatPredictionRace): boolean => {
	const oddsPreview = (race as { oddsPreview?: unknown }).oddsPreview;

	if (Array.isArray(oddsPreview)) {
		return oddsPreview.length > 0;
	}

	if (oddsPreview && typeof oddsPreview === "object") {
		return Object.values(oddsPreview as Record<string, unknown>).some((value) => {
			if (Array.isArray(value)) {
				return value.length > 0;
			}

			return Boolean(value);
		});
	}

	return false;
};

const hasVenueWeather = (venue: BoatPredictionVenue): boolean => {
	const weatherActual = (venue as { weatherActual?: unknown }).weatherActual;
	const weather = (venue as { weather?: unknown }).weather;

	return Boolean(weatherActual || weather);
};

	const readLooseString = (value: unknown): string => {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
};

const readRaceTimeText = (race: unknown): { label: string; value: string } => {
	const record = toLooseRecord(race);

	const deadline =
		readLooseString(record.deadlineTime) ||
		readLooseString(record.deadline) ||
		readLooseString(record.closeTime) ||
		readLooseString(record["締切"]);

	if (deadline) {
		return { label: "締切", value: deadline };
	}

	const start =
		readLooseString(record.startTime) ||
		readLooseString(record.time) ||
		readLooseString(record["発走"]);

	if (start) {
		return { label: "発走", value: start };
	}

	return { label: "時刻", value: "未取得" };
};

const readRaceDeadlineOrStartTime = (race: unknown): string => {
	const record = toLooseRecord(race);

	return (
		readLooseString(record.deadlineTime) ||
		readLooseString(record.deadline) ||
		readLooseString(record.closeTime) ||
		readLooseString(record["締切"]) ||
		readLooseString(record.startTime) ||
		readLooseString(record.time) ||
		readLooseString(record["発走"])
	);
};

const toLooseRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const hasExhibitionTimeValue = (row: unknown): boolean => {
	const record = toLooseRecord(row);
	return Boolean(
		readLooseString(record.exhibitionTime) ||
		readLooseString(record.exhibition) ||
		readLooseString(record.displayTime) ||
		readLooseString(record.tenjiTime) ||
		readLooseString(record.showTime) ||
		readLooseString(record["展示"]) ||
		readLooseString(record["展示タイム"])
	);
};

const getRaceExhibitionRows = (
	race: unknown,
	raceExtra: unknown,
): unknown[] => {
	const raceRecord = toLooseRecord(race);
	const extraRecord = toLooseRecord(raceExtra);
	const officialBeforeInfo = toLooseRecord(extraRecord.officialBeforeInfo);

	const candidates = [
		raceRecord.exhibitions,
		officialBeforeInfo.exhibitionRows,
		officialBeforeInfo.beforeInfo,
		extraRecord.beforeInfo,
		extraRecord.officialBeforeInfo,
		extraRecord.originalExhibition,
		extraRecord.startExhibition,
	];

	for (const candidate of candidates) {
		const rows = toArray<unknown>(candidate);
		if (rows.length > 0) return rows;
	}

	return [];
};

const buildExhibitionStatusLabel = (params: {
	race: unknown;
	raceExtra: unknown;
	feedUpdatedAt?: string;
	extraUpdatedAt?: string;
}) => {
	const rows = getRaceExhibitionRows(params.race, params.raceExtra);
	const exhibitionTimeCount = rows.filter(hasExhibitionTimeValue).length;
	const updatedAt = params.extraUpdatedAt || params.feedUpdatedAt || "";

	if (exhibitionTimeCount >= 6) {
		return {
			level: "ready" as const,
			title: "展示タイム 6艇取得済み",
			detail: updatedAt ? `更新 ${formatJstDateTimeLabel(updatedAt)}` : "更新時刻未取得",
		};
	}

	if (exhibitionTimeCount > 0) {
		return {
			level: "partial" as const,
			title: `展示タイム ${exhibitionTimeCount}/6艇`,
			detail: updatedAt ? `更新 ${formatJstDateTimeLabel(updatedAt)}` : "一部取得済み",
		};
	}

	return {
		level: "waiting" as const,
		title: "展示タイム未取得",
		detail: "展示が入るまで予想注意",
	};
};

export function PredictionPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [dataUpdatedAt, setDataUpdatedAt] = useState("");
	const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [selectedVenueId, setSelectedVenueId] = useState<string>("");
	const [selectedRaceId, setSelectedRaceId] = useState<string>("");
	const [venueFeatureIndex, setVenueFeatureIndex] = useState<BoatVenueFeatureIndex | null>(null);
	const [selectedVenueFeatureNote, setSelectedVenueFeatureNote] = useState<BoatVenueFeatureNote | null>(null);
	const [venueFeatureInsights, setVenueFeatureInsights] = useState<BoatVenueUserInsight[]>([]);
	const [predictionText, setPredictionText] = useState<string>("");
	const [predictionTickets, setPredictionTickets] = useState<BoatPredictionTicket[]>([]);
	const [parsedBetSummary, setParsedBetSummary] = useState<ParsedBoatBetSummary>(emptyBoatBetSummary());
	const [savedPredictionRecord, setSavedPredictionRecord] = useState<BoatPredictionRecord | undefined>(undefined);
	const [savedMessage, setSavedMessage] = useState<string>("");
	const [savedPracticeResultRecord, setSavedPracticeResultRecord] = useState<BoatPracticeResultRecord | undefined>(undefined);
	const [practiceResultRecords, setPracticeResultRecords] = useState<BoatPracticeResultRecord[]>([]);
	const [practiceMessage, setPracticeMessage] = useState<string>("");
	const [actualFinishOrderText, setActualFinishOrderText] = useState<string>("");
	const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
	const [payoutAmount, setPayoutAmount] = useState<number>(0);
	const [practiceMemo, setPracticeMemo] = useState<string>("");
	const [isInvestmentAmountManual, setIsInvestmentAmountManual] = useState(false);
	const [practiceResultStatus, setPracticeResultStatus] = useState<BoatPracticeResultStatus | undefined>(undefined);
	const [practiceResultLookupStatus, setPracticeResultLookupStatus] = useState<BoatResultLookupStatus | undefined>(undefined);
	const [practiceResultLookupDebugText, setPracticeResultLookupDebugText] = useState("");
	const [practiceKimarite, setPracticeKimarite] = useState("");
	const [practiceStartInfoText, setPracticeStartInfoText] = useState("");
	const [practiceHitBetLabel, setPracticeHitBetLabel] = useState("");
	const [practiceSettlementMessage, setPracticeSettlementMessage] = useState("");
	const [isBetAutoApplied, setIsBetAutoApplied] = useState(false);
	const [isResultAutoApplied, setIsResultAutoApplied] = useState(false);
	const [predictionRecordsVersion, setPredictionRecordsVersion] = useState(0);
	const [autoSettleState, setAutoSettleState] = useState({
		enabled: true,
		autoSettledCount: 0,
		pendingCount: 0,
		lastRunAt: "",
		lastReason: "",
		warning: "",
	});
	const autoSettleRunKeyRef = useRef("");
	const autoSettledFingerprintRef = useRef<Set<string>>(new Set());

	const venues = useMemo<BoatPredictionVenue[]>(
		() =>
			toArray<BoatPredictionVenue>((todayFeed as { venues?: unknown }).venues).map((venue) => ({
				...venue,
				races: getVenueRaces(venue),
			})),
		[todayFeed],
	);

	const races = useMemo<BoatPredictionRace[]>(() => venues.flatMap((venue) => getVenueRaces(venue)), [venues]);
	const initialVenue = venues[0];
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? initialVenue;
	const activePredictionDate = useMemo(
		() => (dataUpdatedAt ? resolveActiveBoatOperationDate(todayFeed.date) : getBoatOperationDate()),
		[dataUpdatedAt, todayFeed.date],
	);
	const johnsonCoverageSummary = useMemo(() => {
		const savedPredictionRecords = Object.values(loadBoatPredictionRecords())
			.filter((record) => record.date === activePredictionDate && Boolean(record.predictionText?.trim()));
		const johnsonRaceKeySet = new Set(
			Object.values(loadBoatJohnsonPredictionRecords())
				.filter((record) => record.date === activePredictionDate)
				.map((record) => record.raceKey),
		);
		const johnsonizedCount = savedPredictionRecords.filter((record) => johnsonRaceKeySet.has(record.raceKey)).length;

		return {
			savedCount: savedPredictionRecords.length,
			johnsonizedCount,
			pendingCount: Math.max(savedPredictionRecords.length - johnsonizedCount, 0),
		};
	}, [activePredictionDate, predictionRecordsVersion]);
	const previousPredictionDate = useMemo(() => shiftBoatOperationDate(activePredictionDate, -1), [activePredictionDate]);
	const selectedVenueRaces = useMemo(() => getVenueRaces(selectedVenue), [selectedVenue]);
	const selectedRace =
		selectedVenueRaces.find((race) => getRaceKey(selectedVenue?.id ?? "", race.raceId, race.raceNo) === selectedRaceId) ??
		selectedVenueRaces[0];
const selectedVenueExtra = useMemo(	
	() => findSelectedVenueExtra(venueExtrasFeed, selectedVenue),
	[venueExtrasFeed, selectedVenue],
);

const selectedRaceExtra = useMemo(
	() => findSelectedRaceExtra(selectedVenueExtra, selectedRace),
	[selectedVenueExtra, selectedRace],
);

const raceExhibitionStatusMap = useMemo<Record<string, PredictionRaceExhibitionStatus>>(() => {
	const extraRaces = toArray<Record<string, unknown>>(
		(selectedVenueExtra as { races?: unknown } | null | undefined)?.races,
	);

	return selectedVenueRaces.reduce<Record<string, PredictionRaceExhibitionStatus>>((acc, race) => {
		const raceKey = getRaceKey(selectedVenue?.id ?? "", race.raceId, race.raceNo);
		const raceExtra = extraRaces.find((item) => Number(item.raceNo) === Number(race.raceNo));

		const status = buildExhibitionStatusLabel({
			race,
			raceExtra,
			feedUpdatedAt: todayFeed.generatedAt,
			extraUpdatedAt: venueExtrasFeed?.generatedAt,
		});

		acc[raceKey] = {
			...status,
			shortLabel:
				status.level === "ready"
					? "展示タイムOK"
					: status.level === "partial"
						? status.title.replace("展示タイム ", "展示")
						: "展示未取得",
		};

		return acc;
	}, {});
}, [selectedVenue, selectedVenueRaces, selectedVenueExtra, todayFeed.generatedAt, venueExtrasFeed?.generatedAt]);

	type PredictionSelectionSnapshot = {
	date?: string;
	venueId?: string;
	venueCode?: string;
	venueName?: string;
	raceId?: string;
	raceNo?: number;
	savedAt?: string;
};

const loadPredictionSelectionSnapshot = (): PredictionSelectionSnapshot | null => {
	if (typeof window === "undefined") return null;

	try {
		const raw = window.sessionStorage.getItem(PREDICTION_SELECTION_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PredictionSelectionSnapshot;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
};

const savePredictionSelectionSnapshot = (params: {
	date?: string;
	venue?: BoatPredictionVenue;
	race?: BoatPredictionRace;
}) => {
	if (typeof window === "undefined") return;
	if (!params.venue || !params.race) return;

	const snapshot: PredictionSelectionSnapshot = {
		date: params.date,
		venueId: params.venue.id,
		venueCode: params.venue.venueCode,
		venueName: params.venue.venueName,
		raceId: getRaceKey(params.venue.id, params.race.raceId, params.race.raceNo),
		raceNo: params.race.raceNo,
		savedAt: new Date().toISOString(),
	};

	try {
		window.sessionStorage.setItem(PREDICTION_SELECTION_STORAGE_KEY, JSON.stringify(snapshot));
	} catch {
		// sessionStorage失敗は無視
	}
};

const parseRaceTimeMinutes = (value: unknown): number | null => {
	const text = readLooseString(value);
	const match = text.match(/(\d{1,2}):(\d{2})/);
	if (!match) return null;

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

	return hour * 60 + minute;
};

const getJstNowMinutes = (): number => {
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date());

	const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
	const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

	return hour * 60 + minute;
};

const findCurrentTimeRaceSelection = (venues: BoatPredictionVenue[]) => {
	const nowMinutes = getJstNowMinutes();

	for (const venue of venues) {
		const races = getVenueRaces(venue);
		const upcomingRace =
			races.find((race) => {
				const deadline = parseRaceTimeMinutes(readRaceDeadlineOrStartTime(race));
				return deadline !== null && deadline >= nowMinutes - 8;
			}) ?? races[0];

		if (upcomingRace) {
			return {
				venue,
				race: upcomingRace,
				raceId: getRaceKey(venue.id, upcomingRace.raceId, upcomingRace.raceNo),
			};
		}
	}

	return null;
};

const buildPracticeFallbackRaceKey = (params: {
	selectedRaceKey?: string;
	venue?: BoatPredictionVenue;
	race?: BoatPredictionRace;
	todayDate?: string;
}): string => {
	if (params.selectedRaceKey) {
		return params.selectedRaceKey;
	}

	if (!params.venue || !params.race) {
		return "";
	}

	const fallbackDate = params.venue.date ?? params.todayDate ?? "";
	const predictionRaceKey = buildBoatPredictionRaceKey({
		date: fallbackDate,
		venueName: params.venue.venueName,
		raceNo: params.race.raceNo,
		raceId: params.race.raceId,
	});

	if (predictionRaceKey) {
		return predictionRaceKey;
	}

	return `boat-practice:${fallbackDate}:${params.venue.venueCode || params.venue.venueName}:${params.race.raceNo}`;
};

	const selectedRaceKey = useMemo(() => {
		if (!selectedVenue || !selectedRace) {
			return "";
		}

		return buildBoatPredictionRaceKey({
			date: activePredictionDate,
			venueName: selectedVenue.venueName,
			raceNo: selectedRace.raceNo,
			raceId: selectedRace.raceId,
		});
	}, [activePredictionDate, selectedVenue, selectedRace]);
	const practiceRaceKey = useMemo(
		() => buildPracticeFallbackRaceKey({
			selectedRaceKey,
			venue: selectedVenue,
			race: selectedRace,
			todayDate: activePredictionDate,
		}),
		[selectedRaceKey, selectedVenue, selectedRace, activePredictionDate],
	);

	const syncPredictionTicketsFromText = (nextPredictionText: string, options?: {
		applyInvestment?: boolean;
		preferredTickets?: BoatPredictionTicket[];
		preferredBetSummary?: ParsedBoatBetSummary | null;
	}) => {
		const parsedTicketsFromText = parseBoatPredictionTickets(nextPredictionText);
		const parsedBetSummaryFromText = parseBoatBets(nextPredictionText);
		const fallbackTickets = toPredictionTickets(parsedBetSummaryFromText.bets);
		const nextTickets = options?.preferredTickets && options.preferredTickets.length > 0
			? options.preferredTickets
			: parsedTicketsFromText.length > 0
				? parsedTicketsFromText
				: fallbackTickets;
		const nextBetSummary = options?.preferredBetSummary &&
			(options.preferredBetSummary.totalBets > 0 || options.preferredBetSummary.bets.length > 0)
			? options.preferredBetSummary
			: parsedBetSummaryFromText.totalBets > 0
				? parsedBetSummaryFromText
				: buildParsedBetSummaryFromTickets(nextTickets);
		const nextInvestmentAmount = nextBetSummary.totalStakeYen > 0
			? nextBetSummary.totalStakeYen
			: nextTickets.length > 0
				? nextTickets.length * 100
				: 1000;

		setPredictionTickets(nextTickets);
		setParsedBetSummary(nextBetSummary);

		if (options?.applyInvestment) {
			setInvestmentAmount(nextInvestmentAmount);
			setIsBetAutoApplied(nextTickets.length > 0 || nextBetSummary.totalBets > 0);
		}

		return {
			tickets: nextTickets,
			betSummary: nextBetSummary,
			investmentAmount: nextInvestmentAmount,
		};
	};

	const handleChangePredictionText = (nextPredictionText: string) => {
		setPredictionText(nextPredictionText);
		syncPredictionTicketsFromText(nextPredictionText, {
			applyInvestment: !savedPracticeResultRecord && !isInvestmentAmountManual,
		});
	};

	const ensurePredictionBets = () => {
		if (parsedBetSummary.bets.length > 0 || parsedBetSummary.totalBets > 0) {
			return {
				tickets: predictionTickets.length > 0 ? predictionTickets : toPredictionTickets(parsedBetSummary.bets),
				parsedBets: parsedBetSummary.bets,
				betSummary: parsedBetSummary,
				totalStakeYen: parsedBetSummary.totalStakeYen > 0 ? parsedBetSummary.totalStakeYen : (predictionTickets.length > 0 ? predictionTickets.length * 100 : parsedBetSummary.bets.length * 100),
				investmentAmount: parsedBetSummary.totalStakeYen > 0 ? parsedBetSummary.totalStakeYen : (predictionTickets.length > 0 ? predictionTickets.length * 100 : parsedBetSummary.bets.length * 100),
			};
		}

		if (predictionTickets.length > 0) {
			const betSummary = buildParsedBetSummaryFromTickets(predictionTickets);
			return {
				tickets: predictionTickets,
				parsedBets: betSummary.bets,
				betSummary,
				totalStakeYen: betSummary.totalStakeYen,
				investmentAmount: betSummary.totalStakeYen,
			};
		}

		const synced = syncPredictionTicketsFromText(predictionText, {
			applyInvestment: false,
		});

		return {
			...synced,
			parsedBets: synced.betSummary.bets,
			totalStakeYen: synced.betSummary.totalStakeYen,
		};
	};

	const materialText = selectedVenue && selectedRace
		? buildBoatPredictionMaterial({
				venue: selectedVenue,
				race: selectedRace,
				venueExtra: selectedVenueExtra,
				raceExtra: selectedRaceExtra,
				venueFeatureNote: selectedVenueFeatureNote,
				venueFeatureInsights,
			})
		: "レース情報が選択されていません。";
	const raceLabel = `${selectedVenue?.venueName ?? "-"} ${selectedRace ? `${selectedRace.raceNo}R` : "-"}`;
	const venueCount = venues.length;
	const raceCount = races.length;
	const confirmedRaceCount = races.filter((race) => race.result?.status === "confirmed").length;
	const materialReadyRaceCount = races.filter((race) => {
		const racerCount = toArray<unknown>((race as { racers?: unknown }).racers).length;
		const exhibitionCount = toArray<unknown>((race as { exhibitions?: unknown }).exhibitions).length;

		return racerCount > 0 && exhibitionCount > 0 && hasRaceOddsPreview(race);
	}).length;
	const copyReadyRaceCount = materialReadyRaceCount;
	const weatherReadyVenueCount = venues.filter(hasVenueWeather).length;
	const currentSelectionLabel = `${selectedVenue?.venueName ?? "-"} / ${selectedRace?.raceNo ? `${selectedRace.raceNo}R` : "-"}`;
	const selectedRaceTime = readRaceTimeText(selectedRace);
	const practiceSummaryDate = activePredictionDate;
	const localStorageUsageKb = useMemo(
		() => getLocalStorageSizeKb(),
		[activePredictionDate, practiceResultRecords, predictionRecordsVersion, autoSettleState.lastRunAt],
	);
	const localStorageWarningText = localStorageUsageKb >= LOCAL_STORAGE_WARNING_KB
		? "ブラウザ保存容量が少なくなっています。競輪/競艇の保存データが同じブラウザ領域を使っています。"
		: "";
const practiceSummary = useMemo(() => {
	const targetRecords = practiceResultRecords.filter((record) => isPracticeSummaryRecord(record, practiceSummaryDate));

	const totalStakeYen = targetRecords.reduce(
		(sum, record) => sum + resolvePracticeStakeYen(record),
		0,
	);

	const totalPayoutYen = targetRecords.reduce(
		(sum, record) => sum + resolvePracticePayoutYen(record),
		0,
	);

	const hitCount = targetRecords.filter(isBoatPracticeHit).length;
	const resultCount = targetRecords.length;
	const profitYen = totalPayoutYen - totalStakeYen;

	return {
		resultCount,
		hitCount,
		totalStakeYen,
		totalPayoutYen,
		profitYen,
		hitRate: resultCount > 0 ? (hitCount / resultCount) * 100 : null,
		roi: totalStakeYen > 0 ? (totalPayoutYen / totalStakeYen) * 100 : null,
	};
}, [practiceResultRecords, practiceSummaryDate]);
	const isHitNotificationRecord = (record: BoatPracticeResultRecord): boolean => {
		const payoutYen = resolvePracticePayoutYen(record);
		const hasHitNumbers = Boolean(record.hitBetNumbers) || (Array.isArray(record.hitBets) && record.hitBets.length > 0);

		return payoutYen > 0 && hasHitNumbers;
	};
	const predictionHeroTimeBand = getPredictionHeroTimeBand(selectedVenue);
	const predictionHeroImageSrc = predictionHeroImageSrcMap[predictionHeroTimeBand];
	const predictionHeroImageAlt =
		predictionHeroTimeBand === "morning"
			? "モーニング開催の予想ヒーロー画像"
			: predictionHeroTimeBand === "night"
				? "ナイター開催の予想ヒーロー画像"
				: "デイ開催の予想ヒーロー画像";

	const heroStats = [
		{
			eyebrow: "TODAY VENUES",
			value: `${venueCount}会場`,
			description: "今日の開催会場数",
		},
		{
			eyebrow: "TARGET RACES",
			value: `${raceCount}R`,
			description: "素材確認の対象レース数",
		},
		{
			eyebrow: "READY MATERIAL",
			value: `${materialReadyRaceCount}R`,
			description: "展示・選手・オッズが揃う仮基準",
		},
		{
			eyebrow: "COPY READY",
			value: `${copyReadyRaceCount}R`,
			description: `天気反映 ${weatherReadyVenueCount}/${venueCount}会場`,
		},
		{
			eyebrow: "TODAY RESULTS",
			value: `${confirmedRaceCount}R`,
			description: `結果確定 ${confirmedRaceCount}R / 保存済み ${practiceSummary.resultCount}件 / 自動照合 ${autoSettleState.autoSettledCount}件`,
		},
		{
			eyebrow: "HIT RATE",
			value: practiceSummary.hitRate === null ? "--%" : `${practiceSummary.hitRate.toFixed(1)}%`,
			description: practiceSummary.resultCount > 0 ? `的中 ${practiceSummary.hitCount}/${practiceSummary.resultCount}件` : "保存済み結果なし",
		},
		{
			eyebrow: "ROI",
			value: practiceSummary.roi === null ? "--%" : `${practiceSummary.roi.toFixed(1)}%`,
			description: practiceSummary.resultCount > 0
				? `投資 ${formatPracticeYen(practiceSummary.totalStakeYen)} / 払戻 ${formatPracticeYen(practiceSummary.totalPayoutYen)}`
				: "保存済み投資なし",
		},
		{
			eyebrow: "PROFIT",
			value: practiceSummary.resultCount > 0 ? formatPracticeProfit(practiceSummary.profitYen) : "--円",
			description: practiceSummary.resultCount > 0 ? "当日保存済み実践結果から集計" : "保存済み結果なし",
		},
	];

	const hitNotificationItems = practiceResultRecords
	.filter((record) => isPracticeSummaryRecord(record, practiceSummaryDate))
	.filter((record) => isHitNotificationRecord(record))
	.sort((left, right) =>
		String(right.updatedAt ?? right.savedAt ?? right.autoSettledAt ?? "").localeCompare(String(left.updatedAt ?? left.savedAt ?? left.autoSettledAt ?? ""))
	)
	.map((record) => {
		const payoutYen = resolvePracticePayoutYen(record);
		const profitYen = resolvePracticeProfitYen(record);
		const hitBetNumbers = String(record.hitBetNumbers ?? "").trim() || record.hitBets?.[0]?.normalized || readPracticeHitBetLabel(record);
		const savedAt = record.updatedAt ?? record.savedAt ?? record.autoSettledAt;
		const betTypeLabel = inferHitNotificationBetType(record, hitBetNumbers);

		return {
			key: record.raceKey || record.id || `${record.date}-${record.venueName}-${record.raceNo}`,
			venueRaceLabel: `${record.venueName || "会場未設定"} ${record.raceNo ? `${record.raceNo}R` : ""}`.trim(),
			dateLabel: record.date || activePredictionDate,
			timeLabel: formatJstDateTimeLabel(savedAt),
			betTypeLabel,
			hitBetNumbers,
			payoutLabel: formatPracticeYen(payoutYen),
			profitLabel: formatPracticeProfit(profitYen),
		};
	});

	const hitTickerLoopItems = useMemo(() => {
		if (hitNotificationItems.length <= 1) {
			return hitNotificationItems.map((item) => ({ ...item, tickerRepeatIndex: 0 }));
		}

		const repeatCount = Math.max(1, Math.ceil(MIN_HIT_TICKER_CARD_COUNT / hitNotificationItems.length));

		return Array.from({ length: repeatCount }).flatMap((_, repeatIndex) =>
			hitNotificationItems.map((item) => ({
				...item,
				tickerRepeatIndex: repeatIndex,
			})),
		);
	}, [hitNotificationItems]);
	const isHitTickerAnimated = hitNotificationItems.length > 1;
	const hitTickerDurationSec = Math.max(48, hitTickerLoopItems.length * 9);

	const refreshTodayFeed = async (options?: { silent?: boolean; isActive?: () => boolean }) => {
		const isSilent = options?.silent ?? false;

		if (!isSilent) {
			setIsRefreshingFeed(true);
			setRefreshMessage("最新データを読み込み中です...");
		}

		try {
			const [result, extrasResult] = await Promise.all([
				loadBoatTodayRaceDetailsFeed(),
				loadBoatVenueExtrasFeed(),
			]);

			if (options?.isActive && !options.isActive()) {
				return;
			}

			if (!result) {
				if (!isSilent) {
					setRefreshMessage("最新データを取得できませんでした。現在表示中のデータを維持します。");
				}
				return;
			}

			setTodayFeed(result);
			setVenueExtrasFeed(extrasResult);
			setDataUpdatedAt(result.generatedAt ?? "");

			if (!isSilent) {
				setRefreshMessage("最新データを読み込みました。");
			}
		} catch {
			if (options?.isActive && !options.isActive()) {
				return;
			}

			if (!isSilent) {
				setRefreshMessage("データ更新中にエラーが発生しました。");
			}
		} finally {
			if (!isSilent && (!options?.isActive || options.isActive())) {
				setIsRefreshingFeed(false);
			}
		}
	};

	const refreshPracticeResults = () => {
		setPracticeResultRecords(
			Object.values(loadBoatPracticeResultRecords()).filter((record) => record.date === activePredictionDate),
		);
	};

	const applyPracticeRecordToPanel = (record: BoatPracticeResultRecord) => {
		setSavedPracticeResultRecord(record);
		setActualFinishOrderText(record.actualFinishOrderText);
		setInvestmentAmount(resolvePracticeStakeYen(record) || 1000);
		setPayoutAmount(resolvePracticePayoutYen(record));
		setPracticeMemo(record.practiceMemo);
		if (record.predictionText) {
			setPredictionText(record.predictionText);
			syncPredictionTicketsFromText(record.predictionText, {
				applyInvestment: false,
				preferredTickets: record.tickets,
				preferredBetSummary: record.betSummary
					? {
						bets: Array.isArray(record.parsedBets) ? record.parsedBets : [],
						totalBets: record.betSummary.totalBets,
						trifectaCount: record.betSummary.trifectaCount,
						exactaCount: record.betSummary.exactaCount,
						totalStakeYen: record.betSummary.totalStakeYen,
					}
					: null,
			});
		}
		setPracticeResultStatus(record.resultStatus);
		setPracticeResultLookupStatus(record.resultLookupStatus);
		setPracticeResultLookupDebugText(record.resultLookupStatus ? `保存済み / source=${record.resultSource ?? "-"}` : "");
		setPracticeKimarite(record.kimarite ?? "");
		setPracticeStartInfoText(record.startInfoText ?? "");
		setPracticeHitBetLabel(isBoatPracticeHit(record) ? readPracticeHitBetLabel(record) : "");
		setPracticeSettlementMessage(record.resultStatus === "confirmed" ? "保存済み照合結果" : "");
		setIsInvestmentAmountManual(true);
		setIsBetAutoApplied(Boolean(record.betSummary));
		setIsResultAutoApplied(Boolean(record.resultStatus));
	};

	const handleCompactPracticeResults = () => {
		const currentRecords = loadBoatPracticeResultRecords();
		const compactedRecords = compactBoatPracticeResultRecords(currentRecords);
		const result = saveBoatPracticeResultRecords(compactedRecords);
		applyPracticeResultRecords(result.records);
		setPracticeMessage(
			result.ok
				? "古い実践結果を整理しました"
				: "保存容量がいっぱいのため、実践結果の整理に失敗しました。古い結果をさらに減らしてください。",
		);
	};

	const handlePruneBoatLocalStorage = () => {
		const pruneResult = pruneBoatLocalRecordsByDate({
			activeDate: activePredictionDate,
			keepDates: [activePredictionDate, previousPredictionDate],
		});
		autoSettledFingerprintRef.current.clear();
		setPredictionRecordsVersion((current) => current + 1);
		applyPracticeResultRecords(pruneResult.practice.records);
		setPracticeMessage(
			pruneResult.prediction.ok && pruneResult.practice.ok
				? `競艇の保存データを ${activePredictionDate} / ${previousPredictionDate} に整理しました`
				: "保存容量の都合で一部整理に失敗しました。ブラウザの保存状況を確認してください。",
		);
	};

	const applyPracticeResultRecords = (records: Record<string, BoatPracticeResultRecord>) => {
		setPracticeResultRecords(Object.values(records).filter((record) => record.date === activePredictionDate));
	};

	const shouldSkipAutoSettledRecord = (existingRecord: BoatPracticeResultRecord | undefined, nextRecord: BoatPracticeResultRecord): boolean => {
		if (!existingRecord || existingRecord.resultFingerprint !== nextRecord.resultFingerprint) {
			return false;
		}

		const existingHitCount = Array.isArray(existingRecord.hitBets) ? existingRecord.hitBets.length : 0;
		const nextHitCount = Array.isArray(nextRecord.hitBets) ? nextRecord.hitBets.length : 0;
		const existingPayout = resolvePracticePayoutYen(existingRecord);
		const nextPayout = resolvePracticePayoutYen(nextRecord);

		if (nextPayout > existingPayout) {
			return false;
		}

		if (nextHitCount > existingHitCount) {
			return false;
		}

		if (!existingRecord.hitBetNumbers && nextRecord.hitBetNumbers) {
			return false;
		}

		if (existingRecord.resultLookupStatus === "payout-missing" && nextRecord.resultLookupStatus === "matched") {
			return false;
		}

		if (existingRecord.resultStatus !== "confirmed") {
			return false;
		}

		return true;
	};

	const autoSettleSavedPredictions = (params: {
		reason: string;
		feed: typeof todayFeed;
	}) => {
		const { feed, reason } = params;
		if (!feed?.date || !Array.isArray(feed.venues) || feed.venues.length === 0) {
			return;
		}

		const runKey = [reason, feed.date, feed.generatedAt ?? "", predictionRecordsVersion].join("|");
		if (autoSettleRunKeyRef.current === runKey) {
			return;
		}
		autoSettleRunKeyRef.current = runKey;

		const localStorageSizeKb = getLocalStorageSizeKb();
		if (localStorageSizeKb >= AUTO_SETTLE_STORAGE_LIMIT_KB) {
			const warning = "保存容量がいっぱいに近いため、自動照合を一時停止しています。古い実践結果を整理してください。";
			setAutoSettleState((current) => ({
				...current,
				enabled: false,
				lastRunAt: new Date().toISOString(),
				lastReason: reason,
				warning,
			}));
			setPracticeMessage(warning);
			return;
		}

		const predictionRecords = Object.values(loadBoatPredictionRecords())
			.map((record) => hydrateBoatPredictionRecord(record))
			.filter((record) => record.date === activePredictionDate);
		let pendingCount = 0;
		let nextRecords = loadBoatPracticeResultRecords();
		let changed = false;
		let savedCount = 0;

		for (const predictionRecord of predictionRecords) {
			if (savedCount >= MAX_AUTO_SETTLE_PER_RUN) {
				break;
			}

			if (!predictionRecord.predictionText?.trim()) {
				continue;
			}

			const syncedPrediction = {
				tickets: predictionRecord.tickets ?? [],
				parsedBets: predictionRecord.parsedBets ?? [],
				betSummary: buildStoredPredictionBetSummary(predictionRecord) ?? emptyBoatBetSummary(),
				totalStakeYen: predictionRecord.totalStakeYen ?? predictionRecord.betSummary?.totalStakeYen ?? 0,
			};

			if (syncedPrediction.parsedBets.length <= 0 && syncedPrediction.tickets.length <= 0) {
				continue;
			}

			const lookup = findBoatRaceResultForPractice({
				feed,
				date: predictionRecord.date || feed.date,
				venueName: predictionRecord.venueName,
				venueCode: predictionRecord.venueCode,
				raceNo: predictionRecord.raceNo,
			});

			if (!lookup.race || lookup.lookupStatus === "pending" || lookup.lookupStatus === "missing") {
				pendingCount += 1;
				continue;
			}

			const settlement = settleBoatPredictionResult({
				race: lookup.race,
				bets: syncedPrediction.parsedBets,
				investmentAmount: syncedPrediction.totalStakeYen || 1000,
				source: "today-race-details.generated.json",
			});

			const finishOrderForSave = settlement.finishOrderText;
			if (!finishOrderForSave) {
				pendingCount += 1;
				continue;
			}

			const finishOrderHitBets = findHitBetsByFinishOrder(finishOrderForSave, syncedPrediction.parsedBets);
			const hitBetsForSave = settlement.hitBets.length > 0 ? settlement.hitBets : finishOrderHitBets;
			const payoutYenForSave = settlement.payoutYen;
			const lookupStatus: BoatResultLookupStatus =
				lookup.lookupStatus === "date-mismatch" && settlement.status === "confirmed"
					? "date-mismatch"
					: settlement.status === "confirmed" && hitBetsForSave.length > 0 && payoutYenForSave <= 0
						? "payout-missing"
						: settlement.lookupStatus;
			const hitBet = hitBetsForSave[0];
			const hitBetNumbers = hitBet ? hitBet.normalized || hitBet.numbers?.join("-") : "";
			const savedAt = new Date().toISOString();
			const raceKey = predictionRecord.raceKey || buildBoatPredictionRaceKey({
				date: predictionRecord.date || feed.date,
				venueName: predictionRecord.venueName,
				raceNo: predictionRecord.raceNo,
				raceId: predictionRecord.raceId,
			});
			const existingRecord = nextRecords[raceKey] ?? findBoatPracticeResultRecord(raceKey);
			const resultFingerprint = buildPracticeResultFingerprint({
				date: activePredictionDate,
				venueCode: predictionRecord.venueCode,
				venueName: predictionRecord.venueName,
				raceNo: predictionRecord.raceNo,
				finishOrderText: finishOrderForSave,
				hitBetNumbers,
				payoutYen: payoutYenForSave,
				resultLookupStatus: lookupStatus,
			});
			const processedFingerprintKey = `${raceKey}|${resultFingerprint}`;
			if (autoSettledFingerprintRef.current.has(processedFingerprintKey)) {
				continue;
			}
			const { profitLoss, roi } = calculateBoatPracticeProfitLoss({
				investmentAmount: syncedPrediction.totalStakeYen || 1000,
				payoutAmount: payoutYenForSave,
			});

			const nextRecord: BoatPracticeResultRecord = {
				id: raceKey,
				raceKey,
				raceId: predictionRecord.raceId,
				venueCode: predictionRecord.venueCode,
				venueName: predictionRecord.venueName,
				date: activePredictionDate,
				raceNo: predictionRecord.raceNo,
				raceTitle: lookup.race.title,
				ticketsCount: syncedPrediction.tickets.length,
				parsedBetsCount: syncedPrediction.parsedBets.length,
				betSummary: syncedPrediction.betSummary,
				actualFinishOrderText: finishOrderForSave,
				actualOrder: finishOrderForSave,
				finishOrder: finishOrderForSave,
				investmentAmount: syncedPrediction.totalStakeYen || 1000,
				payoutAmount: payoutYenForSave,
				profitLoss,
				roi,
				resultStatus: "confirmed",
				resultLookupStatus: lookupStatus,
				kimarite: settlement.kimarite,
				startInfoText: settlement.startInfoText,
				hitBets: compactHitBetsForRecord(hitBetsForSave),
				hitBetType: hitBet?.label,
				hitBetNumbers: hitBetNumbers || undefined,
				totalStakeYen: syncedPrediction.totalStakeYen || 1000,
				payoutYen: payoutYenForSave,
				profitYen: profitLoss,
				resultSource: "today-race-details.generated.json",
				observedFeedGeneratedAt: feed.generatedAt,
				autoSettled: true,
				autoSettledAt: savedAt,
				resultFingerprint,
				settlementReason: reason,
				memo: existingRecord?.memo ?? "",
				createdAt: existingRecord?.createdAt ?? existingRecord?.savedAt ?? savedAt,
				updatedAt: savedAt,
				practiceMemo: existingRecord?.practiceMemo ?? "",
				savedAt,
			};

			if (shouldSkipAutoSettledRecord(existingRecord, nextRecord)) {
				autoSettledFingerprintRef.current.add(processedFingerprintKey);
				continue;
			}

			try {
				const saveResult = upsertBoatPracticeResultRecord(nextRecord);
				if (!saveResult.ok) {
					setPracticeMessage("保存容量がいっぱいのため、実践結果を保存できませんでした。古い結果を整理してください。");
					setAutoSettleState((current) => ({
						...current,
						enabled: false,
						warning: "保存容量がいっぱいのため、自動照合の保存を停止しました。",
						lastRunAt: new Date().toISOString(),
						lastReason: reason,
					}));
					break;
				}

				nextRecords = saveResult.records;
				changed = true;
				savedCount += 1;
				autoSettledFingerprintRef.current.add(processedFingerprintKey);
			} catch (error) {
				console.error("[auto-settle] failed to save practice result", error);
				setPracticeMessage("保存容量がいっぱいのため、実践結果を保存できませんでした。古い結果を整理してください。");
				break;
			}

			if (practiceRaceKey && raceKey === practiceRaceKey) {
				applyPracticeRecordToPanel(nextRecord);
				setPracticeMessage(`保存済み予想を自動照合しました (${buildPracticeLookupDebugText(lookup.debug)})`);
			}
		}

		if (changed) {
			applyPracticeResultRecords(nextRecords);
		}

		const todayAutoSettledCount = Object.values(nextRecords).filter(
			(record) => record.date === activePredictionDate && Boolean(record.autoSettled),
		).length;

		setAutoSettleState({
			enabled: true,
			autoSettledCount: todayAutoSettledCount,
			pendingCount,
			lastRunAt: new Date().toISOString(),
			lastReason: reason,
			warning: "",
		});
	};

	useEffect(() => {
		let isActive = true;

		void refreshTodayFeed({ silent: true, isActive: () => isActive });

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		refreshPracticeResults();
	}, [activePredictionDate]);

	useEffect(() => {
		if (!activePredictionDate) {
			return;
		}

		autoSettledFingerprintRef.current.clear();
		const pruneResult = pruneBoatLocalRecordsByDate({
			activeDate: activePredictionDate,
			keepDates: [activePredictionDate, previousPredictionDate],
		});
		applyPracticeResultRecords(pruneResult.practice.records);
		setPredictionRecordsVersion((current) => current + 1);
	}, [activePredictionDate, previousPredictionDate]);

	useEffect(() => {
		if (!todayFeed?.venues?.length) {
			return;
		}

		autoSettleSavedPredictions({
			reason: "feed-loaded",
			feed: todayFeed,
		});
	}, [todayFeed.generatedAt, activePredictionDate, predictionRecordsVersion]);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const intervalId = window.setInterval(() => {
			if (document.hidden) {
				return;
			}

			void refreshTodayFeed({ silent: true });
		}, 90_000);

		return () => window.clearInterval(intervalId);
	}, [todayFeed.generatedAt]);

	useEffect(() => {
	if (venues.length === 0) return;

	const currentVenue = venues.find((venue) => venue.id === selectedVenueId);
	const currentRace = currentVenue
		? getVenueRaces(currentVenue).find((race) => getRaceKey(currentVenue.id, race.raceId, race.raceNo) === selectedRaceId)
		: undefined;

	if (currentVenue && currentRace) {
		return;
	}

	const savedSelection = loadPredictionSelectionSnapshot();
	const todayDate = activePredictionDate;

	if (savedSelection?.date === todayDate) {
		const savedVenue = venues.find((venue) =>
			venue.id === savedSelection.venueId ||
			venue.venueCode === savedSelection.venueCode ||
			venue.venueName === savedSelection.venueName
		);

		const savedRace = savedVenue
			? getVenueRaces(savedVenue).find((race) =>
					getRaceKey(savedVenue.id, race.raceId, race.raceNo) === savedSelection.raceId ||
					race.raceNo === savedSelection.raceNo
				)
			: undefined;

		if (savedVenue && savedRace) {
			setSelectedVenueId(savedVenue.id);
			setSelectedRaceId(getRaceKey(savedVenue.id, savedRace.raceId, savedRace.raceNo));
			return;
		}
	}

	const timeSelection = findCurrentTimeRaceSelection(venues);
	if (timeSelection) {
		setSelectedVenueId(timeSelection.venue.id);
		setSelectedRaceId(timeSelection.raceId);
	}
}, [venues, selectedVenueId, selectedRaceId, todayFeed.date]);

const handleSelectVenue = (venueId: string) => {
	const venue = venues.find((item) => item.id === venueId);
	const firstRace = getVenueRaces(venue)[0];

	setSelectedVenueId(venueId);
	setSelectedRaceId(getRaceKey(venueId, firstRace?.raceId, firstRace?.raceNo ?? 0));

	if (venue && firstRace) {
		savePredictionSelectionSnapshot({
			date: activePredictionDate,
			venue,
			race: firstRace,
		});
	}
};

const handleSelectRace = (raceId: string) => {
	setSelectedRaceId(raceId);

	const venue = venues.find((item) => item.id === selectedVenueId);
	const race = getVenueRaces(venue).find(
		(item) => getRaceKey(selectedVenueId, item.raceId, item.raceNo) === raceId,
	);

	if (venue && race) {
		savePredictionSelectionSnapshot({
			date: activePredictionDate,
			venue,
			race,
		});
	}
};

	useEffect(() => {
		let cancelled = false;
		loadBoatVenueFeatureIndex().then((loadedIndex) => {
			if (!cancelled) {
				setVenueFeatureIndex(loadedIndex);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setVenueFeatureInsights(loadBoatVenueUserInsights());
	}, []);

	useEffect(() => {
		if (!selectedVenue?.venueName) {
			setSelectedVenueFeatureNote(null);
			return;
		}

		let cancelled = false;
		setSelectedVenueFeatureNote(null);
		loadBoatVenueFeatureNote(selectedVenue.venueName, venueFeatureIndex).then((note) => {
			if (!cancelled) {
				setSelectedVenueFeatureNote(note);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [selectedVenue, venueFeatureIndex]);

	useEffect(() => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		const storedRecord = findBoatPredictionRecord({
			date: activePredictionDate,
			venueName: selectedVenue.venueName,
			raceNo: selectedRace.raceNo,
			raceId: selectedRace.raceId,
		});
		const record = storedRecord && storedRecord.date === activePredictionDate ? hydrateBoatPredictionRecord(storedRecord) : undefined;

		if (record) {
			setSavedPredictionRecord(record);
			setPredictionText(record.predictionText);
			syncPredictionTicketsFromText(record.predictionText, {
				applyInvestment: false,
				preferredTickets: record.tickets,
				preferredBetSummary: buildStoredPredictionBetSummary(record),
			});
			setInvestmentAmount(record.totalStakeYen ?? record.betSummary?.totalStakeYen ?? ((record.tickets?.length ?? 0) * 100 || 1000));
			setIsBetAutoApplied((record.totalStakeYen ?? record.betSummary?.totalStakeYen ?? 0) > 0 || (record.tickets?.length ?? 0) > 0);
			setSavedMessage("保存済み予想を読み込みました");
			return;
		}

		setSavedPredictionRecord(undefined);
		setPredictionText("");
		syncPredictionTicketsFromText("", { applyInvestment: false, preferredBetSummary: emptyBoatBetSummary() });
		setSavedMessage("");
	}, [activePredictionDate, predictionRecordsVersion, selectedVenue, selectedRace, selectedRaceKey]);

	useEffect(() => {
		if (!practiceRaceKey || !selectedRace) {
			return;
		}

		const record = findBoatPracticeResultRecord(practiceRaceKey);

		if (record && record.date === activePredictionDate) {
			applyPracticeRecordToPanel(record);
			setPracticeMessage("保存済み実践結果を読み込みました");
			return;
		}

		setSavedPracticeResultRecord(undefined);
		setActualFinishOrderText(selectedRace.result?.finishOrder?.slice(0, 3).join("-") ?? "");
		setInvestmentAmount(parsedBetSummary.totalStakeYen || 1000);
		setPayoutAmount(0);
		setPracticeMemo("");
		setPracticeResultStatus(undefined);
		setPracticeResultLookupStatus(undefined);
		setPracticeResultLookupDebugText("");
		setPracticeKimarite("");
		setPracticeStartInfoText("");
		setPracticeHitBetLabel("");
		setPracticeSettlementMessage("");
		setIsInvestmentAmountManual(false);
		setIsBetAutoApplied(parsedBetSummary.totalStakeYen > 0);
		setIsResultAutoApplied(false);
		setPracticeMessage("");
	}, [activePredictionDate, practiceRaceKey, predictionRecordsVersion, selectedRace]);

	useEffect(() => {
		if (savedPracticeResultRecord || isInvestmentAmountManual || parsedBetSummary.totalStakeYen <= 0) {
			return;
		}

		setInvestmentAmount(parsedBetSummary.totalStakeYen);
		setIsBetAutoApplied(true);
	}, [parsedBetSummary.totalStakeYen, savedPracticeResultRecord, isInvestmentAmountManual]);

	const handleSavePrediction = () => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		if (!predictionText.trim()) {
			setSavedMessage("予想本文が空です");
			return;
		}

		const synced = syncPredictionTicketsFromText(predictionText, {
			applyInvestment: !savedPracticeResultRecord && !isInvestmentAmountManual,
		});
		const savedAt = new Date().toISOString();

		const record: BoatPredictionRecord = {
			raceKey: selectedRaceKey,
			raceId: selectedRace.raceId,
			venueCode: selectedVenue.venueCode,
			venueName: selectedVenue.venueName,
			date: activePredictionDate,
			raceNo: selectedRace.raceNo,
			predictionText,
			tickets: synced.tickets,
			parsedBets: synced.betSummary.bets,
			betSummary: synced.betSummary,
			totalStakeYen: synced.betSummary.totalStakeYen,
			updatedAt: savedAt,
			savedAt,
		};

		upsertBoatPredictionRecord(record);
		setSavedPredictionRecord(record);
		setPredictionRecordsVersion((current) => current + 1);
		if (synced.betSummary.totalStakeYen > 0) {
			if (!isInvestmentAmountManual) {
				setInvestmentAmount(synced.betSummary.totalStakeYen);
			}
			setIsBetAutoApplied(true);
		}
		setSavedMessage("予想を保存しました");
	};

	const saveJohnsonPrediction = (options?: { includeCurrentDraft?: boolean; downloadJson?: boolean; copyJson?: boolean; buttonLabel?: string }) => {
		let predictionRecords = loadBoatPredictionRecords();

		if (options?.includeCurrentDraft) {
			if (!selectedVenue || !selectedRace || !selectedRaceKey) {
				setSavedMessage("ジョンソン化に必要な会場・レース情報を取得できませんでした");
				return;
			}

			if (!predictionText.trim()) {
				setSavedMessage("予想本文が空です");
				return;
			}

			const synced = syncPredictionTicketsFromText(predictionText, {
				applyInvestment: !savedPracticeResultRecord && !isInvestmentAmountManual,
			});
			const savedAt = new Date().toISOString();
			const predictionRecord: BoatPredictionRecord = {
				raceKey: selectedRaceKey,
				raceId: selectedRace.raceId,
				venueCode: selectedVenue.venueCode,
				venueName: selectedVenue.venueName,
				date: activePredictionDate,
				raceNo: selectedRace.raceNo,
				predictionText,
				tickets: synced.tickets,
				parsedBets: synced.betSummary.bets,
				betSummary: synced.betSummary,
				totalStakeYen: synced.betSummary.totalStakeYen,
				updatedAt: savedAt,
				savedAt,
			};

			predictionRecords = upsertBoatPredictionRecord(predictionRecord);
			setSavedPredictionRecord(predictionRecord);

			if (synced.betSummary.totalStakeYen > 0 && !isInvestmentAmountManual) {
				setInvestmentAmount(synced.betSummary.totalStakeYen);
				setIsBetAutoApplied(true);
			}
		}

		const todayPredictionRecords = Object.values(predictionRecords)
			.filter((record) => record.date === activePredictionDate && Boolean(record.predictionText?.trim()));

		if (todayPredictionRecords.length <= 0) {
			setSavedMessage("ジョンソン化できる保存済み予想がありません");
			return;
		}

		const mergedJohnsonRecords = buildBoatJohnsonRecordsFromPredictionRecords(todayPredictionRecords, {
			existingRecords: loadBoatJohnsonPredictionRecords(),
			practiceResultRecords: loadBoatPracticeResultRecords(),
			updatedAt: new Date().toISOString(),
		});
		const johnsonSaveResult = saveBoatJohnsonPredictionRecords(mergedJohnsonRecords);

		if (!johnsonSaveResult.ok) {
			setSavedMessage("保存容量がいっぱいのため、ジョンソン化を保存できませんでした");
			return;
		}

		const payload = buildBoatJohnsonGeneratedPayload(johnsonSaveResult.records);
		const recordCount = payload.records.length;

		if (recordCount <= 0) {
			setSavedMessage("ジョンソン化できる保存済み予想がありません");
			return;
		}

		const payloadText = buildDownloadableJohnsonPayloadText(payload);
		if (!payloadText) {
			setSavedMessage("ジョンソン JSON の生成に失敗しました");
			return;
		}
		const convertedCount = todayPredictionRecords.length;
		let message = `${convertedCount}件をジョンソン化しました`;

		setPredictionRecordsVersion((current) => current + 1);

		if (options?.downloadJson) {
			downloadJsonFile("boat-johnson-predictions.generated.json", payloadText);
			message = `${convertedCount}件をジョンソン化し、boat-johnson-predictions.generated.json をダウンロードしました`;
		}

		if (options?.copyJson) {
			void navigator.clipboard.writeText(payloadText).then(
				() => {
					setSavedMessage(`${convertedCount}件をジョンソン化し、ジョンソン JSON をコピーしました`);
				},
				() => {
					setSavedMessage(message);
				},
			);
			return;
		}

		setSavedMessage(message);
	};

	const handleSaveJohnsonPrediction = () => {
		saveJohnsonPrediction({ includeCurrentDraft: true, downloadJson: true, buttonLabel: "ジョンソン化して保存" });
	};

	const handleExportJohnsonPrediction = () => {
		saveJohnsonPrediction({ downloadJson: true, buttonLabel: "今日の保存済み予想を全部ジョンソン化" });
	};

	const handleCopyJohnsonJson = () => {
		saveJohnsonPrediction({ copyJson: true, buttonLabel: "今日の保存済み予想を全部ジョンソン化" });
	};

	const handleClearPrediction = () => {
		setPredictionText("");
		syncPredictionTicketsFromText("", { applyInvestment: false, preferredBetSummary: emptyBoatBetSummary() });

		if (savedPredictionRecord?.raceKey) {
			deleteBoatPredictionRecord(savedPredictionRecord.raceKey);
		}

		setSavedPredictionRecord(undefined);
		setPredictionRecordsVersion((current) => current + 1);
		setSavedMessage("予想をクリアしました");
	};

	const handleLoadBetsToPractice = () => {
		const synced = syncPredictionTicketsFromText(predictionText, {
			applyInvestment: true,
		});

		if (synced.betSummary.totalStakeYen <= 0 && synced.tickets.length <= 0) {
			setPracticeMessage("買い目を読み取れませんでした");
			return;
		}

		setIsInvestmentAmountManual(false);
		setIsBetAutoApplied(true);
		setPracticeMessage(`買い目を読み込みました（${synced.betSummary.totalBets || synced.tickets.length}点）`);
	};

	const savePracticeRecordAndRefresh = (record: BoatPracticeResultRecord, message: string) => {
		try {
			const saveResult = upsertBoatPracticeResultRecord(record);
			if (!saveResult.ok) {
				setPracticeMessage("保存容量がいっぱいのため、実践結果を保存できませんでした。古い結果を整理してください。");
				return;
			}

			const savedRecord = saveResult.records[record.raceKey] ?? record;
			if (practiceRaceKey && record.raceKey === practiceRaceKey) {
				applyPracticeRecordToPanel(savedRecord);
			}
			applyPracticeResultRecords(saveResult.records);
			setPracticeMessage(message);
		} catch (error) {
			console.error("[practice-results] save failed", error);
			setPracticeMessage("保存容量がいっぱいのため、実践結果を保存できませんでした。古い結果を整理してください。");
		}
	};

	const buildPracticeResultRecord = (params?: {
		actualFinishOrderText?: string;
		investmentAmount?: number;
		payoutAmount?: number;
		resultStatus?: BoatPracticeResultStatus;
		resultLookupStatus?: BoatResultLookupStatus;
		kimarite?: string;
		startInfoText?: string;
		payouts?: unknown[];
		hitBets?: ReturnType<typeof parseBoatBets>["bets"];
		resultSource?: string;
	}): BoatPracticeResultRecord | null => {
		if (!selectedVenue || !selectedRace) {
			return null;
		}

		const resolvedRaceKey = buildPracticeFallbackRaceKey({
			selectedRaceKey: practiceRaceKey,
			venue: selectedVenue,
			race: selectedRace,
			todayDate: activePredictionDate,
		});
		const finishOrderForSave = params?.actualFinishOrderText ?? actualFinishOrderText ?? "";
		const nextPayoutAmount = params?.payoutAmount ?? payoutAmount;
		const nextDate = activePredictionDate;
		const syncedPrediction = ensurePredictionBets();
		const nextInvestmentAmount = syncedPrediction.totalStakeYen || params?.investmentAmount || investmentAmount;
		const { profitLoss, roi } = calculateBoatPracticeProfitLoss({
			investmentAmount: nextInvestmentAmount,
			payoutAmount: nextPayoutAmount,
		});
		const finishOrderHitBets = findHitBetsByFinishOrder(finishOrderForSave, syncedPrediction.parsedBets);
		const hitBetsForSave = params?.hitBets && params.hitBets.length > 0
			? params.hitBets
			: finishOrderHitBets;
		const hitBet = hitBetsForSave[0];
		const savedResultStatus = params?.resultStatus ?? practiceResultStatus ?? (nextPayoutAmount > 0 || finishOrderForSave || hitBetsForSave.length > 0 ? "confirmed" : undefined);
		const savedLookupStatus = params?.resultLookupStatus
			?? practiceResultLookupStatus
			?? (hitBetsForSave.length > 0 && nextPayoutAmount <= 0
				? "payout-missing"
				: nextPayoutAmount > 0
					? "manual"
					: undefined);
		const savedAt = new Date().toISOString();
		const createdAt = savedPracticeResultRecord?.createdAt ?? savedPracticeResultRecord?.savedAt ?? savedAt;

		return {
			id: resolvedRaceKey,
			raceKey: resolvedRaceKey,
			raceId: selectedRace.raceId,
			venueCode: selectedVenue.venueCode,
			venueName: selectedVenue.venueName,
			date: nextDate,
			raceNo: selectedRace.raceNo,
			raceTitle: selectedRace.title,
			ticketsCount: syncedPrediction.tickets.length,
			parsedBetsCount: syncedPrediction.parsedBets.length,
			betSummary: {
				totalBets: syncedPrediction.betSummary.totalBets,
				trifectaCount: syncedPrediction.betSummary.trifectaCount,
				exactaCount: syncedPrediction.betSummary.exactaCount,
				totalStakeYen: syncedPrediction.betSummary.totalStakeYen,
			},
			actualFinishOrderText: finishOrderForSave,
			actualOrder: finishOrderForSave,
			finishOrder: finishOrderForSave,
			investmentAmount: nextInvestmentAmount,
			payoutAmount: nextPayoutAmount,
			profitLoss,
			roi,
			resultStatus: savedResultStatus,
			resultLookupStatus: savedLookupStatus,
			kimarite: (params?.kimarite ?? practiceKimarite) || undefined,
			startInfoText: (params?.startInfoText ?? practiceStartInfoText) || undefined,
			hitBets: compactHitBetsForRecord(hitBetsForSave),
			hitBetType: hitBet?.label,
			hitBetNumbers: hitBet ? hitBet.normalized || hitBet.numbers?.join("-") : undefined,
			totalStakeYen: syncedPrediction.totalStakeYen || nextInvestmentAmount,
			payoutYen: nextPayoutAmount,
			profitYen: profitLoss,
			resultSource: params?.resultSource ?? (isResultAutoApplied ? "today-race-details.generated.json" : undefined),
			memo: practiceMemo,
			createdAt,
			updatedAt: savedAt,
			practiceMemo,
			autoSettled: false,
			autoSettledAt: undefined,
			resultFingerprint: undefined,
			settlementReason: undefined,
			savedAt,
		};
	};

	const handleSettlePracticeResult = async () => {
		if (!selectedVenue || !selectedRace) {
			return;
		}

		const freshFeed = await loadBoatTodayRaceDetailsFeed();
		const settlementFeed = freshFeed ?? todayFeed;
		if (freshFeed) {
			setTodayFeed(freshFeed);
			setDataUpdatedAt(freshFeed.generatedAt ?? dataUpdatedAt);
		}

		const lookup = findBoatRaceResultForPractice({
			feed: settlementFeed,
			date: selectedVenue.date,
			venueName: selectedVenue.venueName,
			venueCode: selectedVenue.venueCode,
			raceNo: selectedRace.raceNo,
		});
		const syncedPrediction = ensurePredictionBets();
		const settlement = settleBoatPredictionResult({
			race: lookup.race ?? selectedRace,
			bets: syncedPrediction.parsedBets,
			investmentAmount: syncedPrediction.totalStakeYen || investmentAmount,
			source: "today-race-details.generated.json",
		});
		const finishOrderForSave = settlement.finishOrderText || actualFinishOrderText;
		const finishOrderHitBets = findHitBetsByFinishOrder(finishOrderForSave, syncedPrediction.parsedBets);
		const hitBetsForSave = settlement.hitBets.length > 0
			? settlement.hitBets
			: finishOrderHitBets;
		const payoutYenForSave = settlement.payoutYen;
		const lookupStatus =
			lookup.lookupStatus === "date-mismatch" && settlement.status === "confirmed"
				? "date-mismatch"
				: settlement.status === "confirmed" && hitBetsForSave.length > 0 && payoutYenForSave <= 0
					? "payout-missing"
					: settlement.lookupStatus;
		const lookupDebugText = buildPracticeLookupDebugText(lookup.debug);

		setPracticeResultStatus(settlement.status);
		setPracticeResultLookupStatus(lookupStatus);
		setPracticeResultLookupDebugText(lookupDebugText);
		setPracticeKimarite(settlement.kimarite ?? "");
		setPracticeStartInfoText(settlement.startInfoText ?? "");
		setPracticeHitBetLabel(hitBetsForSave[0] ? `${hitBetsForSave[0].label} ${hitBetsForSave[0].normalized}` : "");
		setPracticeSettlementMessage(`${settlement.message}${lookupStatus === "date-mismatch" ? " / 日付差あり" : ""}`);
		setIsResultAutoApplied(true);

		if (settlement.finishOrderText) {
			setActualFinishOrderText(settlement.finishOrderText);
		}

		if (settlement.status === "confirmed") {
			setPayoutAmount(payoutYenForSave);
		}

		const shouldAutoSave = Boolean(finishOrderForSave) || hitBetsForSave.length > 0 || payoutYenForSave > 0;

		if (shouldAutoSave) {
			const autoSavedRecord = buildPracticeResultRecord({
				actualFinishOrderText: finishOrderForSave,
				investmentAmount: syncedPrediction.totalStakeYen || investmentAmount,
				payoutAmount: payoutYenForSave,
				resultStatus: "confirmed",
				resultLookupStatus: lookupStatus,
				kimarite: settlement.kimarite,
				startInfoText: settlement.startInfoText,
				payouts: settlement.payouts,
				hitBets: hitBetsForSave,
				resultSource: "today-race-details.generated.json",
			});

			if (autoSavedRecord) {
				savePracticeRecordAndRefresh(
					autoSavedRecord,
					`${settlement.message} / 自動保存済み (${lookupDebugText})`,
				);
				return;
			}

			setPracticeMessage("結果は取れましたが、実践結果の保存レコードを作れませんでした。会場・レース選択を確認してください。");
			return;
		}

		setPracticeMessage(`${settlement.message} (${lookupDebugText})`);
	};

	const handleSavePracticeResult = () => {
		const record = buildPracticeResultRecord({
			actualFinishOrderText,
			investmentAmount,
			payoutAmount,
			resultStatus: actualFinishOrderText ? "confirmed" : practiceResultStatus,
			resultLookupStatus: practiceResultLookupStatus,
			kimarite: practiceKimarite,
			startInfoText: practiceStartInfoText,
			resultSource: isResultAutoApplied ? "today-race-details.generated.json" : undefined,
		});

		if (!record) {
			setPracticeMessage("保存できませんでした。会場・レース・着順の取得状態を確認してください。");
			return;
		}

		savePracticeRecordAndRefresh(record, "実践結果を保存しました");
	};

	const handleClearPracticeResult = () => {
		if (practiceRaceKey) {
			deleteBoatPracticeResultRecord(practiceRaceKey);
		}

		setSavedPracticeResultRecord(undefined);
		setActualFinishOrderText("");
		setInvestmentAmount(1000);
		setPayoutAmount(0);
		setPracticeMemo("");
		setPracticeResultStatus(undefined);
		setPracticeResultLookupStatus(undefined);
		setPracticeResultLookupDebugText("");
		setPracticeKimarite("");
		setPracticeStartInfoText("");
		setPracticeHitBetLabel("");
		setPracticeSettlementMessage("");
		setIsInvestmentAmountManual(false);
		setIsBetAutoApplied(false);
		setIsResultAutoApplied(false);
		refreshPracticeResults();
		setPracticeMessage("実践結果をクリアしました");
	};

	const handleChangeInvestmentAmount = (value: number) => {
		setIsInvestmentAmountManual(true);
		setInvestmentAmount(value);
	};

	const handleChangePayoutAmount = (value: number) => {
		setIsResultAutoApplied(false);
		setPracticeResultLookupStatus(value > 0 ? "manual" : practiceResultLookupStatus);
		setPayoutAmount(value);
	};

	return (
		<PageShell
			hideHero
			eyebrow=""
			title=""
			description=""
			contentMaxWidth="1680px"
			contentPaddingInline="24px"
			heroMaxWidth="1680px"
		>
			<style>
				{`

body:has(.prediction-page-root) {
	background: #eefbff;
}

#root:has(.prediction-page-root) {
	position: relative;
	min-height: 100vh;
	background: #eefbff;
}

#root:has(.prediction-page-root)::before {
	content: "";
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background-color: #eefbff;
	background-image:
		linear-gradient(180deg, rgba(238, 250, 253, 0.08) 0%, rgba(246, 252, 255, 0.12) 46%, rgba(230, 248, 247, 0.18) 100%),
		url("${predictionPageBackgroundImageSrc}");
	background-size: cover;
	background-position: center top;
	background-repeat: no-repeat;
}

.prediction-page-root {
	position: relative;
	z-index: 1;
	isolation: auto;
	display: grid;
	gap: 22px;
	padding-top: 22px;
	padding-bottom: 36px;
}

#root:has(.prediction-page-root) > div {
	z-index: 1;
	background: transparent !important;
}

#root:has(.prediction-page-root) main {
	position: relative;
	z-index: 1;
}

.prediction-page-root > * {
	position: relative;
	z-index: 1;
}

					.prediction-page-main-panels {
						display: grid;
						grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
						gap: 18px;
						align-items: start;
						width: 100%;
						max-width: 100%;
						min-width: 0;
						box-sizing: border-box;
					}

					.prediction-hero-card,
					.prediction-section-card {
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(255, 255, 255, 0.94);
						box-shadow: 0 24px 54px rgba(80, 64, 120, 0.08);
					}

					.prediction-hero-card {
						padding: 28px;
						border-radius: 34px;
					}

					.prediction-hero-grid {
						display: grid;
						grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
						gap: 28px;
						align-items: center;
					}

					.prediction-hero-copy {
						display: grid;
						gap: 14px;
						align-content: center;
					}

					.prediction-hero-image {
						position: relative;
						min-height: 320px;
						border-radius: 28px;
						overflow: hidden;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: linear-gradient(135deg, rgba(236, 232, 255, 0.86), rgba(247, 252, 255, 0.98));
						box-shadow: 0 18px 38px rgba(80, 64, 120, 0.12);
					}

					.prediction-hero-img {
						display: block;
						width: 100%;
						height: 100%;
						min-height: 320px;
						object-fit: cover;
						object-position: center;
					}

					.prediction-eyebrow {
						margin: 0;
						font-size: 0.72rem;
						font-weight: 900;
						letter-spacing: 0.24em;
						color: #9f89d8;
						text-transform: uppercase;
					}

					.prediction-hero-title {
						margin: 0;
						font-size: clamp(2.4rem, 4vw, 4.2rem);
						line-height: 1.05;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-text {
						margin: 0;
						font-size: 0.9rem;
						line-height: 1.8;
						color: #60788a;
					}

					.prediction-update-meta {
						display: inline-flex;
						width: fit-content;
						padding: 8px 12px;
						border-radius: 999px;
						background: rgba(240, 248, 253, 0.94);
						border: 1px solid rgba(93, 199, 232, 0.18);
						color: #2c7fa3;
						font-size: 0.78rem;
						font-weight: 800;
					}

					.prediction-stats-grid {
						display: grid;
						grid-template-columns: repeat(4, minmax(0, 1fr));
						gap: 16px;
					}

					.prediction-stat-card {
						padding: 20px;
						border-radius: 24px;
						background: rgba(255, 255, 255, 0.96);
						border: 1px solid rgba(176, 137, 216, 0.18);
						box-shadow: 0 14px 30px rgba(80, 64, 120, 0.06);
						display: grid;
						gap: 10px;
					}

					.prediction-stat-value {
						margin: 0;
						font-size: 1.55rem;
						line-height: 1.1;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-stat-description {
						margin: 0;
						font-size: 0.8rem;
						line-height: 1.6;
						color: #60788a;
					}

					.prediction-section-card {
						padding: 24px;
						border-radius: 30px;
						display: grid;
						gap: 18px;
					}

					.prediction-section-header {
						display: flex;
						align-items: flex-start;
						justify-content: space-between;
						gap: 16px;
						flex-wrap: wrap;
					}

					.prediction-section-title {
						margin: 0;
						font-size: 2rem;
						line-height: 1.15;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-count-pill {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						min-width: 64px;
						padding: 10px 14px;
						border-radius: 999px;
						background: rgba(176, 137, 216, 0.14);
						color: #8a70d2;
						font-size: 0.82rem;
						font-weight: 900;
					}

					.prediction-notification-grid {
						display: grid;
						padding: 2px 0 6px;
						width: 100%;
						max-width: 100%;
						min-width: 0;
					}

					.prediction-notification-marquee {
						position: relative;
						overflow: hidden;
						width: 100%;
						max-width: 100%;
						min-width: 0;
						padding: 2px 0 6px;
					}

					.prediction-notification-marquee::before,
					.prediction-notification-marquee::after {
						content: "";
						position: absolute;
						top: 0;
						bottom: 0;
						width: 52px;
						z-index: 2;
						pointer-events: none;
					}

					.prediction-notification-marquee::before {
						left: 0;
						background: linear-gradient(90deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0));
					}

					.prediction-notification-marquee::after {
						right: 0;
						background: linear-gradient(270deg, rgba(255, 255, 255, 0.98), rgba(255, 255, 255, 0));
					}

					.prediction-notification-track {
						display: flex;
						width: max-content;
						max-width: none;
						will-change: transform;
					}

					.prediction-notification-track.is-animated {
						animation: prediction-notification-scroll var(--hit-log-duration, 60s) linear infinite;
					}

					.prediction-notification-marquee:hover .prediction-notification-track.is-animated {
						animation-play-state: paused;
					}

					.prediction-notification-track.is-static {
						width: 100%;
					}

					.prediction-notification-group {
						display: flex;
						flex-shrink: 0;
						gap: 12px;
						padding-right: 12px;
					}

					.prediction-notification-track.is-static .prediction-notification-group {
						width: 100%;
						padding-right: 0;
					}

					@keyframes prediction-notification-scroll {
						from {
							transform: translateX(0);
						}

						to {
							transform: translateX(-50%);
						}
					}

					.prediction-notification-card {
						width: clamp(280px, 34vw, 360px);
						min-width: 280px;
						padding: 14px 16px;
						border-radius: 18px;
						border: 1px solid rgba(129, 140, 248, 0.28);
						background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(240,249,255,0.88));
						box-shadow: 0 12px 28px rgba(14, 165, 233, 0.10);
						display: grid;
						grid-template-columns: auto minmax(0, 1fr);
						gap: 12px;
						align-items: start;
						flex: 0 0 auto;
					}

					.prediction-notification-empty {
						display: flex;
						align-items: center;
						gap: 12px;
						flex-wrap: wrap;
						padding: 18px;
						border-radius: 20px;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(250, 247, 255, 0.9);
					}

					.prediction-notification-icon {
						width: 36px;
						height: 36px;
						border-radius: 12px;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						background: rgba(224, 242, 254, 0.92);
						border: 1px solid rgba(125, 211, 252, 0.42);
						font-size: 1rem;
						box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
					}

					.prediction-notification-body {
						display: grid;
						gap: 2px;
					}

					.prediction-notification-line {
						margin: 0;
						font-size: 0.88rem;
						line-height: 1.45;
						color: #16425b;
					}

					.prediction-notification-title {
						margin: 0;
						font-size: 0.98rem;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-notification-time {
						margin: 0;
						font-size: 0.76rem;
						font-weight: 700;
						color: #667b8f;
					}

					.prediction-notification-bet-type {
						margin: 2px 0 0;
						font-size: 0.8rem;
						font-weight: 800;
						color: #475569;
					}

					.prediction-notification-payout {
						margin: 4px 0 0;
						font-size: 0.92rem;
						font-weight: 900;
						color: #0369a1;
					}

					.prediction-notification-profit {
						margin: 0;
						font-size: 0.9rem;
						font-weight: 900;
					}

					@media (prefers-reduced-motion: reduce) {
						.prediction-notification-track {
							animation: none !important;
							transform: none !important;
						}

						.prediction-notification-marquee {
							overflow-x: auto;
						}
					}

					.prediction-quick-head {
						display: grid;
						grid-template-columns: minmax(0, 1fr) auto;
						gap: 18px;
						align-items: start;
					}

					.prediction-current-card {
						min-width: 190px;
						padding: 18px 20px;
						border-radius: 22px;
						border: 1px solid rgba(176, 137, 216, 0.24);
						background: rgba(250, 247, 255, 0.92);
						display: grid;
						gap: 8px;
					}

					.prediction-current-value {
						margin: 0;
						font-size: 1.18rem;
						line-height: 1.25;
						font-weight: 900;
						color: #132f45;
					}

					@media (max-width: 1200px) {
						.prediction-hero-grid {
							grid-template-columns: 1fr;
						}

						.prediction-stats-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}
					}

					@media (max-width: 900px) {


						.prediction-page-root {
							padding-top: 14px;
						}

						.prediction-page-main-panels {
							grid-template-columns: 1fr;
						}

						.prediction-stats-grid {
							grid-template-columns: 1fr;
						}

						.prediction-quick-head {
							grid-template-columns: 1fr;
						}

						.prediction-hero-card,
						.prediction-section-card {
							padding: 18px;
							border-radius: 24px;
						}

						.prediction-hero-image,
						.prediction-hero-img {
							min-height: 220px;
						}
					}
				`}
			</style>

			<div className="prediction-page-root">
				<section className="prediction-hero-card">
					<div className="prediction-hero-grid">
						<div className="prediction-hero-copy">
							<p className="prediction-eyebrow">PREDICTION</p>
							<h1 className="prediction-hero-title">今日の予想を考える</h1>
							<p className="prediction-text">
								会場特徴・天気・出走表・展示・オッズをまとめ、GPTへそのまま渡せる予想素材を整えるページです。
							</p>

							{dataUpdatedAt ? (
								<p className="prediction-update-meta">
									基本データ更新：{formatJstDateTimeLabel(dataUpdatedAt)}
								</p>
							) : null}

							{isRefreshingFeed || refreshMessage ? (
								<p className="prediction-text">
									{isRefreshingFeed ? "最新データを確認中です。" : refreshMessage}
								</p>
							) : null}
						</div>

						<div className="prediction-hero-image">
							<img src={predictionHeroImageSrc} alt={predictionHeroImageAlt} className="prediction-hero-img" />
						</div>
					</div>
				</section>

				<div className="prediction-stats-grid">
					{heroStats.map((item) => (
						<article key={item.eyebrow} className="prediction-stat-card">
							<p className="prediction-eyebrow">{item.eyebrow}</p>
							<p className="prediction-stat-value">{item.value}</p>
							<p className="prediction-stat-description">{item.description}</p>
						</article>
					))}
				</div>

				<div style={autoSettleChipRowStyle}>
					<span style={autoSettleChipStyle}>{autoSettleState.enabled ? "自動照合ON" : "自動照合停止中"}</span>
					<span style={autoSettleChipStyle}>自動照合済み {autoSettleState.autoSettledCount}R</span>
					<span style={autoSettleChipStyle}>結果待ち {autoSettleState.pendingCount}R</span>
					<span style={autoSettleChipStyle}>最終照合 {formatJstDateTimeLabel(autoSettleState.lastRunAt)}</span>
					<button type="button" style={autoSettleButtonStyle} onClick={handleCompactPracticeResults}>古い実践結果を整理</button>
					<button type="button" style={autoSettleButtonStyle} onClick={handlePruneBoatLocalStorage}>今日/昨日以外の競艇予想を整理</button>
				</div>
					{localStorageWarningText ? <p style={practiceMessageStyle}>{localStorageWarningText}</p> : null}
					{autoSettleState.warning ? <p style={practiceMessageStyle}>{autoSettleState.warning}</p> : null}

				<section className="prediction-section-card">
					<div className="prediction-section-header">
						<div>
							<p className="prediction-eyebrow">HIT NOTIFICATIONS</p>
							<h2 className="prediction-section-title">的中通知ログ</h2>
							<p className="prediction-text">
								保存済みの実践結果から、的中したレースだけを自動で表示します。
							</p>
						</div>

						<span className="prediction-count-pill">{hitNotificationItems.length}件</span>
					</div>

					<div className="prediction-notification-grid">
						{hitNotificationItems.length > 0 ? (
							<div
								className="prediction-notification-marquee"
								style={{ "--hit-log-duration": `${hitTickerDurationSec}s` } as CSSProperties}
							>
								<div
									className={`prediction-notification-track ${isHitTickerAnimated ? "is-animated" : "is-static"}`}
								>
									{[0, ...(isHitTickerAnimated ? [1] : [])].map((groupIndex) => (
										<div
											key={`hit-notification-group-${groupIndex}`}
											className="prediction-notification-group"
											aria-hidden={groupIndex > 0 ? "true" : undefined}
										>
											{hitTickerLoopItems.map((item) => (
												<article
													key={`${item.key}-${item.tickerRepeatIndex}-${groupIndex}`}
													className="prediction-notification-card"
												>
													<span className="prediction-notification-icon" aria-hidden="true">🎯</span>
													<div className="prediction-notification-body">
														<p className="prediction-notification-title">{item.venueRaceLabel} 的中</p>
														<p className="prediction-notification-time">{item.dateLabel} / {item.timeLabel}</p>
														<p className="prediction-notification-bet-type">{item.betTypeLabel}</p>
														<p className="prediction-notification-line">{item.hitBetNumbers}</p>
														<p className="prediction-notification-payout">払戻 {item.payoutLabel}</p>
														<p
															className="prediction-notification-profit"
															style={{ color: item.profitLabel.startsWith("+") ? "#0284c7" : "#b91c1c" }}
														>
															収支 {item.profitLabel}
														</p>
													</div>
												</article>
											))}
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="prediction-notification-empty">
								<span className="prediction-badge">保存済み実践結果から自動表示</span>
								<p className="prediction-text" style={{ margin: 0 }}>的中ログはまだありません</p>
							</div>
						)}
					</div>
				</section>

				<section className="prediction-section-card">
	<div className="prediction-quick-head">
		<div>
			<p className="prediction-eyebrow">QUICK SELECT</p>
			<h2 className="prediction-section-title">会場とレースを選ぶ</h2>
			<p className="prediction-text">
				会場とレースを選び、そのまま下の予想素材確認へ進めます。
			</p>
		</div>
	</div>

	<BoatPredictionVenueRaceChooser
		venues={venues}
		selectedVenueId={selectedVenueId}
		selectedRaceId={selectedRaceId}
		raceExhibitionStatusMap={raceExhibitionStatusMap}
		onSelectVenue={handleSelectVenue}
		onSelectRace={handleSelectRace}
	/>
</section>

				<div className={panelGridClassName}>
					<BoatGptMaterialPanel materialText={materialText} raceLabel={raceLabel} />
					<div style={{ display: "grid", gap: "10px" }}>
						{savedMessage ? <p style={savedMessageStyle}>{savedMessage}</p> : null}
						<BoatPredictionPastePanel
							value={predictionText}
							raceLabel={raceLabel}
							tickets={predictionTickets}
							savedAt={savedPredictionRecord?.savedAt}
							isSaved={Boolean(savedPredictionRecord && savedPredictionRecord.predictionText === predictionText)}
							onSave={handleSavePrediction}
							onChange={handleChangePredictionText}
							onClear={handleClearPrediction}
						/>
						<div style={johnsonSummaryStyle}>
							<span style={johnsonSummaryChipStyle}>保存済み予想 {johnsonCoverageSummary.savedCount}件</span>
							<span style={johnsonSummaryChipStyle}>ジョンソン化済み {johnsonCoverageSummary.johnsonizedCount}件</span>
							<span style={johnsonSummaryChipStyle}>未ジョンソン化 {johnsonCoverageSummary.pendingCount}件</span>
						</div>
						<div style={johnsonActionRowStyle}>
							<button type="button" style={johnsonPrimaryButtonStyle} onClick={handleSaveJohnsonPrediction}>ジョンソン化して保存</button>
							<button type="button" style={johnsonSecondaryButtonStyle} onClick={handleExportJohnsonPrediction}>今日の保存済み予想を全部ジョンソン化</button>
							<button type="button" style={johnsonSecondaryButtonStyle} onClick={handleCopyJohnsonJson}>JSONコピー</button>
						</div>
					</div>
				</div>

				{practiceMessage ? <p style={practiceMessageStyle}>{practiceMessage}</p> : null}
				<BoatPracticeResultPanel
					venueName={selectedVenue?.venueName ?? "-"}
					raceNo={selectedRace?.raceNo ?? 0}
					raceTitle={selectedRace?.title}
					tickets={predictionTickets}
					savedAt={savedPracticeResultRecord?.savedAt}
					isSaved={Boolean(savedPracticeResultRecord)}
					onSave={handleSavePracticeResult}
					onClear={handleClearPracticeResult}
					onLoadBets={handleLoadBetsToPractice}
					onSettleResult={handleSettlePracticeResult}
					actualFinishOrderText={actualFinishOrderText}
					investmentAmount={investmentAmount}
					payoutAmount={payoutAmount}
					practiceMemo={practiceMemo}
					betSummary={parsedBetSummary}
					resultStatus={practiceResultStatus}
					resultLookupStatus={practiceResultLookupStatus}
					resultLookupDebugText={practiceResultLookupDebugText}
					kimarite={practiceKimarite}
					startInfoText={practiceStartInfoText}
					hitBetLabel={practiceHitBetLabel}
					settlementMessage={practiceSettlementMessage}
					isBetAutoApplied={isBetAutoApplied}
					isResultAutoApplied={isResultAutoApplied}
					onChangeFinishOrder={setActualFinishOrderText}
					onChangeInvestmentAmount={handleChangeInvestmentAmount}
					onChangePayoutAmount={handleChangePayoutAmount}
					onChangePracticeMemo={setPracticeMemo}
				/>
			</div>
		</PageShell>
	);
}
