import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const OUTPUT_PATH = "public/data/boatrace-ex/derived/prediction-structure/latest.json";
const DERIVED_MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function readJsonIfExists(relativePath) {
	const filePath = absolute(relativePath);
	return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasResult(record) {
	const finishOrder = record?.officialResult?.finishOrder;
	return Array.isArray(finishOrder) && finishOrder.length >= 3 && finishOrder.slice(0, 3).every((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 6);
}

function coverageFor(record) {
	return {
		officialRaceCount: hasObject(record?.officialRace) ? 1 : 0,
		resultAvailableRaceCount: hasResult(record) ? 1 : 0,
		exhibitionAvailableRaceCount: Array.isArray(record?.officialExhibition?.entries) && record.officialExhibition.entries.length > 0 ? 1 : 0,
		weatherAvailableRaceCount: hasObject(record?.weather) ? 1 : 0,
		motorAvailableRaceCount: Array.isArray(record?.motor) && record.motor.length > 0 ? 1 : 0,
		boatAvailableRaceCount: Array.isArray(record?.boat) && record.boat.length > 0 ? 1 : 0,
		racerAvailableRaceCount: Array.isArray(record?.racer) && record.racer.length > 0 ? 1 : 0,
	};
}

function emptyVenue(record) {
	return {
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceCount: 0,
		officialRaceCount: 0,
		resultAvailableRaceCount: 0,
		exhibitionAvailableRaceCount: 0,
		weatherAvailableRaceCount: 0,
		motorAvailableRaceCount: 0,
		boatAvailableRaceCount: 0,
		racerAvailableRaceCount: 0,
	};
}

function buildReadiness(summary) {
	if (summary.resultAvailableRaceCount === 0) {
		return { status: "insufficient-history", reason: "No result-backed races are available for the prediction structure coverage map." };
	}
	return { status: "insufficient-history", reason: "Prediction Structure LAB exposes source-backed coverage only; prediction signals are not generated." };
}

function collectStructure(index) {
	const targetDate = index?.latestDate;
	if (typeof targetDate !== "string" || !Array.isArray(index?.availableDates) || !index.availableDates.includes(targetDate)) {
		throw new Error("date index latestDate must be an available date");
	}
	const historyPath = `public/data/boatrace-ex/history/races/${targetDate}.json`;
	const history = readJson(historyPath);
	if (history?.date !== targetDate || !Array.isArray(history?.records)) throw new Error(`history is invalid for ${targetDate}`);

	const summary = {
		venueCount: 0,
		raceCount: 0,
		officialRaceCount: 0,
		resultAvailableRaceCount: 0,
		exhibitionAvailableRaceCount: 0,
		weatherAvailableRaceCount: 0,
		motorAvailableRaceCount: 0,
		boatAvailableRaceCount: 0,
		racerAvailableRaceCount: 0,
	};
	const venues = new Map();
	for (const record of history.records) {
		if (record?.date !== targetDate || typeof record?.venueCode !== "string" || typeof record?.venueName !== "string" || !Number.isInteger(record?.raceNo)) {
			throw new Error(`history record is missing source-backed date, venue, or race number for ${targetDate}`);
		}
		const venue = venues.get(record.venueCode) ?? emptyVenue(record);
		if (venue.venueName !== record.venueName) throw new Error(`venue name is inconsistent for venueCode ${record.venueCode}`);
		const coverage = coverageFor(record);
		venue.raceCount += 1;
		summary.raceCount += 1;
		for (const [key, value] of Object.entries(coverage)) {
			venue[key] += value;
			summary[key] += value;
		}
		venues.set(record.venueCode, venue);
	}
	summary.venueCount = venues.size;
	const normalizedVenues = [...venues.values()].map((venue) => ({
		...venue,
		warnings: [
			...(venue.resultAvailableRaceCount === 0 ? ["No source-backed result facts are available for this venue."] : []),
			...(venue.exhibitionAvailableRaceCount < venue.raceCount ? ["Exhibition coverage is partial for this venue."] : []),
		],
	})).sort((left, right) => left.venueCode.localeCompare(right.venueCode, "ja"));
	const readiness = buildReadiness(summary);
	return {
		status: "available",
		readiness,
		targetDate,
		dateRange: { from: targetDate, to: targetDate, dateCount: 1 },
		summary,
		venues: normalizedVenues,
		sourceFiles: [
			{ sourceName: "BOATRACE EX date index", sourcePath: DATE_INDEX_PATH, sourceStatus: "available", coverageStatus: "available" },
			{ sourceName: `BOATRACE EX history ${targetDate}`, sourcePath: historyPath, sourceStatus: "available", coverageStatus: "partial" },
		],
		warnings: ["Prediction Structure LAB reports source-backed coverage only. Prediction signals are not generated."],
	};
}

function mergeManifest(entry, generatedAt) {
	const existing = readJsonIfExists(DERIVED_MANIFEST_PATH);
	const files = Array.isArray(existing?.files) ? existing.files.filter((file) => file?.path !== entry.path) : [];
	files.push(entry);
	files.sort((left, right) => String(left.path ?? "").localeCompare(String(right.path ?? "")));
	return { schemaVersion: 1, kind: "boatrace-ex-derived-manifest", generatedAt, sourceFiles: Array.isArray(existing?.sourceFiles) ? existing.sourceFiles : [], files };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const structure = collectStructure(readJson(DATE_INDEX_PATH));
	const output = { schemaVersion: "boat-ex-prediction-structure-v1", generatedAt, ...structure };
	const manifest = mergeManifest({
		path: OUTPUT_PATH,
		kind: "boatrace-ex-prediction-structure-v1",
		date: output.targetDate,
		recordCount: output.summary.raceCount,
		venueCount: output.summary.venueCount,
		resultAvailableRaceCount: output.summary.resultAvailableRaceCount,
		generatedAt,
		sourceStatus: "available",
		coverageStatus: "partial",
	}, generatedAt);
	writeJson(OUTPUT_PATH, output, args.dryRun);
	writeJson(DERIVED_MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, path: OUTPUT_PATH, targetDate: output.targetDate, venueCount: output.summary.venueCount, raceCount: output.summary.raceCount, resultAvailableRaceCount: output.summary.resultAvailableRaceCount, readiness: output.readiness.status }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
