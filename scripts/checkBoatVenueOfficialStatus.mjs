import fs from "node:fs";

const VENUE_EXTRAS_PATH = "public/data/boatrace/venue-extras.generated.json";

const PRIMARY_KEYS = [
	"entryTable",
	"officialBeforeInfo",
	"motorSummary",
	"waterSurfaceInfo",
	"weatherCondition",
	"motorLotteryAndPrecheck",
];

const NON_DEGRADING_STATUSES = new Set([
	"available",
	"pending",
	"not-published",
	"not-supported",
	"optional",
	"re-exhibition",
	"waiting",
	"unpublished",
]);

const DEGRADING_STATUSES = new Set([
	"partial",
	"parse-empty",
	"http-error",
	"unexpected-missing",
	"date-mismatch",
	"missing",
]);

function readStatus(value) {
	return String(value ?? "").trim().toLowerCase();
}

function isRecord(value) {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isAvailableStatus(value) {
	const status = readStatus(value);
	return status === "available" || status.startsWith("available-");
}

function isDegradingStatus(value) {
	const status = readStatus(value);

	if (!status || isAvailableStatus(status) || NON_DEGRADING_STATUSES.has(status)) {
		return false;
	}

	return (
		DEGRADING_STATUSES.has(status)
		|| status.includes("parse-empty")
		|| status.includes("http-error")
		|| status.includes("unexpected-missing")
		|| status.includes("date-mismatch")
	);
}

function hasData(value) {
	if (Array.isArray(value)) {
		return value.length > 0;
	}

	return isRecord(value) && Object.keys(value).length > 0;
}

function getSourceStatus(extra) {
	return isRecord(extra?.sourceStatus) ? extra.sourceStatus : null;
}

function hasPrimaryAvailable(extra) {
	if (!extra) {
		return false;
	}

	const sourceStatus = getSourceStatus(extra);

	if (PRIMARY_KEYS.some((key) => isAvailableStatus(sourceStatus?.[key]) || hasData(extra[key]))) {
		return true;
	}

	return (extra.races ?? []).some((race) => {
		const raceSourceStatus = getSourceStatus(race);
		return PRIMARY_KEYS.some((key) => isAvailableStatus(raceSourceStatus?.[key]) || hasData(race[key]));
	});
}

function hasDegradingPrimary(extra) {
	if (!extra) {
		return false;
	}

	const sourceStatus = getSourceStatus(extra);

	if (sourceStatus && PRIMARY_KEYS.some((key) => isDegradingStatus(sourceStatus[key]))) {
		return true;
	}

	return (extra.races ?? []).some((race) => {
		const raceSourceStatus = getSourceStatus(race);
		return Boolean(raceSourceStatus && PRIMARY_KEYS.some((key) => isDegradingStatus(raceSourceStatus[key])));
	});
}

function resolveStatus(extra) {
	if (!extra) {
		return "checking";
	}

	const isAvailable = extra.isAvailable === true || isAvailableStatus(extra.status);

	if (isAvailable && hasPrimaryAvailable(extra)) {
		return hasDegradingPrimary(extra) ? "partial" : "complete";
	}

	return "checking";
}

function expectStatus(label, extra, expected) {
	const actual = resolveStatus(extra);

	if (actual !== expected) {
		throw new Error(`${label}: expected ${expected}, got ${actual}`);
	}

	console.log(`[check:boat-venue-official-status] ${label}: ${actual}`);
}

const baseExtra = {
	status: "available",
	isAvailable: true,
	sourceStatus: {
		officialBeforeInfo: "available",
		weatherCondition: "available",
	},
	races: [
		{
			officialBeforeInfo: [{ frameNo: 1 }],
			weatherCondition: { weather: "fine" },
		},
	],
};

expectStatus("fixture primary data + startExhibition pending", {
	...baseExtra,
	sourceStatus: { ...baseExtra.sourceStatus, startExhibition: "pending" },
}, "complete");

expectStatus("fixture primary data + result pending", {
	...baseExtra,
	sourceStatus: { ...baseExtra.sourceStatus, resultList: "pending" },
}, "complete");

expectStatus("fixture primary data + optional not-supported", {
	...baseExtra,
	sourceStatus: { ...baseExtra.sourceStatus, optionalPanel: "not-supported" },
}, "complete");

expectStatus("fixture primary parse-empty", {
	...baseExtra,
	sourceStatus: { ...baseExtra.sourceStatus, officialBeforeInfo: "parse-empty" },
}, "partial");

expectStatus("fixture primary http-error", {
	...baseExtra,
	sourceStatus: { ...baseExtra.sourceStatus, weatherCondition: "http-error" },
}, "partial");

expectStatus("fixture missing venue extra", null, "checking");

const feed = JSON.parse(fs.readFileSync(VENUE_EXTRAS_PATH, "utf8"));
const venues = Array.isArray(feed.venues) ? feed.venues : [];
const venueByCode = new Map(venues.map((venue) => [String(venue.venueCode).padStart(2, "0"), venue]));

expectStatus("actual Amagasaki venueCode=13", venueByCode.get("13"), "complete");
expectStatus("actual Miyajima venueCode=17", venueByCode.get("17"), "complete");
expectStatus("actual Edogawa venueCode=03", venueByCode.get("03"), "complete");
