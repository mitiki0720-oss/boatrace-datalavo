import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const roughIndex = readJson("public/data/boatrace-ex/derived/rough-index/latest.json");
const todayFlow = readJson("public/data/boatrace-ex/derived/today-flow/latest.json");
const latest = readJson("public/data/boatrace-ex/derived/race-analysis/latest.json");
const summary = readJson("public/data/boatrace-ex/derived/race-analysis/history-summary.json");
const historyIndex = readJson("public/data/boatrace-ex/derived/race-analysis/history-index.json");

assert.equal(summary.kind, "boatrace-ex-historical-race-analysis-summary");
assert.equal(historyIndex.kind, "boatrace-ex-historical-race-analysis-index");
assert.equal(summary.dateRange.dateCount, index.availableDates.length, "summary date count must match date index");
assert.equal(historyIndex.dateCount, index.availableDates.length, "history index date count must match date index");
assert.equal(historyIndex.dates.length, index.availableDates.length, "history index must list every date");
assert.equal(index.availableDates.length, 68, "2026-08-02 historical fixture must contain 68 dates");
assert.equal(summary.summary.raceCount, roughIndex.summary.raceCount, "historical race count must match rough index");
assert.equal(summary.summary.resultAvailableRaceCount, roughIndex.summary.resultAvailableRaceCount, "result availability must match rough index");
assert.equal(summary.summary.payoutAvailableRaceCount, roughIndex.summary.payoutAvailableRaceCount, "payout availability must match rough index");
assert.equal(summary.summary.raceCount, 8784, "2026-08-02 historical fixture must contain 8784 races");
assert.equal(summary.summary.resultAvailableRaceCount, 8668, "2026-08-02 historical fixture must contain 8668 result-backed races");
assert.equal(summary.summary.payoutAvailableRaceCount, 8657, "2026-08-02 historical fixture must contain 8657 payout-backed races");
assert.equal(historyIndex.latestDate, index.latestDate, "latest date must match EX date index");

const allRaceKeys = new Set();
const totals = {
	raceCount: 0,
	resultAvailableRaceCount: 0,
	payoutAvailableRaceCount: 0,
	officialRegistrationLinkedCount: 0,
	nameLinkedCount: 0,
	unresolvedRacerCount: 0,
};
const forbidden = ["predictiongenerated", "fakescore", "fakerank", "guessed", "inferred", "fuzzy", "partialnamematch", "ticket"];

for (const date of index.availableDates) {
	const entry = historyIndex.dates.find((candidate) => candidate.date === date);
	assert.ok(entry, `history index is missing ${date}`);
	assert.ok(exists(entry.path), `history shard is missing: ${entry.path}`);
	const shard = readJson(entry.path);
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	assert.equal(shard.date, date, `${date} shard date must match`);
	assert.equal(shard.races.length, history.records.length, `${date} shard must represent every history record`);
	assert.equal(shard.summary.raceCount, history.records.length, `${date} summary race count must match history`);
	assert.equal(entry.raceCount, history.records.length, `${date} index race count must match history`);
	assert.equal(new Set(shard.races.map((race) => race.raceKey)).size, shard.races.length, `${date} shard must not duplicate race keys`);
	for (const race of shard.races) {
		assert.ok(race.sourcePaths?.history && race.sourcePaths?.racerEvidence && race.sourcePaths?.venueEvidence, `${race.raceKey} must retain source paths`);
		for (const sourcePath of [race.sourcePaths.history, race.sourcePaths.coverage, race.sourcePaths.racerEvidence, race.sourcePaths.venueEvidence]) assert.ok(exists(sourcePath), `${race.raceKey} source path is missing: ${sourcePath}`);
		assert.ok(Array.isArray(race.analysisNotes) && race.analysisNotes.length > 0, `${race.raceKey} must retain source-backed availability notes`);
		assert.ok(Array.isArray(race.racers), `${race.raceKey} must retain racers`);
		assert.ok(!allRaceKeys.has(race.raceKey), `duplicate historical race key: ${race.raceKey}`);
		allRaceKeys.add(race.raceKey);
		for (const racer of race.racers) {
			assert.ok(["official-registration", "exact-name-linked", "unresolved"].includes(racer.linkageStatus), `${race.raceKey} has an invalid racer linkage status`);
			if (racer.linkageStatus === "official-registration") assert.ok(racer.officialRegistrationNo && !racer.resolvedRegistrationNo, `${race.raceKey} must not overwrite official registration numbers`);
			if (racer.linkageStatus === "exact-name-linked") assert.ok(!racer.officialRegistrationNo && racer.resolvedRegistrationNo && racer.identityLinkMethod === "exact-normalized-name-unique", `${race.raceKey} must keep exact-name linkage separate from official registration`);
			if (racer.linkageStatus === "unresolved") assert.ok(!racer.officialRegistrationNo && !racer.resolvedRegistrationNo, `${race.raceKey} unresolved racer must stay unresolved`);
		}
	}
	totals.raceCount += shard.summary.raceCount;
	totals.resultAvailableRaceCount += shard.summary.resultAvailableRaceCount;
	totals.payoutAvailableRaceCount += shard.summary.payoutAvailableRaceCount;
	totals.officialRegistrationLinkedCount += shard.summary.officialRegistrationLinkedCount;
	totals.nameLinkedCount += shard.summary.nameLinkedCount;
	totals.unresolvedRacerCount += shard.summary.unresolvedRacerCount;
	for (const banned of forbidden) assert.ok(!JSON.stringify(shard).toLowerCase().includes(banned), `${date} shard contains forbidden generated content: ${banned}`);
}

for (const [key, value] of Object.entries(totals)) assert.equal(summary.summary[key], value, `summary ${key} must equal shard totals`);
const latestShard = historyIndex.dates.find((entry) => entry.date === index.latestDate);
assert.ok(latestShard, "latest shard must exist");
assert.equal(latestShard.raceCount, latest.summary.latestRaceCount, "latest shard race count must match latest race analysis");
assert.equal(latestShard.raceCount, 144, "2026-08-02 latest shard must contain 144 races");
assert.equal(latestShard.raceCount, todayFlow.summary.raceCount, "latest shard race count must match today flow");
assert.equal(latestShard.resultAvailableRaceCount, todayFlow.summary.resultAvailableRaceCount, "latest shard result count must match today flow");
assert.equal(latestShard.payoutAvailableRaceCount, todayFlow.summary.payoutAvailableRaceCount, "latest shard payout count must match today flow");

console.log(JSON.stringify({ ok: true, dateCount: summary.dateRange.dateCount, historyRaceCount: summary.summary.raceCount, latestDate: index.latestDate, latestRaceCount: latestShard.raceCount, resultAvailableRaceCount: summary.summary.resultAvailableRaceCount, payoutAvailableRaceCount: summary.summary.payoutAvailableRaceCount, officialRegistrationLinkedCount: summary.summary.officialRegistrationLinkedCount, nameLinkedCount: summary.summary.nameLinkedCount, unresolvedRacerCount: summary.summary.unresolvedRacerCount }, null, 2));
