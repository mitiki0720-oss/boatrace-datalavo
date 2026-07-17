import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const allowEmpty = new Set(process.argv.slice(2)).has("--allow-empty");
const indexPath = "public/data/boatrace-ex/index.generated.json";

function fail(message) {
	console.error(`FAIL: ${message}`);
	process.exitCode = 1;
}

function assert(condition, message) {
	if (!condition) fail(message);
}

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function collectStrings(value, output = []) {
	if (typeof value === "string") {
		output.push(value);
	} else if (Array.isArray(value)) {
		for (const item of value) collectStrings(item, output);
	} else if (value && typeof value === "object") {
		for (const item of Object.values(value)) collectStrings(item, output);
	}
	return output;
}

if (!fs.existsSync(absolute(indexPath))) {
	fail(`${indexPath} is missing`);
	process.exit();
}

const index = JSON.parse(fs.readFileSync(absolute(indexPath), "utf8"));
const dates = Array.isArray(index.dates) ? index.dates : [];
const availableDates = Array.isArray(index.availableDates) ? index.availableDates : [];

assert(index.schemaVersion === 1, "schemaVersion must be 1");
assert(index.kind === "boatrace-ex-date-index", "kind must be boatrace-ex-date-index");
assert(typeof index.generatedAt === "string" && !Number.isNaN(Date.parse(index.generatedAt)), "generatedAt must be ISO parseable");
assert(Array.isArray(index.availableDates), "availableDates must be an array");
assert(Array.isArray(index.dates), "dates must be an array");
assert(Boolean(index.summary) && typeof index.summary === "object", "summary must be present");

if (availableDates.length === 0) {
	assert(allowEmpty, "dateCount 0 requires --allow-empty");
	assert(index.latestDate === null, "empty index latestDate must be null");
} else {
	const latestDate = [...availableDates].sort().at(-1);
	assert(index.latestDate === latestDate, "latestDate must equal max availableDates");
}

assert(index.summary?.dateCount === availableDates.length, "summary.dateCount must equal availableDates length");
assert(dates.length >= availableDates.length, "dates length must cover availableDates");

const countAvailable = (key) => dates.filter((dateEntry) => dateEntry?.[key]?.status === "available").length;
assert(index.summary?.historyDateCount === countAvailable("history"), "historyDateCount mismatch");
assert(index.summary?.coverageDateCount === countAvailable("coverage"), "coverageDateCount mismatch");
assert(index.summary?.venueEvidenceDateCount === countAvailable("venueEvidence"), "venueEvidenceDateCount mismatch");
assert(index.summary?.racerEvidenceDateCount === countAvailable("racerEvidence"), "racerEvidenceDateCount mismatch");

for (const value of collectStrings(index)) {
	assert(!value.startsWith("public/data/reviews/"), `prohibited reviews path referenced: ${value}`);
	assert(!/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(value), `prohibited boatrace generated path referenced: ${value}`);
	assert(!/score|confidence|ranking/i.test(value) || /predictionSignals/.test(value), `possible fake scoring label found: ${value}`);
}

const expectedDate = dates.find((dateEntry) => dateEntry?.date === "2026-07-13");
assert(Boolean(expectedDate), "2026-07-13 must exist");
if (expectedDate) {
	assert(expectedDate.history?.recordCount === 156, "2026-07-13 history.recordCount must be 156");
	assert(expectedDate.history?.venueCount === 13, "2026-07-13 history.venueCount must be 13");
	assert(expectedDate.venueEvidence?.venueCount === 13, "2026-07-13 venueEvidence.venueCount must be 13");
	assert(expectedDate.racerEvidence?.racerCount === 581, "2026-07-13 racerEvidence.racerCount must be 581");
	assert(expectedDate.racerEvidence?.appearanceCount === 936, "2026-07-13 racerEvidence.appearanceCount must be 936");
}

if (process.exitCode) {
	process.exit();
}

console.log(`OK: ${indexPath} latestDate=${index.latestDate ?? "null"} dateCount=${availableDates.length}`);
