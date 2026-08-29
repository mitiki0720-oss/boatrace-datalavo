import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readText = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const readJson = (relativePath) => JSON.parse(readText(relativePath));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function parseArgs(argv) {
	const args = { date: undefined };
	for (let index = 0; index < argv.length; index += 1) {
		if (argv[index] !== "--date") throw new Error(`Unknown argument: ${argv[index]}`);
		const next = argv[index + 1];
		if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD or latest");
		args.date = next;
		index += 1;
	}
	if (args.date && args.date !== "latest" && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error(`Invalid --date value: ${args.date}`);
	return args;
}

const args = parseArgs(process.argv.slice(2));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const targetDate = !args.date || args.date === "latest" ? index.latestDate : args.date;
const latest = readJson("public/data/boatrace-ex/derived/race-analysis/latest.json");
const shardPath = `public/data/boatrace-ex/derived/race-analysis/dates/${targetDate}.json`;
const analysis = latest.targetDate === targetDate
	? latest
	: exists(shardPath)
		? readJson(shardPath)
		: null;

assert.ok(analysis, `race-analysis shard is missing for ${targetDate}`);
assert.equal(analysis.targetDate ?? analysis.date, targetDate, "race-analysis date must match requested date");
const history = readJson(`public/data/boatrace-ex/history/races/${targetDate}.json`);
const historyByKey = new Map((history.records ?? []).map((record) => [record.raceKey, record]));
const races = analysis.races ?? [];
const readyRaces = races.filter((race) => race.status === "ready");
const notReadyRaces = races.filter((race) => race.status === "not-ready");

assert.equal(races.length, history.records.length, "every target-date history race must be represented");
assert.equal(new Set(races.map((race) => race.analysisKey)).size, races.length, "analysis keys must be unique");
const readyRaceKeys = readyRaces.map((race) => race.raceKey);
assert.equal(new Set(readyRaceKeys).size, readyRaceKeys.length, "a source race may be analyzed only once");
assert.equal(analysis.summary.raceCount ?? analysis.summary.latestRaceCount, races.length, "race count summary must match races");
assert.equal(analysis.summary.analyzedRaceCount, readyRaces.length, "analyzedRaceCount must count ready races");
assert.equal(analysis.summary.notReadyRaceCount, notReadyRaces.length, "notReadyRaceCount must count not-ready races");
assert.ok(readyRaces.length > 0, "analyzedRaceCount must be greater than zero");

const trifectaFor = (record) => (record.officialResult?.payout ?? []).find((item) => /3連単|三連単|trifecta/iu.test(String(item?.betType ?? item?.type ?? item?.name ?? "")));
for (const race of races) {
	assert.equal(race.date, targetDate, `${race.raceKey} date must match target`);
	assert.ok(race.venueCode && race.venueName && Number.isInteger(race.raceNo), `${race.raceKey} identity is incomplete`);
	assert.ok(race.analysisKey, `${race.raceKey} analysisKey is missing`);
	assert.ok(race.source && race.sourceStatus && race.status, `${race.raceKey} must expose source and status`);
	assert.ok(race.sourcePaths?.history && race.sourcePaths?.racerEvidence && race.sourcePaths?.venueEvidence, `${race.raceKey} must expose EX source paths`);
	assert.ok(["ready", "not-ready"].includes(race.status), `${race.raceKey} status is invalid`);
	assert.equal(race.racerLinkageSummary.nameLinkedCount, 0, `${race.raceKey} must not use name linkage`);
	assert.ok(race.racers.every((racer) => racer.linkageStatus === "official-registration" || racer.linkageStatus === "unresolved"), `${race.raceKey} racer linkage must be exact official registration only`);
	const source = historyByKey.get(race.raceKey);
	assert.ok(source, `${race.raceKey} is missing from history`);
	if (race.status === "not-ready") {
		assert.ok(race.reason && race.notReadyReasons?.length > 0, `${race.raceKey} not-ready race must expose reason`);
		assert.equal(race.resultFacts, null, `${race.raceKey} not-ready race must not expose result analysis facts`);
		continue;
	}
	assert.equal(race.reason, null, `${race.raceKey} ready race must not have a reason`);
	assert.equal(race.inputs?.result, "available", `${race.raceKey} ready result input is missing`);
	assert.equal(race.inputs?.payout, "available", `${race.raceKey} ready payout input is missing`);
	assert.equal(race.inputs?.entries, "available", `${race.raceKey} ready entries input is missing`);
	assert.equal(race.racers.length, 6, `${race.raceKey} ready race must expose six racers`);
	assert.deepEqual(race.resultFacts?.top3, source.officialResult.finishOrder.slice(0, 3), `${race.raceKey} top3 must match source`);
	assert.equal(race.resultFacts?.winningMethod, source.officialResult.winningTechnique ?? null, `${race.raceKey} winning method must match source`);
	const sourceTrifecta = trifectaFor(source);
	assert.ok(sourceTrifecta, `${race.raceKey} source trifecta payout is missing`);
	assert.equal(race.resultFacts?.trifecta?.combination, sourceTrifecta.combination ?? source.officialResult.trifecta ?? null, `${race.raceKey} trifecta combination must match source`);
	assert.equal(race.payoutProfile?.trifectaPayoutYen, race.resultFacts?.trifecta?.payoutYen, `${race.raceKey} payout profile must match result facts`);
	assert.equal(race.raceFlowFacts?.winnerFrame, race.resultFacts?.top3[0], `${race.raceKey} winnerFrame must match top3`);
	assert.ok(race.startFacts && race.exhibitionFacts && race.weatherFacts && race.payoutProfile, `${race.raceKey} ready fact blocks are missing`);
	assert.ok(Array.isArray(race.preRaceReviewHints) && race.preRaceReviewHints.length > 0, `${race.raceKey} review facts are missing`);
}

const prohibitedKeys = new Set([
	"hitRate",
	"expectedValue",
	"aiScore",
	"predictionScore",
	"ranking",
	"racerRanking",
	"motorRanking",
	"recommendedTickets",
	"generatedTickets",
	"bets",
]);
const prohibitedKeyHits = [];
const walk = (value, location = "$") => {
	if (Array.isArray(value)) {
		value.forEach((item, indexValue) => walk(item, `${location}[${indexValue}]`));
		return;
	}
	if (!value || typeof value !== "object") return;
	for (const [key, child] of Object.entries(value)) {
		if (prohibitedKeys.has(key)) prohibitedKeyHits.push(`${location}.${key}`);
		walk(child, `${location}.${key}`);
	}
};
walk(analysis);
assert.deepEqual(prohibitedKeyHits, [], "race-analysis must not contain prediction, ticket, score, expected value, hit rate, or ranking output");
const readySerialized = JSON.stringify(readyRaces);
assert.ok(!/2連単.{0,20}(?:推奨|買い目|使用|点)/u.test(readySerialized), "race-analysis must not recommend exacta");
assert.ok(!/(?:的中率|期待値|AIスコア|選手ランキング|モーターランキング|次回の買い目)/u.test(readySerialized), "race-analysis contains forbidden predictive output");

const dailyGenerator = readText("scripts/generateBoatExDaily.mjs");
const dailyChecker = readText("scripts/checkBoatExDaily.mjs");
const raceAnalysisCall = dailyGenerator.indexOf('"scripts/generateBoatExRaceAnalysis.mjs"');
const currentCoverageCall = dailyGenerator.indexOf('"scripts/generateBoatExCurrentDayPredictionCoverage.mjs"');
assert.ok(raceAnalysisCall >= 0, "daily pipeline must generate race-analysis");
assert.ok(currentCoverageCall > raceAnalysisCall, "daily pipeline must regenerate current-day coverage after race-analysis");
assert.ok(dailyChecker.includes('"scripts/checkBoatExRaceAnalysis.mjs"'), "daily checker must validate race-analysis");

console.log(JSON.stringify({
	ok: true,
	targetDate,
	raceCount: races.length,
	analyzedRaceCount: readyRaces.length,
	notReadyRaceCount: notReadyRaces.length,
	notReadyReasonCounts: analysis.summary.notReadyReasonCounts ?? {},
	venueCount: analysis.summary.venueCount,
	resultAvailableRaceCount: analysis.summary.resultAvailableRaceCount,
	payoutAvailableRaceCount: analysis.summary.payoutAvailableRaceCount,
	dailyPipelineOrder: "race-analysis -> current-day-prediction-coverage",
}, null, 2));
