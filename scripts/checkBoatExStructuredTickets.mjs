import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CLASSIFIED_GROUPS, PARSER_VERSION, extractStrictStructuredTickets } from "./boatExStructuredTickets.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const summary = readJson("public/data/boatrace-ex/derived/prediction-structure/history-summary.json");
const historyIndex = readJson("public/data/boatrace-ex/derived/prediction-structure/history-index.json");
const audit = readJson(`public/data/boatrace-ex/audit/structured-tickets-evaluation-${index.latestDate}.generated.json`);

assert.equal(summary.parserVersion, PARSER_VERSION);
assert.equal(summary.dateCount, index.availableDates.length);
assert.equal(historyIndex.dates.length, index.availableDates.length);
assert.equal(historyIndex.latestDate, index.latestDate);
assert.equal(audit.kind, "boatrace-ex-structured-tickets-evaluation-audit");
const totalKeys = ["raceCount", "predictionTextAvailableRaceCount", "structuredTicketAvailableRaceCount", "structuredTicketCount", "classifiedTicketCount", "unclassifiedTicketCount", "evaluatedPredictionRaceCount", "hitRaceCount", "missRaceCount", "resultUnavailableEvaluationCount", "payoutLinkedHitCount", "totalSourceBackedPayoutYen", "totalSourceBackedInvestmentYen"];
const totals = Object.fromEntries(totalKeys.map((key) => [key, 0]));
let regressionRace = null;
for (const date of index.availableDates) {
	const entry = historyIndex.dates.find((candidate) => candidate.date === date);
	assert.ok(entry, `missing index entry for ${date}`);
	assert.ok(exists(entry.path), `missing date shard ${entry.path}`);
	const shard = readJson(entry.path);
	assert.equal(shard.date, date);
	assert.equal(shard.races.length, entry.raceCount);
	for (const key of totalKeys) totals[key] += shard.summary[key] ?? 0;
	for (const race of shard.races) {
		assert.ok(Array.isArray(race.structuredTickets));
		for (const ticket of race.structuredTickets) {
			assert.ok(["strict-ticket-pattern", "strict-pipe-ticket-pattern"].includes(ticket.parseMethod));
			assert.ok(CLASSIFIED_GROUPS.includes(ticket.group) || ticket.group === "unclassified-source-text");
			assert.equal(ticket.boatNumbers.length, 3);
			assert.equal(new Set(ticket.boatNumbers).size, 3);
			assert.ok(ticket.boatNumbers.every((boat) => Number.isInteger(boat) && boat >= 1 && boat <= 6));
			assert.ok(typeof ticket.sourcePath === "string" && !ticket.sourcePath.includes("public/data/reviews/"));
		}
		if (race.date === "2026-05-31" && race.venueCode === "08" && race.raceNo === 4) regressionRace = race;
	}
}
for (const [key, value] of Object.entries(totals)) assert.equal(summary[key], value, `summary ${key} must equal all shard totals`);
assert.equal(summary.historyRaceCount, totals.raceCount, "historyRaceCount must equal all source-backed shard records");
assert.ok(regressionRace, "strict parser regression race must exist");
assert.equal(regressionRace.structuredTickets.length, 10, "regression source has ten strict tickets");
for (const [group, count] of Object.entries(audit.regression.expectedGroupCounts)) assert.equal(regressionRace.structuredTickets.filter((ticket) => ticket.group === group).length, count, `regression group ${group} count`);
assert.deepEqual(regressionRace.structuredTickets.map((ticket) => ticket.boatNumbers), [[2, 5, 6], [2, 6, 5], [2, 1, 6], [2, 5, 1], [5, 2, 6], [1, 2, 6], [5, 6, 2], [4, 5, 6], [6, 2, 5], [6, 5, 2]]);
const pipeFixture = extractStrictStructuredTickets(`purchasePoints: 4\ninvestmentYen: 400\n【買い目】\n01 | 3連単 | 1-3-5 | 厚め\n02 | 3連単 | 1-5-3 | 本線\n03 | 3連単 | 3-1-5 | 中穴\n04 | 3連単 | 5-1-3 | 大穴`, "fixture:pipe-format");
assert.deepEqual(pipeFixture.tickets.map((ticket) => ticket.boatNumbers), [[1, 3, 5], [1, 5, 3], [3, 1, 5], [5, 1, 3]]);
assert.deepEqual(pipeFixture.tickets.map((ticket) => ticket.group), ["厚め", "本線", "中穴", "大穴"]);
assert.ok(pipeFixture.tickets.every((ticket) => ticket.stakeYen === 100));
console.log(JSON.stringify({ ok: true, parserVersion: summary.parserVersion, dateCount: summary.dateCount, predictionTextAvailableRaceCount: summary.predictionTextAvailableRaceCount, structuredTicketAvailableRaceCount: summary.structuredTicketAvailableRaceCount, structuredTicketCount: summary.structuredTicketCount, classifiedTicketCount: summary.classifiedTicketCount, unclassifiedTicketCount: summary.unclassifiedTicketCount, skippedReasons: summary.skippedReasons }, null, 2));
