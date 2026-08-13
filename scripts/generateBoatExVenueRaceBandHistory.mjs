import { asText, courseRates, emptyCourseCounts, firstCourse, halfBand, increment, loadHistory, parseTrifectaPayout, percent, raceBand, readiness, updateManifest, writeJson } from "./boatExUsefulHistorySignalUtils.mjs";

const outputPath = "public/data/boatrace-ex/derived/venue-race-band-history/latest.json";
const { dates, records, dateRange } = loadHistory();
const venues = new Map();
for (const record of records) {
	if (!asText(record.venueCode)) continue;
	const venue = venues.get(record.venueCode) ?? { venueCode: record.venueCode, venueName: record.venueName, bands: new Map() };
	venues.set(record.venueCode, venue);
	for (const band of [raceBand(record.raceNo), halfBand(record.raceNo)]) {
		const item = venue.bands.get(band) ?? { raceBand: band, raceCount: 0, courseFirstCounts: emptyCourseCounts(), payoutCount: 0, over10000Count: 0, payouts: [] };
		venue.bands.set(band, item); item.raceCount += 1;
		const first = firstCourse(record); if (first) increment(item.courseFirstCounts, first);
		const payout = parseTrifectaPayout(record.officialResult); if (payout !== null) { item.payoutCount += 1; item.payouts.push(payout); if (payout > 10000) item.over10000Count += 1; }
	}
}
const generatedAt = new Date().toISOString();
const output = { schemaVersion: 1, kind: "boat-ex-venue-race-band-history-v1", generatedAt, sourceFiles: [{ sourceName: "boatrace-ex-date-index", sourcePath: "public/data/boatrace-ex/index.generated.json" }, { sourceName: "boatrace-ex-history-races", sourcePath: "public/data/boatrace-ex/history/races/<date>.json", dateCount: dates.length }], dateRange, summary: { raceCount: records.length, venueCount: venues.size }, venues: [...venues.values()].map((venue) => ({ ...venue, bands: [...venue.bands.values()].map((item) => ({ raceBand: item.raceBand, raceCount: item.raceCount, courseFirstCounts: item.courseFirstCounts, courseFirstRates: courseRates(item.courseFirstCounts, item.raceCount), lane1FirstRate: percent(item.courseFirstCounts["1"], item.raceCount), centerOuterFirstRate: percent(item.raceCount - item.courseFirstCounts["1"], item.raceCount), trifectaPayoutAvailableRaceCount: item.payoutCount, trifectaOver10000Count: item.over10000Count, trifectaOver10000Rate: percent(item.over10000Count, item.payoutCount), averageTrifectaPayout: item.payouts.length ? Math.round(item.payouts.reduce((a, b) => a + b, 0) / item.payouts.length) : null, maxTrifectaPayout: item.payouts.length ? Math.max(...item.payouts) : null, readiness: readiness(item.raceCount), warnings: item.raceCount < 30 ? ["LOW SAMPLE"] : [] })) })) };
writeJson(outputPath, output);
updateManifest([{ path: outputPath, kind: output.kind, date: dateRange.to, generatedAt, sourceStatus: "available", coverageStatus: "ready", recordCount: records.length }], generatedAt);
console.log(JSON.stringify({ ok: true, outputPath, dateRange, venues: venues.size }, null, 2));
