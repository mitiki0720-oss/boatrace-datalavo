import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const presentationPath = "src/lib/boatPredictionVenueCardPresentation.ts";
const componentPath = "src/components/boatrace/BoatPredictionVenueRaceChooser.tsx";
const typesPath = "src/lib/boatraceTypes.ts";
const updaterPath = "scripts/updateBoatTodayRaceDetails.mjs";

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
} = compileCommonJs(presentationPath);
const { resolveOfficialVenueEventStatus } = await import("./updateBoatTodayRaceDetails.mjs");

const officialFixtures = [
	{ statusText: "中止", expectedStatus: "cancelled", expectedLabel: "中止" },
	{ statusText: "12R以降中止", expectedStatus: "cancelled", expectedLabel: "中止" },
	{ statusText: "順延", expectedStatus: "postponed", expectedLabel: "順延" },
	{ statusText: "中止順延", expectedStatus: "postponed", expectedLabel: "順延" },
];

const propagationAudit = officialFixtures.map((fixture) => {
	const eventStatus = resolveOfficialVenueEventStatus({ statusText: fixture.statusText });
	const badge = getBoatPredictionVenueEventStatusBadge({
		eventStatus,
		eventStatusText: fixture.statusText,
	});
	assert.equal(eventStatus, fixture.expectedStatus);
	assert.equal(badge?.status, fixture.expectedStatus);
	assert.equal(badge?.label, fixture.expectedLabel);
	return {
		officialStatusText: fixture.statusText,
		eventStatus,
		label: badge?.label,
		source: badge?.source,
	};
});

const normalStatuses = ["", "-", "発売中", "全レース終了"];
for (const statusText of normalStatuses) {
	const eventStatus = resolveOfficialVenueEventStatus({ statusText });
	assert.equal(eventStatus, "normal");
	assert.equal(getBoatPredictionVenueEventStatusBadge({ eventStatus, eventStatusText: statusText }), null);
}

const legacyCancelled = getBoatPredictionVenueEventStatusBadge({ statusText: "荒天のため中止" });
const legacyPostponed = getBoatPredictionVenueEventStatusBadge({ statusText: "中止順延" });
assert.equal(legacyCancelled?.label, "中止");
assert.equal(legacyCancelled?.source, "official-status-text");
assert.equal(legacyPostponed?.label, "順延");
assert.equal(getBoatPredictionVenueEventStatusBadge({ statusText: "weather warning" }), null);

const cancelledBadge = getBoatPredictionVenueEventStatusBadge({ eventStatus: "cancelled" });
const postponedBadge = getBoatPredictionVenueEventStatusBadge({ eventStatus: "postponed" });
assert.notEqual(cancelledBadge?.background, postponedBadge?.background);
assert.notEqual(cancelledBadge?.border, postponedBadge?.border);

const sessionFixtures = ["morning", "summer", "day", "night", "midnight"];
assert.equal(new Set(sessionFixtures.map((session) => getBoatPredictionSessionTone(session).badgeBackground)).size, 5);
assert.deepEqual(
	["rookie", "all-ladies", "venus"].map((series) => getBoatPredictionVenueSeriesBadge({ series })?.label),
	["ルーキーシリーズ", "オールレディース", "ヴィーナスシリーズ"],
);

const sortFixtures = [
	{ venue: "early-normal", index: 0, session: "day", firstRaceMinutes: 600, venueName: "通常会場" },
	{ venue: "postponed", index: 1, session: "morning", firstRaceMinutes: 630, venueName: "順延会場" },
	{ venue: "cancelled", index: 2, session: "night", firstRaceMinutes: 660, venueName: "中止会場" },
	{ venue: "missing", index: 3, session: "day", firstRaceMinutes: null, venueName: "時刻未取得" },
];
assert.deepEqual(
	[...sortFixtures].sort(compareBoatPredictionVenueCards).map((item) => item.venue),
	["early-normal", "postponed", "cancelled", "missing"],
);

const updaterSource = fs.readFileSync(path.join(root, updaterPath), "utf8");
const componentSource = fs.readFileSync(path.join(root, componentPath), "utf8");
const typesSource = fs.readFileSync(path.join(root, typesPath), "utf8");
assert.match(updaterSource, /eventStatus: resolveOfficialVenueEventStatus\(\{ statusText \}\)/u);
assert.match(updaterSource, /eventStatusText: statusText/u);
assert.match(componentSource, /getBoatPredictionVenueEventStatusBadge\(venue\)/u);
assert.match(componentSource, /公式開催状態/u);
assert.match(componentSource, /flexWrap: "wrap"/u);
assert.match(typesSource, /export type BoatVenueEventStatus = "normal" \| "cancelled" \| "postponed";/u);

console.log(JSON.stringify({
	ok: true,
	checks: {
		officialCancelledPropagation: propagationAudit.slice(0, 2).every((item) => item.eventStatus === "cancelled" && item.label === "中止"),
		officialPostponedPropagation: propagationAudit.slice(2).every((item) => item.eventStatus === "postponed" && item.label === "順延"),
		normalVenueHasNoEventBadge: true,
		legacyOfficialStatusTextCompatibility: legacyCancelled?.label === "中止" && legacyPostponed?.label === "順延",
		distinctStatusColors: cancelledBadge?.background !== postponedBadge?.background,
		sessionPresentationPreserved: true,
		seriesPresentationPreserved: true,
		firstRaceTimeSortPreserved: true,
		responsiveWrapPreserved: true,
	},
	propagationAudit,
	statusColors: {
		cancelled: cancelledBadge,
		postponed: postponedBadge,
	},
}, null, 2));
