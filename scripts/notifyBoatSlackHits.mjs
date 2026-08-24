import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const PREDICTIONS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "johnson-predictions.generated.json");
const TODAY_DETAILS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "today-race-details.generated.json");
const NOTIFIED_KEYS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "slack-hit-notified-keys.generated.json");
const SLACK_WEBHOOK_URL = process.env.BOATRACE_SLACK_WEBHOOK_URL?.trim() ?? "";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const IMPLICIT_DEFAULT_MODE = !DRY_RUN && !args.has("--write") && !args.has("--send");
const SHOULD_WRITE = !DRY_RUN && (IMPLICIT_DEFAULT_MODE || args.has("--write"));
const SHOULD_SEND = !DRY_RUN && (IMPLICIT_DEFAULT_MODE || args.has("--send"));

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[＞>→]/g, "-")
    .replace(/[－ー―‐]/g, "-")
    .replace(/\s+/g, "")
    .trim();

const normalizeVenueName = (value) =>
  normalizeText(value)
    .replace(/^ボートレース/, "")
    .replace(/^BOATRACE/i, "")
    .toLowerCase();

const normalizeCombination = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/[=＝]/g, "-")
    .replace(/[‐‑‒–—―−－ーｰ~〜～>＞]/g, "-")
    .replace(/[^\d-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const readNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asArray = (value) => (Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : []);

const createEmptyNotificationState = () => ({
  version: 1,
  generatedAt: new Date().toISOString(),
  source: "notifyBoatSlackHits",
  keys: {},
});

async function loadJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeRecordList(payload) {
  const records = asRecord(payload).records;
  return Array.isArray(records) ? records : records && typeof records === "object" ? Object.values(records) : [];
}

function readActiveDate(todayFeed) {
  const date = String(todayFeed?.date ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function getResultOrder(race) {
  const result = asRecord(race?.result);
  const finishOrder = result.finishOrder ?? race?.finishOrder;
  if (Array.isArray(finishOrder)) {
    return finishOrder.slice(0, 3).map((item) => normalizeText(item)).filter(Boolean).join("-");
  }
  return normalizeCombination(finishOrder);
}

function isRaceConfirmed(race) {
  const result = asRecord(race?.result);
  const statusText = normalizeText(result.status ?? race?.status).toLowerCase();
  return statusText === "confirmed" || statusText === "finished" || Boolean(getResultOrder(race));
}

function readPayouts(race) {
  const result = asRecord(race?.result);
  return [
    ...asArray(result.payoutsFull), ...asArray(result.payouts),
    ...asArray(race?.payoutsFull), ...asArray(race?.payouts),
    result.payout3tan, result.payout2tan, race?.payout3tan, race?.payout2tan,
  ].filter(Boolean);
}

function payoutTypeMatches(type, payout) {
  const text = normalizeText(payout?.betType ?? payout?.type ?? payout?.label ?? payout?.name).toLowerCase();
  if (type === "trifecta") return /3連単|三連単|3単|trifecta/.test(text);
  if (type === "exacta") return /2連単|二連単|2単|exacta/.test(text);
  return false;
}

function findPayoutForBet(bet, race, finishOrder) {
  const expected = bet.type === "exacta" ? finishOrder.split("-").slice(0, 2).join("-") : finishOrder;
  const payout = readPayouts(race).find((candidate) =>
    payoutTypeMatches(bet.type, candidate) && normalizeCombination(candidate.combination ?? candidate.numbers ?? candidate.result) === normalizeCombination(expected),
  );
  return readNumber(payout?.payout ?? payout?.amount ?? payout?.value);
}

function findRaceForRecord(todayFeed, record) {
  const targetVenueCode = normalizeText(record.venueCode);
  const targetVenueName = normalizeVenueName(record.venueName);
  const targetRaceNo = readNumber(record.raceNo);
  const targetDate = normalizeText(record.date || todayFeed?.date);

  for (const venue of asArray(todayFeed?.venues)) {
    if (targetDate && normalizeText(venue.date || todayFeed?.date) && targetDate !== normalizeText(venue.date || todayFeed?.date)) continue;
    const venueMatches =
      (targetVenueCode && normalizeText(venue.venueCode) === targetVenueCode) ||
      (targetVenueName && normalizeVenueName(venue.venueName) === targetVenueName);
    if (!venueMatches) continue;
    const race = asArray(venue.races).find((item) =>
      readNumber(item.raceNo) === targetRaceNo || normalizeText(item.raceId) === normalizeText(record.raceId),
    );
    if (race) return { venue, race };
  }
  return null;
}

function getPredictionEntries(record) {
  const parsedBets = asArray(record.parsedBets)
    .filter((bet) => bet && typeof bet === "object")
    .map((bet) => ({
      type: bet.type,
      bucket: String(bet.bucket ?? bet.label ?? "").trim(),
      combination: normalizeCombination(bet.normalized ?? bet.combination),
      stake: readNumber(bet.amountYen) || null,
    }))
    .filter((bet) => bet.combination && (bet.type === "trifecta" || bet.type === "exacta"));
  if (parsedBets.length) return parsedBets;

  return asArray(record.tickets)
    .filter((ticket) => ticket && typeof ticket === "object")
    .map((ticket) => ({
      type: String(ticket.betType ?? "").includes("2連単") ? "exacta" : "trifecta",
      bucket: String(ticket.bucket ?? ticket.label ?? ticket.betType ?? "").trim(),
      combination: normalizeCombination(ticket.combination),
      stake: readNumber(ticket.amountYen) || null,
    }))
    .filter((ticket) => ticket.combination);
}

export function buildRaceNotificationKey(item) {
  const date = String(item.date ?? "").trim();
  const venueCode = String(item.venueCode ?? "").trim();
  const raceNo = readNumber(item.raceNo);
  return date && venueCode && raceNo > 0 ? `${date}|${venueCode}|${raceNo}` : "";
}

export function resolveHitNotification(record, raceInfo, activeDate) {
  const finishOrder = getResultOrder(raceInfo.race);
  if (!finishOrder || !isRaceConfirmed(raceInfo.race)) return null;

  const hitTickets = getPredictionEntries(record)
    .filter((entry) => {
      const expected = entry.type === "exacta" ? finishOrder.split("-").slice(0, 2).join("-") : finishOrder;
      return entry.combination === normalizeCombination(expected);
    })
    .map((entry) => ({
      ticket: entry.combination,
      bucket: entry.bucket || null,
      stake: entry.stake,
      betType: entry.type === "exacta" ? "2連単" : "3連単",
      payout: findPayoutForBet(entry, raceInfo.race, finishOrder),
    }));

  const notification = {
    date: String(record.date || activeDate).trim(),
    venueCode: String(record.venueCode || raceInfo.venue.venueCode || "").trim(),
    venueName: String(record.venueName || raceInfo.venue.venueName || "").trim(),
    raceNo: readNumber(record.raceNo || raceInfo.race.raceNo),
    finishOrder,
    hitTickets,
  };
  notification.notificationKey = buildRaceNotificationKey(notification);
  if (!notification.notificationKey) return null;
  if (!hitTickets.length) return { status: "miss", notification };

  notification.payoutYen = hitTickets.reduce((total, ticket) => total + readNumber(ticket.payout), 0);
  notification.totalStakeYen = hitTickets.reduce((total, ticket) => total + readNumber(ticket.stake), 0);
  notification.profitYen = notification.payoutYen - notification.totalStakeYen;
  return { status: "hit", notification };
}

function mergeHitNotification(existing, next) {
  const ticketMap = new Map(existing.hitTickets.map((ticket) => [`${ticket.betType}|${ticket.ticket}|${ticket.bucket ?? ""}|${ticket.stake ?? ""}`, ticket]));
  for (const ticket of next.hitTickets) ticketMap.set(`${ticket.betType}|${ticket.ticket}|${ticket.bucket ?? ""}|${ticket.stake ?? ""}`, ticket);
  const hitTickets = [...ticketMap.values()];
  const payoutYen = hitTickets.reduce((total, ticket) => total + readNumber(ticket.payout), 0);
  const totalStakeYen = hitTickets.reduce((total, ticket) => total + readNumber(ticket.stake), 0);
  return { ...existing, hitTickets, payoutYen, totalStakeYen, profitYen: payoutYen - totalStakeYen };
}

export function collectHitNotifications({ predictionsPayload, todayFeed, notifiedKeys = new Set() }) {
  const activeDate = readActiveDate(todayFeed);
  const byRace = new Map();
  let evaluatedCount = 0;
  let missCount = 0;
  let alreadyNotifiedCount = 0;

  for (const record of normalizeRecordList(predictionsPayload)) {
    if (!record || record.date !== activeDate) continue;
    const raceInfo = findRaceForRecord(todayFeed, record);
    if (!raceInfo) continue;
    const resolved = resolveHitNotification(record, raceInfo, activeDate);
    if (!resolved) continue;
    evaluatedCount += 1;
    if (resolved.status !== "hit") {
      missCount += 1;
      continue;
    }
    if (notifiedKeys.has(resolved.notification.notificationKey)) {
      alreadyNotifiedCount += 1;
      continue;
    }
    const existing = byRace.get(resolved.notification.notificationKey);
    byRace.set(resolved.notification.notificationKey, existing ? mergeHitNotification(existing, resolved.notification) : resolved.notification);
  }

  return { activeDate, notifications: [...byRace.values()], evaluatedCount, missCount, alreadyNotifiedCount };
}

function formatYen(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("ja-JP")}円` : "—";
}

function formatHitTickets(hitTickets) {
  return hitTickets.map((ticket) => `${ticket.betType} ${ticket.ticket}${ticket.bucket ? ` (${ticket.bucket})` : ""}`).join(" / ");
}

function buildSlackNotificationSection(item) {
  return [
    `【${item.venueName} ${item.raceNo}R】`,
    `結果: ${item.finishOrder}`,
    `的中買い目: ${formatHitTickets(item.hitTickets)}`,
    `払戻: ${formatYen(item.payoutYen)}`,
    `日付: ${item.date}`,
    `通知キー: ${item.notificationKey}`,
  ].join("\n");
}

export function buildSlackText(item) {
  return [`🎯 的中 ${item.venueName} ${item.raceNo}R`, buildSlackNotificationSection(item)].join("\n");
}

export function buildSlackBatchText(notifications) {
  return [
    `🎯 BOATRACE 的中速報 ${notifications.length}件`,
    "",
    ...notifications.map(buildSlackNotificationSection),
  ].join("\n\n");
}

export function chunkHitNotifications(notifications, maxTextLength = 3500) {
  const batches = [];
  let batch = [];

  for (const notification of notifications) {
    const candidate = [...batch, notification];
    if (batch.length > 0 && buildSlackBatchText(candidate).length > maxTextLength) {
      batches.push(batch);
      batch = [notification];
      continue;
    }
    batch = candidate;
  }

  if (batch.length > 0) batches.push(batch);
  return batches;
}

function getRetryAfterSeconds(response) {
  const raw = response.headers?.get?.("retry-after");
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 60;
}

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function postSlackBatch(text, { webhookUrl, fetchImpl, sleepImpl }) {
  for (let attempt = 0; attempt <= 1; attempt += 1) {
    try {
      const response = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ text }),
      });
      const responseText = await response.text();

      if (response.ok) return { delivered: true, attempts: attempt + 1 };

      const rateLimited = response.status === 429;
      const limitDetail = responseText.includes("message_limit_exceeded") ? " message_limit_exceeded" : "";
      if (rateLimited && attempt === 0) {
        const retryAfterSeconds = getRetryAfterSeconds(response);
        console.warn(`[notify-boat-slack-hits] Slack batch 429${limitDetail}; retrying once in ${retryAfterSeconds}s.`);
        await sleepImpl(retryAfterSeconds * 1000);
        continue;
      }

      console.error(`[notify-boat-slack-hits] Slack batch failed: status=${response.status} response=${responseText}`);
      return { delivered: false, attempts: attempt + 1, status: response.status, responseText };
    } catch (error) {
      console.error(`[notify-boat-slack-hits] Slack batch failed: status=network response=${error?.message ?? "request failed"}`);
      return { delivered: false, attempts: attempt + 1, status: "network", responseText: error?.message ?? "request failed" };
    }
  }

  return { delivered: false, attempts: 2, status: 429, responseText: "message_limit_exceeded" };
}

export async function deliverHitNotificationBatches({
  notifications,
  webhookUrl = SLACK_WEBHOOK_URL,
  fetchImpl = fetch,
  sleepImpl = sleep,
  maxTextLength = 3500,
}) {
  const delivered = [];
  let failureCount = 0;
  let postCount = 0;
  let retryCount = 0;
  if (!notifications.length) return { delivered, failureCount, postCount, retryCount, reason: "no-hits" };
  if (!webhookUrl) {
    console.log("[notify-boat-slack-hits] BOATRACE_SLACK_WEBHOOK_URL is not set. Hit notifications were skipped.");
    return { delivered, failureCount: notifications.length, postCount, retryCount, reason: "webhook-missing" };
  }

  for (const batch of chunkHitNotifications(notifications, maxTextLength)) {
    const result = await postSlackBatch(buildSlackBatchText(batch), { webhookUrl, fetchImpl, sleepImpl });
    postCount += result.attempts;
    retryCount += Math.max(0, result.attempts - 1);
    if (result.delivered) {
      delivered.push(...batch);
      console.log(`[notify-boat-slack-hits] Slack batch sent: hits=${batch.length} posts=${result.attempts}`);
    } else {
      failureCount += 1;
    }
  }
  return { delivered, failureCount, postCount, retryCount, reason: failureCount ? "partial-or-failed" : "sent" };
}

export function applyDeliveredHitNotifications(statePayload, delivered, sentAt = new Date().toISOString()) {
  const keys = { ...asRecord(statePayload).keys };
  for (const item of delivered) {
    keys[item.notificationKey] = {
      date: item.date,
      venueCode: item.venueCode,
      venueName: item.venueName,
      raceNo: item.raceNo,
      result: item.finishOrder,
      payout: item.payoutYen,
      sentAt,
      hitTickets: item.hitTickets.map(({ ticket, bucket, stake }) => ({ ticket, bucket, stake })),
    };
  }
  return { ...createEmptyNotificationState(), ...asRecord(statePayload), generatedAt: sentAt, keys };
}

export async function main() {
  const [predictionsPayload, todayFeed, notifiedState] = await Promise.all([
    loadJson(PREDICTIONS_FILE, { records: [] }),
    loadJson(TODAY_DETAILS_FILE, null),
    loadJson(NOTIFIED_KEYS_FILE, createEmptyNotificationState()),
  ]);
  const notifiedKeys = new Set(Object.keys(asRecord(notifiedState).keys));
  const collected = collectHitNotifications({ predictionsPayload, todayFeed, notifiedKeys });
  if (!collected.activeDate) {
    console.warn("[notify-boat-slack-hits] No active date in today-race-details; no notifications sent.");
    return;
  }

  console.log("[notify-boat-slack-hits] evaluated", {
    activeDate: collected.activeDate,
    hitNotificationCount: collected.notifications.length,
    missCount: collected.missCount,
    alreadyNotifiedCount: collected.alreadyNotifiedCount,
    dryRun: DRY_RUN,
    shouldWrite: SHOULD_WRITE,
    shouldSend: SHOULD_SEND,
  });
  if (DRY_RUN) {
    for (const item of collected.notifications) console.log(`- HIT ${item.date} ${item.venueName} ${item.raceNo}R key=${item.notificationKey}`);
    return;
  }

  const sendResult = SHOULD_SEND
    ? await deliverHitNotificationBatches({ notifications: collected.notifications })
    : { delivered: [], failureCount: 0, postCount: 0, retryCount: 0, reason: "send-disabled" };
  console.log(`[notify-boat-slack-hits] delivery: delivered=${sendResult.delivered.length} failedBatches=${sendResult.failureCount} posts=${sendResult.postCount} retries=${sendResult.retryCount}`);
  if (!SHOULD_WRITE || !sendResult.delivered.length) return;
  const nextState = applyDeliveredHitNotifications(notifiedState, sendResult.delivered);
  await fs.writeFile(NOTIFIED_KEYS_FILE, `${JSON.stringify(nextState, null, 2)}\n`, "utf8");
  console.log(`[notify-boat-slack-hits] Updated hit notification state. delivered=${sendResult.delivered.length}`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  main().catch((error) => {
    console.error("[notify-boat-slack-hits] failed", error);
    process.exitCode = 1;
  });
}
