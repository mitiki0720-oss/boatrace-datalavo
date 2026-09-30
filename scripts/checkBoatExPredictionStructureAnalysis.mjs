import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
	ANALYSIS_SCHEMA_VERSION,
	classifyPredictionError,
	resolveEvaluationEligibility,
	sampleStatus,
} from "./boatExPredictionStructureAnalysis.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const sourceSummary = readJson("public/data/boatrace-ex/derived/prediction-structure/history-summary.json");
const analysis = readJson("public/data/boatrace-ex/derived/prediction-structure-analysis/history-summary.json");
const latest = readJson("public/data/boatrace-ex/derived/prediction-structure-analysis/latest.json");
const audit = readJson(`public/data/boatrace-ex/audit/prediction-structure-analysis-${index.latestDate}.generated.json`);

assert.equal(analysis.schemaVersion, ANALYSIS_SCHEMA_VERSION);
assert.equal(latest.schemaVersion, ANALYSIS_SCHEMA_VERSION);
assert.equal(analysis.kind, "boatrace-ex-prediction-structure-analysis-history-summary");
assert.equal(latest.kind, "boatrace-ex-prediction-structure-analysis-latest");
assert.equal(analysis.period.to, index.latestDate);
assert.equal(analysis.period.dateCount, index.availableDates.length);
assert.deepEqual(latest.dimensions, analysis.dimensions);
assert.deepEqual(latest.errorStructure, analysis.errorStructure);
assert.deepEqual(audit.invariants, analysis.invariants);

const sourceKeys = [
	"historyRaceCount",
	"structuredTicketAvailableRaceCount",
	"structuredTicketCount",
	"classifiedTicketCount",
	"unclassifiedTicketCount",
	"evaluatedPredictionRaceCount",
	"hitRaceCount",
	"totalSourceBackedInvestmentYen",
	"totalSourceBackedPayoutYen",
];
for (const key of sourceKeys) assert.equal(analysis.sourceTotals[key], sourceSummary[key], `v1 source total changed: ${key}`);

const sum = (entries, key) => entries.reduce((total, entry) => total + Number(entry[key] ?? 0), 0);
assert.equal(sum(analysis.dimensions.venue, "ticketCount"), analysis.sourceTotals.structuredTicketCount);
assert.equal(sum(analysis.dimensions.raceNo, "ticketCount"), analysis.sourceTotals.structuredTicketCount);
assert.equal(sum(analysis.dimensions.raceNoGroup, "ticketCount"), analysis.sourceTotals.structuredTicketCount);
assert.equal(sum(analysis.dimensions.firstPlacePredictedLane, "ticketCount"), analysis.sourceTotals.structuredTicketCount);
assert.equal(sum(analysis.dimensions.category, "ticketCount"), analysis.sourceTotals.classifiedTicketCount);
assert.equal(analysis.invariants.venueTicketCount, analysis.sourceTotals.structuredTicketCount);
assert.equal(analysis.invariants.raceNoTicketCount, analysis.sourceTotals.structuredTicketCount);
assert.equal(analysis.invariants.categoryTicketCount, analysis.sourceTotals.classifiedTicketCount);
assert.equal(analysis.invariants.duplicateRaceKeyCount, 0);
assert.equal(analysis.invariants.duplicateTicketCount, 0);

const eligibility = analysis.evaluationEligibility;
assert.equal(
	eligibility.candidateEvaluatedRaceCount,
	eligibility.eligibleRaceCount + eligibility.unknownRaceCount + eligibility.futureLeakageRaceCount,
);
assert.equal(analysis.overall.evaluatedRaceCount, eligibility.eligibleRaceCount);
assert.equal(analysis.errorStructure.evaluatedRaceCount, eligibility.eligibleRaceCount);
assert.equal(analysis.errorStructure.exactHit, analysis.overall.hitCount);
assert.equal(
	Object.values(analysis.errorStructure.primary).reduce((total, value) => total + value, 0),
	eligibility.eligibleRaceCount,
);
assert.equal(analysis.invariants.primaryErrorClassificationCount, eligibility.eligibleRaceCount);

for (const [name, missing] of Object.entries(analysis.missingness)) {
	assert.equal(missing.populationRaceCount, eligibility.eligibleRaceCount, `${name} population mismatch`);
	assert.equal(missing.availableRaceCount + missing.missingRaceCount, missing.populationRaceCount, `${name} missingness mismatch`);
	const dimension = name === "raceNo" ? analysis.dimensions.raceNoGroup : analysis.dimensions[name];
	assert.equal(sum(dimension, "evaluatedRaceCount"), missing.availableRaceCount, `${name} dimension coverage mismatch`);
}

for (const entries of Object.values(analysis.dimensions)) {
	const ids = new Set();
	for (const entry of entries) {
		assert.ok(!ids.has(entry.id), `duplicate dimension id: ${entry.id}`);
		ids.add(entry.id);
		assert.equal(entry.sampleStatus, sampleStatus(entry.evaluatedRaceCount));
		assert.ok(entry.ticketCount >= entry.eligibleTicketCount);
		assert.ok(entry.evaluatedRaceCount >= entry.hitCount);
		assert.ok(entry.investmentYen >= 0 && entry.payoutYen >= 0 && entry.unpairedPayoutYen >= 0);
		if (entry.investmentYen > 0) assert.equal(entry.recoveryRate, Number((entry.payoutYen / entry.investmentYen).toFixed(4)));
	}
}
assert.ok(analysis.dimensions.weather.every((entry) => !/^(?:unknown|未取得|確認中|取得済み|null|なし|-+)$/iu.test(entry.id)));

for (const dimensionName of ["venue", "raceNo", "raceNoGroup"]) {
	const entries = analysis.dimensions[dimensionName];
	assert.equal(sum(entries, "investmentYen"), analysis.overall.investmentYen, `${dimensionName} investment total mismatch`);
	assert.equal(sum(entries, "payoutYen"), analysis.overall.payoutYen, `${dimensionName} payout total mismatch`);
	assert.equal(sum(entries, "unpairedPayoutYen"), analysis.overall.unpairedPayoutYen, `${dimensionName} unpaired payout mismatch`);
}

const fixtureTickets = (values) => values.map((boatNumbers, index) => ({ ticketId: `f-${index}`, boatNumbers }));
assert.equal(classifyPredictionError(fixtureTickets([[1, 2, 3]]), [1, 2, 3]).primaryType, "exactHit");
assert.equal(classifyPredictionError(fixtureTickets([[2, 1, 3]]), [1, 2, 3]).primaryType, "winnerMiss");
assert.equal(classifyPredictionError(fixtureTickets([[1, 3, 2]]), [1, 2, 3]).primaryType, "secondThirdSwap");
assert.equal(classifyPredictionError(fixtureTickets([[1, 2, 4]]), [1, 2, 3]).primaryType, "thirdMiss");
assert.equal(classifyPredictionError(fixtureTickets([[1, 4, 5]]), [1, 2, 3]).primaryType, "opponentMiss");
assert.equal(classifyPredictionError(fixtureTickets([[1, 5, 3]]), [1, 2, 3]).top2Covered, false);

const timestampFixture = (prediction, result) => ({
	prediction: { sources: prediction ? [{ generatedAt: prediction }] : [] },
	officialResult: { sources: result ? [{ generatedAt: result }] : [], payout: [] },
});
assert.equal(resolveEvaluationEligibility(timestampFixture("2026-09-30T00:00:00Z", "2026-09-30T01:00:00Z")).status, "eligible");
assert.equal(resolveEvaluationEligibility(timestampFixture("2026-09-30T02:00:00Z", "2026-09-30T01:00:00Z")).status, "future-leakage");
assert.equal(resolveEvaluationEligibility(timestampFixture(null, "2026-09-30T01:00:00Z")).status, "unknown");

const seenRaceKeys = new Set();
let duplicateRaceKeyCount = 0;
let duplicateTicketCount = 0;
let recomputedEligible = 0;
let recomputedUnknown = 0;
let recomputedFuture = 0;
for (const date of index.availableDates) {
	const shard = readJson(`public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`);
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	const historyMap = new Map(history.records.map((record) => [`${record.date}:${record.venueCode}:${String(Number(record.raceNo)).padStart(2, "0")}`, record]));
	for (const race of shard.races) {
		const raceKey = `${race.date}:${race.venueCode}:${String(Number(race.raceNo)).padStart(2, "0")}`;
		if (seenRaceKeys.has(raceKey)) duplicateRaceKeyCount += 1;
		seenRaceKeys.add(raceKey);
		const ticketKeys = race.structuredTickets.map((ticket) => `${ticket.group}:${ticket.boatNumbers.join("-")}`);
		duplicateTicketCount += ticketKeys.length - new Set(ticketKeys).size;
		if (race.evaluation.evaluationStatus !== "evaluated") continue;
		const status = resolveEvaluationEligibility(historyMap.get(raceKey)).status;
		if (status === "eligible") recomputedEligible += 1;
		if (status === "unknown") recomputedUnknown += 1;
		if (status === "future-leakage") recomputedFuture += 1;
	}
}
assert.equal(duplicateRaceKeyCount, 0);
assert.equal(duplicateTicketCount, 0);
assert.equal(recomputedEligible, eligibility.eligibleRaceCount);
assert.equal(recomputedUnknown, eligibility.unknownRaceCount);
assert.equal(recomputedFuture, eligibility.futureLeakageRaceCount);

console.log(JSON.stringify({
	ok: true,
	schemaVersion: analysis.schemaVersion,
	period: analysis.period,
	sourceTotals: analysis.sourceTotals,
	evaluationEligibility: {
		candidateEvaluatedRaceCount: eligibility.candidateEvaluatedRaceCount,
		eligibleRaceCount: eligibility.eligibleRaceCount,
		unknownRaceCount: eligibility.unknownRaceCount,
		futureLeakageRaceCount: eligibility.futureLeakageRaceCount,
	},
	overall: analysis.overall,
	missingness: analysis.missingness,
	errorStructure: analysis.errorStructure,
	dimensionCounts: Object.fromEntries(Object.entries(analysis.dimensions).map(([key, entries]) => [key, entries.length])),
	invariants: analysis.invariants,
}, null, 2));
