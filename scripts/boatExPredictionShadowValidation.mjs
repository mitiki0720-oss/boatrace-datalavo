import {
	buildCounterfactualTickets,
	buildStrategyPreRaceFeatures,
	buildStrategyTrainingModel,
	evaluateTicketSet,
	ticketKey,
} from "./boatExPredictionStrategyAnalysis.mjs";
import { raceNoGroup, windSpeedBucket } from "./boatExPredictionStructureAnalysis.mjs";

export const SHADOW_SCHEMA_VERSION = "boat-ex-prediction-shadow-validation-v1";
export const SHADOW_START_DATE = "2026-10-01";
export const SHADOW_CHECKPOINTS = [100, 300, 500, 1000];
export const SHADOW_STRATEGIES = {
	"third-expansion-v1": {
		baseStrategyId: "third-expansion",
		label: "Strategy B Third Expansion",
		role: "candidate",
	},
	"reverse-pair-v1": {
		baseStrategyId: "reverse-pair",
		label: "Strategy A Reverse Pair",
		role: "control",
	},
};

const roundRate = (value, population) => population > 0 ? Number((value / population).toFixed(4)) : null;

export function addDays(date, amount) {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + amount);
	return value.toISOString().slice(0, 10);
}

export function buildShadowRaceKey(date, venueCode, raceNo) {
	return `${date}:${String(venueCode).padStart(2, "0")}:${String(Number(raceNo)).padStart(2, "0")}`;
}

export function resolveRaceStartBoundary({ date, race }) {
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(date ?? ""))) return null;
	for (const source of ["startTime", "deadlineTime", "deadline", "closeTime"]) {
		const value = String(race?.[source] ?? "").trim();
		if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(value)) continue;
		const at = `${date}T${value}:00+09:00`;
		if (Number.isFinite(Date.parse(at))) return { at, source, value };
	}
	return null;
}

function validTicket(ticket) {
	const boats = ticket?.boatNumbers?.map(Number);
	return boats?.length === 3
		&& new Set(boats).size === 3
		&& boats.every((boat) => Number.isInteger(boat) && boat >= 1 && boat <= 6);
}

export function normalizeFormalPredictionTickets(prediction) {
	const tickets = (prediction?.tickets ?? []).flatMap((ticket, index) => {
		if (String(ticket?.betType ?? "").trim() !== "3連単") return [];
		const combination = String(ticket?.combination ?? "").trim();
		const match = combination.match(/^([1-6])-([1-6])-([1-6])$/u);
		if (!match) return [];
		const boatNumbers = match.slice(1).map(Number);
		const normalized = {
			ticketId: String(ticket?.index ?? index + 1).padStart(2, "0"),
			group: String(ticket?.group ?? "unclassified-source-text"),
			boatNumbers,
			sourceCombination: combination,
		};
		return validTicket(normalized) ? [normalized] : [];
	});
	return tickets.length === 10 && new Set(tickets.map(ticketKey)).size === 10 ? tickets : [];
}

export function extractPreRaceFeatureSource({ venueCode, raceNo, race, sourceTimestamp }) {
	const racers = Array.isArray(race?.racers) ? race.racers : [];
	const lane1 = racers.find((racer) => Number(racer?.lane ?? racer?.frame ?? racer?.frameNo) === 1);
	const weather = race?.weatherActual ?? race?.weather ?? null;
	return {
		venueCode: String(venueCode),
		raceNo: Number(raceNo),
		raceNoGroup: raceNoGroup(raceNo),
		windSpeedBucket: windSpeedBucket(weather?.windSpeed ?? weather?.windSpeedMps),
		lane1Class: String(lane1?.grade ?? lane1?.class ?? lane1?.rank ?? "").trim().toUpperCase() || null,
		sourceTimestamp,
	};
}

function cloneTickets(tickets) {
	return tickets.map((ticket) => ({ ...ticket, boatNumbers: ticket.boatNumbers.map(Number) }));
}

export function buildProspectiveShadowRecord({
	formalPrediction,
	raceIdentity,
	preRaceFeatureSource,
	raceStartBoundary,
	trainingRecords,
	generatedAt,
	startDate = SHADOW_START_DATE,
}) {
	const baselineTickets = normalizeFormalPredictionTickets(formalPrediction);
	if (raceIdentity.date < startDate) return { status: "skipped", reason: "before-shadow-start-date" };
	if (baselineTickets.length !== 10) return { status: "ineligible", reason: "baseline-ticket-contract-invalid" };
	const baselinePredictionGeneratedAt = formalPrediction?.sourceRecordSavedAt
		?? formalPrediction?.savedAt
		?? formalPrediction?.updatedAt
		?? null;
	const sourceFeatureTimestamp = preRaceFeatureSource?.sourceTimestamp ?? null;
	const raceStartBoundaryAt = raceStartBoundary?.at ?? null;
	const raceStartBoundarySource = raceStartBoundary?.source ?? null;
	if (!Number.isFinite(Date.parse(raceStartBoundaryAt)) || !raceStartBoundarySource) {
		return { status: "ineligible", reason: "pre-race-timing-unknown" };
	}
	const timestamps = [baselinePredictionGeneratedAt, sourceFeatureTimestamp, generatedAt].map((value) => Date.parse(value));
	if (timestamps.some((value) => !Number.isFinite(value)) || timestamps[0] > timestamps[2] || timestamps[1] > timestamps[2]) {
		return { status: "ineligible", reason: "pre-race-timestamp-invalid" };
	}
	const boundaryTime = Date.parse(raceStartBoundaryAt);
	if (timestamps[0] >= boundaryTime) return { status: "ineligible", reason: "baseline-not-created-before-race-start" };
	if (timestamps[1] >= boundaryTime) return { status: "ineligible", reason: "pre-race-features-not-created-before-race-start" };
	if (timestamps[2] >= boundaryTime) return { status: "ineligible", reason: "shadow-not-created-before-race-start" };
	const trainingCutoffDate = addDays(raceIdentity.date, -1);
	const eligibleTraining = trainingRecords.filter((record) => record.date <= trainingCutoffDate && record.date < raceIdentity.date);
	const trainingModel = buildStrategyTrainingModel(eligibleTraining);
	const preRaceFeatures = buildStrategyPreRaceFeatures({
		venueCode: raceIdentity.venueCode,
		raceNo: raceIdentity.raceNo,
		raceNoGroup: preRaceFeatureSource.raceNoGroup,
		conditions: {
			windSpeedBucket: preRaceFeatureSource.windSpeedBucket,
			lane1Class: preRaceFeatureSource.lane1Class,
		},
	}, baselineTickets);
	const trainingWindow = {
		from: eligibleTraining[0]?.date ?? null,
		to: trainingCutoffDate,
	};
	const strategies = Object.fromEntries(Object.entries(SHADOW_STRATEGIES).map(([version, config]) => {
		const built = buildCounterfactualTickets({
			strategyId: config.baseStrategyId,
			baselineTickets,
			preRaceFeatures,
			trainingModel,
			trainingWindow,
		});
		return [version, {
			strategyId: version,
			baseStrategyId: config.baseStrategyId,
			label: config.label,
			role: config.role,
			shadowTickets: cloneTickets(built.strategyTickets),
			addedTickets: cloneTickets(built.addedTickets),
			removedTickets: cloneTickets(built.removedTickets),
			changed: built.changed,
			reason: built.reason,
			conditionKey: built.conditionKey,
			conditionTrainingSampleCount: built.trainingSampleCount,
		}];
	}));
	const candidate = strategies["third-expansion-v1"];
	return {
		status: "created",
		record: {
			schemaVersion: SHADOW_SCHEMA_VERSION,
			raceKey: buildShadowRaceKey(raceIdentity.date, raceIdentity.venueCode, raceIdentity.raceNo),
			date: raceIdentity.date,
			venueCode: String(raceIdentity.venueCode).padStart(2, "0"),
			venueName: raceIdentity.venueName,
			raceNo: Number(raceIdentity.raceNo),
			lifecycle: "PENDING",
			strategyId: "third-expansion-v1",
			baselineTickets: cloneTickets(baselineTickets),
			shadowTickets: cloneTickets(candidate.shadowTickets),
			addedTickets: cloneTickets(candidate.addedTickets),
			removedTickets: cloneTickets(candidate.removedTickets),
			strategies,
			generatedAt,
			firstGeneratedAt: generatedAt,
			baselinePredictionGeneratedAt,
			sourceFeatureTimestamp,
			raceStartBoundaryAt,
			raceStartBoundarySource,
			raceStartBoundaryValue: raceStartBoundary.value,
			trainingCutoffDate,
			trainingSampleCount: eligibleTraining.length,
			trainingWindow,
			preRaceFeatures,
			evaluation: null,
		},
	};
}

function primaryError(evaluation) {
	if (evaluation.exactHit) return "exactHit";
	if (evaluation.winnerMiss) return "winnerMiss";
	if (evaluation.secondThirdSwap) return "secondThirdSwap";
	if (evaluation.thirdMiss) return "thirdMiss";
	return "opponentMiss";
}

export function evaluateShadowRecord(record, { actualResult, resultSourceTimestamp, evaluatedAt }) {
	if (record.lifecycle !== "PENDING") return record;
	if (!Array.isArray(actualResult) || actualResult.length < 3) return record;
	const generatedTime = Date.parse(record.firstGeneratedAt);
	const resultTime = Date.parse(resultSourceTimestamp);
	if (!Number.isFinite(generatedTime) || !Number.isFinite(resultTime) || generatedTime >= resultTime) {
		return { ...record, lifecycle: "INELIGIBLE", ineligibleReason: "shadow-not-created-before-official-result" };
	}
	const baseline = evaluateTicketSet(record.baselineTickets, actualResult);
	const strategies = Object.fromEntries(Object.entries(record.strategies).map(([strategyId, strategy]) => {
		const shadow = evaluateTicketSet(strategy.shadowTickets, actualResult);
		const outcome = !baseline.exactHit && shadow.exactHit
			? "improved"
			: baseline.exactHit && !shadow.exactHit
				? "degraded"
				: baseline.exactHit
					? "unchangedHit"
					: "unchangedMiss";
		return [strategyId, {
			baseline: { ...baseline, primaryError: primaryError(baseline) },
			shadow: { ...shadow, primaryError: primaryError(shadow) },
			outcome,
		}];
	}));
	return {
		...record,
		lifecycle: "EVALUATED",
		evaluation: {
			evaluatedAt,
			resultSourceTimestamp,
			officialResult: actualResult.slice(0, 3).map(Number),
			strategies,
		},
	};
}

function emptyMetric() {
	return {
		raceCount: 0,
		exactHit: 0,
		winnerCovered: 0,
		secondPositionCovered: 0,
		thirdPositionCovered: 0,
		thirdMiss: 0,
		secondThirdSwap: 0,
		opponentMiss: 0,
		winnerMiss: 0,
	};
}

function addMetric(metric, evaluation) {
	metric.raceCount += 1;
	for (const key of ["exactHit", "winnerCovered", "secondPositionCovered", "thirdPositionCovered", "thirdMiss", "secondThirdSwap", "opponentMiss", "winnerMiss"]) {
		metric[key] += Number(Boolean(evaluation[key]));
	}
}

function finalizeMetric(metric) {
	return {
		...metric,
		exactHitRate: roundRate(metric.exactHit, metric.raceCount),
		winnerCoverageRate: roundRate(metric.winnerCovered, metric.raceCount),
		secondPositionCoverageRate: roundRate(metric.secondPositionCovered, metric.raceCount),
		thirdPositionCoverageRate: roundRate(metric.thirdPositionCovered, metric.raceCount),
	};
}

function pairedUncertainty(outcomes) {
	const evaluatedRaceCount = outcomes.length;
	const improved = outcomes.filter((value) => value === "improved").length;
	const degraded = outcomes.filter((value) => value === "degraded").length;
	if (evaluatedRaceCount < 100 || improved + degraded < 20) {
		return { status: "insufficient", evaluatedRaceCount, discordantPairCount: improved + degraded, netRate: roundRate(improved - degraded, evaluatedRaceCount), confidenceInterval95: null, method: "paired-binary-normal-approximation" };
	}
	const values = outcomes.map((value) => value === "improved" ? 1 : value === "degraded" ? -1 : 0);
	const mean = values.reduce((sum, value) => sum + value, 0) / evaluatedRaceCount;
	const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / Math.max(1, evaluatedRaceCount - 1);
	const margin = 1.96 * Math.sqrt(variance / evaluatedRaceCount);
	return {
		status: "available",
		evaluatedRaceCount,
		discordantPairCount: improved + degraded,
		netRate: Number(mean.toFixed(4)),
		confidenceInterval95: [Number((mean - margin).toFixed(4)), Number((mean + margin).toFixed(4))],
		method: "paired-binary-normal-approximation",
	};
}

function summarizeSubset(records, strategyId) {
	const baselineMetric = emptyMetric();
	const shadowMetric = emptyMetric();
	const outcomes = [];
	for (const record of records) {
		const evaluation = record.evaluation?.strategies?.[strategyId];
		if (!evaluation) continue;
		addMetric(baselineMetric, evaluation.baseline);
		addMetric(shadowMetric, evaluation.shadow);
		outcomes.push(evaluation.outcome);
	}
	const baseline = finalizeMetric(baselineMetric);
	const shadow = finalizeMetric(shadowMetric);
	return {
		evaluatedRaceCount: baseline.raceCount,
		baseline,
		shadow,
		netExactHitGain: shadow.exactHit - baseline.exactHit,
		improvedRaceCount: outcomes.filter((value) => value === "improved").length,
		degradedRaceCount: outcomes.filter((value) => value === "degraded").length,
		unchangedHitRaceCount: outcomes.filter((value) => value === "unchangedHit").length,
		unchangedMissRaceCount: outcomes.filter((value) => value === "unchangedMiss").length,
		pairedUncertainty: pairedUncertainty(outcomes),
	};
}

export function summarizeShadowValidation(records, generatedAt, ineligibleAttempts = []) {
	const evaluated = records.filter((record) => record.lifecycle === "EVALUATED").sort((left, right) => left.date.localeCompare(right.date) || left.raceKey.localeCompare(right.raceKey));
	const recordKeys = new Set(records.map((record) => record.raceKey));
	const activeIneligibleAttempts = ineligibleAttempts.filter((attempt) => !recordKeys.has(attempt.raceKey));
	const strategySummaries = Object.fromEntries(Object.entries(SHADOW_STRATEGIES).map(([strategyId, config]) => {
		const summary = summarizeSubset(evaluated, strategyId);
		return [strategyId, {
			strategyId,
			label: config.label,
			role: config.role,
			...summary,
			checkpoints: SHADOW_CHECKPOINTS.map((checkpoint) => ({
				checkpoint,
				status: summary.evaluatedRaceCount >= checkpoint ? "reached" : "insufficient",
				...summarizeSubset(evaluated.slice(0, Math.min(checkpoint, evaluated.length)), strategyId),
			})),
		}];
	}));
	const candidateId = "third-expansion-v1";
	let cumulativeNetGain = 0;
	const dates = [...new Set(evaluated.map((record) => record.date))];
	const daily = dates.map((date) => {
		const summary = summarizeSubset(evaluated.filter((record) => record.date === date), candidateId);
		cumulativeNetGain += summary.netExactHitGain;
		return { date, evaluatedR: summary.evaluatedRaceCount, baselineExact: summary.baseline.exactHit, shadowExact: summary.shadow.exactHit, netGain: summary.netExactHitGain, improved: summary.improvedRaceCount, degraded: summary.degradedRaceCount, cumulativeNetGain };
	});
	const venues = [...new Map(evaluated.map((record) => [record.venueCode, record.venueName])).entries()].map(([venueCode, venueName]) => {
		const summary = summarizeSubset(evaluated.filter((record) => record.venueCode === venueCode), candidateId);
		return { venueCode, venueName, evaluatedR: summary.evaluatedRaceCount, baselineExact: summary.baseline.exactHit, shadowExact: summary.shadow.exactHit, netGain: summary.netExactHitGain };
	}).sort((left, right) => left.venueCode.localeCompare(right.venueCode));
	return {
		schemaVersion: SHADOW_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-shadow-validation-summary",
		generatedAt,
		startDate: SHADOW_START_DATE,
		strategyVersions: Object.keys(SHADOW_STRATEGIES),
			summary: {
			generatedShadowRaceCount: records.filter((record) => record.lifecycle !== "INELIGIBLE").length,
			pendingRaceCount: records.filter((record) => record.lifecycle === "PENDING").length,
			evaluatedRaceCount: evaluated.length,
			ineligibleRaceCount: records.filter((record) => record.lifecycle === "INELIGIBLE").length + activeIneligibleAttempts.length,
			retroGeneratedRaceCount: records.filter((record) => record.date < SHADOW_START_DATE).length,
			postResultGeneratedRaceCount: records.filter((record) => record.lifecycle === "INELIGIBLE" && record.ineligibleReason === "shadow-not-created-before-official-result").length,
			postStartGeneratedRaceCount: records.filter((record) => Date.parse(record.firstGeneratedAt) >= Date.parse(record.raceStartBoundaryAt)).length,
			baselinePostStartRaceCount: records.filter((record) => Date.parse(record.baselinePredictionGeneratedAt) >= Date.parse(record.raceStartBoundaryAt)).length,
			preRaceTimingUnknownCount: activeIneligibleAttempts.filter((attempt) => attempt.reason === "pre-race-timing-unknown").length,
			sameDayTrainingLeakageCount: records.filter((record) => record.trainingCutoffDate >= record.date).length,
		},
		strategies: strategySummaries,
		daily,
		venues,
		roiReference: {
			selectionUse: false,
			populationRaceCount: 0,
			status: "insufficient",
			policy: "ROI is reference-only and requires source-backed stake paired with official payout.",
		},
		policies: [
			"Formal prediction tickets are never replaced by shadow tickets.",
			"Shadow generation receives pre-race features and historical training records, never the current race result or payout.",
			"Training data is limited to dates before the shadow race date.",
			"Strategy versions are frozen; results from different versions are not mixed.",
			"No strategy is adopted automatically at a checkpoint.",
		],
	};
}
