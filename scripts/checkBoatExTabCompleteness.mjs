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
const writeText = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, value, "utf8");
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
const raceAnalysis = readJson("public/data/boatrace-ex/derived/race-analysis/latest.json");
const historicalRaceAnalysisSummary = readJson("public/data/boatrace-ex/derived/race-analysis/history-summary.json");
const historicalRaceAnalysisIndex = readJson("public/data/boatrace-ex/derived/race-analysis/history-index.json");
const currentDayPredictionCoverage = readJson("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json");
const nameBridgePath = `public/data/boatrace-ex/audit/name-identity-bridge-${targetDate}.generated.json`;
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
	currentDayPredictionCoverage: "public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json",
	nameBridge: nameBridgePath,
	predictionAudit: predictionAuditPath,
};
for (const sourcePath of Object.values(sourcePaths)) {
	if (!fs.existsSync(path.join(root, sourcePath))) throw new Error(`Required source is missing: ${sourcePath}`);
}

const tabs = [
	{ key: "overview", status: "ready", reason: `Historical EX and current-day coverage are separated. Current target date: ${currentDayPredictionCoverage.targetDate}.`, sourcePaths: [sourcePaths.index, sourcePaths.historyCoverage, sourcePaths.currentDayPredictionCoverage] },
	{ key: "identity", status: "available", reason: "Racer evidence, registered identity registry, and name identity audit are available.", sourcePaths: [sourcePaths.racer, sourcePaths.nameBridge] },
	{ key: "data-coverage", status: "available", reason: "Date, historical EX, and current-day prediction coverage files are available.", sourcePaths: [sourcePaths.index, sourcePaths.historyCoverage, sourcePaths.currentDayPredictionCoverage, sourcePaths.venue] },
	{ key: "trend-lab", status: venueBias.readiness.status, reason: venueBias.readiness.reason, sourcePaths: [sourcePaths.venueBias, sourcePaths.roughIndex] },
	{ key: "trifecta-ranking", status: "available", reason: "Only source-backed trifecta result and payout coverage is presented; no ranking prediction is generated.", sourcePaths: [sourcePaths.roughIndex, sourcePaths.todayFlow] },
	{ key: "rough-index", status: roughIndex.readiness.status, reason: roughIndex.readiness.reason, sourcePaths: [sourcePaths.roughIndex] },
	{ key: "race-transition", status: todayFlow.readiness.status, reason: todayFlow.readiness.reason, sourcePaths: [sourcePaths.todayFlow] },
	{ key: "weather", status: "available", reason: "Venue evidence contains source-backed weather coverage.", sourcePaths: [sourcePaths.venue] },
	{ key: "venue-bias", status: venueBias.readiness.status, reason: venueBias.readiness.reason, sourcePaths: [sourcePaths.venueBias] },
	{ key: "today-flow", status: todayFlow.readiness.status, reason: todayFlow.readiness.reason, sourcePaths: [sourcePaths.todayFlow] },
	{ key: "prediction-structure", status: structuredTicketsHistorySummary.readiness.status, reason: `${predictionStructure.readiness.reason} Strict structured ticket history covers ${structuredTicketsHistoryIndex.dateCount} dates.`, sourcePaths: [sourcePaths.predictionStructure, sourcePaths.structuredTicketsHistorySummary, sourcePaths.structuredTicketsHistoryIndex, sourcePaths.predictionAudit] },
	{ key: "race-analysis", status: historicalRaceAnalysisSummary.summary.readiness.status, reason: `${raceAnalysis.summary.readiness.reason} Historical index covers ${historicalRaceAnalysisIndex.dateCount} dates.`, sourcePaths: [sourcePaths.raceAnalysis, sourcePaths.historicalRaceAnalysisSummary, sourcePaths.historicalRaceAnalysisIndex, sourcePaths.racer, sourcePaths.venue] },
	{ key: "ex-analysis", status: "available", reason: "The hub separates historical result-based EX from current-day prediction coverage without ranking them.", sourcePaths: [sourcePaths.venueBias, sourcePaths.roughIndex, sourcePaths.todayFlow, sourcePaths.predictionStructure, sourcePaths.currentDayPredictionCoverage] },
];
const auditPath = `public/data/boatrace-ex/audit/tab-completeness-${targetDate}.generated.json`;
const markdownPath = `docs/boat-ex/tab-completeness-${targetDate}.md`;
const audit = {
	schemaVersion: 1,
	kind: "boatrace-ex-tab-completeness-audit",
	auditDate: targetDate,
	generatedAt: new Date().toISOString(),
	policy: "Every Boat EX tab presents source-backed counts, readiness, reasons, or audit paths. Strict source-text ticket extraction and exact-order evaluation are limited to the documented prediction-structure contract; no fake score, rank, recommendation, inferred result, or inferred payout is used.",
	summary: {
		tabCount: tabs.length,
		readyCount: tabs.filter((tab) => tab.status === "ready").length,
		availableCount: tabs.filter((tab) => tab.status === "available").length,
		insufficientHistoryCount: tabs.filter((tab) => tab.status === "insufficient-history").length,
		pendingCount: tabs.filter((tab) => tab.status === "pending").length,
	},
	tabs,
};
const markdown = `# Boat EX Tab Completeness (${targetDate})\n\n${tabs.map((tab) => `- ${tab.key}: ${tab.status} - ${tab.reason}`).join("\n")}\n\nAll sections expose source-backed availability, readiness, reason, or audit information.\n`;

if (write) {
	writeJson(auditPath, audit);
	writeText(markdownPath, markdown);
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
if ((existing.summary?.pendingCount ?? -1) !== 0) errors.push("tab audit must not report pending tabs");
const pageSource = readText("src/pages/BoatExPage.tsx");
for (const key of expectedKeys) {
	if (!pageSource.includes(`case \"${key}\"`)) errors.push(`BoatExPage is missing tab case: ${key}`);
}
if (!pageSource.includes("CurrentDayPredictionCoverageSection")) errors.push("BoatExPage is missing current-day prediction coverage display");
if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(JSON.stringify({ ok: true, auditPath, markdownPath, summary: existing.summary }, null, 2));
}
