import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const venueExtrasPath = path.join(projectRoot, "public", "data", "boatrace", "venue-extras.generated.json");
const outputDir = path.join(projectRoot, ".tmp", "biwako-verification");

const allowedStatuses = new Set([
	"available",
	"partial",
	"pending",
	"not-published",
	"optional",
	"parse-empty",
	"http-error",
	"http-failure",
	"not-supported",
]);

const commonCategories = [
	["resultList", (venue) => venue.biwakoResultList],
	["scoreRanking", (venue) => venue.biwakoScoreRanking],
	["waterSurface", (venue) => venue.waterSurfaceInfo],
	["currentSeriesCourseStats", (venue) => venue.biwakoCurrentSeriesCourseStats],
	["currentSeriesWinningMethods", (venue) => venue.biwakoCurrentSeriesWinningMethods],
];

const raceCategories = [
	["officialBeforeInfo.exhibitionRows", (race) => race.officialBeforeInfo?.exhibitionRows, "beforeInfo"],
	["startExhibition", (race) => race.startExhibition, "startExhibition"],
	["originalExhibition", (race) => race.originalExhibition, "originalExhibition"],
	["motorSummary", (race) => race.motorSummary, "motor"],
	["biwakoRacerCourseStats", (race) => race.biwakoRacerCourseStats, "racerCourseStats"],
	["biwakoSeriesResults", (race) => race.biwakoSeriesResults, "currentSeriesStats"],
	["biwakoFramePast10", (race) => race.biwakoFramePast10, "frameLast10"],
	["biwakoScoreRateGuide", (race) => race.biwakoScoreRateGuide, "score"],
	["biwakoScoreRanking", (race) => race.biwakoScoreRanking, "score"],
];

const officialUrls = [
	{ label: "sp-entry", url: "https://www.boatrace-biwako.jp/sp/index.php?page=yosou-syussou&race=1" },
	{ label: "sp-before", url: "https://www.boatrace-biwako.jp/sp/index.php?page=yosou-cyokuzen&race=1" },
	{ label: "sp-odds-result", url: "https://www.boatrace-biwako.jp/sp/index.php?page=yosou-odds_result&race=1" },
	{ label: "sp-result-list", url: "https://www.boatrace-biwako.jp/sp/index.php?page=datafile-resultlist" },
	{ label: "pc-score", url: "https://www.boatrace-biwako.jp/modules/raceinfo/?page=index_tokutenrank" },
	{ label: "pc-timerank", url: "https://www.boatrace-biwako.jp/modules/raceinfo/?page=index_timerank" },
	{ label: "pc-racecourse", url: "https://www.boatrace-biwako.jp/modules/raceinfo/?page=index_racecourse" },
	{ label: "pc-current-series", url: "https://www.boatrace-biwako.jp/modules/raceinfo/?page=index_konsetsu" },
	{ label: "pc-water", url: "https://www.boatrace-biwako.jp/modules/datafile/?page=index_suimen" },
	{ label: "pc-motor-rank", url: "https://www.boatrace-biwako.jp/modules/datafile/?page=index_motorrank" },
	{ label: "pc-boat", url: "https://www.boatrace-biwako.jp/modules/datafile/?page=index_boat" },
	{ label: "pc-motor-history-sample", url: "https://www.boatrace-biwako.jp/modules/datafile/?motor_no=56&page=index_motor_hist&start=7" },
	{ label: "official-ai-root", url: "https://ai.boatrace-biwako.jp/", optional: true },
	{ label: "official-ai-robots", url: "https://ai.boatrace-biwako.jp/robots.txt", optional: true },
];

function parseArgs(argv = process.argv.slice(2)) {
	const parsed = { race: null, targetDate: null };
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}
		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];
		if (separatorIndex < 0) {
			index += 1;
		}
		if (key === "race") {
			parsed.race = Number(value);
		}
		if (key === "target-date" || key === "targetDate") {
			parsed.targetDate = String(value ?? "").trim();
		}
	}
	return parsed;
}

function countValue(value) {
	if (Array.isArray(value)) {
		return value.length;
	}
	return value ? 1 : 0;
}

function summarizeStatuses(sourceStatus = {}) {
	const invalid = [];
	for (const [key, status] of Object.entries(sourceStatus)) {
		if (!allowedStatuses.has(status)) {
			invalid.push({ key, status });
		}
	}
	return invalid;
}

async function checkUrl({ label, url, optional = false }) {
	try {
		const response = await fetch(url, {
			headers: {
				"user-agent": "Mozilla/5.0",
				"accept-language": "ja,en;q=0.8",
			},
			signal: AbortSignal.timeout(12000),
		});
		const text = await response.text();
		return {
			label,
			url,
			optional,
			status: response.status,
			ok: response.ok,
			bytes: Buffer.byteLength(text),
			hasHtml: /<html|<table|<body/i.test(text),
		};
	} catch (error) {
		return {
			label,
			url,
			optional,
			status: "error",
			ok: false,
			error: error.message,
		};
	}
}

async function main() {
	const args = parseArgs();
	const payload = JSON.parse(await readFile(venueExtrasPath, "utf8"));
	const venue = (payload.venues ?? []).find((item) => item.venueName === "びわこ" || item.venueCode === "11");

	if (!venue) {
		throw new Error("びわこ entry is missing from venue-extras.generated.json");
	}

	if (args.targetDate && args.targetDate !== payload.date) {
		throw new Error(`target-date ${args.targetDate} does not match generated JSON date ${payload.date}`);
	}

	const races = (venue.races ?? []).filter((race) => !args.race || Number(race.raceNo) === args.race);
	if (args.race && races.length === 0) {
		throw new Error(`びわこ ${args.race}R is missing from venue-extras.generated.json`);
	}

	const commonCounts = Object.fromEntries(commonCategories.map(([key, read]) => [key, countValue(read(venue))]));
	const raceSummaries = races.map((race) => ({
		raceNo: race.raceNo,
		status: race.status,
		counts: Object.fromEntries(raceCategories.map(([key, read]) => [key, countValue(read(race))])),
		sourceStatus: race.sourceStatus ?? {},
		invalidSourceStatuses: summarizeStatuses(race.sourceStatus ?? {}),
		warnings: race.warnings ?? [],
	}));
	const venueInvalidSourceStatuses = summarizeStatuses(venue.sourceStatus ?? {});
	const urlChecks = await Promise.all(officialUrls.map(checkUrl));

	const summary = {
		generatedDate: payload.date,
		generatedAt: payload.generatedAt,
		venue: {
			venueCode: venue.venueCode,
			venueName: venue.venueName,
			status: venue.status,
			isAvailable: venue.isAvailable,
			sourceStatus: venue.sourceStatus ?? {},
			invalidSourceStatuses: venueInvalidSourceStatuses,
			warnings: venue.warnings ?? [],
			commonCounts,
			raceCount: venue.races?.length ?? 0,
			entryBytes: Buffer.byteLength(JSON.stringify(venue)),
		},
		selectedRaceCount: races.length,
		races: raceSummaries,
		urlChecks,
	};

	const missingRaceCategories = raceSummaries.flatMap((race) =>
		raceCategories
			.filter(([key, , statusKey]) => {
				if (key === "biwakoScoreRateGuide") {
					return false;
				}
				return race.sourceStatus?.[statusKey] === "available" && race.counts[key] === 0;
			})
			.map(([key]) => `${race.raceNo}R ${key}`),
	);
	const failedUrls = urlChecks.filter((check) => !check.optional && !check.ok);
	const invalidStatuses = [
		...venueInvalidSourceStatuses.map((item) => `venue.${item.key}=${item.status}`),
		...raceSummaries.flatMap((race) => race.invalidSourceStatuses.map((item) => `${race.raceNo}R.${item.key}=${item.status}`)),
	];

	await mkdir(outputDir, { recursive: true });
	const outputPath = path.join(outputDir, `summary-${payload.date}${args.race ? `-${args.race}R` : ""}.json`);
	await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

	console.log(`[verify:biwako] date ${payload.date} / venue races ${venue.races?.length ?? 0} / selected ${races.length}`);
	console.log(`[verify:biwako] venue common counts ${JSON.stringify(commonCounts)}`);
	for (const race of raceSummaries.slice(0, 12)) {
		console.log(`[verify:biwako] ${race.raceNo}R counts ${JSON.stringify(race.counts)} warnings=${race.warnings.length}`);
	}
	console.log(`[verify:biwako] url checks ${urlChecks.filter((check) => check.ok).length}/${urlChecks.length} ok`);
	console.log(`[verify:biwako] wrote ${path.relative(projectRoot, outputPath)}`);

	if (invalidStatuses.length > 0) {
		throw new Error(`invalid sourceStatus values: ${invalidStatuses.join(", ")}`);
	}
	if (missingRaceCategories.length > 0) {
		throw new Error(`missing required race categories: ${missingRaceCategories.slice(0, 20).join(", ")}`);
	}
	if (failedUrls.length > 0) {
		throw new Error(`official URL checks failed: ${failedUrls.map((check) => check.label).join(", ")}`);
	}
}

main().catch((error) => {
	console.error(`[verify:biwako] ${error.message}`);
	process.exitCode = 1;
});
