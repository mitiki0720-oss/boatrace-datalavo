import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDeliveredHitNotifications,
  collectHitNotifications,
  deliverHitNotificationBatches,
} from "./notifyBoatSlackHits.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const date = "2026-08-27";
const notificationKey = (raceNo) => `${date}|23|${raceNo}`;
const response = (status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => status === 429 ? "message_limit_exceeded" : "ok",
  headers: { get: () => null },
});
const makeFetch = (responses, calls) => async (_url, options) => {
  calls.push(options);
  return responses.shift();
};
const createFeed = () => ({
  date,
  venues: [{
    date,
    venueCode: "23",
    venueName: "唐津",
    races: [1, 5].map((raceNo) => ({
      raceNo,
      result: {
        status: "confirmed",
        finishOrder: [1, 2, 3],
        payouts: [{ betType: "3連単", combination: "1-2-3", payout: 1230 }],
      },
    })),
  }],
});
const createRecord = (raceNo, overrides = {}) => ({
  date,
  venueCode: "23",
  venueName: "唐津",
  raceNo,
  parsedBets: [{ type: "trifecta", label: "本線", combination: "1-2-3", amountYen: 100 }],
  ...overrides,
});

const feed = createFeed();
const firstCollected = collectHitNotifications({
  predictionsPayload: { records: [createRecord(1)] },
  todayFeed: feed,
  notifiedKeys: new Set(),
});
assert.deepEqual(firstCollected.notifications.map((item) => item.notificationKey), [notificationKey(1)]);
const firstCalls = [];
const firstDelivered = await deliverHitNotificationBatches({
  notifications: firstCollected.notifications,
  webhookUrl: "https://example.test",
  fetchImpl: makeFetch([response()], firstCalls),
  sleepImpl: async () => {},
});
assert.equal(firstCalls.length, 1, "first HIT sends exactly one POST");
assert.equal(firstDelivered.delivered.length, 1);
const firstState = applyDeliveredHitNotifications({ version: 1, keys: {} }, firstDelivered.delivered, "2026-08-27T08:00:00+09:00");
assert.ok(firstState.keys[notificationKey(1)]);

const secondCollected = collectHitNotifications({
  predictionsPayload: { records: [createRecord(1), createRecord(5)] },
  todayFeed: feed,
  notifiedKeys: new Set(Object.keys(firstState.keys)),
});
assert.deepEqual(secondCollected.notifications.map((item) => item.notificationKey), [notificationKey(5)]);
const secondCalls = [];
const secondDelivered = await deliverHitNotificationBatches({
  notifications: secondCollected.notifications,
  webhookUrl: "https://example.test",
  fetchImpl: makeFetch([response()], secondCalls),
  sleepImpl: async () => {},
});
assert.equal(secondCalls.length, 1, "only the newly hit race sends a POST");
const secondState = applyDeliveredHitNotifications(firstState, secondDelivered.delivered, "2026-08-27T10:00:00+09:00");

const thirdCollected = collectHitNotifications({
  predictionsPayload: { records: [createRecord(1), createRecord(5)] },
  todayFeed: feed,
  notifiedKeys: new Set(Object.keys(secondState.keys)),
});
assert.equal(thirdCollected.notifications.length, 0, "already delivered races must not be sent again");

const changedDetailCollected = collectHitNotifications({
  predictionsPayload: { records: [createRecord(1, { raceId: "changed", parsedBets: [{ type: "trifecta", label: "厚め", combination: "1-2-3", amountYen: 500 }] })] },
  todayFeed: feed,
  notifiedKeys: new Set(Object.keys(secondState.keys)),
});
assert.equal(changedDetailCollected.notifications.length, 0, "result or ticket detail changes must not re-notify the same race key");

const retryFailureCalls = [];
const retryFailure = await deliverHitNotificationBatches({
  notifications: firstCollected.notifications,
  webhookUrl: "https://example.test",
  fetchImpl: makeFetch([response(429), response(429)], retryFailureCalls),
  sleepImpl: async () => {},
});
assert.equal(retryFailureCalls.length, 2, "429 uses only one retry");
assert.equal(retryFailure.delivered.length, 0);
const failedState = applyDeliveredHitNotifications({ version: 1, keys: {} }, retryFailure.delivered);
assert.deepEqual(failedState.keys, {}, "failed delivery must remain eligible for a future run");
const futureCollected = collectHitNotifications({
  predictionsPayload: { records: [createRecord(1)] },
  todayFeed: feed,
  notifiedKeys: new Set(Object.keys(failedState.keys)),
});
assert.equal(futureCollected.notifications.length, 1, "failed notification is retried by a later run");

const [updateWorkflow, notifyWorkflow] = await Promise.all([
  readFile(path.join(root, ".github", "workflows", "update-boat-data.yml"), "utf8"),
  readFile(path.join(root, ".github", "workflows", "notify-boat-slack-hits.yml"), "utf8"),
]);
assert.match(updateWorkflow, /concurrency:\s*\n\s+group: update-boat-data-main\s*\n\s+cancel-in-progress: false/);
assert.match(updateWorkflow, /update-boat-data:\s*\n\s+concurrency:\s*\n\s+group: boatrace-slack-hit-state\s*\n\s+cancel-in-progress: false/);
assert.match(notifyWorkflow, /notify:\s*\n\s+concurrency:\s*\n\s+group: boatrace-slack-hit-state\s*\n\s+cancel-in-progress: false/);
assert.match(notifyWorkflow, /ref: main/);
assert.match(notifyWorkflow, /persist-credentials: true/);
assert.match(notifyWorkflow, /git pull --ff-only origin main/);
assert.match(notifyWorkflow, /git diff --quiet -- public\/data\/boatrace\/slack-hit-notified-keys\.generated\.json/);
assert.match(notifyWorkflow, /git add -- public\/data\/boatrace\/slack-hit-notified-keys\.generated\.json/);
assert.doesNotMatch(notifyWorkflow, /git add(?: --)? public\/data\/boatrace\/johnson-predictions\.generated\.json/);
assert.doesNotMatch(notifyWorkflow, /git add \./);
assert.doesNotMatch(notifyWorkflow, /git add -A/);

console.log(JSON.stringify({
  ok: true,
  keyFormat: "YYYY-MM-DD|venueCode|raceNo",
  firstRunPosts: firstCalls.length,
  secondRunKeys: secondCollected.notifications.map((item) => item.notificationKey),
  thirdRunPosts: thirdCollected.notifications.length,
  changedDetailRenotify: false,
  failed429FutureRetry: true,
  sharedConcurrency: "boatrace-slack-hit-state",
}, null, 2));
