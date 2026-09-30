import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	SHADOW_CHECKPOINTS,
	SHADOW_SCHEMA_VERSION,
	SHADOW_START_DATE,
	SHADOW_STRATEGIES,
	buildProspectiveShadowRecord,
	evaluateShadowRecord,
	resolveRaceStartBoundary,
	summarizeShadowValidation,
} from "./boatExPredictionShadowValidation.mjs";
import { ticketKey } from "./boatExPredictionStrategyAnalysis.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const readText = (relativePath) => fs.readFileSync(path.join(repoRoot, ...relativePath.split("/")), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));

const baselineTickets = [
	"1-2-3", "1-2-4", "1-3-4", "1-4-2", "2-1-3",
	"2-3-1", "3-1-4", "3-2-1", "4-1-2", "5-1-2",
].map((combination, index) => ({
	ticketId: String(index + 1).padStart(2, "0"),
	group: index < 2 ? "厚め" : index < 5 ? "本線" : "中穴",
	boatNumbers: combination.split("-").map(Number),
	sourceCombination: combination,
}));

const formalPrediction = {
	date: "2026-10-02",
	venueCode: "01",
	venueName: "桐生",
	raceNo: 1,
	sourceRecordSavedAt: "2026-10-01T22:00:00.000Z",
	tickets: baselineTickets.map((ticket) => ({ betType: "3連単", combination: ticket.sourceCombination, group: ticket.group, index: ticket.ticketId })),
};

const preRaceFeatures = {
	venueCode: "01",
	raceNoGroup: "1-4R",
	primaryPredictedWinner: 1,
	predictedWinnerCandidates: [1, 2, 3, 4, 5],
	windSpeedBucket: "2-3m",
	lane1Class: "A1",
	categories: ["厚め", "本線", "中穴"],
};

const trainingRecords = Array.from({ length: 120 }, (_, index) => {
	const swap = index < 60;
	const actualResult = swap ? [1, 3, 2] : [1, 2, 6];
	return {
		raceKey: `training-${index}`,
		date: `2026-09-${String(1 + (index % 28)).padStart(2, "0")}`,
		actualResult,
		actualWinner: actualResult[0],
		actualSecond: actualResult[1],
		actualThird: actualResult[2],
		primaryErrorType: swap ? "secondThirdSwap" : "thirdMiss",
		baselineTickets,
		preRaceFeatures,
	};
});

const created = buildProspectiveShadowRecord({
	formalPrediction,
	raceIdentity: { date: "2026-10-02", venueCode: "01", venueName: "桐生", raceNo: 1 },
	preRaceFeatureSource: { venueCode: "01", raceNo: 1, raceNoGroup: "1-4R", windSpeedBucket: "2-3m", lane1Class: "A1", sourceTimestamp: "2026-10-01T22:05:00.000Z" },
	raceStartBoundary: { at: "2026-10-02T10:00:00+09:00", source: "deadlineTime", value: "10:00" },
	trainingRecords,
	generatedAt: "2026-10-01T22:10:00.000Z",
});

if (created.status !== "created") throw new Error(`shadow fixture was not created: ${created.reason}`);
const pending = created.record;
const postStartAttempt = buildProspectiveShadowRecord({
	formalPrediction,
	raceIdentity: { date: "2026-10-02", venueCode: "01", venueName: "桐生", raceNo: 1 },
	preRaceFeatureSource: { venueCode: "01", raceNo: 1, raceNoGroup: "1-4R", windSpeedBucket: "2-3m", lane1Class: "A1", sourceTimestamp: "2026-10-02T00:59:00.000Z" },
	raceStartBoundary: { at: "2026-10-02T10:00:00+09:00", source: "deadlineTime", value: "10:00" },
	trainingRecords,
	generatedAt: "2026-10-02T01:02:00.000Z",
});
const timingUnknownAttempt = buildProspectiveShadowRecord({
	formalPrediction,
	raceIdentity: { date: "2026-10-02", venueCode: "01", venueName: "桐生", raceNo: 1 },
	preRaceFeatureSource: { venueCode: "01", raceNo: 1, raceNoGroup: "1-4R", windSpeedBucket: "2-3m", lane1Class: "A1", sourceTimestamp: "2026-10-01T22:05:00.000Z" },
	raceStartBoundary: null,
	trainingRecords,
	generatedAt: "2026-10-01T22:10:00.000Z",
});
const pendingAfterNoResult = evaluateShadowRecord(pending, { actualResult: null, resultSourceTimestamp: null, evaluatedAt: "2026-10-02T02:00:00.000Z" });
const evaluated = evaluateShadowRecord(pending, { actualResult: [1, 2, 6], resultSourceTimestamp: "2026-10-02T02:00:00.000Z", evaluatedAt: "2026-10-02T02:05:00.000Z" });

const immutableFields = ["raceKey", "firstGeneratedAt", "generatedAt", "baselinePredictionGeneratedAt", "sourceFeatureTimestamp", "raceStartBoundaryAt", "raceStartBoundarySource", "trainingCutoffDate"];
const immutable = immutableFields.every((key) => JSON.stringify(pending[key]) === JSON.stringify(evaluated[key]))
	&& JSON.stringify(pending.baselineTickets) === JSON.stringify(evaluated.baselineTickets)
	&& JSON.stringify(pending.shadowTickets) === JSON.stringify(evaluated.shadowTickets);

const ticketIntegrity = Object.values(pending.strategies).every((strategy) => (
	strategy.shadowTickets.length === 10
	&& new Set(strategy.shadowTickets.map(ticketKey)).size === 10
	&& strategy.shadowTickets.every((ticket) => ticket.boatNumbers.length === 3 && new Set(ticket.boatNumbers).size === 3 && ticket.boatNumbers.every((boat) => boat >= 1 && boat <= 6))
	&& strategy.addedTickets.length === strategy.removedTickets.length
));

const outcomes = ["improved", "degraded", "unchangedHit", "unchangedMiss"];
const partitionRecords = outcomes.map((outcome, index) => ({
	...evaluated,
	raceKey: `partition-${index}`,
	date: `2026-10-${String(2 + index).padStart(2, "0")}`,
	evaluation: {
		...evaluated.evaluation,
		strategies: Object.fromEntries(Object.keys(SHADOW_STRATEGIES).map((strategyId) => [strategyId, {
			baseline: { exactHit: outcome === "degraded" || outcome === "unchangedHit", winnerCovered: true, secondPositionCovered: true, thirdPositionCovered: outcome !== "unchangedMiss", thirdMiss: false, secondThirdSwap: false, opponentMiss: false, winnerMiss: false },
			shadow: { exactHit: outcome === "improved" || outcome === "unchangedHit", winnerCovered: true, secondPositionCovered: true, thirdPositionCovered: outcome !== "degraded", thirdMiss: false, secondThirdSwap: false, opponentMiss: false, winnerMiss: false },
			outcome,
		}]))
	},
}));
const fixtureSummary = summarizeShadowValidation(partitionRecords, "2026-10-06T00:00:00.000Z");
const candidateSummary = fixtureSummary.strategies["third-expansion-v1"];

const recordsFile = readJson("public/data/boatrace-ex/derived/prediction-shadow-validation/records.generated.json");
const summaryFile = readJson("public/data/boatrace-ex/derived/prediction-shadow-validation/history-summary.json");
const helperSource = readText("scripts/boatExPredictionShadowValidation.mjs");
const generatorSource = readText("scripts/generateBoatExPredictionShadowValidation.mjs");
const dailySource = readText("scripts/generateBoatExDaily.mjs");
const pageSource = readText("src/pages/BoatExPage.tsx");
const builderSource = helperSource.slice(helperSource.indexOf("export function buildProspectiveShadowRecord"), helperSource.indexOf("function primaryError"));
const generationCallIndex = dailySource.indexOf('"scripts/generateBoatExPredictionShadowValidation.mjs", ["--phase", "generate"');
const historyRefreshIndex = dailySource.indexOf("let history;");
const evaluationCallIndex = dailySource.indexOf('"scripts/generateBoatExPredictionShadowValidation.mjs", ["--phase", "evaluate"');

const storedRecords = recordsFile.records ?? [];
const storedEvaluated = storedRecords.filter((record) => record.lifecycle === "EVALUATED");
const storedPartitionCount = storedEvaluated.filter((record) => {
	const outcome = record.evaluation?.strategies?.["third-expansion-v1"]?.outcome;
	return outcomes.includes(outcome);
}).length;

const checks = {
	schemaVersion: recordsFile.schemaVersion === SHADOW_SCHEMA_VERSION && summaryFile.schemaVersion === SHADOW_SCHEMA_VERSION,
	strategyVersions: JSON.stringify(summaryFile.strategyVersions) === JSON.stringify(Object.keys(SHADOW_STRATEGIES)),
	shadowStartDate: recordsFile.startDate === SHADOW_START_DATE && summaryFile.startDate === SHADOW_START_DATE,
	noHistoricalRetroGeneration: storedRecords.every((record) => record.date >= SHADOW_START_DATE) && summaryFile.summary.retroGeneratedRaceCount === 0,
	shadowCreatedBeforeResult: storedRecords.every((record) => record.lifecycle !== "EVALUATED" || Date.parse(record.firstGeneratedAt) < Date.parse(record.evaluation.resultSourceTimestamp)),
	shadowGeneratedBeforeRaceStart: Date.parse(pending.firstGeneratedAt) < Date.parse(pending.raceStartBoundaryAt) && storedRecords.every((record) => Date.parse(record.firstGeneratedAt) < Date.parse(record.raceStartBoundaryAt)),
	baselineGeneratedBeforeRaceStart: Date.parse(pending.baselinePredictionGeneratedAt) < Date.parse(pending.raceStartBoundaryAt) && storedRecords.every((record) => Date.parse(record.baselinePredictionGeneratedAt) < Date.parse(record.raceStartBoundaryAt)),
	postStartGenerationRejected: postStartAttempt.status === "ineligible" && postStartAttempt.reason === "shadow-not-created-before-race-start" && summaryFile.summary.postStartGeneratedRaceCount === 0,
	preRaceTimingUnknownRejected: timingUnknownAttempt.status === "ineligible" && timingUnknownAttempt.reason === "pre-race-timing-unknown",
	sourceBackedRaceBoundary: resolveRaceStartBoundary({ date: "2026-10-02", race: { startTime: "", deadlineTime: "10:00" } })?.source === "deadlineTime",
	immutableFirstGeneratedAt: immutable,
	trainingCutoffBeforeRaceDate: pending.trainingCutoffDate < pending.date && storedRecords.every((record) => record.trainingCutoffDate < record.date),
	noSameDayTrainingLeakage: pending.trainingSampleCount === trainingRecords.length && summaryFile.summary.sameDayTrainingLeakageCount === 0,
	actualResultAbsentFromBuilderInputs: !/actualResult|officialResult|payout|resultSource/iu.test(builderSource),
	exactTenUniqueOrderedTickets: ticketIntegrity && storedRecords.filter((record) => record.lifecycle !== "INELIGIBLE").every((record) => Object.values(record.strategies).every((strategy) => strategy.shadowTickets.length === 10 && new Set(strategy.shadowTickets.map(ticketKey)).size === 10)),
	addedRemovedBalance: Object.values(pending.strategies).every((strategy) => strategy.addedTickets.length === strategy.removedTickets.length),
	baselineImmutable: immutable,
	pendingRaceNotEvaluated: pendingAfterNoResult.lifecycle === "PENDING" && pendingAfterNoResult.evaluation === null,
	evaluatedRaceRequiresOfficialResult: evaluated.lifecycle === "EVALUATED" && evaluated.evaluation.officialResult.join("-") === "1-2-6",
	partitionInvariant: candidateSummary.evaluatedRaceCount === 4 && candidateSummary.improvedRaceCount === 1 && candidateSummary.degradedRaceCount === 1 && candidateSummary.unchangedHitRaceCount === 1 && candidateSummary.unchangedMissRaceCount === 1,
	dailyTotalsInvariant: fixtureSummary.daily.reduce((sum, day) => sum + day.evaluatedR, 0) === 4 && fixtureSummary.daily.at(-1).cumulativeNetGain === candidateSummary.netExactHitGain,
	storedPartitionInvariant: storedPartitionCount === storedEvaluated.length,
	checkpointInvariant: JSON.stringify(candidateSummary.checkpoints.map((entry) => entry.checkpoint)) === JSON.stringify(SHADOW_CHECKPOINTS) && candidateSummary.checkpoints.every((entry) => entry.status === "insufficient"),
	strategyVersionInvariant: pending.strategyId === "third-expansion-v1" && Object.keys(pending.strategies).every((strategyId) => strategyId.endsWith("-v1")),
	roiNotUsedForSelection: summaryFile.roiReference.selectionUse === false && summaryFile.roiReference.policy.includes("reference-only"),
	dailyPipelineOrder: generationCallIndex >= 0 && historyRefreshIndex >= 0 && evaluationCallIndex >= 0 && generationCallIndex < historyRefreshIndex && evaluationCallIndex > historyRefreshIndex,
	generatorSkipsConfirmedRace: generatorSource.includes("confirmedCurrentResult(current.race)") && generatorSource.includes("postResultSkippedCount"),
	generatorTracksPreRaceBoundary: generatorSource.includes("resolveRaceStartBoundary") && generatorSource.includes("preRaceTimingUnknownCount") && generatorSource.includes("postStartSkippedCount"),
	uiSeparatedFromPhase3: pageSource.includes("ライブ・シャドー検証") && pageSource.includes("実予想には未反映") && pageSource.includes("未来レースで検証中"),
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	checks,
	fixture: {
		strategyId: pending.strategyId,
		trainingCutoffDate: pending.trainingCutoffDate,
		trainingSampleCount: pending.trainingSampleCount,
		candidateChanged: pending.strategies["third-expansion-v1"].changed,
		controlChanged: pending.strategies["reverse-pair-v1"].changed,
		partition: {
			improved: candidateSummary.improvedRaceCount,
			degraded: candidateSummary.degradedRaceCount,
			unchangedHit: candidateSummary.unchangedHitRaceCount,
			unchangedMiss: candidateSummary.unchangedMissRaceCount,
		},
	},
	stored: summaryFile.summary,
}, null, 2));

if (!ok) process.exitCode = 1;
