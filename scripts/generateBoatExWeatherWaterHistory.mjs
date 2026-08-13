import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = "public/data/boatrace-ex/derived/weather-water-history";
const indexPath = "public/data/boatrace-ex/index.generated.json";
const derivedManifestPath = "public/data/boatrace-ex/derived/manifest.generated.json";
const minWeatherRaceCount = 30;

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const absolutePath = path.join(repoRoot, relativePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const asArray = (value) => Array.isArray(value) ? value : [];
const asText = (value) => value === null || value === undefined ? "" : String(value).trim();
const numberValue = (value) => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const match = asText(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/u)?.[0];
	const parsed = match ? Number(match) : NaN;
	return Number.isFinite(parsed) ? parsed : null;
};
const average = (values) => values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100 : null;
const max = (values) => values.length ? Math.max(...values) : null;
const increment = (record, key) => { record[key] = (record[key] ?? 0) + 1; };
const windBand = (value) => value === null ? "unknown" : value <= 2 ? "0-2m" : value <= 5 ? "3-5m" : "6m+";
const waveBand = (value) => value === null ? "unknown" : value <= 2 ? "0-2cm" : value <= 5 ? "3-5cm" : "6cm+";

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function emptyVenue(record) {
	return {
		venueCode: record.venueCode,
		venueName: record.venueName,
		dates: new Set(),
		raceCount: 0,
		weatherAvailableRaceCount: 0,
		windSpeedAvailableRaceCount: 0,
		waveHeightAvailableRaceCount: 0,
		windSpeeds: [],
		waveHeights: [],
		weatherConditionCounts: {},
		windDirectionCounts: {},
		windSpeedBandCounts: { "0-2m": 0, "3-5m": 0, "6m+": 0, unknown: 0 },
		waveHeightBandCounts: { "0-2cm": 0, "3-5cm": 0, "6cm+": 0, unknown: 0 },
	};
}

function finalizeVenue(venue) {
	const weatherCoverageRate = venue.raceCount ? Math.round((venue.weatherAvailableRaceCount / venue.raceCount) * 10000) / 10000 : 0;
	const readiness = venue.weatherAvailableRaceCount >= minWeatherRaceCount
		? { status: "ready", reason: "weather sample meets minimum", minWeatherRaceCount }
		: venue.weatherAvailableRaceCount > 0
			? { status: "insufficient-history", reason: "weather sample is below minimum", minWeatherRaceCount }
			: { status: "missing", reason: "weather sample is unavailable", minWeatherRaceCount };
	return {
		venueCode: venue.venueCode,
		venueName: venue.venueName,
		dateCount: venue.dates.size,
		raceCount: venue.raceCount,
		weatherAvailableRaceCount: venue.weatherAvailableRaceCount,
		weatherCoverageRate,
		windSpeedAvailableRaceCount: venue.windSpeedAvailableRaceCount,
		waveHeightAvailableRaceCount: venue.waveHeightAvailableRaceCount,
		windSpeedAverageMps: average(venue.windSpeeds),
		windSpeedMaxMps: max(venue.windSpeeds),
		waveHeightAverageCm: average(venue.waveHeights),
		waveHeightMaxCm: max(venue.waveHeights),
		weatherConditionCounts: venue.weatherConditionCounts,
		windDirectionCounts: venue.windDirectionCounts,
		windSpeedBandCounts: venue.windSpeedBandCounts,
		waveHeightBandCounts: venue.waveHeightBandCounts,
		readiness,
		warnings: [],
	};
}

function updateDerivedManifest({ generatedAt, dateRange, summary }) {
	const existing = readJson(derivedManifestPath);
	const newPaths = new Set([`${outputRoot}/latest.json`, `${outputRoot}/history-summary.json`]);
	const files = asArray(existing.files).filter((file) => !newPaths.has(file?.path));
	const coverageStatus = summary.weatherAvailableRaceCount > 0 ? "ready" : "missing";
	files.push(
		{ path: `${outputRoot}/history-summary.json`, kind: "boat-ex-weather-water-history-summary-v1", date: dateRange.to, generatedAt, sourceStatus: "available", coverageStatus, recordCount: summary.raceCount },
		{ path: `${outputRoot}/latest.json`, kind: "boat-ex-weather-water-history-v1", date: dateRange.to, generatedAt, sourceStatus: "available", coverageStatus, recordCount: summary.raceCount },
	);
	writeJson(derivedManifestPath, { ...existing, generatedAt, files });
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson(indexPath);
	const dates = asArray(index.availableDates).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
	if (!dates.length) throw new Error("EX date index has no availableDates");
	const venues = new Map();
	let raceCount = 0;
	let weatherAvailableRaceCount = 0;
	let windSpeedAvailableRaceCount = 0;
	let waveHeightAvailableRaceCount = 0;

	for (const date of dates) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyPath);
		for (const record of asArray(history.records)) {
			if (!asText(record?.venueCode) || !asText(record?.venueName)) continue;
			const venue = venues.get(record.venueCode) ?? emptyVenue(record);
			venues.set(record.venueCode, venue);
			venue.dates.add(date);
			venue.raceCount += 1;
			raceCount += 1;
			const weather = record.weather ?? null;
			if (!weather || typeof weather !== "object") continue;
			venue.weatherAvailableRaceCount += 1;
			weatherAvailableRaceCount += 1;
			const condition = asText(weather.weather);
			const direction = asText(weather.windDirection);
			if (condition) increment(venue.weatherConditionCounts, condition);
			if (direction) increment(venue.windDirectionCounts, direction);
			const wind = numberValue(weather.windSpeedMps);
			const wave = numberValue(weather.waveHeightCm);
			increment(venue.windSpeedBandCounts, windBand(wind));
			increment(venue.waveHeightBandCounts, waveBand(wave));
			if (wind !== null) { venue.windSpeeds.push(wind); venue.windSpeedAvailableRaceCount += 1; windSpeedAvailableRaceCount += 1; }
			if (wave !== null) { venue.waveHeights.push(wave); venue.waveHeightAvailableRaceCount += 1; waveHeightAvailableRaceCount += 1; }
		}
	}

	const finalizedVenues = [...venues.values()].map(finalizeVenue).sort((left, right) => left.venueCode.localeCompare(right.venueCode, "ja"));
	const dateRange = { from: dates[0], to: dates[dates.length - 1], dateCount: dates.length };
	const summary = {
		raceCount,
		venueCount: finalizedVenues.length,
		weatherAvailableRaceCount,
		weatherCoverageRate: raceCount ? Math.round((weatherAvailableRaceCount / raceCount) * 10000) / 10000 : 0,
		windSpeedAvailableRaceCount,
		waveHeightAvailableRaceCount,
	};
	const generatedAt = new Date().toISOString();
	const sourceFiles = [
		{ sourceName: "boatrace-ex-date-index", sourceType: "derived", sourcePath: indexPath, generatedAt: index.generatedAt, sourceStatus: "available", coverageStatus: "available" },
		...dates.map((date) => ({ sourceName: "boatrace-ex-history-races", sourceType: "derived", sourcePath: `public/data/boatrace-ex/history/races/${date}.json`, sourceStatus: "available", coverageStatus: "available" })),
	];
	const output = { schemaVersion: 1, kind: "boat-ex-weather-water-history-v1", generatedAt, sourceFiles, dateRange, summary, venues: finalizedVenues };
	const historySummary = { schemaVersion: 1, kind: "boat-ex-weather-water-history-summary-v1", generatedAt, sourceFiles, dateRange, summary };
	if (!args.dryRun) {
		writeJson(`${outputRoot}/latest.json`, output);
		writeJson(`${outputRoot}/history-summary.json`, historySummary);
		updateDerivedManifest({ generatedAt, dateRange, summary });
	}
	console.log(JSON.stringify({ dryRun: args.dryRun, outputs: [`${outputRoot}/latest.json`, `${outputRoot}/history-summary.json`], dateRange, summary }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
