import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { detectMidnightVenues } from "./updateBoatMidnightVenues.mjs";

const repoRoot = process.cwd();
const targetDate = process.argv[2] ?? new Intl.DateTimeFormat("sv-SE", {
	timeZone: "Asia/Tokyo",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
}).format(new Date());
const auditPath = process.env.BOAT_MIDNIGHT_AUDIT_PATH
	? path.resolve(repoRoot, process.env.BOAT_MIDNIGHT_AUDIT_PATH)
	: path.join(repoRoot, "public", "data", "boatrace", "audit", `midnight-venue-update-${targetDate}.generated.json`);

const explicitFixture = {
	date: "2026-08-11",
	venues: [{ venueCode: "99", venueName: "fixture", title: "ミッドナイト開催", races: [{ deadlineTime: "20:00" }] }],
};
const lateClosingFixture = {
	date: "2026-08-11",
	venues: [{ venueCode: "98", venueName: "fixture", title: "通常開催", races: [{ deadlineTime: "21:05" }] }],
};
const noMidnightFixture = {
	date: "2026-08-11",
	venues: [{ venueCode: "97", venueName: "fixture", title: "通常開催", races: [{ deadlineTime: "20:59" }] }],
};

assert.equal(detectMidnightVenues(explicitFixture).detectedVenues[0]?.detection, "explicit-label");
assert.equal(detectMidnightVenues(lateClosingFixture).detectedVenues[0]?.detection, "late-closing-fallback");
assert.equal(detectMidnightVenues(noMidnightFixture).detectedVenues.length, 0, "venues before 21:00 JST must be a no-op");

if (!fs.existsSync(auditPath)) {
	console.log(`[check:boat-midnight-venue-update] detector fixtures passed; audit not found: ${auditPath}`);
	process.exit(0);
}

const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
assert.equal(audit.targetDate, targetDate, "audit targetDate must match requested date");
assert.ok(Array.isArray(audit.detection?.venues), "audit must contain detected venues");
assert.ok(Array.isArray(audit.detection?.skippedVenues), "audit must contain skipped venues");
assert.equal(audit.detection.count, audit.detection.venues.length, "detected venue count must match venue list");
for (const venue of audit.detection.venues) {
	assert.ok(venue.venueCode, "detected venue must have a source-backed venue code");
	assert.ok(venue.venueName, "detected venue must have a source-backed venue name");
	assert.ok(["explicit-label", "late-closing-fallback"].includes(venue.detection), "detection method must be explicit");
	if (venue.detection === "late-closing-fallback") {
		assert.ok(venue.latestClosingMinutes >= 21 * 60, "late-closing fallback must require 21:00 JST or later");
	}
}
if (audit.detection.count === 0) {
	assert.equal(audit.result?.status, "no-midnight-venues", "no detection must finish as a successful no-op");
	assert.deepEqual(audit.updatedDataFiles, [], "no-op must not report generated data updates");
}

console.log(JSON.stringify({
	ok: true,
	targetDate,
	detectedVenueCount: audit.detection.count,
	result: audit.result?.status,
	auditPath: path.relative(repoRoot, auditPath).replaceAll("\\", "/"),
}, null, 2));
