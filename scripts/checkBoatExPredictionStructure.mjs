import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const OUTPUT_PATH = "public/data/boatrace-ex/derived/prediction-structure/latest.json";
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const MIN_PREDICTION_TEXT_RACE_COUNT = 30;
const MIN_STRUCTURED_TICKET_RACE_COUNT = 30;
const MIN_EVALUATED_PREDICTION_RACE_COUNT = 30;
const FORBIDDEN_KEYS = new Set(["score", "ranking", "rank", "recommend", "recommendation", "confidence"]);

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function assert(condition, message, errors) {
	if (!condition) errors.push(message);
}

function hasObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasResult(record) {
	const order = record?.officialResult?.finishOrder;
	return Array.isArray(order)
		&& order.length >= 3
		&& order.slice(0, 3).every((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 6);
}

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").replace(/[,\s円¥￥]/g, "");
	if (!/^\d+$/u.test(normalized)) return null;
	const amount = Number(normalized);
	return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function hasTrifectaPayout(record) {
	for (const payout of Array.isArray(record?.officialResult?.payout) ? record.officialResult.payout : []) {
		const type = [payout?.betType, payout?.type, payout?.name].filter((value) => typeof value === "string").join(" ").normalize("NFKC").toLowerCase();
		if (!type.includes("3連単") && !type.includes("三連単") && !type.includes("trifecta")) continue;
		if ([payout?.payoutYen, payout?.amount, payout?.payoutAmount, payout?.payout, payout?.yen].some((value) => parseYen(value) !== null)) return true;
	}
	return false;
}

function hasSourceBackedPredictionText(record) {
	const prediction = record?.prediction;
	return hasObject(prediction) && prediction.sourceStatus === "available" && typeof prediction.textExcerpt === "string" && prediction.textExcerpt.trim().length > 0;
}

function hasStructuredTickets(record) {
	return [record?.tickets, record?.ticketGroups, record?.bets, record?.recommendedTickets, record?.buyTickets, record?.prediction?.tickets, record?.prediction?.ticketGroups, record?.prediction?.bets, record?.prediction?.recommendedTickets, record?.prediction?.buyTickets]
		.some((value) => Array.isArray(value) && value.length > 0);
}

function coverageFor(record) {
	const resultAvailable = hasResult(record);
	const payoutAvailable = hasTrifectaPayout(record);
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

function expectedReadiness(summary) {
	return summary.predictionTextAvailableRaceCount >= MIN_PREDICTION_TEXT_RACE_COUNT
		&& summary.structuredTicketAvailableRaceCount >= MIN_STRUCTURED_TICKET_RACE_COUNT
		&& summary.evaluatedPredictionRaceCount >= MIN_EVALUATED_PREDICTION_RACE_COUNT
		? "ready"
		: "insufficient-history";
}

function forbiddenKeys(value, location = "$") {
	if (Array.isArray(value)) return value.flatMap((item, index) => forbiddenKeys(item, `${location}[${index}]`));
	if (!value || typeof value !== "object") return [];
	return Object.entries(value).flatMap(([key, item]) => [
		...(FORBIDDEN_KEYS.has(key.toLowerCase()) ? [`${location}.${key}`] : []),
		...forbiddenKeys(item, `${location}.${key}`),
	]);
}

function main() {
	const errors = [];
	const output = readJson(OUTPUT_PATH);
	const index = readJson(INDEX_PATH);
	const targetDate = index?.latestDate;
	const historyPath = `public/data/boatrace-ex/history/races/${targetDate}.json`;
	const history = readJson(historyPath);
	const manifest = readJson(MANIFEST_PATH);
	assert(output?.schemaVersion === "boat-ex-prediction-structure-v1", "schemaVersion must be boat-ex-prediction-structure-v1", errors);
	assert(typeof output?.generatedAt === "string" && !Number.isNaN(Date.parse(output.generatedAt)), "generatedAt must be an ISO date", errors);
	assert(output?.status === "available", "status must be available", errors);
	assert(typeof output?.readiness?.reason === "string" && output.readiness.reason.length > 0, "readiness.reason is required", errors);
	assert(Array.isArray(output?.readiness?.missingRequirements), "readiness.missingRequirements must be an array", errors);
	assert(output?.targetDate === targetDate, "targetDate must equal date index latestDate", errors);
	assert(output?.dateRange?.from === targetDate && output?.dateRange?.to === targetDate && output?.dateRange?.dateCount === 1, "dateRange must describe target date", errors);
	assert(Array.isArray(output?.venues) && output.venues.length > 0, "venues must be a non-empty array", errors);
	assert(Array.isArray(output?.warnings), "warnings must be an array", errors);
	assert(Array.isArray(manifest?.files) && manifest.files.some((file) => file?.path === OUTPUT_PATH && file?.kind === "boatrace-ex-prediction-structure-v1"), "derived manifest must contain prediction structure", errors);
	const sourcePaths = output?.sourceFiles?.map((source) => source?.sourcePath) ?? [];
	assert(sourcePaths.includes(INDEX_PATH) && sourcePaths.includes(historyPath), "sourceFiles must reference date index and target history", errors);
	for (const sourcePath of sourcePaths) assert(typeof sourcePath === "string" && !sourcePath.includes("public/data/reviews/") && !sourcePath.includes("public/data/boatrace/"), `prohibited source path: ${sourcePath}`, errors);
	assert(forbiddenKeys(output).length === 0, `forbidden keys: ${forbiddenKeys(output).join(", ")}`, errors);

	const summary = emptySummary();
	const venues = new Map();
	for (const record of history?.records ?? []) {
		const venue = venues.get(record.venueCode) ?? emptyVenue(record);
		venue.raceCount += 1;
		summary.raceCount += 1;
		for (const [key, value] of Object.entries(coverageFor(record))) {
			venue[key] += value;
			summary[key] += value;
		}
		venues.set(record.venueCode, venue);
	}
	summary.venueCount = venues.size;
	for (const [key, value] of Object.entries(summary)) assert(output?.summary?.[key] === value, `summary.${key} must match target history`, errors);
	assert(output?.readiness?.status === expectedReadiness(summary), "readiness.status must match source-backed structured prediction coverage", errors);
	for (const venue of output?.venues ?? []) {
		const expected = venues.get(venue?.venueCode);
		assert(Boolean(expected), `venue is not in target history: ${venue?.venueCode}`, errors);
		if (expected) for (const [key, value] of Object.entries(expected)) assert(venue[key] === value, `venue ${venue.venueCode} ${key} must match target history`, errors);
		assert(Array.isArray(venue?.warnings), `venue ${venue?.venueCode} warnings must be an array`, errors);
	}
	if (errors.length) throw new Error(errors.join("\n"));
	console.log(JSON.stringify({ ok: true, path: OUTPUT_PATH, targetDate, venueCount: output.summary.venueCount, raceCount: output.summary.raceCount, predictionTextAvailableRaceCount: output.summary.predictionTextAvailableRaceCount, structuredTicketAvailableRaceCount: output.summary.structuredTicketAvailableRaceCount, evaluatedPredictionRaceCount: output.summary.evaluatedPredictionRaceCount, readiness: output.readiness.status }, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
