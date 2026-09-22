import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const COVERAGE_PATH = "public/data/boatrace-ex/derived/history-coverage/latest.json";

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, ...relativePath.split("/")), "utf8"));
}

function main() {
	const index = readJson(INDEX_PATH);
	const coverage = readJson(COVERAGE_PATH);
	const errors = [];
	if (coverage.schemaVersion !== "boat-ex-history-coverage-v2") errors.push("invalid history coverage schemaVersion");
	if (coverage.sourceIndexPath !== INDEX_PATH) errors.push("history coverage sourceIndexPath mismatch");
	if (coverage.dateRange?.from !== index.availableDates?.at(0)) errors.push("history coverage first date mismatch");
	if (coverage.dateRange?.to !== index.latestDate) errors.push("history coverage latest date mismatch");
	if (coverage.dateRange?.dateCount !== index.summary?.dateCount) errors.push("history coverage date count mismatch");
	if (coverage.summary?.raceCount <= 0) errors.push("history coverage raceCount must be positive");
	if (coverage.summary?.venueCount <= 0) errors.push("history coverage venueCount must be positive");
	if (coverage.venues?.length !== coverage.summary?.venueCount) errors.push("history coverage venue list mismatch");
	if (coverage.readiness?.status !== "ready") errors.push("history coverage must be ready");
	if (errors.length > 0) throw new Error(errors.join("\n"));
	console.log(JSON.stringify({
		ok: true,
		coveragePath: COVERAGE_PATH,
		dateRange: coverage.dateRange,
		summary: coverage.summary,
		readiness: coverage.readiness,
	}, null, 2));
}

main();
