import type { BoatRaceItem, BoatRacerItem, BoatTodayFeed, BoatTodayVenueItem } from "./boatraceTypes";
import type {
	BoatExHistoricalRaceAnalysisDateFile,
	BoatExHistoricalRaceAnalysisIndexFile,
	BoatExRaceAnalysisFile,
	BoatExRaceAnalysisItem,
	BoatExVenueEvidenceFile,
	BoatExVenueEvidenceItem,
} from "./boatExTypes";
import { withBasePath } from "./assetPath";
import { getBoatPredictionRaceTimeLabel, type BoatPredictionVenueTimeKind } from "./boatPredictionGptCopy";
import {
	getBoatPredictionExhibitionAvailability,
	resolveBoatPredictionWeatherReference,
} from "./boatPredictionMaterial";
import type { BoatVenueExtraRace, BoatVenueExtraVenue } from "./boatVenueExtrasFeed";

type JsonRecord = Record<string, unknown>;

export type BoatPredictionGptCopyExContext = {
	requestedDate: string;
	generatedAt: string | null;
	auditPath: string | null;
	raceAnalysis: BoatExRaceAnalysisItem[];
	registeredIdentities: Array<{
		registrationNo: string;
		appearanceCount: number;
		firstSeenDate: string;
		lastSeenDate: string;
	}>;
	racerFeatures: Array<{
		registrationNo: string;
		name: string;
		historyStarts: number;
		sampleLevel: string;
		venues: Array<{ venueCode: string; starts: number; sampleLevel: string }>;
		frames: Array<{ frameNo: number; starts: number; sampleLevel: string }>;
		startTiming: { sampleCount: number; average: number | null; sampleLevel: string };
		winMethodCounts: Record<string, number>;
		recent: { last5: { starts: number; averageST: number | null }; last10: { starts: number; averageST: number | null } };
	}>;
	currentDayPredictionCoverage: JsonRecord | null;
	venueBias: JsonRecord | null;
	roughIndex: JsonRecord | null;
	todayFlow: JsonRecord | null;
	venueEvidence: BoatExVenueEvidenceFile | null;
	venueEvidencePath: string;
	venueEvidenceDate: string | null;
	weatherWaterHistory: JsonRecord | null;
	weatherWaterHistoryPath: string;
	venueRaceBandHistory: JsonRecord | null;
	decisionMethodHistory: JsonRecord | null;
	entryShiftHistory: JsonRecord | null;
	motorBoatHistory: JsonRecord | null;
};

export type BoatPredictionGptCopyExReferenceLevel = "A" | "B" | "C" | "D" | "unknown";

export type BoatPredictionGptCopyExReference = {
	level: BoatPredictionGptCopyExReferenceLevel;
	linkedCount: number;
	racerCount: number;
	officialRegistrationLinkedCount: number;
	exactNameLinkedCount: number;
	unresolvedCount: number;
	lowSampleCount: number;
	venueExStatus: string;
	venueFeatureStatus: string;
	todayFlowStatus: string;
	raceAnalysisStatus: string;
	weatherSummary: string;
	weatherSource: string;
	weatherObservedAt: string;
	weatherSourceAcquiredAt: string;
	weatherNeedsRefreshCaution: boolean;
	weatherWaterAvailability: "available" | "partial" | "missing" | "unknown";
	historicalLatestDayWeatherAvailability: "available" | "target-date-mismatch" | "unknown";
	historicalExDate: string;
	exhibitionSummary: string;
	cautions: string[];
};

export type BoatPredictionGptCopyExWeatherWaterReference = {
	availability: "available" | "partial" | "missing" | "unknown";
	windWaveAvailability: "available" | "partial" | "missing" | "unknown";
	conditionMatch: string;
	sampleStatus: string;
	weatherCount: number;
	raceCount: number;
	windSpeedAverageMps: number | null;
	windSpeedMaxMps: number | null;
	waveHeightAverageCm: number | null;
	waveHeightMaxCm: number | null;
	sourcePath: string;
	sourceNames: string[];
	historyDateCount: number;
	dateRangeLabel: string;
	currentConditions: { weather: string; windDirection: string; windSpeed: string; waveHeight: string; windSpeedBand: string; waveHeightBand: string };
	conditionCounts: { weather: number; windDirection: number; windSpeedBand: number; waveHeightBand: number };
};

const unavailable = "未取得";

const asRecord = (value: unknown): JsonRecord | null =>
	value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;

const asText = (value: unknown, fallback = unavailable): string => {
	if (value === null || value === undefined) {
		return fallback;
	}

	const text = String(value).trim();
	return text && text !== "null" && text !== "undefined" ? text : fallback;
};

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const readPath = (value: unknown): string | null => {
	const text = asText(value, "");
	return text || null;
};

const readSourceStatus = (source: string | undefined): string => {
	if (source?.toLowerCase().match(/official|boatrace/)) {
		return "official";
	}
	if (source?.trim()) {
		return "user-entered-from-official";
	}

	return "unknown";
};

async function fetchJson<T>(path: string): Promise<T | null> {
	try {
		const response = await fetch(withBasePath(path));
		if (!response.ok) {
			return null;
		}

		return (await response.json()) as T;
	} catch {
		return null;
	}
}

export async function loadBoatPredictionGptCopyExContext(date: string): Promise<BoatPredictionGptCopyExContext> {
	const weatherWaterHistoryPath = "public/data/boatrace-ex/derived/weather-water-history/latest.json";
	const [latest, historyIndex, dateIndex, venueBias, roughIndex, todayFlow, identityRegistry, racerFeaturesFile, currentDayPredictionCoverage, weatherWaterHistory, venueRaceBandHistory, decisionMethodHistory, entryShiftHistory, motorBoatHistory] = await Promise.all([
		fetchJson<BoatExRaceAnalysisFile>("data/boatrace-ex/derived/race-analysis/latest.json"),
		fetchJson<BoatExHistoricalRaceAnalysisIndexFile>("data/boatrace-ex/derived/race-analysis/history-index.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/index.generated.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/venue-bias/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/rough-index/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/today-flow/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/identity/registered-racers.generated.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/racer-features/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/current-day-prediction-coverage/latest.json"),
		fetchJson<JsonRecord>(weatherWaterHistoryPath.replace(/^public\//, "")),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/venue-race-band-history/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/decision-method-history/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/entry-shift-history/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/motor-boat-history/latest.json"),
	]);
	const venueEvidenceDate = asText(dateIndex?.latestDate, "") || null;
	const venueEvidencePath = venueEvidenceDate ? `public/data/boatrace-ex/derived/venue-evidence/${venueEvidenceDate}.json` : "";
	const venueEvidence = venueEvidencePath
		? await fetchJson<BoatExVenueEvidenceFile>(venueEvidencePath.replace(/^public\//, ""))
		: null;
	const latestForDate = latest?.targetDate === date ? latest : null;
	const dateEntry = historyIndex?.dates.find((entry) => entry.date === date);
	const dateFile = !latestForDate && dateEntry?.path
		? await fetchJson<BoatExHistoricalRaceAnalysisDateFile>(dateEntry.path.replace(/^public\//, ""))
		: null;
	const analysisFile = latestForDate ?? dateFile;
	const sourceFiles = analysisFile?.sourceFiles ?? [];
	const auditPath = sourceFiles.find((path) => path.includes("/audit/")) ?? null;

	return {
		requestedDate: date,
		generatedAt: analysisFile?.generatedAt ?? null,
		auditPath,
		raceAnalysis: analysisFile?.races ?? [],
		registeredIdentities: asArray<BoatPredictionGptCopyExContext["registeredIdentities"][number]>(identityRegistry?.identities),
		racerFeatures: asArray<BoatPredictionGptCopyExContext["racerFeatures"][number]>(racerFeaturesFile?.racers),
		currentDayPredictionCoverage,
		venueBias,
		roughIndex,
		todayFlow,
		venueEvidence,
		venueEvidencePath,
		venueEvidenceDate,
		weatherWaterHistory,
		weatherWaterHistoryPath,
		venueRaceBandHistory,
		decisionMethodHistory,
		entryShiftHistory,
		motorBoatHistory,
	};
}

export function buildBoatPredictionGptCopyHeader(params: {
	feed: BoatTodayFeed;
	venue: BoatTodayVenueItem;
	races: BoatRaceItem[];
	raceRangeLabel: string;
	rangePurposeLabel: string;
	venueTimeKind: BoatPredictionVenueTimeKind;
	rangeTimeKind: BoatPredictionVenueTimeKind;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { feed, venue, races, raceRangeLabel, rangePurposeLabel, venueTimeKind, rangeTimeKind, exContext } = params;
	const raceLabels = races.map((race) => `${race.raceNo}R`).join(" / ") || unavailable;
	const sourceName = venue.source ?? feed.source;
	const sourceAcquiredAt = venue.generatedAt ?? feed.generatedAt;
	const hasHistoricalEx = Boolean(
		exContext?.weatherWaterHistory ||
		exContext?.venueBias ||
		exContext?.roughIndex ||
		exContext?.venueRaceBandHistory ||
		exContext?.decisionMethodHistory ||
		exContext?.entryShiftHistory ||
		exContext?.motorBoatHistory,
	);
	const historicalRange = formatDateRange(exContext?.weatherWaterHistory ?? exContext?.venueBias ?? null);

	return [
		"============================================================",
		"GPTへの素材",
		`日付: ${asText(venue.date ?? feed.date)}`,
		`会場: ${asText(venue.venueName)}`,
		`開催・節: ${asText(venue.title)}`,
		`運用日: ${asText(feed.date)}`,
		`対象レース範囲: ${raceRangeLabel}（実在: ${raceLabels}）`,
		`会場時間帯: ${venueTimeKind}`,
		`コピー範囲時間帯: ${rangeTimeKind}`,
		`用途: ${rangePurposeLabel}`,
		"============================================================",
		"このコピー素材のsource:",
		`- source name: ${asText(sourceName)}`,
		`- source acquired at: ${asText(sourceAcquiredAt)}`,
		`- source status: ${readSourceStatus(sourceName)}`,
		`- 対象日EX race-analysis source: ${exContext?.raceAnalysis.length ? "BOATRACE EX race analysis" : unavailable}`,
		`- 対象日EX generatedAt: ${asText(exContext?.generatedAt)}`,
		`- EX履歴source: ${hasHistoricalEx ? "available" : unavailable}`,
		`- EX履歴データ期間: ${historicalRange}`,
		`- EX履歴source種別: ${hasHistoricalEx ? "source-backed derived" : unavailable}`,
		`- EX audit path: ${asText(exContext?.auditPath)}`,
	].join("\n");
}

const readSummaryValue = (file: JsonRecord | null, key: string): string => {
	const summary = asRecord(file?.summary);
	return asText(summary?.[key]);
};

const readReadinessStatus = (file: JsonRecord | null): string =>
	asText(asRecord(file?.readiness)?.status);

export function buildBoatPredictionGptCopyVenueContext(params: {
	venue: BoatTodayVenueItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { venue, exContext } = params;
	const sourceState = exContext?.raceAnalysis.some((race) =>
		(race.venueCode && venue.venueCode && race.venueCode === venue.venueCode) || race.venueName === venue.venueName,
	);
	const venueBiasReadiness = asRecord(exContext?.venueBias?.readiness);
	const roughIndexReadiness = asRecord(exContext?.roughIndex?.readiness);
	const todayFlowReadiness = asRecord(exContext?.todayFlow?.readiness);
	const todayFlowTargetDate = asText(exContext?.todayFlow?.targetDate, "");
	const todayFlowLabel = todayFlowTargetDate && todayFlowTargetDate !== venue.date
		? "EX履歴latest-day flow"
		: "EX当日フロー";
	const todayFlowStatus = todayFlowTargetDate && todayFlowTargetDate === venue.date
		? asText(todayFlowReadiness?.status)
		: exContext ? "対象日不一致" : "unknown";

	return [
		`【EX会場共有情報 / ${venue.venueName}】`,
		`対象日EXレース分析: ${sourceState ? "利用可能" : unavailable}`,
		`EX会場傾向: ${asText(venueBiasReadiness?.status)}`,
		`EX荒れ指数素材: ${asText(roughIndexReadiness?.status)}`,
		`${todayFlowLabel}: ${todayFlowStatus}`,
		`EX当日レース分析: ${sourceState ? "source-backed" : "未取得（当日race-analysis shard未取得）"}`,
		`EX全履歴レース数: ${readSummaryValue(exContext?.venueBias ?? null, "raceCount")}`,
		"EX選手情報: source-backed linkageのみを表示。",
		"注意: EX情報は記録済みのsource-backed availabilityのみ。予測、買い目、結果、払戻の内容はこの素材に追加しない。",
	].join("\n");
}

function findExRace(exContext: BoatPredictionGptCopyExContext | null, venue: BoatTodayVenueItem, race: BoatRaceItem): BoatExRaceAnalysisItem | null {
	if (!exContext) {
		return null;
	}

	return exContext.raceAnalysis.find((item) =>
		item.date === exContext.requestedDate &&
		exContext.requestedDate === venue.date &&
		item.raceNo === Number(race.raceNo) && (
			(venue.venueCode && item.venueCode === venue.venueCode) || item.venueName === venue.venueName
		),
	) ?? null;
}

const findVenueWeatherEvidence = (
	venueEvidence: BoatExVenueEvidenceFile,
	venue: BoatTodayVenueItem,
): BoatExVenueEvidenceItem | null => venueEvidence.venues.find((item) =>
	(Boolean(venue.venueCode) && item.venueCode === venue.venueCode) || item.venueName === venue.venueName,
) ?? null;

const metricLabel = (value: number | null, unit: string): string => value === null ? unavailable : `${value}${unit}`;

const readNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/u)?.[0]);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
};

const percentLabel = (value: unknown): string => {
	const number = readNumber(value);
	return number === null ? unavailable : `${(number * 100).toFixed(1)}%`;
};

const readRecordArray = (value: unknown): JsonRecord[] => asArray<unknown>(value)
	.map(asRecord)
	.filter((item): item is JsonRecord => Boolean(item));

const findDerivedVenue = (file: JsonRecord | null, venue: BoatTodayVenueItem): JsonRecord | null =>
	readRecordArray(file?.venues).find((item) =>
		(Boolean(venue.venueCode) && asText(item.venueId ?? item.venueCode, "") === venue.venueCode) ||
		asText(item.venueName, "") === venue.venueName,
	) ?? null;

const countBoatWins = (sequence: JsonRecord[]): string => {
	const counts = new Map<string, number>();
	for (const item of sequence) {
		const boat = asText(item.firstPlaceBoat, "");
		if (boat) counts.set(boat, (counts.get(boat) ?? 0) + 1);
	}

	return counts.size > 0
		? [...counts.entries()].sort(([left], [right]) => Number(left) - Number(right)).map(([boat, count]) => `${boat}号艇:${count}`).join(" / ")
		: unavailable;
};

const winningTechniqueLabel = (value: unknown): string => {
	const record = asRecord(value);
	if (!record) return unavailable;
	const entries = Object.entries(record).filter(([, count]) => readNumber(count) !== null);
	return entries.length > 0 ? entries.map(([name, count]) => `${name}:${count}`).join(" / ") : unavailable;
};

export function getBoatPredictionGptCopyExWeatherWaterReference(params: {
	venue: BoatTodayVenueItem;
	race?: BoatRaceItem;
	venueExtra?: BoatVenueExtraVenue | null;
	raceExtra?: BoatVenueExtraRace | null;
	exContext: BoatPredictionGptCopyExContext | null;
}): BoatPredictionGptCopyExWeatherWaterReference {
	const { venue, race, venueExtra, raceExtra, exContext } = params;
	const sourcePath = exContext?.weatherWaterHistoryPath ?? "public/data/boatrace-ex/derived/weather-water-history/latest.json";
	if (!exContext) {
		return {
			availability: "unknown",
			windWaveAvailability: "unknown",
			conditionMatch: "未取得（EX context未読込）",
			sampleStatus: "unknown",
			weatherCount: 0,
			raceCount: 0,
			windSpeedAverageMps: null,
			windSpeedMaxMps: null,
			waveHeightAverageCm: null,
			waveHeightMaxCm: null,
			sourcePath,
			sourceNames: [],
			historyDateCount: 0,
			dateRangeLabel: "未取得",
			currentConditions: { weather: unavailable, windDirection: unavailable, windSpeed: unavailable, waveHeight: unavailable, windSpeedBand: "unknown", waveHeightBand: "unknown" },
			conditionCounts: { weather: 0, windDirection: 0, windSpeedBand: 0, waveHeightBand: 0 },
		};
	}

	const history = exContext.weatherWaterHistory;
	const evidence = findDerivedVenue(history, venue);
	const sourceNames = [...new Set(readRecordArray(history?.sourceFiles).map((source) => asText(source.sourceName, "")).filter(Boolean))];
	const dateRange = asRecord(history?.dateRange);
	const historyDateCount = readNumber(dateRange?.dateCount) ?? 0;
	const dateRangeLabel = dateRange ? `${asText(dateRange.from)}〜${asText(dateRange.to)}` : "未取得";
	if (!evidence || !race) {
		return {
			availability: "missing",
			windWaveAvailability: "missing",
			conditionMatch: "未取得（対象レースまたは会場のEX天候・水面履歴なし）",
			sampleStatus: "未取得",
			weatherCount: 0,
			raceCount: 0,
			windSpeedAverageMps: null,
			windSpeedMaxMps: null,
			waveHeightAverageCm: null,
			waveHeightMaxCm: null,
			sourcePath,
			sourceNames,
			historyDateCount,
			dateRangeLabel,
			currentConditions: { weather: unavailable, windDirection: unavailable, windSpeed: unavailable, waveHeight: unavailable, windSpeedBand: "unknown", waveHeightBand: "unknown" },
			conditionCounts: { weather: 0, windDirection: 0, windSpeedBand: 0, waveHeightBand: 0 },
		};
	}

	const weather = resolveBoatPredictionWeatherReference({ venue, race, venueExtra, raceExtra });
	const weatherCount = readNumber(evidence.weatherAvailableRaceCount) ?? 0;
	const raceCount = readNumber(evidence.raceCount) ?? 0;
	const windSpeed = readNumber(weather.windSpeed);
	const waveHeight = readNumber(weather.waveHeight);
	const windSpeedBand = windSpeed === null ? "unknown" : windSpeed <= 2 ? "0-2m" : windSpeed <= 5 ? "3-5m" : "6m+";
	const waveHeightBand = waveHeight === null ? "unknown" : waveHeight <= 2 ? "0-2cm" : waveHeight <= 5 ? "3-5cm" : "6cm+";
	const conditionCounts = {
		weather: readNumber(asRecord(evidence.weatherConditionCounts)?.[weather.weather]) ?? 0,
		windDirection: readNumber(asRecord(evidence.windDirectionCounts)?.[weather.windDirection]) ?? 0,
		windSpeedBand: readNumber(asRecord(evidence.windSpeedBandCounts)?.[windSpeedBand]) ?? 0,
		waveHeightBand: readNumber(asRecord(evidence.waveHeightBandCounts)?.[waveHeightBand]) ?? 0,
	};
	const nonZeroConditionCount = Object.values(conditionCounts).filter((count) => count > 0).length;
	const hasWind = readNumber(evidence.windSpeedAverageMps) !== null || readNumber(evidence.windSpeedMaxMps) !== null;
	const hasWave = readNumber(evidence.waveHeightAverageCm) !== null || readNumber(evidence.waveHeightMaxCm) !== null;
	const windWaveAvailability = hasWind && hasWave ? "available" : hasWind || hasWave ? "partial" : "missing";
	const weatherAvailability = weatherCount > 0 && windWaveAvailability === "available" ? "available" : windWaveAvailability === "missing" ? "missing" : "partial";
	const sampleStatus = weatherCount === 0
		? "未取得"
		: Math.min(...Object.values(conditionCounts)) < 6
			? `LOW SAMPLE (${Math.min(...Object.values(conditionCounts))}R)`
			: nonZeroConditionCount === 4 ? "available" : "partial";

	return {
		availability: weatherAvailability,
		windWaveAvailability,
		conditionMatch: nonZeroConditionCount === 4 ? "available" : nonZeroConditionCount > 0 ? "partial" : "missing",
		sampleStatus,
		weatherCount,
		raceCount,
		windSpeedAverageMps: readNumber(evidence.windSpeedAverageMps),
		windSpeedMaxMps: readNumber(evidence.windSpeedMaxMps),
		waveHeightAverageCm: readNumber(evidence.waveHeightAverageCm),
		waveHeightMaxCm: readNumber(evidence.waveHeightMaxCm),
		sourcePath,
		sourceNames,
		historyDateCount,
		dateRangeLabel,
		currentConditions: { weather: weather.weather, windDirection: weather.windDirection, windSpeed: weather.windSpeed, waveHeight: weather.waveHeight, windSpeedBand, waveHeightBand },
		conditionCounts,
	};
}

export function buildBoatPredictionGptCopyExWeatherWaterBlock(reference: BoatPredictionGptCopyExWeatherWaterReference): string {
	return [
		"【KURARI BOAT EX 天候・水面 履歴】",
		`EX天候・水面履歴: ${reference.availability}`,
		`データ期間: 履歴 ${reference.dateRangeLabel}`,
		`EX風・波データ: ${reference.windWaveAvailability}`,
		`会場履歴レース数: ${reference.raceCount}R`,
		`天候データあり: ${reference.weatherCount}R`,
		`天候coverage: ${reference.raceCount ? ((reference.weatherCount / reference.raceCount) * 100).toFixed(1) : "0.0"}%`,
		`当日条件: 天候 ${reference.currentConditions.weather} / 風向 ${reference.currentConditions.windDirection} / 風速 ${reference.currentConditions.windSpeed} (${reference.currentConditions.windSpeedBand}) / 波高 ${reference.currentConditions.waveHeight} (${reference.currentConditions.waveHeightBand})`,
		`履歴一致: 同天候 ${reference.conditionCounts.weather}R / 同風向 ${reference.conditionCounts.windDirection}R / 同風速帯 ${reference.conditionCounts.windSpeedBand}R / 同波高帯 ${reference.conditionCounts.waveHeightBand}R`,
		`平均風速: ${metricLabel(reference.windSpeedAverageMps, "m/s")} / 最大風速: ${metricLabel(reference.windSpeedMaxMps, "m/s")}`,
		`平均波高: ${metricLabel(reference.waveHeightAverageCm, "cm")} / 最大波高: ${metricLabel(reference.waveHeightMaxCm, "cm")}`,
		`条件一致: ${reference.conditionMatch}`,
		`サンプル: ${reference.sampleStatus}`,
		`参照source: ${reference.sourcePath}`,
		`参照source名: ${reference.sourceNames.map((name) => name === "boatrace-ex-history-races" && reference.historyDateCount > 0 ? `${name} ×${reference.historyDateCount}日` : name).join(" / ") || unavailable}`,
		"注意: EX天候・水面履歴は予想補助であり、買い目スコアではありません。",
	].join("\n");
}

export function buildBoatPredictionGptCopyExHistoricalLatestDayVenueEvidenceBlock(params: {
	venue: BoatTodayVenueItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { venue, exContext } = params;
	const evidenceDate = exContext?.venueEvidenceDate ?? unavailable;
	const isTargetDate = evidenceDate === venue.date;
	return [
		"【KURARI BOAT EX 履歴latest-day venue-evidence】",
		`EX履歴latest日: ${evidenceDate}`,
		`予想対象日: ${venue.date}`,
		`対象日一致: ${isTargetDate ? "yes" : "no"}`,
		"用途: 履歴EXのlatest-day確認用。予想当日の通常素材coverageではありません。",
		`source: ${exContext?.venueEvidencePath || "public/data/boatrace-ex/derived/venue-evidence/<date>.json"}`,
	].join("\n");
}

const formatDateRange = (file: JsonRecord | null): string => {
	const range = asRecord(file?.dateRange);
	return range ? `${asText(range.from)} ～ ${asText(range.to)}` : unavailable;
};

const bandForRace = (raceNo: unknown): string => (readNumber(raceNo) ?? 0) <= 6 ? "1R-6R" : "7R-12R";
const shortRate = (value: unknown): string => percentLabel(value);
const profileFor = (entries: unknown, key: string): JsonRecord | null =>
	readRecordArray(entries).find((entry) => asText(entry.key, "") === key) ?? null;

export function buildBoatPredictionGptCopyExUsefulSignalsBlocks(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	weatherReference: BoatPredictionGptCopyExWeatherWaterReference;
	exContext: BoatPredictionGptCopyExContext | null;
}): string[] {
	const { venue, race, weatherReference, exContext } = params;
	const venueBand = findDerivedVenue(exContext?.venueRaceBandHistory ?? null, venue);
	const band = readRecordArray(venueBand?.bands).find((item) => asText(item.raceBand, "") === bandForRace(race.raceNo));
	const weatherVenue = findDerivedVenue(exContext?.weatherWaterHistory ?? null, venue);
	const profiles = asRecord(weatherVenue?.conditionProfiles);
	const exactKey = JSON.stringify({ weather: weatherReference.currentConditions.weather === unavailable ? null : weatherReference.currentConditions.weather, windDirection: weatherReference.currentConditions.windDirection === unavailable ? null : weatherReference.currentConditions.windDirection, windSpeedBand: weatherReference.currentConditions.windSpeedBand, waveHeightBand: weatherReference.currentConditions.waveHeightBand });
	const exact = profileFor(profiles?.exact, exactKey);
	const decisionVenue = findDerivedVenue(exContext?.decisionMethodHistory ?? null, venue);
	const entryVenue = findDerivedVenue(exContext?.entryShiftHistory ?? null, venue);
	const motorVenue = findDerivedVenue(exContext?.motorBoatHistory ?? null, venue);
	const motorByNumber = new Map(readRecordArray(motorVenue?.motors).map((item) => [asText(item.number, ""), item]));
	const motorLines = (race.racers ?? []).slice(0, 6).map((racer) => {
		const motor = motorByNumber.get(asText(racer.motorNo ?? racer.boatMotorNo, ""));
		return motor && (readNumber(motor.raceCount) ?? 0) >= 5
			? `${asText(racer.frameNo)}号艇 モーター${asText(racer.motorNo ?? racer.boatMotorNo)}: ${asText(motor.raceCount)}R / 1着${asText(motor.firstCount)} / 2連${asText(motor.top2Count)} / 3連${asText(motor.top3Count)}`
			: null;
	}).filter((line): line is string => Boolean(line));
	return [
		[
			"【KURARI BOAT EX レース帯履歴】",
			`データ期間: 履歴 ${formatDateRange(exContext?.venueRaceBandHistory ?? null)}`,
			`対象レース帯: ${bandForRace(race.raceNo).replace(/-/g, "〜")}`,
			`会場×帯サンプル: ${asText(band?.raceCount)}R`,
			`1号艇1着率: ${shortRate(band?.lane1FirstRate)}`,
			`中外1着率: ${shortRate(band?.centerOuterFirstRate)}`,
			`3連単1万円超: ${asText(band?.trifectaOver10000Count)}/${asText(band?.trifectaPayoutAvailableRaceCount)}R (${shortRate(band?.trifectaOver10000Rate)})`,
			`状態: ${asText(asRecord(band?.readiness)?.status)}`,
			"注意: レース帯履歴は予想補助。買い目スコアではない。",
		].join("\n"),
		[
			"【KURARI BOAT EX 条件別履歴】",
			`当日条件: ${weatherReference.currentConditions.weather} / ${weatherReference.currentConditions.windDirection} / ${weatherReference.currentConditions.windSpeed}(${weatherReference.currentConditions.windSpeedBand}) / ${weatherReference.currentConditions.waveHeight}(${weatherReference.currentConditions.waveHeightBand})`,
			`同天候サンプル: ${weatherReference.conditionCounts.weather}R`,
			`同風向サンプル: ${weatherReference.conditionCounts.windDirection}R`,
			`同風速帯サンプル: ${weatherReference.conditionCounts.windSpeedBand}R`,
			`同波高帯サンプル: ${weatherReference.conditionCounts.waveHeightBand}R`,
			`完全一致サンプル: ${exact ? `${readNumber(exact.raceCount) ?? 0}R` : weatherReference.currentConditions.windSpeedBand === "unknown" && weatherReference.currentConditions.waveHeightBand === "unknown" ? unavailable : "0R"}`,
			`条件別メモ: ${asText(exact?.readiness) === "ready" ? "available" : "LOW SAMPLE。過信しない。"}`,
		].join("\n"),
		[
			"【KURARI BOAT EX 決まり手履歴】",
			`会場決まり手履歴: ${decisionVenue ? "available" : "missing"}`,
			`決まり手件数: ${Object.entries(asRecord(decisionVenue?.winningDecisionCounts) ?? {}).map(([name, count]) => `${name}:${count}`).join(" / ") || unavailable}`,
			"注意: 決まり手履歴は過去結果の集計。予想・買い目ではない。",
		].join("\n"),
		[
			"【KURARI BOAT EX 進入履歴】",
			`枠なり傾向: ${(readNumber(entryVenue?.courseAvailableRaceCount) ?? readNumber(entryVenue?.raceCount) ?? 0) > 0 ? shortRate(entryVenue?.frameNariRate) : "未判定（source field insufficient）"}`,
			`1号艇イン取得: ${(readNumber(entryVenue?.courseAvailableRaceCount) ?? readNumber(entryVenue?.raceCount) ?? 0) > 0 ? `${asText(entryVenue?.lane1InsideCount)}/${asText(entryVenue?.courseAvailableRaceCount ?? entryVenue?.raceCount)}R` : "未判定（source field insufficient）"}`,
			`進入入替: ${(readNumber(entryVenue?.courseAvailableRaceCount) ?? readNumber(entryVenue?.raceCount) ?? 0) > 0 ? `${asText(entryVenue?.entryShiftRaceCount)}R` : "未判定（source field insufficient）"}`,
			"注意: 当日展示の進入を最優先。履歴は補助。",
		].join("\n"),
		[
			"【KURARI BOAT EX モーター履歴】",
			...(motorLines.length ? motorLines : ["EX履歴サンプル: LOW SAMPLE または未取得"]),
			"注意: 通常素材の公式モーター情報を優先。EX履歴は補助。",
		].join("\n"),
	];
}

function buildBoatPredictionGptCopyExVenueSignalsBlockLegacy(params: {
	venue: BoatTodayVenueItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { venue, exContext } = params;
	const venueBias = findDerivedVenue(exContext?.venueBias ?? null, venue);
	const roughIndex = findDerivedVenue(exContext?.roughIndex ?? null, venue);
	const todayFlow = findDerivedVenue(exContext?.todayFlow ?? null, venue);
	const venueEvidence = exContext?.venueEvidence ? findVenueWeatherEvidence(exContext.venueEvidence, venue) : null;
	const firstPlaceRates = asRecord(venueBias?.firstPlaceBoatNumberRates);
	const firstPlaceCounts = asRecord(venueBias?.firstPlaceBoatNumberCounts);
	const courseRates = [1, 2, 3, 4, 5, 6].map((boat) => `${boat}号艇:${percentLabel(firstPlaceRates?.[String(boat)])}`).join(" / ");
	const insideRate = readNumber(firstPlaceRates?.["1"]);
	const outsideRates = [2, 3, 4, 5, 6].map((boat) => readNumber(firstPlaceRates?.[String(boat)]) ?? 0);
	const insideBias = insideRate === null
		? unavailable
		: insideRate >= Math.max(...outsideRates) ? `イン寄り（1号艇1着率 ${percentLabel(insideRate)}）` : "中外寄り（1号艇以外の1着率が最大）";
	const roughRaceCount = readNumber(roughIndex?.raceCount) ?? 0;
	const roughHighPayoutCount = readNumber(roughIndex?.trifectaOver10000RaceCount) ?? 0;
	const roughRate = roughRaceCount > 0 ? `${((roughHighPayoutCount / roughRaceCount) * 100).toFixed(1)}%` : unavailable;
	const flowTargetDate = asText(exContext?.todayFlow?.targetDate, "");
	const isFlowForVenueDate = Boolean(todayFlow && flowTargetDate && flowTargetDate === venue.date);
	const flowSequence = readRecordArray(todayFlow?.firstPlaceBoatSequence);
	const earlyFlow = flowSequence.filter((item) => (readNumber(item.raceNo) ?? 0) >= 1 && (readNumber(item.raceNo) ?? 0) <= 6);
	const lateFlow = flowSequence.filter((item) => (readNumber(item.raceNo) ?? 0) >= 7 && (readNumber(item.raceNo) ?? 0) <= 12);

	return [
		"【KURARI BOAT EX 会場・荒れ・当日フロー】",
		"EX天候・水面履歴: missing",
		"風速帯・波高帯・天候・風向別履歴: 未取得（現行EX derivedには会場別の履歴分布がありません）",
		`EX会場傾向: ${asText(asRecord(venueBias?.readiness)?.status)}`,
		`イン/中外傾向: ${insideBias}`,
		`コース別1着率: ${courseRates}`,
		`コース別1着数: ${[1, 2, 3, 4, 5, 6].map((boat) => `${boat}号艇:${asText(firstPlaceCounts?.[String(boat)])}`).join(" / ")}`,
		`決まり手（対象日集計）: ${winningTechniqueLabel(venueEvidence?.resultEvidence?.winningTechniqueCounts)}`,
		"決まり手履歴傾向: 未取得（現行venue-bias v1には履歴の決まり手集計がありません）",
		"EX会場傾向 source: public/data/boatrace-ex/derived/venue-bias/latest.json",
		`EX荒れ指数: ${asText(asRecord(roughIndex?.readiness)?.status)}`,
		`荒れ根拠: 3連単1万円超 ${roughHighPayoutCount}/${roughRaceCount}R (${roughRate})`,
		"今日の条件で使える根拠: 条件一致不足（現行rough-index v1は払戻履歴で、風・波・時間帯別の適用根拠は未収録）",
		"EX荒れ指数 source: public/data/boatrace-ex/derived/rough-index/latest.json",
		`EX当日フロー: ${isFlowForVenueDate ? "available" : "missing"}`,
		isFlowForVenueDate ? `1R〜6R フロー: ${countBoatWins(earlyFlow)}` : `1R〜6R フロー: 未取得（EX当日フロー対象日 ${flowTargetDate || unavailable} はコピー対象日と一致しません）`,
		isFlowForVenueDate ? `7R〜12R フロー: ${countBoatWins(lateFlow)}` : "7R〜12R フロー: 未取得",
		isFlowForVenueDate
			? `当日イン/外: イン ${asText(todayFlow?.insideWinCount)} / 中外 ${asText(todayFlow?.outsideWinCount)}`
			: "当日イン/外: 未取得",
		"当日風・波変化: 未取得（現行today-flow v1には前半/後半の風・波時系列がありません）",
		"EX当日フロー source: public/data/boatrace-ex/derived/today-flow/latest.json",
		"注意: EX会場傾向・荒れ指数・当日フローはsource-backedな参照材料です。条件一致不足や未取得の項目を推測で補完しません。",
	].join("\n");
}

export function buildBoatPredictionGptCopyExVenueSignalsBlock(params: {
	venue: BoatTodayVenueItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { venue, exContext } = params;
	const venueBias = findDerivedVenue(exContext?.venueBias ?? null, venue);
	const roughIndex = findDerivedVenue(exContext?.roughIndex ?? null, venue);
	const todayFlow = findDerivedVenue(exContext?.todayFlow ?? null, venue);
	const firstPlaceRates = asRecord(venueBias?.firstPlaceBoatNumberRates);
	const firstPlaceCounts = asRecord(venueBias?.firstPlaceBoatNumberCounts);
	const courseRates = [1, 2, 3, 4, 5, 6].map((boat) => `${boat}号艇 ${percentLabel(firstPlaceRates?.[String(boat)])}`).join(" / ");
	const insideRate = readNumber(firstPlaceRates?.["1"]);
	const outsideRates = [2, 3, 4, 5, 6].map((boat) => readNumber(firstPlaceRates?.[String(boat)]) ?? 0);
	const insideBias = insideRate === null
		? unavailable
		: insideRate >= Math.max(...outsideRates) ? `イン寄り（1号艇 ${percentLabel(insideRate)}）` : "中外寄り（1号艇が最大ではない）";
	const roughRaceCount = readNumber(roughIndex?.raceCount) ?? 0;
	const roughHighPayoutCount = readNumber(roughIndex?.trifectaOver10000RaceCount) ?? 0;
	const roughRate = roughRaceCount > 0 ? `${((roughHighPayoutCount / roughRaceCount) * 100).toFixed(1)}%` : unavailable;
	const flowTargetDate = asText(exContext?.todayFlow?.targetDate, "");
	const isFlowForVenueDate = Boolean(todayFlow && flowTargetDate && flowTargetDate === venue.date);
	const flowLabel = isFlowForVenueDate ? "EX当日フロー" : "EX履歴latest-day flow";
	const flowSourceLabel = isFlowForVenueDate ? "EX当日フロー source" : "EX履歴latest-day flow source";
	const flowSequence = readRecordArray(todayFlow?.firstPlaceBoatSequence);
	const earlyFlow = flowSequence.filter((item) => (readNumber(item.raceNo) ?? 0) >= 1 && (readNumber(item.raceNo) ?? 0) <= 6);
	const lateFlow = flowSequence.filter((item) => (readNumber(item.raceNo) ?? 0) >= 7 && (readNumber(item.raceNo) ?? 0) <= 12);

	return [
		"【KURARI BOAT EX 会場・荒れ・当日フロー】",
		`会場傾向 データ期間: 履歴 ${formatDateRange(exContext?.venueBias ?? null)}`,
		`EX会場傾向: ${asText(asRecord(venueBias?.readiness)?.status)}`,
		`イン/中外傾向: ${insideBias}`,
		`コース別1着率: ${courseRates}`,
		`コース別1着数: ${[1, 2, 3, 4, 5, 6].map((boat) => `${boat}号艇 ${asText(firstPlaceCounts?.[String(boat)])}`).join(" / ")}`,
		`EX履歴 展示coverage: ${asText(asRecord(exContext?.venueBias?.summary)?.exhibitionAvailableRaceCount)}/${asText(asRecord(exContext?.venueBias?.summary)?.raceCount)}R`,
		"注意: EX履歴展示coverageが低い場合は、通常素材の当日展示情報を優先する。",
		"EX会場傾向 source: public/data/boatrace-ex/derived/venue-bias/latest.json",
		`荒れ指数 データ期間: 履歴 ${formatDateRange(exContext?.roughIndex ?? null)}`,
		`EX荒れ指数: ${asText(asRecord(roughIndex?.readiness)?.status)}`,
		`荒れやすさ: 3連単 10,000円超 ${roughHighPayoutCount}/${roughRaceCount}R (${roughRate})`,
		"荒れ指数の今日条件適用: 履歴全体の参考。風・波・展示条件の一致は別途確認する。",
		"EX荒れ指数 source: public/data/boatrace-ex/derived/rough-index/latest.json",
		`${flowLabel}: ${isFlowForVenueDate ? "available" : "対象日不一致"}`,
		`データ期間: latest-day ${flowTargetDate || unavailable}${isFlowForVenueDate ? "" : ` / 予想対象日 ${venue.date} と不一致`}`,
		`EX flow targetDate: ${flowTargetDate || unavailable}`,
		`予想対象日: ${venue.date}`,
		isFlowForVenueDate ? `1R～6R フロー: ${countBoatWins(earlyFlow)}` : "1R～6R フロー: 対象日不一致のため予想当日フローとしては使わない",
		isFlowForVenueDate ? `7R～12R フロー: ${countBoatWins(lateFlow)}` : "7R～12R フロー: 対象日不一致のため予想当日フローとしては使わない",
		isFlowForVenueDate
			? `当日イン/中外: イン ${asText(todayFlow?.insideWinCount)} / 中外 ${asText(todayFlow?.outsideWinCount)}`
			: "当日イン/中外: 対象日不一致のため予想当日フローとしては使わない",
		"当日風・波・イン変化: 未取得（today-flow v1には前半/後半の風・波時系列がありません）",
		isFlowForVenueDate ? "注意: 当日フローは対象日一致時のみ補助に使う。" : "注意: このフローは予想対象日の当日フローではありません。履歴参考としても過信しない。",
		`${flowSourceLabel}: public/data/boatrace-ex/derived/today-flow/latest.json`,
		"注意: 会場傾向・荒れ指数はsource-backedな履歴集計。当日flowは対象日一致時のみ補助に使う。",
	].join("\n");
}

export function getBoatPredictionGptCopyExReference(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	venueExtra?: BoatVenueExtraVenue | null;
	raceExtra?: BoatVenueExtraRace | null;
	exContext: BoatPredictionGptCopyExContext | null;
}): BoatPredictionGptCopyExReference {
	const { venue, race, venueExtra, raceExtra, exContext } = params;
	const exRace = findExRace(exContext, venue, race);
	const linkage = exRace?.racerLinkageSummary;
	const racerCount = linkage?.racerCount ?? exRace?.racers.length ?? race.racers?.length ?? 0;
	const registeredIdentityNumbers = new Set(exContext?.registeredIdentities.map((item) => item.registrationNo) ?? []);
	const directRegistrationLinkedCount = (race.racers ?? []).filter((racer) => registeredIdentityNumbers.has(asText(racer.registrationNo, ""))).length;
	const officialRegistrationLinkedCount = Math.max(linkage?.officialRegistrationLinkedCount ?? 0, directRegistrationLinkedCount);
	const exactNameLinkedCount = 0;
	const linkedCount = officialRegistrationLinkedCount;
	const unresolvedCount = linkage?.unresolvedCount ?? Math.max(0, racerCount - linkedCount);
	const lowSampleCount = linkedCount > 0 && linkedCount < 3 ? linkedCount : 0;
	const venueExStatus = readReadinessStatus(exContext?.venueBias ?? null);
	const venueFeatureStatus = readReadinessStatus(exContext?.roughIndex ?? null);
	const todayFlowTargetDate = asText(exContext?.todayFlow?.targetDate, "");
	const todayFlowStatus = todayFlowTargetDate && todayFlowTargetDate === venue.date
		? readReadinessStatus(exContext?.todayFlow ?? null)
		: exContext ? "対象日不一致" : "unknown";
	const raceAnalysisStatus = exRace ? "source-backed" : unavailable;
	const exhibitionAvailability = getBoatPredictionExhibitionAvailability({ race, raceExtra });
	const exhibitionSummary = exhibitionAvailability.label;
	const weather = resolveBoatPredictionWeatherReference({ race, venue, venueExtra, raceExtra });
	const weatherSourceAcquiredAt = asText(venue.generatedAt, "");
	const weatherObservedAtMs = Date.parse(weather.observedAt);
	const weatherSourceAcquiredAtMs = Date.parse(weatherSourceAcquiredAt);
	const weatherNeedsRefreshCaution = Number.isFinite(weatherObservedAtMs) && Number.isFinite(weatherSourceAcquiredAtMs) && weatherObservedAtMs < weatherSourceAcquiredAtMs;
	const weatherSummary = `${weather.weather} / 風 ${weather.windDirection} ${weather.windSpeed} / 波 ${weather.waveHeight}`;
	const weatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, race, venueExtra, raceExtra, exContext });
	let level: BoatPredictionGptCopyExReferenceLevel;
	if (!exContext) {
		level = "unknown";
	} else if (!exRace) {
		level = "D";
	} else if (exRace.sourceStatus !== "complete" || exRace.racerEvidenceStatus !== "available") {
		level = "D";
	} else if (
		racerCount > 0 &&
		linkedCount >= racerCount - 1 &&
		exRace.exhibitionStatus === "available" &&
		weatherWater.availability === "available"
	) {
		level = "A";
	} else if (linkedCount >= 3 && (weatherWater.availability === "available" || weatherWater.availability === "partial")) {
		level = "B";
	} else if (linkedCount >= 1 && weatherWater.availability === "partial") {
		level = "C";
	} else {
		level = "D";
	}

	const cautions = [
		!exRace ? "当日EXレース分析は未取得です。現在のsourceのavailabilityだけで判断してください。" : null,
		unresolvedCount > 0 ? `選手EXリンク未解決: ${unresolvedCount}名。推測補完はしないでください。` : null,
		lowSampleCount > 0 ? `LOW SAMPLE: ${lowSampleCount}名。参考情報として扱ってください。` : null,
		exhibitionAvailability.status === "missing" ? "展示タイム未取得です。展示反映済み素材として扱わず、事前予想として扱ってください。" : null,
		exhibitionAvailability.status === "missing" && exhibitionAvailability.hasNonTimeInfo
			? "進入・チルト・体重など非タイム項目が含まれていても、展示タイム未取得なら展示反映扱いにしないでください。"
			: null,
		exhibitionAvailability.status === "partial" ? "展示タイム一部取得です。未取得の展示タイムは補完しないでください。" : null,
		weather.weather === unavailable && weather.windDirection === unavailable && weather.waveHeight === unavailable
			? "天候・風・波は未取得です。現在sourceにない値は補完しないでください。"
			: null,
	].filter((value): value is string => Boolean(value));

	return {
		level,
		linkedCount,
		racerCount,
		officialRegistrationLinkedCount,
		exactNameLinkedCount,
		unresolvedCount,
		lowSampleCount,
		venueExStatus,
		venueFeatureStatus,
		todayFlowStatus,
		raceAnalysisStatus,
		weatherSummary,
		weatherSource: weather.source,
		weatherObservedAt: weather.observedAt,
		weatherSourceAcquiredAt: asText(weatherSourceAcquiredAt),
		weatherNeedsRefreshCaution,
		weatherWaterAvailability: weatherWater.availability,
		historicalLatestDayWeatherAvailability: exContext ? exContext.venueEvidenceDate === venue.date ? "available" : "target-date-mismatch" : "unknown",
		historicalExDate: asText(exContext?.venueEvidenceDate),
		exhibitionSummary,
		cautions,
	};
}

export function buildBoatPredictionGptCopyExReferenceBlock(reference: BoatPredictionGptCopyExReference): string {
	return [
		"【KURARI BOAT EX 参照情報】",
		`EX参照レベル: ${reference.level}`,
		`登録番号exactリンク: ${reference.linkedCount}/${reference.racerCount}`,
		`未リンク: ${reference.unresolvedCount}名`,
		"氏名推測リンク: 使用禁止（registrationNo exact matchのみ）",
		`会場EX: ${reference.venueExStatus}`,
		`会場特徴: ${reference.venueFeatureStatus}`,
		`当日フロー: ${reference.todayFlowStatus}`,
		`当日EXレース分析: ${reference.raceAnalysisStatus}`,
		`当日天候・風・波: ${reference.weatherSummary}`,
		`通常素材 weather source: ${reference.weatherSource}`,
		`通常素材 weather 表示時点: ${reference.weatherObservedAt}`,
		`通常素材 source acquired at: ${reference.weatherSourceAcquiredAt}`,
		...(reference.weatherNeedsRefreshCaution ? ["通常素材 weather 注意: weather値は未更新/確認中。出走表source取得時刻とは異なる。"] : []),
		`EX参照 weather source: 通常素材[C]と共通 (${reference.weatherSource})`,
		`EX参照 weather 表示時点: ${reference.weatherObservedAt}`,
		`EX天候・水面履歴 availability: ${reference.weatherWaterAvailability}`,
		`EX履歴latest-day天候・水面 availability: ${reference.historicalLatestDayWeatherAvailability}${reference.historicalLatestDayWeatherAvailability === "target-date-mismatch" ? `（履歴EX latest=${reference.historicalExDate} / 予想対象日とは別）` : ""}`,
		`展示情報: ${reference.exhibitionSummary}`,
		...(reference.lowSampleCount > 0 ? [`LOW SAMPLE: ${reference.lowSampleCount}名`] : []),
		"EX使用上の注意:",
		...reference.cautions.map((caution) => `- ${caution}`),
	].join("\n");
}

const formatRoster = (racers: BoatRacerItem[], sourceName: string, sourceAcquiredAt: string, sourceStatus: string): string[] => {
	if (racers.length === 0) {
		return ["- 出走表未取得"];
	}

	return racers.map((racer) => [
		`${racer.frameNo}号艇`,
		`選手 ${asText(racer.name)}`,
		`登録番号 ${asText(racer.registrationNo)}`,
		`支部 ${asText(racer.branch)}`,
		`年齢 ${asText(racer.age)}`,
		`級別 ${asText(racer.class)}`,
		`モーター ${asText(racer.motorNo ?? racer.boatMotorNo)}`,
		`source name ${sourceName}`,
		`source acquired at ${sourceAcquiredAt}`,
		`source status ${sourceStatus}`,
	].join(" / "));
};

function buildBoatPredictionGptCopyCurrentDayCoverageBlock(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { venue, race, exContext } = params;
	const coverage = exContext?.currentDayPredictionCoverage;
	const targetDate = asText(coverage?.targetDate, "");
	const matchesTargetDate = Boolean(targetDate) && targetDate === asText(venue.date, "");
	const venueCoverage = asArray<JsonRecord>(coverage?.venues).find((entry) => asText(entry.venueCode, "") === asText(venue.venueCode, ""));
	const racers = race.racers ?? [];
	const registrations = racers.filter((racer) => asText(racer.registrationNo, ""));
	const registeredIdentityNumbers = new Set(exContext?.registeredIdentities.map((item) => item.registrationNo) ?? []);
	const exactLinked = registrations.filter((racer) => registeredIdentityNumbers.has(asText(racer.registrationNo, ""))).length;
	const weatherAvailable = Number(venueCoverage?.weatherAvailableRaceCount ?? 0) > 0;
	const windAvailable = Number(venueCoverage?.windAvailableRaceCount ?? 0) > 0;
	const waveAvailable = Number(venueCoverage?.waveAvailableRaceCount ?? 0) > 0;
	const weatherLabel = weatherAvailable && windAvailable && waveAvailable
		? "available（通常素材source-backed）"
		: "未取得（通常素材source-backed、公式更新待ち）";
	const resultStatus = asText(coverage?.resultStatus, "未読込");
	const exhibition = getBoatPredictionExhibitionAvailability({ race });

	return [
		"【KURARI BOAT EX 当日予想coverage】",
		`対象日: ${targetDate || "未読込"}`,
		`出走表coverage: ${matchesTargetDate && racers.length === 6 ? "available" : "未取得"} (${racers.length}/6)`,
		`登録番号coverage: ${registrations.length}/${racers.length || 6}`,
		`選手特徴 exactリンク: ${exactLinked}/${racers.length || 6}`,
		`天候・風・波: ${weatherLabel}`,
		`展示タイム: ${exhibition.label}`,
		`結果/払戻: ${resultStatus}`,
		"race-analysis: 未取得（結果・払戻の確定後に生成）",
		"履歴EXとは別に、当日通常素材の完全性を示すcoverageです。",
	].join("\n");
}

function formatRacerFeatureLines(params: {
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): string[] {
	const { venue, race, exContext } = params;
	const featuresByRegistrationNo = new Map((exContext?.racerFeatures ?? []).map((feature) => [feature.registrationNo, feature]));

	return (race.racers ?? []).map((racer) => {
		const registrationNo = asText(racer.registrationNo, "");
		const feature = featuresByRegistrationNo.get(registrationNo);
		if (!feature) {
			return `- ${asText(racer.frameNo)}号艇 / ${asText(racer.name)} / 登録番号完全一致のEX履歴特徴は未取得`;
		}

		const venueHistory = feature.venues.find((item) => item.venueCode === venue.venueCode);
		const frameHistory = feature.frames.find((item) => item.frameNo === Number(racer.frameNo));
		const leadingMethod = Object.entries(feature.winMethodCounts)
			.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ja"))[0];
		const startTiming = feature.startTiming.sampleCount > 0 && feature.startTiming.average !== null
			? `平均ST ${feature.startTiming.average.toFixed(3)} (${feature.startTiming.sampleCount}走)`
			: "平均ST 未取得";
		const localHistory = venueHistory ? `当地 ${venueHistory.starts}走 (${venueHistory.sampleLevel})` : "当地履歴 未取得";
		const frame = frameHistory ? `${asText(racer.frameNo)}枠 ${frameHistory.starts}走 (${frameHistory.sampleLevel})` : `${asText(racer.frameNo)}枠履歴 未取得`;
		const method = leadingMethod ? `決まり手 ${leadingMethod[0]} ${leadingMethod[1]}件` : "決まり手 未取得";
		return `- ${asText(racer.frameNo)}号艇 / ${asText(racer.name)} / 登録番号 ${feature.registrationNo} / EX履歴 ${feature.historyStarts}走 (${feature.sampleLevel}) / ${localHistory} / ${frame} / ${startTiming} / 直近5走 ${feature.recent.last5.starts}走 / ${method}`;
	});
}

export function buildBoatPredictionGptCopyRaceContext(params: {
	feed: BoatTodayFeed;
	venue: BoatTodayVenueItem;
	race: BoatRaceItem;
	venueExtra?: BoatVenueExtraVenue | null;
	raceExtra?: BoatVenueExtraRace | null;
	venueTimeKind: BoatPredictionVenueTimeKind;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { feed, venue, race, venueExtra, raceExtra, venueTimeKind, exContext } = params;
	const sourceName = asText(venue.source ?? feed.source);
	const sourceAcquiredAt = asText(venue.generatedAt ?? feed.generatedAt);
	const sourceStatus = readSourceStatus(venue.source ?? feed.source);
	const exRace = findExRace(exContext, venue, race);
	const exReference = getBoatPredictionGptCopyExReference({ venue, race, venueExtra, raceExtra, exContext });
	const exWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, race, venueExtra, raceExtra, exContext });
	const normalExhibition = getBoatPredictionExhibitionAvailability({ race, raceExtra });
	const exhibition = exReference.exhibitionSummary;
	const notes = exRace?.analysisNotes.filter(Boolean).slice(0, 3) ?? [];
	const currentDayCoverage = buildBoatPredictionGptCopyCurrentDayCoverageBlock({ venue, race, exContext });
	const racerFeatureLines = formatRacerFeatureLines({ venue, race, exContext });
	const racerLines = exRace?.racers.length
		? exRace.racers.map((racer) => {
			const registrationNo = racer.officialRegistrationNo ?? racer.resolvedRegistrationNo ?? unavailable;
			const identity = exContext?.registeredIdentities.find((item) => item.registrationNo === registrationNo);
			const history = identity
				? ` / 履歴出走 ${identity.appearanceCount}件 / 初回 ${identity.firstSeenDate} / 最終 ${identity.lastSeenDate}`
				: " / 履歴出走 未取得";
			return `- ${asText(racer.lane)}号艇 / ${asText(racer.racerName)} / 登録番号 ${registrationNo} / linkage ${racer.linkageStatus} / racer evidence ${asText(racer.sourceStatus)}${history}`;
		})
		: (race.racers ?? []).map((racer) => {
			const registrationNo = asText(racer.registrationNo, "");
			const identity = exContext?.registeredIdentities.find((item) => item.registrationNo === registrationNo);
			return identity
				? `- ${asText(racer.frameNo)}号艇 / ${asText(racer.name)} / 登録番号完全一致 ${registrationNo} / 履歴出走 ${identity.appearanceCount}件 / 初回 ${identity.firstSeenDate} / 最終 ${identity.lastSeenDate}`
				: `- ${asText(racer.frameNo)}号艇 / ${asText(racer.name)} / 登録番号完全一致 未リンク`;
		});

	return [
		`[日付 ${venue.date ?? feed.date} ${venue.venueName} ${race.raceNo}R]`,
		`時間帯: ${getBoatPredictionRaceTimeLabel(venueTimeKind, race)}`,
		"【出走表】",
		...formatRoster(race.racers ?? [], sourceName, sourceAcquiredAt, sourceStatus),
		buildBoatPredictionGptCopyExReferenceBlock(exReference),
		currentDayCoverage,
		buildBoatPredictionGptCopyExWeatherWaterBlock(exWeatherWater),
		buildBoatPredictionGptCopyExHistoricalLatestDayVenueEvidenceBlock({ venue, exContext }),
		buildBoatPredictionGptCopyExVenueSignalsBlock({ venue, exContext }),
		...buildBoatPredictionGptCopyExUsefulSignalsBlocks({ venue, race, weatherReference: exWeatherWater, exContext }),
		"【展示情報】",
		exhibition,
		"【EXレース分析】",
		`EX race-analysis shard: ${exRace ? "source-backed" : `未取得（履歴EX latest=${asText(exContext?.venueEvidenceDate)} / 結果・払戻の確定後に生成）`}`,
		`EXレースsource: ${asText(exRace?.sourceStatus)}`,
		`EX shard由来 展示availability: ${asText(exRace?.exhibitionStatus)}`,
		`通常素材 展示availability: ${normalExhibition.label}`,
		`EX shard由来 気象availability: ${asText(exRace?.weatherStatus)}`,
		`EX選手evidence availability: ${asText(exRace?.racerEvidenceStatus)}`,
		`EX audit path: ${asText(exContext?.auditPath)}`,
		"【EX選手情報】",
		...racerLines,
		"【KURARI BOAT EX 選手特徴】",
		...racerFeatureLines,
		"- 登録番号の完全一致と履歴ソースに基づく記述統計です。判断結果や買い目ではありません。",
		"【source-backed / cautions】",
		"- オッズ情報は含まれていますが、予想ではオッズを優先せず、展開・展示・機力・会場傾向・EX天候・水面を重視してください。",
		normalExhibition.status === "complete"
			? "- 展示取得済みのため、展示反映済み素材として扱ってください。"
			: normalExhibition.status === "partial"
				? "- 展示タイム一部取得です。未取得の展示タイムは過信せず、通常sourceと合わせて判断してください。"
				: "- 展示タイム未取得です。展示反映済み素材として扱わず、事前予想として扱ってください。",
		normalExhibition.status === "missing" && normalExhibition.hasNonTimeInfo
			? `- 非タイム展示項目: ${normalExhibition.nonTimeInfoLabel || "sourceにあり"}。展示タイム未取得のため展示反映扱いにはしません。`
			: null,
		"- EX天候・水面は、過去/当日source-backedな参照材料です。",
		`- EX分析が未取得または一部の場合: ${exRace ? "availabilityのみを利用" : "未取得"}`,
		...notes.map((note) => `- EX note: ${note}`),
	].join("\n");
}
