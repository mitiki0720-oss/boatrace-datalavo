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
const FORBIDDEN_KEYS = new Set(["score", "ranking", "rank", "recommend", "recommendation", "prediction", "label"]);

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function assert(condition, message, errors) {
	if (!condition) errors.push(message);
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
	if (BOAT_NUMBERS.includes(firstPlace)) venue.firstPlaceBoatNumberCounts[String(firstPlace)] += 1;
	for (const boatNumber of finishOrder.slice(0, 3).map(Number)) {
		if (BOAT_NUMBERS.includes(boatNumber)) venue.top3BoatNumberCounts[String(boatNumber)] += 1;
	}
}

function collectExpected(index, errors) {
	const dates = [...new Set(index.availableDates ?? [])].sort();
	const venues = new Map();
	let raceCount = 0;
	let resultAvailableRaceCount = 0;
	let exhibitionAvailableRaceCount = 0;

	for (const date of dates) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyPath);
		assert(history.date === date, `history.date mismatch for ${date}`, errors);
		assert(Array.isArray(history.records), `history.records must be an array for ${date}`, errors);
		for (const [index, record] of (Array.isArray(history.records) ? history.records : []).entries()) {
			const location = `${historyPath} records[${index}]`;
			assert(record?.date === date, `${location}: date mismatch`, errors);
			assert(typeof record?.venueCode === "string" && record.venueCode.length > 0, `${location}: venueCode is required`, errors);
			assert(typeof record?.venueName === "string" && record.venueName.length > 0, `${location}: venueName is required`, errors);
			if (!record?.venueCode || !record?.venueName) continue;

			const venue = venues.get(record.venueCode) ?? {
				venueId: record.venueCode,
				venueName: record.venueName,
				dates: new Set(),
				raceCount: 0,
				resultAvailableRaceCount: 0,
				exhibitionAvailableRaceCount: 0,
				firstPlaceBoatNumberCounts: createBoatNumberCounts(),
				top3BoatNumberCounts: createBoatNumberCounts(),
			};
			assert(venue.venueName === record.venueName, `${location}: venueName is inconsistent`, errors);
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
			venues.set(record.venueCode, venue);
		}
	}

	return {
		dates,
		raceCount,
		venueCount: venues.size,
		resultAvailableRaceCount,
		exhibitionAvailableRaceCount,
		venues: [...venues.values()].map((venue) => ({
			venueId: venue.venueId,
			venueName: venue.venueName,
			dateCount: venue.dates.size,
			raceCount: venue.raceCount,
			resultAvailableRaceCount: venue.resultAvailableRaceCount,
			exhibitionAvailableRaceCount: venue.exhibitionAvailableRaceCount,
			firstPlaceBoatNumberCounts: venue.firstPlaceBoatNumberCounts,
			firstPlaceBoatNumberRates: rateCounts(venue.firstPlaceBoatNumberCounts, venue.resultAvailableRaceCount),
			top3BoatNumberCounts: venue.top3BoatNumberCounts,
			top3BoatNumberRates: rateCounts(venue.top3BoatNumberCounts, venue.resultAvailableRaceCount),
		})),
	};
}

function walk(value, visitor, pathParts = []) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [key, child] of Object.entries(value)) {
		visitor(key, child, [...pathParts, key].join("."));
		walk(child, visitor, [...pathParts, key]);
	}
}

function validateNoForbiddenFields(output, errors) {
	walk(output, (key, value, location) => {
		assert(!FORBIDDEN_KEYS.has(key.toLowerCase()), `${location}: prohibited score, ranking, or prediction field`, errors);
		if (typeof value === "string") {
			assert(!value.startsWith("public/data/reviews/"), `${location}: reviews path is prohibited`, errors);
			assert(!/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(value), `${location}: direct boatrace generated source is prohibited`, errors);
		}
	});
}

function validateCountMap(value, location, errors) {
	assert(value && typeof value === "object" && !Array.isArray(value), `${location} must be an object`, errors);
	for (const boatNumber of BOAT_NUMBERS) {
		assert(Number.isInteger(value?.[String(boatNumber)]) && value[String(boatNumber)] >= 0, `${location}.${boatNumber} must be a non-negative integer`, errors);
	}
}

function validateRateMap(value, location, errors) {
	assert(value && typeof value === "object" && !Array.isArray(value), `${location} must be an object`, errors);
	for (const boatNumber of BOAT_NUMBERS) {
		const rate = value?.[String(boatNumber)];
		assert(rate === null || (typeof rate === "number" && rate >= 0 && rate <= 1), `${location}.${boatNumber} must be null or a rate from 0 to 1`, errors);
	}
}

function sameJson(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function main() {
	const index = readJson(DATE_INDEX_PATH);
	const output = readJson(OUTPUT_PATH);
	const manifest = readJson(DERIVED_MANIFEST_PATH);
	const errors = [];
	const expected = collectExpected(index, errors);
	const expectedSourceFiles = [DATE_INDEX_PATH, ...expected.dates.map((date) => `public/data/boatrace-ex/history/races/${date}.json`)];

	assert(output.schemaVersion === "boat-ex-venue-bias-v1", "schemaVersion must be boat-ex-venue-bias-v1", errors);
	assert(output.status === "available", "status must be available", errors);
	assert(output.dateRange?.dates?.join(",") === expected.dates.join(","), "dateRange.dates must match index availableDates", errors);
	assert(output.dateRange?.dateCount === expected.dates.length, "dateRange.dateCount must match index dateCount", errors);
	assert(output.dateRange?.from === expected.dates[0], "dateRange.from must match earliest history date", errors);
	assert(output.dateRange?.to === expected.dates.at(-1), "dateRange.to must match latest history date", errors);
	assert(output.summary?.raceCount === expected.raceCount, "summary.raceCount must match history", errors);
	assert(output.summary?.venueCount === expected.venueCount, "summary.venueCount must match history venues", errors);
	assert(output.summary?.resultAvailableRaceCount === expected.resultAvailableRaceCount, "summary.resultAvailableRaceCount must match history", errors);
	assert(output.summary?.exhibitionAvailableRaceCount === expected.exhibitionAvailableRaceCount, "summary.exhibitionAvailableRaceCount must match history", errors);
	assert(Array.isArray(output.venues) && output.venues.length === expected.venueCount, "venues.length must match history venues", errors);
	assert(Array.isArray(output.sourceFiles), "sourceFiles must be an array", errors);
	assert(sameJson(output.sourceFiles, expectedSourceFiles), "sourceFiles must contain only the date index and selected history files", errors);

	const expectedReadiness = expected.dates.length < MIN_DATE_COUNT ? "insufficient-history" : "ready";
	assert(output.readiness?.status === expectedReadiness, "readiness.status must match date count threshold", errors);
	assert(output.readiness?.minDateCount === MIN_DATE_COUNT, "readiness.minDateCount must be 7", errors);

	const expectedByVenue = new Map(expected.venues.map((venue) => [venue.venueId, venue]));
	for (const [index, venue] of (output.venues ?? []).entries()) {
		const location = `venues[${index}]`;
		const expectedVenue = expectedByVenue.get(venue.venueId);
		assert(Boolean(expectedVenue), `${location}: venueId is missing from history`, errors);
		if (!expectedVenue) continue;
		assert(venue.venueName === expectedVenue.venueName, `${location}: venueName must match history`, errors);
		assert(venue.dateCount === expectedVenue.dateCount, `${location}: dateCount must match history`, errors);
		assert(venue.raceCount === expectedVenue.raceCount, `${location}: raceCount must match history`, errors);
		assert(venue.resultAvailableRaceCount === expectedVenue.resultAvailableRaceCount, `${location}: resultAvailableRaceCount must match history`, errors);
		assert(venue.exhibitionAvailableRaceCount === expectedVenue.exhibitionAvailableRaceCount, `${location}: exhibitionAvailableRaceCount must match history`, errors);
		validateCountMap(venue.firstPlaceBoatNumberCounts, `${location}.firstPlaceBoatNumberCounts`, errors);
		validateRateMap(venue.firstPlaceBoatNumberRates, `${location}.firstPlaceBoatNumberRates`, errors);
		validateCountMap(venue.top3BoatNumberCounts, `${location}.top3BoatNumberCounts`, errors);
		validateRateMap(venue.top3BoatNumberRates, `${location}.top3BoatNumberRates`, errors);
		assert(sameJson(venue.firstPlaceBoatNumberCounts, expectedVenue.firstPlaceBoatNumberCounts), `${location}: first place counts must match history`, errors);
		assert(sameJson(venue.firstPlaceBoatNumberRates, expectedVenue.firstPlaceBoatNumberRates), `${location}: first place rates must match history`, errors);
		assert(sameJson(venue.top3BoatNumberCounts, expectedVenue.top3BoatNumberCounts), `${location}: top3 counts must match history`, errors);
		assert(sameJson(venue.top3BoatNumberRates, expectedVenue.top3BoatNumberRates), `${location}: top3 rates must match history`, errors);
		assert(venue.readiness?.status === expectedReadiness, `${location}: readiness.status must match date count threshold`, errors);
	}

	assert(manifest.schemaVersion === 1, "derived manifest schemaVersion must be 1", errors);
	assert(manifest.kind === "boatrace-ex-derived-manifest", "derived manifest kind mismatch", errors);
	const manifestEntry = (manifest.files ?? []).find((file) => file.path === OUTPUT_PATH);
	assert(Boolean(manifestEntry), "derived manifest must include venue bias output", errors);
	assert(manifestEntry?.kind === "boatrace-ex-venue-bias-v1", "derived manifest venue bias kind mismatch", errors);
	assert(manifestEntry?.recordCount === expected.raceCount, "derived manifest recordCount must match history", errors);
	assert(manifestEntry?.venueCount === expected.venueCount, "derived manifest venueCount must match history", errors);
	validateNoForbiddenFields(output, errors);
	validateNoForbiddenFields(manifest, errors);

	if (errors.length > 0) {
		console.error(errors.map((error) => `- ${error}`).join("\n"));
		process.exitCode = 1;
		return;
	}

	console.log(JSON.stringify({
		ok: true,
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
