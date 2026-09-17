import assert from "node:assert/strict";
import fs from "node:fs";

const { normalizeTargetSession, resolveOfficialVenueSession } = await import("./updateBoatTodayRaceDetails.mjs");
const { resolveOfficialScheduleSession } = await import("./updateBoatUpcomingSchedule.mjs");

const midnightTitle = "ミッドナイトボートレースｉｎ大村 ９";
assert.equal(resolveOfficialVenueSession({ title: midnightTitle, className: "is-day", explicitSession: "day" }), "midnight");
assert.equal(resolveOfficialVenueSession({ title: "一般競走", className: "is-nighter", explicitSession: "night" }), "night");
assert.equal(normalizeTargetSession("midnight"), "midnight");
assert.equal(normalizeTargetSession("summer"), "summer");
assert.equal(normalizeTargetSession("invalid"), "auto");
assert.deepEqual(
	resolveOfficialScheduleSession({ seriesName: midnightTitle, todaySession: "Day", venueSession: "Night" }),
	{ session: "Midnight", sessionType: "ミッドナイト" },
);
assert.deepEqual(
	resolveOfficialScheduleSession({ seriesName: "一般競走", todaySession: "Night", venueSession: "Night" }),
	{ session: "Night", sessionType: "ナイター" },
);

const today = JSON.parse(fs.readFileSync("public/data/boatrace/today.generated.json", "utf8").replace(/^\uFEFF/, ""));
const omura = (today.venues ?? []).find((venue) => String(venue.venueCode ?? "").padStart(2, "0") === "24");
const productionAuditApplies = today.date === "2026-09-17";
if (productionAuditApplies) {
	assert.ok(omura, "2026-09-17 current feed should contain Omura");
	assert.match(String(omura.title ?? ""), /ミッドナイト/u);
	assert.equal(resolveOfficialVenueSession({ title: omura.title, explicitSession: omura.session }), "midnight");
}

console.log(JSON.stringify({
	ok: true,
	date: today.date,
	productionAuditApplies,
	omura: omura ? {
		title: omura.title,
		rawSession: omura.session,
		resolvedSession: resolveOfficialVenueSession({ title: omura.title, explicitSession: omura.session }),
	} : null,
	normalOmuraNightFixture: "night",
}, null, 2));
