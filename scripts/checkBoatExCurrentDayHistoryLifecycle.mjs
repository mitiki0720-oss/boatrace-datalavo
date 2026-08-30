import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	evaluateBoatExCurrentDayHistoryRefresh,
	summarizeBoatExCurrentOfficialLifecycle,
	summarizeBoatExHistoryLifecycle,
} from "./boatExCurrentDayHistoryLifecycle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const readIfExists = (relativePath) => fs.existsSync(path.join(root, relativePath)) ? read(relativePath) : null;
const sourceText = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8").replace(/\r\n/g, "\n");

const date = "2026-08-30";
const racers = Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1 }));
const exhibitions = Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, exhibitionTime: `6.${70 + index}` }));
const officialRace = ({ settled = false, withPayout = false, withExhibition = false } = {}) => ({
	raceNo: 1,
	racers,
	exhibitions: withExhibition ? exhibitions : [],
	result: settled ? {
		finishOrder: [1, 2, 3],
		payout3tan: withPayout ? { combination: "1-2-3", payout: "1,230円" } : undefined,
		finalizedAt: "2026-08-30T20:00:00+09:00",
	} : { finishOrder: [] },
});
const officialSource = (options = {}) => ({
	date: options.date ?? date,
	generatedAt: "2026-08-30T20:05:00+09:00",
	venues: [{ venueCode: "01", races: [officialRace(options)] }],
});
const historyRecord = ({ settled = false, withPayout = false, withExhibition = false } = {}) => ({
	date,
	venueCode: "01",
	raceNo: 1,
	officialRace: { racers },
	officialResult: settled ? {
		finishOrder: [1, 2, 3],
		payout: withPayout ? [{ betType: "3連単", combination: "1-2-3", payoutYen: "1,230円" }] : [],
	} : undefined,
	officialExhibition: withExhibition ? { entries: exhibitions } : undefined,
	coverage: {
		officialRace: "complete",
		officialResult: settled ? "complete" : "pending",
		officialExhibition: withExhibition ? "complete" : "pending",
	},
});
const history = (options = {}) => ({
	date: options.date ?? date,
	generatedAt: "2026-08-30T08:00:00+09:00",
	records: [historyRecord(options)],
});

// A: a current-day pre-race source can create missing history without inventing a result.
const morning = evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: date,
	existingHistory: null,
	currentOfficialSource: officialSource(),
});
assert.equal(morning.shouldRefresh, true);
assert.equal(morning.reason, "history-missing");
assert.equal(morning.official.resultAvailableRaceCount, 0);
assert.equal(morning.official.payoutAvailableRaceCount, 0);

// B: result and payout progression on the same date requires a current-day refresh.
const night = evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: date,
	existingHistory: history(),
	currentOfficialSource: officialSource({ settled: true, withPayout: true, withExhibition: true }),
});
assert.equal(night.shouldRefresh, true);
assert.ok(night.reasons.includes("resultAvailableRaceCount-increased"));
assert.ok(night.reasons.includes("payoutAvailableRaceCount-increased"));

// C: identical settled lifecycle does not trigger another rewrite.
const unchanged = evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: date,
	existingHistory: history({ settled: true, withPayout: true, withExhibition: true }),
	currentOfficialSource: officialSource({ settled: true, withPayout: true, withExhibition: true }),
});
assert.equal(unchanged.shouldRefresh, false);
assert.equal(unchanged.reason, "lifecycle-not-advanced");

// D/E: today's source is never applied to another explicit history date.
const pastDate = evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: "2026-08-29",
	existingHistory: { ...history(), date: "2026-08-29" },
	currentOfficialSource: officialSource({ settled: true, withPayout: true }),
});
assert.equal(pastDate.shouldRefresh, false);
assert.equal(pastDate.reason, "current-source-date-mismatch");
const mismatchedSource = evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: date,
	existingHistory: history(),
	currentOfficialSource: officialSource({ date: "2026-08-31", settled: true, withPayout: true }),
});
assert.equal(mismatchedSource.shouldRefresh, false);

// F: a temporarily incomplete current source cannot shrink existing history.
const smallerSource = evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: date,
	existingHistory: { ...history(), records: [historyRecord(), historyRecord()] },
	currentOfficialSource: officialSource({ settled: true, withPayout: true }),
});
assert.equal(smallerSource.shouldRefresh, false);
assert.equal(smallerSource.reason, "current-source-race-coverage-smaller");

// Missing source facts remain zero; the lifecycle helper never fabricates them.
const insufficientOfficial = summarizeBoatExCurrentOfficialLifecycle(officialSource(), date);
const insufficientHistory = summarizeBoatExHistoryLifecycle(history(), date);
assert.equal(insufficientOfficial.resultAvailableRaceCount, 0);
assert.equal(insufficientOfficial.payoutAvailableRaceCount, 0);
assert.equal(insufficientHistory.resultAvailableRaceCount, 0);
assert.equal(insufficientHistory.payoutAvailableRaceCount, 0);

const workflow = sourceText(".github/workflows/update-boat-data.yml");
const daily = sourceText("scripts/generateBoatExDaily.mjs");
const checks = {
	morningHistoryCreation: morning.shouldRefresh && morning.official.resultAvailableRaceCount === 0,
	nightLifecycleRefresh: night.shouldRefresh && night.official.resultAvailableRaceCount === 1 && night.history.resultAvailableRaceCount === 0,
	unchangedLifecycleNoRefresh: !unchanged.shouldRefresh,
	pastDateProtected: !pastDate.shouldRefresh,
	targetDateMismatchProtected: !mismatchedSource.shouldRefresh,
	smallerSourceProtected: !smallerSource.shouldRefresh,
	noFakeResultOrPayout: insufficientOfficial.resultAvailableRaceCount === 0 && insufficientOfficial.payoutAvailableRaceCount === 0,
	dailyLifecycleWiring:
		daily.includes("evaluateBoatExCurrentDayHistoryRefresh") &&
		daily.includes("lifecycleRefresh.shouldRefresh") &&
		daily.includes('"refreshed-lifecycle"'),
	postResultSchedule:
		workflow.includes('- cron: "30 14 * * *"') &&
		workflow.includes('if [ "$EVENT_SCHEDULE" = "30 14 * * *" ]') &&
		workflow.includes('MODE="final"'),
};

const currentSource = readIfExists("public/data/boatrace/today-race-details.generated.json");
const currentDate = String(currentSource?.date ?? "");
const currentHistory = currentDate ? readIfExists(`public/data/boatrace-ex/history/races/${currentDate}.json`) : null;
const currentAudit = currentDate ? evaluateBoatExCurrentDayHistoryRefresh({
	targetDate: currentDate,
	existingHistory: currentHistory,
	currentOfficialSource: currentSource,
}) : null;
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, fixtures: { morning, night, unchanged, pastDate, mismatchedSource, smallerSource }, currentAudit }, null, 2));
if (!ok) process.exitCode = 1;
