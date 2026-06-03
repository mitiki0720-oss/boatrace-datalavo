import { copyFile, mkdir, readFile, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load } from "cheerio";
import { normalizeTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const TEMP_ROOT = path.join(projectRoot, ".tmp", "miyajima-verification");
const OUTPUT_DIR = path.join(TEMP_ROOT, "boatrace");
const MIYAJIMA_CODE = "17";
const MIYAJIMA_NAME = "\u5bae\u5cf6";

const RACE_CATEGORIES = [
	"entryTable",
	"officialBeforeInfo",
	"startExhibition",
	"originalExhibition",
	"motorSummary",
	"scoreQuickLook",
	"miyajimaScoreRateGuide",
	"miyajimaSectionResults",
	"miyajimaFrameLast10",
	"miyajimaNationalRecent3",
	"miyajimaLocalRecent3",
	"miyajimaCourseResults",
	"miyajimaMotorHistory",
	"waterSurfaceInfo",
	"weatherCondition",
];

const VENUE_CATEGORIES = [
	"motorLotteryAndPrecheck",
	"scoreRanking",
	"frameCourseAcquisitionRates",
	"courseSummary",
	"waterSurfaceInfo",
	"weatherCondition",
];

const PROBE_URLS = [
	["top", "https://www.boatrace-miyajima.com/"],
	["racecard", "https://www.boatrace-miyajima.com/racecard.html"],
	["racedata", "https://www.boatrace-miyajima.com/racedata.html"],
	["timerank", "https://www.boatrace-miyajima.com/raceinfo_timerank.html"],
	["scoreRanking", "https://www.boatrace-miyajima.com/yosen_point_rank.html"],
	["results", "https://www.boatrace-miyajima.com/results.html"],
	["surface", "https://www.boatrace-miyajima.com/surface.html"],
	["weatherLive", "https://www.boatrace-miyajima.com/weather_live/data/weather.txt"],
];

function parseArgs(argv = process.argv.slice(2)) {
	const options = {
		targetDate: null,
		race: 1,
		allowTomorrowPreview: false,
	};

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
			if (separatorIndex < 0) {
				index += 1;
			}
		} else if (key === "race") {
			options.race = Number.parseInt(value, 10);
			if (separatorIndex < 0) {
				index += 1;
			}
		} else if (key === "allow-tomorrow-preview") {
			options.allowTomorrowPreview = true;
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
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`node ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
			}
		});
	});
}

function countValue(value) {
	if (Array.isArray(value)) {
		return value.length;
	}
	return value ? 1 : 0;
}

function classifyStatus(status, count) {
	if (status === "available" || count > 0) {
		return "available";
	}
	if (["today", "live", "ended", "partial", "tomorrow-preview", "non-race-day", "not-published", "parse-empty", "http-error", "pending"].includes(status)) {
		return status;
	}
	return count > 0 ? "available" : "parse-empty";
}

function findMiyajimaVenue(feed) {
	return (feed.venues ?? []).find((venue) =>
		String(venue.venueCode ?? "").padStart(2, "0") === MIYAJIMA_CODE || venue.venueName === MIYAJIMA_NAME
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
			"miyajima,17",
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
				"user-agent": "boatrace-datalavo miyajima verifier",
				"accept-language": "ja,en;q=0.8",
			},
			signal: AbortSignal.timeout(15000),
		});
		const body = await response.text();
		const isJson = body.trim().startsWith("{") || body.trim().startsWith("[");
		const $ = isJson ? null : load(body);
		const text = isJson ? body : $("body").text().replace(/\s+/g, " ").trim();
		const title = isJson ? "" : $("title").text().trim();
		const tables = isJson ? 0 : $("table").length;
		const status = !response.ok
			? "http-error"
			: /非開催/.test(text)
				? "non-race-day"
				: /明日の情報|翌日/.test(text)
					? "tomorrow-preview"
					: tables > 0 || isJson
						? "available"
						: "not-published";
		return { label, url, httpStatus: response.status, status, tables, title };
	} catch (error) {
		return { label, url, httpStatus: 0, status: "http-error", tables: 0, warning: error instanceof Error ? error.message : String(error) };
	}
}

async function main() {
	const options = parseArgs();
	const existingToday = await readJson(path.join(projectRoot, "public", "data", "boatrace", "today.generated.json"));
	const targetDate = normalizeTargetDate(options.targetDate, existingToday.date);
	console.log(`[verify-miyajima] requestedTargetDate=${targetDate}`);
	console.log(`[verify-miyajima] race=${options.race}`);
	console.log("[verify-miyajima] production JSON will not be modified");

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
	const venue = findMiyajimaVenue(feed);
	if (!venue) {
		console.log("[verify-miyajima] miyajima=0 non-race-day-or-not-in-feed");
		for (const probe of await Promise.all(PROBE_URLS.map(([label, url]) => probeOfficialPage(label, url)))) {
			console.log(`[verify-miyajima] official ${probe.label} status=${probe.status} http=${probe.httpStatus} tables=${probe.tables} url=${probe.url}`);
		}
		console.log("[verify-miyajima] completed");
		return;
	}

	console.log(`[verify-miyajima] officialDisplayMode=${venue.officialDisplayMode ?? venue.status ?? ""}`);
	console.log(`[verify-miyajima] officialTargetDate=${venue.officialTargetDate ?? ""}`);
	console.log(`[verify-miyajima] mergeAllowed=${Boolean(venue.isAvailable)}`);

	const race = (venue.races ?? []).find((item) => Number(item.raceNo) === options.race) ?? null;
	for (const key of RACE_CATEGORIES) {
		const count = countValue(race?.[key]);
		const status = classifyStatus(race?.sourceStatus?.[key] ?? venue.sourceStatus?.[key], count);
		console.log(`[verify-miyajima] ${key}=${count} ${status}`);
	}

	for (const key of VENUE_CATEGORIES) {
		const count = countValue(venue[key]);
		const status = classifyStatus(venue.sourceStatus?.[key], count);
		console.log(`[verify-miyajima] ${key}=${count} ${status}`);
	}

	for (const probe of await Promise.all(PROBE_URLS.map(([label, url]) => probeOfficialPage(label, url)))) {
		console.log(`[verify-miyajima] official ${probe.label} status=${probe.status} http=${probe.httpStatus} tables=${probe.tables} url=${probe.url}`);
	}

	const warnings = Array.from(new Set([...(venue.warnings ?? []), ...(race?.warnings ?? [])]));
	for (const warning of warnings) {
		console.log(`[verify-miyajima] warning=${warning}`);
	}

	if (!options.allowTomorrowPreview && venue.officialDisplayMode === "tomorrow-preview" && venue.officialTargetDate !== targetDate) {
		throw new Error("miyajima official page is tomorrow-preview for a different target date");
	}

	console.log("[verify-miyajima] completed");
}

main().catch((error) => {
	console.error(`[verify-miyajima] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
