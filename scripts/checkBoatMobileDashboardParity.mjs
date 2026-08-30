import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import ts from "typescript";

const root = process.cwd();
const helperPath = path.join(root, "src/lib/boatMobileResultAggregation.ts");
const pagePath = path.join(root, "src/pages/MobilePage.tsx");
const helperSource = fs.readFileSync(helperPath, "utf8").replace(/\r\n/g, "\n");
const pageSource = fs.readFileSync(pagePath, "utf8").replace(/\r\n/g, "\n");
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);

const {
  buildBoatMobileAutoResultRecords,
  buildBoatMobileHitLog,
  buildBoatMobileTodaySummary,
  mergeBoatMobilePredictionSources,
} = module.exports;

const date = "2026-08-30";
const ticket = (combination, amountYen = 100) => ({ type: "trifecta", normalized: combination, amountYen });
const prediction = (venueCode, raceNo, sourceType = "prediction", combination = "1-2-3") => ({
  date,
  venueCode,
  venueName: `会場${venueCode}`,
  raceNo,
  sourceType,
  predictionText: `${combination}\n`,
  parsedBets: [ticket(combination)],
  totalStakeYen: 100,
});
const race = (raceNo, finishOrder, payout) => ({
  raceNo,
  status: finishOrder ? "finished" : "scheduled",
  result: finishOrder ? {
    status: "confirmed",
    finishOrder: finishOrder.split("-"),
    payouts: [{ type: "3連単", combination: finishOrder, payout }],
  } : { status: "pending" },
});

// A: pending predictions are saved plans, not settled losses.
const pendingFeed = {
  date,
  venues: Array.from({ length: 5 }, (_, venueIndex) => ({
    venueCode: String(venueIndex + 1).padStart(2, "0"),
    venueName: `会場${venueIndex + 1}`,
    races: Array.from({ length: 10 }, (_, raceIndex) => race(raceIndex + 1, "", 0)),
  })),
};
const pendingPredictions = pendingFeed.venues.flatMap((venue) =>
  venue.races.map((item) => prediction(venue.venueCode, item.raceNo)),
);
const pendingResults = buildBoatMobileAutoResultRecords(pendingFeed, pendingPredictions, []);
const pendingSummary = buildBoatMobileTodaySummary(pendingResults, date);
assert.equal(pendingSummary.savedRaceCount, 50);
assert.equal(pendingSummary.officialResultCount, 0);
assert.equal(pendingSummary.settledPredictionRaceCount, 0);
assert.equal(pendingSummary.investment, undefined);
assert.equal(pendingSummary.payout, undefined);
assert.equal(pendingSummary.profit, undefined);
assert.equal(pendingSummary.roi, undefined);

// B: official results plus saved predictions produce settled facts.
const settledFeed = {
  date,
  venues: [{
    venueCode: "01",
    venueName: "桐生",
    races: [race(1, "1-2-3", 800), race(2, "3-2-1", 1200), race(3, "6-5-4", 900)],
  }],
};
const settledPredictions = [
  { ...prediction("01", 1, "public-johnson", "1-2-3"), venueName: "桐生" },
  { ...prediction("01", 2, "public-johnson", "3-2-1"), venueName: "桐生" },
  { ...prediction("01", 3, "public-johnson", "1-2-3"), venueName: "桐生" },
];
const settledResults = buildBoatMobileAutoResultRecords(settledFeed, settledPredictions, []);
const settledSummary = buildBoatMobileTodaySummary(settledResults, date);
assert.deepEqual(
  {
    savedRaceCount: settledSummary.savedRaceCount,
    officialResultCount: settledSummary.officialResultCount,
    settledPredictionRaceCount: settledSummary.settledPredictionRaceCount,
    hitCount: settledSummary.hitCount,
    investment: settledSummary.investment,
    payout: settledSummary.payout,
    profit: settledSummary.profit,
  },
  { savedRaceCount: 3, officialResultCount: 3, settledPredictionRaceCount: 3, hitCount: 2, investment: 300, payout: 2000, profit: 1700 },
);

// C: duplicate official rows cannot duplicate hit ticker entries.
const duplicateHitLog = buildBoatMobileHitLog([...settledResults, settledResults[0], settledResults[1]], date);
assert.equal(duplicateHitLog.length, 2);
assert.deepEqual(duplicateHitLog.map((item) => item.raceNo), [1, 2]);

// E: source priority is fixed and venue-code conflicts never collapse by name.
const publicRecord = { ...prediction("01", 1, "public-johnson"), predictionText: "public" };
const localRecord = { ...prediction("01", 1, "johnson"), predictionText: "local" };
const normalRecord = { ...prediction("01", 1, "prediction"), predictionText: "normal" };
const practiceRecord = { ...prediction("01", 1, "practice"), predictionText: "practice" };
const priorityMerged = mergeBoatMobilePredictionSources([publicRecord], [localRecord], [normalRecord], [practiceRecord]);
assert.equal(priorityMerged.length, 1);
assert.equal(priorityMerged[0].sourceType, "public-johnson");
assert.equal(priorityMerged[0].predictionText, "public");
const canonicalCodeMerged = mergeBoatMobilePredictionSources(
  [{ ...publicRecord, venueCode: "01" }],
  [{ ...localRecord, venueCode: "1" }],
  [],
  [],
);
assert.equal(canonicalCodeMerged.length, 1);
const codeConflictMerged = mergeBoatMobilePredictionSources(
  [{ ...publicRecord, venueCode: "01", venueName: "同名会場" }],
  [{ ...localRecord, venueCode: "02", venueName: "同名会場" }],
  [],
  [],
);
assert.equal(codeConflictMerged.length, 2);

const checks = {
  pending50Predictions: pendingSummary.savedRaceCount === 50 && pendingSummary.settledPredictionRaceCount === 0,
  settledThreeRaces: settledSummary.officialResultCount === 3 && settledSummary.hitCount === 2,
  hitLogDedupe: duplicateHitLog.length === 2,
  venueTwoLevelNavigation:
    /useState<string \| null>\(null\)/.test(pageSource) &&
    /const selectedVenue = selectedVenueKey\s*\?/.test(pageSource) &&
    /会場一覧へ戻る/.test(pageSource) &&
    /\{selectedVenue && \(/.test(pageSource) &&
    !/selectedVenueIndex/.test(pageSource),
  publicJohnsonPriority:
    priorityMerged[0]?.sourceType === "public-johnson" &&
    canonicalCodeMerged.length === 1 &&
    codeConflictMerged.length === 2,
  pendingResultDash:
    /if \(amount === undefined\) return "—";/.test(pageSource) &&
    /selectedRaceConfirmed \? selectedAutoResult\?\.investment : undefined/.test(pageSource) &&
    /selectedRaceConfirmed \? selectedAutoResult\?\.payout : undefined/.test(pageSource) &&
    /label="実績投資"/.test(pageSource) &&
    /label="実績払戻"/.test(pageSource),
  remoteRefreshWiring:
    /const refreshRemoteMobileData = async/.test(pageSource) &&
    /window\.setInterval\(refreshRemoteMobileData, MOBILE_REMOTE_REFRESH_INTERVAL_MS\)/.test(pageSource) &&
    /window\.clearInterval\(intervalId\)/.test(pageSource) &&
    /window\.addEventListener\("focus", handleFocus\)/.test(pageSource) &&
    /document\.visibilityState === "visible"/.test(pageSource) &&
    /loadTodayFeed\(\)/.test(pageSource) &&
    /loadVenueExtras\(\)/.test(pageSource) &&
    /loadPublicJohnsonPredictionRecords\(\)/.test(pageSource),
};

const protectedProductionPaths = [
  "public/data/boatrace/today-race-details.generated.json",
  "public/data/boatrace/today.generated.json",
  "public/data/boatrace/venue-extras.generated.json",
  "public/data/boatrace/johnson-predictions.generated.json",
  "public/data/boatrace/reviews/index.json",
];
const productionDiff = spawnSync("git", ["diff", "--quiet", "HEAD", "--", ...protectedProductionPaths], {
  cwd: root,
  encoding: "utf8",
});
checks.productionJsonUnchanged = productionDiff.status === 0;
const productionFeed = JSON.parse(fs.readFileSync(path.join(root, protectedProductionPaths[0]), "utf8"));
const productionJohnson = JSON.parse(fs.readFileSync(path.join(root, protectedProductionPaths[3]), "utf8"));
const productionPredictions = mergeBoatMobilePredictionSources(productionJohnson.records ?? [], [], [], []);
const productionResults = buildBoatMobileAutoResultRecords(productionFeed, productionPredictions, []);
const productionSummary = buildBoatMobileTodaySummary(productionResults, productionFeed.date);
checks.productionAggregation =
  productionFeed.venues.length > 0 &&
  productionResults.length > 0 &&
  new Set(productionResults.map((record) => record.key)).size === productionResults.length &&
  productionSummary.savedRaceCount <= productionPredictions.length;

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  ok,
  checks,
  fixtures: {
    pending: pendingSummary,
    settled: settledSummary,
    hitLogCount: duplicateHitLog.length,
    publicPriority: priorityMerged[0]?.sourceType,
    venueCodeConflictCount: codeConflictMerged.length,
  },
  productionSummary,
  productionJsonPaths: protectedProductionPaths,
}, null, 2));

if (!ok) process.exitCode = 1;
