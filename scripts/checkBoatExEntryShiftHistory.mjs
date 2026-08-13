import fs from "node:fs";
const path = "public/data/boatrace-ex/derived/entry-shift-history/latest.json";
try {
	const data = JSON.parse(fs.readFileSync(path, "utf8"));
	if (data.kind !== "boat-ex-entry-shift-history-v1" || !(data.summary?.exhibitionRaceCount > 0) || !(data.venues?.length > 0)) throw new Error("source field unavailable: officialExhibition.entries.course");
	for (const venue of data.venues) {
		const available = Number(venue.courseAvailableRaceCount ?? venue.raceCount ?? 0);
		const lane1Inside = Number(venue.lane1InsideCount ?? 0);
		if (available === 0 && venue.frameNariRate !== null) throw new Error(`${venue.venueName}: frameNariRate requires course data`);
		if (venue.frameNariRate === 1 && available > 0 && lane1Inside === 0) throw new Error(`${venue.venueName}: frame nari 100% cannot have zero lane-1 inside results`);
	}
	console.log(JSON.stringify({ ok: true, dateRange: data.dateRange, summary: data.summary }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
