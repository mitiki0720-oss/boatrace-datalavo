import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function loadTsModule(relativePath, dependencies = {}) {
	const source = fs.readFileSync(path.join(root, relativePath), "utf8");
	const compiled = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const module = { exports: {} };
	new Function("exports", "module", "require", compiled)(module.exports, module, (specifier) => {
		if (specifier in dependencies) return dependencies[specifier];
		throw new Error(`Unexpected checker dependency from ${relativePath}: ${specifier}`);
	});
	return module.exports;
}

const betParser = loadTsModule("src/lib/boatBetParser.ts");
const settlement = loadTsModule("src/lib/boatResultSettlement.ts", {
	"./boatBetParser": betParser,
});
const performance = loadTsModule("src/lib/boatReviewPerformanceMetrics.ts", {
	"./boatBetParser": betParser,
	"./boatResultSettlement": settlement,
});
const summaryBuilder = loadTsModule("src/lib/boatReviewSummaryBuilder.ts", {
	"./boatPracticeResultStorage": { isBoatPracticePayoutPending: () => false },
	"./boatResultSettlement": settlement,
});

const { parseBoatBets } = betParser;
const { resolveBoatPredictionOutcome } = settlement;
const { buildBoatReviewVenuePerformance } = performance;
const { buildLiveBoatReviewVenueGroups, findBoatReviewPrediction } = summaryBuilder;

const FORMAT_A = `【買い目📝】
買い目（10点）

3連単（厚め2点）01/02
01 1-4-2
02 1-2-4

3連単（本線3点）03-05
03 4-1-2
04 1-4-5
05 4-1-5

3連単（中穴3点）06-08
06 2-1-4
07 4-2-1
08 1-5-4

3連単（大穴2点）09/10
09 4-5-2
10 5-4-1`;

const FORMAT_B = `【買い目10点】

厚め
01 5-4-3
02 5-3-4

本線
03 4-5-3
04 5-4-1
05 3-5-4

中穴
06 4-3-5
07 5-1-4
08 3-4-5

大穴
09 4-5-1
10 5-3-1`;

const FORMAT_C = `【買い目📝】

3連単（厚め2点）
01 5-3-1
02 3-5-1

3連単（本線3点）
03 5-1-3
04 3-1-5
05 5-3-2

3連単（中穴3点）
06 1-3-5
07 5-1-6
08 3-5-6

3連単（大穴2点）
09 5-6-3
10 3-6-5`;

const formatFixtures = {
	Mikuni: { text: FORMAT_A, first: "1-4-2" },
	Biwako: { text: FORMAT_B, first: "5-4-3" },
	Hamanako: { text: FORMAT_C, first: "5-3-1" },
};

for (const [name, fixture] of Object.entries(formatFixtures)) {
	const parsed = parseBoatBets(fixture.text);
	assert.equal(parsed.parseStatus, "ready", `${name} should be parse-ready`);
	assert.equal(parsed.totalBets, 10, `${name} should parse 10 bets`);
	assert.equal(parsed.trifectaCount, 10, `${name} should parse 10 trifecta bets`);
	assert.equal(parsed.exactaCount, 0, `${name} should not parse race-card rows as exacta bets`);
	assert.equal(parsed.bets[0]?.normalized, fixture.first, `${name} first combination should match`);
	assert.equal(new Set(parsed.bets.map((bet) => bet.normalized)).size, 10, `${name} should not contain duplicate bets`);
	assert.ok(parsed.bets.every((bet) => bet.amountYen === 100), `${name} should use the parser's 100-yen unit`);
	assert.equal(parsed.totalStakeYen, 1000, `${name} investment should be 1,000 yen`);
}

const prediction = (raceNo, predictionText = FORMAT_A) => ({
	raceKey: `boat-prediction:2026-09-04:10:${raceNo}`,
	date: "2026-09-04",
	venueCode: "10",
	venueName: "三国",
	raceNo,
	predictionText,
	savedAt: "2026-09-04T08:00:00+09:00",
});
const confirmedRace = (raceNo, finishOrder, payout = "4,250円", extraResult = {}) => ({
	raceNo,
	status: "finished",
	result: {
		status: "confirmed",
		finishOrder,
		payout3tan: { betType: "3連単", combination: finishOrder.join("-"), payout },
		refunds: [],
		...extraResult,
	},
});
const liveGroup = (race, sourcePrediction = prediction(race.raceNo)) => ({
	key: "2026-09-04:mikuni",
	date: "2026-09-04",
	venueName: "三国",
	venueSlug: "mikuni",
	venueCode: "10",
	races: [{ raceNo: race.raceNo, race, prediction: sourcePrediction }],
});

const hitMetrics = buildBoatReviewVenuePerformance(liveGroup(confirmedRace(1, ["1", "4", "2"])));
assert.equal(hitMetrics.evaluatedRaceCount, 1);
assert.equal(hitMetrics.hitCount, 1);
assert.equal(hitMetrics.investment, 1000);
assert.equal(hitMetrics.payout, 4250);
assert.equal(hitMetrics.profit, 3250);
assert.equal(hitMetrics.roi, 425);

const missMetrics = buildBoatReviewVenuePerformance(liveGroup(confirmedRace(1, ["6", "5", "4"], "9,990円")));
assert.equal(missMetrics.evaluatedRaceCount, 1);
assert.equal(missMetrics.hitCount, 0);
assert.equal(missMetrics.investment, 1000);
assert.equal(missMetrics.payout, 0);
assert.equal(missMetrics.profit, -1000);
assert.equal(missMetrics.roi, 0);

const pendingMetrics = buildBoatReviewVenuePerformance(liveGroup({
	raceNo: 1,
	status: "selling",
	result: { status: "pending", refunds: [] },
}));
assert.equal(pendingMetrics.pendingRaceCount, 1);
assert.equal(pendingMetrics.financialRaceCount, 0);
assert.equal(pendingMetrics.investment, 0);
assert.equal(pendingMetrics.roi, null);

const outcomeFor = (race) => resolveBoatPredictionOutcome({
	race,
	bets: parseBoatBets(FORMAT_A).bets,
	investmentAmount: 1000,
	parseStatus: "ready",
	source: "review-checker",
});

for (const race of [
	{ raceNo: 1, result: { status: "pending", refunds: [] } },
	{ raceNo: 1, result: { status: "pending", refundList: [] } },
	{ raceNo: 1, result: { status: "pending", refunds: {} } },
	{ raceNo: 1, result: { status: "pending", refunds: { amount: 0 } } },
]) {
	assert.equal(outcomeFor(race).status, "pending", "empty refund containers must remain pending");
}

assert.equal(outcomeFor({ raceNo: 1, result: { status: "pending", refunds: { amount: 1000 } } }).status, "refund");
assert.equal(outcomeFor({ raceNo: 1, result: { status: "refund" } }).status, "refund");
assert.equal(outcomeFor({ raceNo: 1, result: { status: "unavailable" } }).status, "pending");
assert.equal(outcomeFor({ raceNo: 1, status: "canceled", result: { status: "unavailable" } }).status, "cancelled");
assert.equal(outcomeFor(confirmedRace(1, ["1", "4", "2"], "4,250円", { refundList: [] })).status, "hit");
assert.equal(outcomeFor({ raceNo: 1, status: "finished", result: { status: "confirmed", refunds: [] } }).status, "pending");

const twelveRaceMetrics = buildBoatReviewVenuePerformance({
	key: "2026-09-04:mikuni",
	date: "2026-09-04",
	venueName: "三国",
	venueSlug: "mikuni",
	venueCode: "10",
	races: Array.from({ length: 12 }, (_, index) => {
		const raceNo = index + 1;
		return { raceNo, race: confirmedRace(raceNo, ["6", "5", "4"], "9,990円"), prediction: prediction(raceNo) };
	}),
});
assert.equal(twelveRaceMetrics.officialResultCount, 12);
assert.equal(twelveRaceMetrics.evaluatedRaceCount, 12);
assert.equal(twelveRaceMetrics.financialRaceCount, 12);
assert.equal(twelveRaceMetrics.investment, 12000);

const emptyPublicLikeRecord = { ...prediction(1, ""), updatedAt: "2026-09-04T10:00:00+09:00" };
const nonEmptyLocalRecord = { ...prediction(1, FORMAT_A), updatedAt: "2026-09-04T09:00:00+09:00" };
assert.equal(findBoatReviewPrediction({
	predictions: [emptyPublicLikeRecord, nonEmptyLocalRecord],
	date: "2026-09-04",
	venueName: "三国",
	venueCode: "10",
	raceNo: 1,
})?.predictionText, FORMAT_A, "empty newer records must not replace a non-empty prediction");
assert.equal(findBoatReviewPrediction({
	predictions: [{ ...nonEmptyLocalRecord, venueCode: "11" }],
	date: "2026-09-04",
	venueName: "三国",
	venueCode: "10",
	raceNo: 1,
}), undefined, "different explicit venue codes must not match by venue name");

const pageSource = fs.readFileSync(path.join(root, "src/pages/ReviewPage.tsx"), "utf8").replace(/\r\n/g, "\n");
const uiChecks = {
	stableSelectedVenue: pageSource.includes("groups.some((group) => group.key === selectedVenueKey)"),
	venueClickHandler: pageSource.includes("handleVenueSelect(group.key)"),
	selectedBadge: pageSource.includes("boat-review-selected-badge") && pageSource.includes("選択中"),
	selectedHighlight: pageSource.includes("data-selected={isSelected}") && pageSource.includes("aria-pressed={isSelected}"),
	smoothScroll: pageSource.includes("scrollIntoView({ behavior: \"smooth\", block: \"start\" })"),
	separateFeedback: ["prediction-copy", "prediction-txt", "result-copy", "result-txt"].every((key) => pageSource.includes(key)),
	copyFeedback: pageSource.includes("✓ コピー済み") && pageSource.includes("コピー失敗"),
	txtFeedback: pageSource.includes("✓ 保存しました") && pageSource.includes("保存失敗"),
	timerCleanup: pageSource.includes("window.clearTimeout") && pageSource.includes("1800"),
	emptyExportDisabled: pageSource.includes("disabled={!predictionExportAvailable}") && pageSource.includes("disabled={!resultExportAvailable}"),
	publicAndLocalPredictionsLoaded: pageSource.includes("loadPublicJohnsonPredictionRecords") && pageSource.includes("loadBoatJohnsonPredictionRecords") && pageSource.includes("...publicJohnsonRecords"),
};
assert.ok(Object.values(uiChecks).every(Boolean), JSON.stringify(uiChecks, null, 2));

const currentFeed = JSON.parse(fs.readFileSync(path.join(root, "public/data/boatrace/today-race-details.generated.json"), "utf8").replace(/^\uFEFF/, ""));
const currentJohnson = JSON.parse(fs.readFileSync(path.join(root, "public/data/boatrace/johnson-predictions.generated.json"), "utf8").replace(/^\uFEFF/, ""));
const currentGroups = buildLiveBoatReviewVenueGroups({
	date: currentFeed.date,
	feed: currentFeed,
	predictions: currentJohnson.records ?? [],
	practiceResults: [],
});
const currentMetrics = currentGroups.map((group) => ({
	venueName: group.venueName,
	metrics: buildBoatReviewVenuePerformance(group),
}));
const fullyConfirmedVenues = currentMetrics.filter(({ metrics }) =>
	metrics.targetRaceCount === 12 &&
	metrics.predictionRaceCount === 12 &&
	metrics.officialResultCount === 12
);
assert.ok(fullyConfirmedVenues.length > 0, "current production data should include a fully confirmed 12R venue with predictions");
assert.ok(
	fullyConfirmedVenues.every(({ metrics }) =>
		metrics.settledPredictionRaceCount === 12 &&
		metrics.pendingRaceCount === 0 &&
		metrics.parseWarningCount === 0
	),
	JSON.stringify(fullyConfirmedVenues.map(({ venueName, metrics }) => ({
		venueName,
		evaluated: metrics.evaluatedRaceCount,
		parseWarnings: metrics.parseWarningCount,
		refunds: metrics.refundCount,
		cancelled: metrics.cancelledCount,
	}))),
);

console.log(JSON.stringify({
	ok: true,
	formats: Object.fromEntries(Object.entries(formatFixtures).map(([name, fixture]) => {
		const parsed = parseBoatBets(fixture.text);
		return [name, { parseStatus: parsed.parseStatus, bets: parsed.totalBets, investment: parsed.totalStakeYen }];
	})),
	hit: { investment: hitMetrics.investment, payout: hitMetrics.payout, profit: hitMetrics.profit, roi: hitMetrics.roi },
	miss: { investment: missMetrics.investment, payout: missMetrics.payout, profit: missMetrics.profit, roi: missMetrics.roi },
	pendingExcluded: pendingMetrics.financialRaceCount === 0,
	refundFixtures: { emptyContainersRejected: true, explicitRefundAccepted: true },
	cancelledAudit: { unavailableIsPending: true, explicitCanceledOnly: true },
	twelveRaceEvaluation: { official: twelveRaceMetrics.officialResultCount, evaluated: twelveRaceMetrics.evaluatedRaceCount },
	emptyPredictionProtection: true,
	productionReadOnlyAudit: {
		date: currentFeed.date,
		fullyConfirmedVenues: fullyConfirmedVenues.map(({ venueName }) => venueName),
		classifications: fullyConfirmedVenues.map(({ venueName, metrics }) => ({
			venueName,
			evaluated: metrics.evaluatedRaceCount,
			refunds: metrics.refundCount,
			settled: metrics.settledPredictionRaceCount,
		})),
	},
	uiChecks,
}, null, 2));
