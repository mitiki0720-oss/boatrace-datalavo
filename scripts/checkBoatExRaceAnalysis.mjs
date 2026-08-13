import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const analysis = readJson("public/data/boatrace-ex/derived/race-analysis/latest.json");
const targetDate = index.latestDate;
const history = readJson(`public/data/boatrace-ex/history/races/${targetDate}.json`);
const todayFlow = readJson("public/data/boatrace-ex/derived/today-flow/latest.json");

assert.equal(analysis.targetDate, targetDate, "race analysis targetDate must match latestDate");
assert.equal(analysis.summary.latestRaceCount, history.records.length, "latest race count must match history");
assert.equal(analysis.races.length, history.records.length, "every latest history race must be represented");
assert.equal(analysis.summary.venueCount, new Set(history.records.map((record) => record.venueCode)).size, "venue count must match history");
assert.equal(analysis.summary.latestRaceCount, 144, "latest source fixture must expose 144 races");
assert.equal(analysis.summary.venueCount, 12, "latest source fixture must expose 12 venues");
assert.equal(analysis.summary.resultAvailableRaceCount, todayFlow.summary.resultAvailableRaceCount, "result count must match today flow");
assert.equal(analysis.summary.payoutAvailableRaceCount, todayFlow.summary.payoutAvailableRaceCount, "payout count must match today flow");
assert.equal(new Set(analysis.races.map((race) => race.raceKey)).size, analysis.races.length, "race keys must be unique");
const expectedOfficialRegistrationLinkedCount = history.records.reduce((count, record) => count + (record.racer ?? []).filter((racer) => racer.registrationNumber).length, 0);
assert.equal(analysis.summary.officialRegistrationLinkedCount, expectedOfficialRegistrationLinkedCount, "official registration linkage count must stay source-backed");
for (const race of analysis.races) {
	assert.ok(race.sourcePaths?.history && race.sourcePaths?.racerEvidence && race.sourcePaths?.venueEvidence, `${race.raceKey} must expose source paths`);
	assert.ok(Array.isArray(race.analysisNotes) && race.analysisNotes.length > 0, `${race.raceKey} must describe source-backed availability`);
	assert.ok(Array.isArray(race.racers), `${race.raceKey} must expose racers`);
	for (const racer of race.racers) {
		assert.ok(["official-registration", "exact-name-linked", "unresolved"].includes(racer.linkageStatus), `${race.raceKey} racer linkage status is invalid`);
		if (racer.linkageStatus === "exact-name-linked") assert.ok(!racer.officialRegistrationNo && racer.resolvedRegistrationNo, `${race.raceKey} must keep official and name-linked registration separate`);
	}
}
const serialized = JSON.stringify(analysis).toLowerCase();
for (const forbidden of ["fakescore", "fakerank", "predictiongenerated", "guessed", "inferred", "fuzzy", "partialnamematch"]) {
	assert.ok(!serialized.includes(forbidden), `forbidden generated key or value: ${forbidden}`);
}
console.log(JSON.stringify({ ok: true, targetDate, latestRaceCount: analysis.summary.latestRaceCount, venueCount: analysis.summary.venueCount, resultAvailableRaceCount: analysis.summary.resultAvailableRaceCount, payoutAvailableRaceCount: analysis.summary.payoutAvailableRaceCount }, null, 2));
