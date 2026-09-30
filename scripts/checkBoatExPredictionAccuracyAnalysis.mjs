import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
	ACCURACY_SCHEMA_VERSION,
	PRIMARY_ERROR_TYPES,
	analyzePredictionAccuracyRace,
} from "./boatExPredictionAccuracyAnalysis.mjs";
import { classifyPredictionError, sampleStatus } from "./boatExPredictionStructureAnalysis.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const v2 = readJson("public/data/boatrace-ex/derived/prediction-structure-analysis/history-summary.json");
const analysis = readJson("public/data/boatrace-ex/derived/prediction-accuracy-analysis/history-summary.json");
const latest = readJson("public/data/boatrace-ex/derived/prediction-accuracy-analysis/latest.json");
const details = readJson("public/data/boatrace-ex/derived/prediction-accuracy-analysis/race-details.json");
const audit = readJson(`public/data/boatrace-ex/audit/prediction-accuracy-analysis-${index.latestDate}.generated.json`);
const pageSource = fs.readFileSync(path.join(root, "src/pages/BoatExPage.tsx"), "utf8");
const dailySource = fs.readFileSync(path.join(root, "scripts/generateBoatExDaily.mjs"), "utf8");

const sum = (entries, key) => entries.reduce((total, entry) => total + Number(entry[key] ?? 0), 0);
const roundedRate = (numerator, denominator) => denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
const uniqueLanes = (values) => [...new Set(values.map(Number))].sort((left, right) => left - right);
const sourceRaceByKey = new Map();
for (const date of index.availableDates) {
	const shard = readJson(`public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`);
	for (const race of shard.races) {
		const raceKey = `${race.date}:${race.venueCode}:${String(Number(race.raceNo)).padStart(2, "0")}`;
		assert.ok(!sourceRaceByKey.has(raceKey), `duplicate source race: ${raceKey}`);
		sourceRaceByKey.set(raceKey, race);
	}
}

assert.equal(analysis.schemaVersion, ACCURACY_SCHEMA_VERSION);
assert.equal(latest.schemaVersion, ACCURACY_SCHEMA_VERSION);
assert.equal(details.schemaVersion, ACCURACY_SCHEMA_VERSION);
assert.equal(analysis.kind, "boatrace-ex-prediction-accuracy-analysis-history-summary");
assert.equal(latest.kind, "boatrace-ex-prediction-accuracy-analysis-latest");
assert.equal(details.kind, "boatrace-ex-prediction-accuracy-analysis-race-details");
assert.equal(analysis.period.to, index.latestDate);
assert.equal(analysis.period.dateCount, index.availableDates.length);
assert.deepEqual(latest.overall, analysis.overall);
assert.deepEqual(latest.opponentCoverage, analysis.opponentCoverage);
assert.deepEqual(latest.dimensions, analysis.dimensions);
assert.deepEqual(audit.invariants, analysis.invariants);
assert.ok(pageSource.includes("PredictionAccuracyAnalysisSection"));
assert.ok(pageSource.includes("相手・着順分析"));
assert.ok(pageSource.includes("ROI対象"));
assert.ok(pageSource.includes("ROI標本"));
assert.ok(pageSource.includes("的中率対象"));
assert.ok(pageSource.includes("prediction-accuracy-analysis/history-summary.json"));
assert.ok(dailySource.includes("generateBoatExPredictionAccuracyAnalysis.mjs"));
assert.ok(dailySource.includes("checkBoatExPredictionAccuracyAnalysis.mjs"));
assert.ok(!analysis.sourceFiles.some((sourcePath) => /(?:public\/data\/reviews|public\/dog|johnson-predictions)/u.test(sourcePath)));

for (const key of ["candidateEvaluatedRaceCount", "eligibleRaceCount", "unknownRaceCount", "futureLeakageRaceCount"]) {
	assert.equal(analysis.evaluationEligibility[key], v2.evaluationEligibility[key], `V2 eligibility changed: ${key}`);
}
assert.equal(details.raceCount, analysis.evaluationEligibility.eligibleRaceCount);
assert.equal(details.races.length, details.raceCount);
assert.equal(new Set(details.races.map((race) => race.raceKey)).size, details.raceCount);
assert.equal(analysis.invariants.duplicateRaceKeyCount, 0);
assert.equal(analysis.invariants.duplicateTicketCount, 0);

const primaryTotal = PRIMARY_ERROR_TYPES.reduce((total, key) => total + analysis.overall[key], 0);
assert.equal(primaryTotal, details.raceCount);
assert.equal(analysis.invariants.primaryErrorPartitionCount, details.raceCount);
assert.equal(sum(analysis.missDistance, "raceCount"), details.raceCount);
assert.equal(analysis.invariants.missDistancePartitionCount, details.raceCount);

const expectedDistance = { exactHit: 0, thirdMiss: 1, secondThirdSwap: 2, opponentMiss: 3, winnerMiss: 4 };
const seenPrimary = Object.fromEntries(PRIMARY_ERROR_TYPES.map((key) => [key, 0]));
let winnerCoveredCount = 0;
let roiPopulationRaceCount = 0;
let investmentYen = 0;
let payoutYen = 0;
for (const race of details.races) {
	const sourceRace = sourceRaceByKey.get(race.raceKey);
	assert.ok(sourceRace, `source race missing: ${race.raceKey}`);
	const tickets = sourceRace.structuredTickets;
	const classification = classifyPredictionError(tickets, race.actualResult);
	const winnerTickets = tickets.filter((ticket) => Number(ticket.boatNumbers?.[0]) === race.actualWinner);
	const expectedSecondCandidates = uniqueLanes(winnerTickets.map((ticket) => ticket.boatNumbers?.[1]));
	const expectedThirdCandidates = uniqueLanes(winnerTickets.map((ticket) => ticket.boatNumbers?.[2]));
	const expectedOpponents = new Set([...expectedSecondCandidates, ...expectedThirdCandidates]);
	assert.ok(PRIMARY_ERROR_TYPES.includes(race.primaryErrorType), `unknown primary error: ${race.raceKey}`);
	seenPrimary[race.primaryErrorType] += 1;
	assert.equal(race.ticketCount, tickets.length, `ticket count mismatch: ${race.raceKey}`);
	assert.deepEqual(race.predictedSecondCandidates, expectedSecondCandidates, `second candidates mismatch: ${race.raceKey}`);
	assert.deepEqual(race.predictedThirdCandidates, expectedThirdCandidates, `third candidates mismatch: ${race.raceKey}`);
	assert.equal(race.exactHit, classification.exactHit, `exact hit mismatch: ${race.raceKey}`);
	assert.equal(race.winnerCovered, classification.winnerCovered, `winner coverage mismatch: ${race.raceKey}`);
	assert.equal(race.top2Covered, classification.top2Covered, `top2 coverage mismatch: ${race.raceKey}`);
	assert.equal(race.primaryErrorType, classification.primaryType, `primary error mismatch: ${race.raceKey}`);
	assert.equal(race.secondPositionCovered, expectedSecondCandidates.includes(race.actualSecond), `second position mismatch: ${race.raceKey}`);
	assert.equal(race.thirdPositionCovered, expectedThirdCandidates.includes(race.actualThird), `third position mismatch: ${race.raceKey}`);
	assert.equal(race.secondCovered, expectedOpponents.has(race.actualSecond), `second coverage mismatch: ${race.raceKey}`);
	assert.equal(race.thirdCovered, expectedOpponents.has(race.actualThird), `third coverage mismatch: ${race.raceKey}`);
	assert.equal(race.missDistance, expectedDistance[race.primaryErrorType], `miss distance mismatch: ${race.raceKey}`);
	assert.equal(race.actualResult.length, 3, `result length mismatch: ${race.raceKey}`);
	assert.equal(new Set(race.actualResult).size, 3, `duplicate result lane: ${race.raceKey}`);
	assert.ok(race.ticketCount > 0, `ticket count missing: ${race.raceKey}`);
	assert.ok(!race.secondPositionCovered || race.secondCovered, `second position coverage mismatch: ${race.raceKey}`);
	assert.ok(!race.thirdPositionCovered || race.thirdCovered, `third position coverage mismatch: ${race.raceKey}`);
	assert.equal(race.secondThirdSwap, race.primaryErrorType === "secondThirdSwap", `swap classification mismatch: ${race.raceKey}`);
	if (race.winnerCovered) {
		winnerCoveredCount += 1;
		const opponentPartition = [
			race.secondCovered && race.thirdCovered,
			race.secondOnlyMissing,
			race.thirdOnlyMissing,
			race.bothOpponentMissing,
		].filter(Boolean).length;
		assert.equal(opponentPartition, 1, `opponent partition mismatch: ${race.raceKey}`);
	} else {
		assert.equal(race.secondOnlyMissing, false);
		assert.equal(race.thirdOnlyMissing, false);
		assert.equal(race.bothOpponentMissing, false);
	}
	if (race.stakeEvidence.status === "source-backed") {
		assert.ok(["explicit-unit-amount", "explicit-equal-allocation"].includes(race.stakeEvidence.method));
		assert.ok(Number.isSafeInteger(race.stakeEvidence.unitStakeYen));
		assert.ok(Number.isSafeInteger(race.stakeEvidence.investmentYen));
		assert.equal(race.stakeEvidence.unitStakeYen * race.ticketCount, race.stakeEvidence.investmentYen);
		assert.ok(Number.isSafeInteger(race.trifectaPayoutYen));
		roiPopulationRaceCount += 1;
		investmentYen += race.stakeEvidence.investmentYen;
		payoutYen += race.exactHit ? race.trifectaPayoutYen : 0;
	} else {
		assert.equal(race.stakeEvidence.unitStakeYen, null);
		assert.equal(race.stakeEvidence.investmentYen, null);
	}
	assert.ok([null, "history-race", "racer-evidence-exact-race-frame"].includes(race.conditions.lane1ClassSource));
}

for (const key of PRIMARY_ERROR_TYPES) assert.equal(seenPrimary[key], analysis.overall[key], `${key} total mismatch`);
assert.equal(winnerCoveredCount, analysis.opponentCoverage.winnerCoveredRaceCount);
assert.equal(roiPopulationRaceCount, analysis.overall.roiPopulationRaceCount);
assert.equal(investmentYen, analysis.overall.investmentYen);
assert.equal(payoutYen, analysis.overall.payoutYen);
assert.equal(analysis.overall.hitRatePopulationRaceCount, details.raceCount);
assert.equal(analysis.overall.hitRate, roundedRate(analysis.overall.exactHit, details.raceCount));
assert.equal(analysis.overall.recoveryRate, roundedRate(payoutYen, investmentYen));
assert.equal(analysis.overall.investmentCoverageRate, roundedRate(roiPopulationRaceCount, details.raceCount));
assert.equal(analysis.overall.roiSampleStatus, sampleStatus(roiPopulationRaceCount));

const coverage = analysis.opponentCoverage;
assert.equal(coverage.secondOnlyMissingCount + coverage.thirdOnlyMissingCount + coverage.bothOpponentMissingCount + coverage.bothOpponentsCoveredCount, winnerCoveredCount);
assert.equal(coverage.secondCoveredCount, details.races.filter((race) => race.winnerCovered && race.secondCovered).length);
assert.equal(coverage.thirdCoveredCount, details.races.filter((race) => race.winnerCovered && race.thirdCovered).length);
assert.equal(coverage.secondPositionCoveredCount, details.races.filter((race) => race.winnerCovered && race.secondPositionCovered).length);
assert.equal(coverage.thirdPositionCoveredCount, details.races.filter((race) => race.winnerCovered && race.thirdPositionCovered).length);
assert.equal(sum(analysis.opponentMatrix.second, "sampleCount"), winnerCoveredCount);
assert.equal(sum(analysis.opponentMatrix.third, "sampleCount"), winnerCoveredCount);
assert.equal(analysis.invariants.opponentSecondMatrixSampleCount, winnerCoveredCount);
assert.equal(analysis.invariants.opponentThirdMatrixSampleCount, winnerCoveredCount);

assert.equal(analysis.stakeAudit.candidateEvaluatedRaceCount, details.raceCount);
assert.equal(analysis.stakeAudit.safeSourceBackedRaceCount, roiPopulationRaceCount);
assert.equal(analysis.stakeAudit.safeSourceBackedRaceCount + analysis.stakeAudit.unresolvedRaceCount, details.raceCount);
assert.equal(analysis.stakeAudit.metadataOnlyRejectedRaceCount, analysis.stakeAudit.metadataCandidateRaceCount - analysis.stakeAudit.safeSourceBackedRaceCount);
assert.equal(analysis.classCoverageAudit.populationRaceCount, details.raceCount);
assert.equal(analysis.classCoverageAudit.evidenceConflictCount, 0);
assert.ok(analysis.classCoverageAudit.lane1Class.after >= analysis.classCoverageAudit.lane1Class.before);
assert.ok(analysis.classCoverageAudit.classComposition.after >= analysis.classCoverageAudit.classComposition.before);

for (const [dimensionName, entries] of Object.entries(analysis.dimensions)) {
	const ids = new Set();
	for (const entry of entries) {
		assert.ok(!ids.has(entry.id), `duplicate ${dimensionName} id: ${entry.id}`);
		ids.add(entry.id);
		assert.equal(PRIMARY_ERROR_TYPES.reduce((total, key) => total + entry[key], 0), entry.hitRatePopulationRaceCount, `${dimensionName}:${entry.id} primary partition mismatch`);
		assert.ok(entry.roiPopulationRaceCount <= entry.hitRatePopulationRaceCount);
		assert.equal(entry.hitRate, roundedRate(entry.exactHit, entry.hitRatePopulationRaceCount));
		assert.equal(entry.recoveryRate, roundedRate(entry.payoutYen, entry.investmentYen));
		assert.equal(entry.roiSampleStatus, sampleStatus(entry.roiPopulationRaceCount));
	}
}
for (const dimensionName of ["venue", "raceNo", "raceNoGroup", "actualWinningLane"]) {
	assert.equal(sum(analysis.dimensions[dimensionName], "hitRatePopulationRaceCount"), details.raceCount, `${dimensionName} population mismatch`);
	assert.equal(sum(analysis.dimensions[dimensionName], "investmentYen"), investmentYen, `${dimensionName} investment mismatch`);
	assert.equal(sum(analysis.dimensions[dimensionName], "payoutYen"), payoutYen, `${dimensionName} payout mismatch`);
}

const fixtureRace = (tickets) => analyzePredictionAccuracyRace({
	race: {
		date: "2026-09-30",
		venueCode: "01",
		venueName: "fixture",
		raceNo: 1,
		structuredTickets: tickets.map((boatNumbers, index) => ({ ticketId: `fixture-${index}`, group: "本線", boatNumbers })),
		officialResult: { finishOrder: [1, 2, 3], trifectaPayoutYen: 1000 },
	},
	historyRecord: { raceKey: "2026-09-30:01:01", prediction: { textExcerpt: "" }, officialRace: { racers: [] } },
});
const reverseOnly = fixtureRace([[1, 3, 2]]);
assert.equal(reverseOnly.secondThirdSwap, true);
assert.equal(reverseOnly.primaryErrorType, "secondThirdSwap");
assert.equal(reverseOnly.missDistance, 2);
const correctAndReverse = fixtureRace([[1, 2, 3], [1, 3, 2]]);
assert.equal(correctAndReverse.exactHit, true);
assert.equal(correctAndReverse.secondThirdSwap, false);
assert.equal(correctAndReverse.primaryErrorType, "exactHit");
assert.equal(correctAndReverse.missDistance, 0);

console.log(JSON.stringify({
	ok: true,
	schemaVersion: analysis.schemaVersion,
	period: analysis.period,
	evaluationEligibility: analysis.evaluationEligibility,
	overall: analysis.overall,
	opponentCoverage: analysis.opponentCoverage,
	missDistance: analysis.missDistance,
	stakeAudit: analysis.stakeAudit,
	classCoverageAudit: analysis.classCoverageAudit,
	dimensionCounts: Object.fromEntries(Object.entries(analysis.dimensions).map(([key, entries]) => [key, entries.length])),
	invariants: analysis.invariants,
}, null, 2));
