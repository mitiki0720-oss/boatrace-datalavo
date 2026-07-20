import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonIfExists } from "./boatExhibitionSnapshotPreservation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) continue;
		const [key, inlineValue] = token.slice(2).split("=", 2);
		if (key === "output-dir" || key === "outputDir") {
			parsed.outputDir = inlineValue ?? argv[index + 1];
			if (inlineValue === undefined) index += 1;
		}
	}
	return parsed;
}

function hasExhibitionTime(row) {
	return [row?.exhibitionTime, row?.displayTime, row?.time]
		.some((value) => typeof value === "string" && value.trim().length > 0);
}

function hasRaceExhibitionTime(race) {
	return (Array.isArray(race?.exhibitions) ? race.exhibitions : []).some(hasExhibitionTime);
}

function buildVenueCoverage(venue) {
	const races = (Array.isArray(venue?.races) ? venue.races : [])
		.filter((race) => Number.isInteger(Number(race?.raceNo)))
		.sort((left, right) => Number(left.raceNo) - Number(right.raceNo));
	const rows = races.map((race) => ({ race, hasTime: hasRaceExhibitionTime(race) }));
	const suspiciousGaps = [];

	for (let index = 1; index < rows.length - 1; index += 1) {
		const previous = rows[index - 1];
		const current = rows[index];
		const next = rows[index + 1];
		if (!current.hasTime && previous.hasTime && next.hasTime) {
			suspiciousGaps.push({
				venueName: venue?.venueName ?? "",
				venueCode: venue?.venueCode ?? "",
				raceNo: Number(current.race.raceNo),
				reason: "Previous and next races have exhibition times but this race is missing.",
			});
		}
	}

	return {
		raceCount: rows.length,
		exhibitionTimeAvailableRaceCount: rows.filter((row) => row.hasTime).length,
		exhibitionTimeMissingRaceCount: rows.filter((row) => !row.hasTime).length,
		suspiciousGaps,
	};
}

async function main() {
	const cliArgs = parseCliArgs();
	const outputDirectory = cliArgs.outputDir
		? path.resolve(projectRoot, cliArgs.outputDir)
		: path.join(projectRoot, "public", "data", "boatrace");
	const detailsPath = path.join(outputDirectory, "today-race-details.generated.json");
	const feed = await readJsonIfExists(detailsPath);

	if (!feed || !Array.isArray(feed.venues) || !String(feed.date ?? "").trim()) {
		throw new Error(`invalid today race details feed: ${detailsPath}`);
	}

	const coverage = feed.venues.map(buildVenueCoverage);
	const result = {
		ok: true,
		date: feed.date,
		venueCount: feed.venues.length,
		raceCount: coverage.reduce((sum, item) => sum + item.raceCount, 0),
		exhibitionTimeAvailableRaceCount: coverage.reduce((sum, item) => sum + item.exhibitionTimeAvailableRaceCount, 0),
		exhibitionTimeMissingRaceCount: coverage.reduce((sum, item) => sum + item.exhibitionTimeMissingRaceCount, 0),
		suspiciousGaps: coverage.flatMap((item) => item.suspiciousGaps),
	};

	console.log(JSON.stringify(result, null, 2));
	for (const gap of result.suspiciousGaps) {
		console.warn(`[check-exhibition-coverage] warning ${gap.venueName || gap.venueCode} ${gap.raceNo}R: ${gap.reason}`);
	}
}

main().catch((error) => {
	console.error("[check-exhibition-coverage] failed");
	console.error(error);
	process.exitCode = 1;
});
