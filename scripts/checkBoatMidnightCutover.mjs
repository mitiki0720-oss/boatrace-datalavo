import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const tempDir = path.join(repoRoot, "node_modules", ".cache", `boat-midnight-cutover-check-${process.pid}`);

function writeModule(relativePath) {
	const outputPath = path.join(tempDir, path.basename(relativePath).replace(/\.ts$/, ".mjs"));
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });

	if (relativePath.endsWith(path.join("src", "lib", "assetPath.ts"))) {
		fs.writeFileSync(outputPath, "export function withBasePath(path) { return '/' + String(path || '').replace(/^\\/+/, ''); }\n");
		return outputPath;
	}

	const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
	const transpiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
			jsx: ts.JsxEmit.ReactJSX,
		},
	}).outputText.replace(/from "(\.\/[^"]+)"/g, 'from "$1.mjs"');

	fs.writeFileSync(outputPath, transpiled);
	return outputPath;
}

async function importTsModules(relativePaths, entryPath) {
	for (const relativePath of relativePaths) {
		writeModule(relativePath);
	}
	return import(`file://${writeModule(entryPath).replace(/\\/g, "/")}`);
}

const operationDate = await importTsModules([
	path.join("src", "lib", "boatOperationDate.ts"),
], path.join("src", "lib", "boatOperationDate.ts"));

const boatDataFeed = await importTsModules([
	path.join("src", "lib", "assetPath.ts"),
	path.join("src", "lib", "boatOperationDate.ts"),
	path.join("src", "lib", "boatDataFeed.ts"),
], path.join("src", "lib", "boatDataFeed.ts"));

const venueExtrasFeed = await importTsModules([
	path.join("src", "lib", "assetPath.ts"),
	path.join("src", "lib", "boatOperationDate.ts"),
	path.join("src", "lib", "boatVenueExtrasFeed.ts"),
], path.join("src", "lib", "boatVenueExtrasFeed.ts"));

const pruneModule = await importTsModules([
	path.join("src", "lib", "boatBetParser.ts"),
	path.join("src", "lib", "boatPredictionParser.ts"),
	path.join("src", "lib", "boatReviewArchive.ts"),
	path.join("src", "lib", "boatOperationDate.ts"),
	path.join("src", "lib", "boatPredictionStorage.ts"),
	path.join("src", "lib", "boatPracticeResultStorage.ts"),
	path.join("src", "lib", "boatJohnsonPredictionStorage.ts"),
	path.join("src", "lib", "boatOperationalStoragePrune.ts"),
], path.join("src", "lib", "boatOperationalStoragePrune.ts"));

const { getBoatOperationDate, shiftBoatOperationDate } = operationDate;
const { BOAT_TODAY_WAITING_MESSAGE_LINES, createBoatTodayWaitingFeed, isBoatTodayFeedForActiveDate } = boatDataFeed;
const { isBoatVenueExtrasFeedForActiveDate } = venueExtrasFeed;
const { pruneBoatRecordMapByOperationalDate } = pruneModule;

assert.equal(getBoatOperationDate(new Date("2026-06-04T14:59:00.000Z")), "2026-06-04", "23:59 JST should keep same-day active races");
assert.equal(getBoatOperationDate(new Date("2026-06-04T15:00:00.000Z")), "2026-06-05", "00:00 JST should switch active races to the new date");

const previousDayFeed = { date: "2026-06-04", generatedAt: "2026-06-04T23:58:00+09:00", venues: [{ id: "old", venueName: "old", date: "2026-06-04", races: [] }] };
const currentDayFeed = { date: "2026-06-05", generatedAt: "2026-06-05T00:06:00+09:00", venues: [{ id: "new", venueName: "new", date: "2026-06-05", races: [] }] };
assert.equal(isBoatTodayFeedForActiveDate(previousDayFeed, "2026-06-04"), true, "23:59 JST with same-day feed should be visible");
assert.equal(isBoatTodayFeedForActiveDate(previousDayFeed, "2026-06-05"), false, "00:00 JST with previous-day feed should be stale and hidden");
assert.equal(isBoatTodayFeedForActiveDate(currentDayFeed, "2026-06-05"), true, "00:00 JST with current-day feed should be visible");

assert.equal(isBoatVenueExtrasFeedForActiveDate({ date: "2026-06-04", venues: [] }, "2026-06-05"), false, "venue extras should reject stale previous-day data");
assert.equal(isBoatVenueExtrasFeedForActiveDate({ date: "2026-06-05", venues: [] }, "2026-06-05"), true, "venue extras should allow current-day data");

const waitingFeed = createBoatTodayWaitingFeed("2026-06-05");
assert.deepEqual(waitingFeed.venues, [], "waiting feed should hide race and venue cards");
assert.deepEqual([...BOAT_TODAY_WAITING_MESSAGE_LINES], [
	"本日のレースデータを取得中です",
	"日付切替後の最新開催情報を反映しています。",
	"少し時間を置いて再読み込みしてください。",
], "waiting message should match the requested copy");

const previousDate = shiftBoatOperationDate("2026-06-05", -1);
const pruned = pruneBoatRecordMapByOperationalDate({
	old: { date: "2026-06-03" },
	previous: { date: previousDate },
	current: { date: "2026-06-05" },
}, {
	activeDate: "2026-06-05",
	previousDate,
	archiveVerifiedDates: ["2026-06-03"],
	label: "cutover",
});
assert.deepEqual(Object.keys(pruned.records).sort(), ["current", "previous"], "localStorage prune should keep current and previous dates only");
assert.equal(pruned.removedCount, 1, "localStorage prune should remove 2+ day old active records after archive verification");

const browserWarnings = [];
const browserPruned = pruneBoatRecordMapByOperationalDate({
	current: { date: "2026-06-06" },
	previous: { date: "2026-06-05" },
	archivedOld: { date: "2026-06-04" },
	unarchivedOld: { date: "2026-06-03" },
}, {
	activeDate: "2026-06-06",
	previousDate: "2026-06-05",
	archiveVerifiedDates: ["2026-06-04"],
	label: "browser",
	warnings: browserWarnings,
});
assert.deepEqual(Object.keys(browserPruned.records).sort(), ["current", "previous", "unarchivedOld"], "browser prune should delete only archived 2+ day old records");
assert.equal(browserPruned.removedCount, 1, "browser prune should remove the archived old record");
assert.ok(browserWarnings.some((warning) => warning.includes("keep unarchived date 2026-06-03")), "browser prune should warn for unverified archive dates");

const rolloverSource = fs.readFileSync(path.join(repoRoot, "scripts", "runBoatDailyRollover.mjs"), "utf8");
assert.match(rolloverSource, /archive verification failed/);
assert.match(rolloverSource, /preserve review records/);
assert.match(rolloverSource, /skip old record prune/);
assert.match(rolloverSource, /continue active feed refresh/);
assert.match(rolloverSource, /preserve review index/);
assert.ok(!rolloverSource.includes("throw new Error(`archive verification failed before pruning"), "archive verification failure should not stop active feed refresh");
assert.ok(rolloverSource.indexOf("continue active feed refresh") < rolloverSource.indexOf("await refreshActiveFeeds"), "archive failure should continue into active feed refresh");
assert.ok(rolloverSource.includes("filterJohnsonRecordsForVerifiedArchive"), "Johnson generated records should use archive-verified prune logic");

const reviewSource = fs.readFileSync(path.join(repoRoot, "src", "pages", "ReviewPage.tsx"), "utf8");
assert.match(reviewSource, /loadBoatReviewArchiveIndex/);
assert.match(reviewSource, /loadBoatReviewArchiveVenueFiles/);
assert.match(reviewSource, /selectedDate < operationalToday \? "archive"/);
assert.match(reviewSource, /new Set\(\[\.{3}liveDateSet, \.{3}archiveDateSet\]\)/);

const racesSource = fs.readFileSync(path.join(repoRoot, "src", "pages", "RacesPage.tsx"), "utf8");
const predictionSource = fs.readFileSync(path.join(repoRoot, "src", "pages", "PredictionPage.tsx"), "utf8");
const dashboardSource = fs.readFileSync(path.join(repoRoot, "src", "pages", "DashboardPage.tsx"), "utf8");
for (const source of [racesSource, predictionSource, dashboardSource]) {
	assert.match(source, /createBoatTodayWaitingFeed/);
	assert.match(source, /BOAT_TODAY_WAITING_MESSAGE_LINES/);
}

console.log("[check:boat-midnight-cutover] passed");
