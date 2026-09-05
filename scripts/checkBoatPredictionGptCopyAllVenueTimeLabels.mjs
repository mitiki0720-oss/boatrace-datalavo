import fs from "node:fs";
import ts from "typescript";

const copySource = fs.readFileSync("src/lib/boatPredictionGptCopy.ts", "utf8");
const today = JSON.parse(fs.readFileSync("public/data/boatrace/today.generated.json", "utf8"));
const compiledCopy = ts.transpileModule(copySource, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const copyModule = { exports: {} };
new Function("exports", "module", compiledCopy)(copyModule.exports, copyModule);
const {
	getBoatPredictionRaceTimeLabel,
	getBoatPredictionRangeTimeKind,
	getBoatPredictionVenueTimeKind,
	buildBoatPredictionGptBettingInstruction,
	formatBoatPredictionSessionLabel,
	normalizeBoatPredictionSession,
} = copyModule.exports;

const allVenueNames = [
	"桐生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖", "蒲郡", "常滑", "津", "三国", "びわこ", "住之江",
	"尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山", "下関", "若松", "芦屋", "福岡", "唐津", "大村",
];
const morningVenues = new Set(["三国", "鳴門", "徳山", "芦屋", "唐津"]);
const midnightVenues = new Set();
const nightVenues = new Set(["桐生", "蒲郡", "住之江", "丸亀", "下関", "若松", "大村"]);
const rangeNumbers = {
	"1R〜6R": [1, 2, 3, 4, 5, 6],
	"7R〜12R": [7, 8, 9, 10, 11, 12],
};

const readMinutes = (value) => {
	const match = String(value ?? "").match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);
	if (!match) return null;
	return Number(match[1]) * 60 + Number(match[2]);
};
const raceMinutes = (race) => readMinutes(race.deadlineTime) ?? readMinutes(race.startTime);
const expectedRangeKind = (venueTimeKind) => venueTimeKind;
const expectedRaceKind = (venueTimeKind) => venueTimeKind;
const fixtureRacesFor = (kind) => {
	const times = kind === "midnight"
		? ["18:00", "18:20", "18:40", "19:00", "19:20", "20:00", "20:20", "20:40", "21:00", "21:20", "21:40", "22:00"]
		: kind === "night"
			? ["17:00", "17:20", "17:40", "18:00", "18:20", "18:40", "19:00", "19:20", "19:40", "20:00", "20:20", "20:40"]
			: kind === "morning"
				? ["08:45", "09:05", "09:25", "09:45", "10:05", "10:25", "10:55", "11:20", "11:45", "12:10", "12:35", "13:00"]
				: ["10:45", "11:05", "11:25", "11:45", "12:05", "12:25", "12:55", "13:20", "13:45", "14:10", "14:35", "15:00"];
	return times.map((deadlineTime, index) => ({ raceNo: index + 1, deadlineTime }));
};
const canonicalFixtureResults = allVenueNames.map((venueName) => {
	const expectedVenueKind = midnightVenues.has(venueName)
		? "midnight"
		: morningVenues.has(venueName)
			? "morning"
			: nightVenues.has(venueName)
				? "night"
				: "day";
	const races = fixtureRacesFor(expectedVenueKind);
	const fixture = {
		venueName,
		title: expectedVenueKind === "midnight" ? "ミッドナイト" : "",
		session: expectedVenueKind,
		races,
	};
	const actualVenueKind = getBoatPredictionVenueTimeKind(fixture, races);
	const expectedFirstHalf = expectedRangeKind(expectedVenueKind, races.filter((race) => race.raceNo <= 6));
	const expectedLatterHalf = expectedRangeKind(expectedVenueKind, races.filter((race) => race.raceNo >= 7));
	return {
		venueName,
		ok:
			actualVenueKind === expectedVenueKind &&
			getBoatPredictionRangeTimeKind(actualVenueKind, races.filter((race) => race.raceNo <= 6)) === expectedFirstHalf &&
			getBoatPredictionRangeTimeKind(actualVenueKind, races.filter((race) => race.raceNo >= 7)) === expectedLatterHalf &&
			races.every((race) => getBoatPredictionRaceTimeLabel(actualVenueKind, race) === expectedRaceKind(expectedVenueKind, race)),
	};
});

const activeVenueResults = (today.venues ?? []).map((venue) => {
	const races = Array.isArray(venue.races) ? venue.races : [];
	const venueTimeKind = getBoatPredictionVenueTimeKind(venue, races);
	const canonicalSession = normalizeBoatPredictionSession(venue.session);
	const rangeResults = Object.entries(rangeNumbers).map(([label, numbers]) => {
		const selectedRaces = races.filter((race) => numbers.includes(Number(race.raceNo)));
		const actual = getBoatPredictionRangeTimeKind(venueTimeKind, selectedRaces);
		const expected = canonicalSession;
		return { label, raceCount: selectedRaces.length, actual, expected, ok: actual === expected };
	});
	const raceFailures = races
		.filter((race) => getBoatPredictionRaceTimeLabel(venueTimeKind, race) !== canonicalSession)
		.map((race) => `${race.raceNo}R`);
	return {
		venueName: venue.venueName,
		canonicalSession,
		venueTimeKind,
		rangeResults,
		raceFailures,
		ok: canonicalSession !== null && venueTimeKind === canonicalSession && rangeResults.every((result) => result.ok) && raceFailures.length === 0,
	};
});

const failedCanonicalFixtures = canonicalFixtureResults.filter((result) => !result.ok).map((result) => result.venueName);
const failedActiveVenues = activeVenueResults.filter((result) => !result.ok);
const forbiddenCopyFragments = ["fake", "score", "rank", "generatedPrediction", "generatedTicket"];
const presentForbiddenCopyFragments = forbiddenCopyFragments.filter((fragment) => buildBoatPredictionGptBettingInstruction().includes(fragment));
const displayLabels = ["morning", "summer", "day", "night", "midnight", "unknown"].map((session) => ({
	session,
	label: formatBoatPredictionSessionLabel(session),
}));
const ok =
	allVenueNames.length === 24 &&
	new Set(allVenueNames).size === 24 &&
	activeVenueResults.length > 0 &&
	failedCanonicalFixtures.length === 0 &&
	failedActiveVenues.length === 0 &&
	displayLabels.every(({ label }) => !["morning", "summer", "day", "night", "midnight", "unknown"].includes(label)) &&
	presentForbiddenCopyFragments.length === 0;

console.log(JSON.stringify({
	ok,
	date: today.date,
	activeVenueCount: activeVenueResults.length,
	canonicalFixtureCount: canonicalFixtureResults.length,
	failedCanonicalFixtures,
	failedActiveVenues,
	displayLabels,
	presentForbiddenCopyFragments,
}, null, 2));

if (!ok) process.exitCode = 1;
