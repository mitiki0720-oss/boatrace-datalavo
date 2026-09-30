import {
	classifyPredictionError,
	raceNoGroup,
	sampleStatus,
	sourceBackedConditions,
} from "./boatExPredictionStructureAnalysis.mjs";

export const ACCURACY_SCHEMA_VERSION = "boat-ex-prediction-accuracy-analysis-v1";
export const PRIMARY_ERROR_TYPES = ["exactHit", "winnerMiss", "secondThirdSwap", "thirdMiss", "opponentMiss"];
const RACER_CLASSES = ["A1", "A2", "B1", "B2"];

const roundRate = (numerator, denominator) => denominator > 0 ? Number((numerator / denominator).toFixed(4)) : null;
const uniqueLanes = (values) => [...new Set(values.map(Number).filter((value) => value >= 1 && value <= 6))].sort((a, b) => a - b);

function concentration(values) {
	if (!values.length) return null;
	const counts = new Map();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return Number((Math.max(...counts.values()) / values.length).toFixed(4));
}

function metadataNumber(text, key) {
	const match = text.match(new RegExp(`(?:^|\\n)${key}\\s*:\\s*(\\d+)\\s*$`, "imu"));
	return match ? Number(match[1]) : null;
}

export function resolveStrictStakeEvidence(historyRecord, tickets) {
	const text = typeof historyRecord?.prediction?.textExcerpt === "string" ? historyRecord.prediction.textExcerpt : "";
	const purchasePoints = metadataNumber(text, "purchasePoints");
	const investmentYen = metadataNumber(text, "investmentYen");
	const metadataCandidate = tickets.length > 0
		&& purchasePoints === tickets.length
		&& Number.isSafeInteger(investmentYen)
		&& investmentYen >= 0
		&& investmentYen % purchasePoints === 0;
	if (!metadataCandidate) {
		return { status: "unresolved", method: null, metadataCandidate: false, unitStakeYen: null, investmentYen: null };
	}

	const explicitAmountMatch = text.match(/(?:1\s*点|各)\s*(\d[\d,]*)\s*円/u);
	const explicitUnitStakeYen = explicitAmountMatch ? Number(explicitAmountMatch[1].replace(/,/gu, "")) : null;
	const metadataUnitStakeYen = investmentYen / purchasePoints;
	if (Number.isSafeInteger(explicitUnitStakeYen) && explicitUnitStakeYen >= 0 && explicitUnitStakeYen === metadataUnitStakeYen) {
		return {
			status: "source-backed",
			method: "explicit-unit-amount",
			metadataCandidate: true,
			unitStakeYen: explicitUnitStakeYen,
			investmentYen,
		};
	}
	if (/均等(?:購入|配分|買い)?/u.test(text)) {
		return {
			status: "source-backed",
			method: "explicit-equal-allocation",
			metadataCandidate: true,
			unitStakeYen: metadataUnitStakeYen,
			investmentYen,
		};
	}
	return { status: "unresolved", method: "metadata-only", metadataCandidate: true, unitStakeYen: null, investmentYen: null };
}

export function buildExactClassEvidenceMap(racerEvidence) {
	const map = new Map();
	let evidenceRowCount = 0;
	let conflictCount = 0;
	for (const racer of racerEvidence?.racers ?? []) {
		const className = String(racer?.className ?? "").toUpperCase();
		if (!RACER_CLASSES.includes(className)) continue;
		for (const evidence of racer?.raceEvidence ?? []) {
			const lane = Number(evidence?.frameNo);
			if (!evidence?.raceKey || !Number.isInteger(lane) || lane < 1 || lane > 6) continue;
			const key = `${evidence.raceKey}:${lane}`;
			evidenceRowCount += 1;
			if (map.has(key) && map.get(key) !== className) conflictCount += 1;
			else map.set(key, className);
		}
	}
	return { map, evidenceRowCount, conflictCount };
}

export function resolveExactRaceClasses(historyRecord, classEvidenceMap = new Map()) {
	const racers = historyRecord?.officialRace?.racers ?? historyRecord?.racer ?? [];
	const existing = new Map(racers.map((racer) => [Number(racer?.lane), String(racer?.className ?? "").toUpperCase()]));
	const before = [];
	const after = [];
	const sources = [];
	for (let lane = 1; lane <= 6; lane += 1) {
		const current = RACER_CLASSES.includes(existing.get(lane)) ? existing.get(lane) : null;
		const exactEvidence = classEvidenceMap.get(`${historyRecord?.raceKey}:${lane}`) ?? null;
		before.push(current);
		after.push(current ?? exactEvidence);
		sources.push(current ? "history-race" : exactEvidence ? "racer-evidence-exact-race-frame" : null);
	}
	const composition = (classes) => {
		if (!classes.every((value) => RACER_CLASSES.includes(value))) return null;
		const counts = Object.fromEntries(RACER_CLASSES.map((value) => [value, 0]));
		for (const value of classes) counts[value] += 1;
		return RACER_CLASSES.map((value) => `${value}:${counts[value]}`).join("|");
	};
	return {
		beforeLane1Class: before[0] ?? null,
		afterLane1Class: after[0] ?? null,
		beforeClassComposition: composition(before),
		afterClassComposition: composition(after),
		classNames: after,
		sources,
		backfilledLaneCount: after.filter((value, index) => value && !before[index]).length,
	};
}

export function analyzePredictionAccuracyRace({ race, historyRecord, classEvidenceMap = new Map() }) {
	const tickets = race?.structuredTickets ?? [];
	const result = (race?.officialResult?.finishOrder ?? []).slice(0, 3).map(Number);
	if (result.length !== 3 || result.some((lane) => !Number.isInteger(lane) || lane < 1 || lane > 6)) {
		throw new Error(`official top-three result is invalid: ${historyRecord?.raceKey ?? "unknown"}`);
	}
	const classification = classifyPredictionError(tickets, result);
	const [actualWinner, actualSecond, actualThird] = result;
	const winnerTickets = tickets.filter((ticket) => Number(ticket.boatNumbers?.[0]) === actualWinner);
	const predictedSecondCandidates = uniqueLanes(winnerTickets.map((ticket) => ticket.boatNumbers?.[1]));
	const predictedThirdCandidates = uniqueLanes(winnerTickets.map((ticket) => ticket.boatNumbers?.[2]));
	const predictedOpponentCandidates = uniqueLanes([...predictedSecondCandidates, ...predictedThirdCandidates]);
	const secondPositionCovered = predictedSecondCandidates.includes(actualSecond);
	const thirdPositionCovered = predictedThirdCandidates.includes(actualThird);
	const secondCovered = predictedOpponentCandidates.includes(actualSecond);
	const thirdCovered = predictedOpponentCandidates.includes(actualThird);
	const secondOnlyMissing = classification.winnerCovered && !secondCovered && thirdCovered;
	const thirdOnlyMissing = classification.winnerCovered && secondCovered && !thirdCovered;
	const bothOpponentMissing = classification.winnerCovered && !secondCovered && !thirdCovered;
	const missDistanceByPrimaryType = { exactHit: 0, thirdMiss: 1, secondThirdSwap: 2, opponentMiss: 3, winnerMiss: 4 };
	const missDistance = missDistanceByPrimaryType[classification.primaryType];
	const swapCategories = [];
	for (const ticket of tickets) {
		if (Number(ticket.boatNumbers?.[0]) !== actualWinner
			|| Number(ticket.boatNumbers?.[1]) !== actualThird
			|| Number(ticket.boatNumbers?.[2]) !== actualSecond) continue;
		if (!swapCategories.includes(ticket.group)) swapCategories.push(ticket.group);
	}
	const reverseKeys = new Set();
	const ticketKeys = new Set(tickets.map((ticket) => ticket.boatNumbers.join("-")));
	for (const ticket of tickets) {
		const [winner, second, third] = ticket.boatNumbers.map(Number);
		if (ticketKeys.has(`${winner}-${third}-${second}`)) reverseKeys.add(`${winner}:${Math.min(second, third)}-${Math.max(second, third)}`);
	}
	const conditions = sourceBackedConditions(historyRecord);
	const exactClasses = resolveExactRaceClasses(historyRecord, classEvidenceMap);
	const stakeEvidence = resolveStrictStakeEvidence(historyRecord, tickets);
	return {
		raceKey: historyRecord.raceKey,
		date: race.date,
		venueCode: race.venueCode,
		venueName: race.venueName,
		raceNo: Number(race.raceNo),
		raceNoGroup: raceNoGroup(race.raceNo),
		actualResult: result,
		actualWinner,
		actualSecond,
		actualThird,
		ticketCount: tickets.length,
		predictedWinnerCandidates: uniqueLanes(tickets.map((ticket) => ticket.boatNumbers?.[0])),
		predictedSecondCandidates,
		predictedThirdCandidates,
		secondCovered,
		thirdCovered,
		secondPositionCovered,
		thirdPositionCovered,
		secondOnlyMissing,
		thirdOnlyMissing,
		bothOpponentMissing,
		exactHit: classification.exactHit,
		winnerCovered: classification.winnerCovered,
		top2Covered: classification.top2Covered,
		secondThirdSwap: classification.secondThirdSwap,
		swapCategories,
		primaryErrorType: classification.primaryType,
		missDistance,
		uniqueWinnerCount: uniqueLanes(tickets.map((ticket) => ticket.boatNumbers?.[0])).length,
		uniqueSecondCandidateCount: uniqueLanes(tickets.map((ticket) => ticket.boatNumbers?.[1])).length,
		uniqueThirdCandidateCount: uniqueLanes(tickets.map((ticket) => ticket.boatNumbers?.[2])).length,
		winnerConcentration: concentration(tickets.map((ticket) => ticket.boatNumbers?.[0])),
		secondCandidateConcentration: concentration(tickets.map((ticket) => ticket.boatNumbers?.[1])),
		thirdCandidateConcentration: concentration(tickets.map((ticket) => ticket.boatNumbers?.[2])),
		reversedSecondThirdPairCount: reverseKeys.size,
		conditions: {
			windSpeedBucket: conditions.windSpeedBucket,
			waveHeightBucket: conditions.waveHeightBucket,
			lane1Class: exactClasses.afterLane1Class,
			classComposition: exactClasses.afterClassComposition,
			lane1ClassSource: exactClasses.sources[0],
			classBackfilledLaneCount: exactClasses.backfilledLaneCount,
		},
		stakeEvidence,
		trifectaPayoutYen: Number.isSafeInteger(race?.officialResult?.trifectaPayoutYen) ? race.officialResult.trifectaPayoutYen : null,
	};
}

export function createAccuracyMetric(id, label, metadata = {}) {
	return {
		id,
		label,
		...metadata,
		ticketCount: 0,
		hitRatePopulationRaceCount: 0,
		exactHit: 0,
		winnerMiss: 0,
		secondThirdSwap: 0,
		thirdMiss: 0,
		opponentMiss: 0,
		roiPopulationRaceCount: 0,
		investmentYen: 0,
		payoutYen: 0,
	};
}

export function addRaceToAccuracyMetric(cell, raceAnalysis, tickets) {
	if (!tickets.length) return;
	cell._raceKeys ??= new Set();
	if (cell._raceKeys.has(raceAnalysis.raceKey)) throw new Error(`duplicate accuracy metric race: ${cell.id}:${raceAnalysis.raceKey}`);
	cell._raceKeys.add(raceAnalysis.raceKey);
	const result = raceAnalysis.actualResult;
	const classification = classifyPredictionError(tickets, result);
	cell.ticketCount += tickets.length;
	cell.hitRatePopulationRaceCount += 1;
	cell[classification.primaryType] += 1;
	const stake = raceAnalysis.stakeEvidence;
	if (stake.status === "source-backed" && Number.isSafeInteger(raceAnalysis.trifectaPayoutYen)) {
		cell.roiPopulationRaceCount += 1;
		cell.investmentYen += stake.unitStakeYen * tickets.length;
		cell.payoutYen += classification.exactHit ? raceAnalysis.trifectaPayoutYen : 0;
	}
}

export function finalizeAccuracyMetric(cell) {
	const { _raceKeys: _ignored, ...value } = cell;
	return {
		...value,
		hitRate: roundRate(value.exactHit, value.hitRatePopulationRaceCount),
		recoveryRate: value.investmentYen > 0 ? roundRate(value.payoutYen, value.investmentYen) : null,
		investmentCoverageRate: roundRate(value.roiPopulationRaceCount, value.hitRatePopulationRaceCount),
		sampleStatus: sampleStatus(value.hitRatePopulationRaceCount),
		roiSampleStatus: sampleStatus(value.roiPopulationRaceCount),
	};
}

export function distribution(values) {
	const counts = new Map();
	for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
	return [...counts.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([value, raceCount]) => ({ value: Number(value), raceCount }));
}

export function buildOpponentMatrix(raceAnalyses, target) {
	const cells = new Map();
	for (const race of raceAnalyses.filter((entry) => entry.winnerCovered)) {
		const actualLane = target === "second" ? race.actualSecond : race.actualThird;
		const id = `${race.actualWinner}|${actualLane}`;
		if (!cells.has(id)) cells.set(id, { id, actualWinner: race.actualWinner, actualLane, sampleCount: 0, coveredCount: 0, exactPositionCount: 0 });
		const cell = cells.get(id);
		cell.sampleCount += 1;
		cell.coveredCount += target === "second" ? Number(race.secondCovered) : Number(race.thirdCovered);
		cell.exactPositionCount += target === "second" ? Number(race.secondPositionCovered) : Number(race.thirdPositionCovered);
	}
	return [...cells.values()]
		.sort((left, right) => left.actualWinner - right.actualWinner || left.actualLane - right.actualLane)
		.map((cell) => ({ ...cell, coverageRate: roundRate(cell.coveredCount, cell.sampleCount), exactPositionRate: roundRate(cell.exactPositionCount, cell.sampleCount) }));
}
