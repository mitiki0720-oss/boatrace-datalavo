import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const OUTPUT_PATH = "public/data/boatrace-ex/derived/today-flow/latest.json";
const DERIVED_MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const FORBIDDEN_KEYS = new Set(["score", "ranking", "rank", "recommend", "recommendation", "prediction", "confidence"]);

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function assert(condition, message, errors) {
	if (!condition) errors.push(message);
}

function firstPlaceBoat(record) {
	const value = Number(record?.officialResult?.finishOrder?.[0]);
	return Number.isInteger(value) && value >= 1 && value <= 6 ? String(value) : null;
}

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").replace(/[,\s円¥￥]/g, "");
	return /^\d+$/.test(normalized) && Number.isSafeInteger(Number(normalized)) ? Number(normalized) : null;
}

function trifectaPayout(record) {
	for (const payout of Array.isArray(record?.officialResult?.payout) ? record.officialResult.payout : []) {
		const type = [payout?.betType, payout?.type, payout?.name].filter((value) => typeof value === "string").join(" ").normalize("NFKC").toLowerCase();
		if (!type.includes("3連単") && !type.includes("三連単") && !type.includes("trifecta")) continue;
		for (const value of [payout?.payoutYen, payout?.amount, payout?.payoutAmount, payout?.payout, payout?.yen]) {
			const amount = parseYen(value);
			if (amount !== null) return amount;
		}
	}
	return null;
}

function findForbiddenKeys(value, pathName = "$") {
	if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenKeys(item, `${pathName}[${index}]`));
	if (!value || typeof value !== "object") return [];
	return Object.entries(value).flatMap(([key, item]) => [
		...(FORBIDDEN_KEYS.has(key.toLowerCase()) ? [`${pathName}.${key}`] : []),
		...findForbiddenKeys(item, `${pathName}.${key}`),
	]);
}

function main() {
	const errors = [];
	const output = readJson(OUTPUT_PATH);
	const index = readJson(DATE_INDEX_PATH);
	const manifest = readJson(DERIVED_MANIFEST_PATH);
	const targetDate = index?.latestDate;
	const historyPath = `public/data/boatrace-ex/history/races/${targetDate}.json`;
	const history = readJson(historyPath);

	assert(output?.schemaVersion === "boat-ex-today-flow-v1", "schemaVersion must be boat-ex-today-flow-v1", errors);
	assert(typeof output?.generatedAt === "string" && !Number.isNaN(Date.parse(output.generatedAt)), "generatedAt must be an ISO date", errors);
	assert(output?.status === "available", "status must be available", errors);
	assert(["ready", "available", "insufficient-history", "pending"].includes(output?.readiness?.status), "readiness.status is invalid", errors);
	assert(typeof output?.readiness?.reason === "string" && output.readiness.reason.length > 0, "readiness.reason is required", errors);
	assert(output?.targetDate === targetDate, "targetDate must equal date index latestDate", errors);
	assert(output?.dateRange?.from === targetDate && output?.dateRange?.to === targetDate && output?.dateRange?.dateCount === 1, "dateRange must describe the target date", errors);
	assert(Array.isArray(output?.venues) && output.venues.length > 0, "venues must be a non-empty array", errors);
	assert(Array.isArray(output?.warnings), "warnings must be an array", errors);
	assert(Array.isArray(output?.sourceFiles) && output.sourceFiles.length >= 2, "sourceFiles must contain index and history provenance", errors);
	assert(Array.isArray(manifest?.files) && manifest.files.some((file) => file?.path === OUTPUT_PATH && file?.kind === "boatrace-ex-today-flow-v1"), "derived manifest must contain today flow", errors);

	const sourcePaths = output?.sourceFiles?.map((source) => source?.sourcePath) ?? [];
	assert(sourcePaths.includes(DATE_INDEX_PATH) && sourcePaths.includes(historyPath), "sourceFiles must reference the date index and target history", errors);
	for (const sourcePath of sourcePaths) {
		assert(typeof sourcePath === "string" && !sourcePath.includes("public/data/reviews/") && !sourcePath.includes("public/data/boatrace/"), `prohibited source path: ${sourcePath}`, errors);
	}

	const forbiddenKeys = findForbiddenKeys(output);
	assert(forbiddenKeys.length === 0, `forbidden keys: ${forbiddenKeys.join(", ")}`, errors);

	const expectedVenues = new Map();
	let raceCount = 0;
	let resultAvailableRaceCount = 0;
	let trifectaAvailableRaceCount = 0;
	let payoutAvailableRaceCount = 0;
	for (const record of history?.records ?? []) {
		const venue = expectedVenues.get(record.venueCode) ?? { raceCount: 0, resultAvailableRaceCount: 0, payoutAvailableRaceCount: 0, trifectaAvailableRaceCount: 0, firstPlaceCounts: Object.fromEntries([1, 2, 3, 4, 5, 6].map((boat) => [String(boat), 0])) };
		const firstPlace = firstPlaceBoat(record);
		const payout = trifectaPayout(record);
		venue.raceCount += 1;
		raceCount += 1;
		if (firstPlace !== null) {
			venue.resultAvailableRaceCount += 1;
			venue.firstPlaceCounts[firstPlace] += 1;
			resultAvailableRaceCount += 1;
		}
		if (typeof record?.officialResult?.trifecta === "string" && record.officialResult.trifecta.length > 0) {
			venue.trifectaAvailableRaceCount += 1;
			trifectaAvailableRaceCount += 1;
		}
		if (payout !== null) {
			venue.payoutAvailableRaceCount += 1;
			payoutAvailableRaceCount += 1;
		}
		expectedVenues.set(record.venueCode, venue);
	}

	assert(output?.summary?.raceCount === raceCount, "summary.raceCount must match target history", errors);
	assert(output?.summary?.venueCount === expectedVenues.size, "summary.venueCount must match target history", errors);
	assert(output?.summary?.resultAvailableRaceCount === resultAvailableRaceCount, "summary.resultAvailableRaceCount must match target history", errors);
	assert(output?.summary?.trifectaAvailableRaceCount === trifectaAvailableRaceCount, "summary.trifectaAvailableRaceCount must match target history", errors);
	assert(output?.summary?.payoutAvailableRaceCount === payoutAvailableRaceCount, "summary.payoutAvailableRaceCount must match target history", errors);

	for (const venue of output?.venues ?? []) {
		const expected = expectedVenues.get(venue?.venueCode);
		assert(Boolean(expected), `venue is not in target history: ${venue?.venueCode}`, errors);
		if (!expected) continue;
		assert(venue.raceCount === expected.raceCount, `venue ${venue.venueCode} raceCount must match target history`, errors);
		assert(venue.resultAvailableRaceCount === expected.resultAvailableRaceCount, `venue ${venue.venueCode} resultAvailableRaceCount must match target history`, errors);
		assert(venue.payoutAvailableRaceCount === expected.payoutAvailableRaceCount, `venue ${venue.venueCode} payoutAvailableRaceCount must match target history`, errors);
		assert(JSON.stringify(venue.firstPlaceBoatCounts) === JSON.stringify(expected.firstPlaceCounts), `venue ${venue.venueCode} firstPlaceBoatCounts must match target history`, errors);
		assert(Array.isArray(venue.firstPlaceBoatSequence) && venue.firstPlaceBoatSequence.length === expected.raceCount, `venue ${venue.venueCode} firstPlaceBoatSequence must cover every target race`, errors);
		assert(Array.isArray(venue.notes), `venue ${venue.venueCode} notes must be an array`, errors);
	}

	if (errors.length > 0) throw new Error(errors.join("\n"));
	console.log(JSON.stringify({ ok: true, path: OUTPUT_PATH, targetDate, venueCount: output.summary.venueCount, raceCount: output.summary.raceCount, resultAvailableRaceCount: output.summary.resultAvailableRaceCount, payoutAvailableRaceCount: output.summary.payoutAvailableRaceCount, readiness: output.readiness.status }, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
