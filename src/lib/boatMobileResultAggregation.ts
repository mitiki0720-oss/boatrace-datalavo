export type BoatMobileSourceType = "public-johnson" | "johnson" | "prediction" | "practice";

export type BoatMobileRecord = Record<string, unknown> & {
  date?: string;
  venueCode?: string;
  venueName?: string;
  raceNo?: number | string;
  predictionText?: string;
  sourceType?: BoatMobileSourceType;
};

export type BoatMobileVenue = {
  venueName: string;
  venueCode?: string;
  date?: string;
  races: Array<Record<string, unknown>>;
};

export type BoatMobileFeed = {
  date: string;
  venues: BoatMobileVenue[];
};

export type BoatMobileAutoResultRecord = {
  key: string;
  date: string;
  venueCode: string;
  venueName: string;
  raceNo: number;
  sourceType?: BoatMobileSourceType;
  hasOfficialRace: boolean;
  hasPrediction: boolean;
  isRaceConfirmed: boolean;
  isSettledPrediction: boolean;
  isHit: boolean;
  finishOrder: string;
  hitBetType?: string;
  hitBetNumbers?: string;
  investment?: number;
  payout?: number;
  profit?: number;
  roi?: number;
};

export type BoatMobileTodaySummary = {
  savedRaceCount: number;
  officialResultCount: number;
  settledPredictionRaceCount: number;
  hitCount: number;
  investment?: number;
  payout?: number;
  profit?: number;
  hitRate?: number;
  roi?: number;
};

const readText = (value: unknown): string =>
  typeof value === "string" || typeof value === "number" ? String(value).trim() : "";

const readOptionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value.replace(/[,+円%\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const normalizeVenueName = (value: unknown): string =>
  readText(value)
    .normalize("NFKC")
    .replace(/ボートレース|競艇場/g, "")
    .replace(/[\s　]/g, "");

const normalizeVenueCode = (value: unknown): string => {
  const text = readText(value);
  return /^\d+$/.test(text) ? text.padStart(2, "0") : text;
};

const normalizeRaceNo = (value: unknown): number => {
  const match = readText(value).match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const normalizeCombination = (value: unknown): string =>
  readText(value)
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−－ーｰ~〜～>＞=＝]/g, "-")
    .replace(/\s+/g, "")
    .replace(/^-+|-+$/g, "");

const getIdentity = (record: BoatMobileRecord) => ({
  date: readText(record.date),
  venueCode: normalizeVenueCode(record.venueCode),
  venueName: normalizeVenueName(record.venueName),
  raceNo: normalizeRaceNo(record.raceNo),
});

export const buildBoatMobileRaceKey = (record: BoatMobileRecord): string => {
  const identity = getIdentity(record);
  const venuePart = identity.venueCode
    ? `code:${identity.venueCode}`
    : `name:${identity.venueName || "unknown"}`;
  return `${identity.date || "unknown"}|${venuePart}|${identity.raceNo}`;
};

export const isSameBoatMobileRace = (left: BoatMobileRecord, right: BoatMobileRecord): boolean => {
  const a = getIdentity(left);
  const b = getIdentity(right);
  if (!a.date || a.date !== b.date || !a.raceNo || a.raceNo !== b.raceNo) return false;
  if (a.venueCode && b.venueCode) return a.venueCode === b.venueCode;
  return Boolean(a.venueName && b.venueName && a.venueName === b.venueName);
};

const practicePredictionFallbacks = (records: BoatMobileRecord[]): BoatMobileRecord[] =>
  records.map((record) => {
    const hitBetType = readText(record.hitBetType) || "保存済み実践";
    const hitBetNumbers = normalizeCombination(record.hitBetNumbers);
    const finishOrder = normalizeCombination(record.finishOrder ?? record.actualOrder);
    const predictionText = [
      hitBetNumbers ? `${hitBetType} ${hitBetNumbers}` : hitBetType,
      finishOrder ? `結果 ${finishOrder}` : "",
      readText(record.practiceMemo ?? record.memo),
    ].filter(Boolean).join("\n");
    return { ...record, predictionText, sourceType: "practice" };
  });

export const mergeBoatMobilePredictionSources = (
  publicJohnsonRecords: BoatMobileRecord[],
  localJohnsonRecords: BoatMobileRecord[],
  predictionRecords: BoatMobileRecord[],
  practiceRecords: BoatMobileRecord[],
): BoatMobileRecord[] => {
  const merged: BoatMobileRecord[] = [];
  const sources: Array<[BoatMobileSourceType, BoatMobileRecord[]]> = [
    ["public-johnson", publicJohnsonRecords],
    ["johnson", localJohnsonRecords],
    ["prediction", predictionRecords],
    ["practice", practicePredictionFallbacks(practiceRecords)],
  ];

  for (const [sourceType, records] of sources) {
    for (const record of records) {
      if (merged.some((current) => isSameBoatMobileRace(current, record))) continue;
      merged.push({ ...record, sourceType });
    }
  }

  return merged;
};

const readFinishOrder = (race: Record<string, unknown>): string => {
  const result = asRecord(race.result);
  for (const candidate of [race.finishOrder, result.finishOrder, race.actualOrder, result.actualOrder]) {
    if (Array.isArray(candidate)) {
      const values = candidate.map(readText).filter(Boolean).slice(0, 3);
      if (values.length === 3) return values.join("-");
    }
    const normalized = normalizeCombination(candidate);
    if (/^[1-6]-[1-6]-[1-6]$/.test(normalized)) return normalized;
  }
  return "";
};

const isRaceConfirmed = (race: Record<string, unknown>): boolean => {
  const result = asRecord(race.result);
  const status = readText(race.resultStatus ?? result.status ?? race.status).toLowerCase();
  return status === "confirmed" || status === "finished" || Boolean(readFinishOrder(race));
};

const payoutMatches = (item: Record<string, unknown>, keywords: string[]): boolean => {
  const label = [item.type, item.label, item.name, item.betType, item.kind].map(readText).join(" ");
  return keywords.some((keyword) => label.includes(keyword));
};

const readPayout = (race: Record<string, unknown>, type: "trifecta" | "exacta") => {
  const result = asRecord(race.result);
  const direct = type === "trifecta"
    ? asRecord(result.payout3tan ?? race.payout3tan ?? result.trifecta ?? race.trifecta)
    : asRecord(result.payout2tan ?? race.payout2tan ?? result.exacta ?? race.exacta);
  const directAmount = readOptionalNumber(direct.payout ?? direct.amount ?? direct.value);
  const directCombination = normalizeCombination(direct.combination ?? direct.numbers ?? direct.result);
  if (directAmount !== undefined || directCombination) {
    return { amount: directAmount, combination: directCombination };
  }

  const payoutItems = [
    ...asArray<Record<string, unknown>>(race.payoutsFull),
    ...asArray<Record<string, unknown>>(result.payoutsFull),
    ...asArray<Record<string, unknown>>(race.payouts),
    ...asArray<Record<string, unknown>>(result.payouts),
    ...asArray<Record<string, unknown>>(race.refunds),
    ...asArray<Record<string, unknown>>(result.refunds),
  ];
  const keywords = type === "trifecta" ? ["3連単", "trifecta"] : ["2連単", "exacta"];
  const matched = payoutItems.find((item) => payoutMatches(item, keywords));
  return {
    amount: readOptionalNumber(matched?.payout ?? matched?.amount ?? matched?.value),
    combination: normalizeCombination(matched?.combination ?? matched?.numbers ?? matched?.result),
  };
};

type ParsedTicket = { type: "trifecta" | "exacta"; combination: string; amount: number };

const readPredictionTickets = (prediction: BoatMobileRecord | undefined): ParsedTicket[] => {
  if (!prediction) return [];
  const structured = asArray<Record<string, unknown>>(prediction.parsedBets ?? prediction.tickets)
    .map((ticket): ParsedTicket | null => {
      const typeText = readText(ticket.type ?? ticket.betType ?? ticket.label).toLowerCase();
      const type = typeText.includes("2連単") || typeText.includes("exacta") ? "exacta" : "trifecta";
      const combination = normalizeCombination(ticket.normalized ?? ticket.combination ?? ticket.numbers);
      if (!(type === "trifecta" ? /^[1-6]-[1-6]-[1-6]$/ : /^[1-6]-[1-6]$/).test(combination)) return null;
      return { type, combination, amount: readOptionalNumber(ticket.amountYen ?? ticket.amount ?? ticket.stake) ?? 100 };
    })
    .filter((ticket): ticket is ParsedTicket => ticket !== null);
  if (structured.length > 0) return structured;

  const text = readText(prediction.predictionText ?? prediction.johnsonText);
  return Array.from(text.matchAll(/(?:^|\s)([1-6])\s*[-=]\s*([1-6])\s*[-=]\s*([1-6])(?:\s|$)/gm)).map((match) => ({
    type: "trifecta" as const,
    combination: `${match[1]}-${match[2]}-${match[3]}`,
    amount: 100,
  }));
};

const hasPracticeHit = (practice: BoatMobileRecord | undefined): boolean => Boolean(
  practice && (
    (readOptionalNumber(practice.payoutYen) ?? 0) > 0 ||
    (readOptionalNumber(practice.profitYen) ?? 0) > 0 ||
    readText(practice.hitBetNumbers) ||
    asArray<unknown>(practice.hitBets).length > 0
  )
);

const buildRaceRecord = (
  identity: BoatMobileRecord,
  race: Record<string, unknown> | undefined,
  prediction: BoatMobileRecord | undefined,
  practice: BoatMobileRecord | undefined,
): BoatMobileAutoResultRecord => {
  const confirmed = race ? isRaceConfirmed(race) : false;
  const finishOrder = race ? readFinishOrder(race) : "";
  const tickets = readPredictionTickets(prediction);
  const plannedInvestment = readOptionalNumber(prediction?.totalStakeYen) ??
    (tickets.length > 0 ? tickets.reduce((sum, ticket) => sum + ticket.amount, 0) : undefined);
  const exactaOrder = finishOrder.split("-").slice(0, 2).join("-");
  const hitTicket = confirmed
    ? tickets.find((ticket) => ticket.combination === (ticket.type === "trifecta" ? finishOrder : exactaOrder))
    : undefined;
  const payoutInfo = hitTicket && race ? readPayout(race, hitTicket.type) : undefined;
  const practiceInvestment = readOptionalNumber(practice?.totalStakeYen);
  const investment = confirmed && prediction ? plannedInvestment ?? practiceInvestment : undefined;
  let payout: number | undefined;
  if (confirmed && prediction) {
    if (hitTicket) {
      payout = payoutInfo?.amount !== undefined
        ? payoutInfo.amount * (hitTicket.amount / 100)
        : readOptionalNumber(practice?.payoutYen);
    } else if (tickets.length > 0) {
      payout = 0;
    } else {
      payout = readOptionalNumber(practice?.payoutYen);
    }
  }
  const isHit = confirmed && Boolean(hitTicket || hasPracticeHit(practice));
  const profit = investment !== undefined && payout !== undefined ? payout - investment : undefined;
  const roi = investment !== undefined && payout !== undefined
    ? investment > 0 ? (payout / investment) * 100 : 0
    : undefined;

  return {
    key: buildBoatMobileRaceKey(identity),
    date: readText(identity.date),
    venueCode: normalizeVenueCode(identity.venueCode),
    venueName: readText(identity.venueName),
    raceNo: normalizeRaceNo(identity.raceNo),
    sourceType: prediction?.sourceType,
    hasOfficialRace: Boolean(race),
    hasPrediction: Boolean(prediction),
    isRaceConfirmed: confirmed,
    isSettledPrediction: confirmed && Boolean(prediction),
    isHit,
    finishOrder,
    hitBetType: hitTicket?.type === "exacta" ? "2連単" : hitTicket ? "3連単" : readText(practice?.hitBetType) || undefined,
    hitBetNumbers: hitTicket?.combination || readText(practice?.hitBetNumbers) || undefined,
    investment,
    payout,
    profit,
    roi,
  };
};

export const buildBoatMobileAutoResultRecords = (
  feed: BoatMobileFeed,
  predictions: BoatMobileRecord[],
  practiceRecords: BoatMobileRecord[] = [],
): BoatMobileAutoResultRecord[] => {
  const results: BoatMobileAutoResultRecord[] = [];
  const usedPredictions = new Set<BoatMobileRecord>();

  for (const venue of feed.venues) {
    for (const race of venue.races) {
      const identity: BoatMobileRecord = {
        date: readText(race.date) || venue.date || feed.date,
        venueCode: readText(race.venueCode) || venue.venueCode,
        venueName: readText(race.venueName) || venue.venueName,
        raceNo: normalizeRaceNo(race.raceNo ?? race.raceNumber ?? race.number),
      };
      const prediction = predictions.find((record) => isSameBoatMobileRace(record, identity));
      const practice = practiceRecords.find((record) => isSameBoatMobileRace(record, identity));
      if (prediction) usedPredictions.add(prediction);
      results.push(buildRaceRecord(identity, race, prediction, practice));
    }
  }

  for (const prediction of predictions) {
    if (usedPredictions.has(prediction) || readText(prediction.date) !== feed.date) continue;
    const practice = practiceRecords.find((record) => isSameBoatMobileRace(record, prediction));
    results.push(buildRaceRecord(prediction, undefined, prediction, practice));
  }

  const unique = new Map<string, BoatMobileAutoResultRecord>();
  for (const result of results) {
    if (!unique.has(result.key)) unique.set(result.key, result);
  }
  return Array.from(unique.values());
};

export const buildBoatMobileTodaySummary = (
  records: BoatMobileAutoResultRecord[],
  date: string,
): BoatMobileTodaySummary => {
  const dayRecords = records.filter((record) => record.date === date);
  const saved = dayRecords.filter((record) => record.hasPrediction);
  const officialResults = dayRecords.filter((record) => record.hasOfficialRace && record.isRaceConfirmed);
  const settled = dayRecords.filter((record) => record.isSettledPrediction);
  const hitCount = settled.filter((record) => record.isHit).length;
  const hasCompleteInvestment = settled.length > 0 && settled.every((record) => record.investment !== undefined);
  const hasCompletePayout = settled.length > 0 && settled.every((record) => record.payout !== undefined);
  const investment = hasCompleteInvestment
    ? settled.reduce((sum, record) => sum + (record.investment ?? 0), 0)
    : undefined;
  const payout = hasCompletePayout
    ? settled.reduce((sum, record) => sum + (record.payout ?? 0), 0)
    : undefined;
  const profit = investment !== undefined && payout !== undefined ? payout - investment : undefined;

  return {
    savedRaceCount: saved.length,
    officialResultCount: officialResults.length,
    settledPredictionRaceCount: settled.length,
    hitCount,
    investment,
    payout,
    profit,
    hitRate: settled.length > 0 ? (hitCount / settled.length) * 100 : undefined,
    roi: investment !== undefined && payout !== undefined ? investment > 0 ? (payout / investment) * 100 : 0 : undefined,
  };
};

export const buildBoatMobileHitLog = (records: BoatMobileAutoResultRecord[], date: string) => {
  const unique = new Map<string, BoatMobileAutoResultRecord>();
  for (const record of records) {
    if (record.date === date && record.isSettledPrediction && record.isHit && !unique.has(record.key)) {
      unique.set(record.key, record);
    }
  }
  return Array.from(unique.values()).sort((a, b) => a.raceNo - b.raceNo);
};

export const sortBoatMobileVenues = <T extends BoatMobileVenue>(venues: T[]): T[] =>
  [...venues].sort((left, right) => {
    const leftCode = normalizeVenueCode(left.venueCode);
    const rightCode = normalizeVenueCode(right.venueCode);
    if (leftCode && rightCode && leftCode !== rightCode) return leftCode.localeCompare(rightCode, "ja", { numeric: true });
    return left.venueName.localeCompare(right.venueName, "ja");
  });
