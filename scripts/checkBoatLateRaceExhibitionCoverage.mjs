import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonIfExists } from "./boatExhibitionSnapshotPreservation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) continue;
		const [key, inlineValue] = token.slice(2).split("=", 2);
		if (key === "output-dir" || key === "outputDir") {
			parsed.outputDir = inlineValue ?? argv[index + 1];
			if (inlineValue === undefined) index += 1;
		}
	}
	return parsed;
}

function getJstNowParts(now = new Date()) {
	const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		minutes: Number(parts.hour) * 60 + Number(parts.minute),
	};
}

function parseTimeMinutes(value) {
	const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})$/u);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	return hours >= 0 && hours <= 29 && minutes >= 0 && minutes <= 59 ? hours * 60 + minutes : null;
}

function isDeadlinePassed(feedDate, deadlineTime, nowParts) {
	if (feedDate < nowParts.date) return true;
	if (feedDate > nowParts.date) return false;
	const deadlineMinutes = parseTimeMinutes(deadlineTime);
	return deadlineMinutes !== null && nowParts.minutes >= deadlineMinutes;
}

function countExhibitionTimes(race) {
	const rows = Array.isArray(race?.exhibitions) ? race.exhibitions : [];
	const rowCount = rows.filter((row) => [row?.exhibitionTime, row?.displayTime, row?.time]
		.some((value) => typeof value === "string" && value.trim())).length;
	const coverageCount = Number(race?.exhibitionCoverage?.timeAvailableCount);
	return Math.max(rowCount, Number.isFinite(coverageCount) ? coverageCount : 0);
}

function auditVenue(feedDate, venue, nowParts) {
	const currentRaceNo = Number(venue?.currentRaceNo);
	const lateRaces = (Array.isArray(venue?.races) ? venue.races : [])
		.filter((race) => Number(race?.raceNo) >= 7 && Number(race?.raceNo) <= 12)
		.sort((left, right) => Number(left.raceNo) - Number(right.raceNo));
	const races = lateRaces.map((race) => {
		const raceNo = Number(race.raceNo);
		const expected = isDeadlinePassed(feedDate, race.deadlineTime, nowParts)
			|| (Number.isFinite(currentRaceNo) && currentRaceNo >= raceNo);
		const timeAvailableCount = countExhibitionTimes(race);
		return {
			venueName: venue?.venueName ?? "",
			venueCode: venue?.venueCode ?? "",
			session: venue?.session ?? "unknown",
			raceNo,
			deadlineTime: race?.deadlineTime ?? "",
			currentRaceNo: Number.isFinite(currentRaceNo) ? currentRaceNo : null,
			expected,
			timeAvailableCount,
			exhibitionCoverageStatus: race?.exhibitionCoverage?.status ?? "unknown",
			source: race?.exhibitionCoverage?.source ?? race?.source ?? "unknown",
		};
	});
	const expectedRaces = races.filter((race) => race.expected);
	const missingExpectedRaces = expectedRaces.filter((race) => race.timeAvailableCount === 0);
	const allExpectedLateRacesMissing = races.length > 0
		&& expectedRaces.length === races.length
		&& missingExpectedRaces.length === races.length;
	return {
		venueName: venue?.venueName ?? "",
		venueCode: venue?.venueCode ?? "",
		session: venue?.session ?? "unknown",
		lateRaceCount: races.length,
		lateAvailableRaceCount: races.filter((race) => race.timeAvailableCount > 0).length,
		lateMissingExpectedRaceCount: missingExpectedRaces.length,
		allExpectedLateRacesMissing,
		missingExpectedRaces,
	};
}

async function main() {
	const cliArgs = parseCliArgs();
	const outputDirectory = cliArgs.outputDir
		? path.resolve(projectRoot, cliArgs.outputDir)
		: path.join(projectRoot, "public", "data", "boatrace");
	const detailsPath = path.join(outputDirectory, "today-race-details.generated.json");
	const feed = await readJsonIfExists(detailsPath);
	if (!feed || !String(feed.date ?? "").trim() || !Array.isArray(feed.venues) || feed.venues.length === 0) {
		throw new Error(`invalid today race details feed: ${detailsPath}`);
	}

	const nowParts = getJstNowParts();
	const venues = feed.venues.map((venue) => auditVenue(feed.date, venue, nowParts));
	const errors = venues.filter((venue) => venue.allExpectedLateRacesMissing);
	const warnings = venues
		.filter((venue) => !venue.allExpectedLateRacesMissing)
		.flatMap((venue) => venue.missingExpectedRaces);
	const mikuni = venues.find((venue) => venue.venueName === "三国" || String(venue.venueCode).padStart(2, "0") === "10") ?? null;
	const result = {
		ok: errors.length === 0,
		date: feed.date,
		nowJstDate: nowParts.date,
		venueCount: venues.length,
		errorVenueCount: errors.length,
		warningRaceCount: warnings.length,
		mikuni,
		venues: venues.map(({ missingExpectedRaces, ...venue }) => venue),
		errors,
		warnings,
	};

	console.log(JSON.stringify(result, null, 2));
	if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
	console.error("[check-late-race-exhibition-coverage] failed");
	console.error(error);
	process.exitCode = 1;
});
