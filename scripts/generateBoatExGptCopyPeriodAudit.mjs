import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const target = path.join(repoRoot, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const asRecord = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : null;
const asText = (value) => value === null || value === undefined ? "" : String(value).trim();
const parseArgs = (argv) => {
	const args = { targetDate: "", dryRun: false };
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] === "--target-date") args.targetDate = argv[++index] ?? "";
		else if (argv[index] === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${argv[index]}`);
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(args.targetDate)) throw new Error("--target-date YYYY-MM-DD is required");
	return args;
};
const period = (file, fallbackType) => {
	const range = asRecord(file?.dateRange);
	return range ? { dataPeriodType: fallbackType, from: asText(range.from), to: asText(range.to), dateCount: Number(range.dateCount ?? range.dates?.length ?? 0) } : null;
};
const exists = (relativePath) => fs.existsSync(path.join(repoRoot, relativePath));
const targetDatePeriod = (sourcePath, targetDate) => exists(sourcePath)
	? { dataPeriodType: "target-date", from: targetDate, to: targetDate, dateCount: 1, targetDateMatch: true, safeForPredictionCopy: true, reason: "target-date file is available" }
	: null;

try {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const latestDate = asText(index.latestDate);
	const weatherHistory = readJson("public/data/boatrace-ex/derived/weather-water-history/latest.json");
	const venueBias = readJson("public/data/boatrace-ex/derived/venue-bias/latest.json");
	const roughIndex = readJson("public/data/boatrace-ex/derived/rough-index/latest.json");
	const todayFlow = readJson("public/data/boatrace-ex/derived/today-flow/latest.json");
	const raceAnalysis = readJson("public/data/boatrace-ex/derived/race-analysis/latest.json");
	const predictionStructure = readJson("public/data/boatrace-ex/derived/prediction-structure/latest.json");
	const registeredRacers = readJson("public/data/boatrace-ex/identity/registered-racers.generated.json");
	const historyPeriod = period(weatherHistory, "historical");
	const latestDayPeriod = { dataPeriodType: "latest-day", from: latestDate, to: latestDate, dateCount: latestDate ? 1 : 0 };
	const targetRaceAnalysisPath = `public/data/boatrace-ex/derived/race-analysis/dates/${args.targetDate}.json`;
	const targetRaceAnalysis = targetDatePeriod(targetRaceAnalysisPath, args.targetDate);
	const targetDateMatches = latestDate === args.targetDate;
	const signals = [
		{ signalName: "weather-water-history", sourcePath: "public/data/boatrace-ex/derived/weather-water-history/latest.json", ...historyPeriod, targetDate: args.targetDate, targetDateMatches: null, safeForPredictionCopy: true, reason: "history/races aggregation; historical reference only" },
		{ signalName: "venue-bias", sourcePath: "public/data/boatrace-ex/derived/venue-bias/latest.json", ...period(venueBias, "historical"), targetDate: args.targetDate, targetDateMatches: null, safeForPredictionCopy: true, reason: "historical venue tendency reference" },
		{ signalName: "rough-index", sourcePath: "public/data/boatrace-ex/derived/rough-index/latest.json", ...period(roughIndex, "historical"), targetDate: args.targetDate, targetDateMatches: null, safeForPredictionCopy: "caution", reason: "historical payout reference; no condition-match inference" },
		{ signalName: "today-flow", sourcePath: "public/data/boatrace-ex/derived/today-flow/latest.json", ...period(todayFlow, "latest-day"), targetDate: args.targetDate, targetDateMatches, safeForPredictionCopy: targetDateMatches, reason: targetDateMatches ? "same-day flow is available" : "target-date mismatch; do not use as today flow" },
		{ signalName: "race-analysis", sourcePath: targetRaceAnalysis ? targetRaceAnalysisPath : "public/data/boatrace-ex/derived/race-analysis/latest.json", ...(targetRaceAnalysis ?? latestDayPeriod), targetDate: args.targetDate, targetDateMatches: targetRaceAnalysis?.targetDateMatch ?? asText(raceAnalysis.targetDate) === args.targetDate, safeForPredictionCopy: targetRaceAnalysis?.safeForPredictionCopy ?? false, reason: targetRaceAnalysis?.reason ?? "target-date file is missing; latest-day analysis must not be used as today analysis" },
		{ signalName: "venue-evidence", sourcePath: `public/data/boatrace-ex/derived/venue-evidence/${latestDate}.json`, dataPeriodType: "daily", from: latestDate, to: latestDate, dateCount: latestDate ? 1 : 0, targetDate: args.targetDate, targetDateMatches, safeForPredictionCopy: targetDateMatches, reason: targetDateMatches ? "same-day coverage is available" : "target-date mismatch; daily coverage is not prediction-day evidence" },
		{ signalName: "racer-evidence", sourcePath: `public/data/boatrace-ex/derived/racer-evidence/${latestDate}.json`, dataPeriodType: "daily", from: latestDate, to: latestDate, dateCount: latestDate ? 1 : 0, targetDate: args.targetDate, targetDateMatches, safeForPredictionCopy: targetDateMatches, reason: targetDateMatches ? "same-day racer evidence is available" : "target-date mismatch; daily racer evidence is not prediction-day evidence" },
		{ signalName: "registered-racers", sourcePath: "public/data/boatrace-ex/identity/registered-racers.generated.json", dataPeriodType: "historical", from: asText(registeredRacers.summary?.firstSeenDate), to: asText(registeredRacers.summary?.lastSeenDate), dateCount: null, targetDate: args.targetDate, targetDateMatches: null, safeForPredictionCopy: true, reason: "registered identities with official provenance; historical identity reference only" },
		{ signalName: "prediction-structure", sourcePath: "public/data/boatrace-ex/derived/prediction-structure/latest.json", ...period(predictionStructure, "latest-day"), targetDate: args.targetDate, targetDateMatches: asText(predictionStructure.targetDate) === args.targetDate, safeForPredictionCopy: asText(predictionStructure.targetDate) === args.targetDate, reason: asText(predictionStructure.targetDate) === args.targetDate ? "target-date structure is available" : "target-date mismatch; do not use as today prediction structure" },
	];
	const output = {
		schemaVersion: 1,
		kind: "boat-ex-gpt-copy-period-audit-v1",
		generatedAt: new Date().toISOString(),
		targetDate: args.targetDate,
		latestExDate: latestDate,
		historicalDateRange: historyPeriod,
		signals,
		warnings: signals.filter((signal) => signal.targetDateMatches === false).map((signal) => `${signal.signalName}: ${signal.reason}`),
	};
	const outputPath = `public/data/boatrace-ex/audit/gpt-copy-ex-period-audit-${args.targetDate}.generated.json`;
	if (!args.dryRun) writeJson(outputPath, output);
	console.log(JSON.stringify({ ok: true, outputPath, targetDate: args.targetDate, latestExDate: latestDate, signalCount: signals.length }, null, 2));
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
