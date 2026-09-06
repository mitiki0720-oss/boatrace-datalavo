import fs from "node:fs";
import ts from "typescript";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const monthlyModule = { exports: {} };
new Function("exports", "module", "require", compile(read("src/lib/boatPredictionMonthlyReviewContext.ts")))(monthlyModule.exports, monthlyModule, (id) => {
	if (id === "./boatMonthlyReview") return {
		BOAT_MONTHLY_REVIEW_DATA_PATH: "data/monthly-review/boat/monthly-review-data.json",
		getBoatMonthlyAvailableMonths: (data) => data.monthlyOverview.map((item) => item.month),
		getBoatMonthlyPartialMonths: (data) => data.partialMonths ?? [],
		getBoatMonthlyQualityCount: (data, key) => data.dataQuality.find((item) => item.item === key)?.count ?? 0,
	};
	throw new Error(`Unexpected monthly dependency: ${id}`);
});

const feedbackModule = { exports: {} };
new Function("exports", "module", "require", compile(read("src/lib/boatPredictionMonthlyFeedback.ts")))(feedbackModule.exports, feedbackModule, (id) => {
	if (id === "./boatPracticeResultStorage") return {
		isBoatPracticeHit: (record) => Number(record?.payoutYen ?? record?.payoutAmount ?? 0) > 0 || Boolean(record?.hitBetNumbers),
	};
	throw new Error(`Unexpected feedback dependency: ${id}`);
});

const copyModule = { exports: {} };
new Function("exports", "module", compile(read("src/lib/boatPredictionGptCopy.ts")))(copyModule.exports, copyModule);

const monthlyData = {
	generated_at: "2026-09-03T08:00:00+09:00",
	period: { start: "2026-06-01", end: "2026-09-03" },
	method: { classification: "summary_v2 exact source with explicit auto proxy audit" },
	partialMonths: ["2026-09"],
	monthlyOverview: [{ month: "2026-08", races: 4915, hits: 1530, hit_rate_pct: 31.13, investment_yen: 4914900, return_yen: 3467930, profit_yen: -1446970, roi_pct: 70.56, TICKET_HIT: 1530, STRUCTURE_MISS: 1617, READ_MISS: 1715, DATA_HOLD: 53, structure_miss_rate_pct: 32.9, read_miss_rate_pct: 34.89, pre_prediction_rate_pct: 69, venues: 24, days: 31, actual_1boat_win_rate_pct: 53.75 }],
	venueMonthly: [{ month: "2026-08", venue: "三国", races: 228, hits: 70, hit_rate_pct: 30.7, investment_yen: 228000, return_yen: 210000, profit_yen: -18000, roi_pct: 92.1, TICKET_HIT: 70, STRUCTURE_MISS: 71, READ_MISS: 80, DATA_HOLD: 7, days: 19, actual_1boat_win_rate_pct: 57.2 }],
	oneBoatAnalysis: [], windBands: [], predictionModes: [], displayAudit: [], nextKpi: [],
	dataQuality: [{ item: "classification_auto_proxy", count: 12, note: "audit" }],
};

const snapshot = monthlyModule.exports.buildBoatPredictionMonthlyReviewSnapshot({
	monthlyData,
	loadState: "ready",
	predictionDate: "2026-09-03",
	venueName: "三国",
});
const laterSnapshot = monthlyModule.exports.buildBoatPredictionMonthlyReviewSnapshot({
	monthlyData: {
		...monthlyData,
		monthlyOverview: [...monthlyData.monthlyOverview, { ...monthlyData.monthlyOverview[0], month: "2026-09" }],
		partialMonths: [],
	},
	loadState: "ready",
	predictionDate: "2026-10-03",
	venueName: "三国",
});
const preservedSnapshot = monthlyModule.exports.preserveBoatPredictionMonthlyReviewSnapshot(snapshot, laterSnapshot);
const unavailableSnapshot = monthlyModule.exports.buildBoatPredictionMonthlyReviewSnapshot({ monthlyData: null, loadState: "unavailable", predictionDate: "2026-09-03", venueName: "三国" });
const prediction = { raceKey: "boat-prediction:20260903-venue-10-01", raceId: "20260903-venue-10-01", date: "2026-09-03", venueCode: "10", venueName: "三国", raceNo: 1, predictionText: "fixture", savedAt: "2026-09-03T09:00:00+09:00", monthlyReviewContext: snapshot };
const hitFeedback = feedbackModule.exports.buildBoatPredictionMonthlyFeedback({ prediction, practiceResult: { raceKey: prediction.raceKey, venueName: "三国", date: "2026-09-03", raceNo: 1, actualFinishOrderText: "1-2-3", resultStatus: "confirmed", payoutYen: 1500 } });
const structureFeedback = feedbackModule.exports.buildBoatPredictionMonthlyFeedback({ prediction, practiceResult: { raceKey: prediction.raceKey, venueName: "三国", date: "2026-09-03", raceNo: 1, actualFinishOrderText: "2-1-3", resultStatus: "confirmed", payoutYen: 0, reviewClassification: "STRUCTURE_MISS", reviewClassificationSource: "summary_v2" } });
const readFeedback = feedbackModule.exports.buildBoatPredictionMonthlyFeedback({ prediction, practiceResult: { raceKey: prediction.raceKey, venueName: "三国", date: "2026-09-03", raceNo: 1, actualFinishOrderText: "3-1-2", resultStatus: "confirmed", payoutYen: 0, reviewClassification: "READ_MISS", reviewClassificationSource: "summary_v2" } });
const holdFeedback = feedbackModule.exports.buildBoatPredictionMonthlyFeedback({ prediction, practiceResult: { raceKey: prediction.raceKey, venueName: "三国", date: "2026-09-03", raceNo: 1, actualFinishOrderText: "", resultStatus: "missing", reviewClassification: "DATA_HOLD", reviewClassificationSource: "summary_v2" } });
const unclassifiedFeedback = feedbackModule.exports.buildBoatPredictionMonthlyFeedback({ prediction, practiceResult: { raceKey: prediction.raceKey, venueName: "三国", date: "2026-09-03", raceNo: 1, actualFinishOrderText: "2-3-1", resultStatus: "confirmed", payoutYen: 0, reviewClassification: "READ_MISS", reviewClassificationSource: "auto_proxy" } });
const legacyFeedback = feedbackModule.exports.buildBoatPredictionMonthlyFeedback({ prediction: { ...prediction, monthlyReviewContext: undefined } });

const typeSource = read("src/lib/boatraceTypes.ts");
const storageSource = read("src/lib/boatPredictionStorage.ts");
const contextSource = read("src/lib/boatPredictionMonthlyReviewContext.ts");
const predictionPageSource = read("src/pages/PredictionPage.tsx");
const reviewPageSource = read("src/pages/ReviewPage.tsx");
const reviewBuilderSource = read("src/lib/boatReviewSummaryBuilder.ts");
const feedbackSource = read("src/lib/boatPredictionMonthlyFeedback.ts");
const johnsonSource = read("src/lib/boatJohnsonPredictionStorage.ts");
const bettingInstruction = copyModule.exports.buildBoatPredictionGptBettingInstruction();

const checks = {
	snapshotTypeExists: typeSource.includes("export type BoatPredictionMonthlyReviewSnapshot") && typeSource.includes("monthlyReviewContext?: BoatPredictionMonthlyReviewSnapshot"),
	predictionSaveWiring: (predictionPageSource.match(/monthlyReviewContext: preserveBoatPredictionMonthlyReviewSnapshot\(/gu) ?? []).length === 2,
	referenceMonthSaved: snapshot.referenceMonth === "2026-08" && snapshot.referenceStatus === "COMPLETE",
	focusSaved: snapshot.focus === "read" && snapshot.focusLabel === "展開読み監査を優先",
	venueSampleSaved: snapshot.venue === "三国" && snapshot.venueSampleRaces === 228,
	generatedAtSaved: snapshot.generatedAt === monthlyData.generated_at && snapshot.periodStart === "2026-06-01" && snapshot.periodEnd === "2026-09-03",
	unavailableSafe: unavailableSnapshot.referenceStatus === "UNAVAILABLE" && unavailableSnapshot.referenceMonth === null,
	legacySafe: monthlyModule.exports.normalizeBoatPredictionMonthlyReviewSnapshot(undefined) === undefined && legacyFeedback.snapshotStatus === "legacy",
	noHistoricalBackfill: storageSource.includes("normalizeBoatPredictionMonthlyReviewSnapshot(repairedRecord.monthlyReviewContext)") && !/referenceMonth\s*:\s*record\.date\.slice/gu.test(storageSource),
	futureMonthlyNotInjected: laterSnapshot.referenceMonth === "2026-09" && preservedSnapshot.referenceMonth === "2026-08" && preservedSnapshot.generatedAt === snapshot.generatedAt,
	existingContextBuilderReused: contextSource.includes("const snapshot = buildBoatPredictionMonthlyReviewSnapshot") && predictionPageSource.includes("buildBoatPredictionMonthlyReviewSnapshot({"),
	noDuplicateMonthlyCalculation: (contextSource.match(/export function buildBoatPredictionMonthlyReviewSnapshot/gu) ?? []).length === 1 && contextSource.includes("snapshot.focusLabel"),
	canonicalResultJoin: reviewBuilderSource.includes("params.raceId ? `boat-prediction:${params.raceId}`") && feedbackSource.includes("raceKey: prediction.raceKey"),
	hitOutcomeSupported: hitFeedback.settlementOutcome === "hit" && hitFeedback.observedOutcome === "TICKET_HIT",
	missOutcomeSupported: unclassifiedFeedback.settlementOutcome === "miss" && unclassifiedFeedback.observedOutcome === "UNCLASSIFIED",
	dataHoldSafe: holdFeedback.observedOutcome === "DATA_HOLD" && holdFeedback.classificationSource === "summary_v2",
	structureReadSourceBacked: structureFeedback.observedOutcome === "STRUCTURE_MISS" && readFeedback.observedOutcome === "READ_MISS" && unclassifiedFeedback.classificationSource === null,
	noFakeClassification: feedbackSource.includes("auto|proxy|guess|infer|推測|補完") && unclassifiedFeedback.observedOutcome === "UNCLASSIFIED",
	reviewDisplay: reviewPageSource.includes("selectedMonthlyFeedback")
		&& reviewPageSource.includes("focusLabel")
		&& reviewPageSource.includes("結果待ち")
		&& reviewPageSource.includes("参照未取得"),
	legacyReviewSafe: reviewPageSource.includes("記録なし") && reviewPageSource.includes("参照未取得"),
	monthlyGptBlockUnchanged: contextSource.includes("【月次振り返り反映 /") && contextSource.includes("Monthlyは過去結果の振り返り補助です"),
	trifectaContractUnchanged: bettingInstruction.includes("3連単10点") && bettingInstruction.includes("厚め2点") && bettingInstruction.includes("本線3点") && bettingInstruction.includes("中穴3点") && bettingInstruction.includes("大穴2点"),
	noExactaRequired: bettingInstruction.includes("2連単は使わない"),
	johnsonContractPreserved: !johnsonSource.includes("monthlyReviewContext") && johnsonSource.includes("sourceRecordSavedAt: hydratedRecord.savedAt"),
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
	ok,
	checks,
	fixtures: {
		snapshot: { referenceMonth: snapshot.referenceMonth, focus: snapshot.focus, venue: snapshot.venue, venueSampleRaces: snapshot.venueSampleRaces, generatedAt: snapshot.generatedAt },
		preservedReferenceMonth: preservedSnapshot.referenceMonth,
		unavailable: unavailableSnapshot,
		outcomes: { hit: hitFeedback.observedOutcome, structure: structureFeedback.observedOutcome, read: readFeedback.observedOutcome, hold: holdFeedback.observedOutcome, unclassified: unclassifiedFeedback.observedOutcome },
	},
}, null, 2));

if (!ok) process.exitCode = 1;
