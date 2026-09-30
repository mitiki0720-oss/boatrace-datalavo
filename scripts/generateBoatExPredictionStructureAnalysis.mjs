import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	ANALYSIS_CATEGORIES,
	ANALYSIS_SCHEMA_VERSION,
	SAMPLE_THRESHOLDS,
	addTicketsToMetric,
	buildAnalysisRaceKey,
	classifyPredictionError,
	createMetricCell,
	finalizeMetricCell,
	missingness,
	raceNoGroup,
	resolveEvaluationEligibility,
	sourceBackedConditions,
} from "./boatExPredictionStructureAnalysis.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const DATE_INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const STRUCTURED_SUMMARY_PATH = "public/data/boatrace-ex/derived/prediction-structure/history-summary.json";
const OUTPUT_DIR = "public/data/boatrace-ex/derived/prediction-structure-analysis";
const HISTORY_SUMMARY_PATH = `${OUTPUT_DIR}/history-summary.json`;
const LATEST_PATH = `${OUTPUT_DIR}/latest.json`;
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

const dimensionNames = [
	"venue",
	"raceNo",
	"raceNoGroup",
	"category",
	"firstPlacePredictedLane",
	"actualWinningLane",
	"weather",
	"windSpeedBucket",
	"waveHeightBucket",
	"classComposition",
	"lane1Class",
	"venueCategory",
	"venueWinningLane",
	"venueWindSpeedBucket",
	"categoryWindSpeedBucket",
	"categoryRaceNoGroup",
];

function cell(map, id, label, metadata = {}) {
	if (!map.has(id)) map.set(id, createMetricCell(id, label, metadata));
	return map.get(id);
}

function add(map, id, label, metadata, context) {
	if (!id) return;
	addTicketsToMetric(cell(map, id, label, metadata), context);
}

function addErrorCount(counts, classification) {
	for (const key of ["exactHit", "winnerCovered", "top2Covered", "thirdMiss", "secondThirdSwap", "winnerMiss", "opponentMiss"]) {
		counts[key] += classification[key] ? 1 : 0;
	}
	counts.primary[classification.primaryType] += 1;
}

function sortDimension(entries) {
	return entries.sort((left, right) => {
		const leftNumber = Number(left.id);
		const rightNumber = Number(right.id);
		if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
		return String(left.label).localeCompare(String(right.label), "ja");
	});
}

function finishDimensions(maps) {
	return Object.fromEntries(dimensionNames.map((name) => [
		name,
		sortDimension([...maps[name].values()].map(finalizeMetricCell)),
	]));
}

function mergeManifest(entries, generatedAt) {
	const existing = readJson(MANIFEST_PATH);
	const paths = new Set(entries.map((entry) => entry.path));
	return {
		...existing,
		generatedAt,
		files: [...(existing.files ?? []).filter((entry) => !paths.has(entry?.path)), ...entries],
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const index = readJson(DATE_INDEX_PATH);
	const structuredSummary = readJson(STRUCTURED_SUMMARY_PATH);
	const maps = Object.fromEntries(dimensionNames.map((name) => [name, new Map()]));
	const overall = createMetricCell("all", "全評価対象");
	const seenRaceKeys = new Set();
	const eligibility = {
		candidateEvaluatedRaceCount: 0,
		eligibleRaceCount: 0,
		unknownRaceCount: 0,
		futureLeakageRaceCount: 0,
		excludedSamples: [],
	};
	const available = { weather: 0, windSpeedBucket: 0, waveHeightBucket: 0, lane1Class: 0, classComposition: 0, raceNo: 0 };
	const errors = {
		evaluatedRaceCount: 0,
		exactHit: 0,
		winnerCovered: 0,
		top2Covered: 0,
		thirdMiss: 0,
		secondThirdSwap: 0,
		winnerMiss: 0,
		opponentMiss: 0,
		primary: { exactHit: 0, winnerMiss: 0, secondThirdSwap: 0, thirdMiss: 0, opponentMiss: 0 },
	};
	let duplicateRaceKeyCount = 0;
	let duplicateTicketCount = 0;

	for (const date of index.availableDates ?? []) {
		const structuredPath = `public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`;
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const structured = readJson(structuredPath);
		const history = readJson(historyPath);
		const historyByKey = new Map((history.records ?? []).map((record) => [buildAnalysisRaceKey(record), record]));

		for (const race of structured.races ?? []) {
			const raceKey = buildAnalysisRaceKey(race);
			if (seenRaceKeys.has(raceKey)) {
				duplicateRaceKeyCount += 1;
				continue;
			}
			seenRaceKeys.add(raceKey);
			const historyRecord = historyByKey.get(raceKey);
			if (!historyRecord) throw new Error(`history race is missing for ${raceKey}`);
			const tickets = race.structuredTickets ?? [];
			const ticketKeys = tickets.map((ticket) => `${ticket.group}:${ticket.boatNumbers.join("-")}`);
			duplicateTicketCount += ticketKeys.length - new Set(ticketKeys).size;
			if (!tickets.length) continue;

			const isCandidate = race.evaluation?.evaluationStatus === "evaluated";
			let evaluationEligibility = { status: "not-evaluated" };
			if (isCandidate) {
				eligibility.candidateEvaluatedRaceCount += 1;
				evaluationEligibility = resolveEvaluationEligibility(historyRecord);
				if (evaluationEligibility.status === "eligible") eligibility.eligibleRaceCount += 1;
				else {
					if (evaluationEligibility.status === "unknown") eligibility.unknownRaceCount += 1;
					if (evaluationEligibility.status === "future-leakage") eligibility.futureLeakageRaceCount += 1;
					if (eligibility.excludedSamples.length < 25) eligibility.excludedSamples.push({ raceKey, ...evaluationEligibility });
				}
			}
			const eligible = isCandidate && evaluationEligibility.status === "eligible";
			const result = race.officialResult?.finishOrder ?? [];
			const payoutYen = race.officialResult?.trifectaPayoutYen ?? null;
			const conditions = sourceBackedConditions(historyRecord);
			const group = raceNoGroup(race.raceNo);
			const baseContext = { tickets, raceKey, result, payoutYen, eligible };

			addTicketsToMetric(overall, baseContext);
			add(maps.venue, race.venueCode, race.venueName, { venueCode: race.venueCode, venueName: race.venueName }, baseContext);
			add(maps.raceNo, String(race.raceNo), `${race.raceNo}R`, { raceNo: race.raceNo }, baseContext);
			add(maps.raceNoGroup, group, group, { raceNoGroup: group }, baseContext);
			for (const category of ANALYSIS_CATEGORIES) {
				const categoryTickets = tickets.filter((ticket) => ticket.group === category);
				if (!categoryTickets.length) continue;
				const categoryContext = { ...baseContext, tickets: categoryTickets };
				add(maps.category, category, category, { category }, categoryContext);
				add(maps.venueCategory, `${race.venueCode}|${category}`, `${race.venueName} × ${category}`, { venueCode: race.venueCode, venueName: race.venueName, category }, categoryContext);
				add(maps.categoryWindSpeedBucket, conditions.windSpeedBucket ? `${category}|${conditions.windSpeedBucket}` : null, `${category} × ${conditions.windSpeedBucket}`, { category, windSpeedBucket: conditions.windSpeedBucket }, categoryContext);
				add(maps.categoryRaceNoGroup, group ? `${category}|${group}` : null, `${category} × ${group}`, { category, raceNoGroup: group }, categoryContext);
			}
			for (let lane = 1; lane <= 6; lane += 1) {
				const laneTickets = tickets.filter((ticket) => Number(ticket.boatNumbers?.[0]) === lane);
				if (laneTickets.length) add(maps.firstPlacePredictedLane, String(lane), `${lane}号艇`, { lane }, { ...baseContext, tickets: laneTickets });
			}
			const winningLane = Number(result[0]);
			if (Number.isInteger(winningLane) && winningLane >= 1 && winningLane <= 6) {
				add(maps.actualWinningLane, String(winningLane), `${winningLane}号艇`, { lane: winningLane }, baseContext);
				add(maps.venueWinningLane, `${race.venueCode}|${winningLane}`, `${race.venueName} × ${winningLane}号艇`, { venueCode: race.venueCode, venueName: race.venueName, winningLane }, baseContext);
			}
			add(maps.weather, conditions.weather, conditions.weather, { weather: conditions.weather }, baseContext);
			add(maps.windSpeedBucket, conditions.windSpeedBucket, conditions.windSpeedBucket, { windSpeedBucket: conditions.windSpeedBucket }, baseContext);
			add(maps.waveHeightBucket, conditions.waveHeightBucket, conditions.waveHeightBucket, { waveHeightBucket: conditions.waveHeightBucket }, baseContext);
			add(maps.classComposition, conditions.classComposition, conditions.classComposition, { classComposition: conditions.classComposition }, baseContext);
			add(maps.lane1Class, conditions.lane1Class, conditions.lane1Class, { lane1Class: conditions.lane1Class }, baseContext);
			add(maps.venueWindSpeedBucket, conditions.windSpeedBucket ? `${race.venueCode}|${conditions.windSpeedBucket}` : null, `${race.venueName} × ${conditions.windSpeedBucket}`, { venueCode: race.venueCode, venueName: race.venueName, windSpeedBucket: conditions.windSpeedBucket }, baseContext);

			if (eligible) {
				available.weather += conditions.weather ? 1 : 0;
				available.windSpeedBucket += conditions.windSpeedBucket ? 1 : 0;
				available.waveHeightBucket += conditions.waveHeightBucket ? 1 : 0;
				available.lane1Class += conditions.lane1Class ? 1 : 0;
				available.classComposition += conditions.classComposition ? 1 : 0;
				available.raceNo += group ? 1 : 0;
				errors.evaluatedRaceCount += 1;
				addErrorCount(errors, classifyPredictionError(tickets, result));
			}
		}
	}

	if (duplicateRaceKeyCount || duplicateTicketCount) throw new Error(`duplicate source identity detected: races=${duplicateRaceKeyCount}, tickets=${duplicateTicketCount}`);
	const dimensions = finishDimensions(maps);
	const overallMetrics = finalizeMetricCell(overall);
	const errorRates = Object.fromEntries(["exactHit", "winnerCovered", "top2Covered", "thirdMiss", "secondThirdSwap", "winnerMiss", "opponentMiss"].map((key) => [
		key,
		errors.evaluatedRaceCount > 0 ? Number((errors[key] / errors.evaluatedRaceCount).toFixed(4)) : null,
	]));
	const errorStructure = { ...errors, rates: errorRates };
	const missing = {
		weather: missingness(eligibility.eligibleRaceCount, available.weather, "Missing, placeholder, or non-source-backed weather values are excluded."),
		windSpeedBucket: missingness(eligibility.eligibleRaceCount, available.windSpeedBucket, "Only source-backed numeric windSpeedMps is bucketed."),
		waveHeightBucket: missingness(eligibility.eligibleRaceCount, available.waveHeightBucket, "Only source-backed numeric waveHeightCm is bucketed."),
		lane1Class: missingness(eligibility.eligibleRaceCount, available.lane1Class, "Only source-backed A1/A2/B1/B2 values for lane 1 are included."),
		classComposition: missingness(eligibility.eligibleRaceCount, available.classComposition, "A complete six-racer A1/A2/B1/B2 composition is required."),
		raceNo: missingness(eligibility.eligibleRaceCount, available.raceNo, "Race numbers outside 1 through 12 are excluded."),
	};
	const samplePolicy = {
		basis: "evaluatedRaceCount",
		thresholds: SAMPLE_THRESHOLDS,
		rationale: "Current history has 4,261 leakage-safe evaluated races; venue samples start at 36 races and primary wind buckets have at least 224 candidate races. Cells below 10 remain insufficient, 10-29 low, 30-99 usable, and 100 or more strong.",
	};
	const sourceTotals = {
		historyRaceCount: structuredSummary.historyRaceCount,
		structuredTicketAvailableRaceCount: structuredSummary.structuredTicketAvailableRaceCount,
		structuredTicketCount: structuredSummary.structuredTicketCount,
		classifiedTicketCount: structuredSummary.classifiedTicketCount,
		unclassifiedTicketCount: structuredSummary.unclassifiedTicketCount,
		evaluatedPredictionRaceCount: structuredSummary.evaluatedPredictionRaceCount,
		hitRaceCount: structuredSummary.hitRaceCount,
		totalSourceBackedInvestmentYen: structuredSummary.totalSourceBackedInvestmentYen,
		totalSourceBackedPayoutYen: structuredSummary.totalSourceBackedPayoutYen,
	};
	const payload = {
		schemaVersion: ANALYSIS_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-structure-analysis-history-summary",
		generatedAt,
		period: { from: index.availableDates?.[0] ?? null, to: index.latestDate, dateCount: index.availableDates?.length ?? 0 },
		sourceTotals,
		evaluationEligibility: eligibility,
		overall: overallMetrics,
		samplePolicy,
		missingness: missing,
		errorStructure,
		dimensions,
		invariants: {
			duplicateRaceKeyCount,
			duplicateTicketCount,
			venueTicketCount: dimensions.venue.reduce((sum, entry) => sum + entry.ticketCount, 0),
			raceNoTicketCount: dimensions.raceNo.reduce((sum, entry) => sum + entry.ticketCount, 0),
			categoryTicketCount: dimensions.category.reduce((sum, entry) => sum + entry.ticketCount, 0),
			primaryErrorClassificationCount: Object.values(errors.primary).reduce((sum, value) => sum + value, 0),
		},
		policies: [
			"Only tickets extracted from source-backed prediction text by the strict parser are analyzed.",
			"A hit requires exact ordered trifecta equality; partial and unordered matches are misses.",
			"Outcome metrics exclude races unless the latest prediction source timestamp is earlier than the earliest result finalization source timestamp.",
			"Unknown and placeholder weather values are excluded rather than inferred.",
		],
		sourceFiles: [DATE_INDEX_PATH, STRUCTURED_SUMMARY_PATH, "public/data/boatrace-ex/derived/prediction-structure/dates/*.json", "public/data/boatrace-ex/history/races/*.json"],
	};
	const latest = { ...payload, kind: "boatrace-ex-prediction-structure-analysis-latest" };
	const auditPath = `public/data/boatrace-ex/audit/prediction-structure-analysis-${index.latestDate}.generated.json`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-prediction-structure-analysis-audit",
		generatedAt,
		auditDate: index.latestDate,
		sourceTotals,
		evaluationEligibility: eligibility,
		missingness: missing,
		errorStructure,
		invariants: payload.invariants,
		samplePolicy,
	};
	const manifest = mergeManifest([
		{ path: HISTORY_SUMMARY_PATH, kind: payload.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: eligibility.eligibleRaceCount },
		{ path: LATEST_PATH, kind: latest.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: eligibility.eligibleRaceCount },
		{ path: auditPath, kind: audit.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: eligibility.eligibleRaceCount },
	], generatedAt);

	writeJson(HISTORY_SUMMARY_PATH, payload, args.dryRun);
	writeJson(LATEST_PATH, latest, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({
		ok: true,
		period: payload.period,
		sourceTotals,
		evaluationEligibility: eligibility,
		overall: overallMetrics,
		missingness: missing,
		errorStructure,
		dimensionCounts: Object.fromEntries(Object.entries(dimensions).map(([key, entries]) => [key, entries.length])),
		samplePolicy,
	}, null, 2));
}

main();
