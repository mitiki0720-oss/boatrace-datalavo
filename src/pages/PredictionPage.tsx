import { useEffect, useMemo, useState } from "react";
import type { BoatPredictionRecord, BoatPredictionTicket } from "../lib/boatraceTypes";
import { BoatGptMaterialPanel } from "../components/boatrace/BoatGptMaterialPanel";
import { BoatPracticeResultPanel } from "../components/boatrace/BoatPracticeResultPanel";
import { BoatPredictionPastePanel } from "../components/boatrace/BoatPredictionPastePanel";
import { BoatPredictionVenueRaceChooser } from "../components/boatrace/BoatPredictionVenueRaceChooser";
import { PageShell } from "../components/layout/PageShell";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { parseBoatBets } from "../lib/boatBetParser";
import { buildBoatPredictionMaterial } from "../lib/boatPredictionMaterial";
import {
	findBoatRaceResultForPractice,
	settleBoatPredictionResult,
	type BoatPracticeResultStatus,
	type BoatRaceResultLookupDebug,
	type BoatResultLookupStatus,
} from "../lib/boatResultSettlement";
import {
	findSelectedRaceExtra,
	findSelectedVenueExtra,
	loadBoatVenueExtrasFeed,
	type BoatVenueExtrasFeed,
} from "../lib/boatVenueExtrasFeed";
import {
	loadBoatVenueFeatureIndex,
	loadBoatVenueFeatureNote,
	loadBoatVenueUserInsights,
	type BoatVenueFeatureIndex,
	type BoatVenueFeatureNote,
	type BoatVenueUserInsight,
} from "../lib/boatVenueFeatures";
import type { BoatPracticeResultRecord } from "../lib/boatPracticeResultStorage";
import { withBasePath } from "../lib/assetPath";
import {
	calculateBoatPracticeProfitLoss,
	deleteBoatPracticeResultRecord,
	findBoatPracticeResultRecord,
	isBoatPracticeHit,
	loadBoatPracticeResultRecords,
	upsertBoatPracticeResultRecord,
} from "../lib/boatPracticeResultStorage";
import {
	buildBoatPredictionRaceKey,
	deleteBoatPredictionRecord,
	findBoatPredictionRecord,
	upsertBoatPredictionRecord,
} from "../lib/boatPredictionStorage";

const panelGridClassName = "prediction-page-main-panels";

const savedMessageStyle = {
	margin: "-4px 0 0",
	fontSize: "0.9rem",
	fontWeight: 700,
	color: "#2c5b7a",
};

const practiceMessageStyle = {
	margin: "6px 0 -4px",
	fontSize: "0.9rem",
	fontWeight: 700,
	color: "#7a4a5f",
};

const getRaceKey = (venueId: string, raceId: string | undefined, raceNo: number) => raceId ?? `${venueId}-${raceNo}`;

const PREDICTION_SELECTION_STORAGE_KEY = "kurari-boat-data-labo-prediction-selected-race";

type BoatPredictionTodayFeed = typeof sampleBoatTodayFeed;
type BoatPredictionVenue = BoatPredictionTodayFeed["venues"][number];
type BoatPredictionRace = BoatPredictionVenue["races"][number];
type PredictionRaceExhibitionStatus = {
	level: "ready" | "partial" | "waiting";
	title: string;
	shortLabel: string;
	detail: string;
};

const toArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const getVenueRaces = (venue: BoatPredictionVenue | undefined): BoatPredictionRace[] =>
	toArray<BoatPredictionRace>((venue as { races?: unknown } | undefined)?.races);

const toPredictionTickets = (bets: ReturnType<typeof parseBoatBets>["bets"]): BoatPredictionTicket[] =>
	bets.map((bet, index) => ({
		index: String(index + 1).padStart(2, "0"),
		betType: bet.type === "trifecta" ? "3連単" : bet.type === "exacta" ? "2連単" : bet.label,
		combination: bet.normalized,
		note: bet.sourceLine,
	}));

const readPracticeNumber = (value: unknown): number => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value.replace(/[^\d.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
};

const formatPracticeYen = (value: unknown): string => `${readPracticeNumber(value).toLocaleString("ja-JP")}円`;

const formatPracticeProfit = (value: unknown): string => {
	const amount = readPracticeNumber(value);
	const prefix = amount > 0 ? "+" : "";
	return `${prefix}${amount.toLocaleString("ja-JP")}円`;
};

const formatPracticeRoi = (value: unknown): string => `${readPracticeNumber(value).toFixed(1)}%`;

const resolvePracticeStakeYen = (record: BoatPracticeResultRecord): number =>
	readPracticeNumber(record.totalStakeYen ?? record.betSummary?.totalStakeYen ?? record.investmentAmount);

const resolvePracticePayoutYen = (record: BoatPracticeResultRecord): number =>
	readPracticeNumber(record.payoutYen ?? record.payoutAmount);

const resolvePracticeProfitYen = (record: BoatPracticeResultRecord): number => {
	const storedProfit = record.profitYen ?? record.profitLoss;
	if (storedProfit !== undefined) {
		return readPracticeNumber(storedProfit);
	}

	return resolvePracticePayoutYen(record) - resolvePracticeStakeYen(record);
};

const isPracticeSummaryRecord = (record: BoatPracticeResultRecord, date: string | undefined): boolean => {
	if (!date || record.date !== date) {
		return false;
	}

	if (record.resultStatus === "pending" || record.resultStatus === "missing") {
		return false;
	}

	return record.resultStatus === "confirmed" || resolvePracticePayoutYen(record) > 0 || Boolean(record.actualFinishOrderText);
};

const buildPracticeLookupDebugText = (debug: BoatRaceResultLookupDebug | undefined): string => {
	if (!debug) {
		return "";
	}

	return [
		`targetDate=${debug.targetDate ?? "-"}`,
		`feedDate=${debug.feedDate ?? "-"}`,
		`venue=${debug.targetVenueName ?? "-"}(${debug.targetVenueCode ?? "-"})`,
		`matched=${debug.matchedVenueName ?? "-"}(${debug.matchedVenueCode ?? "-"})`,
		`race=${debug.raceNo ?? "-"}`,
		`raceFound=${debug.raceFound ? "yes" : "no"}`,
		`result=${debug.resultFound ? "yes" : "no"}`,
		`payout=${debug.payoutFound ? "yes" : "no"}`,
		`order=${debug.finishOrderText ?? "-"}`,
		`3tan=${debug.trifectaPayout ?? "-"}`,
		`2tan=${debug.exactaPayout ?? "-"}`,
	].join(" / ");
};

const readPracticeHitBetLabel = (record: BoatPracticeResultRecord): string => {
	const hitBet = Array.isArray(record.hitBets) ? record.hitBets[0] : undefined;
	if (hitBet) {
		return `${hitBet.label} ${hitBet.normalized}`;
	}

	if (record.hitBetType && Array.isArray(record.hitBetNumbers) && record.hitBetNumbers.length > 0) {
		return `${record.hitBetType} ${record.hitBetNumbers.join("-")}`;
	}

	if (Array.isArray(record.hitBetNumbers) && record.hitBetNumbers.length > 0) {
		return record.hitBetNumbers.join("-");
	}

	return record.actualFinishOrderText || "-";
};

const findHitBetsByFinishOrder = (
	bets: ReturnType<typeof parseBoatBets>["bets"],
	finishOrderText: string,
): ReturnType<typeof parseBoatBets>["bets"] => {
	const order = finishOrderText
		.normalize("NFKC")
		.replace(/[＝=]/g, "-")
		.split("-")
		.map((value) => Number(value))
		.filter((value) => Number.isFinite(value));

	if (order.length < 2) {
		return [];
	}

	const top3 = order.slice(0, 3).join("-");
	const top2 = order.slice(0, 2).join("-");
	const unorderedTop3 = order.slice(0, 3).sort().join("-");
	const unorderedTop2 = order.slice(0, 2).sort().join("-");

	return bets.filter((bet) => {
		if (bet.type === "trifecta") {
			return bet.normalized === top3;
		}

		if (bet.type === "exacta") {
			return bet.normalized === top2;
		}

		if (bet.type === "trio") {
			return [...bet.numbers].sort().join("-") === unorderedTop3;
		}

		if (bet.type === "quinella") {
			return [...bet.numbers].sort().join("-") === unorderedTop2;
		}

		if (bet.type === "wide") {
			return bet.numbers.every((number) => order.slice(0, 3).includes(number));
		}

		return false;
	});
};

type PredictionHeroTimeBand = "morning" | "day" | "night";

const predictionHeroImageSrcMap: Record<PredictionHeroTimeBand, string> = {
	morning: withBasePath("prediction-page/hero/prediction-hero-morning-kurari-funako-naughty.png"),
	day: withBasePath("prediction-page/hero/prediction-hero-day-kurari-funako-naughty.png"),
	night: withBasePath("prediction-page/hero/prediction-hero-night-kurari-funako-naughty.png"),
};

const predictionPageBackgroundImageSrc = withBasePath(
	"prediction-page/backgrounds/prediction-bg-water-sparkle.png",
);

const getPredictionHeroTimeBand = (venue: BoatPredictionVenue | undefined): PredictionHeroTimeBand => {
	const session = String((venue as { session?: unknown } | undefined)?.session ?? "").trim().toLowerCase();
	const title = String((venue as { title?: unknown } | undefined)?.title ?? "").replace(/\s+/g, "").toLowerCase();

	if (session === "morning" || title.includes("モーニング")) {
		return "morning";
	}

	if (session === "night" || session === "midnight" || title.includes("ナイター") || title.includes("ミッドナイト")) {
		return "night";
	}

	return "day";
};

const formatJstDateTimeLabel = (value: string | undefined): string => {
	if (!value) {
		return "未取得";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
};

const hasRaceOddsPreview = (race: BoatPredictionRace): boolean => {
	const oddsPreview = (race as { oddsPreview?: unknown }).oddsPreview;

	if (Array.isArray(oddsPreview)) {
		return oddsPreview.length > 0;
	}

	if (oddsPreview && typeof oddsPreview === "object") {
		return Object.values(oddsPreview as Record<string, unknown>).some((value) => {
			if (Array.isArray(value)) {
				return value.length > 0;
			}

			return Boolean(value);
		});
	}

	return false;
};

const hasVenueWeather = (venue: BoatPredictionVenue): boolean => {
	const weatherActual = (venue as { weatherActual?: unknown }).weatherActual;
	const weather = (venue as { weather?: unknown }).weather;

	return Boolean(weatherActual || weather);
};

	const readLooseString = (value: unknown): string => {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
};

const readRaceTimeText = (race: unknown): { label: string; value: string } => {
	const record = toLooseRecord(race);

	const deadline =
		readLooseString(record.deadlineTime) ||
		readLooseString(record.deadline) ||
		readLooseString(record.closeTime) ||
		readLooseString(record["締切"]);

	if (deadline) {
		return { label: "締切", value: deadline };
	}

	const start =
		readLooseString(record.startTime) ||
		readLooseString(record.time) ||
		readLooseString(record["発走"]);

	if (start) {
		return { label: "発走", value: start };
	}

	return { label: "時刻", value: "未取得" };
};

const readRaceDeadlineOrStartTime = (race: unknown): string => {
	const record = toLooseRecord(race);

	return (
		readLooseString(record.deadlineTime) ||
		readLooseString(record.deadline) ||
		readLooseString(record.closeTime) ||
		readLooseString(record["締切"]) ||
		readLooseString(record.startTime) ||
		readLooseString(record.time) ||
		readLooseString(record["発走"])
	);
};

const toLooseRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const hasExhibitionTimeValue = (row: unknown): boolean => {
	const record = toLooseRecord(row);
	return Boolean(
		readLooseString(record.exhibitionTime) ||
		readLooseString(record.exhibition) ||
		readLooseString(record.displayTime) ||
		readLooseString(record.tenjiTime) ||
		readLooseString(record.showTime) ||
		readLooseString(record["展示"]) ||
		readLooseString(record["展示タイム"])
	);
};

const getRaceExhibitionRows = (
	race: unknown,
	raceExtra: unknown,
): unknown[] => {
	const raceRecord = toLooseRecord(race);
	const extraRecord = toLooseRecord(raceExtra);
	const officialBeforeInfo = toLooseRecord(extraRecord.officialBeforeInfo);

	const candidates = [
		raceRecord.exhibitions,
		officialBeforeInfo.exhibitionRows,
		officialBeforeInfo.beforeInfo,
		extraRecord.beforeInfo,
		extraRecord.officialBeforeInfo,
		extraRecord.originalExhibition,
		extraRecord.startExhibition,
	];

	for (const candidate of candidates) {
		const rows = toArray<unknown>(candidate);
		if (rows.length > 0) return rows;
	}

	return [];
};

const buildExhibitionStatusLabel = (params: {
	race: unknown;
	raceExtra: unknown;
	feedUpdatedAt?: string;
	extraUpdatedAt?: string;
}) => {
	const rows = getRaceExhibitionRows(params.race, params.raceExtra);
	const exhibitionTimeCount = rows.filter(hasExhibitionTimeValue).length;
	const updatedAt = params.extraUpdatedAt || params.feedUpdatedAt || "";

	if (exhibitionTimeCount >= 6) {
		return {
			level: "ready" as const,
			title: "展示タイム 6艇取得済み",
			detail: updatedAt ? `更新 ${formatJstDateTimeLabel(updatedAt)}` : "更新時刻未取得",
		};
	}

	if (exhibitionTimeCount > 0) {
		return {
			level: "partial" as const,
			title: `展示タイム ${exhibitionTimeCount}/6艇`,
			detail: updatedAt ? `更新 ${formatJstDateTimeLabel(updatedAt)}` : "一部取得済み",
		};
	}

	return {
		level: "waiting" as const,
		title: "展示タイム未取得",
		detail: "展示が入るまで予想注意",
	};
};

export function PredictionPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [dataUpdatedAt, setDataUpdatedAt] = useState("");
	const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [selectedVenueId, setSelectedVenueId] = useState<string>("");
	const [selectedRaceId, setSelectedRaceId] = useState<string>("");
	const [venueFeatureIndex, setVenueFeatureIndex] = useState<BoatVenueFeatureIndex | null>(null);
	const [selectedVenueFeatureNote, setSelectedVenueFeatureNote] = useState<BoatVenueFeatureNote | null>(null);
	const [venueFeatureInsights, setVenueFeatureInsights] = useState<BoatVenueUserInsight[]>([]);
	const [predictionText, setPredictionText] = useState<string>("");
	const [savedPredictionRecord, setSavedPredictionRecord] = useState<BoatPredictionRecord | undefined>(undefined);
	const [savedMessage, setSavedMessage] = useState<string>("");
	const [savedPracticeResultRecord, setSavedPracticeResultRecord] = useState<BoatPracticeResultRecord | undefined>(undefined);
	const [practiceResultRecords, setPracticeResultRecords] = useState<BoatPracticeResultRecord[]>([]);
	const [practiceMessage, setPracticeMessage] = useState<string>("");
	const [actualFinishOrderText, setActualFinishOrderText] = useState<string>("");
	const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
	const [payoutAmount, setPayoutAmount] = useState<number>(0);
	const [practiceMemo, setPracticeMemo] = useState<string>("");
	const [isInvestmentAmountManual, setIsInvestmentAmountManual] = useState(false);
	const [practiceResultStatus, setPracticeResultStatus] = useState<BoatPracticeResultStatus | undefined>(undefined);
	const [practiceResultLookupStatus, setPracticeResultLookupStatus] = useState<BoatResultLookupStatus | undefined>(undefined);
	const [practiceResultLookupDebugText, setPracticeResultLookupDebugText] = useState("");
	const [practiceKimarite, setPracticeKimarite] = useState("");
	const [practiceStartInfoText, setPracticeStartInfoText] = useState("");
	const [practiceHitBetLabel, setPracticeHitBetLabel] = useState("");
	const [practiceSettlementMessage, setPracticeSettlementMessage] = useState("");
	const [isBetAutoApplied, setIsBetAutoApplied] = useState(false);
	const [isResultAutoApplied, setIsResultAutoApplied] = useState(false);

	const venues = useMemo<BoatPredictionVenue[]>(
		() =>
			toArray<BoatPredictionVenue>((todayFeed as { venues?: unknown }).venues).map((venue) => ({
				...venue,
				races: getVenueRaces(venue),
			})),
		[todayFeed],
	);

	const races = useMemo<BoatPredictionRace[]>(() => venues.flatMap((venue) => getVenueRaces(venue)), [venues]);
	const initialVenue = venues[0];
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? initialVenue;
	const selectedVenueRaces = useMemo(() => getVenueRaces(selectedVenue), [selectedVenue]);
	const selectedRace =
		selectedVenueRaces.find((race) => getRaceKey(selectedVenue?.id ?? "", race.raceId, race.raceNo) === selectedRaceId) ??
		selectedVenueRaces[0];
const selectedVenueExtra = useMemo(	
	() => findSelectedVenueExtra(venueExtrasFeed, selectedVenue),
	[venueExtrasFeed, selectedVenue],
);

const selectedRaceExtra = useMemo(
	() => findSelectedRaceExtra(selectedVenueExtra, selectedRace),
	[selectedVenueExtra, selectedRace],
);

const raceExhibitionStatusMap = useMemo<Record<string, PredictionRaceExhibitionStatus>>(() => {
	const extraRaces = toArray<Record<string, unknown>>(
		(selectedVenueExtra as { races?: unknown } | null | undefined)?.races,
	);

	return selectedVenueRaces.reduce<Record<string, PredictionRaceExhibitionStatus>>((acc, race) => {
		const raceKey = getRaceKey(selectedVenue?.id ?? "", race.raceId, race.raceNo);
		const raceExtra = extraRaces.find((item) => Number(item.raceNo) === Number(race.raceNo));

		const status = buildExhibitionStatusLabel({
			race,
			raceExtra,
			feedUpdatedAt: todayFeed.generatedAt,
			extraUpdatedAt: venueExtrasFeed?.generatedAt,
		});

		acc[raceKey] = {
			...status,
			shortLabel:
				status.level === "ready"
					? "展示タイムOK"
					: status.level === "partial"
						? status.title.replace("展示タイム ", "展示")
						: "展示未取得",
		};

		return acc;
	}, {});
}, [selectedVenue, selectedVenueRaces, selectedVenueExtra, todayFeed.generatedAt, venueExtrasFeed?.generatedAt]);

	type PredictionSelectionSnapshot = {
	date?: string;
	venueId?: string;
	venueCode?: string;
	venueName?: string;
	raceId?: string;
	raceNo?: number;
	savedAt?: string;
};

const loadPredictionSelectionSnapshot = (): PredictionSelectionSnapshot | null => {
	if (typeof window === "undefined") return null;

	try {
		const raw = window.sessionStorage.getItem(PREDICTION_SELECTION_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PredictionSelectionSnapshot;
		return parsed && typeof parsed === "object" ? parsed : null;
	} catch {
		return null;
	}
};

const savePredictionSelectionSnapshot = (params: {
	date?: string;
	venue?: BoatPredictionVenue;
	race?: BoatPredictionRace;
}) => {
	if (typeof window === "undefined") return;
	if (!params.venue || !params.race) return;

	const snapshot: PredictionSelectionSnapshot = {
		date: params.date,
		venueId: params.venue.id,
		venueCode: params.venue.venueCode,
		venueName: params.venue.venueName,
		raceId: getRaceKey(params.venue.id, params.race.raceId, params.race.raceNo),
		raceNo: params.race.raceNo,
		savedAt: new Date().toISOString(),
	};

	try {
		window.sessionStorage.setItem(PREDICTION_SELECTION_STORAGE_KEY, JSON.stringify(snapshot));
	} catch {
		// sessionStorage失敗は無視
	}
};

const parseRaceTimeMinutes = (value: unknown): number | null => {
	const text = readLooseString(value);
	const match = text.match(/(\d{1,2}):(\d{2})/);
	if (!match) return null;

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;

	return hour * 60 + minute;
};

const getJstNowMinutes = (): number => {
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(new Date());

	const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
	const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);

	return hour * 60 + minute;
};

const findCurrentTimeRaceSelection = (venues: BoatPredictionVenue[]) => {
	const nowMinutes = getJstNowMinutes();

	for (const venue of venues) {
		const races = getVenueRaces(venue);
		const upcomingRace =
			races.find((race) => {
				const deadline = parseRaceTimeMinutes(readRaceDeadlineOrStartTime(race));
				return deadline !== null && deadline >= nowMinutes - 8;
			}) ?? races[0];

		if (upcomingRace) {
			return {
				venue,
				race: upcomingRace,
				raceId: getRaceKey(venue.id, upcomingRace.raceId, upcomingRace.raceNo),
			};
		}
	}

	return null;
};

const buildPracticeFallbackRaceKey = (params: {
	selectedRaceKey?: string;
	venue?: BoatPredictionVenue;
	race?: BoatPredictionRace;
	todayDate?: string;
}): string => {
	if (params.selectedRaceKey) {
		return params.selectedRaceKey;
	}

	if (!params.venue || !params.race) {
		return "";
	}

	const fallbackDate = params.venue.date ?? params.todayDate ?? "";
	const predictionRaceKey = buildBoatPredictionRaceKey({
		date: fallbackDate,
		venueName: params.venue.venueName,
		raceNo: params.race.raceNo,
		raceId: params.race.raceId,
	});

	if (predictionRaceKey) {
		return predictionRaceKey;
	}

	return `boat-practice:${fallbackDate}:${params.venue.venueCode || params.venue.venueName}:${params.race.raceNo}`;
};

	const parsedBetSummary = useMemo(() => parseBoatBets(predictionText), [predictionText]);
	const parsedTickets = useMemo(() => toPredictionTickets(parsedBetSummary.bets), [parsedBetSummary]);
	const selectedRaceKey = useMemo(() => {
		if (!selectedVenue || !selectedRace) {
			return "";
		}

		return buildBoatPredictionRaceKey({
			date: selectedVenue.date,
			venueName: selectedVenue.venueName,
			raceNo: selectedRace.raceNo,
			raceId: selectedRace.raceId,
		});
	}, [selectedVenue, selectedRace]);
	const practiceRaceKey = useMemo(
		() => buildPracticeFallbackRaceKey({
			selectedRaceKey,
			venue: selectedVenue,
			race: selectedRace,
			todayDate: todayFeed.date,
		}),
		[selectedRaceKey, selectedVenue, selectedRace, todayFeed.date],
	);

	const materialText = selectedVenue && selectedRace
		? buildBoatPredictionMaterial({
				venue: selectedVenue,
				race: selectedRace,
				venueExtra: selectedVenueExtra,
				raceExtra: selectedRaceExtra,
				venueFeatureNote: selectedVenueFeatureNote,
				venueFeatureInsights,
			})
		: "レース情報が選択されていません。";
	const raceLabel = `${selectedVenue?.venueName ?? "-"} ${selectedRace ? `${selectedRace.raceNo}R` : "-"}`;
	const venueCount = venues.length;
	const raceCount = races.length;
	const confirmedRaceCount = races.filter((race) => race.result?.status === "confirmed").length;
	const materialReadyRaceCount = races.filter((race) => {
		const racerCount = toArray<unknown>((race as { racers?: unknown }).racers).length;
		const exhibitionCount = toArray<unknown>((race as { exhibitions?: unknown }).exhibitions).length;

		return racerCount > 0 && exhibitionCount > 0 && hasRaceOddsPreview(race);
	}).length;
	const copyReadyRaceCount = materialReadyRaceCount;
	const weatherReadyVenueCount = venues.filter(hasVenueWeather).length;
	const currentSelectionLabel = `${selectedVenue?.venueName ?? "-"} / ${selectedRace?.raceNo ? `${selectedRace.raceNo}R` : "-"}`;
	const selectedRaceTime = readRaceTimeText(selectedRace);
	const practiceSummaryDate = todayFeed.date ?? selectedVenue?.date;
const practiceSummary = useMemo(() => {
	const targetRecords = practiceResultRecords.filter((record) => isPracticeSummaryRecord(record, practiceSummaryDate));

	const totalStakeYen = targetRecords.reduce(
		(sum, record) => sum + resolvePracticeStakeYen(record),
		0,
	);

	const totalPayoutYen = targetRecords.reduce(
		(sum, record) => sum + resolvePracticePayoutYen(record),
		0,
	);

	const hitCount = targetRecords.filter(isBoatPracticeHit).length;
	const resultCount = targetRecords.length;
	const profitYen = totalPayoutYen - totalStakeYen;

	return {
		resultCount,
		hitCount,
		totalStakeYen,
		totalPayoutYen,
		profitYen,
		hitRate: resultCount > 0 ? (hitCount / resultCount) * 100 : null,
		roi: totalStakeYen > 0 ? (totalPayoutYen / totalStakeYen) * 100 : null,
	};
}, [practiceResultRecords, practiceSummaryDate]);
	const predictionHeroTimeBand = getPredictionHeroTimeBand(selectedVenue);
	const predictionHeroImageSrc = predictionHeroImageSrcMap[predictionHeroTimeBand];
	const predictionHeroImageAlt =
		predictionHeroTimeBand === "morning"
			? "モーニング開催の予想ヒーロー画像"
			: predictionHeroTimeBand === "night"
				? "ナイター開催の予想ヒーロー画像"
				: "デイ開催の予想ヒーロー画像";

	const heroStats = [
		{
			eyebrow: "TODAY VENUES",
			value: `${venueCount}会場`,
			description: "今日の開催会場数",
		},
		{
			eyebrow: "TARGET RACES",
			value: `${raceCount}R`,
			description: "素材確認の対象レース数",
		},
		{
			eyebrow: "READY MATERIAL",
			value: `${materialReadyRaceCount}R`,
			description: "展示・選手・オッズが揃う仮基準",
		},
		{
			eyebrow: "COPY READY",
			value: `${copyReadyRaceCount}R`,
			description: `天気反映 ${weatherReadyVenueCount}/${venueCount}会場`,
		},
		{
			eyebrow: "TODAY RESULTS",
			value: `${confirmedRaceCount}R`,
			description: `結果確定 ${confirmedRaceCount}R / 保存済み ${practiceSummary.resultCount}件`,
		},
		{
			eyebrow: "HIT RATE",
			value: practiceSummary.hitRate === null ? "--%" : `${practiceSummary.hitRate.toFixed(1)}%`,
			description: practiceSummary.resultCount > 0 ? `的中 ${practiceSummary.hitCount}/${practiceSummary.resultCount}件` : "保存済み結果なし",
		},
		{
			eyebrow: "ROI",
			value: practiceSummary.roi === null ? "--%" : `${practiceSummary.roi.toFixed(1)}%`,
			description: practiceSummary.resultCount > 0
				? `投資 ${formatPracticeYen(practiceSummary.totalStakeYen)} / 払戻 ${formatPracticeYen(practiceSummary.totalPayoutYen)}`
				: "保存済み投資なし",
		},
		{
			eyebrow: "PROFIT",
			value: practiceSummary.resultCount > 0 ? formatPracticeProfit(practiceSummary.profitYen) : "--円",
			description: practiceSummary.resultCount > 0 ? "当日保存済み実践結果から集計" : "保存済み結果なし",
		},
	];

	const hitNotificationItems = practiceResultRecords
	.filter((record) => isPracticeSummaryRecord(record, practiceSummaryDate))
	.filter((record) =>
		isBoatPracticeHit(record) ||
		(Array.isArray(record.hitBets) && record.hitBets.length > 0) ||
		Boolean(record.hitBetNumbers)
	)
	.sort((left, right) =>
		String(right.updatedAt ?? right.savedAt ?? "").localeCompare(String(left.updatedAt ?? left.savedAt ?? ""))
	)
	.slice(0, 20)
	.map((record) => {
		const payoutYen = resolvePracticePayoutYen(record);
		const stakeYen = resolvePracticeStakeYen(record);
		const profitYen = resolvePracticeProfitYen(record);
		const roi = stakeYen > 0 ? (payoutYen / stakeYen) * 100 : readPracticeNumber(record.roi);

		return {
			key: record.raceKey || record.id || `${record.date}-${record.venueName}-${record.raceNo}`,
			title: `${record.venueName || "会場未設定"} ${record.raceNo ? `${record.raceNo}R` : ""}`.trim(),
			meta: [
				record.date || "日付未設定",
				record.actualFinishOrderText ? `実着順 ${record.actualFinishOrderText}` : "",
				record.kimarite ? `決まり手 ${record.kimarite}` : "",
			].filter(Boolean).join(" / "),
			badge: payoutYen > 0 ? "的中" : "的中候補",
			result: readPracticeHitBetLabel(record),
			payout: `払戻 ${formatPracticeYen(payoutYen)}`,
			investment: `投資 ${formatPracticeYen(stakeYen)}`,
			profit: `収支 ${formatPracticeProfit(profitYen)}`,
			roi: `回収率 ${formatPracticeRoi(roi)}`,
			savedAt: record.updatedAt ?? record.savedAt,
		};
	});

	const hitNotificationLoopItems = [
		...(hitNotificationItems.length > 0 ? hitNotificationItems : []),
		...(hitNotificationItems.length > 0 ? hitNotificationItems : []),
		...(hitNotificationItems.length > 0 ? hitNotificationItems : []),
		...(hitNotificationItems.length > 0 ? hitNotificationItems : []),
	];

	const refreshTodayFeed = async (options?: { silent?: boolean; isActive?: () => boolean }) => {
		const isSilent = options?.silent ?? false;

		if (!isSilent) {
			setIsRefreshingFeed(true);
			setRefreshMessage("最新データを読み込み中です...");
		}

		try {
			const [result, extrasResult] = await Promise.all([
				loadBoatTodayRaceDetailsFeed(),
				loadBoatVenueExtrasFeed(),
			]);

			if (options?.isActive && !options.isActive()) {
				return;
			}

			if (!result) {
				if (!isSilent) {
					setRefreshMessage("最新データを取得できませんでした。現在表示中のデータを維持します。");
				}
				return;
			}

			setTodayFeed(result);
			setVenueExtrasFeed(extrasResult);
			setDataUpdatedAt(result.generatedAt ?? "");

			if (!isSilent) {
				setRefreshMessage("最新データを読み込みました。");
			}
		} catch {
			if (options?.isActive && !options.isActive()) {
				return;
			}

			if (!isSilent) {
				setRefreshMessage("データ更新中にエラーが発生しました。");
			}
		} finally {
			if (!isSilent && (!options?.isActive || options.isActive())) {
				setIsRefreshingFeed(false);
			}
		}
	};

	const refreshPracticeResults = () => {
		setPracticeResultRecords(Object.values(loadBoatPracticeResultRecords()));
	};

	const applyPracticeResultRecords = (records: Record<string, BoatPracticeResultRecord>) => {
		setPracticeResultRecords(Object.values(records));
	};

	useEffect(() => {
		let isActive = true;

		void refreshTodayFeed({ silent: true, isActive: () => isActive });

		return () => {
			isActive = false;
		};
	}, []);

	useEffect(() => {
		refreshPracticeResults();
	}, []);

	useEffect(() => {
	if (venues.length === 0) return;

	const currentVenue = venues.find((venue) => venue.id === selectedVenueId);
	const currentRace = currentVenue
		? getVenueRaces(currentVenue).find((race) => getRaceKey(currentVenue.id, race.raceId, race.raceNo) === selectedRaceId)
		: undefined;

	if (currentVenue && currentRace) {
		return;
	}

	const savedSelection = loadPredictionSelectionSnapshot();
	const todayDate = todayFeed.date;

	if (savedSelection?.date === todayDate) {
		const savedVenue = venues.find((venue) =>
			venue.id === savedSelection.venueId ||
			venue.venueCode === savedSelection.venueCode ||
			venue.venueName === savedSelection.venueName
		);

		const savedRace = savedVenue
			? getVenueRaces(savedVenue).find((race) =>
					getRaceKey(savedVenue.id, race.raceId, race.raceNo) === savedSelection.raceId ||
					race.raceNo === savedSelection.raceNo
				)
			: undefined;

		if (savedVenue && savedRace) {
			setSelectedVenueId(savedVenue.id);
			setSelectedRaceId(getRaceKey(savedVenue.id, savedRace.raceId, savedRace.raceNo));
			return;
		}
	}

	const timeSelection = findCurrentTimeRaceSelection(venues);
	if (timeSelection) {
		setSelectedVenueId(timeSelection.venue.id);
		setSelectedRaceId(timeSelection.raceId);
	}
}, [venues, selectedVenueId, selectedRaceId, todayFeed.date]);

const handleSelectVenue = (venueId: string) => {
	const venue = venues.find((item) => item.id === venueId);
	const firstRace = getVenueRaces(venue)[0];

	setSelectedVenueId(venueId);
	setSelectedRaceId(getRaceKey(venueId, firstRace?.raceId, firstRace?.raceNo ?? 0));

	if (venue && firstRace) {
		savePredictionSelectionSnapshot({
			date: todayFeed.date,
			venue,
			race: firstRace,
		});
	}
};

const handleSelectRace = (raceId: string) => {
	setSelectedRaceId(raceId);

	const venue = venues.find((item) => item.id === selectedVenueId);
	const race = getVenueRaces(venue).find(
		(item) => getRaceKey(selectedVenueId, item.raceId, item.raceNo) === raceId,
	);

	if (venue && race) {
		savePredictionSelectionSnapshot({
			date: todayFeed.date,
			venue,
			race,
		});
	}
};

	useEffect(() => {
		let cancelled = false;
		loadBoatVenueFeatureIndex().then((loadedIndex) => {
			if (!cancelled) {
				setVenueFeatureIndex(loadedIndex);
			}
		});
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		setVenueFeatureInsights(loadBoatVenueUserInsights());
	}, []);

	useEffect(() => {
		if (!selectedVenue?.venueName) {
			setSelectedVenueFeatureNote(null);
			return;
		}

		let cancelled = false;
		setSelectedVenueFeatureNote(null);
		loadBoatVenueFeatureNote(selectedVenue.venueName, venueFeatureIndex).then((note) => {
			if (!cancelled) {
				setSelectedVenueFeatureNote(note);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [selectedVenue, venueFeatureIndex]);

	useEffect(() => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		const record = findBoatPredictionRecord({
			date: selectedVenue.date,
			venueName: selectedVenue.venueName,
			raceNo: selectedRace.raceNo,
			raceId: selectedRace.raceId,
		});

		if (record) {
			setSavedPredictionRecord(record);
			setPredictionText(record.predictionText);
			setSavedMessage("保存済み予想を読み込みました");
			return;
		}

		setSavedPredictionRecord(undefined);
		setPredictionText("");
		setSavedMessage("");
	}, [selectedVenue, selectedRace, selectedRaceKey]);

	useEffect(() => {
		if (!practiceRaceKey || !selectedRace) {
			return;
		}

		const record = findBoatPracticeResultRecord(practiceRaceKey);

		if (record) {
			setSavedPracticeResultRecord(record);
			setActualFinishOrderText(record.actualFinishOrderText);
			setInvestmentAmount(resolvePracticeStakeYen(record) || 1000);
			setPayoutAmount(resolvePracticePayoutYen(record));
			setPracticeMemo(record.practiceMemo);
			if (record.predictionText) {
				setPredictionText(record.predictionText);
			}
			setPracticeResultStatus(record.resultStatus);
			setPracticeResultLookupStatus(record.resultLookupStatus);
			setPracticeResultLookupDebugText(record.resultLookupStatus ? `保存済み / source=${record.resultSource ?? "-"}` : "");
			setPracticeKimarite(record.kimarite ?? "");
			setPracticeStartInfoText(record.startInfoText ?? "");
			setPracticeHitBetLabel(isBoatPracticeHit(record) ? readPracticeHitBetLabel(record) : "");
			setPracticeSettlementMessage(record.resultStatus === "confirmed" ? "保存済み照合結果" : "");
			setIsInvestmentAmountManual(true);
			setIsBetAutoApplied(Boolean(record.betSummary));
			setIsResultAutoApplied(Boolean(record.resultStatus));
			setPracticeMessage("保存済み実践結果を読み込みました");
			return;
		}

		setSavedPracticeResultRecord(undefined);
		setActualFinishOrderText(selectedRace.result?.finishOrder?.slice(0, 3).join("-") ?? "");
		setInvestmentAmount(parsedBetSummary.totalStakeYen || 1000);
		setPayoutAmount(0);
		setPracticeMemo("");
		setPracticeResultStatus(undefined);
		setPracticeResultLookupStatus(undefined);
		setPracticeResultLookupDebugText("");
		setPracticeKimarite("");
		setPracticeStartInfoText("");
		setPracticeHitBetLabel("");
		setPracticeSettlementMessage("");
		setIsInvestmentAmountManual(false);
		setIsBetAutoApplied(parsedBetSummary.totalStakeYen > 0);
		setIsResultAutoApplied(false);
		setPracticeMessage("");
	}, [practiceRaceKey, selectedRace]);

	useEffect(() => {
		if (savedPracticeResultRecord || isInvestmentAmountManual || parsedBetSummary.totalStakeYen <= 0) {
			return;
		}

		setInvestmentAmount(parsedBetSummary.totalStakeYen);
		setIsBetAutoApplied(true);
	}, [parsedBetSummary.totalStakeYen, savedPracticeResultRecord, isInvestmentAmountManual]);

	const handleSavePrediction = () => {
		if (!selectedVenue || !selectedRace || !selectedRaceKey) {
			return;
		}

		if (!predictionText.trim()) {
			setSavedMessage("予想本文が空です");
			return;
		}

		const record: BoatPredictionRecord = {
			raceKey: selectedRaceKey,
			raceId: selectedRace.raceId,
			venueCode: selectedVenue.venueCode,
			venueName: selectedVenue.venueName,
			date: selectedVenue.date,
			raceNo: selectedRace.raceNo,
			predictionText,
			tickets: parsedTickets,
			savedAt: new Date().toISOString(),
		};

		upsertBoatPredictionRecord(record);
		setSavedPredictionRecord(record);
		if (parsedBetSummary.totalStakeYen > 0) {
			if (!isInvestmentAmountManual) {
				setInvestmentAmount(parsedBetSummary.totalStakeYen);
			}
			setIsBetAutoApplied(true);
		}
		setSavedMessage("予想を保存しました");
	};

	const handleClearPrediction = () => {
		setPredictionText("");

		if (savedPredictionRecord?.raceKey) {
			deleteBoatPredictionRecord(savedPredictionRecord.raceKey);
		}

		setSavedPredictionRecord(undefined);
		setSavedMessage("予想をクリアしました");
	};

	const handleLoadBetsToPractice = () => {
		if (parsedBetSummary.totalStakeYen <= 0) {
			setPracticeMessage("買い目を読み取れませんでした");
			return;
		}

		setInvestmentAmount(parsedBetSummary.totalStakeYen);
		setIsInvestmentAmountManual(false);
		setIsBetAutoApplied(true);
		setPracticeMessage(`買い目${parsedBetSummary.totalBets}点を読み込みました`);
	};

	const savePracticeRecordAndRefresh = (record: BoatPracticeResultRecord, message: string) => {
		upsertBoatPracticeResultRecord(record);
		setSavedPracticeResultRecord(record);
		applyPracticeResultRecords(loadBoatPracticeResultRecords());
		setPracticeMessage(message);
	};

	const buildPracticeResultRecord = (params?: {
		actualFinishOrderText?: string;
		investmentAmount?: number;
		payoutAmount?: number;
		resultStatus?: BoatPracticeResultStatus;
		resultLookupStatus?: BoatResultLookupStatus;
		kimarite?: string;
		startInfoText?: string;
		payouts?: unknown[];
		hitBets?: ReturnType<typeof parseBoatBets>["bets"];
		resultSource?: string;
	}): BoatPracticeResultRecord | null => {
		if (!selectedVenue || !selectedRace) {
			return null;
		}

		const resolvedRaceKey = buildPracticeFallbackRaceKey({
			selectedRaceKey: practiceRaceKey,
			venue: selectedVenue,
			race: selectedRace,
			todayDate: todayFeed.date,
		});
		const nextActualFinishOrderText = params?.actualFinishOrderText ?? actualFinishOrderText ?? "";
		const nextInvestmentAmount = params?.investmentAmount ?? investmentAmount;
		const nextPayoutAmount = params?.payoutAmount ?? payoutAmount;
		const nextDate = selectedVenue.date ?? todayFeed.date ?? "";
		const raceResultRecord = toLooseRecord((selectedRace as { result?: unknown } | undefined)?.result);
		const storedPayouts = [
			...toArray<unknown>(raceResultRecord.payoutsFull),
			...toArray<unknown>(raceResultRecord.payouts),
		];
		const { profitLoss, roi } = calculateBoatPracticeProfitLoss({
			investmentAmount: nextInvestmentAmount,
			payoutAmount: nextPayoutAmount,
		});
		const labelHitBets = parsedBetSummary.bets.filter((bet) =>
			practiceHitBetLabel.includes(bet.normalized),
		);
		const finishOrderHitBets = findHitBetsByFinishOrder(parsedBetSummary.bets, nextActualFinishOrderText);
		const hitBets = params?.hitBets && params.hitBets.length > 0
			? params.hitBets
			: finishOrderHitBets.length > 0
				? finishOrderHitBets
				: labelHitBets;
		const hitBet = hitBets[0];
		const savedResultStatus = params?.resultStatus ?? practiceResultStatus ?? (nextPayoutAmount > 0 || nextActualFinishOrderText ? "confirmed" : undefined);
		const savedLookupStatus = params?.resultLookupStatus ?? practiceResultLookupStatus ?? (nextPayoutAmount > 0 ? "manual" : undefined);
		const savedAt = new Date().toISOString();
		const createdAt = savedPracticeResultRecord?.createdAt ?? savedPracticeResultRecord?.savedAt ?? savedAt;

		return {
			id: resolvedRaceKey,
			raceKey: resolvedRaceKey,
			raceId: selectedRace.raceId,
			venueCode: selectedVenue.venueCode,
			venueName: selectedVenue.venueName,
			date: nextDate,
			raceNo: selectedRace.raceNo,
			raceTitle: selectedRace.title,
			predictionText,
			parsedBets: parsedBetSummary.bets,
			betSummary: {
				totalBets: parsedBetSummary.totalBets,
				trifectaCount: parsedBetSummary.trifectaCount,
				exactaCount: parsedBetSummary.exactaCount,
				totalStakeYen: parsedBetSummary.totalStakeYen,
			},
			actualFinishOrderText: nextActualFinishOrderText,
			actualOrder: nextActualFinishOrderText,
			finishOrder: nextActualFinishOrderText,
			investmentAmount: nextInvestmentAmount,
			payoutAmount: nextPayoutAmount,
			profitLoss,
			roi,
			resultStatus: savedResultStatus,
			resultLookupStatus: savedLookupStatus,
			kimarite: (params?.kimarite ?? practiceKimarite) || undefined,
			startInfoText: (params?.startInfoText ?? practiceStartInfoText) || undefined,
			payouts: params?.payouts ?? storedPayouts,
			hitBets: hitBets.length > 0 ? hitBets : undefined,
			hitBetType: hitBet?.label,
			hitBetNumbers: hitBet ? hitBet.normalized || hitBet.numbers?.join("-") : undefined,
			totalStakeYen: parsedBetSummary.totalStakeYen || nextInvestmentAmount,
			payoutYen: nextPayoutAmount,
			profitYen: profitLoss,
			resultSource: params?.resultSource ?? (isResultAutoApplied ? "today-race-details.generated.json" : undefined),
			memo: practiceMemo,
			createdAt,
			updatedAt: savedAt,
			practiceMemo,
			savedAt,
		};
	};

	const handleSettlePracticeResult = async () => {
		if (!selectedVenue || !selectedRace) {
			return;
		}

		const freshFeed = await loadBoatTodayRaceDetailsFeed();
		const settlementFeed = freshFeed ?? todayFeed;
		if (freshFeed) {
			setTodayFeed(freshFeed);
			setDataUpdatedAt(freshFeed.generatedAt ?? dataUpdatedAt);
		}

		const lookup = findBoatRaceResultForPractice({
			feed: settlementFeed,
			date: selectedVenue.date,
			venueName: selectedVenue.venueName,
			venueCode: selectedVenue.venueCode,
			raceNo: selectedRace.raceNo,
		});
		const settlement = settleBoatPredictionResult({
			race: lookup.race ?? selectedRace,
			bets: parsedBetSummary.bets,
			investmentAmount,
			source: "today-race-details.generated.json",
		});
		const finishOrderHitBets = settlement.hitBets.length > 0
			? settlement.hitBets
			: findHitBetsByFinishOrder(parsedBetSummary.bets, settlement.finishOrderText);
		const lookupStatus =
			lookup.lookupStatus === "date-mismatch" && settlement.status === "confirmed"
				? "date-mismatch"
				: settlement.status === "confirmed" && finishOrderHitBets.length > 0 && settlement.payoutYen <= 0
					? "payout-missing"
					: settlement.lookupStatus;
		const lookupDebugText = buildPracticeLookupDebugText(lookup.debug);

		setPracticeResultStatus(settlement.status);
		setPracticeResultLookupStatus(lookupStatus);
		setPracticeResultLookupDebugText(lookupDebugText);
		setPracticeKimarite(settlement.kimarite ?? "");
		setPracticeStartInfoText(settlement.startInfoText ?? "");
		setPracticeHitBetLabel(finishOrderHitBets[0] ? `${finishOrderHitBets[0].label} ${finishOrderHitBets[0].normalized}` : "");
		setPracticeSettlementMessage(`${settlement.message}${lookupStatus === "date-mismatch" ? " / 日付差あり" : ""}`);
		setIsResultAutoApplied(true);

		if (settlement.finishOrderText) {
			setActualFinishOrderText(settlement.finishOrderText);
		}

		if (settlement.status === "confirmed") {
			setPayoutAmount(settlement.payoutYen);
		}

		const finishOrderForSave = settlement.finishOrderText || actualFinishOrderText;
		const shouldAutoSave = Boolean(finishOrderForSave);

		if (shouldAutoSave) {
			const autoSavedRecord = buildPracticeResultRecord({
				actualFinishOrderText: finishOrderForSave,
				investmentAmount,
				payoutAmount: settlement.payoutYen,
				resultStatus: "confirmed",
				resultLookupStatus: lookupStatus,
				kimarite: settlement.kimarite,
				startInfoText: settlement.startInfoText,
				payouts: settlement.payouts,
				hitBets: finishOrderHitBets,
				resultSource: "today-race-details.generated.json",
			});

			if (autoSavedRecord) {
				savePracticeRecordAndRefresh(
					autoSavedRecord,
					`${settlement.message} / 自動保存済み (${lookupDebugText})`,
				);
				return;
			}

			setPracticeMessage("結果は取れましたが、実践結果の保存レコードを作れませんでした。会場・レース選択を確認してください。");
			return;
		}

		setPracticeMessage(`${settlement.message} (${lookupDebugText})`);
	};

	const handleSavePracticeResult = () => {
		const record = buildPracticeResultRecord({
			actualFinishOrderText,
			investmentAmount,
			payoutAmount,
			resultStatus: actualFinishOrderText ? "confirmed" : practiceResultStatus,
			resultLookupStatus: practiceResultLookupStatus,
			kimarite: practiceKimarite,
			startInfoText: practiceStartInfoText,
			resultSource: isResultAutoApplied ? "today-race-details.generated.json" : undefined,
		});

		if (!record) {
			setPracticeMessage("保存できませんでした。会場・レース・着順の取得状態を確認してください。");
			return;
		}

		savePracticeRecordAndRefresh(record, "実践結果を保存しました");
	};

	const handleClearPracticeResult = () => {
		if (practiceRaceKey) {
			deleteBoatPracticeResultRecord(practiceRaceKey);
		}

		setSavedPracticeResultRecord(undefined);
		setActualFinishOrderText("");
		setInvestmentAmount(1000);
		setPayoutAmount(0);
		setPracticeMemo("");
		setPracticeResultStatus(undefined);
		setPracticeResultLookupStatus(undefined);
		setPracticeResultLookupDebugText("");
		setPracticeKimarite("");
		setPracticeStartInfoText("");
		setPracticeHitBetLabel("");
		setPracticeSettlementMessage("");
		setIsInvestmentAmountManual(false);
		setIsBetAutoApplied(false);
		setIsResultAutoApplied(false);
		refreshPracticeResults();
		setPracticeMessage("実践結果をクリアしました");
	};

	const handleChangeInvestmentAmount = (value: number) => {
		setIsInvestmentAmountManual(true);
		setInvestmentAmount(value);
	};

	const handleChangePayoutAmount = (value: number) => {
		setIsResultAutoApplied(false);
		setPracticeResultLookupStatus(value > 0 ? "manual" : practiceResultLookupStatus);
		setPayoutAmount(value);
	};

	return (
		<PageShell
			hideHero
			eyebrow=""
			title=""
			description=""
			contentMaxWidth="1680px"
			contentPaddingInline="24px"
			heroMaxWidth="1680px"
		>
			<style>
				{`

body:has(.prediction-page-root) {
	background: #eefbff;
}

#root:has(.prediction-page-root) {
	position: relative;
	min-height: 100vh;
	background: #eefbff;
}

#root:has(.prediction-page-root)::before {
	content: "";
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background-color: #eefbff;
	background-image:
		linear-gradient(180deg, rgba(238, 250, 253, 0.08) 0%, rgba(246, 252, 255, 0.12) 46%, rgba(230, 248, 247, 0.18) 100%),
		url("${predictionPageBackgroundImageSrc}");
	background-size: cover;
	background-position: center top;
	background-repeat: no-repeat;
}

.prediction-page-root {
	position: relative;
	z-index: 1;
	isolation: auto;
	display: grid;
	gap: 22px;
	padding-top: 22px;
	padding-bottom: 36px;
}

#root:has(.prediction-page-root) > div {
	z-index: 1;
	background: transparent !important;
}

#root:has(.prediction-page-root) main {
	position: relative;
	z-index: 1;
}

.prediction-page-root > * {
	position: relative;
	z-index: 1;
}

					.prediction-page-main-panels {
						display: grid;
						grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
						gap: 18px;
						align-items: start;
						width: 100%;
						max-width: 100%;
						min-width: 0;
						box-sizing: border-box;
					}

					.prediction-hero-card,
					.prediction-section-card {
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(255, 255, 255, 0.94);
						box-shadow: 0 24px 54px rgba(80, 64, 120, 0.08);
					}

					.prediction-hero-card {
						padding: 28px;
						border-radius: 34px;
					}

					.prediction-hero-grid {
						display: grid;
						grid-template-columns: minmax(0, 1fr) minmax(320px, 520px);
						gap: 28px;
						align-items: center;
					}

					.prediction-hero-copy {
						display: grid;
						gap: 14px;
						align-content: center;
					}

					.prediction-hero-image {
						position: relative;
						min-height: 320px;
						border-radius: 28px;
						overflow: hidden;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: linear-gradient(135deg, rgba(236, 232, 255, 0.86), rgba(247, 252, 255, 0.98));
						box-shadow: 0 18px 38px rgba(80, 64, 120, 0.12);
					}

					.prediction-hero-img {
						display: block;
						width: 100%;
						height: 100%;
						min-height: 320px;
						object-fit: cover;
						object-position: center;
					}

					.prediction-eyebrow {
						margin: 0;
						font-size: 0.72rem;
						font-weight: 900;
						letter-spacing: 0.24em;
						color: #9f89d8;
						text-transform: uppercase;
					}

					.prediction-hero-title {
						margin: 0;
						font-size: clamp(2.4rem, 4vw, 4.2rem);
						line-height: 1.05;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-text {
						margin: 0;
						font-size: 0.9rem;
						line-height: 1.8;
						color: #60788a;
					}

					.prediction-update-meta {
						display: inline-flex;
						width: fit-content;
						padding: 8px 12px;
						border-radius: 999px;
						background: rgba(240, 248, 253, 0.94);
						border: 1px solid rgba(93, 199, 232, 0.18);
						color: #2c7fa3;
						font-size: 0.78rem;
						font-weight: 800;
					}

					.prediction-stats-grid {
						display: grid;
						grid-template-columns: repeat(4, minmax(0, 1fr));
						gap: 16px;
					}

					.prediction-stat-card {
						padding: 20px;
						border-radius: 24px;
						background: rgba(255, 255, 255, 0.96);
						border: 1px solid rgba(176, 137, 216, 0.18);
						box-shadow: 0 14px 30px rgba(80, 64, 120, 0.06);
						display: grid;
						gap: 10px;
					}

					.prediction-stat-value {
						margin: 0;
						font-size: 1.55rem;
						line-height: 1.1;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-stat-description {
						margin: 0;
						font-size: 0.8rem;
						line-height: 1.6;
						color: #60788a;
					}

					.prediction-section-card {
						padding: 24px;
						border-radius: 30px;
						display: grid;
						gap: 18px;
					}

					.prediction-section-header {
						display: flex;
						align-items: flex-start;
						justify-content: space-between;
						gap: 16px;
						flex-wrap: wrap;
					}

					.prediction-section-title {
						margin: 0;
						font-size: 2rem;
						line-height: 1.15;
						font-weight: 900;
						color: #132f45;
					}

					.prediction-count-pill {
						display: inline-flex;
						align-items: center;
						justify-content: center;
						min-width: 64px;
						padding: 10px 14px;
						border-radius: 999px;
						background: rgba(176, 137, 216, 0.14);
						color: #8a70d2;
						font-size: 0.82rem;
						font-weight: 900;
					}

					.prediction-notification-grid {
						position: relative;
						overflow: hidden;
						padding: 2px 0 6px;
						mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent);
					}

					.prediction-notification-track {
						display: flex;
						width: max-content;
						gap: 12px;
						animation: predictionNotificationMarquee 34s linear infinite;
						will-change: transform;
					}

					.prediction-notification-grid:hover .prediction-notification-track {
						animation-play-state: paused;
					}

					.prediction-notification-card {
						width: 260px;
						flex: 0 0 260px;
						min-width: 0;
						padding: 14px;
						border-radius: 20px;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(250, 247, 255, 0.9);
						display: grid;
						gap: 10px;
					}

					.prediction-notification-empty {
						display: flex;
						align-items: center;
						gap: 12px;
						flex-wrap: wrap;
						padding: 18px;
						border-radius: 20px;
						border: 1px solid rgba(176, 137, 216, 0.22);
						background: rgba(250, 247, 255, 0.9);
					}

					@keyframes predictionNotificationMarquee {
						from {
							transform: translateX(0);
						}

						to {
							transform: translateX(calc(-50% - 6px));
						}
					}

					.prediction-notification-top {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 10px;
					}

					.prediction-badge {
						display: inline-flex;
						width: fit-content;
						align-items: center;
						justify-content: center;
						padding: 5px 10px;
						border-radius: 999px;
						background: rgba(176, 137, 216, 0.16);
						color: #8a70d2;
						font-size: 0.7rem;
						font-weight: 900;
					}

					.prediction-hit-badge {
						display: inline-flex;
						width: fit-content;
						align-items: center;
						justify-content: center;
						padding: 5px 10px;
						border-radius: 999px;
						background: rgba(46, 204, 113, 0.15);
						color: #12815c;
						font-size: 0.7rem;
						font-weight: 900;
					}

					.prediction-quick-head {
						display: grid;
						grid-template-columns: minmax(0, 1fr) auto;
						gap: 18px;
						align-items: start;
					}

					.prediction-current-card {
						min-width: 190px;
						padding: 18px 20px;
						border-radius: 22px;
						border: 1px solid rgba(176, 137, 216, 0.24);
						background: rgba(250, 247, 255, 0.92);
						display: grid;
						gap: 8px;
					}

					.prediction-current-value {
						margin: 0;
						font-size: 1.18rem;
						line-height: 1.25;
						font-weight: 900;
						color: #132f45;
					}

					@media (max-width: 1200px) {
						.prediction-hero-grid {
							grid-template-columns: 1fr;
						}

						.prediction-stats-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}
					}

					@media (max-width: 900px) {


						.prediction-page-root {
							padding-top: 14px;
						}

						.prediction-page-main-panels {
							grid-template-columns: 1fr;
						}

						.prediction-stats-grid {
							grid-template-columns: 1fr;
						}

						.prediction-quick-head {
							grid-template-columns: 1fr;
						}

						.prediction-hero-card,
						.prediction-section-card {
							padding: 18px;
							border-radius: 24px;
						}

						.prediction-hero-image,
						.prediction-hero-img {
							min-height: 220px;
						}
					}
				`}
			</style>

			<div className="prediction-page-root">
				<section className="prediction-hero-card">
					<div className="prediction-hero-grid">
						<div className="prediction-hero-copy">
							<p className="prediction-eyebrow">PREDICTION</p>
							<h1 className="prediction-hero-title">今日の予想を考える</h1>
							<p className="prediction-text">
								会場特徴・天気・出走表・展示・オッズをまとめ、GPTへそのまま渡せる予想素材を整えるページです。
							</p>

							{dataUpdatedAt ? (
								<p className="prediction-update-meta">
									基本データ更新：{formatJstDateTimeLabel(dataUpdatedAt)}
								</p>
							) : null}

							{isRefreshingFeed || refreshMessage ? (
								<p className="prediction-text">
									{isRefreshingFeed ? "最新データを確認中です。" : refreshMessage}
								</p>
							) : null}
						</div>

						<div className="prediction-hero-image">
							<img src={predictionHeroImageSrc} alt={predictionHeroImageAlt} className="prediction-hero-img" />
						</div>
					</div>
				</section>

				<div className="prediction-stats-grid">
					{heroStats.map((item) => (
						<article key={item.eyebrow} className="prediction-stat-card">
							<p className="prediction-eyebrow">{item.eyebrow}</p>
							<p className="prediction-stat-value">{item.value}</p>
							<p className="prediction-stat-description">{item.description}</p>
						</article>
					))}
				</div>

				<section className="prediction-section-card">
					<div className="prediction-section-header">
						<div>
							<p className="prediction-eyebrow">HIT NOTIFICATIONS</p>
							<h2 className="prediction-section-title">的中通知ログ</h2>
							<p className="prediction-text">
								保存済みの実践結果から、的中したレースだけを自動で表示します。
							</p>
						</div>

						<span className="prediction-count-pill">{hitNotificationItems.length}件</span>
					</div>

					<div className="prediction-notification-grid">
						{hitNotificationItems.length > 0 ? (
							<div className="prediction-notification-track">
								{hitNotificationLoopItems.map((item, index) => (
									<article key={`${item.key}-${index}`} className="prediction-notification-card">
										<div className="prediction-notification-top">
											<strong style={{ color: "#132f45", fontSize: "0.92rem" }}>{item.title}</strong>
											<span className="prediction-hit-badge">{item.badge}</span>
										</div>

										<p className="prediction-text">{item.meta}</p>

										<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const }}>
											<span className="prediction-badge">{item.result}</span>
											<span className="prediction-badge">{item.payout}</span>
											<span className="prediction-badge">{item.investment}</span>
										</div>

										<p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 900, color: "#12815c" }}>
											{item.profit} / {item.roi}
										</p>
										<p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 800, color: "#8a70d2" }}>
											保存済み実践結果から自動表示{item.savedAt ? ` / ${formatJstDateTimeLabel(item.savedAt)}` : ""}
										</p>
									</article>
								))}
							</div>
						) : (
							<div className="prediction-notification-empty">
								<span className="prediction-badge">保存済み実践結果から自動表示</span>
								<p className="prediction-text" style={{ margin: 0 }}>的中ログはまだありません</p>
							</div>
						)}
					</div>
				</section>

				<section className="prediction-section-card">
	<div className="prediction-quick-head">
		<div>
			<p className="prediction-eyebrow">QUICK SELECT</p>
			<h2 className="prediction-section-title">会場とレースを選ぶ</h2>
			<p className="prediction-text">
				会場とレースを選び、そのまま下の予想素材確認へ進めます。
			</p>
		</div>
	</div>

	<BoatPredictionVenueRaceChooser
		venues={venues}
		selectedVenueId={selectedVenueId}
		selectedRaceId={selectedRaceId}
		raceExhibitionStatusMap={raceExhibitionStatusMap}
		onSelectVenue={handleSelectVenue}
		onSelectRace={handleSelectRace}
	/>
</section>

				<div className={panelGridClassName}>
					<BoatGptMaterialPanel materialText={materialText} raceLabel={raceLabel} />
					<div style={{ display: "grid", gap: "10px" }}>
						{savedMessage ? <p style={savedMessageStyle}>{savedMessage}</p> : null}
						<BoatPredictionPastePanel
							value={predictionText}
							raceLabel={raceLabel}
							tickets={parsedTickets}
							savedAt={savedPredictionRecord?.savedAt}
							isSaved={Boolean(savedPredictionRecord && savedPredictionRecord.predictionText === predictionText)}
							onSave={handleSavePrediction}
							onChange={setPredictionText}
							onClear={handleClearPrediction}
						/>
					</div>
				</div>

				{practiceMessage ? <p style={practiceMessageStyle}>{practiceMessage}</p> : null}
				<BoatPracticeResultPanel
					venueName={selectedVenue?.venueName ?? "-"}
					raceNo={selectedRace?.raceNo ?? 0}
					raceTitle={selectedRace?.title}
					tickets={parsedTickets}
					savedAt={savedPracticeResultRecord?.savedAt}
					isSaved={Boolean(savedPracticeResultRecord)}
					onSave={handleSavePracticeResult}
					onClear={handleClearPracticeResult}
					onLoadBets={handleLoadBetsToPractice}
					onSettleResult={handleSettlePracticeResult}
					actualFinishOrderText={actualFinishOrderText}
					investmentAmount={investmentAmount}
					payoutAmount={payoutAmount}
					practiceMemo={practiceMemo}
					betSummary={parsedBetSummary}
					resultStatus={practiceResultStatus}
					resultLookupStatus={practiceResultLookupStatus}
					resultLookupDebugText={practiceResultLookupDebugText}
					kimarite={practiceKimarite}
					startInfoText={practiceStartInfoText}
					hitBetLabel={practiceHitBetLabel}
					settlementMessage={practiceSettlementMessage}
					isBetAutoApplied={isBetAutoApplied}
					isResultAutoApplied={isResultAutoApplied}
					onChangeFinishOrder={setActualFinishOrderText}
					onChangeInvestmentAmount={handleChangeInvestmentAmount}
					onChangePayoutAmount={handleChangePayoutAmount}
					onChangePracticeMemo={setPracticeMemo}
				/>
			</div>
		</PageShell>
	);
}
