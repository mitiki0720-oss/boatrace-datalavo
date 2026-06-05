import assert from "node:assert/strict";
import fs from "node:fs";

const VENUE_EXTRAS_PATH = "public/data/boatrace/venue-extras.generated.json";
const RACES_PAGE_PATH = "src/pages/RacesPage.tsx";
const MATERIAL_PATH = "src/lib/boatPredictionMaterial.ts";
const REVIEW_PAGE_PATH = "src/pages/ReviewPage.tsx";

function readJson(path) {
	return JSON.parse(fs.readFileSync(path, "utf8"));
}

function toArray(value) {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") return Object.values(value);
	return [];
}

function readStatus(value) {
	return String(value ?? "").trim().toLowerCase();
}

function venueCode(value) {
	return String(value ?? "").padStart(2, "0");
}

function countRows(races, selector) {
	return races.reduce((total, race) => total + toArray(race?.originalExhibition).filter(selector).length, 0);
}

function classifyVenue(venue) {
	const races = toArray(venue?.races);
	const rows = countRows(races, () => true);
	const lap = countRows(races, (row) => Boolean(row.oneLapTime || row.lapTime || row.oneRoundTime || row.halfLapTime));
	const turn = countRows(races, (row) => Boolean(row.turnTime || row.mawariashi));
	const straight = countRows(races, (row) => Boolean(row.straightTime));
	const sourceStatus = venue?.sourceStatus ?? {};
	const originalStatus = readStatus(sourceStatus.originalExhibition);

	let classification = "not-supported";
	if (venue?.officialVenueExtrasSupported === true) {
		if (rows > 0 && (lap > 0 || turn > 0 || straight > 0)) {
			classification = "available";
		} else if (rows > 0) {
			classification = ["not-supported", "parse-empty", "http-error", "not-published", "preserved"].includes(originalStatus)
				? originalStatus
				: "pending";
		} else if (originalStatus) {
			classification = originalStatus;
		} else {
			classification = "pending";
		}
	}

	return {
		venueCode: venueCode(venue?.venueCode),
		venueName: venue?.venueName ?? "-",
		dedicatedParserKey: venue?.dedicatedParserKey ?? "",
		raceCount: races.length,
		originalRows: rows,
		lapTimeCount: lap,
		turnTimeCount: turn,
		straightTimeCount: straight,
		sourceStatus: originalStatus || "-",
		classification,
	};
}

const feed = readJson(VENUE_EXTRAS_PATH);
const venues = toArray(feed.venues);
const activeSupported = venues.filter((venue) => venue?.officialVenueExtrasSupported === true);
assert.ok(activeSupported.length > 0, "active feed should include venue-official supported venues");

const rows = activeSupported.map(classifyVenue).sort((left, right) => left.venueCode.localeCompare(right.venueCode));

for (const row of rows) {
	assert.ok(row.dedicatedParserKey, `${row.venueCode} ${row.venueName}: supported venue should have dedicatedParserKey`);
	assert.ok(row.raceCount > 0, `${row.venueCode} ${row.venueName}: supported active venue should have races`);
	assert.notEqual(row.classification, "merge-missing", `${row.venueCode} ${row.venueName}: generated JSON should not lose parsed original exhibition rows`);
	console.log(
		[
			"[check:boat-venue-original-exhibition]",
			row.venueCode,
			row.venueName,
			`key=${row.dedicatedParserKey}`,
			`classification=${row.classification}`,
			`original=${row.originalRows}`,
			`lap=${row.lapTimeCount}`,
			`turn=${row.turnTimeCount}`,
			`straight=${row.straightTimeCount}`,
			`sourceStatus=${row.sourceStatus}`,
		].join(" "),
	);
}

const byCode = new Map(rows.map((row) => [row.venueCode, row]));
assert.ok(["available", "pending"].includes(byCode.get("13")?.classification), "Amagasaki should distinguish pending original timing from unsupported venue");
assert.equal(byCode.get("13")?.straightTimeCount, 0, "Amagasaki straight time should remain non-published");
assert.ok(["available", "pending"].includes(byCode.get("17")?.classification), "Miyajima should be venue-official classified separately from common official data");
assert.ok(["available", "pending"].includes(byCode.get("03")?.classification), "Edogawa should be audited even when optional original timing is absent");
assert.ok(["available", "pending"].includes(byCode.get("20")?.classification), "Wakamatsu should be audited even when optional original timing is absent");

const racesPageSource = fs.readFileSync(RACES_PAGE_PATH, "utf8");
const materialSource = fs.readFileSync(MATERIAL_PATH, "utf8");
const reviewSource = fs.readFileSync(REVIEW_PAGE_PATH, "utf8");

assert.match(racesPageSource, /selectedOriginalExhibitionRows/, "RacesPage should read original exhibition rows");
assert.match(racesPageSource, /hasOriginalOneLapTimeData/, "RacesPage should gate one-lap display by actual data");
assert.match(racesPageSource, /hasOriginalTurnTimeData/, "RacesPage should gate turn display by actual data");
assert.match(racesPageSource, /hasOriginalStraightTimeData/, "RacesPage should gate straight display by actual data");
assert.match(materialSource, /buildOriginalExhibitionBlock/, "GPT material should include original exhibition block builder");
assert.match(materialSource, /raceExtra\?\.originalExhibition/, "GPT material should read raceExtra original exhibition rows");
assert.match(reviewSource, /raceExtra\.originalExhibition/, "Review copy should merge original exhibition rows");

console.log("[check:boat-venue-original-exhibition] passed");
