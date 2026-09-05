import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const copySource = read("src/lib/boatPredictionGptCopy.ts");
const today = JSON.parse(read("public/data/boatrace/today.generated.json"));
const details = JSON.parse(read("public/data/boatrace/today-race-details.generated.json"));
const venueExtras = JSON.parse(read("public/data/boatrace/venue-extras.generated.json"));

const compiledCopy = ts.transpileModule(copySource, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const copyModule = { exports: {} };
new Function("exports", "module", compiledCopy)(copyModule.exports, copyModule);
const {
	formatBoatPredictionSessionLabel,
	getBoatPredictionRaceTimeLabel,
	getBoatPredictionRangeTimeKind,
	getBoatPredictionVenueTimeKind,
	normalizeBoatPredictionSession,
} = copyModule.exports;

const venueFixtures = [
	["01", "桐生", "night"], ["02", "戸田", "day"], ["03", "江戸川", "day"], ["04", "平和島", "day"],
	["05", "多摩川", "day"], ["06", "浜名湖", "day"], ["07", "蒲郡", "night"], ["08", "常滑", "day"],
	["09", "津", "day"], ["10", "三国", "morning"], ["11", "びわこ", "day"], ["12", "住之江", "night"],
	["13", "尼崎", "day"], ["14", "鳴門", "morning"], ["15", "丸亀", "night"], ["16", "児島", "day"],
	["17", "宮島", "day"], ["18", "徳山", "morning"], ["19", "下関", "night"], ["20", "若松", "night"],
	["21", "芦屋", "morning"], ["22", "福岡", "day"], ["23", "唐津", "morning"], ["24", "大村", "night"],
];

const fixtureTimes = [
	"08:30", "09:00", "09:30", "10:00", "10:30", "11:00",
	"12:00", "13:00", "14:00", "17:30", "20:30", "22:15",
];
const fixtureRaces = fixtureTimes.map((deadlineTime, index) => ({ raceNo: index + 1, deadlineTime }));
const rangeRaceNos = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]];

const auditVenue = (venue) => {
	const races = Array.isArray(venue.races) ? venue.races : [];
	const canonical = normalizeBoatPredictionSession(venue.session);
	const venueSession = getBoatPredictionVenueTimeKind(venue, races);
	const rangeSessions = rangeRaceNos.map((raceNos) =>
		getBoatPredictionRangeTimeKind(venueSession, races.filter((race) => raceNos.includes(Number(race.raceNo)))),
	);
	const raceSessions = races.map((race) => getBoatPredictionRaceTimeLabel(venueSession, race));
	const actualSessions = [...new Set([venueSession, ...rangeSessions, ...raceSessions])];
	return {
		date: venue.date ?? today.date,
		venueCode: String(venue.venueCode ?? "").padStart(2, "0"),
		venueName: venue.venueName,
		canonical,
		canonicalLabel: formatBoatPredictionSessionLabel(canonical ?? "unknown"),
		venueSession,
		rangeSessions,
		raceSessions,
		actualSessions,
		split: actualSessions.length > 1,
		canonicalMismatch: canonical === null || actualSessions.some((session) => session !== canonical),
	};
};

const activeVenueAudits = (today.venues ?? []).map(auditVenue);
const fixtureVenueAudits = venueFixtures.map(([venueCode, venueName, session]) =>
	auditVenue({ venueCode, venueName, date: "fixture", session, races: fixtureRaces }),
);

const legacyMinutes = (race) => {
	const match = String(race?.deadlineTime ?? race?.startTime ?? "").match(/(\d{1,2}):(\d{2})/);
	return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};
const legacyVenueSession = (venue) => {
	const values = (venue.races ?? []).map(legacyMinutes).filter((value) => value !== null).sort((a, b) => a - b);
	const first = values[0] ?? null;
	const last = values.at(-1) ?? null;
	if (String(venue.title ?? "").includes("ミッドナイト") || (last !== null && last >= 21 * 60)) return "midnight";
	if (first !== null && first < 10 * 60 + 30) return "morning";
	if (first !== null && first >= 17 * 60) return "night";
	return "day";
};
const legacyRaceSession = (venueSession, race) => {
	if (venueSession === "midnight") return venueSession;
	const minutes = legacyMinutes(race);
	if (minutes === null) return venueSession;
	if (minutes < 10 * 60 + 30) return "morning";
	if (minutes < 17 * 60) return "day";
	if (minutes < 21 * 60) return "night";
	return "midnight";
};
const legacySplitVenues = (today.venues ?? []).filter((venue) => {
	const venueSession = legacyVenueSession(venue);
	return new Set((venue.races ?? []).map((race) => legacyRaceSession(venueSession, race))).size > 1;
}).map((venue) => venue.venueName);

const displaySources = [
	"src/lib/boatPredictionGptCopyExContext.ts",
	"src/lib/boatPredictionMaterial.ts",
	"src/components/boatrace/BoatGptBulkMaterialPanel.tsx",
	"src/components/boatrace/BoatPredictionVenueRaceChooser.tsx",
	"src/components/boatrace/BoatVenueSelectorPanel.tsx",
	"src/components/boatrace/BoatVenueSpotlight.tsx",
].map((path) => ({ path, source: read(path) }));
const predictionMaterialSource = read("src/lib/boatPredictionMaterial.ts");
const forbiddenRawDisplayPatterns = [
	/時間帯:\s*\$\{venueTimeKind\}/g,
	/時間帯:\s*\$\{rangeTimeKind\}/g,
	/時間帯:\s*\$\{getBoatPredictionRaceTimeLabel/g,
	/時間帯 \{rangeTimeKind\}/g,
	/toDisplay\(venue\.session/g,
	/return "(?:Morning|Day|Night|Midnight|Schedule)"/g,
];
const rawEnglishDisplayMatches = displaySources.flatMap(({ path, source }) =>
	forbiddenRawDisplayPatterns.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => ({ path, match: match[0] }))),
);

const detailVenues = Array.isArray(details.venues) ? details.venues : [];
const detailRaces = detailVenues.flatMap((venue) => Array.isArray(venue.races) ? venue.races : []);
const racers = detailRaces.flatMap((race) => Array.isArray(race.racers) ? race.racers : []);
const hasText = (value) => String(value ?? "").trim().length > 0;
const registrationPeriodCount = racers.filter((racer) =>
	["registrationPeriod", "registrationTerm", "term", "period"].some((key) => hasText(racer[key])),
).length;
const registrationPeriodAuditByVenue = detailVenues.map((venue) => {
	const extraVenue = (venueExtras.venues ?? []).find((candidate) =>
		String(candidate.venueCode ?? "").padStart(2, "0") === String(venue.venueCode ?? "").padStart(2, "0"),
	);
	const candidates = new Map();
	for (const raceExtra of extraVenue?.races ?? []) {
		for (const entry of Array.isArray(raceExtra.entryTable) ? raceExtra.entryTable : []) {
			const registrationNo = String(entry.registrationNo ?? entry.registerNo ?? "").trim();
			const period = String(entry.term ?? entry.registrationPeriod ?? entry.registrationTerm ?? "").trim();
			const source = String(entry.source ?? "").trim();
			if (!/^\d{4}$/u.test(registrationNo) || !period || !/(?:official|boatrace)/iu.test(source)) continue;
			const values = candidates.get(registrationNo) ?? new Set();
			values.add(period);
			candidates.set(registrationNo, values);
		}
	}
	let exactLinkedCount = 0;
	let collisionCount = 0;
	for (const race of venue.races ?? []) {
		for (const racer of race.racers ?? []) {
			if (["registrationPeriod", "registrationTerm", "term", "period"].some((key) => hasText(racer[key]))) continue;
			const registrationNo = String(racer.registrationNo ?? "").trim();
			const periods = candidates.get(registrationNo);
			if (periods?.size === 1) exactLinkedCount += 1;
			if (periods?.size > 1) collisionCount += 1;
		}
	}
	return {
		venueName: venue.venueName,
		sourceRegistrationCount: candidates.size,
		exactLinkedCount,
		collisionCount,
	};
});
const exactRegistrationPeriodLinkedCount = registrationPeriodAuditByVenue.reduce((total, venue) => total + venue.exactLinkedCount, 0);
const registrationPeriodCollisionCount = registrationPeriodAuditByVenue.reduce((total, venue) => total + venue.collisionCount, 0);
const startTimeCount = detailRaces.filter((race) =>
	["startTime", "time", "scheduledStartTime"].some((key) => hasText(race[key])),
).length;
const deadlineTimeCount = detailRaces.filter((race) =>
	["deadlineTime", "deadline", "closeTime"].some((key) => hasText(race[key])),
).length;

const expectedActiveSessions = new Map([
	["三国", "morning"], ["徳山", "morning"], ["津", "day"], ["江戸川", "day"], ["桐生", "night"], ["若松", "night"],
]);
const requiredVenueChecks = Object.fromEntries([...expectedActiveSessions].map(([venueName, expected]) => {
	const audit = activeVenueAudits.find((item) => item.venueName === venueName);
	return [venueName, Boolean(audit && audit.canonical === expected && !audit.split && !audit.canonicalMismatch)];
}));

const aliasChecks = {
	morning: formatBoatPredictionSessionLabel("morning") === "モーニング",
	summer: ["summer", "summer-time", "summertime"].every((value) => formatBoatPredictionSessionLabel(value) === "サマータイム"),
	night: formatBoatPredictionSessionLabel("night") === "ナイター",
	midnight: formatBoatPredictionSessionLabel("midnight") === "ミッドナイト",
	day: formatBoatPredictionSessionLabel("day") === "デイ",
	unknown: formatBoatPredictionSessionLabel(undefined) === "開催区分未取得",
	sourceBackedRaceOverride:
		getBoatPredictionRaceTimeLabel("day", { raceNo: 1, session: "night" }) === "night" &&
		getBoatPredictionRangeTimeKind("day", [{ raceNo: 1, session: "night" }]) === "night",
	resultLeakGuard: predictionMaterialSource.includes("この素材は予想用のため、着順・払戻・決まり手などの結果情報は含めません。"),
};

const sameDaySessionSplitCount = activeVenueAudits.filter((audit) => audit.split).length;
const unknownSessionCount = activeVenueAudits.filter((audit) => audit.canonical === null || audit.venueSession === "unknown").length;
const canonicalMismatchCount = activeVenueAudits.filter((audit) => audit.canonicalMismatch).length;
const ok =
	today.date === details.date &&
	fixtureVenueAudits.length === 24 &&
	fixtureVenueAudits.every((audit) => !audit.split && !audit.canonicalMismatch) &&
	sameDaySessionSplitCount === 0 &&
	unknownSessionCount === 0 &&
	canonicalMismatchCount === 0 &&
	rawEnglishDisplayMatches.length === 0 &&
	registrationPeriodCollisionCount === 0 &&
	Object.values(requiredVenueChecks).every(Boolean) &&
	Object.values(aliasChecks).every(Boolean);

console.log(JSON.stringify({
	ok,
	date: today.date,
	venueCount: activeVenueAudits.length,
	raceCount: activeVenueAudits.reduce((total, venue) => total + venue.raceSessions.length, 0),
	venueDateCount: new Set(activeVenueAudits.map((venue) => `${venue.date}:${venue.venueCode}`)).size,
	sameDaySessionSplitCount,
	unknownSessionCount,
	rawEnglishDisplayCount: rawEnglishDisplayMatches.length,
	canonicalMismatchCount,
	beforeAudit: {
		legacySameDaySessionSplitCount: legacySplitVenues.length,
		legacySplitVenues,
		legacyRawEnglishDisplaySites: 6,
	},
	requiredVenueChecks,
	aliasChecks,
	activeVenueSessions: activeVenueAudits.map(({ venueCode, venueName, canonical, canonicalLabel, rangeSessions, actualSessions }) => ({
		venueCode, venueName, canonical, canonicalLabel, rangeSessions, actualSessions,
	})),
	all24VenueAudit: fixtureVenueAudits.map(({ venueCode, venueName, canonical, canonicalLabel, split }) => ({
		venueCode, venueName, canonical, canonicalLabel, split,
	})),
	registrationPeriodAudit: {
		racerCount: racers.length,
		directRaceFeedCount: registrationPeriodCount,
		exactVenueExtraLinkedCount: exactRegistrationPeriodLinkedCount,
		availableCount: registrationPeriodCount + exactRegistrationPeriodLinkedCount,
		missingCount: racers.length - registrationPeriodCount - exactRegistrationPeriodLinkedCount,
		collisionCount: registrationPeriodCollisionCount,
		byVenue: registrationPeriodAuditByVenue,
		reason: "The official race-list feed has no registration-period field. Official venue-extras terms are used only when registrationNo matches exactly and has one unambiguous term; all other racers remain unavailable.",
	},
	startTimeAudit: {
		raceCount: detailRaces.length,
		deadlineTimeCount,
		startTimeCount,
		missingCount: detailRaces.length - startTimeCount,
		reason: startTimeCount === 0
			? "Current official race-list parser provides deadlineTime only. startTime is not derived from the deadline."
			: "Source-backed start-time fields are present.",
	},
	rawEnglishDisplayMatches,
}, null, 2));

if (!ok) process.exitCode = 1;
