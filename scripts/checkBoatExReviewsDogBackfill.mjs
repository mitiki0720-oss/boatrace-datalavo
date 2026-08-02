import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const reportPath = "public/data/boatrace-ex/audit/reviews-dog-history-backfill-2026-08-02.generated.json";
const report = JSON.parse(fs.readFileSync(path.join(rootDir, reportPath), "utf8"));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

assert(report.kind === "boatrace-ex-reviews-dog-history-backfill", "unexpected report kind");
assert(report.summary?.historyReadyDateCount > 0, "expected at least one historyReady date");
assert(report.policy?.includes("No registration number is inferred"), "identity safety policy is missing");
assert(report.readOnlySourceRoots?.reviewSourceRoot && report.readOnlySourceRoots?.dogSourceRoot, "read-only source roots are missing");
for (const date of report.createdDates ?? []) {
	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const coveragePath = `public/data/boatrace-ex/coverage/${date}.json`;
	const history = JSON.parse(fs.readFileSync(path.join(rootDir, historyPath), "utf8"));
	const coverage = JSON.parse(fs.readFileSync(path.join(rootDir, coveragePath), "utf8"));
	assert(history.date === date && history.records.length > 0, `${date}: history is missing or empty`);
	assert(coverage.totals?.races === history.records.length, `${date}: coverage race count mismatch`);
	for (const record of history.records) {
		assert(record.prediction?.sourceStatus === "available", `${date}: prediction provenance is missing`);
		assert(record.officialResult?.finishOrder?.length >= 3, `${date}: result is incomplete`);
		assert(record.officialRace?.racers?.every((racer) => racer.registrationNumber === null), `${date}: a registration number was unexpectedly inferred`);
		for (const source of record.sources ?? []) assert(!String(source.sourcePath).startsWith("public/data/reviews/") && !String(source.sourcePath).startsWith("public/dog/"), `${date}: prohibited direct source path`);
	}
}
if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}
console.log(JSON.stringify({ ok: true, reportPath, createdDateCount: report.createdDates.length, summary: report.summary }, null, 2));
