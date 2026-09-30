import { classifyPredictionError, raceNoGroup } from "./boatExPredictionStructureAnalysis.mjs";

export const STRATEGY_SCHEMA_VERSION = "boat-ex-prediction-strategy-analysis-v1";
export const STRATEGY_IDS = ["reverse-pair", "third-expansion", "symmetry", "winner-diversification"];
export const STRATEGY_CONFIG = {
	"reverse-pair": { label: "Strategy A Reverse Pair", minimumSampleCount: 80, minimumRate: 0.06, signal: "swapRate" },
	"third-expansion": { label: "Strategy B Third Expansion", minimumSampleCount: 80, minimumRate: 0.22, signal: "thirdMissRate" },
	"symmetry": { label: "Strategy C Symmetry", minimumSampleCount: 120, minimumRate: 0.08, signal: "swapRate" },
	"winner-diversification": { label: "Strategy D Winner Diversification", minimumSampleCount: 120, minimumRate: 0.12, signal: "winnerMissRate" },
};

const roundRate = (value, population) => population > 0 ? Number((value / population).toFixed(4)) : null;
export const ticketKey = (ticket) => ticket.boatNumbers.map(Number).join("-");
const validTicket = (ticket) => ticket?.boatNumbers?.length === 3
	&& new Set(ticket.boatNumbers.map(Number)).size === 3
	&& ticket.boatNumbers.every((lane) => Number.isInteger(Number(lane)) && Number(lane) >= 1 && Number(lane) <= 6);

export function cloneBaselineTickets(tickets) {
	return tickets.map((ticket) => ({ ...ticket, boatNumbers: ticket.boatNumbers.map(Number), strategyGenerated: false }));
}

export function buildStrategyPreRaceFeatures(raceAnalysis, tickets) {
	const winnerCounts = new Map();
	for (const ticket of tickets) {
		const lane = Number(ticket.boatNumbers?.[0]);
		winnerCounts.set(lane, (winnerCounts.get(lane) ?? 0) + 1);
	}
	const primaryPredictedWinner = [...winnerCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
	return {
		venueCode: String(raceAnalysis.venueCode),
		raceNoGroup: raceAnalysis.raceNoGroup ?? raceNoGroup(raceAnalysis.raceNo),
		primaryPredictedWinner,
		predictedWinnerCandidates: [...winnerCounts.keys()].sort((a, b) => a - b),
		windSpeedBucket: raceAnalysis.conditions?.windSpeedBucket ?? "unknown",
		lane1Class: raceAnalysis.conditions?.lane1Class ?? null,
		categories: [...new Set(tickets.map((ticket) => ticket.group).filter(Boolean))].sort(),
	};
}

function featureKeys(features) {
	const base = `${features.raceNoGroup}|W${features.primaryPredictedWinner ?? "u"}`;
	const wind = `${base}|${features.windSpeedBucket}`;
	return [
		`v:${features.venueCode}|${wind}|C:${features.lane1Class ?? "u"}`,
		`v:${features.venueCode}|${wind}`,
		`g:${wind}`,
		`g:${base}`,
	];
}

function emptyCondition(key) {
	return { key, sampleCount: 0, swapCount: 0, thirdMissCount: 0, winnerMissCount: 0, resultCounts: new Map(), thirdCounts: new Map(), winnerCounts: new Map() };
}

function addCount(map, key, count = 1) {
	map.set(key, (map.get(key) ?? 0) + count);
}

export function buildStrategyTrainingModel(trainingRecords) {
	const conditions = new Map();
	const ticketUtility = new Map();
	for (const record of trainingRecords) {
		const resultKey = record.actualResult.join("-");
		for (const key of featureKeys(record.preRaceFeatures)) {
			if (!conditions.has(key)) conditions.set(key, emptyCondition(key));
			const cell = conditions.get(key);
			cell.sampleCount += 1;
			cell.swapCount += Number(record.primaryErrorType === "secondThirdSwap");
			cell.thirdMissCount += Number(record.primaryErrorType === "thirdMiss");
			cell.winnerMissCount += Number(record.primaryErrorType === "winnerMiss");
			addCount(cell.resultCounts, resultKey);
			addCount(cell.thirdCounts, String(record.actualThird));
			addCount(cell.winnerCounts, String(record.actualWinner));
		}
		for (const ticket of record.baselineTickets) {
			for (const key of [`${record.preRaceFeatures.raceNoGroup}|${ticket.group}|W${ticket.boatNumbers[0]}`, `${ticket.group}|W${ticket.boatNumbers[0]}`, `${ticket.group}`]) {
				if (!ticketUtility.has(key)) ticketUtility.set(key, { sampleCount: 0, exactHitCount: 0 });
				const cell = ticketUtility.get(key);
				cell.sampleCount += 1;
				cell.exactHitCount += Number(ticketKey(ticket) === resultKey);
			}
		}
	}
	for (const cell of conditions.values()) {
		cell.swapRate = roundRate(cell.swapCount, cell.sampleCount);
		cell.thirdMissRate = roundRate(cell.thirdMissCount, cell.sampleCount);
		cell.winnerMissRate = roundRate(cell.winnerMissCount, cell.sampleCount);
	}
	return { trainingRaceCount: trainingRecords.length, conditions, ticketUtility };
}

function resolveCondition(model, features, config) {
	for (const key of featureKeys(features)) {
		const cell = model.conditions.get(key);
		if (cell && cell.sampleCount >= config.minimumSampleCount && Number(cell[config.signal]) >= config.minimumRate) return cell;
	}
	return null;
}

function utilityRate(model, features, ticket) {
	for (const key of [`${features.raceNoGroup}|${ticket.group}|W${ticket.boatNumbers[0]}`, `${ticket.group}|W${ticket.boatNumbers[0]}`, `${ticket.group}`]) {
		const cell = model.ticketUtility.get(key);
		if (cell?.sampleCount >= 30) return cell.exactHitCount / cell.sampleCount;
	}
	return 0;
}

function chooseRemoval(model, features, tickets, protectedKey) {
	const pairCounts = new Map();
	for (const ticket of tickets) addCount(pairCounts, `${ticket.boatNumbers[0]}-${ticket.boatNumbers[1]}`);
	return [...tickets]
		.filter((ticket) => ticketKey(ticket) !== protectedKey)
		.sort((left, right) => {
			const utilityDelta = utilityRate(model, features, left) - utilityRate(model, features, right);
			if (utilityDelta) return utilityDelta;
			const leftRedundancy = pairCounts.get(`${left.boatNumbers[0]}-${left.boatNumbers[1]}`) ?? 0;
			const rightRedundancy = pairCounts.get(`${right.boatNumbers[0]}-${right.boatNumbers[1]}`) ?? 0;
			if (leftRedundancy !== rightRedundancy) return rightRedundancy - leftRedundancy;
			return ticketKey(right).localeCompare(ticketKey(left));
		})[0] ?? null;
}

function resultFrequency(condition, key) {
	return (condition.resultCounts.get(key) ?? 0) / condition.sampleCount;
}

function reverseCandidates(tickets, condition) {
	const existing = new Set(tickets.map(ticketKey));
	return tickets.flatMap((ticket) => {
		const [winner, second, third] = ticket.boatNumbers.map(Number);
		const key = `${winner}-${third}-${second}`;
		return existing.has(key) ? [] : [{ boatNumbers: [winner, third, second], group: ticket.group, sourceTicketKey: ticketKey(ticket), score: resultFrequency(condition, key) }];
	}).sort((a, b) => b.score - a.score || a.boatNumbers.join("").localeCompare(b.boatNumbers.join("")));
}

function thirdExpansionCandidates(tickets, condition) {
	const existing = new Set(tickets.map(ticketKey));
	const candidates = [];
	for (const ticket of tickets) {
		const [winner, second] = ticket.boatNumbers.map(Number);
		for (let third = 1; third <= 6; third += 1) {
			if (third === winner || third === second) continue;
			const key = `${winner}-${second}-${third}`;
			if (!existing.has(key)) candidates.push({ boatNumbers: [winner, second, third], group: ticket.group, sourceTicketKey: ticketKey(ticket), score: resultFrequency(condition, key) });
		}
	}
	return candidates.sort((a, b) => b.score - a.score || a.boatNumbers.join("").localeCompare(b.boatNumbers.join("")));
}

function winnerDiversificationCandidates(tickets, condition) {
	const existing = new Set(tickets.map(ticketKey));
	const existingWinners = new Set(tickets.map((ticket) => Number(ticket.boatNumbers[0])));
	const candidates = [];
	for (const [resultKey, count] of condition.resultCounts) {
		const boatNumbers = resultKey.split("-").map(Number);
		if (!existingWinners.has(boatNumbers[0]) && !existing.has(resultKey)) candidates.push({ boatNumbers, group: "simulation", sourceTicketKey: null, score: count / condition.sampleCount });
	}
	return candidates.sort((a, b) => b.score - a.score || a.boatNumbers.join("").localeCompare(b.boatNumbers.join("")));
}

export function buildCounterfactualTickets({ strategyId, baselineTickets, preRaceFeatures, trainingModel, trainingWindow }) {
	if (!STRATEGY_IDS.includes(strategyId)) throw new Error(`unknown strategy: ${strategyId}`);
	const baseline = cloneBaselineTickets(baselineTickets);
	if (baseline.length !== 10) return { strategyTickets: baseline, changed: false, insufficientTraining: false, reason: "baseline-ticket-count-not-ten", trainingSampleCount: 0, conditionKey: null, addedTickets: [], removedTickets: [] };
	if (!baseline.every(validTicket)) throw new Error("baseline tickets are invalid");
	if (new Set(baseline.map(ticketKey)).size !== baseline.length) return { strategyTickets: baseline, changed: false, insufficientTraining: false, reason: "baseline-duplicate-ticket-source", trainingSampleCount: 0, conditionKey: null, addedTickets: [], removedTickets: [] };
	const config = STRATEGY_CONFIG[strategyId];
	const condition = resolveCondition(trainingModel, preRaceFeatures, config);
	if (!condition) return { strategyTickets: baseline, changed: false, insufficientTraining: true, reason: "training-sample-or-rate-threshold-not-met", trainingSampleCount: 0, conditionKey: null, addedTickets: [], removedTickets: [] };
	let candidates = strategyId === "third-expansion"
		? thirdExpansionCandidates(baseline, condition)
		: strategyId === "winner-diversification"
			? winnerDiversificationCandidates(baseline, condition)
			: reverseCandidates(baseline, condition);
	if (strategyId === "reverse-pair") candidates = candidates.filter((candidate) => candidate.score > 0);
	const candidate = candidates[0];
	if (!candidate || candidate.score <= 0) return { strategyTickets: baseline, changed: false, insufficientTraining: false, reason: "no-source-backed-candidate", trainingSampleCount: condition.sampleCount, conditionKey: condition.key, addedTickets: [], removedTickets: [] };
	const removal = chooseRemoval(trainingModel, preRaceFeatures, baseline, candidate.sourceTicketKey);
	if (!removal) return { strategyTickets: baseline, changed: false, insufficientTraining: false, reason: "no-removal-candidate", trainingSampleCount: condition.sampleCount, conditionKey: condition.key, addedTickets: [], removedTickets: [] };
	if (strategyId === "reverse-pair" && candidate.score <= utilityRate(trainingModel, preRaceFeatures, removal)) {
		return { strategyTickets: baseline, changed: false, insufficientTraining: false, reason: "training-net-gain-not-positive", trainingSampleCount: condition.sampleCount, conditionKey: condition.key, addedTickets: [], removedTickets: [] };
	}
	const removedKey = ticketKey(removal);
	const added = {
		ticketId: `simulation-${strategyId}`,
		group: candidate.group,
		boatNumbers: candidate.boatNumbers,
		strategyGenerated: true,
		strategyReason: `${config.signal}=${condition[config.signal]} sample=${condition.sampleCount}`,
		trainingWindow,
		trainingSampleCount: condition.sampleCount,
		sourceFeatures: preRaceFeatures,
	};
	const strategyTickets = baseline.filter((ticket) => ticketKey(ticket) !== removedKey).concat(added);
	if (strategyTickets.length !== 10 || new Set(strategyTickets.map(ticketKey)).size !== 10 || !strategyTickets.every(validTicket)) throw new Error(`strategy ticket invariant failed: ${strategyId}`);
	return { strategyTickets, changed: true, insufficientTraining: false, reason: added.strategyReason, trainingSampleCount: condition.sampleCount, conditionKey: condition.key, addedTickets: [added], removedTickets: [removal] };
}

export function evaluateTicketSet(tickets, actualResult) {
	const classification = classifyPredictionError(tickets, actualResult);
	const [winner, second, third] = actualResult.map(Number);
	const winnerTickets = tickets.filter((ticket) => Number(ticket.boatNumbers[0]) === winner);
	const secondPositionCovered = winnerTickets.some((ticket) => Number(ticket.boatNumbers[1]) === second);
	const thirdPositionCovered = winnerTickets.some((ticket) => Number(ticket.boatNumbers[2]) === third);
	return {
		exactHit: classification.exactHit,
		winnerCovered: classification.winnerCovered,
		secondPositionCovered,
		thirdPositionCovered,
		thirdMiss: classification.primaryType === "thirdMiss",
		secondThirdSwap: classification.primaryType === "secondThirdSwap",
		opponentMiss: classification.primaryType === "opponentMiss",
		winnerMiss: classification.primaryType === "winnerMiss",
	};
}

export function createComparisonMetric() {
	return { raceCount: 0, exactHit: 0, winnerCovered: 0, secondPositionCovered: 0, thirdPositionCovered: 0, thirdMiss: 0, secondThirdSwap: 0, opponentMiss: 0, winnerMiss: 0 };
}

export function addEvaluation(metric, evaluation) {
	metric.raceCount += 1;
	for (const key of ["exactHit", "winnerCovered", "secondPositionCovered", "thirdPositionCovered", "thirdMiss", "secondThirdSwap", "opponentMiss", "winnerMiss"]) metric[key] += Number(evaluation[key]);
}

export function finalizeComparisonMetric(metric) {
	return { ...metric, exactHitRate: roundRate(metric.exactHit, metric.raceCount), winnerCoverageRate: roundRate(metric.winnerCovered, metric.raceCount), secondPositionCoverageRate: roundRate(metric.secondPositionCovered, metric.raceCount), thirdPositionCoverageRate: roundRate(metric.thirdPositionCovered, metric.raceCount) };
}
