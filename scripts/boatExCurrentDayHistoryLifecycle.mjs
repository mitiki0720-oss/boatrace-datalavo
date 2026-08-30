const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];

const isAvailable = (value) => !new Set(["", "-", "未取得", "確認中", "null", "undefined"]).has(text(value));

const hasCompleteOfficialResult = (race) => array(race?.result?.finishOrder).length >= 3;

const hasOfficialTrifectaPayout = (race) => {
	const result = race?.result ?? {};
	if (isAvailable(result?.payout3tan?.payout ?? result?.payout3tan?.payoutYen)) return true;
	return [...array(result.payoutsFull), ...array(result.payouts)].some((payout) => {
		const betType = text(payout?.betType ?? payout?.type ?? payout?.label).toLowerCase();
		return (betType.includes("3連単") || betType.includes("trifecta")) &&
			isAvailable(payout?.payoutYen ?? payout?.payout ?? payout?.amount);
	});
};

const hasHistoryTrifectaPayout = (record) => array(record?.officialResult?.payout).some((payout) => {
	const betType = text(payout?.betType ?? payout?.type ?? payout?.label).toLowerCase();
	return (betType.includes("3連単") || betType.includes("trifecta")) &&
		isAvailable(payout?.payoutYen ?? payout?.payout ?? payout?.amount);
});

const countDisplayTimes = (race) => array(race?.exhibitions).filter((entry) =>
	isAvailable(entry?.exhibitionTime ?? entry?.displayTime)
).length;

const latestTimestamp = (values) => values
	.map((value) => text(value))
	.filter(Boolean)
	.sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;

export function summarizeBoatExCurrentOfficialLifecycle(source, targetDate) {
	const dateMatches = text(source?.date) === targetDate;
	const venues = dateMatches ? array(source?.venues) : [];
	const races = venues.flatMap((venue) => array(venue?.races));
	return {
		date: text(source?.date) || null,
		dateMatches,
		raceCount: races.length,
		resultAvailableRaceCount: races.filter(hasCompleteOfficialResult).length,
		payoutAvailableRaceCount: races.filter((race) => hasCompleteOfficialResult(race) && hasOfficialTrifectaPayout(race)).length,
		entriesCompleteRaceCount: races.filter((race) => array(race?.racers).length === 6).length,
		exhibitionCompleteRaceCount: races.filter((race) => countDisplayTimes(race) === 6).length,
		sourceAcquiredAt: latestTimestamp([
			source?.generatedAt,
			...venues.flatMap((venue) => [
				venue?.generatedAt,
				...array(venue?.races).flatMap((race) => [race?.result?.finalizedAt, race?.result?.updatedAt, race?.exhibitionCoverage?.updatedAt]),
			]),
		]),
	};
}

export function summarizeBoatExHistoryLifecycle(history, targetDate) {
	const dateMatches = text(history?.date) === targetDate;
	const records = dateMatches ? array(history?.records) : [];
	return {
		date: text(history?.date) || null,
		dateMatches,
		raceCount: records.length,
		resultAvailableRaceCount: records.filter((record) =>
			record?.coverage?.officialResult === "complete" && array(record?.officialResult?.finishOrder).length >= 3
		).length,
		payoutAvailableRaceCount: records.filter((record) =>
			record?.coverage?.officialResult === "complete" && hasHistoryTrifectaPayout(record)
		).length,
		entriesCompleteRaceCount: records.filter((record) =>
			record?.coverage?.officialRace === "complete" && array(record?.officialRace?.racers).length === 6
		).length,
		exhibitionCompleteRaceCount: records.filter((record) =>
			record?.coverage?.officialExhibition === "complete" && array(record?.officialExhibition?.entries).length >= 6
		).length,
		sourceAcquiredAt: latestTimestamp([
			history?.generatedAt,
			...records.flatMap((record) => array(record?.sources).map((source) => source?.sourceFetchedAt ?? source?.generatedAt)),
		]),
	};
}

export function evaluateBoatExCurrentDayHistoryRefresh({ targetDate, existingHistory, currentOfficialSource }) {
	const official = summarizeBoatExCurrentOfficialLifecycle(currentOfficialSource, targetDate);
	const history = summarizeBoatExHistoryLifecycle(existingHistory, targetDate);
	if (!official.dateMatches) {
		return { shouldRefresh: false, reason: "current-source-date-mismatch", reasons: ["current-source-date-mismatch"], official, history };
	}
	if (official.raceCount === 0) {
		return { shouldRefresh: false, reason: "current-source-empty", reasons: ["current-source-empty"], official, history };
	}
	if (!existingHistory) {
		return { shouldRefresh: true, reason: "history-missing", reasons: ["history-missing"], official, history };
	}
	if (!history.dateMatches) {
		return { shouldRefresh: true, reason: "existing-history-date-mismatch", reasons: ["existing-history-date-mismatch"], official, history };
	}
	if (official.raceCount < history.raceCount) {
		return {
			shouldRefresh: false,
			reason: "current-source-race-coverage-smaller",
			reasons: ["current-source-race-coverage-smaller"],
			official,
			history,
		};
	}

	const reasons = [];
	for (const key of [
		"raceCount",
		"resultAvailableRaceCount",
		"payoutAvailableRaceCount",
		"entriesCompleteRaceCount",
		"exhibitionCompleteRaceCount",
	]) {
		if (official[key] > history[key]) reasons.push(`${key}-increased`);
	}
	return {
		shouldRefresh: reasons.length > 0,
		reason: reasons[0] ?? "lifecycle-not-advanced",
		reasons,
		official,
		history,
	};
}
