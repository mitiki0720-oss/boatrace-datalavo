import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ALLOWED_READINESS_STATUS = new Set(["pending", "insufficient-history"]);
const ALLOWED_SOURCE_STATUS = new Set(["available", "partial", "missing", "pending", "unknown"]);
const FORBIDDEN_SCORE_KEYS = new Set([
	"score",
	"roughIndexScore",
	"venueBiasScore",
	"racerProfileScore",
	"courseChangeScore",
	"exhibitionReliabilityScore",
	"startTimingScore",
]);
const FORBIDDEN_CONFIDENCE_LABELS = [
	"進入変化型",
	"展示信用型",
	"ST安定型",
	"course-change type",
	"exhibition reliable",
	"start stable",
];

function parseArgs(argv) {
	const args = {
		date: undefined,
		allowEmpty: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--date") {
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD");
			args.date = next;
			index += 1;
			continue;
		}
		if (arg === "--allow-empty") {
			args.allowEmpty = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
		throw new Error(`Invalid --date value: ${args.date}`);
	}

	return args;
}

function readJson(relativePath) {
	const absolutePath = path.join(repoRoot, relativePath);
	return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function assert(condition, message, errors) {
	if (!condition) errors.push(message);
}

function walk(value, visitor, pathParts = []) {
	if (Array.isArray(value)) {
		value.forEach((item, index) => walk(item, visitor, [...pathParts, String(index)]));
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [key, child] of Object.entries(value)) {
		visitor(key, child, [...pathParts, key].join("."));
		walk(child, visitor, [...pathParts, key]);
	}
}

function validateNoFakeCompletion(value, errors) {
	walk(value, (key, child, location) => {
		assert(!FORBIDDEN_SCORE_KEYS.has(key), `${location}: fake score field is prohibited`, errors);
		assert(!(key === "confidence" && child === "high"), `${location}: high confidence is prohibited in racer evidence v0`, errors);
		if (typeof child === "string") {
			assert(!child.includes("public/data/reviews/"), `${location}: reviews sources are prohibited`, errors);
			assert(!/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(child), `${location}: direct boatrace generated source is prohibited`, errors);
			for (const label of FORBIDDEN_CONFIDENCE_LABELS) {
				assert(!child.includes(label), `${location}: confirmed racer pattern label is prohibited`, errors);
			}
		}
	});
}

function validateRacer(racer, index, errors) {
	const location = `racers[${index}]`;
	assert(typeof racer.racerKey === "string" && racer.racerKey.length > 0, `${location}: racerKey is required`, errors);
	assert(typeof racer.racerName === "string" && racer.racerName.length > 0, `${location}: racerName is required`, errors);
	assert(Number.isInteger(racer.appearanceCount) && racer.appearanceCount > 0, `${location}: appearanceCount must be positive`, errors);
	assert(Array.isArray(racer.raceEvidence), `${location}: raceEvidence must be an array`, errors);
	assert(racer.raceEvidence?.length === racer.appearanceCount, `${location}: raceEvidence length must match appearanceCount`, errors);
	assert(racer.derivedReadiness && typeof racer.derivedReadiness === "object", `${location}: derivedReadiness is required`, errors);
	assert(racer.startEvidence && ALLOWED_SOURCE_STATUS.has(racer.startEvidence.sourceStatus), `${location}: invalid startEvidence sourceStatus`, errors);
	assert(racer.exhibitionEvidence && ALLOWED_SOURCE_STATUS.has(racer.exhibitionEvidence.sourceStatus), `${location}: invalid exhibitionEvidence sourceStatus`, errors);
	assert(racer.courseChangeEvidence && ALLOWED_SOURCE_STATUS.has(racer.courseChangeEvidence.sourceStatus), `${location}: invalid courseChangeEvidence sourceStatus`, errors);
	assert(!(racer.courseChangeEvidence?.sourceStatus === "missing" && racer.courseChangeEvidence?.frameToFinalCourseChangedCount === 0), `${location}: missing courseChangeEvidence must keep frameToFinalCourseChangedCount null`, errors);
	assert(!(racer.courseChangeEvidence?.sourceStatus === "missing" && racer.courseChangeEvidence?.exhibitionToFinalCourseChangedCount === 0), `${location}: missing courseChangeEvidence must keep exhibitionToFinalCourseChangedCount null`, errors);
	assert(Array.isArray(racer.warnings), `${location}: warnings must be an array`, errors);

	if (racer.registrationNumber) {
		assert(racer.racerKey === `registrationNumber:${racer.registrationNumber}`, `${location}: registrationNumber racerKey mismatch`, errors);
		assert(racer.registrationNumber !== "0000", `${location}: fake registrationNumber 0000 is prohibited`, errors);
	} else {
		assert(racer.identityStatus === "unverified", `${location}: missing registrationNumber requires unverified identityStatus`, errors);
		assert(racer.warnings.length > 0, `${location}: missing registrationNumber requires warning`, errors);
	}

	for (const key of ["racerProfile", "courseChangePattern", "exhibitionReliability", "startTimingPattern"]) {
		const status = racer.derivedReadiness?.[key]?.status;
		assert(ALLOWED_READINESS_STATUS.has(status), `${location}.derivedReadiness.${key}.status must be pending or insufficient-history`, errors);
	}
}

function racerKeyForHistory(racer, record) {
	if (racer.registrationNumber) return `registrationNumber:${racer.registrationNumber}`;
	return [
		"unverified",
		String(racer.racerName ?? "unknown").trim() || "unknown",
		String(racer.branch ?? "unknown").trim() || "unknown",
		record.venueCode,
		record.raceNo,
		racer.lane,
	].join(":");
}

function collectHistoryRacerStats(history) {
	const racers = new Map();
	let appearanceCount = 0;
	for (const record of Array.isArray(history.records) ? history.records : []) {
		for (const racer of Array.isArray(record?.racer) ? record.racer : []) {
			if (!racer?.racerName || !Number.isFinite(Number(racer.lane))) continue;
			const racerKey = racerKeyForHistory(racer, record);
			const appearance = {
				raceKey: record.raceKey,
				frameNo: Number(racer.lane),
			};
			const racerStats = racers.get(racerKey) ?? { appearances: [] };
			racerStats.appearances.push(appearance);
			racers.set(racerKey, racerStats);
			appearanceCount += 1;
		}
	}
	return { racers, appearanceCount };
}

function raceEvidenceCounts(raceEvidence) {
	const counts = new Map();
	for (const entry of raceEvidence ?? []) {
		const key = `${entry.raceKey}:${entry.frameNo}`;
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

function equalCounts(left, right) {
	return left.size === right.size && [...left].every(([key, value]) => right.get(key) === value);
}

function validateProvenance(evidence, historyPath, coveragePath, venueEvidencePath, errors) {
	const allowedPaths = new Set([historyPath, coveragePath, venueEvidencePath]);
	assert(Array.isArray(evidence.sourceFiles), "evidence.sourceFiles must be an array", errors);
	for (const source of evidence.sourceFiles ?? []) {
		const sourcePath = String(source.sourcePath ?? "");
		assert(!sourcePath.startsWith("public/data/reviews/"), `sourceFiles path is prohibited: ${sourcePath}`, errors);
		assert(!/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(sourcePath), `direct boatrace generated source is prohibited: ${sourcePath}`, errors);
		assert(allowedPaths.has(sourcePath), `sourceFiles path must be derived EX evidence: ${sourcePath}`, errors);
	}
	for (const requiredPath of [historyPath, coveragePath]) {
		assert((evidence.sourceFiles ?? []).some((source) => source.sourcePath === requiredPath), `sourceFiles must include ${requiredPath}`, errors);
	}
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const date = args.date;
	if (!date) throw new Error("--date is required");

	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const coveragePath = `public/data/boatrace-ex/coverage/${date}.json`;
	const venueEvidencePath = `public/data/boatrace-ex/derived/venue-evidence/${date}.json`;
	const evidencePath = `public/data/boatrace-ex/derived/racer-evidence/${date}.json`;
	const manifestPath = "public/data/boatrace-ex/derived/manifest.generated.json";
	const history = readJson(historyPath);
	const evidence = readJson(evidencePath);
	const manifest = readJson(manifestPath);
	const errors = [];
	const historyStats = collectHistoryRacerStats(history);

	assert(history.date === date, "history.date mismatch", errors);
	assert(Array.isArray(history.records), "history.records must be an array", errors);

	assert(evidence.schemaVersion === 1, "evidence.schemaVersion must be 1", errors);
	assert(evidence.kind === "boatrace-ex-racer-evidence", "evidence.kind mismatch", errors);
	assert(evidence.date === date, "evidence.date mismatch", errors);
	validateProvenance(evidence, historyPath, coveragePath, venueEvidencePath, errors);

	assert(Array.isArray(evidence.racers), "evidence.racers must be an array", errors);
	assert(evidence.summary?.racerCount === evidence.racers?.length, "summary.racerCount must match racers.length", errors);
	assert(evidence.summary?.appearanceCount === evidence.racers?.reduce((sum, racer) => sum + Number(racer.appearanceCount ?? 0), 0), "summary.appearanceCount must match racer appearance counts", errors);
	assert(evidence.summary?.racerCount === historyStats.racers.size, "summary.racerCount must match history racer count", errors);
	assert(evidence.summary?.appearanceCount === historyStats.appearanceCount, "summary.appearanceCount must match history appearance count", errors);

	if (!args.allowEmpty) {
		assert(evidence.racers?.length > 0, "racers must not be empty", errors);
		assert(evidence.summary?.appearanceCount > 0, "summary.appearanceCount must be positive", errors);
	}

	const racerKeys = new Set();
	evidence.racers?.forEach((racer, index) => {
		assert(!racerKeys.has(racer.racerKey), `duplicate racerKey: ${racer.racerKey}`, errors);
		racerKeys.add(racer.racerKey);
		validateRacer(racer, index, errors);
		const historyRacer = historyStats.racers.get(racer.racerKey);
		assert(Boolean(historyRacer), `racers[${index}]: racerKey is missing from history: ${racer.racerKey}`, errors);
		if (historyRacer) {
			assert(racer.appearanceCount === historyRacer.appearances.length, `racers[${index}]: appearanceCount must match history`, errors);
			assert(equalCounts(raceEvidenceCounts(racer.raceEvidence), raceEvidenceCounts(historyRacer.appearances)), `racers[${index}]: raceEvidence must match history appearances`, errors);
		}
	});

	assert(manifest.schemaVersion === 1, "manifest.schemaVersion must be 1", errors);
	assert(manifest.kind === "boatrace-ex-derived-manifest", "manifest.kind mismatch", errors);
	assert(Array.isArray(manifest.files), "manifest.files must be an array", errors);
	assert((manifest.files ?? []).some((file) => file.path === evidencePath), "manifest must include racer evidence path", errors);
	assert((manifest.files ?? []).length >= 2, "derived manifest must include at least venue and racer evidence entries", errors);
	validateNoFakeCompletion(evidence, errors);
	validateNoFakeCompletion(manifest, errors);

	if (errors.length > 0) {
		console.error(errors.map((error) => `- ${error}`).join("\n"));
		process.exitCode = 1;
		return;
	}

	console.log(JSON.stringify({
		ok: true,
		date,
		evidencePath,
		historyPath,
		manifestPath,
		racerCount: evidence.summary.racerCount,
		appearanceCount: evidence.summary.appearanceCount,
		mode: "dynamic",
		derivedManifestFiles: manifest.files.length,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
