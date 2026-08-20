import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyDeliveredHitNotifications,
  buildRaceNotificationKey,
  buildSlackText,
  collectHitNotifications,
} from "./notifyBoatSlackHits.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const todayFeed = {
  date: "2026-08-16",
  venues: [{
    venueCode: "17",
    venueName: "宮島",
    date: "2026-08-16",
    races: [{
      raceNo: 5,
      result: {
        status: "confirmed",
        finishOrder: [1, 2, 3],
        payouts: [{ betType: "3連単", combination: "1-2-3", payout: 1230 }],
      },
    }],
  }],
};
const predictionsPayload = {
  records: [
    { date: "2026-08-16", venueCode: "17", venueName: "宮島", raceNo: 5, parsedBets: [
      { type: "trifecta", label: "本線", combination: "1-2-3", amountYen: 100 },
      { type: "trifecta", label: "厚め", combination: "1-2-3", amountYen: 200 },
    ] },
    { date: "2026-08-16", venueCode: "17", venueName: "宮島", raceNo: 5, parsedBets: [
      { type: "trifecta", label: "MISS", combination: "1-3-2", amountYen: 100 },
    ] },
  ],
};
const expectedKey = "2026-08-16|17|5";
assert.equal(buildRaceNotificationKey({ date: "2026-08-16", venueCode: "17", raceNo: 5 }), expectedKey);

const firstPass = collectHitNotifications({ predictionsPayload, todayFeed, notifiedKeys: new Set() });
assert.equal(firstPass.notifications.length, 1, "one race must produce one Slack notification");
assert.equal(firstPass.missCount, 1, "MISS is evaluated but not notified");
assert.equal(firstPass.notifications[0].notificationKey, expectedKey);
assert.equal(firstPass.notifications[0].hitTickets.length, 2, "multiple winning tickets must be grouped in one notification");
assert.match(buildSlackText(firstPass.notifications[0]), /🎯 的中 宮島 5R/);
assert.doesNotMatch(buildSlackText(firstPass.notifications[0]), /MISS|外れ/);

const secondPass = collectHitNotifications({ predictionsPayload, todayFeed, notifiedKeys: new Set([expectedKey]) });
assert.equal(secondPass.notifications.length, 0, "a delivered race key must not be notified twice");

const unchangedDryRunState = applyDeliveredHitNotifications({ version: 1, keys: {} }, []);
assert.deepEqual(unchangedDryRunState.keys, {}, "dry-run must not create notified keys");
const deliveredState = applyDeliveredHitNotifications({ version: 1, keys: {} }, firstPass.notifications, "2026-08-16T13:30:00+09:00");
assert.ok(deliveredState.keys[expectedKey], "only delivered HITs enter notification state");

const [workflow, notifier] = await Promise.all([
  readFile(path.join(root, ".github", "workflows", "update-boat-data.yml"), "utf8"),
  readFile(path.join(root, "scripts", "notifyBoatSlackHits.mjs"), "utf8"),
]);
const allowlistStart = workflow.indexOf("git add --");
const guardStart = workflow.indexOf("if git diff --cached", allowlistStart);
const allowlist = workflow.slice(allowlistStart, guardStart);
assert.match(workflow, /git add -- public\/data\/boatrace\/slack-hit-notified-keys\.generated\.json/);
assert.doesNotMatch(allowlist, /johnson-predictions\.generated\.json/);
assert.match(workflow, /git restore public\/data\/boatrace\/johnson-predictions\.generated\.json \|\| true/);
assert.match(workflow, /public\/data\/boatrace\/johnson-predictions\\\.generated\\\.json/);
assert.match(workflow, /public\/data\/reviews\//);
assert.ok(workflow.includes("public/data/boatrace/reviews/index\\.json"));
assert.match(workflow, /public\/dog\//);
assert.doesNotMatch(workflow, /git add public\/data(?:\s|$)/);
assert.doesNotMatch(workflow, /git add public\/data\/boatrace(?:\s|$)/);
assert.doesNotMatch(workflow, /^\s*git add \.\s*$/m);
assert.doesNotMatch(workflow, /git add -A(?:\s|$)/);
assert.doesNotMatch(notifier, /writeFile\(PREDICTIONS_FILE/);

console.log(JSON.stringify({
  ok: true,
  hitOnly: true,
  oneNotificationPerRace: true,
  dryRunStateWrite: false,
  notificationStatePath: "public/data/boatrace/slack-hit-notified-keys.generated.json",
}, null, 2));
