import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function normalizeDateArg(value) {
	const normalized = String(value ?? "").trim();
	if (!normalized) return "auto";
	if (["auto", "latest"].includes(normalized) || /^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
	throw new Error("--date requires YYYY-MM-DD, latest, or auto");
}

function parseArgs(argv) {
	const args = { date: "auto" };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--date") {
			const next = argv[index + 1];
			args.date = normalizeDateArg(next?.startsWith("--") ? undefined : next);
			if (next !== undefined && !next.startsWith("--")) index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function readJsonIfExists(relativePath) {
	const filePath = absolute(relativePath);
	if (!fs.existsSync(filePath)) return null;
	return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isDateString(value) {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function collectDateCandidatesFromValue(value, output = []) {
	if (Array.isArray(value)) {
		for (const item of value) collectDateCandidatesFromValue(item, output);
		return output;
	}
	if (!value || typeof value !== "object") return output;

	for (const [key, item] of Object.entries(value)) {
		if (["date", "sessionDate", "generatedFor"].includes(key) && isDateString(item)) {
			output.push(item);
			continue;
		}
		if (key === "range" && item && typeof item === "object" && isDateString(item.startDate)) {
			output.push(item.startDate);
			continue;
		}
		collectDateCandidatesFromValue(item, output);
	}
	return output;
}

function collectPrimaryDateCandidates(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return [];
	const output = [];
	for (const key of ["date", "sessionDate", "generatedFor"]) {
		if (isDateString(value[key])) output.push(value[key]);
	}
	if (value.range && typeof value.range === "object" && isDateString(value.range.startDate)) {
		output.push(value.range.startDate);
	}
	return output;
}

function collectAutoDateCandidates() {
	const sourcePaths = [
		"public/data/boatrace/today.generated.json",
		"public/data/boatrace/today-race-details.generated.json",
		"public/data/boatrace/upcoming-schedule.generated.json",
		"public/data/boatrace/venue-extras.generated.json",
	];
	const candidates = [];
	const fallbackCandidates = [];
	for (const sourcePath of sourcePaths) {
		const data = readJsonIfExists(sourcePath);
		if (!data) continue;
		for (const date of collectPrimaryDateCandidates(data)) {
			candidates.push({ date, source: sourcePath });
		}
		for (const date of collectDateCandidatesFromValue(data)) {
			fallbackCandidates.push({ date, source: sourcePath });
		}
	}
	return candidates.length > 0 ? candidates : fallbackCandidates;
}

function uniqueSortedDates(candidates) {
	return [...new Set(candidates.map((candidate) => candidate.date))].sort();
}

function buildLatestDateResolution(index) {
	if (!index.latestDate) throw new Error("date index latestDate is missing");
	return {
		date: index.latestDate,
		dateResolution: {
			mode: "latest",
			source: "public/data/boatrace-ex/index.generated.json",
			fallbackUsed: false,
		},
	};
}

function parseJsonFromStdout(stdout) {
	const text = String(stdout ?? "").trim();
	if (!text) return null;
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start < 0 || end < start) return null;
	return JSON.parse(text.slice(start, end + 1));
}

function runNode(script, args) {
	const result = spawnSync(process.execPath, [script, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	const parsed = parseJsonFromStdout(result.stdout);
	if (result.status !== 0) {
		const message = [
			`${script} failed with exit code ${result.status}`,
			result.stderr?.trim(),
			result.stdout?.trim(),
		].filter(Boolean).join("\n");
		throw new Error(message);
	}
	return parsed;
}

function resolveDate(dateArg, index) {
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
		return {
			date: dateArg,
			dateResolution: {
				mode: "explicit",
				source: "cli",
				fallbackUsed: false,
			},
		};
	}
	if (dateArg === "latest") return buildLatestDateResolution(index);

	const candidates = collectAutoDateCandidates();
	const dates = uniqueSortedDates(candidates);
	if (dates.length > 0) {
		const date = dates.at(-1);
		const source = candidates.find((candidate) => candidate.date === date)?.source ?? null;
		return {
			date,
			dateResolution: {
				mode: "auto",
				source,
				fallbackUsed: false,
				candidates: dates,
			},
		};
	}

	const latest = buildLatestDateResolution(index);
	return {
		date: latest.date,
		dateResolution: {
			mode: "auto",
			source: latest.dateResolution.source,
			fallbackUsed: true,
			candidates: [],
		},
	};
}

function collectSourcePaths(value, output = []) {
	if (Array.isArray(value)) {
		for (const item of value) collectSourcePaths(item, output);
		return output;
	}
	if (!value || typeof value !== "object") return output;
	for (const [key, item] of Object.entries(value)) {
		if ((key === "sourcePath" || key === "path") && typeof item === "string") output.push(item);
		collectSourcePaths(item, output);
	}
	return output;
}

function assertNoProhibitedDerivedPaths(files) {
	const errors = [];
	for (const file of files) {
		const paths = collectSourcePaths(file.data);
		for (const sourcePath of paths) {
			if (sourcePath.startsWith("public/data/reviews/")) {
				errors.push(`${file.path}: prohibited reviews path ${sourcePath}`);
			}
			if (/^public\/data\/boatrace\/[^/]+\.generated\.json$/.test(sourcePath)) {
				errors.push(`${file.path}: direct boatrace generated source ${sourcePath}`);
			}
		}
	}
	if (errors.length > 0) throw new Error(errors.join("\n"));
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const resolved = resolveDate(args.date, index);
	const date = resolved.date;

	if (!Array.isArray(index.availableDates) || !index.availableDates.includes(date)) {
		throw new Error(`${date} is not present in date index availableDates`);
	}
	if (index.summary?.dateCount < 1) throw new Error("date index dateCount must be >= 1");

	const history = runNode("scripts/checkBoatExHistory.mjs", ["--date", date]);
	const venue = runNode("scripts/checkBoatExVenueEvidence.mjs", ["--date", date]);
	const racer = runNode("scripts/checkBoatExRacerEvidence.mjs", ["--date", date]);
	runNode("scripts/checkBoatExDateIndex.mjs", []);
	const venueBias = runNode("scripts/checkBoatExVenueBias.mjs", []);
        const roughIndex = runNode(
                "scripts/checkBoatExRoughIndex.mjs",
                [],
        );
	const todayFlow = runNode("scripts/checkBoatExTodayFlow.mjs", []);
	const predictionStructure = runNode("scripts/checkBoatExPredictionStructure.mjs", []);
	const raceAnalysis = runNode("scripts/checkBoatExRaceAnalysis.mjs", ["--date", date]);
	const currentDayPredictionCoverage = readJsonIfExists("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json");
	if (currentDayPredictionCoverage?.targetDate === date) {
		runNode("scripts/checkBoatExCurrentDayPredictionCoverage.mjs", []);
	}

	const derivedManifest = readJson("public/data/boatrace-ex/derived/manifest.generated.json");
	if (!Array.isArray(derivedManifest.files) || derivedManifest.files.length < 6) {
                throw new Error(
				"derived manifest entries must include venue evidence, racer evidence, venue bias, rough index, today flow, and prediction structure",
                );
	}

	assertNoProhibitedDerivedPaths([
		{
			path: "public/data/boatrace-ex/index.generated.json",
			data: index,
		},
		{
			path: "public/data/boatrace-ex/derived/venue-evidence",
			data: readJson(`public/data/boatrace-ex/derived/venue-evidence/${date}.json`),
		},
		{
			path: "public/data/boatrace-ex/derived/racer-evidence",
			data: readJson(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`),
		},
		{
			path: "public/data/boatrace-ex/derived/venue-bias/latest.json",
			data: readJson("public/data/boatrace-ex/derived/venue-bias/latest.json"),
		},
                {
                        path: "public/data/boatrace-ex/derived/rough-index/latest.json",
                        data: readJson(
                                "public/data/boatrace-ex/derived/rough-index/latest.json",
                        ),
                },
		{
			path: "public/data/boatrace-ex/derived/today-flow/latest.json",
			data: readJson("public/data/boatrace-ex/derived/today-flow/latest.json"),
		},
		{
			path: "public/data/boatrace-ex/derived/prediction-structure/latest.json",
			data: readJson("public/data/boatrace-ex/derived/prediction-structure/latest.json"),
		},
		{
			path: "public/data/boatrace-ex/derived/manifest.generated.json",
			data: derivedManifest,
		},
	]);

	console.log(JSON.stringify({
		ok: true,
		requestedDate: args.date,
		date,
		dateResolution: resolved.dateResolution,
		latestDate: index.latestDate,
		dateCount: index.summary.dateCount,
		records: history.records,
		venues: venue.venues,
		racerCount: racer.racerCount,
		appearanceCount: racer.appearanceCount,
		venueBias: {
			dateCount: venueBias.dateCount,
			raceCount: venueBias.raceCount,
			venueCount: venueBias.venueCount,
			readiness: venueBias.readiness,
		},
                roughIndex: {
                        dateCount: roughIndex.dateCount,
                        raceCount: roughIndex.raceCount,
                        venueCount: roughIndex.venueCount,
                        resultAvailableRaceCount:
                                roughIndex.resultAvailableRaceCount,
                        payoutAvailableRaceCount:
                                roughIndex.payoutAvailableRaceCount,
                        readiness: roughIndex.readiness,
                },
		todayFlow: {
			targetDate: todayFlow.targetDate,
			venueCount: todayFlow.venueCount,
			raceCount: todayFlow.raceCount,
			resultAvailableRaceCount: todayFlow.resultAvailableRaceCount,
			payoutAvailableRaceCount: todayFlow.payoutAvailableRaceCount,
			readiness: todayFlow.readiness,
		},
		predictionStructure: {
			targetDate: predictionStructure.targetDate,
			venueCount: predictionStructure.venueCount,
			raceCount: predictionStructure.raceCount,
			resultAvailableRaceCount: predictionStructure.resultAvailableRaceCount,
			readiness: predictionStructure.readiness,
		},
		raceAnalysis: {
			targetDate: raceAnalysis.targetDate,
			raceCount: raceAnalysis.raceCount,
			analyzedRaceCount: raceAnalysis.analyzedRaceCount,
			notReadyRaceCount: raceAnalysis.notReadyRaceCount,
			notReadyReasonCounts: raceAnalysis.notReadyReasonCounts,
		},
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
