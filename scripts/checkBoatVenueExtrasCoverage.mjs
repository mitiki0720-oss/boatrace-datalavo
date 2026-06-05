import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const venueExtrasPath = path.join(repoRoot, "public", "data", "boatrace", "venue-extras.generated.json");
const feed = JSON.parse(fs.readFileSync(venueExtrasPath, "utf8"));

const requiredStatuses = new Set([
	"available",
	"pending",
	"not-supported",
	"parse-empty",
	"http-error",
	"preserved",
]);

function findVenue(name) {
	return (feed.venues ?? []).find((venue) => venue.venueName === name);
}

function countRaceField(venue, key) {
	return (venue.races ?? []).filter((race) => {
		const value = race.sourceStatus?.[key];
		return typeof value === "string" && (value === "available" || value.startsWith("available-"));
	}).length;
}

function assertVenueMetadata(name) {
	const venue = findVenue(name);
	assert.ok(venue, `${name} should exist in venue extras feed`);
	assert.equal(venue.integrationMode, "venue-official", `${name} should be venue-official integration`);
	assert.equal(venue.officialVenueExtrasSupported, true, `${name} should be marked as supported by dedicated parser`);
	assert.ok(venue.dedicatedParserKey, `${name} should expose dedicatedParserKey`);
	assert.ok(venue.sourceStatus && typeof venue.sourceStatus === "object", `${name} should expose sourceStatus`);
	assert.ok(venue.coverage && typeof venue.coverage === "object", `${name} should expose coverage`);
	assert.ok(Array.isArray(venue.races), `${name} should expose race extras`);
	return venue;
}

for (const name of ["芦屋", "三国", "徳山", "常滑", "尼崎", "宮島", "江戸川", "若松", "下関", "桐生", "蒲郡"]) {
	assertVenueMetadata(name);
}

const amagasaki = findVenue("尼崎");
assert.equal(amagasaki.sourceStatus.originalExhibition, "available", "Amagasaki exhibition rows should be available");
assert.equal(amagasaki.sourceStatus.originalStraightTime, "not-supported", "Amagasaki straight time should be explicitly not-supported");
assert.ok(countRaceField(amagasaki, "officialBeforeInfo") > 0, "Amagasaki before info should be available on race rows");

const miyajima = findVenue("宮島");
assert.ok(countRaceField(miyajima, "officialBeforeInfo") > 0, "Miyajima before info should be available on race rows");
assert.equal(miyajima.sourceStatus.originalExhibition, "available", "Miyajima exhibition rows should be available");

const edogawa = findVenue("江戸川");
assert.equal(edogawa.sourceStatus.originalOneLapTime, "not-supported", "Edogawa one-lap time should be explicitly not-supported");
assert.equal(edogawa.sourceStatus.originalTurnTime, "not-supported", "Edogawa turn time should be explicitly not-supported");
assert.equal(edogawa.sourceStatus.originalStraightTime, "not-supported", "Edogawa straight time should be explicitly not-supported");

const ashiya = findVenue("芦屋");
assert.equal(ashiya.sourceStatus.originalOneLapTime, "available", "Ashiya one-lap time should be available");
assert.equal(ashiya.sourceStatus.originalTurnTime, "available", "Ashiya turn time should be available");
assert.equal(ashiya.sourceStatus.originalStraightTime, "available", "Ashiya straight time should be available");

for (const venue of feed.venues ?? []) {
	for (const [key, value] of Object.entries(venue.sourceStatus ?? {})) {
		const normalized = String(value);
		assert.ok(
			requiredStatuses.has(normalized) || normalized.startsWith("available-"),
			`${venue.venueName} sourceStatus.${key} should use a known status: ${normalized}`,
		);
	}

	for (const race of venue.races ?? []) {
		for (const [key, value] of Object.entries(race.sourceStatus ?? {})) {
			const normalized = String(value);
			assert.ok(
				requiredStatuses.has(normalized) || normalized.startsWith("available-"),
				`${venue.venueName} ${race.raceNo}R sourceStatus.${key} should use a known status: ${normalized}`,
			);
		}
	}
}

console.log("[check:boat-venue-extras-coverage] passed");
