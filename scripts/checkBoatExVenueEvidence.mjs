import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ALLOWED_READINESS_STATUS = new Set(["pending", "insufficient-history"]);
const ALLOWED_COVERAGE_STATUS = new Set(["available", "partial", "missing", "pending", "unknown"]);
const FORBIDDEN_SCORE_KEYS = new Set(["score", "roughIndexScore", "venueBiasScore"]);

function parseArgs(argv) {
	const args = {
		date: undefined,
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

function assert(condition, message, errors) {
	if (!condition) errors.push(message);
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

function validateNoFakeCompletion(evidence, errors) {
	walk(evidence, (key, value, location) => {
		assert(!FORBIDDEN_SCORE_KEYS.has(key), `${location}: fake score field is prohibited`, errors);
		assert(!(key === "confidence" && value === "high"), `${location}: high confidence is prohibited in venue evidence v0`, errors);
		if (typeof value === "string") {
			assert(!value.includes("public/data/reviews/"), `${location}: reviews sources are prohibited`, errors);
			assert(!/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(value), `${location}: direct boatrace generated source is prohibited`, errors);
		}
	});
}

function validateVenue(venue, index, date, errors) {
	const location = `venues[${index}]`;
	assert(venue.date === date, `${location}: date mismatch`, errors);
	assert(typeof venue.venueCode === "string" && venue.venueCode.length > 0, `${location}: venueCode is required`, errors);
	assert(typeof venue.venueName === "string" && venue.venueName.length > 0, `${location}: venueName is required`, errors);
	assert(Number.isInteger(venue.raceCount) && venue.raceCount > 0, `${location}: raceCount must be positive`, errors);
	assert(venue.coverage && typeof venue.coverage === "object", `${location}: coverage is required`, errors);
	for (const [field, status] of Object.entries(venue.coverage ?? {})) {
		assert(ALLOWED_COVERAGE_STATUS.has(status), `${location}.coverage.${field}: invalid status ${status}`, errors);
	}
	assert(venue.availability && typeof venue.availability === "object", `${location}: availability is required`, errors);
	assert(venue.derivedReadiness && typeof venue.derivedReadiness === "object", `${location}: derivedReadiness is required`, errors);

	for (const key of ["venueBias", "roughIndex", "todayFlow"]) {
		const status = venue.derivedReadiness?.[key]?.status;
		assert(ALLOWED_READINESS_STATUS.has(status), `${location}.derivedReadiness.${key}.status must be pending or insufficient-history`, errors);
	}

	assert(Array.isArray(venue.warnings), `${location}: warnings must be an array`, errors);
}

function collectHistoryVenueStats(history, errors) {
	const venues = new Map();
	for (const [index, record] of (Array.isArray(history.records) ? history.records : []).entries()) {
		const location = `history.records[${index}]`;
		const venueCode = String(record?.venueCode ?? "");
		const venueName = String(record?.venueName ?? "");
		assert(venueCode.length > 0, `${location}: venueCode is required`, errors);
		assert(venueName.length > 0, `${location}: venueName is required`, errors);
		if (!venueCode || !venueName) continue;

		const venue = venues.get(venueCode) ?? { venueName, recordCount: 0 };
		assert(venue.venueName === venueName, `${location}: venueName must be consistent for ${venueCode}`, errors);
		venue.recordCount += 1;
		venues.set(venueCode, venue);
	}
	return venues;
}

function validateProvenance(evidence, historyPath, coveragePath, errors) {
	const allowedPaths = new Set([historyPath, coveragePath]);
	assert(Array.isArray(evidence.sourceFiles), "evidence.sourceFiles must be an array", errors);
	for (const source of evidence.sourceFiles ?? []) {
		const sourcePath = String(source.sourcePath ?? "");
		assert(!sourcePath.startsWith("public/data/reviews/"), `sourceFiles path is prohibited: ${sourcePath}`, errors);
		assert(!/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(sourcePath), `direct boatrace generated source is prohibited: ${sourcePath}`, errors);
		assert(allowedPaths.has(sourcePath), `sourceFiles path must be derived history or coverage: ${sourcePath}`, errors);
	}
	for (const requiredPath of allowedPaths) {
		assert((evidence.sourceFiles ?? []).some((source) => source.sourcePath === requiredPath), `sourceFiles must include ${requiredPath}`, errors);
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const date = args.date;
	if (!date) throw new Error("--date is required");

	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const coveragePath = `public/data/boatrace-ex/coverage/${date}.json`;
	const evidencePath = `public/data/boatrace-ex/derived/venue-evidence/${date}.json`;
	const manifestPath = "public/data/boatrace-ex/derived/manifest.generated.json";
	const history = readJson(historyPath);
	const evidence = readJson(evidencePath);
	const manifest = readJson(manifestPath);
	const errors = [];
	const historyRecords = Array.isArray(history.records) ? history.records : [];
	const historyVenues = collectHistoryVenueStats(history, errors);

	assert(history.date === date, "history.date mismatch", errors);
	assert(Array.isArray(history.records), "history.records must be an array", errors);

	assert(evidence.schemaVersion === 1, "evidence.schemaVersion must be 1", errors);
	assert(evidence.kind === "boatrace-ex-venue-evidence", "evidence.kind mismatch", errors);
	assert(evidence.date === date, "evidence.date mismatch", errors);
	validateProvenance(evidence, historyPath, coveragePath, errors);

	assert(Array.isArray(evidence.venues), "evidence.venues must be an array", errors);
	assert(evidence.summary?.venueCount === evidence.venues?.length, "summary.venueCount must match venues.length", errors);
	assert(evidence.summary?.recordCount === evidence.venues?.reduce((sum, venue) => sum + Number(venue.raceCount ?? 0), 0), "summary.recordCount must match venue race counts", errors);
	assert(evidence.summary?.recordCount === historyRecords.length, "summary.recordCount must match history record count", errors);
	assert(evidence.summary?.venueCount === historyVenues.size, "summary.venueCount must match history venue count", errors);
	assert(evidence.venues?.length === historyVenues.size, "venues.length must match history venue count", errors);

	if (!args.allowEmpty) {
		assert(historyRecords.length > 0, "history records must not be empty", errors);
		assert(historyVenues.size > 0, "history venues must not be empty", errors);
	}

	const evidenceVenueCodes = new Set();
	evidence.venues?.forEach((venue, index) => {
		validateVenue(venue, index, date, errors);
		assert(!evidenceVenueCodes.has(venue.venueCode), `duplicate venueCode: ${venue.venueCode}`, errors);
		evidenceVenueCodes.add(venue.venueCode);
		const historyVenue = historyVenues.get(venue.venueCode);
		assert(Boolean(historyVenue), `venues[${index}]: venueCode is missing from history: ${venue.venueCode}`, errors);
		if (historyVenue) {
			assert(venue.venueName === historyVenue.venueName, `venues[${index}]: venueName must match history`, errors);
			assert(venue.raceCount === historyVenue.recordCount, `venues[${index}]: raceCount must match history`, errors);
		}
	});

	assert(manifest.schemaVersion === 1, "manifest.schemaVersion must be 1", errors);
	assert(manifest.kind === "boatrace-ex-derived-manifest", "manifest.kind mismatch", errors);
	assert(Array.isArray(manifest.files), "manifest.files must be an array", errors);
	assert((manifest.files ?? []).some((file) => file.path === evidencePath), "manifest must include venue evidence path", errors);
	validateNoFakeCompletion(evidence, errors);
	validateNoFakeCompletion(manifest, errors);

	if (errors.length > 0) {
		console.error(errors.map((error) => `- ${error}`).join("\n"));
		process.exitCode = 1;
		return;
	}

	console.log(JSON.stringify({
		ok: true,
		date,
		evidencePath,
		historyPath,
		manifestPath,
		records: evidence.summary.recordCount,
		venues: evidence.summary.venueCount,
		mode: "dynamic",
		derivedManifestFiles: manifest.files.length,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
