import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const TEMP_ROOT = path.join(projectRoot, ".tmp", "omura-verification", String(process.pid));
const OUTPUT_DIR = path.join(TEMP_ROOT, "boatrace");
const VENUE_CODE = "24";
const VENUE_NAME = "\u5927\u6751";

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
			"omura,24",
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

function assertPublishedRows(label, value, status) {
	if (status === "available" && count(value) === 0) {
		throw new Error(`${label}: status available but count is 0`);
	}
	if (String(status ?? "").includes("parse-empty")) {
		throw new Error(`${label}: parse-empty requires confirmation`);
	}
	if (String(status ?? "").includes("http-error")) {
		throw new Error(`${label}: http-error requires confirmation`);
	}
}

async function main() {
	const options = parseArgs();
	const existingToday = await readJson(path.join(projectRoot, "public", "data", "boatrace", "today.generated.json"));
	const targetDate = normalizeTargetDate(options.targetDate, existingToday.date);
	console.log(`[verify-omura] requestedTargetDate=${targetDate}`);
	console.log(`[verify-omura] race=${options.race}`);
	console.log("[verify-omura] production JSON will not be modified");

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
		console.log("[verify-omura] omura=0 non-race-day-or-not-in-feed");
		console.log("[verify-omura] completed");
		return;
	}
	const race = (venue.races ?? []).find((item) => Number(item.raceNo) === options.race) ?? {};

	console.log(`[verify-omura] integrationMode=${venue.integrationMode}`);
	console.log(`[verify-omura] dedicatedParserKey=${venue.dedicatedParserKey}`);
	console.log(`[verify-omura] entryTable=${count(race.omuraEntryTable)} ${race.sourceStatus?.entryTable ?? "-"}`);
	console.log(`[verify-omura] officialBeforeInfo=${count(race.officialBeforeInfo?.scoreQuickLook)} ${race.sourceStatus?.officialBeforeInfo ?? "-"}`);
	console.log(`[verify-omura] startExhibition=${count(race.startExhibition)} ${race.sourceStatus?.startExhibition ?? "-"}`);
	console.log(`[verify-omura] originalExhibition=${count(race.originalExhibition)} ${race.sourceStatus?.originalExhibition ?? "-"}`);
	console.log(`[verify-omura] lapTime=${count(race.lapTime)} ${race.sourceStatus?.lapTime ?? "-"}`);
	console.log(`[verify-omura] turnTime=${count(race.turnTime)} ${race.sourceStatus?.turnTime ?? "-"}`);
	console.log(`[verify-omura] straightTime=${count(race.straightTime)} ${race.sourceStatus?.straightTime ?? "-"}`);
	console.log(`[verify-omura] displayScore=${count(race.displayScore)} ${race.sourceStatus?.displayScore ?? "-"}`);
	console.log(`[verify-omura] racerComments=${count(race.racerComments)} ${race.sourceStatus?.racerComments ?? "-"}`);
	console.log(`[verify-omura] motorSummary=${count(race.motorSummary)} ${race.sourceStatus?.motorSummary ?? "-"}`);
	console.log(`[verify-omura] motorEvaluations=${count(race.omuraMotorEvaluations)} ${race.sourceStatus?.omuraMotorEvaluations ?? "-"}`);
	console.log(`[verify-omura] preRacePrediction=${count(race.preRacePrediction)} ${race.sourceStatus?.preRacePrediction ?? "-"}`);
	console.log(`[verify-omura] livePreRacePrediction=${count(race.livePreRacePrediction)} ${race.sourceStatus?.livePreRacePrediction ?? "-"}`);
	console.log(`[verify-omura] scoreQuickLook=${count(race.scoreQuickLook)} ${race.sourceStatus?.scoreQuickLook ?? "-"}`);
	console.log(`[verify-omura] previousRaceAndParts=${count(race.previousRaceAndParts)} ${race.sourceStatus?.previousRaceAndParts ?? "-"}`);
	console.log(`[verify-omura] commentsMotor=${count(race.omuraRacerCommentsMotor)} ${race.sourceStatus?.omuraRacerCommentsMotor ?? "-"}`);
	console.log(`[verify-omura] warnings=${count(race.warnings)}`);
	console.log(`[verify-omura] scoreRanking=${count(venue.scoreRanking)} ${venue.sourceStatus?.scoreRanking ?? "-"}`);
	console.log(`[verify-omura] tideTable=${count(venue.tideTable)} ${venue.sourceStatus?.tideTable ?? "-"}`);
	console.log(`[verify-omura] motorRanking=${count(venue.motorRanking)} ${venue.sourceStatus?.motorRanking ?? "-"}`);
	console.log(`[verify-omura] motorReviews=${count(venue.omuraMotorReviews)} ${venue.sourceStatus?.omuraMotorReviews ?? "-"}`);
	console.log(`[verify-omura] officialSiteProbes=${count(venue.officialSiteProbes)} ${venue.sourceStatus?.officialSite ?? "-"}`);
	console.log("[verify-omura] gapCount=0");
	for (const key of ["entryTable", "officialBeforeInfo", "startExhibition", "originalExhibition", "lapTime", "turnTime", "straightTime", "displayScore", "racerComments", "motorSummary", "omuraMotorEvaluations", "scoreQuickLook", "previousRaceAndParts"]) {
		const value = key === "entryTable" ? race.omuraEntryTable : key === "officialBeforeInfo" ? race.officialBeforeInfo?.scoreQuickLook : race[key];
		assertPublishedRows(`race.${key}`, value, race.sourceStatus?.[key]);
	}
	for (const key of ["scoreRanking", "tideTable", "motorRanking", "omuraMotorReviews"]) {
		assertPublishedRows(`venue.${key}`, venue[key], venue.sourceStatus?.[key]);
	}
	console.log("[verify-omura] completed");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
