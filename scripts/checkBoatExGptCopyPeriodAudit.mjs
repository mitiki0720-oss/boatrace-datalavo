import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const targetDate = process.argv[2] ?? "2026-08-13";
const relativePath = `public/data/boatrace-ex/audit/gpt-copy-ex-period-audit-${targetDate}.generated.json`;
try {
	const audit = JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
	const fail = (message) => { throw new Error(message); };
	if (audit.kind !== "boat-ex-gpt-copy-period-audit-v1") fail("unexpected audit kind");
	if (audit.targetDate !== targetDate) fail("target date mismatch");
	if (!(audit.historicalDateRange?.dateCount > 12)) fail("historical date range is too small");
	const expectedSignals = ["weather-water-history", "venue-bias", "rough-index", "today-flow", "race-analysis", "venue-evidence", "racer-evidence", "registered-racers", "prediction-structure"];
	for (const name of expectedSignals) {
		const signal = audit.signals?.find((item) => item.signalName === name);
		if (!signal) fail(`missing signal: ${name}`);
		if (!signal.sourcePath?.startsWith("public/data/boatrace-ex/")) fail(`unexpected source: ${name}`);
		if (signal.sourcePath.includes("reviews") || signal.sourcePath.includes("dog")) fail(`protected source: ${name}`);
		if (!["historical", "daily", "latest-day", "target-date", "missing"].includes(signal.dataPeriodType)) fail(`unknown period: ${name}`);
	}
	const historical = audit.signals.filter((item) => item.dataPeriodType === "historical");
	const mismatchedDaily = audit.signals.filter((item) => ["daily", "latest-day"].includes(item.dataPeriodType) && item.targetDateMatches === false);
	if (historical.length < 3) fail("historical signals missing");
	if (audit.latestExDate !== targetDate && mismatchedDaily.some((item) => item.safeForPredictionCopy === true)) fail("mismatched daily signal marked safe");
	console.log(JSON.stringify({ ok: true, targetDate, latestExDate: audit.latestExDate, historicalSignalCount: historical.length, mismatchedDailySignalCount: mismatchedDaily.length }, null, 2));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
