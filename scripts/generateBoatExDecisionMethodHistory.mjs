import { asText, firstCourse, increment, loadHistory, raceBand, readiness, updateManifest, writeJson } from "./boatExUsefulHistorySignalUtils.mjs";

const outputPath = "public/data/boatrace-ex/derived/decision-method-history/latest.json";
const { dates, records, dateRange } = loadHistory();
const venues = new Map();
for (const record of records) {
	const method = asText(record.officialResult?.winningTechnique);
	if (!asText(record.venueCode) || !method) continue;
	const venue = venues.get(record.venueCode) ?? { venueCode: record.venueCode, venueName: record.venueName, raceCount: 0, winningDecisionCounts: {}, byCourse: {}, byRaceBand: {} };
	venues.set(record.venueCode, venue); venue.raceCount += 1; increment(venue.winningDecisionCounts, method);
	const course = firstCourse(record) ?? "unknown"; venue.byCourse[course] ??= { raceCount: 0, winningDecisionCounts: {} }; venue.byCourse[course].raceCount += 1; increment(venue.byCourse[course].winningDecisionCounts, method);
	const band = raceBand(record.raceNo); venue.byRaceBand[band] ??= { raceCount: 0, winningDecisionCounts: {} }; venue.byRaceBand[band].raceCount += 1; increment(venue.byRaceBand[band].winningDecisionCounts, method);
}
const generatedAt = new Date().toISOString();
const output = { schemaVersion: 1, kind: "boat-ex-decision-method-history-v1", generatedAt, sourceFiles: [{ sourceName: "boatrace-ex-history-races", sourcePath: "public/data/boatrace-ex/history/races/<date>.json", dateCount: dates.length }], dateRange, summary: { sourceField: "officialResult.winningTechnique", sourceAvailableRaceCount: [...venues.values()].reduce((sum, venue) => sum + venue.raceCount, 0), venueCount: venues.size }, venues: [...venues.values()].map((venue) => ({ ...venue, readiness: readiness(venue.raceCount), warnings: venue.raceCount < 30 ? ["LOW SAMPLE"] : [] })) };
writeJson(outputPath, output); updateManifest([{ path: outputPath, kind: output.kind, date: dateRange.to, generatedAt, sourceStatus: "available", coverageStatus: "ready", recordCount: output.summary.sourceAvailableRaceCount }], generatedAt);
console.log(JSON.stringify({ ok: true, outputPath, dateRange, sourceAvailableRaceCount: output.summary.sourceAvailableRaceCount }, null, 2));
