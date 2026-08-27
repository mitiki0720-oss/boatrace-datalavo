import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
	const args = {
		date: undefined,
		dryRun: false,
		refreshHistory: false,
		allowEmpty: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--date") {
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD, latest, or auto");
			args.date = next;
			index += 1;
			continue;
		}
		if (arg === "--dry-run" || arg === "--skip-write") {
			args.dryRun = true;
			continue;
		}
		if (arg === "--refresh-history") {
			args.refreshHistory = true;
			continue;
		}
		if (arg === "--allow-empty") {
			args.allowEmpty = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (!args.date) throw new Error("--date is required");
	if (!["latest", "auto"].includes(args.date) && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
		throw new Error(`Invalid --date value: ${args.date}`);
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
		warnings: [],
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

function resolveDate(dateArg) {
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateArg)) {
		return {
			date: dateArg,
			dateResolution: {
				mode: "explicit",
				source: "cli",
				fallbackUsed: false,
			},
			warnings: [],
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
			warnings: [],
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
		warnings: ["--date auto could not resolve a date from BOATRACE generated JSON; fell back to EX index latestDate."],
	};
}

function historyExists(date) {
	return fs.existsSync(absolute(`public/data/boatrace-ex/history/races/${date}.json`));
}

function summarizeHistory(date, status) {
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	const records = Array.isArray(history.records) ? history.records : [];
	return {
		status,
		records: records.length,
		venues: new Set(records.map((record) => record?.venueCode).filter(Boolean)).size,
	};
}

function summarizeDateIndex() {
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	return {
		status: "checked",
		latestDate: index.latestDate ?? null,
		dateCount: index.summary?.dateCount ?? index.availableDates?.length ?? null,
	};
}

function runGenerationStep(script, date, args) {
	const commandArgs = ["--date", date];
	if (args.dryRun) commandArgs.push("--dry-run");
	if (args.allowEmpty) commandArgs.push("--allow-empty");
	return runNode(script, commandArgs);
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const resolved = resolveDate(args.date);
	const warnings = [...resolved.warnings];
	const date = resolved.date;
	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;

	if (args.allowEmpty) {
		warnings.push("--allow-empty is for explicit empty-output testing and is not recommended for normal daily EX runs.");
	}

	let history;
	if (historyExists(date) && !args.refreshHistory) {
		runNode("scripts/checkBoatExHistory.mjs", ["--date", date, ...(args.allowEmpty ? ["--allow-empty"] : [])]);
		history = summarizeHistory(date, "existing");
	} else {
		if (!historyExists(date) && args.dryRun) {
			const generated = runGenerationStep("scripts/generateBoatExHistory.mjs", date, args);
			history = {
				status: "dry-run-generated",
				records: generated?.records ?? null,
				venues: generated?.venues ?? null,
			};
			console.log(JSON.stringify({
				ok: true,
				dryRun: true,
				requestedDate: args.date,
				date,
				dateResolution: resolved.dateResolution,
				history,
				venueEvidence: {
					status: "skipped",
					reason: `${historyPath} was not written during dry-run.`,
				},
				racerEvidence: {
					status: "skipped",
					reason: `${historyPath} was not written during dry-run.`,
				},
				dateIndex: {
					status: "skipped",
				},
				venueBias: {
					status: "skipped",
					reason: `${historyPath} was not written during dry-run.`,
				},
				warnings,
			}, null, 2));
			return;
		}
		runGenerationStep("scripts/generateBoatExHistory.mjs", date, args);
		if (!args.dryRun) runNode("scripts/checkBoatExHistory.mjs", ["--date", date, ...(args.allowEmpty ? ["--allow-empty"] : [])]);
		history = args.dryRun && !historyExists(date) ? { status: "dry-run-missing", records: null, venues: null } : summarizeHistory(date, args.refreshHistory ? "refreshed" : "generated");
	}

	const venueGenerated = runGenerationStep("scripts/generateBoatExVenueEvidence.mjs", date, args);
	const venueChecked = args.dryRun
		? runNode("scripts/checkBoatExVenueEvidence.mjs", ["--date", date, ...(args.allowEmpty ? ["--allow-empty"] : [])])
		: runNode("scripts/checkBoatExVenueEvidence.mjs", ["--date", date, ...(args.allowEmpty ? ["--allow-empty"] : [])]);

	const racerGenerated = runGenerationStep("scripts/generateBoatExRacerEvidence.mjs", date, args);
	const racerChecked = runNode("scripts/checkBoatExRacerEvidence.mjs", ["--date", date, ...(args.allowEmpty ? ["--allow-empty"] : [])]);

	if (args.dryRun) {
		runNode("scripts/generateBoatExDateIndex.mjs", ["--dry-run", ...(args.allowEmpty ? ["--allow-empty"] : [])]);
	} else {
		runNode("scripts/generateBoatExDateIndex.mjs", [...(args.allowEmpty ? ["--allow-empty"] : [])]);
	}
	const dateIndex = summarizeDateIndex();
	runNode("scripts/checkBoatExDateIndex.mjs", [...(args.allowEmpty ? ["--allow-empty"] : [])]);
	const venueBiasGenerated = runNode("scripts/generateBoatExVenueBias.mjs", [...(args.dryRun ? ["--dry-run"] : [])]);
	const venueBiasChecked = runNode("scripts/checkBoatExVenueBias.mjs", []);

        const roughIndexGenerated = runNode(
                "scripts/generateBoatExRoughIndex.mjs",
                [...(args.dryRun ? ["--dry-run"] : [])],
        );
        const roughIndexChecked = runNode(
                "scripts/checkBoatExRoughIndex.mjs",
                [],
        );
        const todayFlowGenerated = runNode(
                "scripts/generateBoatExTodayFlow.mjs",
                [...(args.dryRun ? ["--dry-run"] : [])],
        );
	const todayFlowChecked = runNode(
		"scripts/checkBoatExTodayFlow.mjs",
		[],
	);
	const structuredTicketsGenerated = runNode(
		"scripts/generateBoatExStructuredTickets.mjs",
		[...(args.dryRun ? ["--dry-run"] : [])],
	);
	const predictionStructureGenerated = runNode(
		"scripts/generateBoatExPredictionStructure.mjs",
		[...(args.dryRun ? ["--dry-run"] : [])],
	);
	const predictionStructureChecked = runNode(
		"scripts/checkBoatExPredictionStructure.mjs",
		[],
	);

	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		requestedDate: args.date,
		date,
		dateResolution: resolved.dateResolution,
		history,
		venueEvidence: {
			status: "checked",
			records: venueChecked.records ?? venueGenerated?.records ?? null,
			venues: venueChecked.venues ?? venueGenerated?.venues ?? null,
		},
		racerEvidence: {
			status: "checked",
			racerCount: racerChecked.racerCount ?? racerGenerated?.racers ?? null,
			appearanceCount: racerChecked.appearanceCount ?? racerGenerated?.appearanceCount ?? null,
		},
		dateIndex,
		venueBias: {
			status: "checked",
			dateCount: venueBiasChecked.dateCount ?? venueBiasGenerated?.dateCount ?? null,
			raceCount: venueBiasChecked.raceCount ?? venueBiasGenerated?.raceCount ?? null,
			venueCount: venueBiasChecked.venueCount ?? venueBiasGenerated?.venueCount ?? null,
			readiness: venueBiasChecked.readiness ?? venueBiasGenerated?.readiness ?? null,
		},
                roughIndex: {
                        status: "checked",
                        dateCount:
                                roughIndexChecked.dateCount ??
                                roughIndexGenerated?.dateCount ??
                                null,
                        raceCount:
                                roughIndexChecked.raceCount ??
                                roughIndexGenerated?.raceCount ??
                                null,
                        venueCount:
                                roughIndexChecked.venueCount ??
                                roughIndexGenerated?.venueCount ??
                                null,
                        resultAvailableRaceCount:
                                roughIndexChecked.resultAvailableRaceCount ??
                                roughIndexGenerated?.resultAvailableRaceCount ??
                                null,
                        payoutAvailableRaceCount:
                                roughIndexChecked.payoutAvailableRaceCount ??
                                roughIndexGenerated?.payoutAvailableRaceCount ??
                                null,
                        readiness:
                                roughIndexChecked.readiness ??
                                roughIndexGenerated?.readiness ??
                                null,
                },
		todayFlow: {
			status: "checked",
			targetDate: todayFlowChecked.targetDate ?? todayFlowGenerated?.targetDate ?? null,
			venueCount: todayFlowChecked.venueCount ?? todayFlowGenerated?.venueCount ?? null,
			raceCount: todayFlowChecked.raceCount ?? todayFlowGenerated?.raceCount ?? null,
			resultAvailableRaceCount: todayFlowChecked.resultAvailableRaceCount ?? todayFlowGenerated?.resultAvailableRaceCount ?? null,
			payoutAvailableRaceCount: todayFlowChecked.payoutAvailableRaceCount ?? todayFlowGenerated?.payoutAvailableRaceCount ?? null,
			readiness: todayFlowChecked.readiness ?? todayFlowGenerated?.readiness ?? null,
		},
		structuredTickets: {
			status: "generated",
			dateCount: structuredTicketsGenerated?.dateCount ?? null,
			races: structuredTicketsGenerated?.historyRaceCount ?? null,
			readiness: structuredTicketsGenerated?.readiness ?? null,
		},
		predictionStructure: {
			status: "checked",
			targetDate: predictionStructureChecked.targetDate ?? predictionStructureGenerated?.targetDate ?? null,
			venueCount: predictionStructureChecked.venueCount ?? predictionStructureGenerated?.venueCount ?? null,
			raceCount: predictionStructureChecked.raceCount ?? predictionStructureGenerated?.raceCount ?? null,
			resultAvailableRaceCount: predictionStructureChecked.resultAvailableRaceCount ?? predictionStructureGenerated?.resultAvailableRaceCount ?? null,
			readiness: predictionStructureChecked.readiness ?? predictionStructureGenerated?.readiness ?? null,
		},
		warnings,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
