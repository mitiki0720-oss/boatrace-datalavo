import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const write = args.includes("--write");
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const index = readJson("public/data/boatrace-ex/index.generated.json");
const targetDate = index.latestDate;
const venue = readJson(`public/data/boatrace-ex/derived/venue-evidence/${targetDate}.json`);
const racer = readJson(`public/data/boatrace-ex/derived/racer-evidence/${targetDate}.json`);
const venueBias = readJson("public/data/boatrace-ex/derived/venue-bias/latest.json");
const roughIndex = readJson("public/data/boatrace-ex/derived/rough-index/latest.json");
const todayFlow = readJson("public/data/boatrace-ex/derived/today-flow/latest.json");
const predictionStructure = readJson("public/data/boatrace-ex/derived/prediction-structure/latest.json");
const structuredTicketsHistorySummary = readJson("public/data/boatrace-ex/derived/prediction-structure/history-summary.json");
const structuredTicketsHistoryIndex = readJson("public/data/boatrace-ex/derived/prediction-structure/history-index.json");
const historyCoverage = readJson("public/data/boatrace-ex/derived/history-coverage/latest.json");
const historicalSourceCoverage = readJson("public/data/boatrace-ex/derived/historical-source-coverage/latest.json");
const raceAnalysis = readJson("public/data/boatrace-ex/derived/race-analysis/latest.json");
const historicalRaceAnalysisSummary = readJson("public/data/boatrace-ex/derived/race-analysis/history-summary.json");
const historicalRaceAnalysisIndex = readJson("public/data/boatrace-ex/derived/race-analysis/history-index.json");
const currentDayPredictionCoverage = readJson("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json");
const weatherWaterHistory = readJson("public/data/boatrace-ex/derived/weather-water-history/latest.json");
const racerFeatures = readJson("public/data/boatrace-ex/derived/racer-features/latest.json");
const identityRegistryPath = "public/data/boatrace-ex/identity/registered-racers.generated.json";
const currentDayRegistryAuditPath = `public/data/boatrace-ex/audit/current-day-registry-linkage-gap-${targetDate}.generated.json`;
const predictionAuditPath = `public/data/boatrace-ex/audit/prediction-structure-contract-${targetDate}.generated.json`;
const sourcePaths = {
	index: "public/data/boatrace-ex/index.generated.json",
	venue: `public/data/boatrace-ex/derived/venue-evidence/${targetDate}.json`,
	racer: `public/data/boatrace-ex/derived/racer-evidence/${targetDate}.json`,
	venueBias: "public/data/boatrace-ex/derived/venue-bias/latest.json",
	roughIndex: "public/data/boatrace-ex/derived/rough-index/latest.json",
	todayFlow: "public/data/boatrace-ex/derived/today-flow/latest.json",
	predictionStructure: "public/data/boatrace-ex/derived/prediction-structure/latest.json",
	structuredTicketsHistorySummary: "public/data/boatrace-ex/derived/prediction-structure/history-summary.json",
	structuredTicketsHistoryIndex: "public/data/boatrace-ex/derived/prediction-structure/history-index.json",
	raceAnalysis: "public/data/boatrace-ex/derived/race-analysis/latest.json",
	historicalRaceAnalysisSummary: "public/data/boatrace-ex/derived/race-analysis/history-summary.json",
	historicalRaceAnalysisIndex: "public/data/boatrace-ex/derived/race-analysis/history-index.json",
	historyCoverage: "public/data/boatrace-ex/derived/history-coverage/latest.json",
	historicalSourceCoverage: "public/data/boatrace-ex/derived/historical-source-coverage/latest.json",
	currentDayPredictionCoverage: "public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json",
	weatherWaterHistory: "public/data/boatrace-ex/derived/weather-water-history/latest.json",
	racerFeatures: "public/data/boatrace-ex/derived/racer-features/latest.json",
	identityRegistry: identityRegistryPath,
	currentDayRegistryAudit: currentDayRegistryAuditPath,
	predictionAudit: predictionAuditPath,
};
for (const sourcePath of Object.values(sourcePaths)) {
	if (!fs.existsSync(path.join(root, sourcePath))) throw new Error(`Required source is missing: ${sourcePath}`);
}

const historyIsCurrent = historyCoverage.dateRange?.to === targetDate
	&& historyCoverage.dateRange?.dateCount === index.summary?.dateCount;
const raceAnalysisIsCurrent = historicalRaceAnalysisSummary.dateRange?.latestDate === targetDate
	&& historicalRaceAnalysisIndex.latestDate === targetDate
	&& historicalRaceAnalysisIndex.dateCount === index.summary?.dateCount;
const dateMetrics = (index.availableDates ?? []).map((date) => {
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	const records = history.records ?? [];
	const resultSampleCount = records.filter((record) => (record.officialResult?.finishOrder ?? []).length >= 3).length;
	const payoutSampleCount = records.filter((record) => (record.officialResult?.payout ?? []).some((item) => String(item?.betType ?? "").includes("3連単") && /\d/u.test(String(item?.payoutYen ?? "")))).length;
	const weatherSampleCount = records.filter((record) => Object.values(record.weather ?? {}).some((value) => value !== null && value !== undefined && value !== "")).length;
	return { date, raceCount: records.length, resultSampleCount, payoutSampleCount, weatherSampleCount };
});
const latestDateWhere = (predicate) => dateMetrics.filter(predicate).at(-1)?.date ?? null;
const previousIndexedDate = index.availableDates?.at(-2) ?? null;
const previousMetrics = dateMetrics.at(-2) ?? { raceCount: 0, resultSampleCount: 0, payoutSampleCount: 0, weatherSampleCount: 0 };
const latestMetrics = dateMetrics.at(-1) ?? { raceCount: 0, resultSampleCount: 0, payoutSampleCount: 0, weatherSampleCount: 0 };
const resultCompleteThrough = latestDateWhere((item) => item.raceCount > 0 && item.resultSampleCount === item.raceCount);
const payoutCompleteThrough = latestDateWhere((item) => item.raceCount > 0 && item.payoutSampleCount === item.raceCount);
const weatherThrough = latestDateWhere((item) => item.raceCount > 0 && item.weatherSampleCount === item.raceCount);
const predictionEvaluationThrough = [...(structuredTicketsHistoryIndex.dates ?? [])].filter((item) => (item.evaluatedPredictionRaceCount ?? 0) > 0).at(-1)?.date ?? null;
const historicalStatus = latestMetrics.resultSampleCount === 0 && previousMetrics.resultSampleCount > 0
	? previousMetrics.resultSampleCount === previousMetrics.raceCount
		? "current"
		: "partial"
	: latestMetrics.resultSampleCount > 0 && latestMetrics.resultSampleCount < latestMetrics.raceCount
		? "partial"
		: resultCompleteThrough === targetDate
			? "current"
			: "stale";
const freshness = {
	indexLatestDate: targetDate,
	resultCompleteThrough,
	payoutCompleteThrough,
	weatherThrough,
	racerResultThrough: latestDateWhere((item) => item.resultSampleCount > 0),
	historicalSourceThrough: historicalSourceCoverage.dateTo ?? null,
	predictionEvaluationThrough,
};
const total = (key) => dateMetrics.reduce((sum, item) => sum + item[key], 0);
const tabMetrics = (primarySource, status = historicalStatus) => ({
	primarySource,
	latestIndexedDate: targetDate,
	latestFinalizedResultDate: resultCompleteThrough,
	raceCount: total("raceCount"),
	resultSampleCount: total("resultSampleCount"),
	payoutSampleCount: total("payoutSampleCount"),
	weatherSampleCount: total("weatherSampleCount"),
	freshness: status,
});
const tabs = [
	{ key: "overview", status: historicalStatus, ...tabMetrics(sourcePaths.historyCoverage), reason: `Index ${targetDate}; finalized results through ${resultCompleteThrough ?? "unavailable"}.`, sourcePaths: [sourcePaths.index, sourcePaths.historyCoverage, sourcePaths.currentDayPredictionCoverage] },
	{ key: "identity", status: historicalStatus, ...tabMetrics(sourcePaths.racerFeatures), reason: `Exact-registration racer result samples: ${racerFeatures.summary?.resultSampleCount ?? 0}; name-only inference is not used.`, sourcePaths: [sourcePaths.racer, sourcePaths.racerFeatures, sourcePaths.identityRegistry, sourcePaths.currentDayRegistryAudit] },
	{ key: "data-coverage", status: historicalStatus, ...tabMetrics(sourcePaths.historyCoverage), reason: `Indexed through ${targetDate}; result complete through ${resultCompleteThrough ?? "unavailable"}; historical sources through ${freshness.historicalSourceThrough ?? "unavailable"}.`, sourcePaths: [sourcePaths.index, sourcePaths.historyCoverage, sourcePaths.historicalSourceCoverage, sourcePaths.currentDayPredictionCoverage, sourcePaths.venue] },
	{ key: "trend-lab", status: historicalStatus, ...tabMetrics(sourcePaths.venueBias), reason: venueBias.readiness.reason, sourcePaths: [sourcePaths.venueBias, sourcePaths.roughIndex] },
	{ key: "trifecta-ranking", status: payoutCompleteThrough === resultCompleteThrough ? historicalStatus : "partial", ...tabMetrics(sourcePaths.roughIndex, payoutCompleteThrough === resultCompleteThrough ? historicalStatus : "partial"), reason: `Source-backed trifecta payout samples through ${payoutCompleteThrough ?? "unavailable"}; no prediction ranking is generated.`, sourcePaths: [sourcePaths.roughIndex, sourcePaths.todayFlow] },
	{ key: "rough-index", status: historicalStatus, ...tabMetrics(sourcePaths.roughIndex), reason: roughIndex.readiness.reason, sourcePaths: [sourcePaths.roughIndex] },
	{ key: "race-transition", status: latestMetrics.resultSampleCount === 0 ? "pre-race" : historicalStatus, ...tabMetrics(sourcePaths.todayFlow, latestMetrics.resultSampleCount === 0 ? "pre-race" : historicalStatus), reason: todayFlow.readiness.reason, sourcePaths: [sourcePaths.todayFlow] },
	{ key: "weather", status: weatherThrough === targetDate ? "current" : "partial", ...tabMetrics(sourcePaths.weatherWaterHistory, weatherThrough === targetDate ? "current" : "partial"), reason: `Source-backed weather is complete through ${weatherThrough ?? "unavailable"}.`, sourcePaths: [sourcePaths.weatherWaterHistory, sourcePaths.venue] },
	{ key: "venue-bias", status: historicalStatus, ...tabMetrics(sourcePaths.venueBias), reason: venueBias.readiness.reason, sourcePaths: [sourcePaths.venueBias] },
	{ key: "today-flow", status: latestMetrics.resultSampleCount === 0 ? "pre-race" : historicalStatus, ...tabMetrics(sourcePaths.todayFlow, latestMetrics.resultSampleCount === 0 ? "pre-race" : historicalStatus), reason: todayFlow.readiness.reason, sourcePaths: [sourcePaths.todayFlow] },
	{ key: "prediction-structure", status: predictionEvaluationThrough ? (predictionEvaluationThrough === resultCompleteThrough ? historicalStatus : "partial") : "stale", ...tabMetrics(sourcePaths.structuredTicketsHistorySummary, predictionEvaluationThrough ? (predictionEvaluationThrough === resultCompleteThrough ? historicalStatus : "partial") : "stale"), reason: `Strict exact-order evaluations are available through ${predictionEvaluationThrough ?? "unavailable"}.`, sourcePaths: [sourcePaths.predictionStructure, sourcePaths.structuredTicketsHistorySummary, sourcePaths.structuredTicketsHistoryIndex, sourcePaths.predictionAudit] },
	{ key: "race-analysis", status: historicalStatus, ...tabMetrics(sourcePaths.historicalRaceAnalysisSummary), reason: `${raceAnalysis.summary.readiness.reason} Historical index covers ${historicalRaceAnalysisIndex.dateCount} dates through ${historicalRaceAnalysisIndex.latestDate}.`, sourcePaths: [sourcePaths.raceAnalysis, sourcePaths.historicalRaceAnalysisSummary, sourcePaths.historicalRaceAnalysisIndex, sourcePaths.racer, sourcePaths.venue] },
	{ key: "ex-analysis", status: historicalStatus, ...tabMetrics(sourcePaths.historicalRaceAnalysisSummary), reason: "The hub separates finalized historical EX from current-day pre-race coverage without ranking them.", sourcePaths: [sourcePaths.venueBias, sourcePaths.roughIndex, sourcePaths.todayFlow, sourcePaths.predictionStructure, sourcePaths.currentDayPredictionCoverage] },
];
const auditPath = `public/data/boatrace-ex/audit/tab-completeness-${targetDate}.generated.json`;
const audit = {
	schemaVersion: 1,
	kind: "boatrace-ex-tab-completeness-audit",
	auditDate: targetDate,
	generatedAt: new Date().toISOString(),
	policy: "Every Boat EX tab presents source-backed counts, readiness, reasons, or audit paths. Strict source-text ticket extraction and exact-order evaluation are limited to the documented prediction-structure contract; no fake score, rank, recommendation, inferred result, or inferred payout is used.",
	freshness,
	summary: {
		tabCount: tabs.length,
		readyCount: tabs.filter((tab) => tab.status === "ready").length,
		availableCount: tabs.filter((tab) => tab.status === "available").length,
		insufficientHistoryCount: tabs.filter((tab) => tab.status === "insufficient-history").length,
		pendingCount: tabs.filter((tab) => tab.status === "pending").length,
		currentCount: tabs.filter((tab) => tab.status === "current").length,
		partialCount: tabs.filter((tab) => tab.status === "partial").length,
		staleCount: tabs.filter((tab) => tab.status === "stale").length,
		preRaceCount: tabs.filter((tab) => tab.status === "pre-race").length,
	},
	tabs,
};

if (write) {
	writeJson(auditPath, audit);
}

const existing = write ? audit : readJson(auditPath);
const expectedKeys = ["overview", "identity", "data-coverage", "trend-lab", "trifecta-ranking", "rough-index", "race-transition", "weather", "venue-bias", "today-flow", "prediction-structure", "race-analysis", "ex-analysis"];
const errors = [];
const actualTabs = existing.tabs ?? [];
if (actualTabs.length !== expectedKeys.length) errors.push("tab count mismatch");
for (const key of expectedKeys) {
	const tab = actualTabs.find((entry) => entry.key === key);
	if (!tab) errors.push(`missing tab audit entry: ${key}`);
	else if (!tab.status || !tab.reason || !Array.isArray(tab.sourcePaths) || tab.sourcePaths.length === 0) errors.push(`incomplete tab audit entry: ${key}`);
}
for (const key of ["indexLatestDate", "resultCompleteThrough", "payoutCompleteThrough", "weatherThrough", "racerResultThrough", "historicalSourceThrough", "predictionEvaluationThrough"]) {
	if (!(key in (existing.freshness ?? {}))) errors.push(`tab audit freshness is missing ${key}`);
}
if (existing.auditDate !== targetDate) errors.push("tab audit date must match EX index latestDate");
if (!historyIsCurrent) errors.push("history coverage is stale against EX date index");
if (!raceAnalysisIsCurrent) errors.push("historical race analysis is stale against EX date index");
if (venueBias.dateRange?.to !== targetDate || venueBias.dateRange?.dateCount !== index.summary?.dateCount) errors.push("venue bias is stale against EX date index");
if (roughIndex.dateRange?.to !== targetDate || roughIndex.dateRange?.dateCount !== index.summary?.dateCount) errors.push("rough index is stale against EX date index");
if (structuredTicketsHistorySummary.periodEnd !== targetDate || structuredTicketsHistorySummary.dateCount !== index.summary?.dateCount) errors.push("prediction structure history is stale against EX date index");
if (currentDayPredictionCoverage.targetDate !== targetDate) errors.push("current-day prediction coverage targetDate mismatch");
const pageSource = readText("src/pages/BoatExPage.tsx");
for (const key of expectedKeys) {
	if (!pageSource.includes(`case \"${key}\"`)) errors.push(`BoatExPage is missing tab case: ${key}`);
}
if (!pageSource.includes("CurrentDayPredictionCoverageSection")) errors.push("BoatExPage is missing current-day prediction coverage display");
if (!pageSource.includes("auditedStatus ?? section.status")) errors.push("BoatExPage tab cards are not wired to the latest completeness audit");
if (!pageSource.includes("coverage.preRaceCount") || !pageSource.includes("coverage.raceAnalysisAvailableRaceCount") || !pageSource.includes("coverage.inconsistentStatusCount")) {
	errors.push("BoatExPage is missing current-day lifecycle summary display");
}
if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(JSON.stringify({ ok: true, auditPath, targetDate, historyCoverage: historyCoverage.dateRange, raceAnalysis: { latestDate: historicalRaceAnalysisIndex.latestDate, dateCount: historicalRaceAnalysisIndex.dateCount }, summary: existing.summary }, null, 2));
}
