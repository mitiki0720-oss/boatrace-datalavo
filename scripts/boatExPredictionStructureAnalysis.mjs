export const ANALYSIS_SCHEMA_VERSION = "boat-ex-prediction-structure-analysis-v2";
export const ANALYSIS_CATEGORIES = ["厚め", "本線", "中穴", "大穴"];

export const SAMPLE_THRESHOLDS = {
	insufficientBelow: 10,
	lowBelow: 30,
	usableBelow: 100,
};

const WEATHER_MISSING_PATTERN = /^(?:unknown|未取得|確認中|取得済み|null|なし|-+)$/iu;
const RACER_CLASSES = ["A1", "A2", "B1", "B2"];

export function buildAnalysisRaceKey(record) {
	return `${record?.date ?? ""}:${record?.venueCode ?? ""}:${String(Number(record?.raceNo)).padStart(2, "0")}`;
}

export function sampleStatus(evaluatedRaceCount) {
	if (evaluatedRaceCount < SAMPLE_THRESHOLDS.insufficientBelow) return "insufficient";
	if (evaluatedRaceCount < SAMPLE_THRESHOLDS.lowBelow) return "low";
	if (evaluatedRaceCount < SAMPLE_THRESHOLDS.usableBelow) return "usable";
	return "strong";
}

function sourceTimes(sources) {
	return (Array.isArray(sources) ? sources : [])
		.flatMap((source) => [source?.generatedAt, source?.sourceFetchedAt, source?.acquiredAt])
		.map((value) => Date.parse(value))
		.filter(Number.isFinite);
}

export function resolveEvaluationEligibility(historyRecord) {
	const predictionTimes = sourceTimes(historyRecord?.prediction?.sources);
	const resultTimes = sourceTimes([
		...(historyRecord?.officialResult?.sources ?? []),
		...(historyRecord?.officialResult?.payout ?? []).flatMap((entry) => entry?.sources ?? []),
	]);
	const predictionTimestamp = predictionTimes.length ? Math.max(...predictionTimes) : null;
	const resultFinalizedTimestamp = resultTimes.length ? Math.min(...resultTimes) : null;
	if (predictionTimestamp === null || resultFinalizedTimestamp === null) {
		return {
			status: "unknown",
			predictionGeneratedAt: predictionTimestamp === null ? null : new Date(predictionTimestamp).toISOString(),
			resultFinalizedAt: resultFinalizedTimestamp === null ? null : new Date(resultFinalizedTimestamp).toISOString(),
			reason: "source-timestamp-unavailable",
		};
	}
	if (predictionTimestamp >= resultFinalizedTimestamp) {
		return {
			status: "future-leakage",
			predictionGeneratedAt: new Date(predictionTimestamp).toISOString(),
			resultFinalizedAt: new Date(resultFinalizedTimestamp).toISOString(),
			reason: "prediction-not-earlier-than-result-finalization",
		};
	}
	return {
		status: "eligible",
		predictionGeneratedAt: new Date(predictionTimestamp).toISOString(),
		resultFinalizedAt: new Date(resultFinalizedTimestamp).toISOString(),
		reason: "prediction-precedes-result-finalization",
	};
}

function normalizeSourceText(value) {
	if (value === null || value === undefined) return null;
	const text = String(value).normalize("NFKC").trim();
	return text && !WEATHER_MISSING_PATTERN.test(text) ? text : null;
}

function sourceBackedWeather(historyRecord) {
	const weather = historyRecord?.weather;
	if (!weather) return null;
	const backed = (weather.sources ?? []).some((source) => source?.sourceStatus === "available" || source?.sourceType === "official");
	return backed ? weather : null;
}

function numericMeasurement(value) {
	const text = normalizeSourceText(value);
	if (!text) return null;
	const match = text.match(/-?\d+(?:\.\d+)?/u);
	if (!match) return null;
	const number = Number(match[0]);
	return Number.isFinite(number) && number >= 0 ? number : null;
}

export function windSpeedBucket(value) {
	const speed = numericMeasurement(value);
	if (speed === null) return null;
	if (speed <= 1) return "0-1m";
	if (speed <= 3) return "2-3m";
	if (speed <= 5) return "4-5m";
	return "6m+";
}

export function waveHeightBucket(value) {
	const height = numericMeasurement(value);
	if (height === null) return null;
	if (height <= 1) return "0-1cm";
	if (height <= 3) return "2-3cm";
	if (height <= 5) return "4-5cm";
	if (height <= 10) return "6-10cm";
	return "11cm+";
}

export function raceNoGroup(raceNo) {
	const value = Number(raceNo);
	if (value >= 1 && value <= 4) return "1-4R";
	if (value >= 5 && value <= 8) return "5-8R";
	if (value >= 9 && value <= 12) return "9-12R";
	return null;
}

function raceClasses(historyRecord) {
	const racers = historyRecord?.officialRace?.racers ?? historyRecord?.racer ?? [];
	return racers
		.map((racer) => ({ lane: Number(racer?.lane), className: String(racer?.className ?? "").toUpperCase() }))
		.filter((racer) => Number.isInteger(racer.lane) && RACER_CLASSES.includes(racer.className));
}

export function lane1Class(historyRecord) {
	return raceClasses(historyRecord).find((racer) => racer.lane === 1)?.className ?? null;
}

export function classComposition(historyRecord) {
	const classes = raceClasses(historyRecord);
	if (classes.length !== 6 || new Set(classes.map((racer) => racer.lane)).size !== 6) return null;
	const counts = Object.fromEntries(RACER_CLASSES.map((className) => [className, 0]));
	for (const racer of classes) counts[racer.className] += 1;
	return RACER_CLASSES.map((className) => `${className}:${counts[className]}`).join("|");
}

export function sourceBackedConditions(historyRecord) {
	const weather = sourceBackedWeather(historyRecord);
	return {
		weather: normalizeSourceText(weather?.weather),
		windSpeedBucket: windSpeedBucket(weather?.windSpeedMps),
		waveHeightBucket: waveHeightBucket(weather?.waveHeightCm),
		lane1Class: lane1Class(historyRecord),
		classComposition: classComposition(historyRecord),
	};
}

function sameTicket(ticket, result) {
	return ticket?.boatNumbers?.length === 3 && ticket.boatNumbers.every((boat, index) => Number(boat) === Number(result?.[index]));
}

export function classifyPredictionError(tickets, result) {
	if (!Array.isArray(result) || result.length < 3) throw new Error("error classification requires an official top-three result");
	const exactHit = tickets.some((ticket) => sameTicket(ticket, result));
	const winnerCovered = tickets.some((ticket) => Number(ticket.boatNumbers?.[0]) === Number(result[0]));
	const top2Covered = tickets.some((ticket) => Number(ticket.boatNumbers?.[0]) === Number(result[0]) && Number(ticket.boatNumbers?.[1]) === Number(result[1]));
	const thirdMiss = !exactHit && top2Covered;
	const secondThirdSwap = !exactHit && tickets.some((ticket) => (
		Number(ticket.boatNumbers?.[0]) === Number(result[0])
		&& Number(ticket.boatNumbers?.[1]) === Number(result[2])
		&& Number(ticket.boatNumbers?.[2]) === Number(result[1])
	));
	const winnerMiss = !winnerCovered;
	let primaryType = "exactHit";
	if (!exactHit) {
		if (winnerMiss) primaryType = "winnerMiss";
		else if (secondThirdSwap) primaryType = "secondThirdSwap";
		else if (thirdMiss) primaryType = "thirdMiss";
		else primaryType = "opponentMiss";
	}
	return {
		exactHit,
		winnerCovered,
		top2Covered,
		thirdMiss,
		secondThirdSwap,
		winnerMiss,
		opponentMiss: primaryType === "opponentMiss",
		primaryType,
	};
}

export function createMetricCell(id, label, metadata = {}) {
	return {
		id,
		label,
		...metadata,
		ticketCount: 0,
		eligibleTicketCount: 0,
		evaluatedRaceCount: 0,
		hitCount: 0,
		investmentYen: 0,
		payoutYen: 0,
		investmentKnownRaceCount: 0,
		investmentUnknownRaceCount: 0,
		unpairedPayoutYen: 0,
		payoutUnknownHitCount: 0,
	};
}

export function addTicketsToMetric(cell, { tickets, raceKey, result, payoutYen, eligible }) {
	cell.ticketCount += tickets.length;
	if (!eligible || !tickets.length || !Array.isArray(result) || result.length < 3) return;
	cell._raceKeys ??= new Set();
	if (cell._raceKeys.has(raceKey)) throw new Error(`duplicate metric race: ${cell.id}:${raceKey}`);
	cell._raceKeys.add(raceKey);
	cell.evaluatedRaceCount += 1;
	cell.eligibleTicketCount += tickets.length;
	const stakes = tickets.map((ticket) => ticket.stakeYen);
	const investmentKnown = stakes.every(Number.isSafeInteger);
	if (investmentKnown) {
		cell.investmentKnownRaceCount += 1;
		cell.investmentYen += stakes.reduce((sum, stake) => sum + stake, 0);
	} else cell.investmentUnknownRaceCount += 1;
	const hit = tickets.some((ticket) => sameTicket(ticket, result));
	if (!hit) return;
	cell.hitCount += 1;
	if (Number.isSafeInteger(payoutYen) && investmentKnown) cell.payoutYen += payoutYen;
	else if (Number.isSafeInteger(payoutYen)) cell.unpairedPayoutYen += payoutYen;
	else cell.payoutUnknownHitCount += 1;
}

export function finalizeMetricCell(cell) {
	const { _raceKeys: _ignored, ...value } = cell;
	return {
		...value,
		hitRate: value.evaluatedRaceCount > 0 ? Number((value.hitCount / value.evaluatedRaceCount).toFixed(4)) : null,
		recoveryRate: value.investmentYen > 0 ? Number((value.payoutYen / value.investmentYen).toFixed(4)) : null,
		sampleStatus: sampleStatus(value.evaluatedRaceCount),
	};
}

export function missingness(denominator, availableCount, reason) {
	const missingCount = Math.max(0, denominator - availableCount);
	return {
		populationRaceCount: denominator,
		availableRaceCount: availableCount,
		missingRaceCount: missingCount,
		missingRate: denominator > 0 ? Number((missingCount / denominator).toFixed(4)) : null,
		reason,
	};
}
