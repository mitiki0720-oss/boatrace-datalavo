import { judgeBoatPredictionHit } from "./boatHitJudge";
import type { BoatPracticeResultRecord } from "./boatPracticeResultStorage";
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

function readNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string") {
		const parsed = Number(value.normalize("NFKC").replace(/[^\d.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
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

function formatStartInfo(result?: BoatRaceResult): string {
	const rows = result?.startInfo ?? result?.startInfos ?? [];
	if (!Array.isArray(rows) || rows.length === 0) return "S/H/B: 未取得";
	return `S/H/B: ${rows.map((item) => `${item.course ?? item.entryCourse ?? "-"}:${item.frameNo ?? item.frame ?? item.boatNumber ?? "-"} ST${item.stDisplay ?? item.startTiming ?? item.st ?? "-"}`).join(" / ")}`;
}

function formatOdds(race?: BoatRaceItem): string {
	const finalOdds = race?.result?.finalOdds;
	const topRows: BoatOddsTopItem[] = [
		...(finalOdds?.trifectaTop ?? []),
		...((race?.oddsPreview as { trifectaTop?: BoatOddsTopItem[] } | undefined)?.trifectaTop ?? []),
	];
	if (topRows.length > 0) {
		return topRows.slice(0, 20).map((item) => `${item.popularity ? `${item.popularity}人気 ` : ""}${item.combination}: ${item.odds}`).join("\n");
	}
	const allRows: BoatOddsItem[] = finalOdds?.trifectaAll ?? [];
	if (allRows.length > 0) {
		return allRows.slice(0, 30).map((item) => `${item.popularity ? `${item.popularity}人気 ` : ""}${item.combination}: ${item.odds}`).join("\n");
	}
	return "未取得";
}

function formatRacers(race?: BoatRaceItem): string {
	const racers = race?.racers ?? [];
	if (racers.length === 0) {
		return Array.from({ length: 6 }, (_, index) => `${index + 1}　選手未取得`).join("\n");
	}
	return racers
		.slice()
		.sort((a, b) => Number(a.frameNo ?? a.boatNo ?? 99) - Number(b.frameNo ?? b.boatNo ?? 99))
		.map((racer: BoatRacerItem) => `${racer.frameNo ?? racer.boatNo ?? "-"}　${racer.name || "選手名未取得"}`)
		.join("\n");
}

export function getBoatReviewVenueMetrics(group: BoatReviewVenueGroup): BoatReviewVenueMetrics {
	const predictionCount = group.predictionFileText ? 12 : group.races.filter((entry) => entry.prediction?.predictionText).length;
	const resultCount = group.resultFileText ? 12 : group.races.filter((entry) => {
		const status = entry.race?.result?.status;
		return status === "confirmed" || Boolean(getFinishOrderText(entry.race, entry.practiceResult));
	}).length;
	const practiceCount = group.races.filter((entry) => entry.practiceResult).length;
	const investment = group.races.reduce((sum, entry) => sum + readNumber(entry.practiceResult?.investmentAmount ?? entry.practiceResult?.totalStakeYen), 0);
	const payout = group.races.reduce((sum, entry) => sum + readNumber(entry.practiceResult?.payoutAmount ?? entry.practiceResult?.payoutYen), 0);
	const hitCount = group.races.filter((entry) => {
		if (readNumber(entry.practiceResult?.payoutAmount ?? entry.practiceResult?.payoutYen) > 0) return true;
		const order = getFinishOrderText(entry.race, entry.practiceResult);
		return judgeBoatPredictionHit({ tickets: entry.prediction?.tickets ?? [], actualFinishOrderText: order }).status === "hit";
	}).length;
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

export function buildBoatPredictionSummaryText(group: BoatReviewVenueGroup): string {
	if (group.predictionFileText?.trim()) return group.predictionFileText;

	const header = `${group.venueName}｜${formatDateJa(group.date)}｜予想まとめ`;
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

	return [header, "", ...sections.flatMap((section) => [section, "----"])].join("\n");
}

export function buildBoatResultSummaryText(group: BoatReviewVenueGroup): string {
	if (group.resultFileText?.trim()) return group.resultFileText;

	const header = `${group.venueName}｜${formatDateJa(group.date)}｜結果照合用`;
	const sections = group.races.map((entry) => {
		const result = entry.race?.result;
		const finishOrder = getFinishOrderText(entry.race, entry.practiceResult);
		const status = result?.status === "confirmed" || finishOrder ? "confirmed" : result?.status ?? "pending";
		const hit = entry.practiceResult?.resultStatus ?? judgeBoatPredictionHit({
			tickets: entry.prediction?.tickets ?? [],
			actualFinishOrderText: finishOrder,
		}).status;
		const investment = readNumber(entry.practiceResult?.investmentAmount ?? entry.practiceResult?.totalStakeYen);
		const payout = readNumber(entry.practiceResult?.payoutAmount ?? entry.practiceResult?.payoutYen);
		const profit = payout - investment;
		const roi = investment > 0 ? payout / investment * 100 : 0;
		const kimarite = result?.kimarite ?? result?.winningMethod ?? result?.winningMove ?? entry.practiceResult?.kimarite ?? "未取得";
		const hitBets = entry.practiceResult?.hitBets ?? [];

		if (!entry.race && !entry.practiceResult) {
			return [`■ ${group.venueName} ${entry.raceNo}R`, "結果未取得"].join("\n");
		}

		return [
			`■ ${group.venueName} ${entry.raceNo}R`,
			`レース名: ${entry.race?.title || entry.practiceResult?.raceTitle || `${entry.raceNo}R`}`,
			`締切時刻: ${entry.race?.deadlineTime || "未取得"}`,
			`発走時刻: ${entry.race?.startTime || "未取得"}`,
			`結果確定: ${status}`,
			`着順: ${finishOrder || "未取得"}`,
			`3連単照合キー: ${finishOrder || "未取得"}`,
			`最終判定: ${hit}`,
			`的中券種: ${entry.practiceResult?.hitBetType || hitBets[0]?.type || "未保存"}`,
			`的中組み合わせ: ${entry.practiceResult?.hitBetNumbers ? String(entry.practiceResult.hitBetNumbers) : hitBets[0]?.normalized || "未保存"}`,
			`投資: ${entry.practiceResult ? yen(investment) : "未保存"}`,
			`払戻: ${entry.practiceResult ? yen(payout) : "未保存"}`,
			`収支: ${entry.practiceResult ? signedYen(profit) : "未保存"}`,
			`回収率: ${entry.practiceResult ? percent(roi) : "未保存"}`,
			"",
			"【決まり手】",
			`決まり手: ${kimarite}`,
			formatStartInfo(result),
			"",
			"【WEATHER ACTUAL】",
			formatWeather(result, entry.race, group.venue),
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
			"【最終オッズ参考】",
			formatOdds(entry.race),
			"",
			"【結果メモ】",
			"自動取得結果",
			`決まり手: ${kimarite}`,
			`払戻取得元: ${entry.race?.memo || result?.remarks || result?.notes || group.venue?.source || "today-race-details.generated.json"}`,
		].join("\n");
	});

	return [header, "", ...sections.flatMap((section) => [section, "----"])].join("\n");
}
