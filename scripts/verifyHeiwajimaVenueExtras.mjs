import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const tempRoot = path.join(projectRoot, ".tmp", "heiwajima-verification");
const outputDir = path.join(tempRoot, "boatrace");
const venueCode = "04";
const venueName = "\u5e73\u548c\u5cf6";

function parseArgs(argv = process.argv.slice(2)) {
	const options = { targetDate: null, race: 1 };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) continue;
		const [rawKey, inlineValue] = token.slice(2).split("=", 2);
		const value = inlineValue ?? argv[index + 1];
		if (rawKey === "target-date" || rawKey === "targetDate") {
			options.targetDate = value;
			if (inlineValue === undefined) index += 1;
		} else if (rawKey === "race") {
			options.race = Number.parseInt(value, 10);
			if (inlineValue === undefined) index += 1;
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
	await new Promise((resolve, reject) => {
		const child = spawn(process.execPath, args, {
			cwd: projectRoot,
			stdio: "inherit",
			env: process.env,
		});
		child.on("error", reject);
		child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`node ${args.join(" ")} failed with exit code ${code ?? "unknown"}`)));
	});
}

async function prepareInputs(targetDate) {
	await rm(tempRoot, { recursive: true, force: true });
	await mkdir(outputDir, { recursive: true });
	const sourceDir = path.join(projectRoot, "public", "data", "boatrace");
	const todayPath = path.join(sourceDir, "today.generated.json");
	const detailsPath = path.join(sourceDir, "today-race-details.generated.json");
	const [today, details] = await Promise.all([readJson(todayPath), readJson(detailsPath)]);

	if (today.date !== targetDate || details.date !== targetDate) {
		await runNodeScript([
			path.join("scripts", "updateBoatTodayRaceDetails.mjs"),
			"--target-date",
			targetDate,
			"--target-venues",
			"heiwajima,04",
			"--output-dir",
			outputDir,
		]);
		return;
	}

	await Promise.all([
		copyFile(todayPath, path.join(outputDir, "today.generated.json")),
		copyFile(detailsPath, path.join(outputDir, "today-race-details.generated.json")),
	]);
}

function findVenue(feed) {
	return (feed.venues ?? []).find((venue) =>
		String(venue.venueCode ?? "").padStart(2, "0") === venueCode || venue.venueName === venueName
	);
}

async function main() {
	const options = parseArgs();
	const existingToday = await readJson(path.join(projectRoot, "public", "data", "boatrace", "today.generated.json"));
	const targetDate = normalizeTargetDate(options.targetDate, existingToday.date);
	console.log(`[verify-heiwajima] requestedTargetDate=${targetDate}`);
	console.log("[verify-heiwajima] production JSON will not be modified");

	await prepareInputs(targetDate);
	await runNodeScript([
		path.join("scripts", "updateBoatVenueExtras.mjs"),
		"--target-date",
		targetDate,
		"--output-dir",
		outputDir,
	]);

	const outputPath = path.join(outputDir, "venue-extras.generated.json");
	await stat(outputPath);
	const feed = await readJson(outputPath);
	const venue = findVenue(feed);
	if (!venue) {
		console.log("[verify-heiwajima] skipped (not held on target date)");
		return;
	}

	assert.equal(venue.integrationMode, "venue-official");
	assert.equal(venue.officialVenueExtrasSupported, true);
	assert.equal(venue.dedicatedParserKey, "heiwajima");
	assert.equal((venue.races ?? []).length, 12, "held Heiwajima should expose 12 races");
	const race = venue.races.find((item) => Number(item.raceNo) === options.race);
	assert.ok(race, `${options.race}R should exist`);
	assert.equal(race.entryTable?.length, 6, "entry table should contain six racers");
	assert.equal(race.motorSummary?.length, 6, "motor summary should contain six racers");
	assert.ok(race.entryTable.every((row) => row.frameNo >= 1 && row.frameNo <= 6), "frames should be normalized");
	assert.ok(race.motorSummary.every((row) => row.motorNo && row.boatNo), "motor and boat numbers should be present");
	const oddsCount = race.heiwajimaTrifectaOdds?.length ?? 0;
	assert.ok(oddsCount === 0 || oddsCount === 120, "trifecta odds must be empty or complete 120 rows");

	console.log(`[verify-heiwajima] status=${venue.status} integrationMode=${venue.integrationMode}`);
	console.log(`[verify-heiwajima] races=${venue.races.length} entry=${race.entryTable.length} motor=${race.motorSummary.length}`);
	console.log(`[verify-heiwajima] before=${race.beforeInfo?.length ?? 0} start=${race.startExhibition?.length ?? 0} original=${race.originalExhibition?.length ?? 0}`);
	console.log(`[verify-heiwajima] trifectaOdds=${oddsCount} classification=${oddsCount === 120 ? "complete" : race.sourceStatus?.trifectaOdds}`);
	console.log(`[verify-heiwajima] sourceStatus=${JSON.stringify(race.sourceStatus)}`);
	console.log("[verify-heiwajima] completed");
}

main().catch((error) => {
	console.error(`[verify-heiwajima] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
