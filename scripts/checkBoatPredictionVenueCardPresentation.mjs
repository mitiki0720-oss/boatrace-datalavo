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

const { compareBoatPredictionVenueCards, getBoatPredictionSessionTone } = compileCommonJs(helperPath);
const { formatBoatPredictionSessionLabel, resolveBoatPredictionVenueSession } = compileCommonJs(copyPath);
const { resolveOfficialVenueSession } = await import("./updateBoatTodayRaceDetails.mjs");

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
	{ venue: "morning", index: 0, session: "morning", firstRaceMinutes: 490, venueName: "三国" },
	{ venue: "night-earliest", index: 1, session: "night", firstRaceMinutes: 450, venueName: "桐生" },
	{ venue: "day-z", index: 2, session: "day", firstRaceMinutes: 600, venueName: "い会場" },
	{ venue: "midnight", index: 3, session: "midnight", firstRaceMinutes: 1060, venueName: "大村" },
	{ venue: "summer", index: 4, session: "summer", firstRaceMinutes: 570, venueName: "江戸川" },
	{ venue: "day-a", index: 5, session: "day", firstRaceMinutes: 600, venueName: "あ会場" },
	{ venue: "missing-b", index: 6, session: "morning", firstRaceMinutes: null, venueName: "B未取得" },
	{ venue: "missing-a", index: 7, session: "day", firstRaceMinutes: null, venueName: "A未取得" },
];
const sortedFixtures = [...fixtureValues].sort(compareBoatPredictionVenueCards);
assert.deepEqual(
	sortedFixtures.map((item) => item.venue),
	["night-earliest", "morning", "summer", "day-a", "day-z", "midnight", "missing-a", "missing-b"],
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
}));
const unknownVenueCount = activeVenueAudit.filter((item) => item.session === "unknown").length;
const ordinaryDayVenues = activeVenueAudit.filter((item) => item.sessionSource === "official-race-index:ordinary-day");
const omura = activeVenueAudit.find((item) => item.venue === "大村");
assert.equal(unknownVenueCount, 0);
assert.equal(omura?.session, "midnight");
assert.equal(omura?.sessionLabel, "ミッドナイト");
assert.ok(ordinaryDayVenues.every((item) => item.session === "day" && item.sessionLabel === "デイ"));
if (details.date === "2026-09-18") {
	assert.equal(activeVenueAudit.length, 15);
	assert.equal(ordinaryDayVenues.length, 8);
}

for (let index = 1; index < activeVenueAudit.length; index += 1) {
	const previous = activeVenueAudit[index - 1];
	const current = activeVenueAudit[index];
	if (previous.firstRaceMinutes === null) {
		assert.equal(current.firstRaceMinutes, null, "known first-race times must not follow missing times");
	} else if (current.firstRaceMinutes !== null) {
		assert.ok(previous.firstRaceMinutes <= current.firstRaceMinutes, "active venues must be sorted by first-race time");
	}
}

const componentSource = fs.readFileSync(path.join(root, componentPath), "utf8");
assert.match(componentSource, /\.sort\(compareBoatPredictionVenueCards\)/u);
assert.match(componentSource, /getBoatPredictionSessionTone\(displaySession\)/u);
assert.match(componentSource, /const selectedVenue = venues\.find/u);
assert.match(componentSource, /onSelectVenue\(venue\.id\)/u);
assert.match(componentSource, /Number\(race\.raceNo\) === 1/u);

console.log(JSON.stringify({
	ok: true,
	date: details.date,
	checks: {
		colorMap: true,
		currentActiveVenueSessions: unknownVenueCount === 0,
		sourceBackedOrdinaryDay: ordinaryDayVenues.length > 0 && ordinaryDayVenues.every((item) => item.session === "day"),
		firstRaceTimeAscending: true,
		sameTimeStableSort: sortedFixtures[3].venueName === "あ会場" && sortedFixtures[4].venueName === "い会場",
		missingTimeLast: sortedFixtures.slice(-2).every((item) => item.firstRaceMinutes === null),
		sessionPriorityIndependent: sortedFixtures[0].session === "night" && sortedFixtures[1].session === "morning",
		omuraMidnightRegression: omura?.session === "midnight",
		all24VenueFixtureRegression: all24VenueAudit.every((item) => item.ok),
		selectionWiringPreserved: true,
	},
	badgeColors: Object.fromEntries(sessions.map((session) => [session, tones[session].badgeBackground])),
	officialClassFixtures,
	unknownVenueCount,
	ordinaryDayVenueCount: ordinaryDayVenues.length,
	activeVenueAudit,
	all24VenueAudit,
}, null, 2));
