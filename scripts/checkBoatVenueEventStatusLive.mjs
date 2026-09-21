import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTodayIsoJst, resolveJstTargetDate } from "./boatRaceDate.mjs";
import {
	fetchOfficialVenueEventStatuses,
	parseOfficialVenueEventStatuses,
	resolveOfficialVenueEventStatus,
} from "./boatVenueEventStatus.mjs";
import { applyVenueEventStatusUpdates } from "./updateBoatVenueEventStatuses.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv = process.argv.slice(2)) {
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--target-date") options.targetDate = argv[++index];
		if (argv[index] === "--feed-dir") options.feedDir = argv[++index];
	}
	return options;
}

const fixtureHtml = `
<table><tbody>
<tr><td><img alt="戸田"></td><td>中止順延</td><td class="is-ippan"></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=02&hd=20260921">fixture</a></td></tr>
<tr><td><img alt="江戸川"></td><td>中止順延</td><td class="is-ippan"></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=03&hd=20260921">fixture</a></td></tr>
<tr><td><img alt="津"></td><td>5R以降中止順延</td><td class="is-ippan"></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=09&hd=20260921">fixture</a></td></tr>
<tr><td><img alt="常滑"></td><td>12R</td><td class="is-ippan"></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=08&hd=20260921">fixture</a></td></tr>
</tbody></table>`;

const fixtures = parseOfficialVenueEventStatuses(fixtureHtml, { date: "2026-09-21" });
assert.deepEqual(fixtures.map(({ venueCode, eventStatus, eventStatusText }) => ({ venueCode, eventStatus, eventStatusText })), [
	{ venueCode: "02", eventStatus: "postponed", eventStatusText: "中止順延" },
	{ venueCode: "03", eventStatus: "postponed", eventStatusText: "中止順延" },
	{ venueCode: "09", eventStatus: "cancelled", eventStatusText: "5R以降中止順延" },
	{ venueCode: "08", eventStatus: "normal", eventStatusText: "" },
]);
assert.equal(resolveOfficialVenueEventStatus({ statusText: "途中中止" }), "cancelled");
assert.equal(resolveOfficialVenueEventStatus({ statusText: "7R以降中止順延" }), "cancelled");

const sourceFeed = {
	date: "2026-09-21",
	generatedAt: "fixture",
	venues: [
		{ venueCode: "02", venueName: "戸田", eventStatus: "normal", eventStatusText: "", races: [{ raceNo: 1 }] },
		{ venueCode: "03", venueName: "江戸川", eventStatus: "normal", eventStatusText: "", races: [{ raceNo: 1 }] },
		{ venueCode: "09", venueName: "津", eventStatus: "normal", eventStatusText: "", races: [{ raceNo: 1 }] },
	],
};
const fixtureUpdate = applyVenueEventStatusUpdates(sourceFeed, fixtures, { targetDate: "2026-09-21" });
assert.equal(fixtureUpdate.changedVenues.length, 3);
assert.deepEqual(
	fixtureUpdate.feed.venues.map(({ venueCode, eventStatus, eventStatusText }) => ({ venueCode, eventStatus, eventStatusText })),
	[
		{ venueCode: "02", eventStatus: "postponed", eventStatusText: "中止順延" },
		{ venueCode: "03", eventStatus: "postponed", eventStatusText: "中止順延" },
		{ venueCode: "09", eventStatus: "cancelled", eventStatusText: "5R以降中止順延" },
	],
);
assert.deepEqual(
	fixtureUpdate.feed.venues.map(({ eventStatus: _status, eventStatusText: _text, ...venue }) => venue),
	sourceFeed.venues.map(({ eventStatus: _status, eventStatusText: _text, ...venue }) => venue),
	"lightweight refresh must not change non-status venue data",
);

const options = parseArgs();
const targetDate = resolveJstTargetDate(options.targetDate ?? getTodayIsoJst());
const heavyUpdaterSource = await readFile(path.join(projectRoot, "scripts/updateBoatTodayRaceDetails.mjs"), "utf8");
const lightweightUpdaterSource = await readFile(path.join(projectRoot, "scripts/updateBoatVenueEventStatuses.mjs"), "utf8");
const workflowSource = await readFile(path.join(projectRoot, ".github/workflows/update-boat-event-status.yml"), "utf8");
const componentSource = await readFile(path.join(projectRoot, "src/components/boatrace/BoatPredictionVenueRaceChooser.tsx"), "utf8");
assert.match(heavyUpdaterSource, /todayRaceIndex: \(dateKey\).*\?hd=\$\{dateKey\}/u);
assert.match(heavyUpdaterSource, /const statusCell = venueCell\.next\("td"\)/u);
assert.match(lightweightUpdaterSource, /return \{ \.\.\.venue, eventStatus, eventStatusText \}/u);
assert.match(workflowSource, /cron: "\*\/15 21-23 \* \* \*"/u);
assert.match(workflowSource, /cron: "\*\/15 0-12 \* \* \*"/u);
assert.match(workflowSource, /node scripts\/updateBoatVenueEventStatuses\.mjs/u);
assert.doesNotMatch(workflowSource, /node scripts\/updateBoatData\.mjs/u);
assert.match(workflowSource, /git add -- \\\s*\n\s+public\/data\/boatrace\/today\.generated\.json \\\s*\n\s+public\/data\/boatrace\/today-race-details\.generated\.json/u);
assert.match(componentSource, /公式発表/u);
const live = await fetchOfficialVenueEventStatuses({ targetDate });
const liveByCode = new Map(live.statuses.map((item) => [item.venueCode, item]));

if (targetDate === "2026-09-21") {
	assert.equal(liveByCode.get("02")?.eventStatus, "postponed", "戸田 must be postponed");
	assert.equal(liveByCode.get("03")?.eventStatus, "postponed", "江戸川 must be postponed");
	assert.equal(liveByCode.get("09")?.eventStatus, "cancelled", "津 partial cancellation must be cancelled");
	assert.match(liveByCode.get("02")?.rawStatusText ?? "", /順延/u);
	assert.match(liveByCode.get("03")?.rawStatusText ?? "", /順延/u);
	assert.match(liveByCode.get("09")?.rawStatusText ?? "", /中止/u);
}

const feedAudit = [];
if (options.feedDir) {
	const feedDir = path.resolve(projectRoot, options.feedDir);
	for (const fileName of ["today.generated.json", "today-race-details.generated.json"]) {
		const feed = JSON.parse((await readFile(path.join(feedDir, fileName), "utf8")).replace(/^\uFEFF/u, ""));
		assert.equal(feed.date, targetDate);
		const feedByCode = new Map((feed.venues ?? []).map((venue) => [String(venue.venueCode), venue]));
		for (const official of live.statuses) {
			const venue = feedByCode.get(official.venueCode);
			if (!venue) continue;
			assert.equal(venue.eventStatus ?? "normal", official.eventStatus, `${fileName}: ${official.venueName} status mismatch`);
			if (official.eventStatus !== "normal") {
				assert.equal(venue.eventStatusText ?? "", official.eventStatusText, `${fileName}: ${official.venueName} raw status mismatch`);
			}
		}
		feedAudit.push({ fileName, venueCount: feed.venues?.length ?? 0, statusMatch: true });
	}
}

const liveCases = ["02", "03", "09"].map((venueCode) => {
	const item = liveByCode.get(venueCode);
	return {
		venue: item?.venueName ?? venueCode,
		rawStatus: item?.rawStatusText ?? null,
		normalized: item?.eventStatus ?? null,
		uiLabel: item?.eventStatus === "postponed" ? "順延" : item?.eventStatus === "cancelled" ? "中止" : null,
	};
});

console.log(JSON.stringify({
	ok: true,
	targetDate,
	officialUrl: live.url,
	venueCount: live.statuses.length,
	checks: {
		venueCellAnchoredParser: true,
		explicitDateOfficialIndex: true,
		postponementWinsForWholeDayText: true,
		partialCancellationWinsOverPostponementSuffix: true,
		lightweightStatusOnlyUpdate: true,
		fifteenMinuteLightweightWorkflow: true,
		protectedExplicitStageAllowlist: true,
		rawStatusUiDetail: true,
		liveRequiredCases: targetDate !== "2026-09-21" || liveCases.every((item) => item.uiLabel),
		feedPropagation: !options.feedDir || feedAudit.every((item) => item.statusMatch),
	},
	liveCases,
	allNonNormalStatuses: live.statuses.filter((item) => item.eventStatus !== "normal"),
	feedAudit,
}, null, 2));
