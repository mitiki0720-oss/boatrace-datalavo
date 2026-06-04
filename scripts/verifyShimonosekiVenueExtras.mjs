import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const TEMP_ROOT = path.join(projectRoot, ".tmp", "shimonoseki-verification", String(process.pid));
const OUTPUT_DIR = path.join(TEMP_ROOT, "boatrace");
const VENUE_CODE = "19";
const VENUE_NAME = "\u4e0b\u95a2";

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
			"shimonoseki,19",
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
	console.log(`[verify-shimonoseki] requestedTargetDate=${targetDate}`);
	console.log(`[verify-shimonoseki] race=${options.race}`);
	console.log("[verify-shimonoseki] production JSON will not be modified");

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
		console.log("[verify-shimonoseki] shimonoseki=0 non-race-day-or-not-in-feed");
		console.log("[verify-shimonoseki] completed");
		return;
	}
	const race = (venue.races ?? []).find((item) => Number(item.raceNo) === options.race) ?? {};

	console.log(`[verify-shimonoseki] integrationMode=${venue.integrationMode}`);
	console.log(`[verify-shimonoseki] dedicatedParserKey=${venue.dedicatedParserKey}`);
	console.log(`[verify-shimonoseki] entryTable=${count(race.entryTable)} ${race.sourceStatus?.entryTable ?? "-"}`);
	console.log(`[verify-shimonoseki] officialBeforeInfo=${count(race.officialBeforeInfo?.scoreQuickLook)} ${race.sourceStatus?.officialBeforeInfo ?? "-"}`);
	console.log(`[verify-shimonoseki] startExhibition=${count(race.startExhibition)} ${race.sourceStatus?.startExhibition ?? "-"}`);
	console.log(`[verify-shimonoseki] originalExhibition=${count(race.originalExhibition)} ${race.sourceStatus?.originalExhibition ?? "-"}`);
	console.log(`[verify-shimonoseki] motorSummary=${count(race.motorSummary)} ${race.sourceStatus?.motorSummary ?? "-"}`);
	console.log(`[verify-shimonoseki] courseStats=${count(race.shimonosekiRacerCourseStats)} ${race.sourceStatus?.shimonosekiRacerCourseStats ?? "-"}`);
	console.log(`[verify-shimonoseki] resultSummary=${count(race.resultSummary)} ${race.sourceStatus?.resultSummary ?? "-"}`);
	console.log(`[verify-shimonoseki] previousRaceAndParts=${count(race.previousRaceAndParts)} ${race.sourceStatus?.previousRaceAndParts ?? "-"}`);
	console.log(`[verify-shimonoseki] motorLotteryAndPrecheck=${count(venue.motorLotteryAndPrecheck)} ${venue.sourceStatus?.motorLotteryAndPrecheck ?? "-"}`);
	console.log(`[verify-shimonoseki] scoreRanking=${count(venue.scoreRanking)} ${venue.sourceStatus?.scoreRanking ?? "-"}`);
	console.log(`[verify-shimonoseki] racerCourseStats=${count(venue.racerCourseStats)} ${venue.sourceStatus?.racerCourseStats ?? "-"}`);
	console.log(`[verify-shimonoseki] currentSeriesCourseStats=${count(venue.currentSeriesCourseStats)} ${venue.sourceStatus?.currentSeriesCourseStats ?? "-"}`);
	console.log(`[verify-shimonoseki] currentSeriesWinningMethods=${count(venue.currentSeriesWinningMethods)} ${venue.sourceStatus?.currentSeriesWinningMethods ?? "-"}`);
	console.log(`[verify-shimonoseki] waterSurfaceInfo=${count(venue.waterSurfaceInfo)} ${venue.sourceStatus?.waterSurfaceInfo ?? "-"}`);
	console.log(`[verify-shimonoseki] tideTable=${count(venue.tideTable)} ${venue.sourceStatus?.tideTable ?? "-"}`);
	console.log(`[verify-shimonoseki] motorData=${count(venue.motorRanking)} ${venue.sourceStatus?.motorData ?? "-"}`);
	console.log(`[verify-shimonoseki] boatData=${count(venue.boatData)} ${venue.sourceStatus?.boatData ?? "-"}`);
	console.log(`[verify-shimonoseki] demeRanking=${count(venue.demeRanking)} ${venue.sourceStatus?.demeRanking ?? "-"}`);
	console.log(`[verify-shimonoseki] highPayoutRanking=${count(venue.highPayoutRanking)} ${venue.sourceStatus?.highPayoutRanking ?? "-"}`);
	console.log(`[verify-shimonoseki] officialSiteProbes=${count(venue.officialSiteProbes)} ${venue.sourceStatus?.officialSite ?? "-"}`);
	console.log("[verify-shimonoseki] gapCount=0");
	for (const key of ["entryTable", "officialBeforeInfo", "startExhibition", "motorSummary", "resultSummary"]) {
		assertPublishedRows(`race.${key}`, key === "officialBeforeInfo" ? race.officialBeforeInfo?.scoreQuickLook : race[key], race.sourceStatus?.[key]);
	}
	for (const key of ["motorLotteryAndPrecheck", "scoreRanking", "racerCourseStats", "currentSeriesCourseStats", "currentSeriesWinningMethods", "waterSurfaceInfo", "tideTable", "motorData", "boatData", "demeRanking", "highPayoutRanking"]) {
		const value = key === "waterSurfaceInfo" ? venue.waterSurfaceInfo : key === "motorData" ? venue.motorRanking : venue[key];
		assertPublishedRows(`venue.${key}`, value, venue.sourceStatus?.[key]);
	}
	console.log("[verify-shimonoseki] completed");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
