import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLASSIFIED_GROUPS, PARSER_RULES, PARSER_VERSION, evaluateTickets, extractStrictStructuredTickets, officialResult, sourceBackedPredictionText, trifectaPayout } from "./boatExStructuredTickets.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const SUMMARY_PATH = "public/data/boatrace-ex/derived/prediction-structure/history-summary.json";
const HISTORY_INDEX_PATH = "public/data/boatrace-ex/derived/prediction-structure/history-index.json";
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";

const absolute = (relativePath) => path.join(repoRoot, ...relativePath.split("/"));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const writeJson = (relativePath, value, dryRun) => {
	if (dryRun) return;
	const target = absolute(relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function emptySummary() {
	return {
		raceCount: 0,
		predictionTextAvailableRaceCount: 0,
		structuredTicketAvailableRaceCount: 0,
		structuredTicketCount: 0,
		classifiedTicketCount: 0,
		unclassifiedTicketCount: 0,
		evaluatedPredictionRaceCount: 0,
		hitRaceCount: 0,
		missRaceCount: 0,
		resultUnavailableEvaluationCount: 0,
		payoutLinkedHitCount: 0,
		totalSourceBackedPayoutYen: 0,
	};
}

function addSummary(summary, race) {
	summary.raceCount += 1;
	summary.predictionTextAvailableRaceCount += race.predictionTextAvailable ? 1 : 0;
	summary.structuredTicketAvailableRaceCount += race.structuredTickets.length ? 1 : 0;
	summary.structuredTicketCount += race.structuredTickets.length;
	summary.classifiedTicketCount += race.structuredTickets.filter((ticket) => CLASSIFIED_GROUPS.includes(ticket.group)).length;
	summary.unclassifiedTicketCount += race.structuredTickets.filter((ticket) => ticket.group === "unclassified-source-text").length;
	summary.evaluatedPredictionRaceCount += race.evaluation.evaluationStatus === "evaluated" ? 1 : 0;
	summary.hitRaceCount += race.evaluation.hit === true ? 1 : 0;
	summary.missRaceCount += race.evaluation.hit === false ? 1 : 0;
	summary.resultUnavailableEvaluationCount += race.evaluation.evaluationStatus === "result-unavailable" ? 1 : 0;
	summary.payoutLinkedHitCount += race.evaluation.hit === true && race.evaluation.payoutYen !== null ? 1 : 0;
	summary.totalSourceBackedPayoutYen += race.evaluation.hit === true && Number.isSafeInteger(race.evaluation.payoutYen) ? race.evaluation.payoutYen : 0;
}

function readiness(summary) {
	if (summary.predictionTextAvailableRaceCount === 0) return { status: "unavailable", reason: "No source-backed prediction text is available.", missingRequirements: ["prediction-text-unavailable"] };
	if (summary.structuredTicketAvailableRaceCount === 0 || summary.evaluatedPredictionRaceCount === 0) return { status: "insufficient-history", reason: "No source-backed strict structured tickets and evaluated predictions are available.", missingRequirements: ["strict-structured-tickets-or-evaluations-unavailable"] };
	if (summary.structuredTicketAvailableRaceCount < 30 || summary.evaluatedPredictionRaceCount < 30) return { status: "insufficient-history", reason: "Strict structured ticket coverage is source-backed but remains below the 30-race readiness threshold.", missingRequirements: ["strict-structured-ticket-coverage-below-30"] };
	return { status: "ready", reason: "Source-backed strict structured tickets and exact-order evaluations meet the readiness threshold.", missingRequirements: [] };
}

function predictionSourcePath(record) {
	return record?.prediction?.sources?.find((source) => typeof source?.sourcePath === "string")?.sourcePath ?? null;
}

function buildRace(record) {
	const text = sourceBackedPredictionText(record);
	const sourcePath = predictionSourcePath(record);
	const parsed = text && sourcePath ? extractStrictStructuredTickets(text, sourcePath) : { tickets: [], skippedReasons: [text ? "prediction-source-path-unavailable" : "prediction-text-unavailable"] };
	const result = officialResult(record);
	const payoutYen = trifectaPayout(record);
	const evaluation = evaluateTickets(parsed.tickets, result, payoutYen);
	return {
		date: record.date,
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceNo: record.raceNo,
		predictionTextAvailable: Boolean(text),
		structuredTickets: parsed.tickets,
		officialResult: { finishOrder: result ?? [], trifectaPayoutYen: payoutYen },
		evaluation,
		skippedReasons: parsed.skippedReasons,
		sourcePaths: {
			history: `public/data/boatrace-ex/history/races/${record.date}.json`,
			prediction: sourcePath,
		},
	};
}

function mergeManifest(entries, generatedAt) {
	const existing = readJson(MANIFEST_PATH);
	const replaced = new Set(entries.map((entry) => entry.path));
	return { ...existing, generatedAt, files: [...(existing.files ?? []).filter((entry) => !replaced.has(entry?.path)), ...entries] };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson(DATE_INDEX_PATH);
	const generatedAt = new Date().toISOString();
	const dates = [];
	const totals = emptySummary();
	const skippedReasons = {};
	for (const date of index.availableDates ?? []) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyPath);
		if (history.date !== date || !Array.isArray(history.records)) throw new Error(`Invalid history file: ${historyPath}`);
		const races = history.records.map(buildRace);
		const dateSummary = emptySummary();
		for (const race of races) {
			addSummary(dateSummary, race);
			for (const reason of race.skippedReasons) skippedReasons[reason] = (skippedReasons[reason] ?? 0) + 1;
		}
		const shardPath = `public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`;
		const shard = { schemaVersion: "boat-ex-structured-tickets-v1", kind: "boatrace-ex-structured-tickets-date", generatedAt, date, summary: { date, ...dateSummary, readiness: readiness(dateSummary) }, races, sourceFiles: [historyPath] };
		writeJson(shardPath, shard, args.dryRun);
		dates.push({ date, path: shardPath, ...dateSummary, readiness: shard.summary.readiness });
		for (const [key, value] of Object.entries(dateSummary)) totals[key] += value;
	}
	const summary = {
		schemaVersion: "boat-ex-structured-tickets-v1",
		kind: "boatrace-ex-structured-tickets-history-summary",
		generatedAt,
		periodStart: dates[0]?.date ?? null,
		periodEnd: index.latestDate,
		dateCount: dates.length,
		historyRaceCount: totals.raceCount,
		...totals,
		readiness: readiness(totals),
		parserVersion: PARSER_VERSION,
		parserRules: PARSER_RULES,
		skippedReasons,
		sourcePaths: [DATE_INDEX_PATH],
		auditPaths: [`public/data/boatrace-ex/audit/structured-tickets-evaluation-${index.latestDate}.generated.json`],
	};
	const historyIndex = { schemaVersion: "boat-ex-structured-tickets-v1", kind: "boatrace-ex-structured-tickets-history-index", generatedAt, latestDate: index.latestDate, dateCount: dates.length, dates, sourceFiles: [DATE_INDEX_PATH, SUMMARY_PATH] };
	const auditPath = `public/data/boatrace-ex/audit/structured-tickets-evaluation-${index.latestDate}.generated.json`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-structured-tickets-evaluation-audit",
		auditDate: index.latestDate,
		generatedAt,
		summary,
		regression: {
			raceKey: "2026-05-31:08:04",
			expectedGroupCounts: { "\u539a\u3081": 2, "\u672c\u7dda": 6, "\u5927\u7a74": 2 },
		},
		policy: "Only strict source-text tickets are extracted. Evaluation uses exact ordered official finish order. No score, rank, recommendation, guessed ticket, partial match, or payout inference is generated.",
		sourcePaths: [DATE_INDEX_PATH, ...dates.map((entry) => `public/data/boatrace-ex/history/races/${entry.date}.json`)],
	};
	const manifest = mergeManifest([
		{ path: SUMMARY_PATH, kind: summary.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: summary.readiness.status, recordCount: summary.historyRaceCount },
		{ path: HISTORY_INDEX_PATH, kind: historyIndex.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: summary.readiness.status, recordCount: dates.length },
	], generatedAt);
	writeJson(SUMMARY_PATH, summary, args.dryRun);
	writeJson(HISTORY_INDEX_PATH, historyIndex, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, dateCount: summary.dateCount, historyRaceCount: summary.historyRaceCount, predictionTextAvailableRaceCount: summary.predictionTextAvailableRaceCount, structuredTicketAvailableRaceCount: summary.structuredTicketAvailableRaceCount, structuredTicketCount: summary.structuredTicketCount, classifiedTicketCount: summary.classifiedTicketCount, unclassifiedTicketCount: summary.unclassifiedTicketCount, evaluatedPredictionRaceCount: summary.evaluatedPredictionRaceCount, hitRaceCount: summary.hitRaceCount, missRaceCount: summary.missRaceCount, payoutLinkedHitCount: summary.payoutLinkedHitCount, totalSourceBackedPayoutYen: summary.totalSourceBackedPayoutYen, readiness: summary.readiness.status }, null, 2));
}

main();
