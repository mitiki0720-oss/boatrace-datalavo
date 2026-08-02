import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const throughIndex = args.indexOf("--through");
const throughDate = throughIndex >= 0 ? args[throughIndex + 1] : "2026-08-02";
if (!/^\d{4}-\d{2}-\d{2}$/.test(throughDate ?? "")) throw new Error("--through requires YYYY-MM-DD");

const rootDir = process.cwd();
const reportPath = path.join(rootDir, "public", "data", "boatrace-ex", "audit", `history-backfill-${throughDate}.generated.json`);
const markdownPath = path.join(rootDir, "docs", "boat-ex", `history-backfill-${throughDate}.md`);
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

assert(report.kind === "boatrace-ex-history-backfill-coverage", "unexpected report kind");
assert(report.schemaVersion === 1, "schemaVersion must be 1");
assert(report.range?.throughDate === throughDate, "report throughDate mismatch");
assert(Array.isArray(report.sourceFiles) && report.sourceFiles.every((file) => !file.startsWith("public/data/reviews/") && !file.startsWith("public/dog/")), "report must not use reviews or dog sources");
assert(Array.isArray(report.generatedDates) && Array.isArray(report.eligibleDates), "generatedDates and eligibleDates are required");
assert(report.generatedDates.every((date) => report.eligibleDates.some((entry) => entry.date === date)), "generated dates must be dry-run eligible");
assert(report.generatedDates.every((date) => !report.existingDates.includes(date)), "existing dates must not be regenerated");
assert(report.generatedDates.every((date) => date >= report.range.fromDate && date <= report.range.throughDate), "generated date is outside requested range");
assert(report.registrationSafety?.policy?.includes("never infers"), "registration safety policy is missing");
assert(fs.existsSync(markdownPath), "backfill markdown is missing");

if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log(JSON.stringify({ ok: true, reportPath: path.relative(rootDir, reportPath), throughDate, candidates: report.candidates, generatedDates: report.generatedDates, skippedExistingDates: report.skippedExistingDates, rejectedDateCount: report.rejectedDates.length }, null, 2));
