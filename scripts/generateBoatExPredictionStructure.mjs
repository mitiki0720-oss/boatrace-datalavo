import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const OUTPUT_PATH = "public/data/boatrace-ex/derived/prediction-structure/latest.json";
const PREDICTION_AUDIT_DIRECTORY = "public/data/boatrace-ex/audit";
const DERIVED_MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const MIN_PREDICTION_TEXT_RACE_COUNT = 30;
const MIN_STRUCTURED_TICKET_RACE_COUNT = 30;
const MIN_EVALUATED_PREDICTION_RACE_COUNT = 30;

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
	return Array.isArray(finishOrder)
		&& finishOrder.length >= 3
		&& finishOrder.slice(0, 3).every((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 6);
}

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").replace(/[,\s円¥￥]/g, "");
	if (!/^\d+$/u.test(normalized)) return null;
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

function hasSourceBackedPredictionText(record) {
	const prediction = record?.prediction;
	return hasObject(prediction)
		&& prediction.sourceStatus === "available"
		&& typeof prediction.textExcerpt === "string"
		&& prediction.textExcerpt.trim().length > 0;
}

function hasStructuredTickets(record) {
	const candidates = [
		record?.tickets,
		record?.ticketGroups,
		record?.bets,
		record?.recommendedTickets,
		record?.buyTickets,
		record?.prediction?.tickets,
		record?.prediction?.ticketGroups,
		record?.prediction?.bets,
		record?.prediction?.recommendedTickets,
		record?.prediction?.buyTickets,
	];
	return candidates.some((value) => Array.isArray(value) && value.length > 0);
}

function coverageFor(record) {
	const resultAvailable = hasResult(record);
	const payoutAvailable = trifectaPayout(record) !== null;
	const predictionTextAvailable = hasSourceBackedPredictionText(record);
	const structuredTicketAvailable = hasStructuredTickets(record);
	return {
		officialRaceCount: hasObject(record?.officialRace) ? 1 : 0,
		resultAvailableRaceCount: resultAvailable ? 1 : 0,
		payoutAvailableRaceCount: payoutAvailable ? 1 : 0,
		exhibitionAvailableRaceCount: Array.isArray(record?.officialExhibition?.entries) && record.officialExhibition.entries.length > 0 ? 1 : 0,
		weatherAvailableRaceCount: hasObject(record?.weather) ? 1 : 0,
		motorAvailableRaceCount: Array.isArray(record?.motor) && record.motor.length > 0 ? 1 : 0,
		boatAvailableRaceCount: Array.isArray(record?.boat) && record.boat.length > 0 ? 1 : 0,
		racerAvailableRaceCount: Array.isArray(record?.racer) && record.racer.length > 0 ? 1 : 0,
		predictionTextAvailableRaceCount: predictionTextAvailable ? 1 : 0,
		structuredTicketAvailableRaceCount: structuredTicketAvailable ? 1 : 0,
		evaluatedPredictionRaceCount: structuredTicketAvailable && resultAvailable && payoutAvailable ? 1 : 0,
	};
}

function emptySummary() {
	return {
		venueCount: 0,
		raceCount: 0,
		officialRaceCount: 0,
		resultAvailableRaceCount: 0,
		payoutAvailableRaceCount: 0,
		exhibitionAvailableRaceCount: 0,
		weatherAvailableRaceCount: 0,
		motorAvailableRaceCount: 0,
		boatAvailableRaceCount: 0,
		racerAvailableRaceCount: 0,
		predictionTextAvailableRaceCount: 0,
		structuredTicketAvailableRaceCount: 0,
		evaluatedPredictionRaceCount: 0,
	};
}

function emptyVenue(record) {
	const { venueCount, ...coverage } = emptySummary();
	return { venueCode: record.venueCode, venueName: record.venueName, ...coverage };
}

function buildReadiness(summary) {
	const requirements = [
		["predictionTextAvailableRaceCount", MIN_PREDICTION_TEXT_RACE_COUNT],
		["structuredTicketAvailableRaceCount", MIN_STRUCTURED_TICKET_RACE_COUNT],
		["evaluatedPredictionRaceCount", MIN_EVALUATED_PREDICTION_RACE_COUNT],
	];
	const missingRequirements = requirements
		.filter(([key, minimum]) => summary[key] < minimum)
		.map(([key, minimum]) => `${key} ${summary[key]} is below minimum ${minimum}`);
	return {
		status: missingRequirements.length === 0 ? "ready" : "insufficient-history",
		reason: missingRequirements.length === 0
			? "Source-backed structured prediction tickets and evaluated results meet the minimum thresholds."
			: missingRequirements.join("; "),
		missingRequirements,
		availableCounts: {
			predictionTextAvailableRaceCount: summary.predictionTextAvailableRaceCount,
			structuredTicketAvailableRaceCount: summary.structuredTicketAvailableRaceCount,
			evaluatedPredictionRaceCount: summary.evaluatedPredictionRaceCount,
			resultAvailableRaceCount: summary.resultAvailableRaceCount,
			payoutAvailableRaceCount: summary.payoutAvailableRaceCount,
		},
		thresholds: {
			minPredictionTextRaceCount: MIN_PREDICTION_TEXT_RACE_COUNT,
			minStructuredTicketRaceCount: MIN_STRUCTURED_TICKET_RACE_COUNT,
			minEvaluatedPredictionRaceCount: MIN_EVALUATED_PREDICTION_RACE_COUNT,
		},
	};
}

function collectStructure(index) {
	const targetDate = index?.latestDate;
	if (typeof targetDate !== "string" || !Array.isArray(index?.availableDates) || !index.availableDates.includes(targetDate)) {
		throw new Error("date index latestDate must be an available date");
	}
	const historyPath = `public/data/boatrace-ex/history/races/${targetDate}.json`;
	const history = readJson(historyPath);
	if (history?.date !== targetDate || !Array.isArray(history?.records)) throw new Error(`history is invalid for ${targetDate}`);

	const summary = emptySummary();
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
	const readiness = buildReadiness(summary);
	const normalizedVenues = [...venues.values()].map((venue) => ({
		...venue,
		warnings: [
			...(venue.predictionTextAvailableRaceCount === 0 ? ["No source-backed prediction text is available for this venue."] : []),
			...(venue.structuredTicketAvailableRaceCount === 0 ? ["No source-backed structured prediction tickets are available for this venue."] : []),
			...(venue.resultAvailableRaceCount === 0 ? ["No source-backed result facts are available for this venue."] : []),
		],
	})).sort((left, right) => left.venueCode.localeCompare(right.venueCode, "ja"));
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
		warnings: readiness.missingRequirements.length > 0
			? ["Prediction Structure LAB does not infer tickets, hits, misses, or payout values. See readiness.missingRequirements for the source-backed gaps."]
			: [],
	};
}

function collectHistoryCoverage(index) {
	const dates = [...new Set(index.availableDates ?? [])].sort();
	const summary = emptySummary();
	const sourceFiles = [DATE_INDEX_PATH];
	for (const date of dates) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyPath);
		if (history?.date !== date || !Array.isArray(history?.records)) throw new Error(`history is invalid for ${date}`);
		sourceFiles.push(historyPath);
		for (const record of history.records) {
			const coverage = coverageFor(record);
			summary.raceCount += 1;
			for (const [key, value] of Object.entries(coverage)) summary[key] += value;
		}
	}
	return { dateCount: dates.length, from: dates[0], to: dates.at(-1), summary, sourceFiles };
}

function mergeManifest(entry, generatedAt) {
	const existing = readJsonIfExists(DERIVED_MANIFEST_PATH);
	const files = Array.isArray(existing?.files) ? [...existing.files] : [];
	const existingIndex = files.findIndex((file) => file?.path === entry.path);
	if (existingIndex >= 0) files[existingIndex] = entry;
	else files.push(entry);
	return { schemaVersion: 1, kind: "boatrace-ex-derived-manifest", generatedAt, sourceFiles: Array.isArray(existing?.sourceFiles) ? existing.sourceFiles : [], files };
}

function predictionAuditPath(date) {
	return `${PREDICTION_AUDIT_DIRECTORY}/prediction-structure-contract-${date}.generated.json`;
}

function buildContractAudit(output, historyCoverage, generatedAt) {
	return {
		schemaVersion: 1,
		kind: "boatrace-ex-prediction-structure-contract-audit",
		auditDate: output.targetDate,
		generatedAt,
		mode: "source-backed",
		contract: {
			predictionText: "prediction.textExcerpt with prediction.sourceStatus === available",
			structuredTicketPaths: ["tickets", "ticketGroups", "bets", "recommendedTickets", "buyTickets", "prediction.tickets", "prediction.ticketGroups", "prediction.bets", "prediction.recommendedTickets", "prediction.buyTickets"],
			resultPath: "officialResult.finishOrder",
			payoutPath: "officialResult.payout[]",
			evaluatedPrediction: "structured ticket plus source-backed result and trifecta payout on the same history record",
			note: "Natural-language prediction text is not parsed into tickets. Tickets, hit or miss, and payout values are never inferred or generated.",
		},
		targetDate: {
			date: output.targetDate,
			summary: output.summary,
			readiness: output.readiness,
		},
		historyCoverage,
		sourceFiles: historyCoverage.sourceFiles,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const index = readJson(DATE_INDEX_PATH);
	const structure = collectStructure(index);
	const output = { schemaVersion: "boat-ex-prediction-structure-v1", generatedAt, ...structure };
	const historyCoverage = collectHistoryCoverage(index);
	const auditPath = predictionAuditPath(output.targetDate);
	const audit = buildContractAudit(output, historyCoverage, generatedAt);
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
	writeJson(auditPath, audit, args.dryRun);
	writeJson(DERIVED_MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		path: OUTPUT_PATH,
		auditPath,
		targetDate: output.targetDate,
		venueCount: output.summary.venueCount,
		raceCount: output.summary.raceCount,
		predictionTextAvailableRaceCount: output.summary.predictionTextAvailableRaceCount,
		structuredTicketAvailableRaceCount: output.summary.structuredTicketAvailableRaceCount,
		evaluatedPredictionRaceCount: output.summary.evaluatedPredictionRaceCount,
		readiness: output.readiness.status,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
