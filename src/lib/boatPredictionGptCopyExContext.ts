import type { BoatRaceItem, BoatRacerItem, BoatTodayFeed, BoatTodayVenueItem } from "./boatraceTypes";
import type {
	BoatExHistoricalRaceAnalysisDateFile,
	BoatExHistoricalRaceAnalysisIndexFile,
	BoatExRaceAnalysisFile,
	BoatExRaceAnalysisItem,
} from "./boatExTypes";
import { withBasePath } from "./assetPath";
import { getBoatPredictionRaceTimeLabel, type BoatPredictionVenueTimeKind } from "./boatPredictionGptCopy";

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
	const [latest, historyIndex, venueBias, roughIndex, todayFlow, identityRegistry] = await Promise.all([
		fetchJson<BoatExRaceAnalysisFile>("data/boatrace-ex/derived/race-analysis/latest.json"),
		fetchJson<BoatExHistoricalRaceAnalysisIndexFile>("data/boatrace-ex/derived/race-analysis/history-index.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/venue-bias/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/rough-index/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/derived/today-flow/latest.json"),
		fetchJson<JsonRecord>("data/boatrace-ex/identity/registered-racers.generated.json"),
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
	};
}

export function buildBoatPredictionGptCopyHeader(params: {
	feed: BoatTodayFeed;
	venue: BoatTodayVenueItem;
	races: BoatRaceItem[];
	raceRangeLabel: string;
	rangePurposeLabel: string;
	venueTimeKind: BoatPredictionVenueTimeKind;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { feed, venue, races, raceRangeLabel, rangePurposeLabel, venueTimeKind, exContext } = params;
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
		item.raceNo === Number(race.raceNo) && (
			(venue.venueCode && item.venueCode === venue.venueCode) || item.venueName === venue.venueName
		),
	) ?? null;
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
	venueTimeKind: BoatPredictionVenueTimeKind;
	exContext: BoatPredictionGptCopyExContext | null;
}): string {
	const { feed, venue, race, venueTimeKind, exContext } = params;
	const sourceName = asText(venue.source ?? feed.source);
	const sourceAcquiredAt = asText(venue.generatedAt ?? feed.generatedAt);
	const sourceStatus = readSourceStatus(venue.source ?? feed.source);
	const exRace = findExRace(exContext, venue, race);
	const exhibition = exRace?.exhibitionStatus === "available" ? "展示情報はsource-backed" : "展示未取得 / 事前予想";
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
		"【展示情報】",
		exhibition,
		"【EXレース分析】",
		`EX分析状態: ${exRace ? "source-backed" : unavailable}`,
		`EXレースsource: ${asText(exRace?.sourceStatus)}`,
		`EX展示availability: ${asText(exRace?.exhibitionStatus)}`,
		`EX気象availability: ${asText(exRace?.weatherStatus)}`,
		`EX選手evidence availability: ${asText(exRace?.racerEvidenceStatus)}`,
		`EX audit path: ${asText(exContext?.auditPath)}`,
		"【EX選手情報】",
		...racerLines,
		"【source-backed / cautions】",
		"- オッズはこのコピー素材に含めない。",
		"- 展示未取得は事前予想として扱う。",
		`- EX分析が未取得または一部の場合: ${exRace ? "availabilityのみを利用" : "未取得"}`,
		...notes.map((note) => `- EX note: ${note}`),
	].join("\n");
}
