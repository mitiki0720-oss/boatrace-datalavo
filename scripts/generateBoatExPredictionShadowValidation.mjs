import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	SHADOW_SCHEMA_VERSION,
	SHADOW_START_DATE,
	buildProspectiveShadowRecord,
	buildShadowRaceKey,
	evaluateShadowRecord,
	extractPreRaceFeatureSource,
	resolveRaceStartBoundary,
	summarizeShadowValidation,
} from "./boatExPredictionShadowValidation.mjs";
import { buildStrategyPreRaceFeatures } from "./boatExPredictionStrategyAnalysis.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const OUTPUT_DIR = "public/data/boatrace-ex/derived/prediction-shadow-validation";
const RECORDS_PATH = `${OUTPUT_DIR}/records.generated.json`;
const SUMMARY_PATH = `${OUTPUT_DIR}/history-summary.json`;
const LATEST_PATH = `${OUTPUT_DIR}/latest.json`;
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const TODAY_PATH = "public/data/boatrace/today-race-details.generated.json";
const PREDICTIONS_PATH = "public/data/boatrace/johnson-predictions.generated.json";
const ACCURACY_PATH = "public/data/boatrace-ex/derived/prediction-accuracy-analysis/race-details.json";
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function readJsonIfExists(relativePath) {
	return fs.existsSync(absolute(relativePath)) ? readJson(relativePath) : null;
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeDateArg(value) {
	const text = String(value ?? "").trim();
	if (!text) return "auto";
	if (text === "auto" || text === "latest" || /^\d{4}-\d{2}-\d{2}$/u.test(text)) return text;
	throw new Error("--date requires YYYY-MM-DD, latest, or auto");
}

function parseArgs(argv) {
	const args = { date: "auto", phase: "all", dryRun: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--date") {
			const next = argv[index + 1];
			args.date = normalizeDateArg(next?.startsWith("--") ? undefined : next);
			if (next !== undefined && !next.startsWith("--")) index += 1;
			continue;
		}
		if (arg === "--phase") {
			const next = argv[index + 1];
			if (!next || !["generate", "evaluate", "all"].includes(next)) throw new Error("--phase requires generate, evaluate, or all");
			args.phase = next;
			index += 1;
			continue;
		}
		if (arg === "--dry-run" || arg === "--skip-write") {
			args.dryRun = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function resolveDate(dateArg) {
	if (/^\d{4}-\d{2}-\d{2}$/u.test(dateArg)) return dateArg;
	const today = readJsonIfExists(TODAY_PATH);
	if (dateArg === "auto" && /^\d{4}-\d{2}-\d{2}$/u.test(today?.date ?? "")) return today.date;
	const index = readJson(INDEX_PATH);
	if (!index.latestDate) throw new Error("BOATRACE EX latestDate is missing");
	return index.latestDate;
}

function predictionTimestamp(prediction) {
	return prediction?.sourceRecordSavedAt ?? prediction?.savedAt ?? prediction?.updatedAt ?? "";
}

function latestFormalPredictions(predictions, targetDate) {
	const byRace = new Map();
	for (const prediction of predictions.filter((entry) => entry?.date === targetDate)) {
		const key = buildShadowRaceKey(prediction.date, prediction.venueCode, prediction.raceNo);
		const existing = byRace.get(key);
		if (!existing || Date.parse(predictionTimestamp(prediction)) > Date.parse(predictionTimestamp(existing))) byRace.set(key, prediction);
	}
	return [...byRace.values()].sort((left, right) => String(left.venueCode).localeCompare(String(right.venueCode)) || Number(left.raceNo) - Number(right.raceNo));
}

function currentRaceIndex(today) {
	const races = new Map();
	for (const venue of today?.venues ?? []) {
		for (const race of venue?.races ?? []) {
			const key = buildShadowRaceKey(today.date, venue.venueCode, race.raceNo);
			races.set(key, { venue, race });
		}
	}
	return races;
}

function confirmedCurrentResult(race) {
	const finishOrder = race?.result?.finishOrder?.slice(0, 3).map(Number) ?? [];
	return race?.result?.status === "confirmed" && finishOrder.length === 3 && finishOrder.every((boat) => Number.isInteger(boat) && boat >= 1 && boat <= 6);
}

function buildTrainingRecords(targetDate) {
	const index = readJson(INDEX_PATH);
	const accuracy = readJson(ACCURACY_PATH);
	const accuracyByKey = new Map((accuracy.races ?? []).map((race) => [race.raceKey, race]));
	const records = [];
	for (const date of (index.availableDates ?? []).filter((value) => value < targetDate)) {
		const shardPath = `public/data/boatrace-ex/derived/prediction-structure/dates/${date}.json`;
		const shard = readJsonIfExists(shardPath);
		for (const race of shard?.races ?? []) {
			const raceKey = buildShadowRaceKey(race.date, race.venueCode, race.raceNo);
			const analysis = accuracyByKey.get(raceKey);
			if (!analysis || !Array.isArray(race.structuredTickets) || race.structuredTickets.length !== 10) continue;
			const baselineTickets = race.structuredTickets;
			records.push({ ...analysis, baselineTickets, preRaceFeatures: buildStrategyPreRaceFeatures(analysis, baselineTickets) });
		}
	}
	return records.sort((left, right) => left.date.localeCompare(right.date) || left.raceKey.localeCompare(right.raceKey));
}

function officialResultIndex(records) {
	const results = new Map();
	const dates = [...new Set(records.filter((record) => record.lifecycle === "PENDING").map((record) => record.date))];
	for (const date of dates) {
		const history = readJsonIfExists(`public/data/boatrace-ex/history/races/${date}.json`);
		for (const race of history?.records ?? []) {
			const finishOrder = race?.officialResult?.finishOrder?.slice(0, 3).map(Number) ?? [];
			if (finishOrder.length !== 3 || !finishOrder.every((boat) => Number.isInteger(boat) && boat >= 1 && boat <= 6)) continue;
			const timestamps = (race.officialResult.sources ?? [])
				.flatMap((source) => [source?.generatedAt, source?.sourceFetchedAt, source?.acquiredAt])
				.filter((value) => Number.isFinite(Date.parse(value)))
				.sort((left, right) => Date.parse(left) - Date.parse(right));
			if (timestamps.length === 0) continue;
			results.set(buildShadowRaceKey(race.date, race.venueCode, race.raceNo), { actualResult: finishOrder, resultSourceTimestamp: timestamps[0] });
		}
	}
	return results;
}

function mergeManifest(entries, generatedAt) {
	const existing = readJson(MANIFEST_PATH);
	const paths = new Set(entries.map((entry) => entry.path));
	return { ...existing, generatedAt, files: [...(existing.files ?? []).filter((entry) => !paths.has(entry?.path)), ...entries] };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const targetDate = resolveDate(args.date);
	const generatedAt = new Date().toISOString();
	const existingFile = readJsonIfExists(RECORDS_PATH) ?? {
		schemaVersion: SHADOW_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-shadow-validation-records",
		startDate: SHADOW_START_DATE,
		records: [],
		ineligibleAttempts: [],
	};
	let records = [...(existingFile.records ?? [])];
	const ineligibleAttempts = new Map((existingFile.ineligibleAttempts ?? []).map((attempt) => [attempt.raceKey, attempt]));
	const existingKeys = new Set(records.map((record) => record.raceKey));
	const noteIneligible = (raceKey, prediction, reason) => {
		ineligibleAttempts.set(raceKey, {
			raceKey,
			date: targetDate,
			venueCode: String(prediction?.venueCode ?? "").padStart(2, "0"),
			venueName: prediction?.venueName ?? null,
			raceNo: Number(prediction?.raceNo),
			reason,
			checkedAt: generatedAt,
		});
	};
	const run = {
		targetDate,
		phase: args.phase,
		formalPredictionCount: 0,
		createdRaceCount: 0,
		evaluatedRaceCount: 0,
		ineligibleAttemptCount: 0,
		beforeStartSkippedCount: 0,
		postResultSkippedCount: 0,
		existingRaceSkippedCount: 0,
		missingRaceSourceCount: 0,
		preRaceTimingUnknownCount: 0,
		postStartSkippedCount: 0,
		baselinePostStartSkippedCount: 0,
	};

	if (args.phase === "generate" || args.phase === "all") {
		const today = readJsonIfExists(TODAY_PATH);
		const predictionFile = readJson(PREDICTIONS_PATH);
		const formalPredictions = latestFormalPredictions(predictionFile.records ?? [], targetDate);
		run.formalPredictionCount = formalPredictions.length;
		const raceIndex = today?.date === targetDate ? currentRaceIndex(today) : new Map();
		const trainingRecords = targetDate >= SHADOW_START_DATE ? buildTrainingRecords(targetDate) : [];
		for (const prediction of formalPredictions) {
			const raceKey = buildShadowRaceKey(targetDate, prediction.venueCode, prediction.raceNo);
			if (targetDate < SHADOW_START_DATE) {
				run.beforeStartSkippedCount += 1;
				continue;
			}
			if (existingKeys.has(raceKey)) {
				run.existingRaceSkippedCount += 1;
				continue;
			}
			const current = raceIndex.get(raceKey);
			if (!current) {
				run.missingRaceSourceCount += 1;
				noteIneligible(raceKey, prediction, "current-race-source-missing");
				continue;
			}
			if (confirmedCurrentResult(current.race)) {
				run.postResultSkippedCount += 1;
				noteIneligible(raceKey, prediction, "result-already-confirmed");
				continue;
			}
			const raceStartBoundary = resolveRaceStartBoundary({ date: targetDate, race: current.race });
			const result = buildProspectiveShadowRecord({
				formalPrediction: prediction,
				raceIdentity: { date: targetDate, venueCode: current.venue.venueCode, venueName: current.venue.venueName, raceNo: current.race.raceNo },
				preRaceFeatureSource: extractPreRaceFeatureSource({ venueCode: current.venue.venueCode, raceNo: current.race.raceNo, race: current.race, sourceTimestamp: today.generatedAt }),
				raceStartBoundary,
				trainingRecords,
				generatedAt,
			});
			if (result.status === "created") {
				records.push(result.record);
				existingKeys.add(result.record.raceKey);
				ineligibleAttempts.delete(result.record.raceKey);
				run.createdRaceCount += 1;
			} else if (result.status === "ineligible") {
				run.ineligibleAttemptCount += 1;
				noteIneligible(raceKey, prediction, result.reason);
				if (result.reason === "pre-race-timing-unknown") run.preRaceTimingUnknownCount += 1;
				if (["shadow-not-created-before-race-start", "pre-race-features-not-created-before-race-start"].includes(result.reason)) run.postStartSkippedCount += 1;
				if (result.reason === "baseline-not-created-before-race-start") run.baselinePostStartSkippedCount += 1;
			}
		}
	}

	if (args.phase === "evaluate" || args.phase === "all") {
		const results = officialResultIndex(records);
		records = records.map((record) => {
			const result = results.get(record.raceKey);
			if (!result) return record;
			const evaluated = evaluateShadowRecord(record, { ...result, evaluatedAt: generatedAt });
			if (record.lifecycle === "PENDING" && evaluated.lifecycle === "EVALUATED") run.evaluatedRaceCount += 1;
			return evaluated;
		});
	}

	records.sort((left, right) => left.date.localeCompare(right.date) || left.raceKey.localeCompare(right.raceKey));
	const persistedIneligibleAttempts = [...ineligibleAttempts.values()].sort((left, right) => left.raceKey.localeCompare(right.raceKey));
	const summary = summarizeShadowValidation(records, generatedAt, persistedIneligibleAttempts);
	const recordPayload = {
		...existingFile,
		schemaVersion: SHADOW_SCHEMA_VERSION,
		kind: "boatrace-ex-prediction-shadow-validation-records",
		generatedAt,
		startDate: SHADOW_START_DATE,
		records,
		ineligibleAttempts: persistedIneligibleAttempts,
	};
	const latest = { ...summary, kind: "boatrace-ex-prediction-shadow-validation-latest" };
	const manifest = mergeManifest([
		{ path: RECORDS_PATH, kind: recordPayload.kind, date: targetDate, generatedAt, sourceStatus: "available", coverageStatus: records.length > 0 ? "partial" : "missing", recordCount: records.length },
		{ path: SUMMARY_PATH, kind: summary.kind, date: targetDate, generatedAt, sourceStatus: "available", coverageStatus: summary.summary.evaluatedRaceCount > 0 ? "partial" : "missing", recordCount: summary.summary.evaluatedRaceCount },
		{ path: LATEST_PATH, kind: latest.kind, date: targetDate, generatedAt, sourceStatus: "available", coverageStatus: summary.summary.evaluatedRaceCount > 0 ? "partial" : "missing", recordCount: summary.summary.evaluatedRaceCount },
	], generatedAt);
	writeJson(RECORDS_PATH, recordPayload, args.dryRun);
	writeJson(SUMMARY_PATH, summary, args.dryRun);
	writeJson(LATEST_PATH, latest, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, run, summary: summary.summary, strategies: summary.strategies }, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
