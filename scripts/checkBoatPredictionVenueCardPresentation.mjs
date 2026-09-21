import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const helperPath = "src/lib/boatPredictionVenueCardPresentation.ts";
const copyPath = "src/lib/boatPredictionGptCopy.ts";
const componentPath = "src/components/boatrace/BoatPredictionVenueRaceChooser.tsx";

const compileCommonJs = (filePath) => {
	const source = fs.readFileSync(path.join(root, filePath), "utf8");
	const compiled = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const module = { exports: {} };
	new Function("exports", "module", "require", compiled)(module.exports, module, () => {
		throw new Error(`${filePath} must not have runtime dependencies`);
	});
	return module.exports;
};

const {
	compareBoatPredictionVenueCards,
	getBoatPredictionSessionTone,
	getBoatPredictionVenueEventStatusBadge,
	getBoatPredictionVenueSeriesBadge,
} = compileCommonJs(helperPath);
const { formatBoatPredictionSessionLabel, resolveBoatPredictionVenueSession } = compileCommonJs(copyPath);
const {
	resolveOfficialVenueEventStatus,
	resolveOfficialVenueSeries,
	resolveOfficialVenueSession,
} = await import("./updateBoatTodayRaceDetails.mjs");

const readMinutes = (value) => {
	const match = String(value ?? "").normalize("NFKC").match(/(\d{1,2}):(\d{2})/u);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 29 && minutes >= 0 && minutes <= 59
		? hours * 60 + minutes
		: null;
};

const readRaceMinutes = (race) => {
	for (const key of ["deadlineTime", "deadline", "closeTime", "startTime", "time"]) {
		const minutes = readMinutes(race?.[key]);
		if (minutes !== null) return minutes;
	}
	return null;
};

const readFirstRaceMinutes = (venue) => {
	const races = Array.isArray(venue?.races) ? venue.races : [];
	const firstRace = races.find((race) => Number(race?.raceNo) === 1);
	const firstRaceMinutes = readRaceMinutes(firstRace);
	if (firstRaceMinutes !== null) return firstRaceMinutes;
	const knownTimes = races.map(readRaceMinutes).filter((value) => value !== null);
	return knownTimes.length > 0 ? Math.min(...knownTimes) : null;
};

const fixtureValues = [
	{ venue: "morning", index: 0, session: "morning", firstRaceMinutes: 512, venueName: "鳴門" },
	{ venue: "day-early", index: 1, session: "day", firstRaceMinutes: 630, venueName: "多摩川" },
	{ venue: "summer-late", index: 2, session: "summer", firstRaceMinutes: 695, venueName: "浜名湖" },
	{ venue: "same-time-b", index: 3, session: "summer", firstRaceMinutes: 700, venueName: "い会場" },
	{ venue: "same-time-a", index: 4, session: "day", firstRaceMinutes: 700, venueName: "あ会場" },
	{ venue: "stable-first", index: 5, session: "midnight", firstRaceMinutes: 720, venueName: "同会場" },
	{ venue: "stable-second", index: 6, session: "morning", firstRaceMinutes: 720, venueName: "同会場" },
	{ venue: "night", index: 7, session: "night", firstRaceMinutes: 919, venueName: "住之江" },
	{ venue: "midnight", index: 8, session: "midnight", firstRaceMinutes: 1061, venueName: "大村" },
	{ venue: "missing-b", index: 9, session: "morning", firstRaceMinutes: null, venueName: "B未取得" },
	{ venue: "missing-a", index: 10, session: "day", firstRaceMinutes: null, venueName: "A未取得" },
];
const sortedFixtures = [...fixtureValues].sort(compareBoatPredictionVenueCards);
assert.deepEqual(
	sortedFixtures.map((item) => item.venue),
	[
		"morning",
		"day-early",
		"summer-late",
		"same-time-a",
		"same-time-b",
		"stable-first",
		"stable-second",
		"night",
		"midnight",
		"missing-a",
		"missing-b",
	],
);

const sessions = ["morning", "day", "summer", "night", "midnight"];
const tones = Object.fromEntries(sessions.map((session) => [session, getBoatPredictionSessionTone(session)]));
assert.equal(new Set(sessions.map((session) => tones[session].badgeBackground)).size, sessions.length);
assert.equal(tones.day.badgeColor, "#ffffff");
assert.doesNotMatch(tones.day.badgeBackground, /255,\s*255,\s*255|#fff(?:fff)?$/iu);

const officialClassFixtures = {
	ordinary: resolveOfficialVenueSession({ title: "一般競走", className: "", explicitSession: "unknown" }),
	morning: resolveOfficialVenueSession({ title: "一般競走", className: "is-morning" }),
	summer: resolveOfficialVenueSession({ title: "一般競走", className: "is-summer", explicitSession: "day" }),
	night: resolveOfficialVenueSession({ title: "一般競走", className: "is-nighter" }),
	midnight: resolveOfficialVenueSession({ title: "一般競走", className: "is-midnight", explicitSession: "day" }),
};
assert.deepEqual(officialClassFixtures, {
	ordinary: "day",
	morning: "morning",
	summer: "summer",
	night: "night",
	midnight: "midnight",
});

const officialSeriesFixtures = {
	rookie: resolveOfficialVenueSeries({ title: "一般競走", className: "is-ippan is-rookie__3rdadd" }),
	allLadies: resolveOfficialVenueSeries({ title: "プリンセスカップ", className: "is-G3b is-lady" }),
	venus: resolveOfficialVenueSeries({ title: "一般競走", className: "is-ippan is-venus" }),
	titleFallback: resolveOfficialVenueSeries({ title: "ルーキーシリーズ第17戦", className: "is-ippan" }),
	ambiguousTitle: resolveOfficialVenueSeries({ title: "プリンセスカップ", className: "is-G3b" }),
};
assert.deepEqual(officialSeriesFixtures, {
	rookie: "rookie",
	allLadies: "all-ladies",
	venus: "venus",
	titleFallback: "rookie",
	ambiguousTitle: null,
});

const seriesBadgeFixtures = [
	getBoatPredictionVenueSeriesBadge({ series: "rookie" }),
	getBoatPredictionVenueSeriesBadge({ series: "all-ladies" }),
	getBoatPredictionVenueSeriesBadge({ series: "venus" }),
];
assert.deepEqual(seriesBadgeFixtures.map((badge) => badge?.label), [
	"ルーキーシリーズ",
	"オールレディース",
	"ヴィーナスシリーズ",
]);
assert.equal(new Set(seriesBadgeFixtures.map((badge) => badge?.border)).size, 3);

const officialEventStatusFixtures = {
	cancelled: resolveOfficialVenueEventStatus({ statusText: "12R以降中止" }),
	partialCancelled: resolveOfficialVenueEventStatus({ statusText: "5R以降中止順延" }),
	postponed: resolveOfficialVenueEventStatus({ statusText: "中止順延" }),
	normal: resolveOfficialVenueEventStatus({ statusText: "発売中" }),
};
assert.deepEqual(officialEventStatusFixtures, {
	cancelled: "cancelled",
	partialCancelled: "cancelled",
	postponed: "postponed",
	normal: "normal",
});
assert.equal(getBoatPredictionVenueEventStatusBadge({ eventStatus: officialEventStatusFixtures.cancelled })?.label, "中止");
assert.equal(getBoatPredictionVenueEventStatusBadge({ eventStatus: officialEventStatusFixtures.postponed })?.label, "順延");
assert.equal(getBoatPredictionVenueEventStatusBadge({ eventStatus: officialEventStatusFixtures.normal }), null);

const venueFixtures = [
	["01", "桐生", "night"], ["02", "戸田", "day"], ["03", "江戸川", "day"], ["04", "平和島", "day"],
	["05", "多摩川", "day"], ["06", "浜名湖", "day"], ["07", "蒲郡", "night"], ["08", "常滑", "day"],
	["09", "津", "day"], ["10", "三国", "morning"], ["11", "びわこ", "day"], ["12", "住之江", "night"],
	["13", "尼崎", "day"], ["14", "鳴門", "morning"], ["15", "丸亀", "night"], ["16", "児島", "day"],
	["17", "宮島", "day"], ["18", "徳山", "morning"], ["19", "下関", "night"], ["20", "若松", "night"],
	["21", "芦屋", "morning"], ["22", "福岡", "day"], ["23", "唐津", "morning"], ["24", "大村", "night"],
];
const all24VenueAudit = venueFixtures.map(([venueCode, venueName, session]) => {
	const resolution = resolveBoatPredictionVenueSession({ venueCode, venueName, date: "fixture", session, races: [] }, []);
	return { venueCode, venueName, expected: session, actual: resolution.session, ok: resolution.session === session };
});
assert.equal(all24VenueAudit.length, 24);
assert.ok(all24VenueAudit.every((item) => item.ok));

const details = JSON.parse(fs.readFileSync(path.join(root, "public/data/boatrace/today-race-details.generated.json"), "utf8"));
const activeValues = (details.venues ?? []).map((venue, index) => {
	const races = Array.isArray(venue.races) ? venue.races : [];
	const resolution = resolveBoatPredictionVenueSession(venue, races);
	return {
		venue,
		index,
		venueName: venue.venueName,
		session: resolution.session,
		sessionLabel: formatBoatPredictionSessionLabel(resolution.session),
		sessionSource: resolution.source,
		firstRaceMinutes: readFirstRaceMinutes(venue),
	};
});
const sortedActiveValues = [...activeValues].sort(compareBoatPredictionVenueCards);
const activeVenueAudit = sortedActiveValues.map((item, sortIndex) => ({
	venue: item.venueName,
	session: item.session,
	sessionLabel: item.sessionLabel,
	firstRaceTime: item.firstRaceMinutes === null
		? null
		: `${String(Math.floor(item.firstRaceMinutes / 60)).padStart(2, "0")}:${String(item.firstRaceMinutes % 60).padStart(2, "0")}`,
	firstRaceMinutes: item.firstRaceMinutes,
	sortIndex,
	sessionSource: item.sessionSource,
	series: getBoatPredictionVenueSeriesBadge(item.venue)?.label ?? null,
	seriesSource: getBoatPredictionVenueSeriesBadge(item.venue)?.source ?? null,
}));
const unknownVenueCount = activeVenueAudit.filter((item) => item.session === "unknown").length;
const ordinaryDayVenues = activeVenueAudit.filter((item) => item.sessionSource === "official-race-index:ordinary-day");
const omura = activeVenueAudit.find((item) => item.venue === "大村");
const fukuoka = activeVenueAudit.find((item) => item.venue === "福岡");
const gamagori = activeVenueAudit.find((item) => item.venue === "蒲郡");
assert.equal(unknownVenueCount, 0);
assert.ok(ordinaryDayVenues.every((item) => item.session === "day" && item.sessionLabel === "デイ"));
if (details.date === "2026-09-18") {
	assert.equal(activeVenueAudit.length, 15);
	assert.equal(ordinaryDayVenues.length, 8);
	assert.equal(omura?.session, "midnight");
	assert.equal(omura?.sessionLabel, "ミッドナイト");
	assert.equal(fukuoka?.session, "summer");
	assert.equal(fukuoka?.sessionLabel, "サマータイム");
	assert.equal(gamagori?.series, "ルーキーシリーズ");
}

for (let index = 1; index < activeVenueAudit.length; index += 1) {
	const previous = activeVenueAudit[index - 1];
	const current = activeVenueAudit[index];
	if (previous.firstRaceMinutes === null) {
		assert.equal(current.firstRaceMinutes, null, "known first-race times must not follow missing times");
	} else if (current.firstRaceMinutes !== null) {
		assert.ok(previous.firstRaceMinutes <= current.firstRaceMinutes, "all venues must be sorted by first-race time");
	}
}

if (details.date === "2026-09-19") {
	assert.deepEqual(activeVenueAudit.map((item) => item.venue), [
		"鳴門",
		"唐津",
		"多摩川",
		"尼崎",
		"宮島",
		"戸田",
		"児島",
		"平和島",
		"江戸川",
		"浜名湖",
		"住之江",
		"丸亀",
		"大村",
	]);
}

const componentSource = fs.readFileSync(path.join(root, componentPath), "utf8");
const updaterSource = fs.readFileSync(path.join(root, "scripts/updateBoatTodayRaceDetails.mjs"), "utf8");
assert.match(componentSource, /\.sort\(compareBoatPredictionVenueCards\)/u);
assert.match(componentSource, /getBoatPredictionSessionTone\(displaySession\)/u);
assert.match(componentSource, /getBoatPredictionVenueSeriesBadge\(venue\)/u);
assert.match(componentSource, /getBoatPredictionVenueEventStatusBadge\(venue\)/u);
assert.match(componentSource, /公式シリーズ/u);
assert.match(componentSource, /const selectedVenue = venues\.find/u);
assert.match(componentSource, /onSelectVenue\(venue\.id\)/u);
assert.match(componentSource, /Number\(race\.raceNo\) === 1/u);
assert.match(updaterSource, /className: sessionCell\.attr\("class"\) \?\? ""/u);
assert.match(updaterSource, /series: resolveOfficialVenueSeries\(\{ title, className: gradeCell\.attr\("class"\) \}\)/u);

console.log(JSON.stringify({
	ok: true,
	date: details.date,
	checks: {
		colorMap: true,
		currentActiveVenueSessions: unknownVenueCount === 0,
		sourceBackedOrdinaryDay: officialClassFixtures.ordinary === "day"
			&& activeVenueAudit.filter((item) => item.session === "day").every((item) => item.sessionLabel === "デイ"),
		sessionPriorityUnused: sortedFixtures[1].venue === "day-early" && sortedFixtures[2].venue === "summer-late",
		globalFirstRaceTimeAscending: true,
		crossSessionTimeOrder: sortedFixtures[1].firstRaceMinutes < sortedFixtures[2].firstRaceMinutes,
		sameTimeVenueNameSort: sortedFixtures[3].venueName === "あ会場" && sortedFixtures[4].venueName === "い会場",
		stableIndexSort: sortedFixtures[5].index < sortedFixtures[6].index,
		missingTimeLast: sortedFixtures.at(-2).firstRaceMinutes === null && sortedFixtures.at(-1).firstRaceMinutes === null,
		fukuokaSummerRegression: details.date === "2026-09-18"
			? fukuoka?.session === "summer"
			: officialClassFixtures.summer === "summer",
		omuraMidnightRegression: details.date === "2026-09-18"
			? omura?.session === "midnight"
			: officialClassFixtures.midnight === "midnight",
		seriesBadgeClassification: seriesBadgeFixtures.every(Boolean),
		activeSeriesBadge: details.date === "2026-09-18"
			? gamagori?.series === "ルーキーシリーズ"
			: officialSeriesFixtures.rookie === "rookie",
		all24VenueFixtureRegression: all24VenueAudit.every((item) => item.ok),
		selectionWiringPreserved: true,
	},
	badgeColors: Object.fromEntries(sessions.map((session) => [session, tones[session].badgeBackground])),
	officialClassFixtures,
	officialSeriesFixtures,
	officialEventStatusFixtures,
	unknownVenueCount,
	ordinaryDayVenueCount: ordinaryDayVenues.length,
	activeVenueAudit,
	all24VenueAudit,
}, null, 2));
