import { isBoatPracticePayoutPending, type BoatPracticeResultRecord } from "./boatPracticeResultStorage";
import { resolveBoatPredictionOutcome, type BoatPredictionOutcomeStatus } from "./boatResultSettlement";
import type { BoatVenueExtraRace, BoatVenueExtraVenue } from "./boatVenueExtrasFeed";
import type {
	BoatOddsItem,
	BoatOddsTopItem,
	BoatPayoutItem,
	BoatPredictionRecord,
	BoatRaceItem,
	BoatRaceResult,
	BoatRacerItem,
	BoatTodayFeed,
	BoatTodayVenueItem,
} from "./boatraceTypes";

export type BoatReviewVenueSlug =
	| "kiryu"
	| "toda"
	| "edogawa"
	| "heiwajima"
	| "tamagawa"
	| "hamanako"
	| "gamagori"
	| "tokoname"
	| "tsu"
	| "mikuni"
	| "biwako"
	| "suminoe"
	| "amagasaki"
	| "naruto"
	| "marugame"
	| "kojima"
	| "miyajima"
	| "tokuyama"
	| "shimonoseki"
	| "wakamatsu"
	| "ashiya"
	| "fukuoka"
	| "karatsu"
	| "omura";

export type BoatReviewVenueGroup = {
	key: string;
	date: string;
	venueName: string;
	venueSlug: string;
	venueCode?: string;
	title?: string;
	venue?: BoatTodayVenueItem;
	races: BoatReviewRaceEntry[];
	predictionFileText?: string | null;
	resultFileText?: string | null;
	summaryFileText?: string | null;
};

export type BoatReviewRaceEntry = {
	raceNo: number;
	race?: BoatRaceItem;
	prediction?: BoatPredictionRecord;
	practiceResult?: BoatPracticeResultRecord;
};

export type BoatReviewVenueMetrics = {
	predictionCount: number;
	resultCount: number;
	practiceCount: number;
	hitCount: number;
	investment: number;
	payout: number;
	profit: number;
	roi: number;
	hasSummary: boolean;
};

export type BoatReviewPredictionCoverage = {
	status: "known" | "unknown";
	savedCount: number | null;
	totalCount: number;
	missingRaceNos: number[];
};

export type BoatReviewResultCoverage = {
	confirmedCount: number;
	exhibitionCompleteCount: number;
	totalCount: number;
};

export type BoatReviewResultSummaryOptions = {
	venueExtra?: BoatVenueExtraVenue | null;
};

export const BOAT_REVIEW_VENUE_SLUGS: Record<string, BoatReviewVenueSlug> = {
	桐生: "kiryu",
	戸田: "toda",
	江戸川: "edogawa",
	平和島: "heiwajima",
	多摩川: "tamagawa",
	浜名湖: "hamanako",
	蒲郡: "gamagori",
	常滑: "tokoname",
	津: "tsu",
	三国: "mikuni",
	びわこ: "biwako",
	住之江: "suminoe",
	尼崎: "amagasaki",
	鳴門: "naruto",
	丸亀: "marugame",
	児島: "kojima",
	宮島: "miyajima",
	徳山: "tokuyama",
	下関: "shimonoseki",
	若松: "wakamatsu",
	芦屋: "ashiya",
	福岡: "fukuoka",
	唐津: "karatsu",
	大村: "omura",
};

const BOAT_REVIEW_SLUG_TO_VENUE = Object.entries(BOAT_REVIEW_VENUE_SLUGS).reduce<Record<string, string>>((acc, [venueName, slug]) => {
	acc[slug] = venueName;
	return acc;
}, {});

const BOAT_REVIEW_VENUE_ALIASES: Record<string, string> = {
	ボートレース桐生: "桐生",
	ボートレース戸田: "戸田",
	ボートレース江戸川: "江戸川",
	ボートレース平和島: "平和島",
	ボートレース多摩川: "多摩川",
	ボートレース浜名湖: "浜名湖",
	ボートレース蒲郡: "蒲郡",
	ボートレース常滑: "常滑",
	ボートレース津: "津",
	ボートレース三国: "三国",
	ボートレースびわこ: "びわこ",
	ボートレース住之江: "住之江",
	ボートレース尼崎: "尼崎",
	ボートレース鳴門: "鳴門",
	ボートレース丸亀: "丸亀",
	ボートレース児島: "児島",
	ボートレース宮島: "宮島",
	ボートレース徳山: "徳山",
	ボートレース下関: "下関",
	ボートレース若松: "若松",
	ボートレース芦屋: "芦屋",
	ボートレース福岡: "福岡",
	ボートレース唐津: "唐津",
	ボートレース大村: "大村",
};

export function normalizeBoatReviewVenueName(value?: string | null): string {
	const normalized = String(value ?? "")
		.normalize("NFKC")
		.replace(/\s+/g, "")
		.replace(/^BOATRACE/i, "")
		.replace(/^ボートレース/, "")
		.replace(/競艇場$/, "")
		.replace(/ボートレース場$/, "")
		.trim();

	return BOAT_REVIEW_VENUE_ALIASES[normalized] ?? normalized;
}

export function getBoatReviewVenueSlug(venueName?: string | null, fallback?: string): string {
	const normalized = normalizeBoatReviewVenueName(venueName);
	return BOAT_REVIEW_VENUE_SLUGS[normalized] ?? fallback ?? normalized.toLowerCase();
}

export function getBoatReviewVenueNameFromSlug(slug: string): string {
	return BOAT_REVIEW_SLUG_TO_VENUE[slug] ?? slug;
}

export function normalizeBoatPredictionRecordList(payload: unknown): BoatPredictionRecord[] {
	if (Array.isArray(payload)) return payload.filter(Boolean) as BoatPredictionRecord[];
	if (!payload || typeof payload !== "object") return [];
	return Object.values(payload).filter(Boolean) as BoatPredictionRecord[];
}

export function normalizeBoatPracticeResultList(payload: unknown): BoatPracticeResultRecord[] {
	if (Array.isArray(payload)) return payload.filter(Boolean) as BoatPracticeResultRecord[];
	if (!payload || typeof payload !== "object") return [];
	return Object.values(payload).filter(Boolean) as BoatPracticeResultRecord[];
}

function formatDateJa(date: string): string {
	const parsed = new Date(`${date}T00:00:00+09:00`);
	if (Number.isNaN(parsed.getTime())) return date;
	const weekday = ["日", "月", "火", "水", "木", "金", "土"][parsed.getDay()];
	return `${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, "0")}/${String(parsed.getDate()).padStart(2, "0")}(${weekday})`;
}

function readText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

type ReviewRecord = Record<string, unknown>;

function isReviewRecord(value: unknown): value is ReviewRecord {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toReviewRecordArray(value: unknown): ReviewRecord[] {
	if (Array.isArray(value)) return value.filter(isReviewRecord);
	if (isReviewRecord(value)) return Object.values(value).filter(isReviewRecord);
	return [];
}

function readFirstText(record: ReviewRecord | null | undefined, keys: string[]): string {
	if (!record) return "";
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" || typeof value === "number") {
			const text = String(value).trim();
			if (text) return text;
		}
	}
	return "";
}

function readFrameNo(record: ReviewRecord): number | null {
	const value = Number(record.frameNo ?? record.frame ?? record.lane ?? record.boatNumber ?? record.boatNo ?? record.teiban ?? record.waku);
	return Number.isInteger(value) && value >= 1 && value <= 6 ? value : null;
}

function getVenueExtraRace(venueExtra: BoatVenueExtraVenue | null | undefined, raceNo: number): BoatVenueExtraRace | null {
	return toReviewRecordArray(venueExtra?.races).find((race) => Number(race.raceNo) === raceNo) as BoatVenueExtraRace | null ?? null;
}

function readNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value.normalize("NFKC").replace(/[^\d.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function getReviewPredictionOutcomeStatus(entry: BoatReviewRaceEntry): BoatPredictionOutcomeStatus {
	const prediction = entry.prediction;
	const practiceResult = entry.practiceResult;
	const finishOrder = getFinishOrderText(entry.race, practiceResult);

	if (entry.race) {
		return resolveBoatPredictionOutcome({
			race: entry.race,
			bets: prediction?.parsedBets ?? [],
			investmentAmount: readNumber(practiceResult?.investmentAmount ?? practiceResult?.totalStakeYen ?? prediction?.totalStakeYen ?? prediction?.betSummary?.totalStakeYen),
			parseStatus: prediction?.parseStatus,
			parseWarnings: prediction?.parseWarnings,
			source: "review",
		}).status;
	}

	if (
		readNumber(practiceResult?.payoutAmount ?? practiceResult?.payoutYen) > 0 ||
		(practiceResult?.hitBets?.length ?? 0) > 0 ||
		isBoatPracticePayoutPending(practiceResult)
	) {
		return "hit";
	}

	if (!finishOrder) {
		return "pending";
	}

	if (!prediction?.parsedBets?.length || prediction.parseStatus === "invalid" || prediction.parseStatus === "missing-section") {
		return "parse-warning";
	}

	if (practiceResult?.resultStatus === "confirmed") {
		return "miss";
	}

	return "pending";
}

function yen(value: number): string {
	return `${value.toLocaleString("ja-JP")}円`;
}

function signedYen(value: number): string {
	return `${value >= 0 ? "+" : ""}${yen(value)}`;
}

function percent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function getRaceKeyCandidates(params: {
	date: string;
	venueName: string;
	venueCode?: string;
	raceNo: number;
	raceId?: string;
}): string[] {
	const keys = [
		params.raceId ? `boat-prediction:${params.raceId}` : "",
		`boat-prediction:${params.date}:${params.venueName}:${params.raceNo}`,
		params.venueCode ? `boat-prediction:${params.date}:${params.venueCode}:${params.raceNo}` : "",
		`${params.date}:${params.venueName}:${params.raceNo}`,
		params.venueCode ? `${params.date}:${params.venueCode}:${params.raceNo}` : "",
	].filter(Boolean);
	return Array.from(new Set(keys));
}

function findPrediction(params: {
	predictions: BoatPredictionRecord[];
	date: string;
	venueName: string;
	venueCode?: string;
	raceNo: number;
	raceId?: string;
}): BoatPredictionRecord | undefined {
	const normalizedVenue = normalizeBoatReviewVenueName(params.venueName);
	const keyCandidates = getRaceKeyCandidates(params);
	return params.predictions.find((record) => {
		if (record.date !== params.date) return false;
		if (Number(record.raceNo) !== params.raceNo) return false;
		if (record.raceId && params.raceId && record.raceId === params.raceId) return true;
		if (record.raceKey && keyCandidates.includes(record.raceKey)) return true;
		if (params.venueCode && record.venueCode === params.venueCode) return true;
		return normalizeBoatReviewVenueName(record.venueName) === normalizedVenue;
	});
}

function findPractice(params: {
	practiceResults: BoatPracticeResultRecord[];
	date: string;
	venueName: string;
	venueCode?: string;
	raceNo: number;
	raceId?: string;
}): BoatPracticeResultRecord | undefined {
	const normalizedVenue = normalizeBoatReviewVenueName(params.venueName);
	const keyCandidates = getRaceKeyCandidates(params);
	return params.practiceResults.find((record) => {
		if (record.date !== params.date) return false;
		if (Number(record.raceNo) !== params.raceNo) return false;
		if (record.raceId && params.raceId && record.raceId === params.raceId) return true;
		if (record.raceKey && keyCandidates.includes(record.raceKey)) return true;
		if (params.venueCode && record.venueCode === params.venueCode) return true;
		return normalizeBoatReviewVenueName(record.venueName) === normalizedVenue;
	});
}

function sortGroups(groups: BoatReviewVenueGroup[]): BoatReviewVenueGroup[] {
	return groups.sort((a, b) => {
		const aPredictions = a.races.filter((race) => race.prediction).length;
		const bPredictions = b.races.filter((race) => race.prediction).length;
		if (aPredictions !== bPredictions) return bPredictions - aPredictions;
		return a.venueName.localeCompare(b.venueName, "ja");
	});
}

export function buildLiveBoatReviewVenueGroups(params: {
	date: string;
	feed: BoatTodayFeed | null;
	predictions: BoatPredictionRecord[];
	practiceResults: BoatPracticeResultRecord[];
}): BoatReviewVenueGroup[] {
	const groupMap = new Map<string, BoatReviewVenueGroup>();

	for (const venue of params.feed?.date === params.date ? params.feed.venues ?? [] : []) {
		const venueName = normalizeBoatReviewVenueName(venue.venueName) || venue.venueName;
		const venueSlug = getBoatReviewVenueSlug(venueName);
		const groupKey = `${params.date}:${venueSlug}`;
		const races = Array.from({ length: 12 }, (_, index): BoatReviewRaceEntry => {
			const raceNo = index + 1;
			const race = (venue.races ?? []).find((item) => Number(item.raceNo) === raceNo);
			return {
				raceNo,
				race,
				prediction: findPrediction({
					predictions: params.predictions,
					date: params.date,
					venueName,
					venueCode: venue.venueCode,
					raceNo,
					raceId: race?.raceId,
				}),
				practiceResult: findPractice({
					practiceResults: params.practiceResults,
					date: params.date,
					venueName,
					venueCode: venue.venueCode,
					raceNo,
					raceId: race?.raceId,
				}),
			};
		});

		groupMap.set(groupKey, {
			key: groupKey,
			date: params.date,
			venueName,
			venueSlug,
			venueCode: venue.venueCode,
			title: venue.title,
			venue,
			races,
		});
	}

	for (const prediction of params.predictions.filter((record) => record.date === params.date)) {
		const venueName = normalizeBoatReviewVenueName(prediction.venueName) || prediction.venueName;
		const venueSlug = getBoatReviewVenueSlug(venueName);
		const groupKey = `${params.date}:${venueSlug}`;
		const existingGroup = groupMap.get(groupKey);

		if (!existingGroup) {
			const races = Array.from({ length: 12 }, (_, index): BoatReviewRaceEntry => {
				const raceNo = index + 1;
				return {
					raceNo,
					prediction: raceNo === Number(prediction.raceNo)
						? prediction
						: findPrediction({
							predictions: params.predictions,
							date: params.date,
							venueName,
							venueCode: prediction.venueCode,
							raceNo,
						}),
					practiceResult: findPractice({
						practiceResults: params.practiceResults,
						date: params.date,
						venueName,
						venueCode: prediction.venueCode,
						raceNo,
					}),
				};
			});
			groupMap.set(groupKey, {
				key: groupKey,
				date: params.date,
				venueName,
				venueSlug,
				venueCode: prediction.venueCode,
				races,
			});
		}
	}

	for (const practiceResult of params.practiceResults.filter((record) => record.date === params.date)) {
		const venueName = normalizeBoatReviewVenueName(practiceResult.venueName) || practiceResult.venueName;
		const venueSlug = getBoatReviewVenueSlug(venueName);
		const groupKey = `${params.date}:${venueSlug}`;
		if (groupMap.has(groupKey)) continue;

		groupMap.set(groupKey, {
			key: groupKey,
			date: params.date,
			venueName,
			venueSlug,
			venueCode: practiceResult.venueCode,
			races: Array.from({ length: 12 }, (_, index): BoatReviewRaceEntry => {
				const raceNo = index + 1;
				return {
					raceNo,
					practiceResult: findPractice({
						practiceResults: params.practiceResults,
						date: params.date,
						venueName,
						venueCode: practiceResult.venueCode,
						raceNo,
					}),
					prediction: findPrediction({
						predictions: params.predictions,
						date: params.date,
						venueName,
						venueCode: practiceResult.venueCode,
						raceNo,
					}),
				};
			}),
		});
	}

	return sortGroups(Array.from(groupMap.values()));
}

export function createArchiveBoatReviewVenueGroup(params: {
	date: string;
	venueName: string;
	venueSlug: string;
	predictionFileText?: string | null;
	resultFileText?: string | null;
	summaryFileText?: string | null;
}): BoatReviewVenueGroup {
	return {
		key: `${params.date}:${params.venueSlug}`,
		date: params.date,
		venueName: params.venueName,
		venueSlug: params.venueSlug,
		races: Array.from({ length: 12 }, (_, index) => ({ raceNo: index + 1 })),
		predictionFileText: params.predictionFileText,
		resultFileText: params.resultFileText,
		summaryFileText: params.summaryFileText,
	};
}

function getFinishOrderText(race?: BoatRaceItem, practice?: BoatPracticeResultRecord): string {
	if (practice?.actualFinishOrderText) return practice.actualFinishOrderText;
	const result = race?.result as (BoatRaceResult & Record<string, unknown>) | undefined;
	const order = result?.finishOrder ?? result?.resultTop3 ?? result?.top3;
	if (Array.isArray(order)) return order.slice(0, 3).map(String).join("-");
	const finishers = Array.isArray(result?.finishers) ? result.finishers : [];
	return finishers
		.slice()
		.sort((a, b) => readNumber(a.rank) - readNumber(b.rank))
		.map((item) => String(item.frameNo ?? item.frame ?? item.boatNumber ?? item.lane ?? ""))
		.filter(Boolean)
		.slice(0, 3)
		.join("-");
}

function getPayoutRows(result?: BoatRaceResult): BoatPayoutItem[] {
	if (!result) return [];
	const rows = [
		...(Array.isArray(result.payoutsFull) ? result.payoutsFull : []),
		...(Array.isArray(result.payouts) ? result.payouts : []),
		result.payout3tan,
		result.payout2tan,
		result.payout2fuku,
		result.payout3fuku,
		...(Array.isArray(result.payoutWide) ? result.payoutWide : []),
	].filter(Boolean) as BoatPayoutItem[];
	const seen = new Set<string>();
	return rows.filter((row) => {
		const key = `${row.betType}:${row.combination}:${row.payout}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function formatPayoutLine(label: string, result?: BoatRaceResult, matcher?: RegExp): string {
	const row = getPayoutRows(result).find((item) => matcher ? matcher.test(String(item.betType).normalize("NFKC")) : false);
	if (!row) return `${label}: 未取得`;
	return `${label}: ${row.combination || "-"} / ${row.payout || "-"}${row.popularity ? ` / 人気 ${row.popularity}` : ""}`;
}

function formatWeather(result?: BoatRaceResult, race?: BoatRaceItem, venue?: BoatTodayVenueItem): string {
	const weather = result?.weatherActual ?? race?.weatherActual ?? venue?.weatherActual;
	return [
		`天候: ${weather?.weather ?? "未取得"}`,
		`風向: ${weather?.windDirectionText ?? weather?.windDirection ?? "未取得"}`,
		`風速: ${weather?.windSpeed ?? "未取得"}`,
		`波高: ${weather?.waveHeight ?? "未取得"}`,
		`気温: ${weather?.airTemperature ?? weather?.temperature ?? "未取得"}`,
		`水温: ${weather?.waterTemperature ?? "未取得"}`,
		`気圧: ${weather?.pressure ?? "未取得"}`,
		`湿度: ${weather?.humidity ?? "未取得"}`,
		`雨量: ${weather?.rainfall ?? "未取得"}`,
		`表示時点: ${weather?.observedAt ?? weather?.updatedAt ?? weather?.fetchedAt ?? "未取得"}`,
	].join("\n");
}

function formatFinishers(result?: BoatRaceResult): string {
	const finishers = Array.isArray(result?.finishers) ? result.finishers : [];
	if (finishers.length === 0) {
		return Array.from({ length: 6 }, (_, index) => `${index + 1}着: 未取得`).join("\n");
	}
	return Array.from({ length: 6 }, (_, index) => {
		const rank = index + 1;
		const finisher = finishers.find((item) => Number(item.rank) === rank) ?? finishers[index];
		const frame = finisher ? String(finisher.frameNo ?? finisher.frame ?? finisher.boatNumber ?? finisher.lane ?? "-") : "-";
		const name = finisher ? readText(finisher.name) || readText(finisher.playerName) || readText(finisher.boatRacerName) : "";
		const time = finisher?.raceTime ? ` ${finisher.raceTime}` : "";
		return `${rank}着: ${frame}${name ? ` ${name}` : ""}${time}`;
	}).join("\n");
}

type ReviewExhibitionRow = {
	frameNo: number;
	playerName: string;
	exhibitionTime: string;
	oneLapTime: string;
	turnTime: string;
	straightTime: string;
	startTiming: string;
	course: string;
};

function mergeReviewExhibitionRows(
	rowsByFrame: Map<number, ReviewExhibitionRow>,
	rows: unknown,
): void {
	for (const record of toReviewRecordArray(rows)) {
		const frameNo = readFrameNo(record);
		if (!frameNo) continue;
		const current = rowsByFrame.get(frameNo) ?? {
			frameNo,
			playerName: "",
			exhibitionTime: "",
			oneLapTime: "",
			turnTime: "",
			straightTime: "",
			startTiming: "",
			course: "",
		};
		rowsByFrame.set(frameNo, {
			frameNo,
			playerName: current.playerName || readFirstText(record, ["playerName", "racerName", "name", "boatRacerName"]),
			exhibitionTime: current.exhibitionTime || readFirstText(record, ["exhibitionTime", "displayTime", "tenjiTime", "exhibition", "展示", "展示タイム"]),
			oneLapTime: current.oneLapTime || readFirstText(record, ["oneLapTime", "lapTime", "roundTime", "oneLap", "lap", "一周"]),
			turnTime: current.turnTime || readFirstText(record, ["turnTime", "turningTime", "turn", "mawariashi", "回り足"]),
			straightTime: current.straightTime || readFirstText(record, ["straightTime", "straight", "chokuren", "直線"]),
			startTiming: current.startTiming || readFirstText(record, ["startTiming", "stDisplay", "st"]),
			course: current.course || readFirstText(record, ["course", "entryCourse", "approachCourse"]),
		});
	}
}

function buildReviewExhibitionRows(race?: BoatRaceItem, raceExtra?: BoatVenueExtraRace | null): ReviewExhibitionRow[] {
	const rowsByFrame = new Map<number, ReviewExhibitionRow>();
	const officialBeforeInfo = isReviewRecord(raceExtra?.officialBeforeInfo) ? raceExtra.officialBeforeInfo : null;

	mergeReviewExhibitionRows(rowsByFrame, race?.exhibitions);
	mergeReviewExhibitionRows(rowsByFrame, race?.startExhibition);
	mergeReviewExhibitionRows(rowsByFrame, officialBeforeInfo?.exhibitionRows);
	mergeReviewExhibitionRows(rowsByFrame, officialBeforeInfo?.beforeInfo);
	mergeReviewExhibitionRows(rowsByFrame, officialBeforeInfo?.startExhibition);
	mergeReviewExhibitionRows(rowsByFrame, raceExtra?.beforeInfo);
	mergeReviewExhibitionRows(rowsByFrame, raceExtra?.startExhibition);
	mergeReviewExhibitionRows(rowsByFrame, raceExtra?.originalExhibition);

	return Array.from(rowsByFrame.values()).sort((a, b) => a.frameNo - b.frameNo);
}

function getStandardExhibitionCount(race?: BoatRaceItem, raceExtra?: BoatVenueExtraRace | null): number {
	return buildReviewExhibitionRows(race, raceExtra).filter((row) => Boolean(row.exhibitionTime)).length;
}

function getOriginalExhibitionStatus(
	venueExtra?: BoatVenueExtraVenue | null,
	raceExtra?: BoatVenueExtraRace | null,
): string {
	const rows = toReviewRecordArray(raceExtra?.originalExhibition);
	if (rows.length > 0) return `${rows.length}/6`;
	const raceStatus = isReviewRecord(raceExtra?.sourceStatus) ? readText(raceExtra.sourceStatus.originalExhibition) : "";
	const venueStatus = isReviewRecord(venueExtra?.sourceStatus) ? readText(venueExtra.sourceStatus.originalExhibition) : "";
	if (raceStatus === "not-supported" || venueStatus === "not-supported") return "公式非掲載";
	const status = raceStatus || venueStatus;
	if (status === "unpublished" || status === "not-published" || status === "pending" || status === "waiting" || status.startsWith("pending-")) {
		return "未取得";
	}
	return "未取得";
}

function formatExhibitionDetails(
	race?: BoatRaceItem,
	raceExtra?: BoatVenueExtraRace | null,
): string {
	const racersByFrame = new Map((race?.racers ?? []).map((racer) => [Number(racer.frameNo ?? racer.boatNo), racer]));
	const rows = buildReviewExhibitionRows(race, raceExtra);
	if (rows.length === 0) return "未取得";
	return rows.map((row) => {
		const racer = racersByFrame.get(row.frameNo);
		const exhibitionPlayerName = /^枠[1-6]$/.test(row.playerName) ? "" : row.playerName;
		const values = [
			`${row.frameNo}号艇 ${racer?.name || exhibitionPlayerName || "選手名未取得"}`,
			`展示 ${row.exhibitionTime || "未取得"}`,
		];
		if (row.oneLapTime) values.push(`一周 ${row.oneLapTime}`);
		if (row.turnTime) values.push(`回り足 ${row.turnTime}`);
		if (row.straightTime) values.push(`直線 ${row.straightTime}`);
		values.push(`ST ${row.startTiming || "未取得"}`);
		values.push(`コース ${row.course || "未取得"}`);
		return values.join(" / ");
	}).join("\n");
}

function getExhibitionStartRows(race?: BoatRaceItem, raceExtra?: BoatVenueExtraRace | null): ReviewRecord[] {
	const officialBeforeInfo = isReviewRecord(raceExtra?.officialBeforeInfo) ? raceExtra.officialBeforeInfo : null;
	const sources = [
		race?.startExhibition,
		officialBeforeInfo?.startExhibition,
		officialBeforeInfo?.beforeInfo,
		raceExtra?.startExhibition,
		raceExtra?.beforeInfo,
	];
	const byCourse = new Map<number, ReviewRecord>();
	for (const source of sources) {
		for (const row of toReviewRecordArray(source)) {
			const course = Number(row.course ?? row.entryCourse ?? row.approachCourse ?? row.courseNo);
			if (Number.isInteger(course) && course >= 1 && course <= 6 && !byCourse.has(course)) byCourse.set(course, row);
		}
	}
	return Array.from(byCourse.entries()).sort(([a], [b]) => a - b).map(([, row]) => row);
}

function formatStartRows(rows: ReviewRecord[], emptyText: string): string {
	if (rows.length === 0) return emptyText;
	return rows.map((row) => {
		const course = readFirstText(row, ["course", "entryCourse", "approachCourse", "courseNo"]) || "-";
		const frame = readFirstText(row, ["frameNo", "frame", "boatNumber", "boatNo", "lane"]) || "-";
		const st = readFirstText(row, ["stDisplay", "startTiming", "st"]) || "-";
		const flag = readFirstText(row, ["flag", "note"]);
		return `${course}コース:${frame}号艇 ST${st}${flag ? ` ${flag}` : ""}`;
	}).join(" / ");
}

function formatResultStartInfo(result?: BoatRaceResult): string {
	const rows = toReviewRecordArray(result?.startInfo ?? result?.startInfos);
	return formatStartRows(rows, "未取得");
}

function formatStartFlags(result?: BoatRaceResult): string {
	const rows = toReviewRecordArray(result?.startInfo ?? result?.startInfos);
	const flags = rows.flatMap((row) => {
		const frame = readFirstText(row, ["frameNo", "frame", "boatNumber", "boatNo", "lane"]) || "-";
		const flag = readFirstText(row, ["flag", "note"]);
		return flag ? [`${frame}号艇 ${flag}`] : [];
	});
	return flags.length > 0 ? flags.join(" / ") : "なし";
}

function parseOddsValue(value: unknown): number | null {
	const normalized = String(value ?? "").normalize("NFKC").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
	if (!normalized) return null;
	const parsed = Number(normalized[0]);
	return Number.isFinite(parsed) ? parsed : null;
}

function formatOddsItem(item: BoatOddsItem | BoatOddsTopItem | undefined): string {
	return item ? `${item.combination || "-"} / ${item.odds || "-"}倍` : "未取得";
}

function formatOddsSummary(race?: BoatRaceItem, finishOrder?: string, raceExtra?: BoatVenueExtraRace | null): string {
	const finalOdds = race?.result?.finalOdds;
	const allRows: BoatOddsItem[] = finalOdds?.trifectaAll ?? [];
	const finalTop: BoatOddsTopItem[] = finalOdds?.trifectaTop ?? [];
	const racePreview = race?.oddsPreview as { trifectaAll?: BoatOddsItem[]; trifectaTop?: BoatOddsTopItem[] } | undefined;
	const venuePreview = raceExtra?.oddsPreview as { trifectaAll?: BoatOddsItem[]; trifectaTop?: BoatOddsTopItem[] } | undefined;
	const previewTop: Array<(BoatOddsItem | BoatOddsTopItem) & { updatedAt?: string; fetchedAt?: string }> =
		racePreview?.trifectaTop
		?? racePreview?.trifectaAll
		?? venuePreview?.trifectaTop
		?? venuePreview?.trifectaAll
		?? [];
	const rows = allRows.length > 0 ? allRows : finalTop.length > 0 ? finalTop : previewTop;
	const sorted = rows
		.map((item) => ({ item, value: parseOddsValue(item.odds) }))
		.filter((item): item is { item: BoatOddsItem | BoatOddsTopItem; value: number } => item.value !== null)
		.sort((a, b) => a.value - b.value);
	const isFull = allRows.length === 120;
	const category = isFull ? "最終全件" : allRows.length > 0 || finalTop.length > 0 ? "最終上位のみ" : previewTop.length > 0 ? "発売中参考" : "未取得";
	const minimumLabel = isFull ? "全120通り最低オッズ" : rows.length > 0 ? "取得範囲内最低オッズ" : "最低オッズ";
	const maximumLabel = isFull ? "全120通り最高オッズ" : rows.length > 0 ? "取得範囲内最高オッズ" : "最高オッズ";
	const actual = isFull && finishOrder ? allRows.find((item) => item.combination === finishOrder) : undefined;
	const updatedAt = finalOdds?.updatedAt
		|| finalTop[0]?.updatedAt
		|| finalTop[0]?.fetchedAt
		|| previewTop[0]?.updatedAt
		|| previewTop[0]?.fetchedAt
		|| "未取得";
	const source = allRows[0]?.source || finalTop[0]?.source || previewTop[0]?.source || "未取得";
	const popularRowsWithRank = rows
		.slice()
		.sort((a, b) => readNumber(a.popularity) - readNumber(b.popularity))
		.filter((item) => readNumber(item.popularity) > 0)
		.slice(0, 5)
		.map((item) => `${item.popularity}人気 ${item.combination} / ${item.odds}倍`)
		.join(" / ");
	const popularRows = popularRowsWithRank || sorted.slice(0, 5)
		.map((item, index) => `${index + 1}番手 ${item.item.combination} / ${item.item.odds}倍`)
		.join(" / ");

	return [
		`取得区分: ${category}`,
		`取得件数: ${rows.length}`,
		`${minimumLabel}: ${formatOddsItem(sorted[0]?.item)}`,
		`${maximumLabel}: ${formatOddsItem(sorted.length > 0 ? sorted[sorted.length - 1].item : undefined)}`,
		...(isFull ? [] : [`全120通り最低オッズ: ${rows.length > 0 ? "判定不可" : "未取得"}`]),
		`実着順オッズ: ${formatOddsItem(actual)}`,
		`人気上位: ${popularRows || "未取得"}`,
		`取得時点: ${updatedAt}`,
		`取得元: ${source === "未取得" && rows.length > 0 ? "today-race-details.generated.json" : source}`,
	].join("\n");
}

function getEquipmentFallbackByFrame(raceExtra?: BoatVenueExtraRace | null): Map<number, ReviewRecord> {
	const officialBeforeInfo = isReviewRecord(raceExtra?.officialBeforeInfo) ? raceExtra.officialBeforeInfo : null;
	const sources = [
		officialBeforeInfo?.scoreQuickLook,
		raceExtra?.entryTable,
		raceExtra?.motorSummary,
		raceExtra?.originalExhibition,
	];
	const map = new Map<number, ReviewRecord>();
	for (const source of sources) {
		for (const row of toReviewRecordArray(source)) {
			const frameNo = readFrameNo(row);
			if (!frameNo) continue;
			map.set(frameNo, { ...(map.get(frameNo) ?? {}), ...row });
		}
	}
	return map;
}

function formatEquipment(race?: BoatRaceItem, raceExtra?: BoatVenueExtraRace | null): string {
	const racers = race?.racers ?? [];
	const racersByFrame = new Map(racers.map((racer) => [Number(racer.frameNo ?? racer.boatNo), racer]));
	const fallbackByFrame = getEquipmentFallbackByFrame(raceExtra);
	if (racers.length === 0 && fallbackByFrame.size === 0) return "未取得";
	return Array.from({ length: 6 }, (_, index) => {
		const frameNo = index + 1;
		const racer = racersByFrame.get(frameNo);
		const fallback = fallbackByFrame.get(frameNo);
		const name = racer?.name || readFirstText(fallback, ["playerName", "racerName", "name"]) || "選手名未取得";
		const motorNo = racer?.motorNo || readFirstText(fallback, ["motorNo"]) || "未取得";
		const motorSecondRate = racer?.motorSecondRate || readFirstText(fallback, ["motorSecondRate"]) || "未取得";
		const boatNo = racer?.boatMotorNo || readFirstText(fallback, ["boatNo", "boatMotorNo"]) || "未取得";
		const boatSecondRate = racer?.boatSecondRate || readFirstText(fallback, ["boatSecondRate"]) || "未取得";
		return `${frameNo}号艇 ${name} / モーター ${motorNo} / モーター2連率 ${motorSecondRate} / ボート ${boatNo} / ボート2連率 ${boatSecondRate}`;
	}).join("\n");
}

function formatRacers(race?: BoatRaceItem): string {
	const racers = race?.racers ?? [];
	if (racers.length === 0) return Array.from({ length: 6 }, (_, index) => `${index + 1}　選手未取得`).join("\n");
	return racers.slice().sort((a, b) => Number(a.frameNo ?? a.boatNo ?? 99) - Number(b.frameNo ?? b.boatNo ?? 99))
		.map((racer: BoatRacerItem) => `${racer.frameNo ?? racer.boatNo ?? "-"}　${racer.name || "選手名未取得"}`).join("\n");
}

export function getBoatReviewVenueMetrics(group: BoatReviewVenueGroup): BoatReviewVenueMetrics {
	const predictionCoverage = getBoatReviewPredictionCoverage(group);
	const predictionCount = predictionCoverage.savedCount ?? 0;
	const resultCount = group.resultFileText ? 12 : group.races.filter((entry) => {
		const status = entry.race?.result?.status;
		return status === "confirmed" || Boolean(getFinishOrderText(entry.race, entry.practiceResult));
	}).length;
	const practiceCount = group.races.filter((entry) => entry.practiceResult).length;
	const financialEntries = group.races.filter((entry) => entry.practiceResult && !isBoatPracticePayoutPending(entry.practiceResult));
	const investment = financialEntries.reduce((sum, entry) => sum + readNumber(entry.practiceResult?.investmentAmount ?? entry.practiceResult?.totalStakeYen), 0);
	const payout = financialEntries.reduce((sum, entry) => sum + readNumber(entry.practiceResult?.payoutAmount ?? entry.practiceResult?.payoutYen), 0);
	const hitCount = group.races.filter((entry) => getReviewPredictionOutcomeStatus(entry) === "hit").length;
	const profit = payout - investment;
	const roi = investment > 0 ? payout / investment * 100 : 0;

	return {
		predictionCount,
		resultCount,
		practiceCount,
		hitCount,
		investment,
		payout,
		profit,
		roi,
		hasSummary: Boolean(group.summaryFileText),
	};
}

function parseArchivePredictionCoverage(text: string): BoatReviewPredictionCoverage {
	const sectionMatches = Array.from(text.matchAll(/^■\s+.+?\s+([1-9]|1[0-2])R\s*$/gm));
	if (sectionMatches.length === 0) {
		return { status: "unknown", savedCount: null, totalCount: 12, missingRaceNos: [] };
	}
	const saved = new Set<number>();
	for (const [index, match] of sectionMatches.entries()) {
		const start = match.index ?? 0;
		const end = sectionMatches[index + 1]?.index ?? text.length;
		const section = text.slice(start, end);
		if (!/(?:^|\n)\s*予想未保存\s*(?:\n|$)/.test(section)) saved.add(Number(match[1]));
	}
	return {
		status: "known",
		savedCount: saved.size,
		totalCount: 12,
		missingRaceNos: Array.from({ length: 12 }, (_, index) => index + 1).filter((raceNo) => !saved.has(raceNo)),
	};
}

export function getBoatReviewPredictionCoverage(group: BoatReviewVenueGroup): BoatReviewPredictionCoverage {
	if (group.predictionFileText?.trim()) return parseArchivePredictionCoverage(group.predictionFileText);
	const savedRaceNos = new Set(
		group.races
			.filter((entry) => Boolean(entry.prediction?.predictionText?.trim()))
			.map((entry) => entry.raceNo),
	);
	return {
		status: "known",
		savedCount: savedRaceNos.size,
		totalCount: 12,
		missingRaceNos: Array.from({ length: 12 }, (_, index) => index + 1).filter((raceNo) => !savedRaceNos.has(raceNo)),
	};
}

function formatMissingPredictionRaceNos(raceNos: number[]): string {
	if (raceNos.length === 12 && raceNos.every((raceNo, index) => raceNo === index + 1)) return "1R〜12R";
	return raceNos.map((raceNo) => `${raceNo}R`).join("・");
}

export function getBoatReviewResultCoverage(
	group: BoatReviewVenueGroup,
	venueExtra?: BoatVenueExtraVenue | null,
): BoatReviewResultCoverage {
	if (group.resultFileText?.trim()) {
		return { confirmedCount: 0, exhibitionCompleteCount: 0, totalCount: 12 };
	}
	return {
		confirmedCount: group.races.filter((entry) =>
			entry.race?.result?.status === "confirmed" || Boolean(getFinishOrderText(entry.race, entry.practiceResult)),
		).length,
		exhibitionCompleteCount: group.races.filter((entry) =>
			getStandardExhibitionCount(entry.race, getVenueExtraRace(venueExtra, entry.raceNo)) === 6,
		).length,
		totalCount: 12,
	};
}

export function buildBoatPredictionSummaryText(group: BoatReviewVenueGroup): string {
	if (group.predictionFileText?.trim()) return group.predictionFileText;

	const header = `${group.venueName}｜${formatDateJa(group.date)}｜予想まとめ`;
	const coverage = getBoatReviewPredictionCoverage(group);
	const coverageLines = [
		`予想保存状況: ${coverage.savedCount ?? 0}/${coverage.totalCount}`,
		`未保存レース: ${coverage.missingRaceNos.length > 0 ? formatMissingPredictionRaceNos(coverage.missingRaceNos) : "なし"}`,
	];
	const sections = group.races.map((entry) => {
		const predictionText = entry.prediction?.predictionText?.trim();
		return [
			`■ ${group.venueName} ${entry.raceNo}R`,
			"【読み込み証跡】",
			"会場特徴ノート：読み込み済み",
			"Venue Official Extras：読み込み済み",
			"MY ANALYSIS LOG：未登録",
			`資料日付：${group.date}`,
			"",
			`${group.venueName}　${entry.raceNo}R　締切 ${entry.race?.deadlineTime || "未取得"}　発走 ${entry.race?.startTime || "未取得"}`,
			"",
			"【出走表】",
			formatRacers(entry.race),
			"",
			predictionText ? "【保存済みGPT予想】" : "【保存済みGPT予想】",
			predictionText || "予想未保存",
		].join("\n");
	});

	return [header, ...coverageLines, "", ...sections.flatMap((section) => [section, "----"])].join("\n");
}

export function buildBoatResultSummaryText(
	group: BoatReviewVenueGroup,
	options: BoatReviewResultSummaryOptions = {},
): string {
	if (group.resultFileText?.trim()) return group.resultFileText;

	const header = `${group.venueName}｜${formatDateJa(group.date)}｜結果照合用`;
	const sections = group.races.map((entry) => {
		const result = entry.race?.result;
		const raceExtra = getVenueExtraRace(options.venueExtra, entry.raceNo);
		const finishOrder = getFinishOrderText(entry.race, entry.practiceResult);
		const resultStatus = result?.status === "confirmed" || finishOrder
			? "確定"
			: result
				? "未確定"
				: "未取得";
		const hit = getReviewPredictionOutcomeStatus(entry);
		const payoutPending = isBoatPracticePayoutPending(entry.practiceResult);
		const investment = readNumber(entry.practiceResult?.investmentAmount ?? entry.practiceResult?.totalStakeYen);
		const payout = readNumber(entry.practiceResult?.payoutAmount ?? entry.practiceResult?.payoutYen);
		const profit = payoutPending ? 0 : payout - investment;
		const roi = !payoutPending && investment > 0 ? payout / investment * 100 : 0;
		const kimarite = result?.kimarite ?? result?.winningMethod ?? result?.winningMove ?? entry.practiceResult?.kimarite ?? "未取得";
		const hitBets = entry.practiceResult?.hitBets ?? [];
		const exhibitions = buildReviewExhibitionRows(entry.race, raceExtra);
		const standardExhibitionCount = exhibitions.filter((row) => Boolean(row.exhibitionTime)).length;
		const originalExhibitionStatus = getOriginalExhibitionStatus(options.venueExtra, raceExtra);
		const resultStartCount = toReviewRecordArray(result?.startInfo ?? result?.startInfos).length;
		const weather = result?.weatherActual ?? entry.race?.weatherActual ?? group.venue?.weatherActual;
		const finalOdds = entry.race?.result?.finalOdds;
		const oddsStatus = finalOdds?.trifectaAll?.length === 120
			? "最終全件"
			: (finalOdds?.trifectaAll?.length ?? 0) > 0 || (finalOdds?.trifectaTop?.length ?? 0) > 0
				? "最終上位のみ"
				: (((entry.race?.oddsPreview as { trifectaTop?: BoatOddsTopItem[] } | undefined)?.trifectaTop?.length ?? 0) > 0 ? "発売中参考" : "未取得");

		if (!entry.race && !entry.practiceResult) {
			return [`■ ${group.venueName} ${entry.raceNo}R`, "結果未取得"].join("\n");
		}

		return [
			`■ ${group.venueName} ${entry.raceNo}R`,
			"",
			"【取得状況】",
			`結果: ${resultStatus}`,
			`展示タイム: ${standardExhibitionCount}/6`,
			`会場独自展示: ${originalExhibitionStatus}`,
			`ST情報: ${resultStartCount}/6`,
			`天候: ${weather ? "取得済み" : "未取得"}`,
			`オッズ: ${oddsStatus}`,
			"",
			"【レース基本情報】",
			`レース名: ${entry.race?.title || entry.practiceResult?.raceTitle || `${entry.raceNo}R`}`,
			`締切時刻: ${entry.race?.deadlineTime || "未取得"}`,
			`発走時刻: ${entry.race?.startTime || "未取得"}`,
			`着順: ${finishOrder || "未取得"}`,
			`決まり手: ${kimarite}`,
			"",
			"【予想照合・収支】",
			`最終判定: ${hit}`,
			`的中券種: ${entry.practiceResult?.hitBetType || hitBets[0]?.type || "未保存"}`,
			`的中組み合わせ: ${entry.practiceResult?.hitBetNumbers ? String(entry.practiceResult.hitBetNumbers) : hitBets[0]?.normalized || "未保存"}`,
			`投資: ${entry.practiceResult ? yen(investment) : "未保存"}`,
			`払戻: ${entry.practiceResult ? payoutPending ? "払戻取得待ち" : yen(payout) : "未保存"}`,
			`収支: ${entry.practiceResult ? payoutPending ? "算出待ち" : signedYen(profit) : "未保存"}`,
			`回収率: ${entry.practiceResult ? payoutPending ? "算出待ち" : percent(roi) : "未保存"}`,
			"",
			"【WEATHER ACTUAL】",
			formatWeather(result, entry.race, group.venue),
			"",
			"【展示詳細】",
			formatExhibitionDetails(entry.race, raceExtra),
			"",
			"【進入・ST】",
			`展示進入: ${formatStartRows(getExhibitionStartRows(entry.race, raceExtra), "未取得")}`,
			`結果ST: ${formatResultStartInfo(result)}`,
			`S/H/B: ${formatStartFlags(result)}`,
			"",
			"【出走・機材】",
			formatEquipment(entry.race, raceExtra),
			"",
			"【全着順】",
			formatFinishers(result),
			"",
			"【払戻】",
			formatPayoutLine("3連単", result, /3\s*連\s*単|3連単|trifecta|sanrentan/),
			formatPayoutLine("2連単", result, /2\s*連\s*単|2連単|exacta|nirentan/),
			formatPayoutLine("2連複", result, /2\s*連\s*複|2連複|quinella/),
			formatPayoutLine("3連複", result, /3\s*連\s*複|3連複|trio/),
			formatPayoutLine("拡連複", result, /拡\s*連\s*複|拡連複|wide/),
			"",
			"【3連単オッズ要約】",
			formatOddsSummary(entry.race, finishOrder, raceExtra),
			"",
			"【結果メモ】",
			"自動取得結果",
			`払戻取得元: ${group.venue?.source || "today-race-details.generated.json"}`,
		].join("\n");
	});

	return [header, "", ...sections.flatMap((section) => [section, "----"])].join("\n");
}
