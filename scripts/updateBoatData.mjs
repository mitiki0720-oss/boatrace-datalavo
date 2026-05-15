import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTodayIsoJst, normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VALID_MODES = new Set(["initial", "active", "results", "final"]);
const VALID_TARGET_SESSIONS = new Set(["auto", "morning", "day", "night"]);

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = {};

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}

		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];

		switch (key) {
			case "mode":
				parsed.mode = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			case "targetSession":
			case "target-session":
				parsed.targetSession = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			case "targetDate":
			case "target-date":
				parsed.targetDate = value;
				if (separatorIndex < 0) {
					index += 1;
				}
				break;
			default:
				break;
		}
	}

	return parsed;
}

function normalizeMode(value) {
	return VALID_MODES.has(value) ? value : "initial";
}

function normalizeTargetSession(value) {
	return VALID_TARGET_SESSIONS.has(value) ? value : "auto";
}

function buildTodayDetailsArgs({ mode, targetSession, targetDate }) {
	const args = [
		"scripts/updateBoatTodayRaceDetails.mjs",
		"--mode",
		mode,
		"--target-session",
		targetSession,
		"--target-date",
		targetDate,
	];

	if (mode === "active") {
		args.push("--fetch-sections", "raceTitles,odds,beforeInfo");
	}

	if (mode === "results") {
		args.push("--fetch-sections", "raceTitles,resultList,detailedResults,odds");
	}

	if (mode === "final") {
		args.push("--fetch-sections", "raceTitles,resultList,detailedResults,odds,beforeInfo,venueWeather");
	}

	return args;
}

function buildVenueExtrasArgs({ mode, targetDate }) {
	if (mode !== "initial" && mode !== "final") {
		return null;
	}

	return ["scripts/updateBoatVenueExtras.mjs", "--target-date", targetDate];
}

function runNodeScript(args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, args, {
			cwd: path.resolve(__dirname, ".."),
			stdio: "inherit",
			env: process.env,
		});

		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`command failed with exit code ${code ?? "unknown"}: node ${args.join(" ")}`));
		});
	});
}

export function parseUpdateBoatDataOptions(argv = process.argv.slice(2), env = process.env) {
	const cliArgs = parseCliArgs(argv);
	const fallbackTargetDate = getTodayIsoJst();
	return {
		mode: normalizeMode(cliArgs.mode ?? env.BOAT_RACE_MODE),
		targetSession: normalizeTargetSession(cliArgs.targetSession ?? env.BOAT_RACE_TARGET_SESSION),
		targetDate: normalizeTargetDate(cliArgs.targetDate ?? env.BOAT_RACE_TARGET_DATE, fallbackTargetDate),
	};
}

export async function main(rawOptions = parseUpdateBoatDataOptions()) {
	const options = {
		mode: normalizeMode(rawOptions.mode),
		targetSession: normalizeTargetSession(rawOptions.targetSession),
		targetDate: normalizeTargetDate(rawOptions.targetDate, getTodayIsoJst()),
	};

	console.log(`[update-boat-data] mode=${options.mode} targetSession=${options.targetSession} targetDate=${options.targetDate}`);

	if (options.mode === "results") {
		console.log("[update-boat-data] results mode is scaffolded. This pass only narrows fetch sections for today race details.");
	}

	if (options.mode === "final") {
		console.log("[update-boat-data] final mode runs all-race result completion, beforeinfo backfill, and a final venue-extras refresh.");
	}

	await runNodeScript(buildTodayDetailsArgs(options));

	const venueExtrasArgs = buildVenueExtrasArgs(options);
	if (venueExtrasArgs) {
		await runNodeScript(venueExtrasArgs);
	} else {
		console.log(`[update-boat-data] skipping venue extras for mode=${options.mode}`);
	}
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (isDirectRun) {
	main().catch((error) => {
		console.error("failed to update boat race data");
		console.error(error);
		process.exitCode = 1;
	});
}