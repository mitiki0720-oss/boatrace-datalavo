import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { parseBoatBets, type ParsedBoatBet } from "../lib/boatBetParser";
import { withBasePath } from "../lib/assetPath";
import { BOAT_JOHNSON_PREDICTION_STORAGE_KEY } from "../lib/boatJohnsonPredictionStorage";

const MOBILE_PAGE_BACKGROUND_URL = withBasePath("mobile-page/backgrounds/mobile-page-bg-water-sky.png");

type AnyRecord = Record<string, unknown>;

type MobileVenue = {
  venueName: string;
  venueCode: string;
  races: AnyRecord[];
};

type MobileFeed = {
  date: string;
  generatedAt?: string;
  venues: MobileVenue[];
};

type MobilePredictionRecord = AnyRecord & {
  date?: string;
  venueName?: string;
  venueCode?: string;
  raceNo?: number;
  predictionText?: string;
  sourceType?: "public-johnson" | "johnson" | "prediction" | "practice";
};

type MobilePracticeRecord = AnyRecord & {
  date?: string;
  venueName?: string;
  venueCode?: string;
  raceNo?: number;
  payoutYen?: number | string;
  totalStakeYen?: number | string;
  profitYen?: number | string;
  roi?: number | string;
  hitBetType?: string;
  hitBetNumbers?: string;
  finishOrder?: string;
  actualOrder?: string;
  resultStatus?: string;
  updatedAt?: string;
};

type MobileEntry = {
  frame: number;
  name: string;
  branch: string;
  className: string;
  motorNo: string;
  motorRate: string;
  boatNo: string;
  boatRate: string;
  exhibitionTime: string;
  tilt: string;
  st: string;
};

type MobileTab = "entry" | "prediction" | "result" | "info";

const TODAY_DETAILS_URL = withBasePath("data/boatrace/today-race-details.generated.json");
const TODAY_FALLBACK_URL = withBasePath("data/boatrace/today.generated.json");
const VENUE_EXTRAS_URL = withBasePath("data/boatrace/venue-extras.generated.json");
const PUBLIC_JOHNSON_PREDICTIONS_URL = withBasePath("data/boatrace/johnson-predictions.generated.json");
const JOHNSON_STORAGE_KEY = BOAT_JOHNSON_PREDICTION_STORAGE_KEY;
const PREDICTION_STORAGE_KEY = "kurari-boat-data-labo-prediction-records";
const PRACTICE_STORAGE_KEY = "kurari-boat-data-labo-practice-results";

const frameColorMap: Record<number, { label: string; bg: string; color: string; border: string }> = {
  1: { label: "1", bg: "#ffffff", color: "#0f172a", border: "#cbd5e1" },
  2: { label: "2", bg: "#111827", color: "#ffffff", border: "#111827" },
  3: { label: "3", bg: "#ef4444", color: "#ffffff", border: "#ef4444" },
  4: { label: "4", bg: "#2563eb", color: "#ffffff", border: "#2563eb" },
  5: { label: "5", bg: "#facc15", color: "#422006", border: "#eab308" },
  6: { label: "6", bg: "#22c55e", color: "#ffffff", border: "#22c55e" },
};

const pageStyle: CSSProperties = {
  width: "100%",
  minHeight: "100svh",
  overflowX: "hidden",
  backgroundColor: "#eafaff",
  backgroundImage: `
    linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(235,250,255,0.22) 42%, rgba(255,255,255,0.46) 100%),
    url("${MOBILE_PAGE_BACKGROUND_URL}")
  `,
  backgroundSize: "cover",
  backgroundPosition: "center top",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "scroll",
  padding: "0 0 calc(96px + env(safe-area-inset-bottom))",
  boxSizing: "border-box",
};

const phoneStyle: CSSProperties = {
  width: "min(100%, 430px)",
  maxWidth: "430px",
  margin: "0 auto",
  boxSizing: "border-box",
  padding: "calc(10px + env(safe-area-inset-top)) 10px 0",
  display: "grid",
  gap: "12px",
};

const cardStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  borderRadius: "24px",
  border: "1px solid rgba(125, 211, 252, 0.52)",
  background: "rgba(255, 255, 255, 0.92)",
  boxShadow: "0 14px 34px rgba(14, 116, 144, 0.10)",
  overflow: "hidden",
};

const miniLabelStyle: CSSProperties = {
  margin: 0,
  color: "#0891b2",
  fontSize: "9px",
  fontWeight: 950,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: "#0f2743",
  fontSize: "20px",
  lineHeight: 1.18,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "#5d7285",
  fontSize: "11px",
  lineHeight: 1.65,
  fontWeight: 750,
};

const readString = (value: unknown): string => (typeof value === "string" || typeof value === "number" ? String(value).trim() : "");

const readNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,+円%\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const asRecord = (value: unknown): AnyRecord => (value && typeof value === "object" ? (value as AnyRecord) : {});

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") return Object.values(value as Record<string, T>);
  return [];
};

const normalizeVenue = (value: unknown): string =>
  readString(value)
    .normalize("NFKC")
    .replace(/ボートレース/g, "")
    .replace(/[\s　]/g, "");

const formatYen = (value: unknown, signed = false): string => {
  const amount = readNumber(value);
  if (!signed) return `${amount.toLocaleString("ja-JP")}円`;
  if (amount === 0) return "0円";
  return `${amount > 0 ? "+" : "-"}${Math.abs(amount).toLocaleString("ja-JP")}円`;
};

const formatPercent = (value: unknown): string => {
  const amount = readNumber(value);
  return `${amount.toFixed(1)}%`;
};

const normalizeCombo = (value: unknown): string =>
  readString(value)
    .normalize("NFKC")
    .replace(/[‐‑‒–—―−－ーｰ~〜～>＞=＝]/g, "-")
    .replace(/\s+/g, "")
    .replace(/^-+|-+$/g, "");

const fetchJson = async (url: string): Promise<unknown | null> => {
  try {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const parseFeed = (payload: unknown): MobileFeed | null => {
  const root = asRecord(payload);
  const venues = asArray<AnyRecord>(root.venues).map((venue) => ({
    venueName: readString(venue.venueName) || readString(venue.venue) || readString(venue.name) || "会場未取得",
    venueCode: readString(venue.venueCode) || readString(venue.code),
    races: asArray<AnyRecord>(venue.races),
  }));

  if (venues.length === 0) return null;

  return {
    date: readString(root.date) || new Date().toISOString().slice(0, 10),
    generatedAt: readString(root.generatedAt),
    venues,
  };
};

const loadTodayFeed = async (): Promise<MobileFeed | null> => {
  const detailPayload = await fetchJson(TODAY_DETAILS_URL);
  const detailFeed = parseFeed(detailPayload);
  if (detailFeed) return detailFeed;

  const fallbackPayload = await fetchJson(TODAY_FALLBACK_URL);
  return parseFeed(fallbackPayload);
};

const loadVenueExtras = async (): Promise<AnyRecord[]> => {
  const payload = await fetchJson(VENUE_EXTRAS_URL);
  return asArray<AnyRecord>(asRecord(payload).venues);
};

const loadPredictionRecords = (): MobilePredictionRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PREDICTION_STORAGE_KEY) || "{}");
    return asArray<MobilePredictionRecord>(parsed).map((record) => ({ ...record, sourceType: "prediction" }));
  } catch {
    return [];
  }
};

const loadJohnsonPredictionRecords = (): MobilePredictionRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(JOHNSON_STORAGE_KEY) || "{}");
    const root = asRecord(parsed);
    const records = asArray<MobilePredictionRecord>(root.records ?? parsed);
    return records.map((record) => ({ ...record, sourceType: "johnson" }));
  } catch {
    return [];
  }
};

const loadPublicJohnsonPredictionRecords = async (): Promise<MobilePredictionRecord[]> => {
  const payload = await fetchJson(PUBLIC_JOHNSON_PREDICTIONS_URL);
  const root = asRecord(payload);
  const records = asArray<MobilePredictionRecord>(root.records);
  return records.map((record) => ({ ...record, sourceType: "public-johnson" }));
};

const loadPracticeRecords = (): MobilePracticeRecord[] => {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PRACTICE_STORAGE_KEY) || "{}");
    return asArray<MobilePracticeRecord>(parsed);
  } catch {
    return [];
  }
};

const buildPredictionSourceKey = (record: { date?: string; venueName?: string; venueCode?: string; raceNo?: number }): string =>
  [
    readString(record.date),
    readString(record.venueCode) || normalizeVenue(record.venueName),
    String(readNumber(record.raceNo)),
  ].join(":");

const buildPracticePredictionFallbacks = (records: MobilePracticeRecord[]): MobilePredictionRecord[] =>
  records.map((record) => {
    const hitBetType = readString(record.hitBetType) || "保存済み実践";
    const hitBetNumbers = normalizeCombo(record.hitBetNumbers);
    const finishOrder = normalizeCombo(record.finishOrder ?? record.actualOrder);
    const lines = [
      hitBetNumbers ? `${hitBetType} ${hitBetNumbers}` : hitBetType,
      finishOrder ? `結果 ${finishOrder}` : "",
      readString(record.practiceMemo ?? record.memo),
    ].filter(Boolean);

    return {
      ...record,
      predictionText: lines.join("\n"),
      sourceType: "practice",
    };
  });

const mergePredictionSources = (
  publicJohnsonRecords: MobilePredictionRecord[],
  johnsonRecords: MobilePredictionRecord[],
  predictionRecords: MobilePredictionRecord[],
  practiceRecords: MobilePracticeRecord[],
): MobilePredictionRecord[] => {
  const merged = new Map<string, MobilePredictionRecord>();

  for (const record of publicJohnsonRecords) {
    merged.set(buildPredictionSourceKey(record), record);
  }

  for (const record of johnsonRecords) {
    merged.set(buildPredictionSourceKey(record), record);
  }

  for (const record of predictionRecords) {
    const key = buildPredictionSourceKey(record);
    if (!merged.has(key)) {
      merged.set(key, record);
    }
  }

  for (const record of buildPracticePredictionFallbacks(practiceRecords)) {
    const key = buildPredictionSourceKey(record);
    if (!merged.has(key)) {
      merged.set(key, record);
    }
  }

  return Array.from(merged.values());
};

const getRaceNo = (race: AnyRecord): number => readNumber(race.raceNo ?? race.raceNumber ?? race.number);

const getRaceTitle = (race: AnyRecord): string => readString(race.title ?? race.raceTitle ?? race.name) || `${getRaceNo(race)}R`;

const getRaceDeadline = (race: AnyRecord): string => readString(race.deadline ?? race.closeTime ?? race["締切"] ?? race.time) || "--:--";

const getRaceStart = (race: AnyRecord): string => readString(race.startTime ?? race.time ?? race.launchTime) || "--:--";

const findExtraVenue = (extraVenues: AnyRecord[], venue: MobileVenue | undefined): AnyRecord | null => {
  if (!venue) return null;
  return (
    extraVenues.find((extra) => readString(extra.venueCode) && readString(extra.venueCode) === venue.venueCode) ??
    extraVenues.find((extra) => normalizeVenue(extra.venueName ?? extra.venue ?? extra.name) === normalizeVenue(venue.venueName)) ??
    null
  );
};

const findExtraRace = (extraVenue: AnyRecord | null, raceNo: number): AnyRecord | null => {
  if (!extraVenue) return null;
  return asArray<AnyRecord>(extraVenue.races).find((race) => getRaceNo(race) === raceNo) ?? null;
};

const readWeather = (race: AnyRecord, extraRace: AnyRecord | null) => {
  const result = asRecord(race.result);
  const weather = asRecord(race.weatherCondition ?? race.weatherActual ?? result.weatherActual ?? extraRace?.weatherCondition);
  const water = asRecord(extraRace?.waterSurfaceInfo ?? race.waterSurfaceInfo);

  return {
    weather: readString(weather.weather ?? weather.condition ?? weather.tenko) || "確認中",
    windDirection: readString(weather.windDirection ?? weather.windDir ?? weather.wind) || "--",
    windSpeed: readString(weather.windSpeed ?? weather.windVelocity) || "--",
    wave: readString(weather.waveHeight ?? weather.wave) || "--",
    temperature: readString(weather.temperature ?? weather.airTemperature) || "--",
    waterTemperature: readString(weather.waterTemperature ?? water.waterTemperature) || "--",
  };
};

const readFinishOrder = (race: AnyRecord): string => {
  const result = asRecord(race.result);
  const candidates = [
    race.finishOrder,
    result.finishOrder,
    race.actualOrder,
    result.actualOrder,
    race.resultOrder,
    result.resultOrder,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const values = candidate.map((value) => readString(value)).filter(Boolean).slice(0, 3);
      if (values.length >= 3) return values.join("-");
    }
    const text = normalizeCombo(candidate);
    if (/^[1-6]-[1-6]-[1-6]$/.test(text)) return text;
  }

  const top3 = asArray<AnyRecord>(race.resultTop3 ?? result.resultTop3 ?? race.top3 ?? result.top3);
  const values = top3
    .map((item) => readString(item.frameNo ?? item.boatNo ?? item.carNo ?? item.no ?? item.number))
    .filter(Boolean)
    .slice(0, 3);

  return values.length >= 3 ? values.join("-") : "";
};

const payoutMatches = (item: AnyRecord, keywords: string[]): boolean => {
  const text = [item.type, item.label, item.name, item.betType, item.kind].map(readString).join(" ");
  return keywords.some((keyword) => text.includes(keyword));
};

const readPayoutAmount = (value: unknown): number => {
  if (typeof value === "number") return value;
  const text = readString(value);
  const match = text.match(/[\d,]+/);
  return match ? readNumber(match[0]) : 0;
};

const readPayout = (race: AnyRecord, type: "trifecta" | "exacta") => {
  const result = asRecord(race.result);
  const direct = type === "trifecta" ? asRecord(result.payout3tan ?? race.payout3tan ?? result.trifecta ?? race.trifecta) : asRecord(result.payout2tan ?? race.payout2tan ?? result.exacta ?? race.exacta);
  const directAmount = readPayoutAmount(direct.payout ?? direct.amount ?? direct.value);
  const directCombo = normalizeCombo(direct.combination ?? direct.numbers ?? direct.result);
  if (directAmount > 0 || directCombo) return { combination: directCombo, payoutYen: directAmount };

  const payoutItems = [
    ...asArray<AnyRecord>(race.payoutsFull),
    ...asArray<AnyRecord>(result.payoutsFull),
    ...asArray<AnyRecord>(race.payouts),
    ...asArray<AnyRecord>(result.payouts),
    ...asArray<AnyRecord>(race.refunds),
    ...asArray<AnyRecord>(result.refunds),
    ...asArray<AnyRecord>(race.oddsPayouts),
    ...asArray<AnyRecord>(result.oddsPayouts),
  ];
  const keywords = type === "trifecta" ? ["3連単", "trifecta"] : ["2連単", "exacta"];
  const matched = payoutItems.find((item) => payoutMatches(item, keywords));

  return {
    combination: normalizeCombo(matched?.combination ?? matched?.numbers ?? matched?.result),
    payoutYen: readPayoutAmount(matched?.payout ?? matched?.amount ?? matched?.value),
  };
};

const isRaceConfirmed = (race: AnyRecord): boolean => {
  const result = asRecord(race.result);
  const status = readString(race.resultStatus ?? result.status ?? race.status).toLowerCase();
  return status === "confirmed" || status === "finished" || Boolean(readFinishOrder(race));
};

const findPrediction = (records: MobilePredictionRecord[], date: string, venue: MobileVenue | undefined, raceNo: number): MobilePredictionRecord | null => {
  if (!venue) return null;
  return (
    records.find((record) =>
      readString(record.date) === date &&
      Number(record.raceNo) === raceNo &&
      (readString(record.venueCode) === venue.venueCode || normalizeVenue(record.venueName) === normalizeVenue(venue.venueName))
    ) ?? null
  );
};

const findPractice = (records: MobilePracticeRecord[], date: string, venue: MobileVenue | undefined, raceNo: number): MobilePracticeRecord | null => {
  if (!venue) return null;
  return (
    records.find((record) =>
      readString(record.date) === date &&
      Number(record.raceNo) === raceNo &&
      (readString(record.venueCode) === venue.venueCode || normalizeVenue(record.venueName) === normalizeVenue(venue.venueName))
    ) ?? null
  );
};

const isHitPractice = (record: MobilePracticeRecord): boolean => {
  return (
    readNumber(record.payoutYen) > 0 ||
    readNumber(record.profitYen) > 0 ||
    Boolean(record.hitBetNumbers) ||
    asArray<unknown>(record.hitBets).length > 0
  );
};

const mergeEntryByFrame = (baseEntries: MobileEntry[], addonEntries: Partial<MobileEntry>[]): MobileEntry[] => {
  const map = new Map<number, MobileEntry>();
  for (const entry of baseEntries) map.set(entry.frame, entry);
  for (const entry of addonEntries) {
    if (!entry.frame) continue;
    const current = map.get(entry.frame) ?? {
      frame: entry.frame,
      name: `艇番${entry.frame}`,
      branch: "--",
      className: "--",
      motorNo: "--",
      motorRate: "--",
      boatNo: "--",
      boatRate: "--",
      exhibitionTime: "--",
      tilt: "--",
      st: "--",
    };
    map.set(entry.frame, { ...current, ...Object.fromEntries(Object.entries(entry).filter(([, value]) => value && value !== "--")) });
  }
  return Array.from(map.values()).sort((a, b) => a.frame - b.frame);
};

const toEntry = (item: AnyRecord, fallbackFrame?: number): MobileEntry => ({
  frame: readNumber(item.frameNo ?? item.boatNo ?? item.lane ?? item.waku ?? item.number ?? fallbackFrame),
  name: readString(item.racerName ?? item.playerName ?? item.name ?? item.riderName) || "選手名未取得",
  branch: readString(item.branch ?? item.prefecture ?? item.area ?? item.home) || "--",
  className: readString(item.class ?? item.grade ?? item.rank) || "--",
  motorNo: readString(item.motorNo ?? item.motorNumber ?? item.motor) || "--",
  motorRate: readString(item.motor2Rate ?? item.motorRate ?? item.motorTwoRate) || "--",
  boatNo: readString(item.boatNo ?? item.boatNumber ?? item.boat) || "--",
  boatRate: readString(item.boat2Rate ?? item.boatRate ?? item.boatTwoRate) || "--",
  exhibitionTime: readString(item.exhibitionTime ?? item.exhibition ?? item.displayTime ?? item.tenjiTime) || "--",
  tilt: readString(item.tilt) || "--",
  st: readString(item.st ?? item.startTiming ?? item.startTime ?? item.exhibitionSt) || "--",
});

const getEntries = (race: AnyRecord, extraRace: AnyRecord | null): MobileEntry[] => {
  const base = [
    ...asArray<AnyRecord>(race.racers),
    ...asArray<AnyRecord>(race.runners),
    ...asArray<AnyRecord>(race.entries),
    ...asArray<AnyRecord>(race.boats),
    ...asArray<AnyRecord>(race.riders),
  ].map((item, index) => toEntry(item, index + 1));

  const addons = [
    ...asArray<AnyRecord>(extraRace?.beforeInfo),
    ...asArray<AnyRecord>(asRecord(extraRace?.officialBeforeInfo).beforeInfo),
    ...asArray<AnyRecord>(asRecord(extraRace?.officialBeforeInfo).exhibitionRows),
    ...asArray<AnyRecord>(extraRace?.originalExhibition),
    ...asArray<AnyRecord>(extraRace?.startExhibition),
    ...asArray<AnyRecord>(extraRace?.motorSummary),
  ].map((item, index) => toEntry(item, index + 1));

  const merged = mergeEntryByFrame(base, addons);
  if (merged.length > 0) return merged.filter((entry) => entry.frame >= 1 && entry.frame <= 6);

  return [1, 2, 3, 4, 5, 6].map((frame) => ({
    frame,
    name: "選手名未取得",
    branch: "--",
    className: "--",
    motorNo: "--",
    motorRate: "--",
    boatNo: "--",
    boatRate: "--",
    exhibitionTime: "--",
    tilt: "--",
    st: "--",
  }));
};

const groupLabelFromTicket = (ticket: ParsedBoatBet): string => {
  const label = ticket.label;
  if (label.includes("厚め")) return "厚め";
  if (label.includes("本線")) return "本線";
  if (label.includes("中穴")) return "中穴";
  if (label.includes("大穴")) return "大穴";
  if (label.includes("穴")) return "穴";
  return ticket.type === "trifecta" ? "3連単" : ticket.label;
};

const groupColor = (group: string) => {
  if (group === "厚め") return { bg: "#081f3d", color: "#ffffff", border: "#081f3d" };
  if (group === "本線") return { bg: "#e0f2fe", color: "#075985", border: "#bae6fd" };
  if (group === "中穴") return { bg: "#ecfdf5", color: "#047857", border: "#bbf7d0" };
  if (group === "大穴" || group === "穴") return { bg: "#fff7ed", color: "#b45309", border: "#fed7aa" };
  return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
};

function StatBox({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "plus" | "minus" | "hit" }) {
  const color = tone === "plus" || tone === "hit" ? "#047857" : tone === "minus" ? "#b45309" : "#0f2743";
  const border = tone === "plus" || tone === "hit" ? "#a7f3d0" : tone === "minus" ? "#fed7aa" : "rgba(125, 211, 252, 0.54)";
  const bg = tone === "plus" || tone === "hit" ? "linear-gradient(135deg, #ecfdf5, #ffffff)" : tone === "minus" ? "linear-gradient(135deg, #fff7ed, #ffffff)" : "linear-gradient(135deg, #ffffff, #f0faff)";
  return (
    <div style={{ borderRadius: "17px", border: `1px solid ${border}`, background: bg, padding: "10px", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ color: "#64748b", fontSize: "9px", fontWeight: 950, letterSpacing: "0.12em", marginBottom: "5px" }}>{label}</div>
      <div style={{ color, fontSize: "15px", fontWeight: 950, lineHeight: 1.12, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

function FrameBadge({ frame }: { frame: number }) {
  const color = frameColorMap[frame] ?? frameColorMap[1];
  return (
    <span style={{ width: "32px", height: "32px", borderRadius: "11px", display: "inline-grid", placeItems: "center", background: color.bg, color: color.color, border: `1px solid ${color.border}`, fontSize: "13px", fontWeight: 950, boxShadow: "0 8px 16px rgba(15,23,42,0.13)", flex: "0 0 auto" }}>
      {frame}
    </span>
  );
}

function MobileBottomNav({ activeTab, onTab }: { activeTab: MobileTab; onTab: (tab: MobileTab) => void }) {
  const tabs: Array<{ key: MobileTab; label: string }> = [
    { key: "entry", label: "出走" },
    { key: "prediction", label: "予想" },
    { key: "result", label: "結果" },
    { key: "info", label: "情報" },
  ];

  return (
    <nav style={{ position: "fixed", left: "50%", bottom: "calc(10px + env(safe-area-inset-bottom))", transform: "translateX(-50%)", width: "min(calc(100% - 20px), 410px)", borderRadius: "999px", border: "1px solid rgba(125, 211, 252, 0.58)", background: "rgba(255,255,255,0.92)", boxShadow: "0 18px 46px rgba(8,47,73,0.20)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", padding: "7px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: "6px", boxSizing: "border-box", zIndex: 50 }}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <button key={tab.key} type="button" onClick={() => onTab(tab.key)} style={{ border: active ? "1px solid rgba(255,255,255,0.56)" : "1px solid rgba(203,213,225,0.64)", background: active ? "linear-gradient(135deg, #082f49, #0e7490)" : "rgba(255,255,255,0.78)", color: active ? "#ffffff" : "#0f2743", minHeight: "42px", borderRadius: "999px", fontSize: "11px", fontWeight: 950, cursor: "pointer", fontFamily: "inherit" }}>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

export function MobilePage() {
  const [feed, setFeed] = useState<MobileFeed | null>(null);
  const [extraVenues, setExtraVenues] = useState<AnyRecord[]>([]);
  const [publicJohnsonRecords, setPublicJohnsonRecords] = useState<MobilePredictionRecord[]>([]);
  const [johnsonRecords, setJohnsonRecords] = useState<MobilePredictionRecord[]>(() => loadJohnsonPredictionRecords());
  const [predictionRecords, setPredictionRecords] = useState<MobilePredictionRecord[]>(() => loadPredictionRecords());
  const [practiceRecords, setPracticeRecords] = useState<MobilePracticeRecord[]>(() => loadPracticeRecords());
  const [selectedVenueIndex, setSelectedVenueIndex] = useState(0);
  const [selectedRaceNo, setSelectedRaceNo] = useState(1);
  const [activeTab, setActiveTab] = useState<MobileTab>("entry");

  useEffect(() => {
    let mounted = true;
    void Promise.all([loadTodayFeed(), loadVenueExtras(), loadPublicJohnsonPredictionRecords()]).then(([nextFeed, nextExtras, nextPublicJohnson]) => {
      if (!mounted) return;
      setFeed(nextFeed);
      setExtraVenues(nextExtras);
      setPublicJohnsonRecords(nextPublicJohnson);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshStorage = () => {
      void loadPublicJohnsonPredictionRecords().then((records) => setPublicJohnsonRecords(records));
      setJohnsonRecords(loadJohnsonPredictionRecords());
      setPredictionRecords(loadPredictionRecords());
      setPracticeRecords(loadPracticeRecords());
    };
    window.addEventListener("storage", refreshStorage);
    window.addEventListener("focus", refreshStorage);
    document.addEventListener("visibilitychange", refreshStorage);
    return () => {
      window.removeEventListener("storage", refreshStorage);
      window.removeEventListener("focus", refreshStorage);
      document.removeEventListener("visibilitychange", refreshStorage);
    };
  }, []);

  const venues = feed?.venues ?? [];
  const selectedVenue = venues[selectedVenueIndex] ?? venues[0];
  const selectedRace = selectedVenue?.races.find((race) => getRaceNo(race) === selectedRaceNo) ?? selectedVenue?.races[0];
  const selectedRaceNumber = selectedRace ? getRaceNo(selectedRace) : selectedRaceNo;
  const prioritizedPredictionRecords = useMemo(
    () => mergePredictionSources(publicJohnsonRecords, johnsonRecords, predictionRecords, practiceRecords),
    [publicJohnsonRecords, johnsonRecords, predictionRecords, practiceRecords],
  );
  const extraVenue = useMemo(() => findExtraVenue(extraVenues, selectedVenue), [extraVenues, selectedVenue]);
  const extraRace = useMemo(() => findExtraRace(extraVenue, selectedRaceNumber), [extraVenue, selectedRaceNumber]);
  const currentDate = feed?.date ?? new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!selectedVenue) return;
    const exists = selectedVenue.races.some((race) => getRaceNo(race) === selectedRaceNo);
    if (!exists) setSelectedRaceNo(getRaceNo(selectedVenue.races[0] ?? { raceNo: 1 }) || 1);
  }, [selectedVenue, selectedRaceNo]);

  const dayPracticeRecords = useMemo(
    () => practiceRecords.filter((record) => readString(record.date) === currentDate),
    [practiceRecords, currentDate],
  );

  const daySummary = useMemo(() => {
    const totalStake = dayPracticeRecords.reduce((sum, record) => sum + readNumber(record.totalStakeYen), 0);
    const totalPayout = dayPracticeRecords.reduce((sum, record) => sum + readNumber(record.payoutYen), 0);
    const hitCount = dayPracticeRecords.filter(isHitPractice).length;
    const resultCount = dayPracticeRecords.length;
    const profit = totalPayout - totalStake;
    const roi = totalStake > 0 ? (totalPayout / totalStake) * 100 : 0;
    return { totalStake, totalPayout, hitCount, resultCount, profit, roi };
  }, [dayPracticeRecords]);

  const venueSummaries = useMemo(() => {
    return venues.map((venue) => {
      const normalized = normalizeVenue(venue.venueName);
      const predictions = prioritizedPredictionRecords.filter((record) => readString(record.date) === currentDate && normalizeVenue(record.venueName) === normalized);
      const results = venue.races.filter(isRaceConfirmed);
      const practice = dayPracticeRecords.filter((record) => normalizeVenue(record.venueName) === normalized || readString(record.venueCode) === venue.venueCode);
      return { predictions: predictions.length, results: results.length, practice: practice.length, hits: practice.filter(isHitPractice).length };
    });
  }, [venues, prioritizedPredictionRecords, currentDate, dayPracticeRecords]);

  const selectedPrediction = findPrediction(prioritizedPredictionRecords, currentDate, selectedVenue, selectedRaceNumber);
  const selectedPractice = findPractice(practiceRecords, currentDate, selectedVenue, selectedRaceNumber);
  const selectedPredictionSourceLabel = selectedPrediction?.sourceType === "johnson"
    ? "johnson保存"
    : selectedPrediction?.sourceType === "public-johnson"
      ? "公開johnson"
    : selectedPrediction?.sourceType === "practice"
      ? "実践結果由来"
      : selectedPrediction?.sourceType === "prediction"
        ? "通常保存"
        : "未保存";
  const predictionText = readString(selectedPrediction?.predictionText);
  const betSummary = useMemo(() => parseBoatBets(predictionText), [predictionText]);
  const finishOrder = readFinishOrder(selectedRace ?? {});
  const trifectaPayout = readPayout(selectedRace ?? {}, "trifecta");
  const exactaPayout = readPayout(selectedRace ?? {}, "exacta");
  const entries = useMemo(() => getEntries(selectedRace ?? {}, extraRace), [selectedRace, extraRace]);
  const weather = readWeather(selectedRace ?? {}, extraRace);
  const hitTicket = betSummary.bets.find((ticket) => {
    const combo = normalizeCombo(ticket.normalized);
    if (ticket.type === "trifecta") return combo === finishOrder;
    if (ticket.type === "exacta") return combo === finishOrder.split("-").slice(0, 2).join("-");
    return false;
  });
  const payoutYen = readNumber(selectedPractice?.payoutYen) || (hitTicket?.type === "exacta" ? exactaPayout.payoutYen : hitTicket ? trifectaPayout.payoutYen : 0);
  const totalStakeYen = readNumber(selectedPractice?.totalStakeYen) || betSummary.totalStakeYen;
  const profitYen = readNumber(selectedPractice?.profitYen) || (payoutYen > 0 || totalStakeYen > 0 ? payoutYen - totalStakeYen : 0);
  const roi = readNumber(selectedPractice?.roi) || (totalStakeYen > 0 ? (payoutYen / totalStakeYen) * 100 : 0);
  const selectedResultStatus = isRaceConfirmed(selectedRace ?? {}) ? "結果確定" : "結果待ち";
  const isSelectedHit = payoutYen > 0 || Boolean(hitTicket) || Boolean(selectedPractice && isHitPractice(selectedPractice));

  const hitLogs = dayPracticeRecords.filter(isHitPractice).slice(0, 12);

  const scrollToCurrentTab = (tab: MobileTab) => {
    setActiveTab(tab);
    window.setTimeout(() => document.getElementById("mobile-race-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
  };

  return (
    <main style={pageStyle}>
      <div style={phoneStyle}>
        <header style={{ position: "sticky", top: 0, zIndex: 30, margin: "0 -2px", borderRadius: "0 0 22px 22px", background: "rgba(240, 251, 255, 0.88)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(125,211,252,0.38)", boxShadow: "0 10px 24px rgba(14,116,144,0.08)", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div>
            <p style={miniLabelStyle}>KURARI BOAT</p>
            <h1 style={{ margin: "3px 0 0", color: "#0f2743", fontSize: "17px", fontWeight: 950, letterSpacing: "-0.02em" }}>Mobile Race Deck</h1>
          </div>
          <span style={{ borderRadius: "999px", padding: "7px 10px", background: "#083344", color: "#ffffff", fontSize: "11px", fontWeight: 950 }}>{currentDate}</span>
        </header>

        <section style={{ ...cardStyle, background: "linear-gradient(135deg, #052e46 0%, #075985 46%, #10b981 100%)", border: "1px solid rgba(255,255,255,0.32)", padding: "18px", color: "#ffffff" }}>
          <p style={{ ...miniLabelStyle, color: "#a7f3d0" }}>TODAY BALANCE</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "12px", marginTop: "8px" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 800, opacity: 0.9 }}>今日の収支</div>
              <div style={{ marginTop: "5px", fontSize: "34px", lineHeight: 1, fontWeight: 950, letterSpacing: "-0.05em" }}>{formatYen(daySummary.profit, true)}</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "11px", fontWeight: 900, lineHeight: 1.7, opacity: 0.92 }}>
              <div>的中 {daySummary.hitCount}/{daySummary.resultCount}</div>
              <div>ROI {formatPercent(daySummary.roi)}</div>
            </div>
          </div>
          <div style={{ marginTop: "14px", display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: "8px" }}>
            <StatBox label="投資" value={formatYen(daySummary.totalStake)} />
            <StatBox label="払戻" value={formatYen(daySummary.totalPayout)} tone="hit" />
            <StatBox label="開催" value={`${venues.length}場`} />
          </div>
        </section>

        <section style={{ ...cardStyle, padding: "14px" }}>
          <p style={miniLabelStyle}>HIT LOG</p>
          <h2 style={{ ...titleStyle, fontSize: "18px", marginTop: "4px" }}>的中ログ</h2>
          <div style={{ marginTop: "12px", borderRadius: "18px", background: "linear-gradient(90deg, #083344, #0f766e)", color: "#ffffff", overflow: "hidden", padding: "12px 0" }}>
            <div style={{ whiteSpace: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch", padding: "0 12px", fontSize: "12px", fontWeight: 900 }}>
              {hitLogs.length > 0
                ? hitLogs.map((hit) => `🎯 ${hit.venueName ?? "会場"} ${hit.raceNo}R ${hit.hitBetType ?? "的中"} ${hit.hitBetNumbers ?? hit.finishOrder ?? hit.actualOrder ?? ""} ${formatYen(hit.profitYen, true)}`).join("　　")
                : "的中ログはまだありません。結果照合後にここへ流れます。"}
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: "14px" }}>
          <p style={miniLabelStyle}>TODAY VENUES</p>
          <h2 style={{ ...titleStyle, fontSize: "18px", marginTop: "4px" }}>本日開催</h2>
          <div style={{ marginTop: "12px", display: "flex", gap: "9px", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "2px" }}>
            {venues.length > 0 ? venues.map((venue, index) => {
              const summary = venueSummaries[index];
              const active = index === selectedVenueIndex;
              return (
                <button key={`${venue.venueName}-${venue.venueCode || index}`} type="button" onClick={() => { setSelectedVenueIndex(index); setSelectedRaceNo(getRaceNo(venue.races[0] ?? { raceNo: 1 }) || 1); }} style={{ flex: "0 0 104px", minHeight: "68px", borderRadius: "20px", border: active ? "1px solid rgba(255,255,255,0.64)" : "1px solid rgba(125,211,252,0.58)", background: active ? "linear-gradient(135deg, #082f49, #0e7490)" : "linear-gradient(180deg, #ffffff, #f0faff)", color: active ? "#ffffff" : "#0f2743", boxShadow: active ? "0 14px 30px rgba(8,47,73,0.24)" : "0 8px 18px rgba(14,116,144,0.08)", padding: "10px", display: "grid", gap: "5px", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                  <strong style={{ fontSize: "14px", fontWeight: 950 }}>{venue.venueName}</strong>
                  <span style={{ fontSize: "10px", fontWeight: 850, opacity: 0.86 }}>{venue.races.length}R / 予想{summary?.predictions ?? 0} / 結果{summary?.results ?? 0}</span>
                </button>
              );
            }) : <p style={mutedStyle}>今日の開催データを取得中です。</p>}
          </div>
        </section>

        <section style={{ ...cardStyle, padding: "14px" }}>
          <p style={miniLabelStyle}>RACE SELECTOR</p>
          <h2 style={{ ...titleStyle, fontSize: "18px", marginTop: "4px" }}>{selectedVenue?.venueName ?? "会場選択中"}</h2>
          <div style={{ marginTop: "12px", display: "flex", gap: "8px", overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: "2px" }}>
            {(selectedVenue?.races ?? []).map((race) => {
              const raceNo = getRaceNo(race);
              const active = raceNo === selectedRaceNumber;
              const hasPrediction = Boolean(findPrediction(prioritizedPredictionRecords, currentDate, selectedVenue, raceNo));
              const hasPractice = Boolean(findPractice(practiceRecords, currentDate, selectedVenue, raceNo));
              return (
                <button key={`${selectedVenue?.venueName}-${raceNo}`} type="button" onClick={() => setSelectedRaceNo(raceNo)} style={{ flex: "0 0 52px", width: "52px", height: "52px", borderRadius: "17px", border: active ? "1px solid rgba(255,255,255,0.62)" : "1px solid rgba(125,211,252,0.58)", background: active ? "linear-gradient(135deg, #082f49, #0e7490)" : "#ffffff", color: active ? "#ffffff" : "#0f2743", fontSize: "12px", fontWeight: 950, boxShadow: active ? "0 14px 26px rgba(8,47,73,0.24)" : "0 7px 15px rgba(14,116,144,0.08)", cursor: "pointer", fontFamily: "inherit", position: "relative" }}>
                  {raceNo}R
                  {(hasPrediction || hasPractice || isRaceConfirmed(race)) && <span style={{ position: "absolute", left: "50%", bottom: "7px", transform: "translateX(-50%)", width: "18px", height: "4px", borderRadius: "999px", background: hasPractice ? "#22c55e" : hasPrediction ? "#38bdf8" : "#a78bfa" }} />}
                </button>
              );
            })}
          </div>
        </section>

        <section id="mobile-race-panel" style={cardStyle}>
          <div style={{ padding: "15px", display: "grid", gap: "10px", background: "linear-gradient(180deg, #ffffff, #f5fcff)" }}>
            <p style={miniLabelStyle}>RACE DETAIL</p>
            <div style={{ display: "flex", alignItems: "start", justifyContent: "space-between", gap: "10px" }}>
              <div>
                <h2 style={titleStyle}>{selectedVenue?.venueName ?? "--"} {selectedRaceNumber}R</h2>
                <p style={{ ...mutedStyle, marginTop: "5px" }}>{getRaceTitle(selectedRace ?? {})}</p>
              </div>
              <span style={{ borderRadius: "999px", padding: "6px 9px", background: isSelectedHit ? "#dcfce7" : isRaceConfirmed(selectedRace ?? {}) ? "#e0f2fe" : "#f8fafc", color: isSelectedHit ? "#047857" : "#075985", border: "1px solid rgba(14,165,233,0.25)", fontSize: "11px", fontWeight: 950, whiteSpace: "nowrap" }}>{isSelectedHit ? "的中" : selectedResultStatus}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "8px" }}>
              <StatBox label="締切" value={getRaceDeadline(selectedRace ?? {})} />
              <StatBox label="発走" value={getRaceStart(selectedRace ?? {})} />
              <StatBox label="天候" value={weather.weather} />
              <StatBox label="風/波" value={`${weather.windDirection} ${weather.windSpeed} / ${weather.wave}`} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", background: "linear-gradient(135deg, #082f49, #083344)" }}>
            {([
              ["entry", "出走"],
              ["prediction", "予想"],
              ["result", "結果"],
              ["info", "情報"],
            ] as Array<[MobileTab, string]>).map(([tab, label]) => {
              const active = activeTab === tab;
              return <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ minHeight: "48px", border: "none", borderBottom: active ? "3px solid #67e8f9" : "3px solid transparent", background: active ? "rgba(255,255,255,0.10)" : "transparent", color: "#ffffff", fontSize: "11px", fontWeight: 950, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>;
            })}
          </div>

          <div style={{ padding: "14px", display: "grid", gap: "10px" }}>
            {activeTab === "entry" && (
              <div style={{ display: "grid", gap: "8px" }}>
                {entries.map((entry) => (
                  <article key={`entry-${entry.frame}`} style={{ borderRadius: "18px", border: "1px solid rgba(125,211,252,0.48)", background: "linear-gradient(135deg, #ffffff, #f8fdff)", padding: "10px", display: "grid", gridTemplateColumns: "32px minmax(0,1fr) auto", gap: "10px", alignItems: "center" }}>
                    <FrameBadge frame={entry.frame} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ color: "#0f2743", fontSize: "13px", fontWeight: 950, overflowWrap: "anywhere" }}>{entry.name}</div>
                      <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 800, marginTop: "2px" }}>{entry.branch} / {entry.className}</div>
                    </div>
                    <div style={{ textAlign: "right", color: "#334155", fontSize: "10px", fontWeight: 850, lineHeight: 1.45 }}>
                      <div>M {entry.motorNo} / {entry.motorRate}</div>
                      <div>展示 {entry.exhibitionTime}</div>
                      <div>ST {entry.st}</div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {activeTab === "prediction" && (
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ borderRadius: "20px", background: "linear-gradient(135deg, #0f2743, #082f49)", color: "#ffffff", padding: "13px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                  <div>
                    <div style={{ fontSize: "10px", fontWeight: 950, letterSpacing: "0.16em", color: "#67e8f9" }}>BET SLIP</div>
                    <div style={{ marginTop: "4px", fontSize: "17px", fontWeight: 950 }}>{betSummary.totalBets}点 / {formatYen(betSummary.totalStakeYen)}</div>
                  </div>
                  <span style={{ borderRadius: "999px", padding: "7px 10px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", fontSize: "11px", fontWeight: 950 }}>{predictionText ? selectedPredictionSourceLabel : "未保存"}</span>
                </div>
                {predictionText ? (
                  <>
                    <div style={{ display: "grid", gap: "7px" }}>
                      {betSummary.bets.map((ticket, index) => {
                        const group = groupLabelFromTicket(ticket);
                        const color = groupColor(group);
                        const isHit = hitTicket?.normalized === ticket.normalized && hitTicket?.type === ticket.type;
                        return (
                          <div key={`${ticket.type}-${ticket.normalized}-${index}`} style={{ borderRadius: "17px", border: isHit ? "1px solid #22c55e" : "1px solid #dbeafe", background: isHit ? "linear-gradient(135deg, #dcfce7, #ffffff)" : "#ffffff", padding: "10px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", gap: "9px", boxShadow: isHit ? "0 12px 22px rgba(34,197,94,0.16)" : "0 6px 14px rgba(14,116,144,0.06)" }}>
                            <span style={{ width: "28px", height: "28px", borderRadius: "10px", display: "grid", placeItems: "center", background: color.bg, color: color.color, border: `1px solid ${color.border}`, fontSize: "10px", fontWeight: 950 }}>{String(index + 1).padStart(2, "0")}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ color: "#0f2743", fontSize: "15px", fontWeight: 950 }}>{ticket.label.includes("2連単") ? "2連単" : "3連単"} {ticket.normalized}</div>
                              <div style={{ color: "#64748b", fontSize: "10px", fontWeight: 850, marginTop: "2px" }}>{group}</div>
                            </div>
                            <span style={{ borderRadius: "999px", padding: "5px 8px", background: isHit ? "#22c55e" : "#f8fafc", color: isHit ? "#ffffff" : "#64748b", fontSize: "10px", fontWeight: 950 }}>{isHit ? "HIT" : "100円"}</span>
                          </div>
                        );
                      })}
                    </div>
                    <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "180px", overflow: "auto", borderRadius: "18px", border: "1px solid #dbeafe", background: "#f8fdff", color: "#334155", fontSize: "11px", lineHeight: 1.65, padding: "12px", fontFamily: "inherit", fontWeight: 750 }}>{predictionText}</pre>
                  </>
                ) : <div style={{ borderRadius: "18px", border: "1px dashed #bae6fd", background: "#f0faff", padding: "14px", color: "#075985", fontSize: "12px", fontWeight: 850 }}>このレースの保存済み予想はまだありません。PredictionPage で johnson 保存または通常保存するとここに表示されます。</div>}
              </div>
            )}

            {activeTab === "result" && (
              <div style={{ display: "grid", gap: "10px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "8px" }}>
                  <StatBox label="着順" value={readString(selectedPractice?.finishOrder ?? selectedPractice?.actualOrder) || finishOrder || "--"} tone={isSelectedHit ? "hit" : "default"} />
                  <StatBox label="決まり手" value={readString(asRecord(selectedRace?.result).kimarite ?? selectedPractice?.kimarite) || "--"} />
                  <StatBox label="3連単" value={trifectaPayout.payoutYen ? `${trifectaPayout.combination || finishOrder} / ${formatYen(trifectaPayout.payoutYen)}` : "未取得"} />
                  <StatBox label="2連単" value={exactaPayout.payoutYen ? `${exactaPayout.combination || finishOrder.split("-").slice(0,2).join("-")} / ${formatYen(exactaPayout.payoutYen)}` : "未取得"} />
                  <StatBox label="投資" value={formatYen(totalStakeYen)} />
                  <StatBox label="払戻" value={formatYen(payoutYen)} tone={payoutYen > 0 ? "hit" : "default"} />
                  <StatBox label="収支" value={formatYen(profitYen, true)} tone={profitYen > 0 ? "plus" : profitYen < 0 ? "minus" : "default"} />
                  <StatBox label="回収率" value={formatPercent(roi)} />
                </div>
                <div style={{ borderRadius: "18px", padding: "13px", background: isSelectedHit ? "linear-gradient(135deg, #dcfce7, #ffffff)" : "linear-gradient(135deg, #f8fafc, #ffffff)", border: isSelectedHit ? "1px solid #86efac" : "1px solid #e2e8f0", color: isSelectedHit ? "#047857" : "#475569", fontSize: "13px", fontWeight: 950 }}>
                  {isSelectedHit ? `🎯 的中 ${hitTicket?.label ?? selectedPractice?.hitBetType ?? ""} ${hitTicket?.normalized ?? selectedPractice?.hitBetNumbers ?? ""}` : isRaceConfirmed(selectedRace ?? {}) ? "結果確定：保存買い目との一致は未確認です。" : "結果待ちです。"}
                </div>
              </div>
            )}

            {activeTab === "info" && (
              <div style={{ display: "grid", gap: "8px" }}>
                <StatBox label="会場" value={selectedVenue?.venueName ?? "--"} />
                <StatBox label="レース" value={`${selectedRaceNumber}R`} />
                <StatBox label="気温/水温" value={`${weather.temperature} / ${weather.waterTemperature}`} />
                <StatBox label="データ" value={feed?.generatedAt ? `更新 ${feed.generatedAt}` : "更新時刻未取得"} />
              </div>
            )}
          </div>
        </section>
      </div>
      <MobileBottomNav activeTab={activeTab} onTab={scrollToCurrentTab} />
    </main>
  );
}
