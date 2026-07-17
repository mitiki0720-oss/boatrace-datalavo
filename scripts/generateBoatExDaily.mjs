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
			if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD or latest");
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
	if (args.date !== "latest" && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
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
	if (dateArg !== "latest") return dateArg;
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	if (!index.latestDate) throw new Error("date index latestDate is missing");
	return index.latestDate;
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
	const warnings = [];
	const date = resolveDate(args.date);
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
			runGenerationStep("scripts/generateBoatExHistory.mjs", date, args);
			throw new Error(`${historyPath} is missing after dry-run history generation. No files were written.`);
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

	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		date,
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
		warnings,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
