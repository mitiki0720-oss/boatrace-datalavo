import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJstTimestamp, getJstTimestampParts, normalizeTargetDate } from "./boatRaceDate.mjs";
import { main as updateTodayRaceDetails } from "./updateBoatTodayRaceDetails.mjs";
import { main as updateBoatVenueExtras } from "./updateBoatVenueExtras.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const dataDirectory = path.join(projectRoot, "public", "data", "boatrace");
const DEFAULT_INPUT_PATH = path.join(dataDirectory, "today.generated.json");
const OFFICIAL_RACE_INDEX_URL = "https://www.boatrace.jp/owpc/pc/race/index";
const MIDNIGHT_LABEL_PATTERN = /ミッドナイト|midnight/i;
const MIDNIGHT_CLOSING_MINUTES = 21 * 60;

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = { dryRun: false };

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--dry-run") {
			parsed.dryRun = true;
			continue;
		}
		if (!token.startsWith("--")) {
			continue;
		}

		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];
		switch (key) {
			case "target-date":
			case "targetDate":
				parsed.targetDate = value;
				if (separatorIndex < 0) index += 1;
				break;
			case "input":
				parsed.inputPath = value;
				if (separatorIndex < 0) index += 1;
				break;
			case "audit-path":
				parsed.auditPath = value;
				if (separatorIndex < 0) index += 1;
				break;
			default:
				break;
		}
	}

	return parsed;
}

function toMinutes(value) {
	const match = String(value ?? "").match(/^(\d{1,2}):(\d{2})$/);
	if (!match) return null;
	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

function latestDeadlineTime(venue) {
	const deadlines = (venue?.races ?? [])
		.map((race) => ({ value: race?.deadlineTime ?? race?.startTime ?? "", minutes: toMinutes(race?.deadlineTime ?? race?.startTime) }))
		.filter((entry) => Number.isInteger(entry.minutes));
	if (!deadlines.length) return { value: null, minutes: null };
	return deadlines.reduce((latest, entry) => entry.minutes > latest.minutes ? entry : latest);
}

function venueLabels(venue) {
	const fields = [
		"title",
		"dayText",
		"statusText",
		"session",
		"category",
		"dayPart",
		"venueType",
		"meetingType",
		"meetingCategory",
		"eventType",
		"displayLabel",
		"label",
	];
	const labels = fields
		.map((field) => ({ field, value: venue?.[field] }))
		.filter((entry) => typeof entry.value === "string" && entry.value.trim());
	if (Array.isArray(venue?.tags)) {
		labels.push(...venue.tags.filter((value) => typeof value === "string").map((value) => ({ field: "tags", value })));
	}
	return labels;
}

export function detectMidnightVenues(feed) {
	const detectedVenues = [];
	const skippedVenues = [];

	for (const venue of feed?.venues ?? []) {
		const labels = venueLabels(venue);
		const explicitLabel = labels.find((entry) => MIDNIGHT_LABEL_PATTERN.test(entry.value));
		const latestClosing = latestDeadlineTime(venue);
		const base = {
			venueCode: String(venue?.venueCode ?? ""),
			venueName: String(venue?.venueName ?? ""),
			title: String(venue?.title ?? ""),
			raceCount: Array.isArray(venue?.races) ? venue.races.length : 0,
			latestClosingTime: latestClosing.value,
			latestClosingMinutes: latestClosing.minutes,
			source: String(venue?.source ?? ""),
		};

		if (explicitLabel) {
			detectedVenues.push({
			...base,
			detection: "explicit-label",
			detectionDetail: `${explicitLabel.field}: ${explicitLabel.value}`,
		});
			continue;
		}

		if (Number.isInteger(latestClosing.minutes) && latestClosing.minutes >= MIDNIGHT_CLOSING_MINUTES) {
			detectedVenues.push({
			...base,
			detection: "late-closing-fallback",
			detectionDetail: `no explicit midnight label; latest closing ${latestClosing.value} is at or after 21:00 JST`,
		});
			continue;
		}

		skippedVenues.push({
			...base,
			reason: latestClosing.value
				? `no explicit midnight label and latest closing ${latestClosing.value} is before 21:00 JST`
				: "no explicit midnight label and no parseable closing time",
		});
	}

	return { detectedVenues, skippedVenues };
}

async function readJson(filePath) {
	return JSON.parse(await readFile(filePath, "utf8"));
}

function countVenueCoverage(feed, targetVenueCodes) {
	const targetCodes = new Set(targetVenueCodes);
	const venues = (feed?.venues ?? []).filter((venue) => targetCodes.has(String(venue?.venueCode ?? "")));
	const races = venues.flatMap((venue) => venue.races ?? []);
	return {
		venueCount: venues.length,
		raceCount: races.length,
		exhibitionRaceCount: races.filter((race) => Array.isArray(race?.exhibitions) && race.exhibitions.length > 0).length,
		settledRaceCount: races.filter((race) => race?.result?.status && !["pending", "scheduled"].includes(race.result.status)).length,
		weatherVenueCount: venues.filter((venue) => venue?.weatherActual?.weather || venue?.weatherActual?.windSpeed || venue?.weatherActual?.waterTemperature).length,
	};
}

function buildAudit({ targetDate, inputPath, detection, dryRun, beforeCoverage, afterCoverage }) {
	return {
		version: 1,
		generatedAt: getJstTimestamp(),
		targetDate,
		dryRun,
		detection: {
			method: "official source label first; per-venue latest closing time fallback at or after 21:00 JST",
			count: detection.detectedVenues.length,
			venues: detection.detectedVenues,
			skippedVenues: detection.skippedVenues,
		},
		input: {
			path: path.relative(projectRoot, inputPath).replaceAll("\\", "/"),
			sourceUrl: OFFICIAL_RACE_INDEX_URL,
		},
		updatedDataFiles: dryRun || detection.detectedVenues.length === 0
			? []
			: [
				"public/data/boatrace/today.generated.json",
				"public/data/boatrace/today-race-details.generated.json",
				"public/data/boatrace/venue-extras.generated.json",
			],
		coverage: {
			before: beforeCoverage,
			after: afterCoverage,
		},
		result: detection.detectedVenues.length === 0
			? { status: "no-midnight-venues", message: "No midnight venues detected; no race data was updated." }
			: dryRun
				? { status: "dry-run", message: "Midnight venues detected; no files were updated." }
				: { status: "updated", message: "Updated only detected midnight venues using official sources." },
	};
}

export async function main(rawOptions = parseCliArgs()) {
	const inputPath = path.resolve(projectRoot, rawOptions.inputPath ?? DEFAULT_INPUT_PATH);
	const sourceFeed = await readJson(inputPath);
	const targetDate = normalizeTargetDate(rawOptions.targetDate ?? sourceFeed?.date, getJstTimestampParts().date);
	if (sourceFeed?.date !== targetDate) {
		throw new Error(`today feed date ${sourceFeed?.date ?? "missing"} does not match target date ${targetDate}`);
	}

	const detection = detectMidnightVenues(sourceFeed);
	const targetVenueCodes = detection.detectedVenues.map((venue) => venue.venueCode).filter(Boolean);
	const beforeCoverage = countVenueCoverage(sourceFeed, targetVenueCodes);
	let afterCoverage = beforeCoverage;

	if (!rawOptions.dryRun && targetVenueCodes.length > 0) {
		const targetVenues = targetVenueCodes.join(",");
		console.log(`[boat-midnight] updating ${targetVenues} for ${targetDate}`);
		await updateTodayRaceDetails({ mode: "final", targetSession: "auto", targetDate, targetVenues });
		await updateBoatVenueExtras({ targetDate, targetVenues });
		afterCoverage = countVenueCoverage(await readJson(DEFAULT_INPUT_PATH), targetVenueCodes);
	}

	const audit = buildAudit({ targetDate, inputPath, detection, dryRun: Boolean(rawOptions.dryRun), beforeCoverage, afterCoverage });
	const auditPath = path.resolve(projectRoot, rawOptions.auditPath ?? path.join(dataDirectory, "audit", `midnight-venue-update-${targetDate}.generated.json`));
	if (!rawOptions.dryRun) {
		let previousAudit = null;
		try {
			previousAudit = await readJson(auditPath);
		} catch (error) {
			if (error?.code !== "ENOENT") throw error;
		}
		const preserveNoopAudit = targetVenueCodes.length === 0 && previousAudit?.targetDate === targetDate && previousAudit?.result?.status === "no-midnight-venues";
		if (preserveNoopAudit) {
			console.log(`[boat-midnight] no midnight venues; preserved existing no-op audit: ${auditPath}`);
		} else {
			await mkdir(path.dirname(auditPath), { recursive: true });
			await writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
			console.log(`[boat-midnight] audit: ${auditPath}`);
		}
	}
	console.log(JSON.stringify(audit, null, 2));
	return audit;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
	main().catch((error) => {
		console.error("failed to update midnight boat venues");
		console.error(error);
		process.exitCode = 1;
	});
}
