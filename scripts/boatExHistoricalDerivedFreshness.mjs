const comparableNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

export function compareHistoricalRaceAnalysisFreshness({ index, roughIndex, historyCoverage, historicalSummary }) {
	const expectedDate = index?.latestDate ?? null;
	const expectedDateCount = comparableNumber(index?.summary?.dateCount ?? index?.availableDates?.length);
	const actualSummary = historicalSummary?.summary ?? {};
	const comparisons = [
		["latestDate", historicalSummary?.dateRange?.latestDate, expectedDate],
		["dateCount", historicalSummary?.dateRange?.dateCount, expectedDateCount],
		["raceCount", actualSummary.raceCount, roughIndex?.summary?.raceCount],
		["resultAvailableRaceCount", actualSummary.resultAvailableRaceCount, roughIndex?.summary?.resultAvailableRaceCount],
		["payoutAvailableRaceCount", actualSummary.payoutAvailableRaceCount, roughIndex?.summary?.payoutAvailableRaceCount],
		["exhibitionAvailableRaceCount", actualSummary.exhibitionAvailableRaceCount, historyCoverage?.summary?.exhibitionAvailableRaceCount],
		["weatherAvailableRaceCount", actualSummary.weatherAvailableRaceCount, historyCoverage?.summary?.weatherAvailableRaceCount],
	];
	const reasons = comparisons.flatMap(([field, actual, expected]) => {
		if (actual === undefined || actual === null || expected === undefined || expected === null) return [field];
		return String(actual) === String(expected) ? [] : [field];
	});

	return {
		current: reasons.length === 0,
		reasons,
		comparisons: Object.fromEntries(comparisons.map(([field, actual, expected]) => [field, { actual, expected }])),
	};
}
