import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const summary = readJson("public/data/boatrace-ex/derived/prediction-structure/history-summary.json");
const historyIndex = readJson("public/data/boatrace-ex/derived/prediction-structure/history-index.json");
let evaluated = 0;
let hits = 0;
let misses = 0;
let payoutLinkedHits = 0;
let payoutTotal = 0;
for (const entry of historyIndex.dates) {
	const shard = readJson(entry.path);
	for (const race of shard.races) {
		if (race.evaluation.evaluationStatus !== "evaluated") continue;
		evaluated += 1;
		assert.ok(Array.isArray(race.officialResult.finishOrder) && race.officialResult.finishOrder.length >= 3, `${race.date}:${race.venueCode}:${race.raceNo} evaluated without official finish order`);
		assert.ok(race.structuredTickets.length > 0, `${race.date}:${race.venueCode}:${race.raceNo} evaluated without tickets`);
		const matchingTicket = race.structuredTickets.find((ticket) => ticket.boatNumbers.every((boat, position) => boat === race.officialResult.finishOrder[position]));
		assert.equal(race.evaluation.hit, Boolean(matchingTicket), `${race.date}:${race.venueCode}:${race.raceNo} must use exact ordered ticket matching`);
		if (race.evaluation.hit) {
			hits += 1;
			assert.equal(race.evaluation.hitTicketId, matchingTicket.ticketId);
			if (race.evaluation.payoutYen !== null) {
				assert.equal(race.evaluation.payoutYen, race.officialResult.trifectaPayoutYen);
				payoutLinkedHits += 1;
				payoutTotal += race.evaluation.payoutYen;
			}
		} else misses += 1;
	}
}
assert.equal(summary.evaluatedPredictionRaceCount, evaluated);
assert.equal(summary.hitRaceCount, hits);
assert.equal(summary.missRaceCount, misses);
assert.equal(summary.payoutLinkedHitCount, payoutLinkedHits);
assert.equal(summary.totalSourceBackedPayoutYen, payoutTotal);
assert.equal(summary.readiness.status, "insufficient-history", "one evaluated race must not be promoted to ready");
console.log(JSON.stringify({ ok: true, dateCount: index.availableDates.length, evaluatedPredictionRaceCount: evaluated, hitRaceCount: hits, missRaceCount: misses, payoutLinkedHitCount: payoutLinkedHits, totalSourceBackedPayoutYen: payoutTotal, readiness: summary.readiness.status }, null, 2));
