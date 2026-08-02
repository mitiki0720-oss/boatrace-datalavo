import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_ROOT = "public/data/boatrace-ex/derived";
const KIND = "boatrace-ex-venue-evidence";
const MANIFEST_KIND = "boatrace-ex-derived-manifest";

function parseArgs(argv) {
	const args = {
		date: undefined,
		dryRun: false,
		allowEmpty: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--date") {
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD");
			args.date = next;
			index += 1;
			continue;
		}
		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}
		if (arg === "--allow-empty") {
			args.allowEmpty = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
		throw new Error(`Invalid --date value: ${args.date}`);
	}

	return args;
}

function readJson(relativePath) {
	const absolutePath = path.join(repoRoot, relativePath);
	return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readJsonIfExists(relativePath) {
	const absolutePath = path.join(repoRoot, relativePath);
	if (!fs.existsSync(absolutePath)) return null;
	return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readRequiredInputs({ date, allowEmpty }) {
	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const coveragePath = `public/data/boatrace-ex/coverage/${date}.json`;

	try {
		return {
			history: readJson(historyPath),
			coverage: readJson(coveragePath),
		};
	} catch (error) {
		if (!allowEmpty) throw error;
		const generatedAt = new Date().toISOString();
		return {
			history: {
				schemaVersion: 1,
				kind: "boatrace-ex-history-races",
				date,
				generatedAt,
				sourceFiles: [],
				records: [],
			},
			coverage: {
				schemaVersion: 1,
				kind: "boatrace-ex-coverage-date",
				date,
				generatedAt,
				sourceFiles: [],
				totals: {
					venues: 0,
					races: 0,
				},
				venues: [],
			},
		};
	}
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const absolutePath = path.join(repoRoot, relativePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toArray(value) {
	return Array.isArray(value) ? value : [];
}

function statusFromCount(count, total) {
	if (total <= 0) return "missing";
	if (count >= total) return "available";
	if (count > 0) return "partial";
	return "missing";
}

function parseNumber(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return undefined;
	const normalized = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/u)?.[0];
	if (!normalized) return undefined;
	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function average(values) {
	const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value));
	if (numbers.length === 0) return null;
	return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 100) / 100;
}

function max(values) {
	const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value));
	return numbers.length > 0 ? Math.max(...numbers) : null;
}

function sourceFilesFor(date, history, coverage) {
	return [
		{
			sourceName: "boatrace-ex-history-races",
			sourceType: "derived",
			sourcePath: `public/data/boatrace-ex/history/races/${date}.json`,
			generatedAt: history.generatedAt,
			sourceStatus: toArray(history.records).length > 0 ? "available" : "parse-empty",
			coverageStatus: toArray(history.records).length > 0 ? "partial" : "missing",
		},
		{
			sourceName: "boatrace-ex-coverage",
			sourceType: "derived",
			sourcePath: `public/data/boatrace-ex/coverage/${date}.json`,
			generatedAt: coverage.generatedAt,
			sourceStatus: coverage?.totals?.races > 0 ? "available" : "parse-empty",
			coverageStatus: coverage?.totals?.races > 0 ? "partial" : "missing",
		},
	];
}

function readiness() {
	return {
		venueBias: {
			status: "insufficient-history",
			reason: "Only 1 history day is available. Venue bias scoring requires accumulated multi-day evidence.",
		},
		roughIndex: {
			status: "insufficient-history",
			reason: "Roughness scoring is pending until payout/result history accumulates.",
		},
		todayFlow: {
			status: "insufficient-history",
			reason: "Today flow requires same-day sequence rules and more validated result coverage.",
		},
		predictionSignals: {
			status: "pending",
			reason: "Prediction signal generation is scheduled for a later phase.",
		},
	};
}

function makeVenueEvidence(date, venue, records) {
	const raceCount = records.length;
	const resultRecords = records.filter((record) => record.officialResult);
	const exhibitionRecords = records.filter((record) => record.officialExhibition);
	const weatherRecords = records.filter((record) => record.weather);
	const motorRecords = records.filter((record) => toArray(record.motor).length > 0);
	const boatRecords = records.filter((record) => toArray(record.boat).length > 0);
	const racerRecords = records.filter((record) => toArray(record.racer).length > 0);
	const trifectaPayouts = [];
	const winningTechniqueCounts = {};
	const courseWinCounts = {};
	const exhibitionTimesByFrame = {};
	const weatherWindSpeeds = [];
	const weatherWaveHeights = [];

	for (const record of records) {
		const result = record.officialResult;
		if (result?.winningTechnique) {
			winningTechniqueCounts[result.winningTechnique] = (winningTechniqueCounts[result.winningTechnique] ?? 0) + 1;
		}
		const winningLane = toArray(result?.finishOrder)[0];
		if (winningLane !== undefined && winningLane !== null) {
			const key = String(winningLane);
			courseWinCounts[key] = (courseWinCounts[key] ?? 0) + 1;
		}
		const trifecta = toArray(result?.payout).find((payout) => String(payout?.betType ?? "").includes("3連単"));
		const payoutYen = parseNumber(trifecta?.payoutYen);
		if (payoutYen !== undefined) trifectaPayouts.push(payoutYen);

		for (const entry of toArray(record.officialExhibition?.entries)) {
			const frame = String(entry?.lane ?? "");
			const exhibitionTime = parseNumber(entry?.exhibitionTime);
			if (!frame || exhibitionTime === undefined) continue;
			exhibitionTimesByFrame[frame] = exhibitionTimesByFrame[frame] ?? [];
			exhibitionTimesByFrame[frame].push(exhibitionTime);
		}

		const windSpeed = parseNumber(record.weather?.windSpeedMps);
		if (windSpeed !== undefined) weatherWindSpeeds.push(windSpeed);
		const waveHeight = parseNumber(record.weather?.waveHeightCm);
		if (waveHeight !== undefined) weatherWaveHeights.push(waveHeight);
	}

	const averageExhibitionTimeByFrame = Object.fromEntries(
		Object.entries(exhibitionTimesByFrame).map(([frame, values]) => [frame, average(values)]),
	);
	const topExhibitionTimeFrames = Object.entries(averageExhibitionTimeByFrame)
		.filter(([, value]) => typeof value === "number")
		.sort((left, right) => left[1] - right[1])
		.slice(0, 3)
		.map(([frame, averageExhibitionTime]) => ({ frame: Number(frame), averageExhibitionTime }));

	return {
		date,
		venueCode: venue.venueCode,
		venueName: venue.venueName,
		raceCount,
		coverage: {
			race: statusFromCount(records.filter((record) => record.officialRace).length, raceCount),
			result: statusFromCount(resultRecords.length, raceCount),
			exhibition: statusFromCount(exhibitionRecords.length, raceCount),
			weather: statusFromCount(weatherRecords.length, raceCount),
			motor: statusFromCount(motorRecords.length, raceCount),
			boat: statusFromCount(boatRecords.length, raceCount),
			racer: statusFromCount(racerRecords.length, raceCount),
		},
		availability: {
			officialRaceCount: records.filter((record) => record.officialRace).length,
			officialResultCount: resultRecords.length,
			officialExhibitionCount: exhibitionRecords.length,
			weatherCount: weatherRecords.length,
		},
		resultEvidence: {
			resultAvailableCount: resultRecords.length,
			trifectaAvailableCount: trifectaPayouts.length,
			payoutAvailableCount: resultRecords.filter((record) => toArray(record.officialResult?.payout).length > 0).length,
			winningTechniqueCounts,
			courseWinCounts,
			averageTrifectaPayout: average(trifectaPayouts),
			maxTrifectaPayout: max(trifectaPayouts),
			highPayoutRaceCount: trifectaPayouts.length > 0 ? trifectaPayouts.filter((value) => value >= 10000).length : null,
		},
		exhibitionEvidence: {
			availableCount: exhibitionRecords.length,
			missingCount: Math.max(raceCount - exhibitionRecords.length, 0),
			topExhibitionTimeFrames,
			averageExhibitionTimeByFrame,
		},
		weatherEvidence: {
			availableCount: weatherRecords.length,
			windSpeedAverageMps: average(weatherWindSpeeds),
			windSpeedMaxMps: max(weatherWindSpeeds),
			waveHeightAverageCm: average(weatherWaveHeights),
			waveHeightMaxCm: max(weatherWaveHeights),
		},
		derivedReadiness: readiness(),
		warnings: toArray(venue.warnings),
	};
}

function createEmptyOutputMessage({ date, records, venues, allowed }) {
	return [
		allowed
			? "Allowing empty BOATRACE EX venue evidence output because --allow-empty was provided."
			: "Refusing to write empty BOATRACE EX venue evidence output.",
		`date: ${date}`,
		`records: ${records}`,
		`venues: ${venues}`,
		"Use --allow-empty only when intentionally creating an empty output.",
	].join("\n");
}

function mergeManifest({ date, generatedAt, sourceFiles, outputPath, records, venues }) {
	const manifestPath = `${OUTPUT_ROOT}/manifest.generated.json`;
	const existing = readJsonIfExists(manifestPath);
	const files = toArray(existing?.files).filter((file) => file?.path !== outputPath);
	files.push({
		path: outputPath,
		kind: "derived",
		date,
		generatedAt,
		sourceStatus: records.length > 0 ? "available" : "parse-empty",
		coverageStatus: venues.length > 0 ? "partial" : "missing",
	});
	return {
		schemaVersion: 1,
		kind: MANIFEST_KIND,
		generatedAt,
		sourceFiles,
		files: files.sort((left, right) => {
			const order = (file) => String(file.path ?? "").includes("/venue-evidence/") ? 0 :
				String(file.path ?? "").includes("/racer-evidence/") ? 1 : 2;
			return order(left) - order(right) || String(left.path ?? "").localeCompare(String(right.path ?? ""));
		}),
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const date = args.date;
	if (!date) throw new Error("--date is required");

	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const coveragePath = `public/data/boatrace-ex/coverage/${date}.json`;
	const outputPath = `${OUTPUT_ROOT}/venue-evidence/${date}.json`;
	const manifestPath = `${OUTPUT_ROOT}/manifest.generated.json`;
	const { history, coverage } = readRequiredInputs({ date, allowEmpty: args.allowEmpty });
	const records = toArray(history.records);
	const coverageVenues = toArray(coverage.venues);
	const venueRecords = new Map();

	for (const record of records) {
		if (!record?.venueCode) continue;
		if (!venueRecords.has(record.venueCode)) venueRecords.set(record.venueCode, []);
		venueRecords.get(record.venueCode).push(record);
	}

	const venues = coverageVenues
		.map((venue) => makeVenueEvidence(date, venue, venueRecords.get(venue.venueCode) ?? []))
		.sort((left, right) => String(left.venueCode).localeCompare(String(right.venueCode), "ja"));
	const sourceFiles = sourceFilesFor(date, history, coverage);
	const generatedAt = new Date().toISOString();
	const isEmptyOutput = records.length === 0 || venues.length === 0;

	if (isEmptyOutput) {
		const message = createEmptyOutputMessage({
			date,
			records: records.length,
			venues: venues.length,
			allowed: args.allowEmpty,
		});
		if (!args.allowEmpty) {
			console.error(message);
			console.log(JSON.stringify({
				dryRun: args.dryRun,
				date,
				records: records.length,
				venues: venues.length,
				outputs: [outputPath, manifestPath],
				refusedEmptyOutput: true,
			}, null, 2));
			process.exitCode = 1;
			return;
		}
		console.warn(message);
	}

	const evidenceJson = {
		schemaVersion: 1,
		kind: KIND,
		date,
		generatedAt,
		sourceFiles,
		summary: {
			venueCount: venues.length,
			recordCount: records.length,
			historyDays: records.length > 0 ? 1 : 0,
			analysisStatus: records.length > 0 ? "insufficient-history" : "missing",
		},
		venues,
	};
	const manifestJson = mergeManifest({ date, generatedAt, sourceFiles, outputPath, records, venues });

	writeJson(outputPath, evidenceJson, args.dryRun);
	writeJson(manifestPath, manifestJson, args.dryRun);

	console.log(JSON.stringify({
		dryRun: args.dryRun,
		date,
		records: records.length,
		venues: venues.length,
		outputs: [outputPath, manifestPath],
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
