import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const PREDICTIONS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "johnson-predictions.generated.json");
const TODAY_DETAILS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "today-race-details.generated.json");
const SLACK_WEBHOOK_URL = process.env.BOATRACE_SLACK_WEBHOOK_URL?.trim() ?? "";
const SITE_URL = "https://mitiki0720-oss.github.io/boatrace-datalavo/#mobile-page";

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
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const asRecord = (value) => (value && typeof value === "object" && !Array.isArray(value) ? value : {});
const asArray = (value) => (Array.isArray(value) ? value : value && typeof value === "object" ? Object.values(value) : []);

const createEmptyPayload = () => ({
  generatedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  source: "kurari-boat-prediction-page",
  records: [],
  notifiedSlackResultKeys: [],
  notifiedSlackHitKeys: [],
});

async function loadJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function normalizeRecordList(payload) {
  const root = asRecord(payload);
  const records = root.records;

  if (Array.isArray(records)) {
    return records;
  }

  if (records && typeof records === "object") {
    return Object.values(records);
  }

  return [];
}

function buildRecordMap(payload) {
  return normalizeRecordList(payload).reduce((map, record) => {
    if (record && typeof record === "object" && record.raceKey) {
      map.set(record.raceKey, { ...record });
    }
    return map;
  }, new Map());
}

function buildRecordsArray(recordMap) {
  return [...recordMap.values()].sort((left, right) => {
    if (left.date !== right.date) {
      return String(right.date ?? "").localeCompare(String(left.date ?? ""));
    }

    const updatedCompare = String(right.updatedAt ?? right.savedAt ?? "").localeCompare(String(left.updatedAt ?? left.savedAt ?? ""));
    if (updatedCompare !== 0) {
      return updatedCompare;
    }

    return readNumber(left.raceNo) - readNumber(right.raceNo);
  });
}

function getResultOrder(race) {
  const result = asRecord(race?.result);
  const finishOrder = result.finishOrder ?? race?.finishOrder;

  if (Array.isArray(finishOrder)) {
    const values = finishOrder.slice(0, 3).map((item) => normalizeText(item)).filter(Boolean);
    return values.join("-");
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
    ...asArray(result.payoutsFull),
    ...asArray(result.payouts),
    ...asArray(race?.payoutsFull),
    ...asArray(race?.payouts),
    result.payout3tan,
    result.payout2tan,
    race?.payout3tan,
    race?.payout2tan,
  ].filter(Boolean);
}

function payoutTypeMatches(type, payout) {
  const text = normalizeText(payout?.betType ?? payout?.type ?? payout?.label ?? payout?.name).toLowerCase();
  if (type === "trifecta") return /3連単|三連単|3単|trifecta/.test(text);
  if (type === "exacta") return /2連単|二連単|2単|exacta/.test(text);
  return false;
}

function findPayoutForBet(bet, race, finishOrder) {
  const payouts = readPayouts(race);
  const expectedCombination = bet.type === "exacta" ? finishOrder.split("-").slice(0, 2).join("-") : finishOrder;
  const normalizedExpected = normalizeCombination(expectedCombination);

  const matched = payouts.find((payout) => {
    if (!payoutTypeMatches(bet.type, payout)) {
      return false;
    }

    return normalizeCombination(payout.combination ?? payout.numbers ?? payout.result) === normalizedExpected;
  });

  return readNumber(matched?.payout ?? matched?.amount ?? matched?.value);
}

function findRaceForRecord(todayFeed, record) {
  const targetVenueCode = normalizeText(record.venueCode);
  const targetVenueName = normalizeVenueName(record.venueName);
  const targetRaceNo = readNumber(record.raceNo);
  const targetDate = normalizeText(record.date || todayFeed?.date);

  for (const venue of asArray(todayFeed?.venues)) {
    const venueDate = normalizeText(venue.date || todayFeed?.date);
    if (targetDate && venueDate && targetDate !== venueDate) {
      continue;
    }

    const venueMatches =
      (targetVenueCode && normalizeText(venue.venueCode) === targetVenueCode) ||
      (targetVenueName && normalizeVenueName(venue.venueName) === targetVenueName);

    if (!venueMatches) {
      continue;
    }

    const race = asArray(venue.races).find((item) => readNumber(item.raceNo) === targetRaceNo || normalizeText(item.raceId) === normalizeText(record.raceId));
    if (race) {
      return { venue, race };
    }
  }

  return null;
}

function getPredictionEntries(record) {
  const parsedBets = asArray(record.parsedBets)
    .filter((bet) => bet && typeof bet === "object")
    .map((bet) => ({
      type: bet.type,
      label: bet.label,
      combination: normalizeCombination(bet.normalized ?? bet.combination),
      amountYen: readNumber(bet.amountYen) || 100,
    }))
    .filter((bet) => bet.combination);

  if (parsedBets.length > 0) {
    return parsedBets;
  }

  return asArray(record.tickets)
    .filter((ticket) => ticket && typeof ticket === "object")
    .map((ticket) => ({
      type: String(ticket.betType ?? "").includes("2連単") ? "exacta" : "trifecta",
      label: ticket.betType,
      combination: normalizeCombination(ticket.combination),
      amountYen: 100,
    }))
    .filter((ticket) => ticket.combination);
}

function buildPredictionSummary(entries) {
  return entries.slice(0, 4).map((entry) => `${entry.label ?? (entry.type === "exacta" ? "2連単" : "3連単")} ${entry.combination}`).join(" / ");
}

function resolveResult(record, raceInfo) {
  const finishOrder = getResultOrder(raceInfo.race);
  if (!finishOrder || !isRaceConfirmed(raceInfo.race)) {
    return null;
  }

  const predictionEntries = getPredictionEntries(record);
  const totalStakeYen = readNumber(record.totalStakeYen) || predictionEntries.reduce((sum, entry) => sum + (readNumber(entry.amountYen) || 100), 0);
  let matchedEntry = null;
  let hitEntry = null;
  let payoutYen = 0;

  for (const entry of predictionEntries) {
    const expected = entry.type === "exacta" ? finishOrder.split("-").slice(0, 2).join("-") : finishOrder;
    if (entry.combination !== normalizeCombination(expected)) {
      continue;
    }

    matchedEntry = entry;

    payoutYen = findPayoutForBet(entry, raceInfo.race, finishOrder);
    if (payoutYen > 0) {
      hitEntry = entry;
      break;
    }
  }

  const hitBetNumbers = (hitEntry ?? matchedEntry) ? normalizeCombination((hitEntry ?? matchedEntry).combination) : "";
  const profitYen = payoutYen - totalStakeYen;
  const roi = totalStakeYen > 0 ? (payoutYen / totalStakeYen) * 100 : 0;
  const status = matchedEntry || readNumber(record.payoutYen) > 0 || Boolean(normalizeText(record.hitBetNumbers)) ? "hit" : "miss";

  return {
    status,
    updatedRecord: {
      ...record,
      resultStatus: "confirmed",
      finishOrder,
      payoutYen,
      profitYen,
      roi,
      hitBetType: (hitEntry ?? matchedEntry) ? ((hitEntry ?? matchedEntry).type === "exacta" ? "2連単" : "3連単") : "",
      hitBetNumbers,
      updatedAt: new Date().toISOString(),
    },
    notification: {
      date: record.date,
      venueCode: record.venueCode,
      venueName: record.venueName,
      raceNo: readNumber(record.raceNo),
      finishOrder,
      payoutYen,
      totalStakeYen,
      profitYen,
      hitBetType: (hitEntry ?? matchedEntry) ? ((hitEntry ?? matchedEntry).type === "exacta" ? "2連単" : "3連単") : "",
      hitBetNumbers,
      predictionSummary: buildPredictionSummary(predictionEntries),
      status,
    },
  };
}

function buildResultDedupeKey(item) {
  return `boat-slack-result:${item.date}:${item.venueCode || item.venueName}:${item.raceNo}:${item.finishOrder}:${item.payoutYen}:${item.hitBetNumbers || "miss"}`;
}

function formatYen(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return `${value.toLocaleString("ja-JP")}円`;
}

function formatSignedYen(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : value < 0 ? "-" : ""}${Math.abs(value).toLocaleString("ja-JP")}円`;
}

function buildSlackText(results) {
  return results.map((item) => {
    if (item.status === "hit") {
      return [
        `🚤🎯 ボート的中`,
        `${item.venueName} ${item.raceNo}R`,
        ``,
        `${item.hitBetType} ${item.hitBetNumbers}`,
        `払戻 ${formatYen(item.payoutYen)}`,
        `収支 ${formatSignedYen(item.profitYen)}`,
        `投資 ${formatYen(item.totalStakeYen)}`,
        ``,
        `日付：${item.date}`,
        `結果：${item.finishOrder}`,
      ].join("\n");
    }

    return [
      `🚤☔ ボート外れ`,
      `${item.venueName} ${item.raceNo}R`,
      ``,
      `予想：${item.predictionSummary || "買い目未取得"}`,
      `結果：${item.finishOrder}`,
      `投資 ${formatYen(item.totalStakeYen)}`,
      `払戻 ${formatYen(item.payoutYen)}`,
      `収支 ${formatSignedYen(item.profitYen)}`,
      ``,
      `日付：${item.date}`,
    ].join("\n");
  }).join("\n\n---\n\n");
}

async function postToSlack(results) {
  if (!SHOULD_SEND || results.length === 0) {
    return { delivered: !SHOULD_SEND, reason: SHOULD_SEND ? "no-results" : "send-disabled" };
  }

  if (!SLACK_WEBHOOK_URL) {
    console.log("[notify-boat-slack-hits] BOATRACE_SLACK_WEBHOOK_URL は未設定です。送信をスキップします。");
    return { delivered: false, reason: "webhook-missing" };
  }

  const payload = {
    text: `🚤 ボート結果通知 ${results.length}件`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🚤 ボート結果通知 ${results.length}件`,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: buildSlackText(results),
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `<${SITE_URL}|MobilePage を開く>`,
        },
      },
    ],
  };

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${text}`);
  }

  console.log(`[notify-boat-slack-hits] Sent ${results.length} result notification(s) to Slack.`);
  return { delivered: true, reason: "sent" };
}

async function main() {
  const predictionsPayload = await loadJson(PREDICTIONS_FILE, createEmptyPayload());
  const todayFeed = await loadJson(TODAY_DETAILS_FILE, null);
  const recordMap = buildRecordMap(predictionsPayload);
  const notifiedResultKeys = new Set(asArray(predictionsPayload.notifiedSlackResultKeys).map((item) => String(item)));

  console.log("[notify-boat-slack-hits] loaded", {
    recordCount: recordMap.size,
    venueCount: asArray(todayFeed?.venues).length,
    dryRun: DRY_RUN,
    shouldWrite: SHOULD_WRITE,
    shouldSend: SHOULD_SEND,
    hasWebhook: Boolean(SLACK_WEBHOOK_URL),
  });

  const notifications = [];
  let recordsChanged = false;

  for (const [raceKey, record] of recordMap.entries()) {
    const raceInfo = findRaceForRecord(todayFeed, record);
    if (!raceInfo) {
      continue;
    }

    const resolved = resolveResult(record, raceInfo);
    if (!resolved) {
      continue;
    }

    const previousSnapshot = JSON.stringify(record);
    const nextSnapshot = JSON.stringify(resolved.updatedRecord);
    if (previousSnapshot !== nextSnapshot) {
      recordMap.set(raceKey, resolved.updatedRecord);
      recordsChanged = true;
    }

    const dedupeKey = buildResultDedupeKey(resolved.notification);
    if (notifiedResultKeys.has(dedupeKey)) {
      continue;
    }

    notifications.push({ ...resolved.notification, dedupeKey });
  }

  if (notifications.length === 0) {
    console.log("[notify-boat-slack-hits] No new result notifications.");
  } else if (DRY_RUN) {
    console.log("[notify-boat-slack-hits] dry-run notifications");
    for (const item of notifications) {
      console.log(`- ${item.status === "hit" ? "HIT" : "MISS"} ${item.date} ${item.venueName} ${item.raceNo}R result=${item.finishOrder} payout=${item.payoutYen} hit=${item.hitBetNumbers || "miss"}`);
    }
  }

  const sendResult = await postToSlack(notifications);
  const canPersistNotificationKeys = notifications.length > 0 && SHOULD_WRITE && (sendResult.delivered || !SHOULD_SEND);

  const nextPayload = {
    ...createEmptyPayload(),
    ...predictionsPayload,
    generatedAt: predictionsPayload.generatedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    records: buildRecordsArray(recordMap),
    notifiedSlackResultKeys: canPersistNotificationKeys
      ? Array.from(new Set([
          ...asArray(predictionsPayload.notifiedSlackResultKeys).map((item) => String(item)),
          ...notifications.map((item) => item.dedupeKey),
        ])).slice(-1000)
      : asArray(predictionsPayload.notifiedSlackResultKeys).map((item) => String(item)),
    notifiedSlackHitKeys: canPersistNotificationKeys
      ? Array.from(new Set([
          ...asArray(predictionsPayload.notifiedSlackHitKeys).map((item) => String(item)),
          ...notifications.filter((item) => item.status === "hit").map((item) => item.dedupeKey),
        ])).slice(-1000)
      : asArray(predictionsPayload.notifiedSlackHitKeys).map((item) => String(item)),
    slackNotifiedAt: canPersistNotificationKeys ? new Date().toISOString() : predictionsPayload.slackNotifiedAt,
  };

  if (!SHOULD_WRITE) {
    return;
  }

  if (!recordsChanged && !canPersistNotificationKeys) {
    console.log("[notify-boat-slack-hits] No JSON updates to write.");
    return;
  }

  await fs.writeFile(PREDICTIONS_FILE, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf-8");
  console.log(`[notify-boat-slack-hits] Updated johnson predictions JSON. notifications=${notifications.length}`);
}

main().catch((error) => {
  console.error("[notify-boat-slack-hits] failed", error);
  process.exit(1);
});