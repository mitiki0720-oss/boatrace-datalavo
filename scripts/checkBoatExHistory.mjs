import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ALLOWED_SOURCE_STATUS = new Set([
	"available",
	"pending",
	"not-published",
	"not-supported",
	"parse-empty",
	"http-error",
	"unknown",
	"user-only",
	"derived-ready",
	"insufficient-sample",
]);

const ALLOWED_COVERAGE_STATUS = new Set([
	"complete",
	"partial",
	"pending",
	"missing",
	"not-supported",
	"unknown",
]);

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

function validateSourceMeta(source, location, errors) {
	assert(source && typeof source === "object", `${location}: source meta must be an object`, errors);
	if (!source || typeof source !== "object") return;

	assert(typeof source.sourceName === "string" && source.sourceName.length > 0, `${location}: sourceName is required`, errors);
	assert(source.sourceType === "official" || source.sourceType === "user" || source.sourceType === "derived", `${location}: invalid sourceType`, errors);
	assert(ALLOWED_SOURCE_STATUS.has(source.sourceStatus), `${location}: invalid sourceStatus ${source.sourceStatus}`, errors);
	assert(ALLOWED_COVERAGE_STATUS.has(source.coverageStatus), `${location}: invalid coverageStatus ${source.coverageStatus}`, errors);

	if (source.sourcePath) {
		assert(!source.sourcePath.startsWith("public/data/reviews/"), `${location}: reviews sourcePath is prohibited`, errors);
	}
}

function validateRaceRecord(record, index, targetDate, errors) {
	const location = `records[${index}]`;
	assert(record.date === targetDate, `${location}: date must be ${targetDate}`, errors);
	assert(typeof record.venueCode === "string" && record.venueCode.length > 0, `${location}: venueCode is required`, errors);
	assert(typeof record.venueName === "string" && record.venueName.length > 0, `${location}: venueName is required`, errors);
	assert(Number.isInteger(record.raceNo) && record.raceNo >= 1 && record.raceNo <= 12, `${location}: raceNo must be 1..12`, errors);
	assert(typeof record.raceKey === "string" && record.raceKey.includes(targetDate), `${location}: raceKey must include date`, errors);
	assert(record.sessionType === "morning" || record.sessionType === "day" || record.sessionType === "night" || record.sessionType === "unknown", `${location}: invalid sessionType`, errors);
	assert(Array.isArray(record.sources) && record.sources.length > 0, `${location}: sources are required`, errors);
	record.sources?.forEach((source, sourceIndex) => validateSourceMeta(source, `${location}.sources[${sourceIndex}]`, errors));

	assert(record.coverage && typeof record.coverage === "object", `${location}: coverage is required`, errors);
	if (record.coverage && typeof record.coverage === "object") {
		for (const [field, status] of Object.entries(record.coverage)) {
			assert(ALLOWED_COVERAGE_STATUS.has(status), `${location}.coverage.${field}: invalid coverage status ${status}`, errors);
		}
	}

	if (record.officialRace) {
		assert(record.officialRace.date === targetDate, `${location}.officialRace: date mismatch`, errors);
		assert(record.officialRace.venueCode === record.venueCode, `${location}.officialRace: venueCode mismatch`, errors);
		assert(record.officialRace.raceNo === record.raceNo, `${location}.officialRace: raceNo mismatch`, errors);
		assert(Array.isArray(record.officialRace.sources), `${location}.officialRace: sources required`, errors);
	}

	for (const field of ["prediction", "summary", "review", "derivedSignals"]) {
		assert(record[field] === undefined, `${location}: ${field} must not be generated in Phase 3 history v0`, errors);
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const manifest = readJson("public/data/boatrace-ex/manifest.generated.json");
	const manifestDates = (manifest.files ?? []).map((file) => file.date).filter(Boolean);
	const date = args.date ?? manifestDates[0];
	if (!date) throw new Error("Could not resolve date from --date or manifest.");

	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const coveragePath = `public/data/boatrace-ex/coverage/${date}.json`;
	const history = readJson(historyPath);
	const coverage = readJson(coveragePath);
	const errors = [];

	assert(history.schemaVersion === 1, "history.schemaVersion must be 1", errors);
	assert(history.kind === "boatrace-ex-history-races", "history.kind mismatch", errors);
	assert(history.date === date, "history.date mismatch", errors);
	assert(Array.isArray(history.sourceFiles), "history.sourceFiles must be an array", errors);
	history.sourceFiles?.forEach((source, index) => validateSourceMeta(source, `history.sourceFiles[${index}]`, errors));
	assert(Array.isArray(history.records), "history.records must be an array", errors);
	if (Array.isArray(history.records) && history.records.length === 0 && !args.allowEmpty) {
		errors.push([
			"BOATRACE EX history has no records.",
			`date: ${date}`,
			"Use --allow-empty only when this is intentional.",
		].join("\n"));
	}
	history.records?.forEach((record, index) => validateRaceRecord(record, index, date, errors));

	assert(coverage.schemaVersion === 1, "coverage.schemaVersion must be 1", errors);
	assert(coverage.kind === "boatrace-ex-coverage-date", "coverage.kind mismatch", errors);
	assert(coverage.date === date, "coverage.date mismatch", errors);
	assert(coverage.totals?.races === history.records.length, "coverage.totals.races must match history.records.length", errors);
	assert(Array.isArray(coverage.venues), "coverage.venues must be an array", errors);

	assert(manifest.schemaVersion === 1, "manifest.schemaVersion must be 1", errors);
	assert(manifest.kind === "boatrace-ex-manifest", "manifest.kind mismatch", errors);
	assert(Array.isArray(manifest.files), "manifest.files must be an array", errors);
	for (const file of manifest.files ?? []) {
		assert(!String(file.path ?? "").startsWith("public/data/reviews/"), `manifest file path is prohibited: ${file.path}`, errors);
		assert(ALLOWED_SOURCE_STATUS.has(file.sourceStatus), `manifest invalid sourceStatus ${file.sourceStatus}`, errors);
		assert(ALLOWED_COVERAGE_STATUS.has(file.coverageStatus), `manifest invalid coverageStatus ${file.coverageStatus}`, errors);
	}

	if (errors.length > 0) {
		console.error(errors.map((error) => `- ${error}`).join("\n"));
		process.exitCode = 1;
		return;
	}

	console.log(JSON.stringify({
		ok: true,
		date,
		historyPath,
		coveragePath,
		records: history.records.length,
		venues: coverage.totals?.venues,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
