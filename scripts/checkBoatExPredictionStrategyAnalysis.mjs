import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
	STRATEGY_CONFIG,
	STRATEGY_IDS,
	STRATEGY_SCHEMA_VERSION,
	evaluateTicketSet,
} from "./boatExPredictionStrategyAnalysis.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const summary = readJson("public/data/boatrace-ex/derived/prediction-strategy-analysis/history-summary.json");
const latest = readJson("public/data/boatrace-ex/derived/prediction-strategy-analysis/latest.json");
const details = readJson("public/data/boatrace-ex/derived/prediction-strategy-analysis/race-details.json");
const index = readJson("public/data/boatrace-ex/index.generated.json");
const audit = readJson(`public/data/boatrace-ex/audit/prediction-strategy-analysis-${index.latestDate}.generated.json`);
const helperSource = fs.readFileSync(path.join(root, "scripts/boatExPredictionStrategyAnalysis.mjs"), "utf8");
const generatorSource = fs.readFileSync(path.join(root, "scripts/generateBoatExPredictionStrategyAnalysis.mjs"), "utf8");
const dailySource = fs.readFileSync(path.join(root, "scripts/generateBoatExDaily.mjs"), "utf8");
const pageSource = fs.readFileSync(path.join(root, "src/pages/BoatExPage.tsx"), "utf8");

assert.equal(summary.schemaVersion, STRATEGY_SCHEMA_VERSION);
assert.equal(latest.schemaVersion, STRATEGY_SCHEMA_VERSION);
assert.equal(details.schemaVersion, STRATEGY_SCHEMA_VERSION);
assert.equal(summary.kind, "boatrace-ex-prediction-strategy-analysis-history-summary");
assert.equal(latest.kind, "boatrace-ex-prediction-strategy-analysis-latest");
assert.equal(details.kind, "boatrace-ex-prediction-strategy-analysis-race-details");
assert.equal(summary.period.to, index.latestDate);
assert.deepEqual(latest.strategies, summary.strategies);
assert.deepEqual(audit.invariants, summary.invariants);
assert.equal(summary.walkForwardPolicy.type, "expanding-window");
assert.equal(summary.invariants.walkForwardFoldCount, summary.folds.length);
assert.equal(summary.invariants.futureTrainingViolationCount, 0);
assert.equal(summary.invariants.roiSelectionReferenceCount, 0);
assert.equal(summary.categorySemantics, "Categories are overlapping ticket subsets within a race and are never treated as mutually-exclusive race partitions.");
assert.match(summary.roiPolicy, /not used for strategy selection/u);
assert.ok(!summary.sourceFiles.some((sourcePath) => /(?:public\/data\/reviews|public\/dog|johnson-predictions)/u.test(sourcePath)));

const builderSource = helperSource.slice(helperSource.indexOf("export function buildCounterfactualTickets"), helperSource.indexOf("export function evaluateTicketSet"));
assert.ok(!/actualResult|officialResult|trifectaPayout|recoveryRate|roi/iu.test(builderSource), "strategy builder must not receive or reference evaluation outcomes/ROI");
assert.match(generatorSource, /trainingTo: addDays\(from, -1\)/u);
assert.ok(pageSource.includes("10点戦略シミュレーション"));
assert.ok(pageSource.includes("シミュレーションであり実予想成績ではありません"));
assert.ok(pageSource.includes("prediction-strategy-analysis/history-summary.json"));
assert.ok(dailySource.includes("generateBoatExPredictionStrategyAnalysis.mjs"));
assert.ok(dailySource.includes("checkBoatExPredictionStrategyAnalysis.mjs"));

const sourceByKey = new Map();
for (const date of index.availableDates) {
	const shard = readJson(`public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`);
	for (const race of shard.races ?? []) {
		const raceKey = `${race.date}:${race.venueCode}:${String(Number(race.raceNo)).padStart(2, "0")}`;
		sourceByKey.set(raceKey, race);
	}
}

const keyToTicket = (key) => ({ boatNumbers: key.split("-").map(Number) });
const validKey = (key) => {
	const lanes = key.split("-").map(Number);
	return lanes.length === 3 && new Set(lanes).size === 3 && lanes.every((lane) => Number.isInteger(lane) && lane >= 1 && lane <= 6);
};
const detailCounts = Object.fromEntries(STRATEGY_IDS.map((id) => [id, 0]));
const detailImproved = Object.fromEntries(STRATEGY_IDS.map((id) => [id, 0]));
const detailDegraded = Object.fromEntries(STRATEGY_IDS.map((id) => [id, 0]));
for (const detail of details.races) {
	assert.ok(STRATEGY_IDS.includes(detail.strategyId));
	assert.ok(detail.trainingTo < detail.date, `future leakage: ${detail.raceKey}`);
	assert.equal(detail.strategyTickets.length, 10);
	assert.equal(new Set(detail.strategyTickets).size, 10);
	assert.ok(detail.strategyTickets.every(validKey));
	assert.equal(detail.addedTickets.length, 1);
	assert.equal(detail.removedTickets.length, 1);
	assert.ok(!detail.baselineTickets.includes(detail.addedTickets[0]));
	assert.ok(detail.baselineTickets.includes(detail.removedTickets[0]));
	assert.equal(detail.trainingSampleCount >= STRATEGY_CONFIG[detail.strategyId].minimumSampleCount, true);
	const sourceRace = sourceByKey.get(detail.raceKey);
	assert.ok(sourceRace, `source race missing: ${detail.raceKey}`);
	assert.deepEqual(detail.baselineTickets, sourceRace.structuredTickets.map((ticket) => ticket.boatNumbers.join("-")), `baseline changed: ${detail.raceKey}`);
	const baseline = evaluateTicketSet(detail.baselineTickets.map(keyToTicket), detail.actualResult);
	const strategy = evaluateTicketSet(detail.strategyTickets.map(keyToTicket), detail.actualResult);
	assert.equal(detail.baselineHit, baseline.exactHit);
	assert.equal(detail.strategyHit, strategy.exactHit);
	detailCounts[detail.strategyId] += 1;
	detailImproved[detail.strategyId] += Number(!baseline.exactHit && strategy.exactHit);
	detailDegraded[detail.strategyId] += Number(baseline.exactHit && !strategy.exactHit);
}
assert.equal(details.changedRaceCount, details.races.length);
assert.equal(summary.invariants.changedRaceDetailCount, details.races.length);

for (let indexFold = 0; indexFold < summary.folds.length; indexFold += 1) {
	const fold = summary.folds[indexFold];
	assert.ok(fold.trainingTo < fold.validationFrom, `chronology violation: ${fold.id}`);
	if (indexFold > 0) assert.ok(summary.folds[indexFold - 1].validationTo < fold.validationFrom, `validation overlap: ${fold.id}`);
	for (const strategyId of STRATEGY_IDS) {
		const validation = fold.strategies[strategyId].validation;
		assert.equal(validation.baseline.raceCount, fold.validationRaceCount);
		assert.equal(validation.strategy.raceCount, fold.validationRaceCount);
		assert.equal(validation.improvedRaceCount - validation.degradedRaceCount, validation.netExactHitGain);
		assert.equal(validation.improvedRaceCount + validation.degradedRaceCount + validation.unchangedRaceCount, fold.validationRaceCount);
	}
}

for (const strategyId of STRATEGY_IDS) {
	const strategy = summary.strategies[strategyId];
	assert.equal(strategy.validationRaceCount, summary.invariants.validationRaceCount);
	assert.equal(strategy.changedRaceCount, detailCounts[strategyId]);
	assert.equal(strategy.improvedRaceCount, detailImproved[strategyId]);
	assert.equal(strategy.degradedRaceCount, detailDegraded[strategyId]);
	assert.equal(strategy.improvedRaceCount - strategy.degradedRaceCount, strategy.netExactHitGain);
	assert.equal(strategy.strategy.exactHit - strategy.baseline.exactHit, strategy.netExactHitGain);
	assert.equal(strategy.improvedRaceCount + strategy.degradedRaceCount + strategy.unchangedRaceCount, strategy.validationRaceCount);
	assert.deepEqual(strategy.baseline, summary.baseline.validationPopulation);
	assert.equal(strategy.folds.length, summary.folds.length);
}

const fullBaseline = summary.baseline.fullPopulation;
assert.equal(fullBaseline.raceCount, 4261);
assert.equal(fullBaseline.exactHit, 1440);
assert.equal(fullBaseline.winnerCovered, 3873);
assert.equal(fullBaseline.secondPositionCovered, 2750);
assert.equal(fullBaseline.thirdPositionCovered, 2461);
assert.equal(fullBaseline.thirdMiss, 1163);
assert.equal(fullBaseline.secondThirdSwap, 304);
assert.equal(fullBaseline.opponentMiss, 966);
assert.equal(fullBaseline.winnerMiss, 388);

console.log(JSON.stringify({
	ok: true,
	schemaVersion: summary.schemaVersion,
	period: summary.period,
	walkForwardPolicy: summary.walkForwardPolicy,
	folds: summary.folds.map((fold) => ({ id: fold.id, trainingFrom: fold.trainingFrom, trainingTo: fold.trainingTo, validationFrom: fold.validationFrom, validationTo: fold.validationTo, trainingRaceCount: fold.trainingRaceCount, validationRaceCount: fold.validationRaceCount })),
	baseline: summary.baseline,
	strategies: Object.fromEntries(STRATEGY_IDS.map((id) => [id, summary.strategies[id]])),
	invariants: summary.invariants,
}, null, 2));
