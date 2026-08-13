import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
const asArray = (value) => Array.isArray(value) ? value : [];
const asText = (value) => value === null || value === undefined ? "" : String(value).trim();
const fail = (message) => { throw new Error(message); };

try {
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const manifest = readJson("public/data/boatrace-ex/derived/manifest.generated.json");
	const weatherHistory = readJson("public/data/boatrace-ex/derived/weather-water-history/latest.json");
	const summary = readJson("public/data/boatrace-ex/derived/weather-water-history/history-summary.json");
	const dates = asArray(index.availableDates);
	if (weatherHistory.kind !== "boat-ex-weather-water-history-v1") fail("unexpected weather history kind");
	if (weatherHistory.dateRange?.dateCount !== dates.length) fail("date count does not match EX index");
	if (weatherHistory.dateRange?.from !== dates[0] || weatherHistory.dateRange?.to !== dates.at(-1)) fail("date range does not match EX index");
	if (weatherHistory.summary?.raceCount <= 0 || weatherHistory.summary?.venueCount <= 0) fail("history aggregate is empty");
	if (weatherHistory.summary?.weatherAvailableRaceCount <= 0) fail("weather coverage is empty");
	if (JSON.stringify(weatherHistory.summary) !== JSON.stringify(summary.summary)) fail("latest and summary aggregate mismatch");
	const manifestPaths = new Set(asArray(manifest.files).map((file) => file?.path));
	for (const outputPath of ["public/data/boatrace-ex/derived/weather-water-history/latest.json", "public/data/boatrace-ex/derived/weather-water-history/history-summary.json"]) {
		if (!manifestPaths.has(outputPath)) fail(`derived manifest is missing ${outputPath}`);
	}
	const venueCodes = new Set();
	for (const venue of asArray(weatherHistory.venues)) {
		if (!asText(venue.venueCode) || !asText(venue.venueName)) fail("venue identity is missing");
		if (venueCodes.has(venue.venueCode)) fail(`duplicate venue: ${venue.venueCode}`);
		venueCodes.add(venue.venueCode);
		if (!(venue.raceCount > 0) || !(venue.dateCount > 0)) fail(`empty venue aggregate: ${venue.venueCode}`);
		if (!["ready", "insufficient-history", "missing"].includes(venue.readiness?.status)) fail(`unexpected readiness: ${venue.venueCode}`);
		for (const field of ["weatherConditionCounts", "windDirectionCounts", "windSpeedBandCounts", "waveHeightBandCounts"]) {
			if (!venue[field] || typeof venue[field] !== "object") fail(`missing ${field}: ${venue.venueCode}`);
		}
	}
	if (venueCodes.size !== weatherHistory.summary.venueCount) fail("venue count mismatch");
	for (const source of asArray(weatherHistory.sourceFiles)) {
		const sourcePath = asText(source.sourcePath);
		if (!sourcePath.startsWith("public/data/boatrace-ex/")) fail(`unexpected source path: ${sourcePath}`);
		if (sourcePath.includes("public/data/reviews/") || sourcePath.includes("public/dog/")) fail(`protected source path included: ${sourcePath}`);
	}
	console.log(JSON.stringify({ ok: true, dateRange: weatherHistory.dateRange, summary: weatherHistory.summary, venueCount: venueCodes.size }, null, 2));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
