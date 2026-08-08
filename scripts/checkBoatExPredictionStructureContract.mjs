import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const OUTPUT_PATH = "public/data/boatrace-ex/derived/prediction-structure/latest.json";
const TODAY_FLOW_PATH = "public/data/boatrace-ex/derived/today-flow/latest.json";
const ROUGH_INDEX_PATH = "public/data/boatrace-ex/derived/rough-index/latest.json";
const AUDIT_DIRECTORY = "public/data/boatrace-ex/audit";
const MIN_PREDICTION_TEXT_RACE_COUNT = 30;
const MIN_STRUCTURED_TICKET_RACE_COUNT = 30;
const MIN_EVALUATED_PREDICTION_RACE_COUNT = 30;

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function assert(condition, message, errors) {
	if (!condition) errors.push(message);
}

function hasObject(value) {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasResult(record) {
	const order = record?.officialResult?.finishOrder;
	return Array.isArray(order)
		&& order.length >= 3
		&& order.slice(0, 3).every((value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 6);
}

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").replace(/[,\s円¥￥]/g, "");
	if (!/^\d+$/u.test(normalized)) return null;
	const amount = Number(normalized);
	return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function hasTrifectaPayout(record) {
	for (const payout of Array.isArray(record?.officialResult?.payout) ? record.officialResult.payout : []) {
		const type = [payout?.betType, payout?.type, payout?.name].filter((value) => typeof value === "string").join(" ").normalize("NFKC").toLowerCase();
		if (!type.includes("3連単") && !type.includes("三連単") && !type.includes("trifecta")) continue;
		if ([payout?.payoutYen, payout?.amount, payout?.payoutAmount, payout?.payout, payout?.yen].some((value) => parseYen(value) !== null)) return true;
	}
	return false;
}

function hasSourceBackedPredictionText(record) {
	const prediction = record?.prediction;
	return hasObject(prediction) && prediction.sourceStatus === "available" && typeof prediction.textExcerpt === "string" && prediction.textExcerpt.trim().length > 0;
}

function hasStructuredTickets(record) {
	return [record?.tickets, record?.ticketGroups, record?.bets, record?.recommendedTickets, record?.buyTickets, record?.prediction?.tickets, record?.prediction?.ticketGroups, record?.prediction?.bets, record?.prediction?.recommendedTickets, record?.prediction?.buyTickets]
		.some((value) => Array.isArray(value) && value.length > 0);
}

function emptySummary() {
	return {
		raceCount: 0,
		resultAvailableRaceCount: 0,
		payoutAvailableRaceCount: 0,
		predictionTextAvailableRaceCount: 0,
		structuredTicketAvailableRaceCount: 0,
		evaluatedPredictionRaceCount: 0,
	};
}

function collect(records) {
	const summary = emptySummary();
	for (const record of records) {
		const resultAvailable = hasResult(record);
		const payoutAvailable = hasTrifectaPayout(record);
		const predictionTextAvailable = hasSourceBackedPredictionText(record);
		const structuredTicketAvailable = hasStructuredTickets(record);
		summary.raceCount += 1;
		summary.resultAvailableRaceCount += resultAvailable ? 1 : 0;
		summary.payoutAvailableRaceCount += payoutAvailable ? 1 : 0;
		summary.predictionTextAvailableRaceCount += predictionTextAvailable ? 1 : 0;
		summary.structuredTicketAvailableRaceCount += structuredTicketAvailable ? 1 : 0;
		summary.evaluatedPredictionRaceCount += structuredTicketAvailable && resultAvailable && payoutAvailable ? 1 : 0;
	}
	return summary;
}

function expectedReadiness(summary) {
	return summary.predictionTextAvailableRaceCount >= MIN_PREDICTION_TEXT_RACE_COUNT
		&& summary.structuredTicketAvailableRaceCount >= MIN_STRUCTURED_TICKET_RACE_COUNT
		&& summary.evaluatedPredictionRaceCount >= MIN_EVALUATED_PREDICTION_RACE_COUNT
		? "ready"
		: "insufficient-history";
}

function main() {
	const errors = [];
	const index = readJson(DATE_INDEX_PATH);
	const dates = [...new Set(index.availableDates ?? [])].sort();
	const targetDate = index.latestDate;
	const auditPath = `${AUDIT_DIRECTORY}/prediction-structure-contract-${targetDate}.generated.json`;
	const output = readJson(OUTPUT_PATH);
	const audit = readJson(auditPath);
	const todayFlow = readJson(TODAY_FLOW_PATH);
	const roughIndex = readJson(ROUGH_INDEX_PATH);
	const targetHistory = readJson(`public/data/boatrace-ex/history/races/${targetDate}.json`);
	const targetSummary = collect(targetHistory.records ?? []);
	const historySummary = emptySummary();

	for (const date of dates) {
		const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
		const summary = collect(history.records ?? []);
		for (const [key, value] of Object.entries(summary)) historySummary[key] += value;
	}

	assert(audit.kind === "boatrace-ex-prediction-structure-contract-audit", "audit kind is invalid", errors);
	assert(audit.auditDate === targetDate, "auditDate must match date index latestDate", errors);
	assert(audit.contract?.predictionText === "prediction.textExcerpt with prediction.sourceStatus === available", "audit prediction text contract is invalid", errors);
	assert(Array.isArray(audit.contract?.structuredTicketPaths) && audit.contract.structuredTicketPaths.length > 0, "audit structured ticket paths are required", errors);
	assert(audit.contract?.resultPath === "officialResult.finishOrder", "audit result contract is invalid", errors);
	assert(audit.contract?.payoutPath === "officialResult.payout[]", "audit payout contract is invalid", errors);
	for (const [key, value] of Object.entries(targetSummary)) assert(output.summary?.[key] === value, `prediction structure target summary.${key} must match target history`, errors);
	assert(output.readiness?.status === expectedReadiness(targetSummary), "prediction structure readiness must follow the target source-backed contract", errors);
	assert(output.readiness?.status === audit.targetDate?.readiness?.status, "audit target readiness must match prediction structure", errors);
	for (const [key, value] of Object.entries(historySummary)) assert(audit.historyCoverage?.summary?.[key] === value, `audit historyCoverage.summary.${key} must match all history`, errors);
	assert(audit.historyCoverage?.dateCount === dates.length, "audit history coverage dateCount must match date index", errors);
	assert(todayFlow.targetDate === targetDate, "todayFlow targetDate must match prediction structure targetDate", errors);
	assert(todayFlow.summary?.resultAvailableRaceCount === targetSummary.resultAvailableRaceCount, "todayFlow result availability must match target history", errors);
	assert(todayFlow.summary?.payoutAvailableRaceCount === targetSummary.payoutAvailableRaceCount, "todayFlow payout availability must match target history", errors);
	assert(roughIndex.summary?.resultAvailableRaceCount >= targetSummary.resultAvailableRaceCount, "rough index history result coverage must include target result coverage", errors);
	assert(roughIndex.summary?.payoutAvailableRaceCount >= targetSummary.payoutAvailableRaceCount, "rough index history payout coverage must include target payout coverage", errors);
	if (errors.length > 0) throw new Error(errors.join("\n"));

	console.log(JSON.stringify({
		ok: true,
		auditPath,
		targetDate,
		targetSummary,
		historyCoverage: { dateCount: dates.length, ...historySummary },
		readiness: output.readiness.status,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
