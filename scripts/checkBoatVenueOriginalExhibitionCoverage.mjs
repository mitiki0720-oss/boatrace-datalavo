import assert from "node:assert/strict";
import fs from "node:fs";
import { createServer } from "vite";

const VENUE_EXTRAS_PATH = "public/data/boatrace/venue-extras.generated.json";
const TODAY_PATH = "public/data/boatrace/today.generated.json";
const RACES_PAGE_PATH = "src/pages/RacesPage.tsx";
const MATERIAL_PATH = "src/lib/boatPredictionMaterial.ts";
const REVIEW_BUILDER_PATH = "src/lib/boatReviewSummaryBuilder.ts";

function readJson(path) {
	return JSON.parse(fs.readFileSync(path, "utf8"));
}

function toArray(value) {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") return Object.values(value);
	return [];
}

function readStatus(value) {
	return String(value ?? "").trim().toLowerCase();
}

function venueCode(value) {
	return String(value ?? "").padStart(2, "0");
}

function countRows(races, selector) {
	return races.reduce((total, race) => total + toArray(race?.originalExhibition).filter(selector).length, 0);
}

function countOccurrences(text, needle) {
	return text.split(needle).length - 1;
}

function buildTrifectaOdds(count = 120) {
	const combinations = [];
	for (let first = 1; first <= 6; first += 1) {
		for (let second = 1; second <= 6; second += 1) {
			if (second === first) continue;
			for (let third = 1; third <= 6; third += 1) {
				if (third === first || third === second) continue;
				combinations.push({
					betType: "3連単",
					combination: `${first}-${second}-${third}`,
					odds: (5.4 + combinations.length).toFixed(1),
				});
			}
		}
	}
	return combinations.slice(0, count);
}

function createReviewRace(overrides = {}) {
	return {
		raceNo: 1,
		title: "fixture race",
		racers: Array.from({ length: 6 }, (_, index) => ({
			frameNo: index + 1,
			boatNo: String(index + 1),
			name: `選手${index + 1}`,
			motorNo: String(10 + index),
			motorSecondRate: "38.2%",
			boatMotorNo: String(30 + index),
			boatSecondRate: "31.4%",
		})),
		exhibitions: Array.from({ length: 6 }, (_, index) => ({
			frameNo: index + 1,
			exhibitionTime: (6.70 + index / 100).toFixed(2),
		})),
		result: {
			status: "confirmed",
			finishOrder: ["1", "2", "3"],
			startInfo: Array.from({ length: 6 }, (_, index) => ({
				course: index + 1,
				frameNo: index + 1,
				startTiming: `.1${index}`,
			})),
			finalOdds: {
				trifectaAll: buildTrifectaOdds(),
			},
		},
		...overrides,
	};
}

function createReviewGroup(race, overrides = {}) {
	return {
		key: "2026-06-11:fixture",
		date: "2026-06-11",
		venueName: "検査会場",
		venueSlug: "fixture",
		races: [{ raceNo: 1, race }],
		...overrides,
	};
}

async function loadReviewBuilder() {
	const server = await createServer({
		server: { middlewareMode: true },
		appType: "custom",
		logLevel: "silent",
	});
	try {
		return await server.ssrLoadModule(`/${REVIEW_BUILDER_PATH}`);
	} finally {
		await server.close();
	}
}

function classifyVenue(venue) {
	const races = toArray(venue?.races);
	const rows = countRows(races, () => true);
	const lap = countRows(races, (row) => Boolean(row.oneLapTime || row.lapTime || row.oneRoundTime || row.halfLapTime));
	const turn = countRows(races, (row) => Boolean(row.turnTime || row.mawariashi));
	const straight = countRows(races, (row) => Boolean(row.straightTime));
	const sourceStatus = venue?.sourceStatus ?? {};
	const originalStatus = readStatus(sourceStatus.originalExhibition);

	let classification = "not-supported";
	if (venue?.officialVenueExtrasSupported === true) {
		if (rows > 0 && (lap > 0 || turn > 0 || straight > 0)) {
			classification = "available";
		} else if (rows > 0) {
			classification = ["not-supported", "parse-empty", "http-error", "not-published", "preserved"].includes(originalStatus)
				? originalStatus
				: "pending";
		} else if (originalStatus) {
			classification = originalStatus;
		} else {
			classification = "pending";
		}
	}

	return {
		venueCode: venueCode(venue?.venueCode),
		venueName: venue?.venueName ?? "-",
		dedicatedParserKey: venue?.dedicatedParserKey ?? "",
		raceCount: races.length,
		originalRows: rows,
		lapTimeCount: lap,
		turnTimeCount: turn,
		straightTimeCount: straight,
		sourceStatus: originalStatus || "-",
		classification,
	};
}

const feed = readJson(VENUE_EXTRAS_PATH);
const venues = toArray(feed.venues);
const activeSupported = venues.filter((venue) => venue?.officialVenueExtrasSupported === true);
assert.ok(activeSupported.length > 0, "active feed should include venue-official supported venues");

const rows = activeSupported.map(classifyVenue).sort((left, right) => left.venueCode.localeCompare(right.venueCode));

for (const row of rows) {
	assert.ok(row.dedicatedParserKey, `${row.venueCode} ${row.venueName}: supported venue should have dedicatedParserKey`);
	assert.ok(row.raceCount > 0, `${row.venueCode} ${row.venueName}: supported active venue should have races`);
	assert.notEqual(row.classification, "merge-missing", `${row.venueCode} ${row.venueName}: generated JSON should not lose parsed original exhibition rows`);
	console.log(
		[
			"[check:boat-venue-original-exhibition]",
			row.venueCode,
			row.venueName,
			`key=${row.dedicatedParserKey}`,
			`classification=${row.classification}`,
			`original=${row.originalRows}`,
			`lap=${row.lapTimeCount}`,
			`turn=${row.turnTimeCount}`,
			`straight=${row.straightTimeCount}`,
			`sourceStatus=${row.sourceStatus}`,
		].join(" "),
	);
}

const byCode = new Map(rows.map((row) => [row.venueCode, row]));
const todayFeed = readJson(TODAY_PATH);
const heldVenueCodes = new Set(
	toArray(todayFeed.venues).map((venue) => venueCode(venue?.venueCode)),
);

function auditWhenHeldToday(code, label, assertions) {
	if (!heldVenueCodes.has(code)) {
		console.log(`[check:boat-venue-original-exhibition] skip ${code} ${label}: not held today`);
		return;
	}

	const row = byCode.get(code);
	assert.ok(row, `${code} ${label}: held today but missing from generated venue extras`);
	assertions(row);
}

auditWhenHeldToday("13", "Amagasaki", (row) => {
	assert.ok(["available", "pending"].includes(row.classification), "Amagasaki should distinguish pending original timing from unsupported venue");
	assert.equal(row.straightTimeCount, 0, "Amagasaki straight time should remain non-published");
});

auditWhenHeldToday("17", "Miyajima", (row) => {
	assert.ok(["available", "pending"].includes(row.classification), "Miyajima should be venue-official classified separately from common official data");
});

auditWhenHeldToday("03", "Edogawa", (row) => {
	assert.ok(["available", "pending", "not-supported"].includes(row.classification), "Edogawa should be audited even when optional original timing is absent");
});

auditWhenHeldToday("20", "Wakamatsu", (row) => {
	assert.ok(["available", "pending"].includes(row.classification), "Wakamatsu should be audited even when optional original timing is absent");
});

const racesPageSource = fs.readFileSync(RACES_PAGE_PATH, "utf8");
const materialSource = fs.readFileSync(MATERIAL_PATH, "utf8");
const reviewBuilderSource = fs.readFileSync(REVIEW_BUILDER_PATH, "utf8");

assert.match(racesPageSource, /selectedOriginalExhibitionRows/, "RacesPage should read original exhibition rows");
assert.match(racesPageSource, /hasOriginalOneLapTimeData/, "RacesPage should gate one-lap display by actual data");
assert.match(racesPageSource, /hasOriginalTurnTimeData/, "RacesPage should gate turn display by actual data");
assert.match(racesPageSource, /hasOriginalStraightTimeData/, "RacesPage should gate straight display by actual data");
assert.match(materialSource, /buildOriginalExhibitionBlock/, "GPT material should include original exhibition block builder");
assert.match(materialSource, /raceExtra\?\.originalExhibition/, "GPT material should read raceExtra original exhibition rows");
assert.match(reviewBuilderSource, /buildReviewExhibitionRows/, "Review builder should own exhibition row merging");
assert.match(reviewBuilderSource, /raceExtra\?\.originalExhibition/, "Review builder should read original exhibition rows");

const {
	buildBoatPredictionSummaryText,
	buildBoatResultSummaryText,
	getBoatReviewPredictionCoverage,
} = await loadReviewBuilder();

const originalExhibition = Array.from({ length: 6 }, (_, index) => ({
	frameNo: index + 1,
	oneLapTime: (37.10 + index / 100).toFixed(2),
	turnTime: (5.80 + index / 100).toFixed(2),
	straightTime: (6.70 + index / 100).toFixed(2),
}));
const originalVenueExtra = {
	venueName: "検査会場",
	sourceStatus: { originalExhibition: "available" },
	races: [{ raceNo: 1, originalExhibition }],
};
const originalText = buildBoatResultSummaryText(createReviewGroup(createReviewRace()), {
	venueExtra: originalVenueExtra,
});
const exhibitionSection = originalText.match(/【展示詳細】\n([\s\S]*?)\n\n【進入・ST】/)?.[1] ?? "";

assert.equal(countOccurrences(originalText, "【展示詳細】"), 1, "Review result should emit one exhibition block per race");
assert.equal(exhibitionSection.split("\n").length, 6, "Review result should merge exhibition data into six frame rows");
for (let frameNo = 1; frameNo <= 6; frameNo += 1) {
	assert.equal(countOccurrences(exhibitionSection, `${frameNo}号艇`), 1, `Review result should emit frame ${frameNo} once`);
}
assert.match(exhibitionSection, /展示 6\.70/, "Review result should retain standard exhibition time");
assert.match(exhibitionSection, /一周 37\.10/, "Review result should merge original one-lap time");
assert.match(exhibitionSection, /回り足 5\.80/, "Review result should merge original turn time");
assert.match(exhibitionSection, /直線 6\.70/, "Review result should merge original straight time");
assert.match(originalText, /会場独自展示: 6\/6/, "Review result should report available original exhibition rows");

const unsupportedText = buildBoatResultSummaryText(createReviewGroup(createReviewRace()), {
	venueExtra: {
		venueName: "検査会場",
		sourceStatus: { originalExhibition: "not-supported" },
		races: [{ raceNo: 1, sourceStatus: { originalExhibition: "pending" } }],
	},
});
assert.match(unsupportedText, /会場独自展示: 公式非掲載/, "Review result should distinguish officially unsupported original exhibition");
assert.doesNotMatch(unsupportedText, /一周 37\.10|回り足 5\.80|直線 6\.70/, "Review result should not fabricate unsupported original timings");

const pendingText = buildBoatResultSummaryText(createReviewGroup(createReviewRace()), {
	venueExtra: {
		venueName: "検査会場",
		sourceStatus: { originalExhibition: "pending" },
		races: [{ raceNo: 1, sourceStatus: { originalExhibition: "pending" } }],
	},
});
assert.match(pendingText, /会場独自展示: 未取得/, "Review result should distinguish pending original exhibition");

const pendingResultText = buildBoatResultSummaryText(createReviewGroup(createReviewRace({
	result: {
		status: "pending",
		finalOdds: { trifectaTop: buildTrifectaOdds(20) },
	},
})));
assert.match(pendingResultText, /結果: 未確定/, "Pending race should not be reported as confirmed");
assert.match(pendingResultText, /取得区分: 最終上位のみ/, "Top-only final odds should retain their limited classification");
assert.match(pendingResultText, /取得範囲内最低オッズ:/, "Top-only final odds should use range-limited minimum label");
assert.match(pendingResultText, /全120通り最低オッズ: 判定不可/, "Top-only final odds should not claim a full-market minimum");

const previewText = buildBoatResultSummaryText(createReviewGroup(createReviewRace({
	result: { status: "pending" },
	oddsPreview: Object.assign([], { trifectaTop: buildTrifectaOdds(5) }),
})));
assert.match(previewText, /取得区分: 発売中参考/, "Preview odds should be labeled as in-sale reference");

assert.match(originalText, /取得区分: 最終全件/, "A complete 120-row final market should be labeled as final full data");
assert.match(originalText, /全120通り最低オッズ:/, "A complete 120-row final market should expose the full-market minimum");

const incompleteAllText = buildBoatResultSummaryText(createReviewGroup(createReviewRace({
	result: {
		status: "confirmed",
		finishOrder: ["1", "2", "3"],
		finalOdds: { trifectaAll: buildTrifectaOdds(119) },
	},
})));
assert.match(incompleteAllText, /取得区分: 最終上位のみ/, "An incomplete final market should not be labeled as full data");
assert.match(incompleteAllText, /取得範囲内最低オッズ:/, "An incomplete final market should use range-limited minimum label");
assert.doesNotMatch(incompleteAllText, /全120通り最低オッズ: \d/, "An incomplete final market should not claim a numeric full-market minimum");

const archiveResultText = "保存済みArchive Result Copy";
const archiveGroup = createReviewGroup(createReviewRace(), { resultFileText: archiveResultText });
assert.equal(buildBoatResultSummaryText(archiveGroup, { venueExtra: originalVenueExtra }), archiveResultText, "Archive result copy should be returned unchanged");

const predictionGroup = createReviewGroup(createReviewRace(), {
	races: Array.from({ length: 12 }, (_, index) => ({
		raceNo: index + 1,
		prediction: index === 3 || index === 8 ? undefined : { predictionText: `予想${index + 1}R` },
	})),
});
const predictionCoverage = getBoatReviewPredictionCoverage(predictionGroup);
assert.equal(predictionCoverage.savedCount, 10, "Prediction coverage should count only saved prediction text");
assert.deepEqual(predictionCoverage.missingRaceNos, [4, 9], "Prediction coverage should retain missing race numbers");
assert.match(buildBoatPredictionSummaryText(predictionGroup), /予想保存状況: 10\/12/, "Prediction copy should retain saved-count header");
assert.match(buildBoatPredictionSummaryText(predictionGroup), /未保存レース: 4R・9R/, "Prediction copy should retain missing-race header");

console.log("[check:boat-venue-original-exhibition] passed");
