import { asArray, asText, increment, loadHistory, raceBand, readiness, updateManifest, writeJson } from "./boatExUsefulHistorySignalUtils.mjs";

const outputPath = "public/data/boatrace-ex/derived/entry-shift-history/latest.json";
const { dates, records, dateRange } = loadHistory(); const venues = new Map();
for (const record of records) {
	const entries = asArray(record.officialExhibition?.entries); if (!asText(record.venueCode) || entries.length === 0) continue;
	const venue = venues.get(record.venueCode) ?? { venueCode: record.venueCode, venueName: record.venueName, raceCount: 0, courseAvailableRaceCount: 0, sourceFieldInsufficientRaceCount: 0, frameToCourseCounts: {}, frameNariRaceCount: 0, entryShiftRaceCount: 0, lane1InsideCount: 0, byRaceBand: {} };
	venues.set(record.venueCode, venue); venue.raceCount += 1;
	const usableEntries = entries.filter((entry) => /^[1-6]$/u.test(asText(entry.lane)) && /^[1-6]$/u.test(asText(entry.course)));
	if (usableEntries.length !== 6 || new Set(usableEntries.map((entry) => asText(entry.lane))).size !== 6) { venue.sourceFieldInsufficientRaceCount += 1; continue; }
	venue.courseAvailableRaceCount += 1;
	const shift = usableEntries.some((entry) => asText(entry.lane) !== asText(entry.course));
	if (shift) venue.entryShiftRaceCount += 1; else venue.frameNariRaceCount += 1;
	if (usableEntries.some((entry) => asText(entry.lane) === "1" && asText(entry.course) === "1")) venue.lane1InsideCount += 1;
	for (const entry of usableEntries) { const frame = asText(entry.lane); const course = asText(entry.course); venue.frameToCourseCounts[frame] ??= {}; increment(venue.frameToCourseCounts[frame], course); }
	const band = raceBand(record.raceNo); venue.byRaceBand[band] ??= { raceCount: 0, entryShiftRaceCount: 0 }; venue.byRaceBand[band].raceCount += 1; if (shift) venue.byRaceBand[band].entryShiftRaceCount += 1;
}
const generatedAt = new Date().toISOString();
const output = { schemaVersion: 1, kind: "boat-ex-entry-shift-history-v1", generatedAt, sourceFiles: [{ sourceName: "boatrace-ex-history-races", sourcePath: "public/data/boatrace-ex/history/races/<date>.json", field: "officialExhibition.entries.course", dateCount: dates.length }], dateRange, summary: { sourceField: "officialExhibition.entries.course", venueCount: venues.size, exhibitionRaceCount: [...venues.values()].reduce((sum, venue) => sum + venue.raceCount, 0), courseAvailableRaceCount: [...venues.values()].reduce((sum, venue) => sum + venue.courseAvailableRaceCount, 0), sourceFieldInsufficientRaceCount: [...venues.values()].reduce((sum, venue) => sum + venue.sourceFieldInsufficientRaceCount, 0) }, venues: [...venues.values()].map((venue) => ({ ...venue, frameNariRate: venue.courseAvailableRaceCount ? venue.frameNariRaceCount / venue.courseAvailableRaceCount : null, entryShiftRate: venue.courseAvailableRaceCount ? venue.entryShiftRaceCount / venue.courseAvailableRaceCount : null, lane1InsideRate: venue.courseAvailableRaceCount ? venue.lane1InsideCount / venue.courseAvailableRaceCount : null, readiness: readiness(venue.courseAvailableRaceCount), warnings: [venue.courseAvailableRaceCount < 30 ? "LOW SAMPLE" : null, venue.sourceFieldInsufficientRaceCount > 0 ? "source field insufficient" : null].filter(Boolean) })) };
writeJson(outputPath, output); updateManifest([{ path: outputPath, kind: output.kind, date: dateRange.to, generatedAt, sourceStatus: "available", coverageStatus: output.summary.exhibitionRaceCount ? "available" : "missing", recordCount: output.summary.exhibitionRaceCount }], generatedAt);
console.log(JSON.stringify({ ok: true, outputPath, dateRange, exhibitionRaceCount: output.summary.exhibitionRaceCount }, null, 2));
