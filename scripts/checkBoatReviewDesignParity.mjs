import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const helperPath = path.join(root, "src/lib/boatReviewPerformanceMetrics.ts");
const pagePath = path.join(root, "src/pages/ReviewPage.tsx");
const helperSource = fs.readFileSync(helperPath, "utf8").replace(/\r\n/g, "\n");
const pageSource = fs.readFileSync(pagePath, "utf8").replace(/\r\n/g, "\n");
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const resolveBoatPredictionOutcome = ({ race, bets, investmentAmount, parseStatus }) => {
  const result = race?.result;
  const settlement = {
    status: result?.status === "confirmed" ? "confirmed" : "pending",
    lookupStatus: result?.status === "confirmed" ? "matched" : "pending",
    finishOrderText: Array.isArray(result?.finishOrder) ? result.finishOrder.join("-") : "",
    payouts: [],
    hitBets: [],
    payoutYen: 0,
    profitYen: 0,
    roi: 0,
  };
  if (race?.status === "canceled" || result?.status === "unavailable") return { status: "cancelled", settlement };
  if (result?.refundText || result?.refunds) return { status: "refund", settlement };
  if (!bets.length || parseStatus === "invalid" || parseStatus === "missing-section") return { status: "parse-warning", settlement };
  if (result?.status !== "confirmed") return { status: "pending", settlement };
  const combination = result.finishOrder.join("-");
  const hit = bets.some((bet) => bet.normalized === combination);
  const payoutYen = hit ? Number(result.payoutYen ?? 0) : 0;
  return {
    status: hit ? "hit" : "miss",
    settlement: { ...settlement, hitBets: hit ? bets : [], payoutYen, profitYen: payoutYen - investmentAmount },
  };
};

const module = { exports: {} };
new Function("exports", "module", "require", compiled)(module.exports, module, (specifier) => {
  if (specifier === "./boatResultSettlement") return { resolveBoatPredictionOutcome };
  throw new Error(`Unexpected checker dependency: ${specifier}`);
});
const { buildBoatReviewPagePerformance, buildBoatReviewVenuePerformance } = module.exports;

const prediction = (raceNo, combination = "1-2-3") => ({
  raceKey: `2026-09-04:01:${raceNo}`,
  date: "2026-09-04",
  venueCode: "01",
  venueName: "桐生",
  raceNo,
  predictionText: "source-backed prediction",
  parsedBets: [{ type: "trifecta", normalized: combination, amountYen: 100 }],
  totalStakeYen: 100,
  parseStatus: "ready",
  savedAt: "2026-09-04T08:00:00+09:00",
});

// A: pending stake is not actual investment; refund is not a miss.
const live = {
  key: "2026-09-04:kiryu",
  date: "2026-09-04",
  venueName: "桐生",
  venueSlug: "kiryu",
  venueCode: "01",
  races: [
    { raceNo: 1, race: { raceNo: 1, result: { status: "pending" } }, prediction: prediction(1) },
    { raceNo: 2, race: { raceNo: 2, result: { status: "confirmed", finishOrder: ["1", "2", "3"], payoutYen: 700 } }, prediction: prediction(2) },
    { raceNo: 3, race: { raceNo: 3, result: { status: "confirmed", finishOrder: ["2", "1", "3"], refundText: "返還" } }, prediction: prediction(3) },
    { raceNo: 4, race: { raceNo: 4, status: "canceled", result: { status: "unavailable" } }, prediction: prediction(4) },
    { raceNo: 5, race: { raceNo: 5, result: { status: "confirmed", finishOrder: ["1", "3", "2"] } }, prediction: { ...prediction(5), parseStatus: "invalid" } },
  ],
};
const liveMetrics = buildBoatReviewVenuePerformance(live);
assert.equal(liveMetrics.pendingRaceCount, 1);
assert.equal(liveMetrics.refundCount, 1);
assert.equal(liveMetrics.cancelledCount, 1);
assert.equal(liveMetrics.parseWarningCount, 1);
assert.equal(liveMetrics.hitCount, 1);
assert.equal(liveMetrics.evaluatedRaceCount, 1);
assert.equal(liveMetrics.financialRaceCount, 1);
assert.equal(liveMetrics.investment, 100);
assert.equal(liveMetrics.payout, 700);
assert.equal(liveMetrics.profit, 600);

// B/C: archive readiness uses actual section race numbers, never file-exists => 12R.
const archive = {
  key: "2026-05-24:ashiya",
  date: "2026-05-24",
  venueName: "芦屋",
  venueSlug: "ashiya",
  races: Array.from({ length: 12 }, (_, index) => ({ raceNo: index + 1 })),
  predictionFileText: [
    "■ 芦屋 1R\n【保存済みGPT予想】\n予想あり",
    "■ 芦屋 4R\n【保存済みGPT予想】\n予想あり",
  ].join("\n"),
  resultFileText: [
    "■ 芦屋 1R\n結果確定: confirmed\n着順: 1-2-3\n最終判定: hit\n投資: 100円\n払戻: 500円\n収支: 400円",
    "■ 芦屋 2R\n結果確定: confirmed\n着順: 2-1-3\n最終判定: miss\n投資: 未保存\n払戻: 未保存\n収支: 未保存",
  ].join("\n"),
};
const archiveMetrics = buildBoatReviewVenuePerformance(archive);
assert.deepEqual(archiveMetrics.targetRaceNos, [1, 2, 4]);
assert.deepEqual(archiveMetrics.predictionRaceNos, [1, 4]);
assert.deepEqual(archiveMetrics.resultRaceNos, [1, 2]);
assert.deepEqual(archiveMetrics.missingPredictionRaceNos, [2]);
assert.deepEqual(archiveMetrics.missingResultRaceNos, [4]);
assert.equal(archiveMetrics.targetRaceCount, 3);
assert.equal(archiveMetrics.officialResultCount, 2);
const aggregate = buildBoatReviewPagePerformance([archive]);
assert.equal(aggregate.targetRaceCount, 3);
assert.equal(aggregate.investment, 100);
assert.equal(buildBoatReviewPagePerformance([archive, archive]).venueCount, 1);

const archiveMiss = {
  key: "2026-05-24:ashiya-miss",
  date: "2026-05-24",
  venueName: "芦屋",
  venueSlug: "ashiya-miss",
  races: [],
  predictionFileText: "■ 芦屋 6R\n【保存済みGPT予想】\n予想あり",
  resultFileText: "■ 芦屋 6R\n結果確定: confirmed\n着順: 2-1-3\n最終判定: 不的中\n投資: 100円\n払戻: 0円\n収支: -100円",
};
const archiveMissMetrics = buildBoatReviewVenuePerformance(archiveMiss);
assert.equal(archiveMissMetrics.races[0]?.status, "miss");
assert.equal(archiveMissMetrics.hitCount, 0);
assert.equal(archiveMissMetrics.evaluatedRaceCount, 1);

const sectionOrder = [
  pageSource.indexOf('className="boat-review-top-grid"'),
  pageSource.indexOf('className="boat-review-panel boat-review-performance"'),
  pageSource.indexOf('className="boat-review-panel boat-review-venues-panel"'),
  pageSource.indexOf('className="boat-review-panel boat-review-detail"'),
  pageSource.indexOf('className="boat-review-panel boat-review-copy-material"'),
  pageSource.indexOf('className="boat-review-panel boat-review-monthly-hint"'),
  pageSource.indexOf('className="boat-review-panel boat-review-maintenance"'),
];

const sourceChecks = {
  exactBoatHero: pageSource.includes("review-page/hero/review-hero-boat-summary-kurari-funako.png"),
  keirinParitySections: ["REVIEW WORKBENCH", "PERFORMANCE", "VENUE CARDS", "COPY MATERIAL"].every((label) => pageSource.includes(label)),
  eightPerformanceMetrics: ["予想R", "結果確定R", "的中R", "投資", "払戻", "収支", "的中率", "回収率"].every((label) => pageSource.includes(`label=\"${label}\"`)),
  compactCopyWorkflow: ["PREDICTION COPY", "RESULT COPY", "予想まとめをコピー", "結果まとめをコピー"].every((label) => pageSource.includes(label)),
  workbenchParityNotes: ["コピー素材", "保護ルール", "R不一致"].every((label) => pageSource.includes(label)),
  exactRaceReadiness: ["対象会場", "対象R数", "R対応", "予想不足:", "結果不足:"].every((label) => pageSource.includes(label)),
  raceStatusBadges: ["🎯 的中", "× 不的中", "⏳ 結果待ち", "↩ 返還", "⛔ 中止", "⚠ 予想解析注意"].every((label) => pageSource.includes(label)),
  reviewCalendarVisibleFalse: !/<(?:details|section)[^>]+className=\"[^\"]*boat-review-calendar/.test(pageSource),
  statusStripVisibleFalse: !pageSource.includes("STATUS STRIP"),
  gptReviewSummaryVisibleFalse: !pageSource.includes("GPT REVIEW SUMMARY"),
  visibleTextareaRenderZero: !/<textarea\b/i.test(pageSource),
  compactDateSelector: pageSource.includes('className="boat-review-date-selector"') && pageSource.includes("selectableDates.map"),
  maintenanceCollapsed: pageSource.includes('<details className="boat-review-panel boat-review-maintenance">'),
  monthlyCompact: pageSource.includes('<details className="boat-review-panel boat-review-monthly-hint">'),
  monthlyBeforeMaintenance: pageSource.indexOf('className="boat-review-panel boat-review-monthly-hint"') < pageSource.indexOf('className="boat-review-panel boat-review-maintenance"'),
  requiredSectionOrder: sectionOrder.every((index) => index >= 0) && sectionOrder.every((index, position) => position === 0 || sectionOrder[position - 1] < index),
  shadowUiAbsent: !pageSource.includes("SHADOW ANALYSIS"),
  noStaleTextareaStyle: !/textareaStyle|summaryTextareaStyle|boat-review-summary-editor/.test(pageSource),
  noSummaryEditorState: !pageSource.includes("const [summaryText") && !pageSource.includes("const [summaryDraft") && !pageSource.includes("setSummaryText(") && !pageSource.includes("setSummaryDraft("),
  sessionOrderPreserved: ["case \"morning\"", "case \"day\"", "case \"night\"", "case \"midnight\""].every((label) => pageSource.includes(label)),
  existingCopyBuildersPreserved: pageSource.includes("buildBoatPredictionSummaryText") && pageSource.includes("buildBoatResultSummaryText"),
  archiveSummaryReadPreserved: pageSource.includes("summaryFileText: files.summaryText"),
  existingCleanupGuardPreserved: pageSource.includes("cleanupBoatVenueLocalStorage") && pageSource.includes("window.confirm"),
  officialOutcomeResolver: helperSource.includes('resolveBoatPredictionOutcome') && helperSource.includes('source: "boat-review"'),
};
assert.ok(Object.values(sourceChecks).every(Boolean), JSON.stringify(sourceChecks, null, 2));

console.log(JSON.stringify({
  ok: true,
  fixtures: {
    livePendingSettledRefund: true,
    raceReadinessMismatch: true,
    archivePartialSections: true,
    archiveMissClassification: true,
  },
  live: liveMetrics,
  archive: archiveMetrics,
  sourceChecks,
}, null, 2));
