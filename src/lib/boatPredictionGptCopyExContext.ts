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
	venueBias: JsonRecord | null;
	roughIndex: JsonRecord | null;
	todayFlow: JsonRecord | null;
	venueEvidence: BoatExVenueEvidenceFile | null;
	venueEvidencePath: string;
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
	weatherWaterAvailability: "available" | "partial" | "missing" | "unknown";
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
	const venueEvidencePath = `public/data/boatrace-ex/derived/venue-evidence/${date}.json`;
	const [latest, historyIndex, venueBias, roughIndex, todayFlow, identityRegistry, venueEvidence] = await Promise.all([
		fetchJson<BoatExRaceAnalysisFile>("data/boatrace-ex/derived/race-analysis/latest.json"),
		fetchJson<BoatExHistoricalRaceAnalysisIndexFile>("data/boatrace-ex/derived/race-analysis/history-index.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/venue-bias/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/rough-index/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/today-flow/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/identity/registered-racers.generated.json"),
		fetchJson<BoatExVenueEvidenceFile>(venueEvidencePath.replace(/^public\//, "")),
	]);
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
		venueBias,
		roughIndex,
		todayFlow,
		venueEvidence,
		venueEvidencePath,
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
		`- EX source: ${exContext?.raceAnalysis.length ? "BOATRACE EX race analysis" : unavailable}`,
		`- EX generatedAt: ${asText(exContext?.generatedAt)}`,
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

	return [
		`【EX会場共有情報 / ${venue.venueName}】`,
		`対象日EXレース分析: ${sourceState ? "利用可能" : unavailable}`,
		`EX会場傾向: ${asText(venueBiasReadiness?.status)}`,
		`EX荒れ指数素材: ${asText(roughIndexReadiness?.status)}`,
		`EX当日フロー: ${asText(todayFlowReadiness?.status)}`,
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

export function getBoatPredictionGptCopyExWeatherWaterReference(params: {
	venue: BoatTodayVenueItem;
	exContext: BoatPredictionGptCopyExContext | null;
}): BoatPredictionGptCopyExWeatherWaterReference {
	const { venue, exContext } = params;
	const sourcePath = exContext?.venueEvidencePath ?? "public/data/boatrace-ex/derived/venue-evidence/<対象日>.json";
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
		};
	}

	const venueEvidence = exContext.venueEvidence;
	const evidence = venueEvidence ? findVenueWeatherEvidence(venueEvidence, venue) : null;
	const sourceNames = venueEvidence?.sourceFiles.map((source) => source.sourceName).filter(Boolean) ?? [];
	if (!evidence) {
		return {
			availability: "missing",
			windWaveAvailability: "missing",
			conditionMatch: "未取得（対象日・会場のEX天候・水面エビデンスなし）",
			sampleStatus: "未取得",
			weatherCount: 0,
			raceCount: 0,
			windSpeedAverageMps: null,
			windSpeedMaxMps: null,
			waveHeightAverageCm: null,
			waveHeightMaxCm: null,
			sourcePath,
			sourceNames,
		};
	}

	const { weatherEvidence, availability, coverage } = evidence;
	const hasWind = weatherEvidence.windSpeedAverageMps !== null || weatherEvidence.windSpeedMaxMps !== null;
	const hasWave = weatherEvidence.waveHeightAverageCm !== null || weatherEvidence.waveHeightMaxCm !== null;
	const windWaveAvailability = hasWind && hasWave
		? coverage.weather === "available" ? "available" : "partial"
		: hasWind || hasWave || availability.weatherCount > 0 ? "partial" : "missing";
	const weatherAvailability = coverage.weather === "available" && windWaveAvailability === "available"
		? "available"
		: windWaveAvailability === "missing" ? "missing" : "partial";
	const sampleStatus = availability.weatherCount === 0
		? "未取得"
		: availability.weatherCount < 6
			? `LOW SAMPLE (${availability.weatherCount}/${evidence.raceCount}R)`
			: `sufficient (${availability.weatherCount}/${evidence.raceCount}R)`;

	return {
		availability: weatherAvailability,
		windWaveAvailability,
		conditionMatch: "条件一致不足（EX天候・水面タブは会場集計で、当日条件別の比較データは未提供）",
		sampleStatus,
		weatherCount: availability.weatherCount,
		raceCount: evidence.raceCount,
		windSpeedAverageMps: weatherEvidence.windSpeedAverageMps,
		windSpeedMaxMps: weatherEvidence.windSpeedMaxMps,
		waveHeightAverageCm: weatherEvidence.waveHeightAverageCm,
		waveHeightMaxCm: weatherEvidence.waveHeightMaxCm,
		sourcePath,
		sourceNames,
	};
}

export function buildBoatPredictionGptCopyExWeatherWaterBlock(reference: BoatPredictionGptCopyExWeatherWaterReference): string {
	return [
		"【KURARI BOAT EX 天候・水面】",
		`EX天候・水面: ${reference.availability}`,
		`EX風・波データ: ${reference.windWaveAvailability}`,
		`EX天候件数: ${reference.weatherCount}/${reference.raceCount}R`,
		`平均風速: ${metricLabel(reference.windSpeedAverageMps, "m/s")} / 最大風速: ${metricLabel(reference.windSpeedMaxMps, "m/s")}`,
		`平均波高: ${metricLabel(reference.waveHeightAverageCm, "cm")} / 最大波高: ${metricLabel(reference.waveHeightMaxCm, "cm")}`,
		`条件一致: ${reference.conditionMatch}`,
		`サンプル: ${reference.sampleStatus}`,
		`参照source: ${reference.sourcePath}`,
		`参照source名: ${reference.sourceNames.join(" / ") || unavailable}`,
		"EX水面メモ: EXページ「天候・水面」タブの会場別風速・波高集計のみを表示しています。",
		"EX予想補助: EX天候・水面は当日の風・波・展示と合わせて展開判断に使ってください。LOW SAMPLEまたは条件一致不足の場合は過信しないでください。",
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
	const officialRegistrationLinkedCount = linkage?.officialRegistrationLinkedCount ?? 0;
	const exactNameLinkedCount = linkage?.nameLinkedCount ?? 0;
	const linkedCount = officialRegistrationLinkedCount + exactNameLinkedCount;
	const unresolvedCount = linkage?.unresolvedCount ?? Math.max(0, racerCount - linkedCount);
	const lowSampleCount = linkedCount > 0 && linkedCount < 3 ? linkedCount : 0;
	const venueExStatus = readReadinessStatus(exContext?.venueBias ?? null);
	const venueFeatureStatus = readReadinessStatus(exContext?.roughIndex ?? null);
	const todayFlowStatus = readReadinessStatus(exContext?.todayFlow ?? null);
	const raceAnalysisStatus = exRace ? "source-backed" : unavailable;
	const exhibitionAvailability = getBoatPredictionExhibitionAvailability({ race, raceExtra });
	const exhibitionSummary = exhibitionAvailability.label;
	const weather = resolveBoatPredictionWeatherReference({ race, venue, venueExtra, raceExtra });
	const weatherSummary = `${weather.weather} / 風 ${weather.windDirection} ${weather.windSpeed} / 波 ${weather.waveHeight}`;
	const weatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, exContext });
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
		exhibitionAvailability.status === "missing" ? "展示情報は未取得です。事前予想として扱ってください。" : null,
		exhibitionAvailability.status === "partial" ? "展示情報は一部取得です。未取得値は補完しないでください。" : null,
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
		weatherWaterAvailability: weatherWater.availability,
		exhibitionSummary,
		cautions,
	};
}

export function buildBoatPredictionGptCopyExReferenceBlock(reference: BoatPredictionGptCopyExReference): string {
	return [
		"【KURARI BOAT EX 参照情報】",
		`EX参照レベル: ${reference.level}`,
		`登録番号/選手EXリンク: ${reference.linkedCount}/${reference.racerCount}`,
		`公式登録番号リンク: ${reference.officialRegistrationLinkedCount}名 / 完全一致リンク: ${reference.exactNameLinkedCount}名 / 未リンク: ${reference.unresolvedCount}名`,
		`会場EX: ${reference.venueExStatus}`,
		`会場特徴: ${reference.venueFeatureStatus}`,
		`当日フロー: ${reference.todayFlowStatus}`,
		`当日EXレース分析: ${reference.raceAnalysisStatus}`,
		`当日天候・風・波: ${reference.weatherSummary}`,
		`通常素材 weather source: ${reference.weatherSource}`,
		`通常素材 weather 表示時点: ${reference.weatherObservedAt}`,
		`EX参照 weather source: 通常素材[C]と共通 (${reference.weatherSource})`,
		`EX参照 weather 表示時点: ${reference.weatherObservedAt}`,
		`EX天候・水面 availability: ${reference.weatherWaterAvailability}`,
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
	const exWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, exContext });
	const normalExhibition = getBoatPredictionExhibitionAvailability({ race, raceExtra });
	const exhibition = exReference.exhibitionSummary;
	const notes = exRace?.analysisNotes.filter(Boolean).slice(0, 3) ?? [];
	const racerLines = exRace?.racers.length
		? exRace.racers.map((racer) => {
			const registrationNo = racer.officialRegistrationNo ?? racer.resolvedRegistrationNo ?? unavailable;
			const identity = exContext?.registeredIdentities.find((item) => item.registrationNo === registrationNo);
			const history = identity
				? ` / 履歴出走 ${identity.appearanceCount}件 / 初回 ${identity.firstSeenDate} / 最終 ${identity.lastSeenDate}`
				: " / 履歴出走 未取得";
			return `- ${asText(racer.lane)}号艇 / ${asText(racer.racerName)} / 登録番号 ${registrationNo} / linkage ${racer.linkageStatus} / racer evidence ${asText(racer.sourceStatus)}${history}`;
		})
		: ["- EX選手情報未取得"];

	return [
		`[日付 ${venue.date ?? feed.date} ${venue.venueName} ${race.raceNo}R]`,
		`時間帯: ${getBoatPredictionRaceTimeLabel(venueTimeKind, race)}`,
		"【出走表】",
		...formatRoster(race.racers ?? [], sourceName, sourceAcquiredAt, sourceStatus),
		buildBoatPredictionGptCopyExReferenceBlock(exReference),
		buildBoatPredictionGptCopyExWeatherWaterBlock(exWeatherWater),
		"【展示情報】",
		exhibition,
		"【EXレース分析】",
		`EX race-analysis shard: ${exRace ? "source-backed" : unavailable}`,
		`EXレースsource: ${asText(exRace?.sourceStatus)}`,
		`EX shard由来 展示availability: ${asText(exRace?.exhibitionStatus)}`,
		`通常素材 展示availability: ${normalExhibition.label}`,
		`EX shard由来 気象availability: ${asText(exRace?.weatherStatus)}`,
		`EX選手evidence availability: ${asText(exRace?.racerEvidenceStatus)}`,
		`EX audit path: ${asText(exContext?.auditPath)}`,
		"【EX選手情報】",
		...racerLines,
		"【source-backed / cautions】",
		"- オッズ情報は含まれていますが、予想ではオッズを優先せず、展開・展示・機力・会場傾向・EX天候・水面を重視してください。",
		normalExhibition.status === "complete"
			? "- 展示取得済みのため、展示反映済み素材として扱ってください。"
			: normalExhibition.status === "partial"
				? "- 展示一部取得です。欠けている展示項目は過信せず、通常sourceと合わせて判断してください。"
				: "- 展示未取得は事前予想として扱ってください。",
		"- EX天候・水面は、過去/当日source-backedな参照材料です。",
		`- EX分析が未取得または一部の場合: ${exRace ? "availabilityのみを利用" : "未取得"}`,
		...notes.map((note) => `- EX note: ${note}`),
	].join("\n");
}
