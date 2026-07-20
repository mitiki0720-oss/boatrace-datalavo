import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const INDEX_PATH = "public/data/boatrace-ex/source/historical-sources.generated.json";
const COVERAGE_PATH = "public/data/boatrace-ex/derived/history-coverage/latest.json";
const SOURCE_TYPES = new Set(["review-text", "review-json", "dog-image", "boatrace-generated-json", "boatrace-ex-derived-json", "unknown"]);

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(repoRoot, ...relativePath.split("/")), "utf8"));
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}

function main() {
	const index = readJson(INDEX_PATH);
	const coverage = readJson(COVERAGE_PATH);
	const errors = [];
	const sources = Array.isArray(index?.sources) ? index.sources : [];
	if (index?.schemaVersion !== "boat-ex-historical-source-index-v1") errors.push("invalid source index schemaVersion");
	if (coverage?.schemaVersion !== "boat-ex-history-coverage-v1" || coverage?.ok !== true) errors.push("invalid history coverage");
	if (coverage?.sourceIndexPath !== INDEX_PATH) errors.push("coverage sourceIndexPath is invalid");
	if (sources.length === 0) errors.push("source index must not be empty");
	for (const source of sources) {
		if (!SOURCE_TYPES.has(source?.sourceType)) errors.push(`invalid sourceType: ${source?.sourceType}`);
		if (typeof source?.sourceId !== "string" || !source.sourceId) errors.push("sourceId is required");
		if (typeof source?.relativePath !== "string" || !source.relativePath.startsWith("public/")) errors.push(`invalid relativePath: ${source?.relativePath}`);
		if (source?.relativePath?.startsWith("public/data/reviews/") && source?.sourceType !== "review-text" && source?.sourceType !== "review-json") errors.push(`review type mismatch: ${source.relativePath}`);
		if (source?.relativePath?.startsWith("public/dog/") && source?.sourceType !== "dog-image") errors.push(`dog type mismatch: ${source.relativePath}`);
		if (!Array.isArray(source?.warnings)) errors.push(`warnings missing: ${source?.relativePath}`);
	}
	const dates = unique(sources.map((source) => source.date)).sort();
	const venueNames = unique(sources.map((source) => source.venueName)).sort((left, right) => left.localeCompare(right, "ja"));
	const count = (type) => sources.filter((source) => source.sourceType === type).length;
	const unresolvedSourceCount = sources.filter((source) => source.parsedStatus === "invalid-json" || !source.date || !source.venueCode).length;
	const expected = {
		dateFrom: dates.at(0) ?? null,
		dateTo: dates.at(-1) ?? null,
		dateCount: dates.length,
		venueCount: venueNames.length,
		venueNames,
		sourceCount: sources.length,
		reviewFileCount: count("review-text") + count("review-json"),
		dogImageCount: count("dog-image"),
		boatraceGeneratedJsonCount: count("boatrace-generated-json"),
		boatraceExDerivedJsonCount: count("boatrace-ex-derived-json"),
		unresolvedSourceCount,
	};
	for (const [key, value] of Object.entries(expected)) {
		if (JSON.stringify(coverage?.[key]) !== JSON.stringify(value)) errors.push(`coverage.${key} does not match source index`);
	}
	if (errors.length > 0) throw new Error(errors.join("\n"));
	console.log(JSON.stringify({ ok: true, indexPath: INDEX_PATH, coveragePath: COVERAGE_PATH, ...expected, warnings: coverage.warnings }, null, 2));
}

main();
