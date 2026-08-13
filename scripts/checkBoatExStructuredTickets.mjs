import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CLASSIFIED_GROUPS, PARSER_VERSION } from "./boatExStructuredTickets.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const summary = readJson("public/data/boatrace-ex/derived/prediction-structure/history-summary.json");
const historyIndex = readJson("public/data/boatrace-ex/derived/prediction-structure/history-index.json");
const audit = readJson(`public/data/boatrace-ex/audit/structured-tickets-evaluation-${index.latestDate}.generated.json`);

assert.equal(summary.parserVersion, PARSER_VERSION);
assert.equal(summary.dateCount, index.availableDates.length);
assert.equal(summary.historyRaceCount, 8784);
assert.equal(summary.predictionTextAvailableRaceCount, 8292);
assert.equal(historyIndex.dates.length, index.availableDates.length);
assert.equal(historyIndex.latestDate, index.latestDate);
assert.equal(audit.kind, "boatrace-ex-structured-tickets-evaluation-audit");
const totals = { raceCount: 0, predictionTextAvailableRaceCount: 0, structuredTicketAvailableRaceCount: 0, structuredTicketCount: 0, classifiedTicketCount: 0, unclassifiedTicketCount: 0, evaluatedPredictionRaceCount: 0, hitRaceCount: 0, missRaceCount: 0, resultUnavailableEvaluationCount: 0, payoutLinkedHitCount: 0, totalSourceBackedPayoutYen: 0 };
let regressionRace = null;
for (const date of index.availableDates) {
	const entry = historyIndex.dates.find((candidate) => candidate.date === date);
	assert.ok(entry, `missing index entry for ${date}`);
	assert.ok(exists(entry.path), `missing date shard ${entry.path}`);
	const shard = readJson(entry.path);
	assert.equal(shard.date, date);
	assert.equal(shard.races.length, entry.raceCount);
	for (const [key] of Object.entries(totals)) totals[key] += shard.summary[key] ?? 0;
	for (const race of shard.races) {
		assert.ok(Array.isArray(race.structuredTickets));
		for (const ticket of race.structuredTickets) {
			assert.equal(ticket.parseMethod, "strict-ticket-pattern");
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
assert.ok(regressionRace, "strict parser regression race must exist");
assert.equal(regressionRace.structuredTickets.length, 10, "regression source has ten strict tickets");
for (const [group, count] of Object.entries(audit.regression.expectedGroupCounts)) assert.equal(regressionRace.structuredTickets.filter((ticket) => ticket.group === group).length, count, `regression group ${group} count`);
assert.deepEqual(regressionRace.structuredTickets.map((ticket) => ticket.boatNumbers), [[2, 5, 6], [2, 6, 5], [2, 1, 6], [2, 5, 1], [5, 2, 6], [1, 2, 6], [5, 6, 2], [4, 5, 6], [6, 2, 5], [6, 5, 2]]);
console.log(JSON.stringify({ ok: true, parserVersion: summary.parserVersion, dateCount: summary.dateCount, predictionTextAvailableRaceCount: summary.predictionTextAvailableRaceCount, structuredTicketAvailableRaceCount: summary.structuredTicketAvailableRaceCount, structuredTicketCount: summary.structuredTicketCount, classifiedTicketCount: summary.classifiedTicketCount, unclassifiedTicketCount: summary.unclassifiedTicketCount, skippedReasons: summary.skippedReasons }, null, 2));
