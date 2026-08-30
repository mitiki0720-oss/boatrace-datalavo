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
  getBoatMobileFirstRaceTime,
  isSameBoatMobileRace,
  mergeBoatMobilePredictionSources,
  resolveBoatMobileVenueSession,
  sortBoatMobileVenues,
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
const race = (raceNo, finishOrder, payout, finalizedAt = "") => ({
  raceNo,
  deadlineTime: `${String(8 + raceNo).padStart(2, "0")}:00`,
  status: finishOrder ? "finished" : "scheduled",
  result: finishOrder ? {
    status: "confirmed",
    finishOrder: finishOrder.split("-"),
    finalizedAt,
    payouts: [{ type: "3連単", combination: finishOrder, payout }],
  } : { status: "pending" },
});

// A: pending predictions are plans, not settled losses.
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
assert.equal(pendingSummary.officialRaceCount, 50);
assert.equal(pendingSummary.savedRaceCount, 50);
assert.equal(pendingSummary.officialResultCount, 0);
assert.equal(pendingSummary.settledPredictionRaceCount, 0);
assert.equal(pendingSummary.investment, undefined);
assert.equal(pendingSummary.payout, undefined);
assert.equal(pendingSummary.profit, undefined);
assert.equal(pendingSummary.hitRate, undefined);
assert.equal(pendingSummary.roi, undefined);

// B: official results plus saved predictions produce settled facts.
const settledFeed = {
  date,
  venues: [{
    venueCode: "01",
    venueName: "桐生",
    races: [
      race(1, "1-2-3", 800, "2026-08-30T10:00:00+09:00"),
      race(2, "3-2-1", 1200, "2026-08-30T11:00:00+09:00"),
      race(3, "6-5-4", 900, "2026-08-30T12:00:00+09:00"),
    ],
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
    officialRaceCount: settledSummary.officialRaceCount,
    savedRaceCount: settledSummary.savedRaceCount,
    officialResultCount: settledSummary.officialResultCount,
    settledPredictionRaceCount: settledSummary.settledPredictionRaceCount,
    hitCount: settledSummary.hitCount,
    investment: settledSummary.investment,
    payout: settledSummary.payout,
    profit: settledSummary.profit,
  },
  { officialRaceCount: 3, savedRaceCount: 3, officialResultCount: 3, settledPredictionRaceCount: 3, hitCount: 2, investment: 300, payout: 2000, profit: 1700 },
);

// C/P: duplicate hit rows collapse after newest-first ordering.
const hitLog = buildBoatMobileHitLog([
  ...settledResults,
  { ...settledResults[0], resultTimestamp: "2026-08-30T10:05:00+09:00" },
  settledResults[1],
], date);
assert.equal(hitLog.length, 2);
assert.deepEqual(hitLog.map((item) => item.raceNo), [2, 1]);
assert.equal(hitLog[1].resultTimestamp, "2026-08-30T10:05:00+09:00");

// E/Q/R: source priority and strict stable identity matching.
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
const codeConflictMerged = mergeBoatMobilePredictionSources(
  [{ ...publicRecord, venueCode: "01", venueName: "同名会場" }],
  [{ ...localRecord, venueCode: "02", venueName: "同名会場" }],
  [],
  [],
);
assert.equal(canonicalCodeMerged.length, 1);
assert.equal(codeConflictMerged.length, 2);
assert.equal(isSameBoatMobileRace(
  { date, venueCode: "01", venueName: "同名会場", raceNo: 1 },
  { date, venueCode: "02", venueName: "同名会場", raceNo: 1 },
), false);
assert.equal(isSameBoatMobileRace(
  { date, venueCode: "", venueName: "桐生競艇場", raceNo: "01R" },
  { date, venueCode: "01", venueName: "桐生", raceNo: 1 },
), true);
assert.equal(isSameBoatMobileRace(
  { date, venueCode: "", venueName: "桐生", raceNo: 1 },
  { date, venueCode: "", venueName: "桐生競艇", raceNo: 1 },
), false);

// I/J/L/M: source session first, then source-backed first-race time.
const venueFixtures = [
  { venueCode: "03", venueName: "ナイター", session: "night", races: [{ raceNo: 1, deadlineTime: "15:00" }] },
  { venueCode: "22", venueName: "朝二番", session: "morning", races: [{ raceNo: 1, deadlineTime: "08:50" }] },
  { venueCode: "08", venueName: "デイ", session: "day", races: [{ raceNo: 1, deadlineTime: "11:00" }] },
  { venueCode: "21", venueName: "朝一番", session: "morning", races: [{ raceNo: 1, deadlineTime: "08:30" }] },
  { venueCode: "99", venueName: "不明", races: [{ raceNo: 1 }] },
];
const sortedVenues = sortBoatMobileVenues(venueFixtures);
assert.deepEqual(sortedVenues.map((venue) => venue.venueCode), ["21", "22", "08", "03", "99"]);
assert.deepEqual(sortedVenues.map(resolveBoatMobileVenueSession), ["morning", "morning", "day", "night", "unknown"]);
assert.deepEqual(sortedVenues.map(getBoatMobileFirstRaceTime), ["08:30", "08:50", "11:00", "15:00", ""]);

// S: structured tickets win; text-only parsing is wired through the formal parser in MobilePage.
const structuredPriorityPrediction = {
  ...prediction("01", 1, "public-johnson", "1-2-3"),
  venueName: "桐生",
  predictionText: "3連単\n6-5-4 100円",
};
const structuredPriorityResult = buildBoatMobileAutoResultRecords(
  { date, venues: [{ venueCode: "01", venueName: "桐生", races: [race(1, "1-2-3", 800)] }] },
  [structuredPriorityPrediction],
  [],
)[0];
assert.equal(structuredPriorityResult.isHit, true);
assert.equal(structuredPriorityResult.hitBetNumbers, "1-2-3");

const summaryStart = pageSource.indexOf('id="mobile-summary"');
const summaryEnd = pageSource.indexOf('id="mobile-hit-log"');
const summarySource = pageSource.slice(summaryStart, summaryEnd);
const summaryLabels = Array.from(summarySource.matchAll(/<StatBox label="([^"]+)"/g), (match) => match[1]);
const expectedSummaryLabels = ["開催", "総レース", "結果", "保存予想", "的中", "収支", "的中率", "回収率"];

const checks = {
  A_pendingSummary: pendingSummary.officialRaceCount === 50 && pendingSummary.savedRaceCount === 50 && pendingSummary.settledPredictionRaceCount === 0,
  B_settledSummary: settledSummary.officialResultCount === 3 && settledSummary.hitCount === 2,
  C_hitLogDedupe: hitLog.length === 2,
  D_venueTwoLevelNavigation:
    /useState<string \| null>\(null\)/.test(pageSource) &&
    /const selectedVenue = selectedVenueKey\s*\?/.test(pageSource) &&
    /← 会場一覧/.test(pageSource) &&
    /\{selectedVenue && \(/.test(pageSource) &&
    !/selectedVenueIndex/.test(pageSource),
  E_publicJohnsonPriority:
    priorityMerged[0]?.sourceType === "public-johnson" &&
    canonicalCodeMerged.length === 1 &&
    codeConflictMerged.length === 2,
  F_pendingResultDash:
    /if \(amount === undefined\) return "—";/.test(pageSource) &&
    /selectedRaceConfirmed \? selectedAutoResult\?\.investment : undefined/.test(pageSource) &&
    /selectedRaceConfirmed \? selectedAutoResult\?\.payout : undefined/.test(pageSource),
  G_remoteRefreshWiring:
    /const refreshRemoteMobileData = async/.test(pageSource) &&
    /window\.setInterval\(refreshRemoteMobileData, MOBILE_REMOTE_REFRESH_INTERVAL_MS\)/.test(pageSource) &&
    /window\.clearInterval\(intervalId\)/.test(pageSource) &&
    /window\.addEventListener\("focus", handleFocus\)/.test(pageSource) &&
    /document\.visibilityState === "visible"/.test(pageSource) &&
    /loadTodayFeed\(\)/.test(pageSource) &&
    /loadVenueExtras\(\)/.test(pageSource) &&
    /loadPublicJohnsonPredictionRecords\(\)/.test(pageSource),
  H_productionJsonUnchanged: false,
  I_sessionSort: sortedVenues.map(resolveBoatMobileVenueSession).join(",") === "morning,morning,day,night,unknown",
  J_firstRaceTimeSort: sortedVenues.map((venue) => venue.venueCode).join(",") === "21,22,08,03,99",
  K_exactEightSummaryMetrics:
    JSON.stringify(summaryLabels) === JSON.stringify(expectedSummaryLabels) &&
    /gridTemplateColumns: "repeat\(2, minmax\(0,1fr\)\)"/.test(summarySource),
  L_venueCardSession: /formatVenueSessionLabel\(venue\)/.test(pageSource) && /formatVenueSessionLabel\(selectedVenue\)/.test(pageSource),
  M_venueCardFirstTime: /formatVenueFirstRaceTime\(venue\)/.test(pageSource) && /formatVenueFirstRaceTime\(selectedVenue\)/.test(pageSource),
  N_pageFloatingNav:
    ["mobile-summary", "mobile-hit-log", "mobile-today-races", "mobile-race-panel"].every((id) => pageSource.includes(id)) &&
    ["Summary", "Hit", "Venues", "Race"].every((label) => pageSource.includes(`label: "${label}"`)) &&
    /if \(target === "venues"\) setSelectedVenueKey\(null\)/.test(pageSource),
  O_raceTabsPreserved:
    [["entry", "出走"], ["prediction", "予想"], ["result", "結果"], ["info", "情報"]]
      .every(([key, label]) => pageSource.includes(`["${key}", "${label}"]`)),
  P_latestHitFirst: hitLog.map((item) => item.raceNo).join(",") === "2,1",
  Q_venueCodeConflictDetailLookup: codeConflictMerged.length === 2,
  R_noFuzzyIdentityMatch:
    !/levenshtein|similarity|fuzzy/i.test(helperSource) &&
    !isSameBoatMobileRace(
      { date, venueCode: "", venueName: "桐生", raceNo: 1 },
      { date, venueCode: "", venueName: "桐生競艇", raceNo: 1 },
    ),
  S_formalParserAndStructuredPriority:
    structuredPriorityResult.isHit === true &&
    /const structuredTickets = asArray\(record\.parsedBets \?\? record\.tickets\)/.test(pageSource) &&
    /if \(structuredTickets\.length > 0\) return record;/.test(pageSource) &&
    /parseBoatBets\(readString\(record\.predictionText \?\? record\.johnsonText\)\)/.test(pageSource) &&
    /parsedBets: parsed\.bets/.test(pageSource) &&
    !/matchAll\(/.test(helperSource),
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
checks.H_productionJsonUnchanged = productionDiff.status === 0;
const productionFeed = JSON.parse(fs.readFileSync(path.join(root, protectedProductionPaths[0]), "utf8"));
const productionJohnson = JSON.parse(fs.readFileSync(path.join(root, protectedProductionPaths[3]), "utf8"));
const productionPredictions = mergeBoatMobilePredictionSources(productionJohnson.records ?? [], [], [], []);
const productionResults = buildBoatMobileAutoResultRecords(productionFeed, productionPredictions, []);
const productionSummary = buildBoatMobileTodaySummary(productionResults, productionFeed.date);
checks.H_productionAggregation =
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
    latestHitOrder: hitLog.map((item) => ({ raceNo: item.raceNo, resultTimestamp: item.resultTimestamp })),
    sourcePriority: priorityMerged[0]?.sourceType,
    venueCodeConflictCount: codeConflictMerged.length,
    sortedVenues: sortedVenues.map((venue) => ({
      venueCode: venue.venueCode,
      session: resolveBoatMobileVenueSession(venue),
      firstRaceTime: getBoatMobileFirstRaceTime(venue),
    })),
    summaryLabels,
  },
  productionSummary,
  productionJsonPaths: protectedProductionPaths,
}, null, 2));

if (!ok) process.exitCode = 1;
