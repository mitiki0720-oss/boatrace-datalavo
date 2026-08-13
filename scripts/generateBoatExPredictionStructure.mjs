import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const OUTPUT_PATH = "public/data/boatrace-ex/derived/prediction-structure/latest.json";
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const HISTORY_SUMMARY_PATH = "public/data/boatrace-ex/derived/prediction-structure/history-summary.json";
const HISTORY_INDEX_PATH = "public/data/boatrace-ex/derived/prediction-structure/history-index.json";
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const absolute = (relativePath) => path.join(repoRoot, ...relativePath.split("/"));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const writeJson = (relativePath, value, dryRun) => { if (!dryRun) fs.writeFileSync(absolute(relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8"); };

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function hasResult(record) {
	return Array.isArray(record?.officialResult?.finishOrder) && record.officialResult.finishOrder.length >= 3;
}

function latestSummary(history, tickets) {
	const summary = { venueCount: new Set(history.records.map((record) => record.venueCode)).size, raceCount: history.records.length, officialRaceCount: 0, resultAvailableRaceCount: 0, payoutAvailableRaceCount: 0, exhibitionAvailableRaceCount: 0, weatherAvailableRaceCount: 0, motorAvailableRaceCount: 0, boatAvailableRaceCount: 0, racerAvailableRaceCount: 0, predictionTextAvailableRaceCount: tickets.summary.predictionTextAvailableRaceCount, structuredTicketAvailableRaceCount: tickets.summary.structuredTicketAvailableRaceCount, structuredTicketCount: tickets.summary.structuredTicketCount, classifiedTicketCount: tickets.summary.classifiedTicketCount, unclassifiedTicketCount: tickets.summary.unclassifiedTicketCount, evaluatedPredictionRaceCount: tickets.summary.evaluatedPredictionRaceCount, hitRaceCount: tickets.summary.hitRaceCount, missRaceCount: tickets.summary.missRaceCount, payoutLinkedHitCount: tickets.summary.payoutLinkedHitCount, totalSourceBackedPayoutYen: tickets.summary.totalSourceBackedPayoutYen };
	for (const record of history.records) {
		summary.officialRaceCount += record.officialRace ? 1 : 0;
		summary.resultAvailableRaceCount += hasResult(record) ? 1 : 0;
		summary.payoutAvailableRaceCount += record.officialResult?.payout?.some((entry) => String(entry?.betType ?? "").includes("3\u9023\u5358")) ? 1 : 0;
		summary.exhibitionAvailableRaceCount += record.officialExhibition?.entries?.length ? 1 : 0;
		summary.weatherAvailableRaceCount += record.weather ? 1 : 0;
		summary.motorAvailableRaceCount += record.motor?.length ? 1 : 0;
		summary.boatAvailableRaceCount += record.boat?.length ? 1 : 0;
		summary.racerAvailableRaceCount += record.racer?.length ? 1 : 0;
	}
	return summary;
}

function mergeManifest(entry, generatedAt) {
	const manifest = readJson(MANIFEST_PATH);
	return { ...manifest, generatedAt, files: [...(manifest.files ?? []).filter((file) => file?.path !== entry.path), entry] };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const index = readJson(DATE_INDEX_PATH);
	const history = readJson(`public/data/boatrace-ex/history/races/${index.latestDate}.json`);
	const historySummary = readJson(HISTORY_SUMMARY_PATH);
	const historyIndex = readJson(HISTORY_INDEX_PATH);
	const ticketEntry = historyIndex.dates.find((entry) => entry.date === index.latestDate);
	if (!ticketEntry) throw new Error("Latest structured ticket shard is missing");
	const latestTickets = readJson(ticketEntry.path);
	const summary = latestSummary(history, latestTickets);
	const output = {
		schemaVersion: "boat-ex-prediction-structure-v1",
		generatedAt,
		status: "available",
		readiness: historySummary.readiness,
		targetDate: index.latestDate,
		dateRange: { from: index.latestDate, to: index.latestDate, dateCount: 1 },
		summary,
		venues: [],
		sourceFiles: [
			{ sourceName: "BOATRACE EX date index", sourcePath: DATE_INDEX_PATH, sourceStatus: "available", coverageStatus: "available" },
			{ sourceName: "Latest history", sourcePath: `public/data/boatrace-ex/history/races/${index.latestDate}.json`, sourceStatus: "available", coverageStatus: "partial" },
			{ sourceName: "Strict ticket history summary", sourcePath: HISTORY_SUMMARY_PATH, sourceStatus: "available", coverageStatus: historySummary.readiness.status },
		],
		historyCoverage: historySummary,
		warnings: historySummary.readiness.status === "ready" ? [] : ["Strict parser results remain source-backed and are not promoted to ready before the configured coverage threshold is met."],
	};
	const auditPath = `public/data/boatrace-ex/audit/prediction-structure-contract-${index.latestDate}.generated.json`;
	const audit = { schemaVersion: 1, kind: "boatrace-ex-prediction-structure-contract-audit", auditDate: index.latestDate, generatedAt, mode: "strict-source-backed", contract: { predictionText: "prediction.textExcerpt with prediction.sourceStatus === available", parser: "strict-ticket-pattern after a buy-ticket marker and 3-trifecta group heading", resultPath: "officialResult.finishOrder", payoutPath: "officialResult.payout[]", evaluation: "exact ordered boat-number triple only" }, targetDate: { date: index.latestDate, summary, readiness: output.readiness }, historyCoverage: historySummary, sourceFiles: output.sourceFiles.map((source) => source.sourcePath) };
	const manifest = mergeManifest({ path: OUTPUT_PATH, kind: output.schemaVersion, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: output.readiness.status, recordCount: summary.raceCount }, generatedAt);
	writeJson(OUTPUT_PATH, output, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, targetDate: index.latestDate, summary, historyReadiness: historySummary.readiness.status }, null, 2));
}

main();
