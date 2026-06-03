import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const TEMP_ROOT = path.join(projectRoot, ".tmp", "amagasaki-verification");
const OUTPUT_DIR = path.join(TEMP_ROOT, "boatrace");
const AMAGASAKI_CODE = "13";
const AMAGASAKI_NAME = "\u5c3c\u5d0e";

const RACE_CATEGORIES = [
	"entryTable",
	"officialBeforeInfo",
	"startExhibition",
	"originalExhibition",
	"motorSummary",
	"scoreQuickLook",
	"amagasakiScoreRateGuide",
	"amagasakiSectionResults",
	"amagasakiFrameLast10",
	"amagasakiNationalRecent3",
	"amagasakiLocalRecent3",
	"amagasakiCourseResults",
	"amagasakiRacerComments",
	"amagasakiPreRacePrediction",
	"waterSurfaceInfo",
	"weatherCondition",
];

const VENUE_CATEGORIES = [
	"motorLotteryAndPrecheck",
	"scoreRanking",
	"amagasakiMotorRanking",
	"amagasakiBoatData",
	"amagasakiDemeRanking",
	"amagasakiResultList",
	"amagasakiPdfLinks",
	"waterSurfaceInfo",
];

const PROBE_URLS = [
	["top", "https://www.boatrace-amagasaki.jp/"],
	["timerank", "https://www.boatrace-amagasaki.jp/modules/raceinfo/?page=index_timerank"],
	["scoreRanking", "https://www.boatrace-amagasaki.jp/modules/raceinfo/?page=index_tokutenrank"],
	["raceCourse", "https://www.boatrace-amagasaki.jp/modules/raceinfo/?page=index_racecourse"],
	["raceCourse8", "https://www.boatrace-amagasaki.jp/modules/raceinfo/?page=index_racecourse&race=8"],
	["resultList", "https://www.boatrace-amagasaki.jp/modules/raceinfo/?page=index_resultlist"],
	["pdf", "https://www.boatrace-amagasaki.jp/modules/raceinfo/?page=index_pdf"],
	["motor", "https://www.boatrace-amagasaki.jp/modules/datafile/"],
	["boat", "https://www.boatrace-amagasaki.jp/modules/datafile/?page=index_boat"],
	["deme", "https://www.boatrace-amagasaki.jp/modules/datafile/?page=index_deme"],
	["water", "https://www.boatrace-amagasaki.jp/modules/datafile/?page=index_suimen"],
];

function parseArgs(argv = process.argv.slice(2)) {
	const options = { targetDate: null, race: 1 };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}
		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];
		if (key === "target-date" || key === "targetDate") {
			options.targetDate = value;
			if (separatorIndex < 0) index += 1;
		} else if (key === "race") {
			options.race = Number.parseInt(value, 10);
			if (separatorIndex < 0) index += 1;
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
		const child = spawn(process.execPath, args, {
			cwd: projectRoot,
			stdio: "inherit",
			env: process.env,
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`node ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
		});
	});
}

function countValue(value) {
	if (Array.isArray(value)) return value.length;
	if (value && typeof value === "object") return Object.keys(value).length;
	return value ? 1 : 0;
}

function classifyStatus(status, count) {
	if (status === "available" || count > 0) return "available";
	if (["available-official-pdf", "not-published", "parse-empty", "http-error", "pending", "waiting", "waiting-amagasaki-data"].includes(status)) return status;
	return count > 0 ? "available" : "parse-empty";
}

function findAmagasakiVenue(feed) {
	return (feed.venues ?? []).find((venue) =>
		String(venue.venueCode ?? "").padStart(2, "0") === AMAGASAKI_CODE || venue.venueName === AMAGASAKI_NAME
	);
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
			"amagasaki,13",
			"--output-dir",
			OUTPUT_DIR,
		]);
		return;
	}

	await copyFile(todayPath, path.join(OUTPUT_DIR, "today.generated.json"));
	await copyFile(detailsPath, path.join(OUTPUT_DIR, "today-race-details.generated.json"));
}

async function probeOfficialPage(label, url) {
	try {
		const response = await fetch(url, {
			headers: {
				"user-agent": "boatrace-datalavo amagasaki verifier",
				"accept-language": "ja,en;q=0.8",
			},
			signal: AbortSignal.timeout(15000),
		});
		const body = await response.text();
		const $ = load(body);
		const text = $("body").text().replace(/\s+/g, " ").trim();
		const title = $("title").text().trim();
		const tables = $("table").length;
		const status = !response.ok ? "http-error" : tables > 0 || text.includes("06/") ? "available" : "not-published";
		return { label, url, httpStatus: response.status, status, tables, title };
	} catch (error) {
		return { label, url, httpStatus: 0, status: "http-error", tables: 0, warning: error instanceof Error ? error.message : String(error) };
	}
}

async function main() {
	const options = parseArgs();
	const existingToday = await readJson(path.join(projectRoot, "public", "data", "boatrace", "today.generated.json"));
	const targetDate = normalizeTargetDate(options.targetDate, existingToday.date);
	console.log(`[verify-amagasaki] requestedTargetDate=${targetDate}`);
	console.log(`[verify-amagasaki] race=${options.race}`);
	console.log("[verify-amagasaki] production JSON will not be modified");

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
	const venue = findAmagasakiVenue(feed);
	if (!venue) {
		console.log("[verify-amagasaki] amagasaki=0 non-race-day-or-not-in-feed");
		for (const probe of await Promise.all(PROBE_URLS.map(([label, url]) => probeOfficialPage(label, url)))) {
			console.log(`[verify-amagasaki] official ${probe.label} status=${probe.status} http=${probe.httpStatus} tables=${probe.tables} url=${probe.url}`);
		}
		console.log("[verify-amagasaki] completed");
		return;
	}

	console.log(`[verify-amagasaki] officialDisplayMode=${venue.officialDisplayMode ?? venue.status ?? ""}`);
	console.log(`[verify-amagasaki] officialTargetDate=${venue.officialTargetDate ?? ""}`);
	console.log(`[verify-amagasaki] venueCode=${venue.venueCode ?? ""}`);
	console.log(`[verify-amagasaki] races=${(venue.races ?? []).length}`);

	const race = (venue.races ?? []).find((item) => Number(item.raceNo) === options.race) ?? null;
	for (const key of RACE_CATEGORIES) {
		const count = countValue(race?.[key]);
		const status = classifyStatus(race?.sourceStatus?.[key] ?? venue.sourceStatus?.[key], count);
		console.log(`[verify-amagasaki] ${key}=${count} ${status}`);
	}

	for (const key of VENUE_CATEGORIES) {
		const count = countValue(venue[key]);
		const status = classifyStatus(venue.sourceStatus?.[key], count);
		console.log(`[verify-amagasaki] ${key}=${count} ${status}`);
	}

	const originalRows = Array.isArray(race?.originalExhibition) ? race.originalExhibition : [];
	console.log(`[verify-amagasaki] original exhibition=${originalRows.length} exhibitionTime=${originalRows.filter((row) => row.exhibitionTime).length} lap=${originalRows.filter((row) => row.oneLapTime || row.lapTime).length} turn=${originalRows.filter((row) => row.turnTime).length} straightTime=${originalRows.filter((row) => row.straightTime).length} not-supported`);

	const raceCourseRows = Array.isArray(race?.amagasakiCourseResults) ? race.amagasakiCourseResults : [];
	console.log(`[verify-amagasaki] courseRows=${raceCourseRows.reduce((total, row) => total + (Array.isArray(row.courseRows) ? row.courseRows.length : 0), 0)}`);
	console.log(`[verify-amagasaki] venueLevelDuplicatedInRace=${Boolean(race?.amagasakiMotorRanking || race?.amagasakiDemeRanking || race?.amagasakiResultList)}`);

	for (const probe of await Promise.all(PROBE_URLS.map(([label, url]) => probeOfficialPage(label, url)))) {
		console.log(`[verify-amagasaki] official ${probe.label} status=${probe.status} http=${probe.httpStatus} tables=${probe.tables} url=${probe.url}`);
	}

	console.log("[verify-amagasaki] completed");
}

main().catch((error) => {
	console.error(`[verify-amagasaki] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
