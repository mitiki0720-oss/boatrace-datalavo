import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const PREDICTIONS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "johnson-predictions.generated.json");
const TODAY_DETAILS_FILE = path.join(ROOT_DIR, "public", "data", "boatrace", "today-race-details.generated.json");
const SLACK_WEBHOOK_URL = process.env.BOAT_SLACK_WEBHOOK_URL?.trim() ?? "";
const DRY_RUN = process.argv.includes("--dry-run");

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
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
    .replace(/[‐-‒–—―−－ーｰ~〜～>＞]/g, "-")
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

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }

    throw error;
  }
}

const readFinishOrder = (race) => {
  const result = asRecord(race.result);
  const finishOrder = result.finishOrder ?? race.finishOrder;

  if (Array.isArray(finishOrder)) {
    const values = finishOrder.slice(0, 3).map((item) => normalizeText(item)).filter(Boolean);
    return values.join("-");
  }

  return normalizeCombination(finishOrder);
};

const readPayouts = (race) => {
  const result = asRecord(race.result);
  return [
    ...asArray(result.payoutsFull),
    ...asArray(result.payouts),
    ...asArray(race.payoutsFull),
    ...asArray(race.payouts),
    result.payout3tan,
    result.payout2tan,
    race.payout3tan,
    race.payout2tan,
  ].filter(Boolean);
};

const payoutTypeMatches = (betType, payout) => {
  const text = normalizeText(payout?.betType ?? payout?.type ?? payout?.label ?? payout?.name).toLowerCase();
  if (betType === "trifecta") return /3連単|三連単|3単|trifecta/.test(text);
  if (betType === "exacta") return /2連単|二連単|2単|exacta/.test(text);
  return false;
};

const findPayoutForBet = (bet, race, finishOrder) => {
  const payouts = readPayouts(race);
  const expectedCombination = bet.type === "exacta" ? finishOrder.split("-").slice(0, 2).join("-") : finishOrder;
  const normalizedExpected = normalizeCombination(expectedCombination);

  const direct = bet.type === "exacta" ? asRecord(asRecord(race.result).payout2tan ?? race.payout2tan) : asRecord(asRecord(race.result).payout3tan ?? race.payout3tan);
  const directCombination = normalizeCombination(direct.combination ?? direct.numbers ?? direct.result);
  const directPayout = readNumber(direct.payout ?? direct.amount ?? direct.value);

  if (directCombination === normalizedExpected && directPayout > 0) {
    return directPayout;
  }

  const matched = payouts.find((payout) => {
    if (!payoutTypeMatches(bet.type, payout)) {
      return false;
    }

    return normalizeCombination(payout.combination ?? payout.numbers ?? payout.result) === normalizedExpected;
  });

  return readNumber(matched?.payout ?? matched?.amount ?? matched?.value);
};

const findRaceForRecord = (todayFeed, record) => {
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
};

const resolveHit = (record, race) => {
  const finishOrder = readFinishOrder(race);
  if (!finishOrder) {
    return null;
  }

  const bets = asArray(record.parsedBets);
  for (const bet of bets) {
    const normalizedBet = normalizeCombination(bet.normalized);
    const expected = bet.type === "exacta" ? finishOrder.split("-").slice(0, 2).join("-") : finishOrder;
    const normalizedExpected = normalizeCombination(expected);
    if (!normalizedBet || normalizedBet !== normalizedExpected) {
      continue;
    }

    const payoutYen = findPayoutForBet(bet, race, finishOrder);
    if (payoutYen <= 0) {
      continue;
    }

    return {
      date: record.date,
      venueCode: record.venueCode,
      venueName: record.venueName,
      raceNo: readNumber(record.raceNo),
      betType: bet.type === "exacta" ? "2連単" : "3連単",
      combination: normalizedExpected,
      payoutYen,
      finishOrder,
      profitYen: readNumber(record.profitYen) || payoutYen - readNumber(record.totalStakeYen),
    };
  }

  return null;
};

const buildDedupeKey = (hit) =>
  `boat-slack-hit:${hit.date}:${hit.venueCode || hit.venueName}:${hit.raceNo}:${hit.combination}:${hit.payoutYen}`;

async function postToSlack(hits) {
  if (DRY_RUN) {
    console.log("[notify-boat-slack-hits] dry-run payload");
    for (const hit of hits) {
      console.log(`- ${hit.date} ${hit.venueName} ${hit.raceNo}R ${hit.betType} ${hit.combination} 払戻=${hit.payoutYen}円`);
    }
    return { posted: false, reason: "dry-run" };
  }

  if (!SLACK_WEBHOOK_URL) {
    console.log("[notify-boat-slack-hits] BOAT_SLACK_WEBHOOK_URL は未設定です。");
    return { posted: false, reason: "webhook-missing" };
  }

  const text = [
    "ボートレース 的中通知",
    ...hits.map((hit) => `・${hit.venueName} ${hit.raceNo}R ${hit.betType} ${hit.combination} 的中 / 払戻 ${hit.payoutYen.toLocaleString("ja-JP")}円 / 収支 ${hit.profitYen >= 0 ? "+" : ""}${hit.profitYen.toLocaleString("ja-JP")}円`),
  ].join("\n");

  const response = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack post failed: ${response.status} ${body}`);
  }

  return { posted: true, reason: "sent" };
}

async function main() {
  const predictionsPayload = (await readJson(PREDICTIONS_FILE, {
    version: 1,
    updatedAt: new Date().toISOString(),
    source: "kurari-boat-prediction-page",
    records: {},
    notifiedSlackHitKeys: [],
  })) ?? {};
  const todayFeed = await readJson(TODAY_DETAILS_FILE, null);

  const records = asArray(asRecord(predictionsPayload).records);
  const notifiedKeys = new Set(asArray(predictionsPayload.notifiedSlackHitKeys).map((item) => String(item)));

  console.log("[notify-boat-slack-hits] loaded", {
    recordCount: records.length,
    venueCount: asArray(todayFeed?.venues).length,
    dryRun: DRY_RUN,
    hasWebhook: Boolean(SLACK_WEBHOOK_URL),
  });

  const hits = [];

  for (const record of records) {
    const raceInfo = findRaceForRecord(todayFeed, record);
    if (!raceInfo) {
      continue;
    }

    const hit = resolveHit(record, raceInfo.race);
    if (!hit) {
      continue;
    }

    const dedupeKey = buildDedupeKey(hit);
    if (notifiedKeys.has(dedupeKey)) {
      continue;
    }

    hits.push({ ...hit, dedupeKey });
  }

  if (hits.length <= 0) {
    console.log("[notify-boat-slack-hits] No new hits.");
    return;
  }

  const result = await postToSlack(hits);
  if (!result.posted) {
    console.log(`[notify-boat-slack-hits] skipped update: ${result.reason}`);
    return;
  }

  const nextPayload = {
    ...predictionsPayload,
    notifiedSlackHitKeys: Array.from(new Set([
      ...asArray(predictionsPayload.notifiedSlackHitKeys).map((item) => String(item)),
      ...hits.map((hit) => hit.dedupeKey),
    ])).slice(-500),
    slackNotifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(PREDICTIONS_FILE, `${JSON.stringify(nextPayload, null, 2)}\n`, "utf-8");
  console.log(`[notify-boat-slack-hits] Updated notified keys: ${hits.length}`);
}

main().catch((error) => {
  console.error("[notify-boat-slack-hits] failed", error);
  process.exit(1);
});