import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	STRATEGY_CONFIG,
	STRATEGY_IDS,
	STRATEGY_SCHEMA_VERSION,
	addEvaluation,
	buildCounterfactualTickets,
	buildStrategyPreRaceFeatures,
	buildStrategyTrainingModel,
	createComparisonMetric,
	evaluateTicketSet,
	finalizeComparisonMetric,
	ticketKey,
} from "./boatExPredictionStrategyAnalysis.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const ACCURACY_DETAILS_PATH = "public/data/boatrace-ex/derived/prediction-accuracy-analysis/race-details.json";
const OUTPUT_DIR = "public/data/boatrace-ex/derived/prediction-strategy-analysis";
const SUMMARY_PATH = `${OUTPUT_DIR}/history-summary.json`;
const LATEST_PATH = `${OUTPUT_DIR}/latest.json`;
const DETAILS_PATH = `${OUTPUT_DIR}/race-details.json`;
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

const dateValue = (date) => Date.parse(`${date}T00:00:00Z`);
const dateString = (value) => new Date(value).toISOString().slice(0, 10);
const addDays = (date, days) => dateString(dateValue(date) + days * 86400000);

function createFolds(period, records) {
	const firstValidationDate = addDays(period.from, 38);
	const folds = [];
	let from = firstValidationDate;
	let index = 1;
	while (from <= period.to) {
		const to = [addDays(from, 6), period.to].sort()[0];
		const training = records.filter((record) => record.date < from);
		const validation = records.filter((record) => record.date >= from && record.date <= to);
		if (validation.length) {
			folds.push({ id: `fold-${String(index).padStart(2, "0")}`, trainingFrom: period.from, trainingTo: addDays(from, -1), validationFrom: from, validationTo: to, training, validation });
			index += 1;
		}
		from = addDays(to, 1);
	}
	return folds;
}

function countPattern(map, tickets) {
	for (const ticket of tickets) {
		const key = ticketKey(ticket);
		map.set(key, (map.get(key) ?? 0) + 1);
	}
}

function topPatterns(map) {
	return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([ticket, count]) => ({ ticket, count }));
}

function emptyAggregate(strategyId) {
	return {
		strategyId,
		label: STRATEGY_CONFIG[strategyId].label,
		baseline: createComparisonMetric(),
		strategy: createComparisonMetric(),
		changedRaceCount: 0,
		improvedRaceCount: 0,
		degradedRaceCount: 0,
		unchangedRaceCount: 0,
		insufficientTrainingBaselineRaceCount: 0,
		nonTenTicketBaselineRaceCount: 0,
		addedPatterns: new Map(),
		removedPatterns: new Map(),
		folds: [],
	};
}

function mergeMetric(target, source) {
	for (const key of Object.keys(target)) target[key] += Number(source[key] ?? 0);
}

function finalizeAggregate(value) {
	const baseline = finalizeComparisonMetric(value.baseline);
	const strategy = finalizeComparisonMetric(value.strategy);
	return {
		strategyId: value.strategyId,
		label: value.label,
		validationRaceCount: baseline.raceCount,
		changedRaceCount: value.changedRaceCount,
		baseline,
		strategy,
		netExactHitGain: strategy.exactHit - baseline.exactHit,
		exactHitRateDelta: strategy.exactHitRate === null || baseline.exactHitRate === null ? null : Number((strategy.exactHitRate - baseline.exactHitRate).toFixed(4)),
		improvedRaceCount: value.improvedRaceCount,
		degradedRaceCount: value.degradedRaceCount,
		unchangedRaceCount: value.unchangedRaceCount,
		insufficientTrainingBaselineRaceCount: value.insufficientTrainingBaselineRaceCount,
		nonTenTicketBaselineRaceCount: value.nonTenTicketBaselineRaceCount,
		topAddedTicketPatterns: topPatterns(value.addedPatterns),
		topRemovedTicketPatterns: topPatterns(value.removedPatterns),
		folds: value.folds,
	};
}

function simulate(records, strategyId, model, trainingWindow, foldId, collectDetails) {
	const baselineMetric = createComparisonMetric();
	const strategyMetric = createComparisonMetric();
	let changedRaceCount = 0;
	let improvedRaceCount = 0;
	let degradedRaceCount = 0;
	let unchangedRaceCount = 0;
	let insufficientTrainingBaselineRaceCount = 0;
	let nonTenTicketBaselineRaceCount = 0;
	const addedPatterns = new Map();
	const removedPatterns = new Map();
	const details = [];
	for (const record of records) {
		const baselineKeysBefore = record.baselineTickets.map(ticketKey);
		const built = buildCounterfactualTickets({ strategyId, baselineTickets: record.baselineTickets, preRaceFeatures: record.preRaceFeatures, trainingModel: model, trainingWindow });
		if (baselineKeysBefore.join("|") !== record.baselineTickets.map(ticketKey).join("|")) throw new Error(`baseline mutated: ${record.raceKey}`);
		const baselineEvaluation = evaluateTicketSet(record.baselineTickets, record.actualResult);
		const strategyEvaluation = evaluateTicketSet(built.strategyTickets, record.actualResult);
		addEvaluation(baselineMetric, baselineEvaluation);
		addEvaluation(strategyMetric, strategyEvaluation);
		changedRaceCount += Number(built.changed);
		insufficientTrainingBaselineRaceCount += Number(built.insufficientTraining);
		nonTenTicketBaselineRaceCount += Number(built.reason === "baseline-ticket-count-not-ten");
		if (!baselineEvaluation.exactHit && strategyEvaluation.exactHit) improvedRaceCount += 1;
		else if (baselineEvaluation.exactHit && !strategyEvaluation.exactHit) degradedRaceCount += 1;
		else unchangedRaceCount += 1;
		countPattern(addedPatterns, built.addedTickets);
		countPattern(removedPatterns, built.removedTickets);
		if (collectDetails && built.changed) {
			details.push({
				foldId,
				strategyId,
				raceKey: record.raceKey,
				date: record.date,
				baselineTickets: record.baselineTickets.map(ticketKey),
				strategyTickets: built.strategyTickets.map(ticketKey),
				addedTickets: built.addedTickets.map(ticketKey),
				removedTickets: built.removedTickets.map(ticketKey),
				strategyReason: built.reason,
				trainingFrom: trainingWindow.from,
				trainingTo: trainingWindow.to,
				trainingSampleCount: built.trainingSampleCount,
				conditionKey: built.conditionKey,
				preRaceFeatures: record.preRaceFeatures,
				actualResult: record.actualResult,
				baselineHit: baselineEvaluation.exactHit,
				strategyHit: strategyEvaluation.exactHit,
			});
		}
	}
	return { baselineMetric, strategyMetric, changedRaceCount, improvedRaceCount, degradedRaceCount, unchangedRaceCount, insufficientTrainingBaselineRaceCount, nonTenTicketBaselineRaceCount, addedPatterns, removedPatterns, details };
}

function mergeManifest(entries, generatedAt) {
	const existing = readJson(MANIFEST_PATH);
	const paths = new Set(entries.map((entry) => entry.path));
	return { ...existing, generatedAt, files: [...(existing.files ?? []).filter((entry) => !paths.has(entry?.path)), ...entries] };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const index = readJson(INDEX_PATH);
	const accuracy = readJson(ACCURACY_DETAILS_PATH);
	const accuracyByKey = new Map(accuracy.races.map((race) => [race.raceKey, race]));
	const records = [];
	for (const date of index.availableDates) {
		const shard = readJson(`public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`);
		for (const race of shard.races ?? []) {
			const raceKey = `${race.date}:${race.venueCode}:${String(Number(race.raceNo)).padStart(2, "0")}`;
			const analysis = accuracyByKey.get(raceKey);
			if (!analysis) continue;
			const baselineTickets = race.structuredTickets ?? [];
			records.push({ ...analysis, baselineTickets, preRaceFeatures: buildStrategyPreRaceFeatures(analysis, baselineTickets) });
		}
	}
	if (records.length !== accuracy.raceCount) throw new Error(`strategy population mismatch: ${records.length}/${accuracy.raceCount}`);
	records.sort((a, b) => a.date.localeCompare(b.date) || a.raceKey.localeCompare(b.raceKey));
	const folds = createFolds(accuracy.period, records);
	const aggregates = Object.fromEntries(STRATEGY_IDS.map((id) => [id, emptyAggregate(id)]));
	const changedRaceDetails = [];
	const foldSummaries = [];

	for (const fold of folds) {
		const trainingWindow = { from: fold.trainingFrom, to: fold.trainingTo };
		const model = buildStrategyTrainingModel(fold.training);
		const strategySummaries = {};
		for (const strategyId of STRATEGY_IDS) {
			const trainResult = simulate(fold.training, strategyId, model, trainingWindow, fold.id, false);
			const validationResult = simulate(fold.validation, strategyId, model, trainingWindow, fold.id, true);
			const aggregate = aggregates[strategyId];
			mergeMetric(aggregate.baseline, validationResult.baselineMetric);
			mergeMetric(aggregate.strategy, validationResult.strategyMetric);
			for (const key of ["changedRaceCount", "improvedRaceCount", "degradedRaceCount", "unchangedRaceCount", "insufficientTrainingBaselineRaceCount", "nonTenTicketBaselineRaceCount"]) aggregate[key] += validationResult[key];
			for (const [key, count] of validationResult.addedPatterns) aggregate.addedPatterns.set(key, (aggregate.addedPatterns.get(key) ?? 0) + count);
			for (const [key, count] of validationResult.removedPatterns) aggregate.removedPatterns.set(key, (aggregate.removedPatterns.get(key) ?? 0) + count);
			changedRaceDetails.push(...validationResult.details);
			const baseline = finalizeComparisonMetric(validationResult.baselineMetric);
			const strategy = finalizeComparisonMetric(validationResult.strategyMetric);
			const summary = {
				train: { baseline: finalizeComparisonMetric(trainResult.baselineMetric), strategy: finalizeComparisonMetric(trainResult.strategyMetric), changedRaceCount: trainResult.changedRaceCount },
				validation: { baseline, strategy, changedRaceCount: validationResult.changedRaceCount, improvedRaceCount: validationResult.improvedRaceCount, degradedRaceCount: validationResult.degradedRaceCount, unchangedRaceCount: validationResult.unchangedRaceCount, netExactHitGain: strategy.exactHit - baseline.exactHit, insufficientTrainingBaselineRaceCount: validationResult.insufficientTrainingBaselineRaceCount },
			};
			aggregate.folds.push({ foldId: fold.id, ...summary.validation });
			strategySummaries[strategyId] = summary;
		}
		foldSummaries.push({ id: fold.id, trainingFrom: fold.trainingFrom, trainingTo: fold.trainingTo, validationFrom: fold.validationFrom, validationTo: fold.validationTo, trainingRaceCount: fold.training.length, validationRaceCount: fold.validation.length, strategies: strategySummaries });
	}

	const fullBaselineMetric = createComparisonMetric();
	for (const record of records) addEvaluation(fullBaselineMetric, evaluateTicketSet(record.baselineTickets, record.actualResult));
	const strategies = Object.fromEntries(STRATEGY_IDS.map((id) => [id, finalizeAggregate(aggregates[id])]));
	const validationRaceCount = folds.reduce((sum, fold) => sum + fold.validation.length, 0);
	const invariantCounts = {
		walkForwardFoldCount: folds.length,
		validationRaceCount,
		changedRaceDetailCount: changedRaceDetails.length,
		futureTrainingViolationCount: foldSummaries.filter((fold) => fold.trainingTo >= fold.validationFrom).length,
		roiSelectionReferenceCount: 0,
	};
	const payload = {
		schemaVersion: STRATEGY_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-strategy-analysis-history-summary",
		generatedAt,
		period: accuracy.period,
		walkForwardPolicy: { type: "expanding-window", initialTrainingFrom: accuracy.period.from, initialTrainingTo: addDays(accuracy.period.from, 37), validationWindowDays: 7, minimumGlobalTrainingRaceCount: 500 },
		baseline: { fullPopulation: finalizeComparisonMetric(fullBaselineMetric), validationPopulation: strategies[STRATEGY_IDS[0]].baseline },
		folds: foldSummaries,
		strategies,
		strategyRules: Object.fromEntries(Object.entries(STRATEGY_CONFIG).map(([id, config]) => [id, { ...config, conditionHierarchy: ["venue+raceNoGroup+predictedWinner+wind+lane1Class", "venue+raceNoGroup+predictedWinner+wind", "raceNoGroup+predictedWinner+wind", "raceNoGroup+predictedWinner"], removalPolicy: "lowest training-only ticket utility, then candidate redundancy", actualResultAvailableToBuilder: false }])),
		categorySemantics: "Categories are overlapping ticket subsets within a race and are never treated as mutually-exclusive race partitions.",
		roiPolicy: "ROI is reference-only and is not used for strategy selection, thresholds, ticket addition, or ticket removal.",
		invariants: invariantCounts,
		sourceFiles: [ACCURACY_DETAILS_PATH, "public/data/boatrace-ex/derived/prediction-structure/dates/*.json"],
	};
	const latest = { ...payload, kind: "boatrace-ex-prediction-strategy-analysis-latest" };
	const detailPayload = { schemaVersion: STRATEGY_SCHEMA_VERSION, kind: "boatrace-ex-prediction-strategy-analysis-race-details", generatedAt, period: accuracy.period, changedRaceCount: changedRaceDetails.length, races: changedRaceDetails };
	const auditPath = `public/data/boatrace-ex/audit/prediction-strategy-analysis-${index.latestDate}.generated.json`;
	const audit = { schemaVersion: 1, kind: "boatrace-ex-prediction-strategy-analysis-audit", generatedAt, auditDate: index.latestDate, walkForwardPolicy: payload.walkForwardPolicy, strategyRules: payload.strategyRules, invariants: invariantCounts };
	const manifest = mergeManifest([
		{ path: SUMMARY_PATH, kind: payload.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: validationRaceCount },
		{ path: LATEST_PATH, kind: latest.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: validationRaceCount },
		{ path: DETAILS_PATH, kind: detailPayload.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: changedRaceDetails.length },
		{ path: auditPath, kind: audit.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: changedRaceDetails.length },
	], generatedAt);
	writeJson(SUMMARY_PATH, payload, args.dryRun);
	writeJson(LATEST_PATH, latest, args.dryRun);
	writeJson(DETAILS_PATH, detailPayload, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, period: payload.period, foldCount: folds.length, validationRaceCount, baseline: payload.baseline, strategies, invariants: invariantCounts }, null, 2));
}

main();
