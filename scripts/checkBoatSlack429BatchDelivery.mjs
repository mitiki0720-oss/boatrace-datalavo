import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDeliveredHitNotifications,
  buildSlackBatchText,
  chunkHitNotifications,
  deliverHitNotificationBatches,
} from "./notifyBoatSlackHits.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const hits = [
  { notificationKey: "2026-08-21|02|1", date: "2026-08-21", venueCode: "02", venueName: "戸田", raceNo: 1, finishOrder: "1-2-3", payoutYen: 1230, hitTickets: [{ betType: "3連単", ticket: "1-2-3", bucket: "本線", stake: 100 }] },
  { notificationKey: "2026-08-21|23|1", date: "2026-08-21", venueCode: "23", venueName: "唐津", raceNo: 1, finishOrder: "1-3-2", payoutYen: 980, hitTickets: [{ betType: "3連単", ticket: "1-3-2", bucket: "厚め", stake: 100 }] },
];
const response = (status, body = "ok", retryAfter = null) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
  headers: { get: (name) => name.toLowerCase() === "retry-after" ? retryAfter : null },
});
const makeFetch = (responses, calls) => async (_url, options) => {
  calls.push(options);
  return responses.shift();
};

assert.match(buildSlackBatchText(hits), /BOATRACE 的中速報 2件/);
assert.equal(chunkHitNotifications(hits).length, 1, "two ordinary hits must be one batch");

const normalCalls = [];
const normal = await deliverHitNotificationBatches({ notifications: hits, webhookUrl: "https://example.test", fetchImpl: makeFetch([response(200)], normalCalls), sleepImpl: async () => {} });
assert.equal(normal.postCount, 1);
assert.equal(normal.delivered.length, 2);
assert.equal(normalCalls.length, 1);

const retryCalls = [];
const waits = [];
const retrySuccess = await deliverHitNotificationBatches({ notifications: hits, webhookUrl: "https://example.test", fetchImpl: makeFetch([response(429, "message_limit_exceeded", "3"), response(200)], retryCalls), sleepImpl: async (milliseconds) => waits.push(milliseconds) });
assert.equal(retrySuccess.postCount, 2);
assert.equal(retrySuccess.retryCount, 1);
assert.equal(retrySuccess.delivered.length, 2);
assert.deepEqual(waits, [3000]);

const retryFailure = await deliverHitNotificationBatches({ notifications: hits, webhookUrl: "https://example.test", fetchImpl: makeFetch([response(429, "message_limit_exceeded"), response(429, "message_limit_exceeded")], []), sleepImpl: async () => {} });
assert.equal(retryFailure.postCount, 2);
assert.equal(retryFailure.delivered.length, 0);
assert.equal(retryFailure.failureCount, 1);

const non429Failure = await deliverHitNotificationBatches({ notifications: hits, webhookUrl: "https://example.test", fetchImpl: makeFetch([response(403, "forbidden")], []), sleepImpl: async () => { throw new Error("non-429 must not sleep"); } });
assert.equal(non429Failure.postCount, 1);
assert.equal(non429Failure.delivered.length, 0);

const persisted = applyDeliveredHitNotifications({ version: 1, keys: { existing: { sentAt: "old" } } }, normal.delivered, "2026-08-21T13:30:00+09:00");
assert.deepEqual(Object.keys(persisted.keys).sort(), ["2026-08-21|02|1", "2026-08-21|23|1", "existing"]);
const failedState = applyDeliveredHitNotifications({ version: 1, keys: {} }, retryFailure.delivered);
assert.deepEqual(failedState.keys, {});

const workflow = await readFile(path.join(root, ".github", "workflows", "notify-boat-slack-hits.yml"), "utf8");
assert.match(workflow, /git diff --quiet -- public\/data\/boatrace\/slack-hit-notified-keys\.generated\.json/);
assert.match(workflow, /git add -- public\/data\/boatrace\/slack-hit-notified-keys\.generated\.json/);
assert.doesNotMatch(workflow, /git add(?: --)? public\/data\/boatrace\/johnson-predictions\.generated\.json/);
assert.doesNotMatch(workflow, /git add \./);
assert.doesNotMatch(workflow, /git add -A/);

console.log(JSON.stringify({ ok: true, normalBatchPostsForTwoHits: 1, max429Retries: 1, productionWebhookUsed: false }, null, 2));
