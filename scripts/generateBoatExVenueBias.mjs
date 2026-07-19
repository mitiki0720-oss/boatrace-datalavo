import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_PATH = "public/data/boatrace-ex/derived/venue-bias/latest.json";
const DERIVED_MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const MIN_DATE_COUNT = 7;
const BOAT_NUMBERS = [1, 2, 3, 4, 5, 6];

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
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
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function createBoatNumberCounts() {
	return Object.fromEntries(BOAT_NUMBERS.map((boatNumber) => [String(boatNumber), 0]));
}

function rateCounts(counts, denominator) {
	return Object.fromEntries(BOAT_NUMBERS.map((boatNumber) => {
		const count = counts[String(boatNumber)] ?? 0;
		return [String(boatNumber), denominator > 0 ? Math.round((count / denominator) * 1_000_000) / 1_000_000 : null];
	}));
}

function addFinishOrderCounts(record, venue) {
	const finishOrder = Array.isArray(record.officialResult?.finishOrder) ? record.officialResult.finishOrder : [];
	const firstPlace = Number(finishOrder[0]);
	if (BOAT_NUMBERS.includes(firstPlace)) {
		venue.firstPlaceBoatNumberCounts[String(firstPlace)] += 1;
	}
	for (const boatNumber of finishOrder.slice(0, 3).map(Number)) {
		if (BOAT_NUMBERS.includes(boatNumber)) {
			venue.top3BoatNumberCounts[String(boatNumber)] += 1;
		}
	}
}

function collectVenueBias(index) {
	const dates = [...new Set(index.availableDates ?? [])].sort();
	if (dates.length === 0) throw new Error("date index availableDates must not be empty");

	const venues = new Map();
	const sourceFiles = [DATE_INDEX_PATH];
	let raceCount = 0;
	let resultAvailableRaceCount = 0;
	let exhibitionAvailableRaceCount = 0;

	for (const date of dates) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyPath);
		if (history.date !== date || !Array.isArray(history.records)) {
			throw new Error(`history is invalid for ${date}`);
		}
		sourceFiles.push(historyPath);

		for (const record of history.records) {
			if (record?.date !== date || !record?.venueCode || !record?.venueName) {
				throw new Error(`history record is missing source-backed date or venue for ${date}`);
			}
			const venueId = String(record.venueCode);
			const venue = venues.get(venueId) ?? {
				venueId,
				venueName: record.venueName,
				dates: new Set(),
				raceCount: 0,
				resultAvailableRaceCount: 0,
				exhibitionAvailableRaceCount: 0,
				firstPlaceBoatNumberCounts: createBoatNumberCounts(),
				top3BoatNumberCounts: createBoatNumberCounts(),
			};
			if (venue.venueName !== record.venueName) {
				throw new Error(`venue name is inconsistent for venueId ${venueId}`);
			}

			venue.dates.add(date);
			venue.raceCount += 1;
			raceCount += 1;
			if (record.officialResult) {
				venue.resultAvailableRaceCount += 1;
				resultAvailableRaceCount += 1;
				addFinishOrderCounts(record, venue);
			}
			if (record.officialExhibition) {
				venue.exhibitionAvailableRaceCount += 1;
				exhibitionAvailableRaceCount += 1;
			}
			venues.set(venueId, venue);
		}
	}

	const readiness = dates.length < MIN_DATE_COUNT
		? {
			status: "insufficient-history",
			reason: `dateCount ${dates.length} is below minDateCount ${MIN_DATE_COUNT}`,
			minDateCount: MIN_DATE_COUNT,
		}
		: {
			status: "ready",
			reason: `dateCount ${dates.length} meets minDateCount ${MIN_DATE_COUNT}`,
			minDateCount: MIN_DATE_COUNT,
		};

	return {
		status: "available",
		readiness,
		dateRange: {
			from: dates[0],
			to: dates.at(-1),
			dates,
			dateCount: dates.length,
		},
		summary: {
			raceCount,
			venueCount: venues.size,
			resultAvailableRaceCount,
			exhibitionAvailableRaceCount,
		},
		venues: [...venues.values()]
			.map((venue) => ({
				venueId: venue.venueId,
				venueName: venue.venueName,
				dateCount: venue.dates.size,
				raceCount: venue.raceCount,
				resultAvailableRaceCount: venue.resultAvailableRaceCount,
				exhibitionAvailableRaceCount: venue.exhibitionAvailableRaceCount,
				readiness: dates.length < MIN_DATE_COUNT
					? { status: "insufficient-history", reason: "venue sample is below threshold" }
					: { status: "ready", reason: "venue sample meets date threshold" },
				firstPlaceBoatNumberCounts: venue.firstPlaceBoatNumberCounts,
				firstPlaceBoatNumberRates: rateCounts(venue.firstPlaceBoatNumberCounts, venue.resultAvailableRaceCount),
				top3BoatNumberCounts: venue.top3BoatNumberCounts,
				top3BoatNumberRates: rateCounts(venue.top3BoatNumberCounts, venue.resultAvailableRaceCount),
			}))
			.sort((left, right) => left.venueId.localeCompare(right.venueId, "ja")),
		sourceFiles,
		warnings: [],
	};
}

function evidenceManifestEntries(index) {
	const entries = [];
	for (const date of [...new Set(index.availableDates ?? [])].sort()) {
		const venuePath = `public/data/boatrace-ex/derived/venue-evidence/${date}.json`;
		const racerPath = `public/data/boatrace-ex/derived/racer-evidence/${date}.json`;
		const venueEvidence = readJson(venuePath);
		const racerEvidence = readJson(racerPath);
		entries.push({
			path: venuePath,
			kind: "derived",
			date,
			generatedAt: venueEvidence.generatedAt,
			sourceStatus: "available",
			coverageStatus: "partial",
		});
		entries.push({
			path: racerPath,
			kind: "boatrace-ex-racer-evidence",
			date,
			recordCount: venueEvidence.summary?.recordCount ?? null,
			racerCount: racerEvidence.summary?.racerCount ?? null,
			generatedAt: racerEvidence.generatedAt,
			sourceStatus: "available",
			coverageStatus: "partial",
		});
	}
	return entries;
}

function mergeManifest(entries, generatedAt) {
	const existing = readJsonIfExists(DERIVED_MANIFEST_PATH);
	const entryPaths = new Set(entries.map((entry) => entry.path));
	const files = Array.isArray(existing?.files) ? existing.files.filter((file) => !entryPaths.has(file?.path)) : [];
	files.push(...entries);
	files.sort((left, right) => String(left.path ?? "").localeCompare(String(right.path ?? "")));

	return {
		schemaVersion: 1,
		kind: "boatrace-ex-derived-manifest",
		generatedAt,
		sourceFiles: Array.isArray(existing?.sourceFiles) ? existing.sourceFiles : [],
		files,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson(DATE_INDEX_PATH);
	const generatedAt = new Date().toISOString();
	const bias = collectVenueBias(index);
	const output = {
		schemaVersion: "boat-ex-venue-bias-v1",
		generatedAt,
		...bias,
	};
	const manifest = mergeManifest([...evidenceManifestEntries(index), {
		path: OUTPUT_PATH,
		kind: "boatrace-ex-venue-bias-v1",
		date: output.dateRange.to,
		recordCount: output.summary.raceCount,
		venueCount: output.summary.venueCount,
		generatedAt,
		sourceStatus: "available",
		coverageStatus: "partial",
	}], generatedAt);

	writeJson(OUTPUT_PATH, output, args.dryRun);
	writeJson(DERIVED_MANIFEST_PATH, manifest, args.dryRun);

	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		path: OUTPUT_PATH,
		dateCount: output.dateRange.dateCount,
		raceCount: output.summary.raceCount,
		venueCount: output.summary.venueCount,
		readiness: output.readiness.status,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
