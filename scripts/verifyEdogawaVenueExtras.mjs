import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const TEMP_ROOT = path.join(projectRoot, ".tmp", "edogawa-verification");
const OUTPUT_DIR = path.join(TEMP_ROOT, "boatrace");
const VENUE_CODE = "03";
const VENUE_NAME = "\u6c5f\u6238\u5ddd";

function parseArgs(argv = process.argv.slice(2)) {
	const options = { targetDate: null, race: 1 };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}
		const key = token.slice(2);
		const value = argv[index + 1];
		if (key === "target-date" || key === "targetDate") {
			options.targetDate = value;
			index += 1;
		} else if (key === "race") {
			options.race = Number.parseInt(value, 10);
			index += 1;
		}
	}
	if (!Number.isInteger(options.race) || options.race < 1 || options.race > 12) {
		throw new Error("--race must be an integer from 1 to 12");
	}
	return options;
}

async function readJson(filePath) {
	return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

async function runNodeScript(args) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, args, { cwd: projectRoot, stdio: "inherit", env: process.env });
		child.on("error", reject);
		child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`node ${args.join(" ")} failed with exit code ${code ?? "unknown"}`)));
	});
}

async function prepareTempInputs(targetDate) {
	await rm(TEMP_ROOT, { recursive: true, force: true });
	await mkdir(OUTPUT_DIR, { recursive: true });
	const todayPath = path.join(projectRoot, "public", "data", "boatrace", "today.generated.json");
	const detailsPath = path.join(projectRoot, "public", "data", "boatrace", "today-race-details.generated.json");
	const today = await readJson(todayPath);
	const details = await readJson(detailsPath);

	if (targetDate && (today.date !== targetDate || details.date !== targetDate)) {
		await runNodeScript([
			path.join("scripts", "updateBoatTodayRaceDetails.mjs"),
			"--target-date",
			targetDate,
			"--target-venues",
			"edogawa,03",
			"--output-dir",
			OUTPUT_DIR,
		]);
		return;
	}

	await copyFile(todayPath, path.join(OUTPUT_DIR, "today.generated.json"));
	await copyFile(detailsPath, path.join(OUTPUT_DIR, "today-race-details.generated.json"));
}

function count(value) {
	return Array.isArray(value) ? value.length : (value ? 1 : 0);
}

async function main() {
	const options = parseArgs();
	const existingToday = await readJson(path.join(projectRoot, "public", "data", "boatrace", "today.generated.json"));
	const targetDate = normalizeTargetDate(options.targetDate, existingToday.date);
	console.log(`[verify-edogawa] requestedTargetDate=${targetDate}`);
	console.log(`[verify-edogawa] race=${options.race}`);
	console.log("[verify-edogawa] production JSON will not be modified");

	await prepareTempInputs(targetDate);
	await runNodeScript([
		path.join("scripts", "updateBoatVenueExtras.mjs"),
		"--target-date",
		targetDate,
		"--output-dir",
		OUTPUT_DIR,
	]);

	const outputPath = path.join(OUTPUT_DIR, "venue-extras.generated.json");
	await stat(outputPath);
	const feed = await readJson(outputPath);
	const venue = (feed.venues ?? []).find((item) => String(item.venueCode ?? "").padStart(2, "0") === VENUE_CODE || item.venueName === VENUE_NAME);
	if (!venue) {
		console.log("[verify-edogawa] edogawa=0 non-race-day-or-not-in-feed");
		console.log("[verify-edogawa] completed");
		return;
	}
	const race = (venue.races ?? []).find((item) => Number(item.raceNo) === options.race) ?? {};

	console.log(`[verify-edogawa] integrationMode=${venue.integrationMode}`);
	console.log(`[verify-edogawa] dedicatedParserKey=${venue.dedicatedParserKey}`);
	console.log(`[verify-edogawa] entryTable=${count(race.entryTable)} ${race.sourceStatus?.entryTable ?? "-"}`);
	console.log(`[verify-edogawa] officialBeforeInfo=${count(race.officialBeforeInfo?.exhibitionRows)} ${race.sourceStatus?.officialBeforeInfo ?? "-"}`);
	console.log(`[verify-edogawa] flowSpeed=${race.edogawaWaterStrategy?.flowSpeed ? 1 : 0} ${race.sourceStatus?.flowSpeed ?? "-"}`);
	console.log(`[verify-edogawa] waveHeight=${race.edogawaWaterStrategy?.waveHeight ? 1 : 0} ${race.edogawaWaterStrategy?.waveHeight ? "available" : "pending"}`);
	console.log(`[verify-edogawa] waterStrategy=${count(race.edogawaWaterStrategy)} ${race.sourceStatus?.edogawaWaterStrategy ?? "-"}`);
	console.log(`[verify-edogawa] motorSummary=${count(race.motorSummary)} ${race.sourceStatus?.motorSummary ?? "-"}`);
	console.log(`[verify-edogawa] racerCourseStats=${count(race.edogawaRacerCourseStats)} ${race.sourceStatus?.edogawaRacerCourseStats ?? "-"}`);
	console.log(`[verify-edogawa] officialSiteProbes=${count(venue.officialSiteProbes)} ${venue.sourceStatus?.officialSite ?? "-"}`);
	console.log("[verify-edogawa] completed");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
