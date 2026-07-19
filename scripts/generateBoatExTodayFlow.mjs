import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_PATH = "public/data/boatrace-ex/derived/today-flow/latest.json";
const DERIVED_MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const MIN_RESULT_RACE_COUNT = 3;
const HIGH_PAYOUT_YEN = 10_000;

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
	return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseYen(value) {
	if (typeof value === "number") {
		return Number.isSafeInteger(value) && value >= 0 ? value : null;
	}

	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").replace(/[,\s円¥￥]/g, "");
	if (!/^\d+$/.test(normalized)) return null;
	const amount = Number(normalized);
	return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function trifectaPayout(record) {
	const payouts = Array.isArray(record?.officialResult?.payout) ? record.officialResult.payout : [];

	for (const payout of payouts) {
		const type = [payout?.betType, payout?.type, payout?.name]
			.filter((value) => typeof value === "string")
			.join(" ")
			.normalize("NFKC")
			.toLowerCase();
		if (!type.includes("3連単") && !type.includes("三連単") && !type.includes("trifecta")) continue;

		for (const value of [payout?.payoutYen, payout?.amount, payout?.payoutAmount, payout?.payout, payout?.yen]) {
			const amount = parseYen(value);
			if (amount !== null) return amount;
		}
	}

	return null;
}

function firstPlaceBoat(record) {
	const value = record?.officialResult?.finishOrder?.[0];
	const boat = Number(value);
	return Number.isInteger(boat) && boat >= 1 && boat <= 6 ? String(boat) : null;
}

function buildReadiness(resultAvailableRaceCount, payoutAvailableRaceCount) {
	if (resultAvailableRaceCount === 0) {
		return {
			status: "insufficient-history",
			reason: "No result-backed races are available.",
		};
	}

	if (resultAvailableRaceCount < MIN_RESULT_RACE_COUNT) {
		return {
			status: "insufficient-history",
			reason: "Result-backed race count is below minimum display threshold.",
		};
	}

	if (payoutAvailableRaceCount === 0) {
		return {
			status: "available",
			reason: "Payout data is not available; payout-based flow facts are disabled.",
		};
	}

	return {
		status: "available",
		reason: "Source-backed same-day result and payout facts are available.",
	};
}

function createVenue(record) {
	return {
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceCount: 0,
		resultAvailableRaceCount: 0,
		firstPlaceBoatCounts: Object.fromEntries([1, 2, 3, 4, 5, 6].map((boat) => [String(boat), 0])),
		firstPlaceBoatSequence: [],
		payoutAvailableRaceCount: 0,
		highPayoutRaceCount: 0,
	};
}

function collectTodayFlow(index) {
	const targetDate = index?.latestDate;
	if (typeof targetDate !== "string" || !Array.isArray(index?.availableDates) || !index.availableDates.includes(targetDate)) {
		throw new Error("date index latestDate must be an available date");
	}

	const historyPath = `public/data/boatrace-ex/history/races/${targetDate}.json`;
	const history = readJson(historyPath);
	if (history?.date !== targetDate || !Array.isArray(history?.records)) {
		throw new Error(`history is invalid for ${targetDate}`);
	}

	const venues = new Map();
	let raceCount = 0;
	let resultAvailableRaceCount = 0;
	let trifectaAvailableRaceCount = 0;
	let payoutAvailableRaceCount = 0;

	for (const record of history.records) {
		if (record?.date !== targetDate || typeof record?.venueCode !== "string" || typeof record?.venueName !== "string" || !Number.isInteger(record?.raceNo)) {
			throw new Error(`history record is missing source-backed date, venue, or race number for ${targetDate}`);
		}

		const venue = venues.get(record.venueCode) ?? createVenue(record);
		if (venue.venueName !== record.venueName) {
			throw new Error(`venue name is inconsistent for venueCode ${record.venueCode}`);
		}

		const firstPlace = firstPlaceBoat(record);
		const payoutYen = trifectaPayout(record);
		const trifecta = typeof record?.officialResult?.trifecta === "string" && record.officialResult.trifecta.length > 0
			? record.officialResult.trifecta
			: null;

		venue.raceCount += 1;
		raceCount += 1;
		if (firstPlace !== null) {
			venue.resultAvailableRaceCount += 1;
			venue.firstPlaceBoatCounts[firstPlace] += 1;
			resultAvailableRaceCount += 1;
		}
		if (trifecta !== null) trifectaAvailableRaceCount += 1;
		if (payoutYen !== null) {
			venue.payoutAvailableRaceCount += 1;
			payoutAvailableRaceCount += 1;
			if (payoutYen >= HIGH_PAYOUT_YEN) venue.highPayoutRaceCount += 1;
		}

		venue.firstPlaceBoatSequence.push({
			raceNo: record.raceNo,
			firstPlaceBoat: firstPlace,
			trifecta,
			payoutYen,
		});
		venues.set(record.venueCode, venue);
	}

	const normalizedVenues = [...venues.values()]
		.map((venue) => {
			const sequence = venue.firstPlaceBoatSequence.sort((left, right) => left.raceNo - right.raceNo);
			const knownResults = sequence.filter((item) => item.firstPlaceBoat !== null);
			const recentFirstPlaceBoats = knownResults.slice(-3).map((item) => item.firstPlaceBoat);
			const notes = [];
			if (venue.resultAvailableRaceCount === 0) notes.push("No source-backed results are available for this venue.");
			if (venue.payoutAvailableRaceCount === 0) notes.push("No source-backed trifecta payout values are available for this venue.");

			return {
				venueCode: venue.venueCode,
				venueName: venue.venueName,
				raceCount: venue.raceCount,
				resultAvailableRaceCount: venue.resultAvailableRaceCount,
				firstPlaceBoatCounts: venue.firstPlaceBoatCounts,
				firstPlaceBoatSequence: sequence,
				latestKnownRaceNo: sequence.at(-1)?.raceNo ?? null,
				recentFirstPlaceBoats,
				insideWinCount: knownResults.filter((item) => ["1", "2", "3"].includes(item.firstPlaceBoat)).length,
				outsideWinCount: knownResults.filter((item) => ["4", "5", "6"].includes(item.firstPlaceBoat)).length,
				payoutAvailableRaceCount: venue.payoutAvailableRaceCount,
				highPayoutRaceCount: venue.highPayoutRaceCount,
				notes,
			};
		})
		.sort((left, right) => left.venueCode.localeCompare(right.venueCode, "ja"));

	const readiness = buildReadiness(resultAvailableRaceCount, payoutAvailableRaceCount);
	const warnings = [];
	if (resultAvailableRaceCount === 0) warnings.push("No source-backed same-day result facts are available.");
	if (payoutAvailableRaceCount === 0) warnings.push("Payout data is not available; payout-based flow facts are disabled.");

	return {
		status: "available",
		readiness,
		targetDate,
		dateRange: { from: targetDate, to: targetDate, dateCount: 1 },
		summary: {
			venueCount: normalizedVenues.length,
			raceCount,
			resultAvailableRaceCount,
			trifectaAvailableRaceCount,
			payoutAvailableRaceCount,
		},
		venues: normalizedVenues,
		sourceFiles: [
			{ sourceName: "BOATRACE EX date index", sourcePath: DATE_INDEX_PATH, sourceStatus: "available", coverageStatus: "available" },
			{ sourceName: `BOATRACE EX history ${targetDate}`, sourcePath: historyPath, sourceStatus: "available", coverageStatus: "partial" },
		],
		warnings,
	};
}

function mergeManifest(entry, generatedAt) {
	const existing = readJsonIfExists(DERIVED_MANIFEST_PATH);
	const files = Array.isArray(existing?.files) ? existing.files.filter((file) => file?.path !== entry.path) : [];
	files.push(entry);
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
	const generatedAt = new Date().toISOString();
	const todayFlow = collectTodayFlow(readJson(DATE_INDEX_PATH));
	const output = { schemaVersion: "boat-ex-today-flow-v1", generatedAt, ...todayFlow };
	const manifest = mergeManifest({
		path: OUTPUT_PATH,
		kind: "boatrace-ex-today-flow-v1",
		date: output.targetDate,
		recordCount: output.summary.raceCount,
		venueCount: output.summary.venueCount,
		resultAvailableRaceCount: output.summary.resultAvailableRaceCount,
		payoutAvailableRaceCount: output.summary.payoutAvailableRaceCount,
		generatedAt,
		sourceStatus: "available",
		coverageStatus: "partial",
	}, generatedAt);

	writeJson(OUTPUT_PATH, output, args.dryRun);
	writeJson(DERIVED_MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		path: OUTPUT_PATH,
		targetDate: output.targetDate,
		venueCount: output.summary.venueCount,
		raceCount: output.summary.raceCount,
		resultAvailableRaceCount: output.summary.resultAvailableRaceCount,
		payoutAvailableRaceCount: output.summary.payoutAvailableRaceCount,
		readiness: output.readiness.status,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
