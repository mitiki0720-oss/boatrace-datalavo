import { asArray, asText, firstCourse, increment, loadHistory, readiness, updateManifest, writeJson } from "./boatExUsefulHistorySignalUtils.mjs";

const outputPath = "public/data/boatrace-ex/derived/motor-boat-history/latest.json";
const { dates, records, dateRange } = loadHistory(); const venues = new Map();
for (const record of records) {
	if (!asText(record.venueCode)) continue;
	const first = firstCourse(record); const finish = asArray(record.officialResult?.finishOrder).map(String);
	const venue = venues.get(record.venueCode) ?? { venueCode: record.venueCode, venueName: record.venueName, motors: {}, boats: {} }; venues.set(record.venueCode, venue);
	for (const racer of asArray(record.officialRace?.racers)) {
		const lane = asText(racer.lane); const result = { first: first === lane, top2: finish.slice(0, 2).includes(lane), top3: finish.slice(0, 3).includes(lane) };
		for (const [kind, value] of [["motors", asText(racer.motorNo)], ["boats", asText(racer.boatNo)]]) {
			if (!value) continue; const bucket = venue[kind]; bucket[value] ??= { number: value, raceCount: 0, firstCount: 0, top2Count: 0, top3Count: 0 }; const item = bucket[value]; item.raceCount += 1; if (result.first) item.firstCount += 1; if (result.top2) item.top2Count += 1; if (result.top3) item.top3Count += 1;
		}
	}
}
const finalize = (items) => Object.values(items).map((item) => ({ ...item, readiness: readiness(item.raceCount), warnings: item.raceCount < 5 ? ["LOW SAMPLE"] : [] }));
const generatedAt = new Date().toISOString(); const output = { schemaVersion: 1, kind: "boat-ex-motor-boat-history-v1", generatedAt, sourceFiles: [{ sourceName: "boatrace-ex-history-races", sourcePath: "public/data/boatrace-ex/history/races/<date>.json", field: "officialRace.racers.motorNo/boatNo", dateCount: dates.length }], dateRange, summary: { venueCount: venues.size, sourceRaceCount: records.length }, venues: [...venues.values()].map((venue) => ({ venueCode: venue.venueCode, venueName: venue.venueName, motors: finalize(venue.motors), boats: finalize(venue.boats) })) };
writeJson(outputPath, output); updateManifest([{ path: outputPath, kind: output.kind, date: dateRange.to, generatedAt, sourceStatus: "available", coverageStatus: "partial", recordCount: records.length }], generatedAt); console.log(JSON.stringify({ ok: true, outputPath, dateRange }, null, 2));
