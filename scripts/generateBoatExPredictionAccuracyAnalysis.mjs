import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	ACCURACY_SCHEMA_VERSION,
	PRIMARY_ERROR_TYPES,
	addRaceToAccuracyMetric,
	analyzePredictionAccuracyRace,
	buildExactClassEvidenceMap,
	buildOpponentMatrix,
	createAccuracyMetric,
	distribution,
	finalizeAccuracyMetric,
	resolveExactRaceClasses,
} from "./boatExPredictionAccuracyAnalysis.mjs";
import {
	ANALYSIS_CATEGORIES,
	SAMPLE_THRESHOLDS,
	buildAnalysisRaceKey,
	resolveEvaluationEligibility,
} from "./boatExPredictionStructureAnalysis.mjs";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..");
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const V2_SUMMARY_PATH = "public/data/boatrace-ex/derived/prediction-structure-analysis/history-summary.json";
const OUTPUT_DIR = "public/data/boatrace-ex/derived/prediction-accuracy-analysis";
const HISTORY_SUMMARY_PATH = `${OUTPUT_DIR}/history-summary.json`;
const LATEST_PATH = `${OUTPUT_DIR}/latest.json`;
const RACE_DETAILS_PATH = `${OUTPUT_DIR}/race-details.json`;
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";

const absolute = (relativePath) => path.join(repoRoot, ...relativePath.split("/"));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const readJsonIfExists = (relativePath) => fs.existsSync(absolute(relativePath)) ? readJson(relativePath) : null;
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
	"actualWinningLane",
	"firstPlacePredictedLane",
	"windSpeedBucket",
	"waveHeightBucket",
	"lane1Class",
	"classComposition",
	"category",
];

function metricCell(map, id, label, metadata = {}) {
	if (!map.has(id)) map.set(id, createAccuracyMetric(id, label, metadata));
	return map.get(id);
}

function addMetric(map, id, label, metadata, raceAnalysis, tickets) {
	if (!id || !tickets.length) return;
	addRaceToAccuracyMetric(metricCell(map, id, label, metadata), raceAnalysis, tickets);
}

function sortEntries(entries) {
	return entries.sort((left, right) => {
		const leftNumber = Number(left.id);
		const rightNumber = Number(right.id);
		if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
		return String(left.label).localeCompare(String(right.label), "ja");
	});
}

function errorTypeCrosses(entries) {
	return entries.flatMap((entry) => PRIMARY_ERROR_TYPES.map((errorType) => ({
		id: `${entry.id}|${errorType}`,
		conditionId: entry.id,
		conditionLabel: entry.label,
		errorType,
		raceCount: entry[errorType],
		rate: entry.hitRatePopulationRaceCount > 0 ? Number((entry[errorType] / entry.hitRatePopulationRaceCount).toFixed(4)) : null,
	})));
}

function countBy(races, keyOf, labelOf = keyOf) {
	const cells = new Map();
	for (const race of races) {
		const key = keyOf(race);
		if (key === null || key === undefined || key === "") continue;
		if (!cells.has(String(key))) cells.set(String(key), { id: String(key), label: String(labelOf(race)), raceCount: 0 });
		cells.get(String(key)).raceCount += 1;
	}
	return sortEntries([...cells.values()]);
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
	const index = readJson(INDEX_PATH);
	const v2 = readJson(V2_SUMMARY_PATH);
	const maps = Object.fromEntries(dimensionNames.map((name) => [name, new Map()]));
	const overall = createAccuracyMetric("all", "全評価対象");
	const raceAnalyses = [];
	const seenRaceKeys = new Set();
	let duplicateRaceKeyCount = 0;
	let duplicateTicketCount = 0;
	let candidateEvaluatedRaceCount = 0;
	let unknownRaceCount = 0;
	let futureLeakageRaceCount = 0;
	let classEvidenceRowCount = 0;
	let classEvidenceConflictCount = 0;
	let lane1ClassBefore = 0;
	let lane1ClassAfter = 0;
	let classCompositionBefore = 0;
	let classCompositionAfter = 0;
	let metadataStakeCandidateRaceCount = 0;
	let safeStakeRaceCount = 0;
	let metadataOnlyRejectedRaceCount = 0;
	const stakeMethodCounts = {};

	for (const date of index.availableDates ?? []) {
		const structured = readJson(`public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`);
		const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
		const historyByKey = new Map((history.records ?? []).map((record) => [buildAnalysisRaceKey(record), record]));
		const evidence = readJsonIfExists(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`);
		const classEvidence = buildExactClassEvidenceMap(evidence);
		classEvidenceRowCount += classEvidence.evidenceRowCount;
		classEvidenceConflictCount += classEvidence.conflictCount;

		for (const race of structured.races ?? []) {
			const raceKey = buildAnalysisRaceKey(race);
			if (seenRaceKeys.has(raceKey)) {
				duplicateRaceKeyCount += 1;
				continue;
			}
			seenRaceKeys.add(raceKey);
			const tickets = race.structuredTickets ?? [];
			const ticketKeys = tickets.map((ticket) => `${ticket.group}:${ticket.boatNumbers.join("-")}`);
			duplicateTicketCount += ticketKeys.length - new Set(ticketKeys).size;
			if (race.evaluation?.evaluationStatus !== "evaluated") continue;
			candidateEvaluatedRaceCount += 1;
			const historyRecord = historyByKey.get(raceKey);
			if (!historyRecord) throw new Error(`history race is missing for ${raceKey}`);
			const eligibility = resolveEvaluationEligibility(historyRecord);
			if (eligibility.status !== "eligible") {
				unknownRaceCount += Number(eligibility.status === "unknown");
				futureLeakageRaceCount += Number(eligibility.status === "future-leakage");
				continue;
			}

			const analysis = analyzePredictionAccuracyRace({ race, historyRecord, classEvidenceMap: classEvidence.map });
			raceAnalyses.push(analysis);
			const classes = resolveExactRaceClasses(historyRecord, classEvidence.map);
			lane1ClassBefore += Number(Boolean(classes.beforeLane1Class));
			lane1ClassAfter += Number(Boolean(classes.afterLane1Class));
			classCompositionBefore += Number(Boolean(classes.beforeClassComposition));
			classCompositionAfter += Number(Boolean(classes.afterClassComposition));
			metadataStakeCandidateRaceCount += Number(analysis.stakeEvidence.metadataCandidate);
			if (analysis.stakeEvidence.status === "source-backed") {
				safeStakeRaceCount += 1;
				stakeMethodCounts[analysis.stakeEvidence.method] = (stakeMethodCounts[analysis.stakeEvidence.method] ?? 0) + 1;
			} else if (analysis.stakeEvidence.method === "metadata-only") metadataOnlyRejectedRaceCount += 1;

			addRaceToAccuracyMetric(overall, analysis, tickets);
			addMetric(maps.venue, race.venueCode, race.venueName, { venueCode: race.venueCode, venueName: race.venueName }, analysis, tickets);
			addMetric(maps.raceNo, String(race.raceNo), `${race.raceNo}R`, { raceNo: Number(race.raceNo) }, analysis, tickets);
			addMetric(maps.raceNoGroup, analysis.raceNoGroup, analysis.raceNoGroup, { raceNoGroup: analysis.raceNoGroup }, analysis, tickets);
			addMetric(maps.actualWinningLane, String(analysis.actualWinner), `${analysis.actualWinner}号艇`, { lane: analysis.actualWinner }, analysis, tickets);
			for (const lane of analysis.predictedWinnerCandidates) {
				const laneTickets = tickets.filter((ticket) => Number(ticket.boatNumbers?.[0]) === lane);
				addMetric(maps.firstPlacePredictedLane, String(lane), `${lane}号艇`, { lane }, analysis, laneTickets);
			}
			addMetric(maps.windSpeedBucket, analysis.conditions.windSpeedBucket, analysis.conditions.windSpeedBucket, { windSpeedBucket: analysis.conditions.windSpeedBucket }, analysis, tickets);
			addMetric(maps.waveHeightBucket, analysis.conditions.waveHeightBucket, analysis.conditions.waveHeightBucket, { waveHeightBucket: analysis.conditions.waveHeightBucket }, analysis, tickets);
			addMetric(maps.lane1Class, analysis.conditions.lane1Class, analysis.conditions.lane1Class, { lane1Class: analysis.conditions.lane1Class }, analysis, tickets);
			addMetric(maps.classComposition, analysis.conditions.classComposition, analysis.conditions.classComposition, { classComposition: analysis.conditions.classComposition }, analysis, tickets);
			for (const category of ANALYSIS_CATEGORIES) {
				const categoryTickets = tickets.filter((ticket) => ticket.group === category);
				addMetric(maps.category, category, category, { category }, analysis, categoryTickets);
			}
		}
	}

	if (duplicateRaceKeyCount || duplicateTicketCount) throw new Error(`duplicate source identity detected: races=${duplicateRaceKeyCount}, tickets=${duplicateTicketCount}`);
	const dimensions = Object.fromEntries(dimensionNames.map((name) => [name, sortEntries([...maps[name].values()].map(finalizeAccuracyMetric))]));
	const overallMetrics = finalizeAccuracyMetric(overall);
	const winnerCoveredRaces = raceAnalyses.filter((race) => race.winnerCovered);
	const opponentCoverage = {
		winnerCoveredRaceCount: winnerCoveredRaces.length,
		secondCoveredCount: winnerCoveredRaces.filter((race) => race.secondCovered).length,
		thirdCoveredCount: winnerCoveredRaces.filter((race) => race.thirdCovered).length,
		secondPositionCoveredCount: winnerCoveredRaces.filter((race) => race.secondPositionCovered).length,
		thirdPositionCoveredCount: winnerCoveredRaces.filter((race) => race.thirdPositionCovered).length,
		secondOnlyMissingCount: winnerCoveredRaces.filter((race) => race.secondOnlyMissing).length,
		thirdOnlyMissingCount: winnerCoveredRaces.filter((race) => race.thirdOnlyMissing).length,
		bothOpponentMissingCount: winnerCoveredRaces.filter((race) => race.bothOpponentMissing).length,
		bothOpponentsCoveredCount: winnerCoveredRaces.filter((race) => race.secondCovered && race.thirdCovered).length,
		secondThirdSwapCount: winnerCoveredRaces.filter((race) => race.secondThirdSwap).length,
	};
	for (const key of Object.keys(opponentCoverage).filter((key) => key.endsWith("Count") && key !== "winnerCoveredRaceCount")) {
		opponentCoverage[key.replace(/Count$/u, "Rate")] = winnerCoveredRaces.length > 0
			? Number((opponentCoverage[key] / winnerCoveredRaces.length).toFixed(4))
			: null;
	}
	const opponentMatrix = {
		second: buildOpponentMatrix(raceAnalyses, "second"),
		third: buildOpponentMatrix(raceAnalyses, "third"),
	};
	const missDistance = distribution(raceAnalyses.map((race) => race.missDistance));
	const ticketStructure = {
		uniqueWinnerCountDistribution: distribution(raceAnalyses.map((race) => race.uniqueWinnerCount)),
		uniqueSecondCandidateCountDistribution: distribution(raceAnalyses.map((race) => race.uniqueSecondCandidateCount)),
		uniqueThirdCandidateCountDistribution: distribution(raceAnalyses.map((race) => race.uniqueThirdCandidateCount)),
		reversedSecondThirdPairRaceCount: raceAnalyses.filter((race) => race.reversedSecondThirdPairCount > 0).length,
		reversedSecondThirdPairCount: raceAnalyses.reduce((sum, race) => sum + race.reversedSecondThirdPairCount, 0),
	};
	const swapRaces = raceAnalyses.filter((race) => race.secondThirdSwap);
	const swapAnalysis = {
		raceCount: swapRaces.length,
		oneDirectionOnlyCount: swapRaces.length,
		reverseAlsoPresentCount: 0,
		venue: countBy(swapRaces, (race) => race.venueCode, (race) => race.venueName),
		winningLane: countBy(swapRaces, (race) => race.actualWinner, (race) => `${race.actualWinner}号艇`),
		actualSecondLane: countBy(swapRaces, (race) => race.actualSecond, (race) => `${race.actualSecond}号艇`),
		actualThirdLane: countBy(swapRaces, (race) => race.actualThird, (race) => `${race.actualThird}号艇`),
		raceNoGroup: countBy(swapRaces, (race) => race.raceNoGroup),
		windSpeedBucket: countBy(swapRaces, (race) => race.conditions.windSpeedBucket),
		category: countBy(
			swapRaces.flatMap((race) => race.swapCategories.map((swapCategory) => ({ ...race, swapCategory }))),
			(race) => race.swapCategory,
		),
	};
	const errorTypeDimensions = {
		venue: errorTypeCrosses(dimensions.venue),
		winningLane: errorTypeCrosses(dimensions.actualWinningLane),
		raceNoGroup: errorTypeCrosses(dimensions.raceNoGroup),
		category: errorTypeCrosses(dimensions.category),
		windSpeedBucket: errorTypeCrosses(dimensions.windSpeedBucket),
	};
	const stakeAudit = {
		candidateEvaluatedRaceCount: raceAnalyses.length,
		metadataCandidateRaceCount: metadataStakeCandidateRaceCount,
		safeSourceBackedRaceCount: safeStakeRaceCount,
		metadataOnlyRejectedRaceCount,
		unresolvedRaceCount: raceAnalyses.length - safeStakeRaceCount,
		investmentCoverageRate: raceAnalyses.length > 0 ? Number((safeStakeRaceCount / raceAnalyses.length).toFixed(4)) : null,
		methodCounts: stakeMethodCounts,
		policy: "purchasePoints and investmentYen are not sufficient alone; an explicit per-ticket amount or equal-allocation statement is required.",
	};
	const classCoverageAudit = {
		populationRaceCount: raceAnalyses.length,
		exactEvidenceRowCount: classEvidenceRowCount,
		evidenceConflictCount: classEvidenceConflictCount,
		lane1Class: { before: lane1ClassBefore, after: lane1ClassAfter, safeBackfillCount: lane1ClassAfter - lane1ClassBefore, missingAfter: raceAnalyses.length - lane1ClassAfter },
		classComposition: { before: classCompositionBefore, after: classCompositionAfter, safeBackfillCount: classCompositionAfter - classCompositionBefore, missingAfter: raceAnalyses.length - classCompositionAfter },
		policy: "Only history race className or exact raceKey + frameNo racer-evidence is accepted; names are never matched.",
	};
	const primaryErrorCount = PRIMARY_ERROR_TYPES.reduce((sum, key) => sum + overallMetrics[key], 0);
	const payload = {
		schemaVersion: ACCURACY_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-accuracy-analysis-history-summary",
		generatedAt,
		period: v2.period,
		evaluationEligibility: { candidateEvaluatedRaceCount, eligibleRaceCount: raceAnalyses.length, unknownRaceCount, futureLeakageRaceCount },
		overall: overallMetrics,
		opponentCoverage,
		opponentMatrix,
		missDistance,
		ticketStructure,
		swapAnalysis,
		dimensions,
		errorTypeDimensions,
		stakeAudit,
		classCoverageAudit,
		samplePolicy: { basis: "hitRatePopulationRaceCount", thresholds: SAMPLE_THRESHOLDS },
		invariants: {
			duplicateRaceKeyCount,
			duplicateTicketCount,
			primaryErrorPartitionCount: primaryErrorCount,
			missDistancePartitionCount: missDistance.reduce((sum, entry) => sum + entry.raceCount, 0),
			opponentSecondMatrixSampleCount: opponentMatrix.second.reduce((sum, entry) => sum + entry.sampleCount, 0),
			opponentThirdMatrixSampleCount: opponentMatrix.third.reduce((sum, entry) => sum + entry.sampleCount, 0),
			hitRatePopulationRaceCount: overallMetrics.hitRatePopulationRaceCount,
			roiPopulationRaceCount: overallMetrics.roiPopulationRaceCount,
		},
		policies: [
			"Only leakage-safe exact-order trifecta evaluations are analyzed.",
			"Hit-rate and ROI populations are separate; ROI requires explicit source-backed stake evidence and a same-race official payout.",
			"Miss distance is an ordinal classification only and is not a performance score.",
			"Class backfill requires exact raceKey and frameNo evidence; name matching and fuzzy matching are prohibited.",
		],
		sourceFiles: [INDEX_PATH, V2_SUMMARY_PATH, "public/data/boatrace-ex/derived/prediction-structure/dates/*.json", "public/data/boatrace-ex/history/races/*.json", "public/data/boatrace-ex/derived/racer-evidence/*.json"],
	};
	const latest = { ...payload, kind: "boatrace-ex-prediction-accuracy-analysis-latest" };
	const raceDetails = {
		schemaVersion: ACCURACY_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-accuracy-analysis-race-details",
		generatedAt,
		period: v2.period,
		raceCount: raceAnalyses.length,
		races: raceAnalyses,
	};
	const auditPath = `public/data/boatrace-ex/audit/prediction-accuracy-analysis-${index.latestDate}.generated.json`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-prediction-accuracy-analysis-audit",
		generatedAt,
		auditDate: index.latestDate,
		evaluationEligibility: payload.evaluationEligibility,
		stakeAudit,
		classCoverageAudit,
		invariants: payload.invariants,
	};
	const manifest = mergeManifest([
		{ path: HISTORY_SUMMARY_PATH, kind: payload.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: raceAnalyses.length },
		{ path: LATEST_PATH, kind: latest.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: raceAnalyses.length },
		{ path: RACE_DETAILS_PATH, kind: raceDetails.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: raceAnalyses.length },
		{ path: auditPath, kind: audit.kind, date: index.latestDate, generatedAt, sourceStatus: "available", coverageStatus: "available", recordCount: raceAnalyses.length },
	], generatedAt);

	writeJson(HISTORY_SUMMARY_PATH, payload, args.dryRun);
	writeJson(LATEST_PATH, latest, args.dryRun);
	writeJson(RACE_DETAILS_PATH, raceDetails, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({
		ok: true,
		period: payload.period,
		evaluationEligibility: payload.evaluationEligibility,
		overall: overallMetrics,
		opponentCoverage,
		missDistance,
		ticketStructure,
		stakeAudit,
		classCoverageAudit,
		dimensionCounts: Object.fromEntries(Object.entries(dimensions).map(([key, entries]) => [key, entries.length])),
	}, null, 2));
}

main();
