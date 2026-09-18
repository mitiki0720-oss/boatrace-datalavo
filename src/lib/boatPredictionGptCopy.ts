import type { BoatRaceItem, BoatTodayVenueItem } from "./boatraceTypes";

export type BoatPredictionVenueTimeKind = "morning" | "summer" | "day" | "night" | "midnight" | "unknown";

type SessionSourceRecord = {
	session?: unknown;
	sessionType?: unknown;
	sessionLabel?: unknown;
	source?: unknown;
};

export type BoatPredictionVenueSessionResolution = {
	session: BoatPredictionVenueTimeKind;
	source: "event-title" | "venue-session" | "race-session" | "official-race-index:ordinary-day" | "conflicting-race-session" | "unresolved";
};

const normalizeSessionText = (value: unknown): string =>
	String(value ?? "").normalize("NFKC").replace(/[\s_-]+/g, "").toLowerCase();

export const normalizeBoatPredictionSession = (value: unknown): BoatPredictionVenueTimeKind | null => {
	const normalized = normalizeSessionText(value);
	if (!normalized) return null;
	if (normalized.includes("midnight") || normalized.includes("ミッドナイト")) return "midnight";
	if (normalized.includes("summer") || normalized.includes("サマータイム")) return "summer";
	if (normalized.includes("morning") || normalized.includes("モーニング")) return "morning";
	if (normalized.includes("night") || normalized.includes("ナイター")) return "night";
	if (normalized === "day" || normalized.includes("デイ")) return "day";
	return null;
};

const readExplicitSession = (value: SessionSourceRecord): BoatPredictionVenueTimeKind | null =>
	normalizeBoatPredictionSession(value.session) ??
	normalizeBoatPredictionSession(value.sessionType) ??
	normalizeBoatPredictionSession(value.sessionLabel);

const hasOfficialRaceIndexSource = (value: SessionSourceRecord): boolean =>
	/official:owpc-html/iu.test(String(value.source ?? ""));

export const formatBoatPredictionSessionLabel = (session: BoatPredictionVenueTimeKind | string | undefined): string => {
	const normalized = normalizeBoatPredictionSession(session) ?? "unknown";
	return {
		morning: "モーニング",
		summer: "サマータイム",
		day: "デイ",
		night: "ナイター",
		midnight: "ミッドナイト",
		unknown: "開催区分未取得",
	}[normalized];
};

export const resolveBoatPredictionVenueSession = (
	venue: BoatTodayVenueItem,
	races: BoatRaceItem[],
): BoatPredictionVenueSessionResolution => {
	const titleSession = normalizeBoatPredictionSession(venue.title);
	if (titleSession) return { session: titleSession, source: "event-title" };

	const venueSession = readExplicitSession(venue as SessionSourceRecord);
	if (venueSession) return { session: venueSession, source: "venue-session" };

	const raceSessions = new Set(
		races
			.map((race) => readExplicitSession(race as SessionSourceRecord))
			.filter((session): session is BoatPredictionVenueTimeKind => session !== null),
	);
	if (raceSessions.size === 1) return { session: [...raceSessions][0], source: "race-session" };
	if (raceSessions.size > 1) return { session: "unknown", source: "conflicting-race-session" };

	// The official race index only marks special time bands. A row sourced from
	// that index without a special marker is the official ordinary daytime form.
	if (hasOfficialRaceIndexSource(venue as SessionSourceRecord)) {
		return { session: "day", source: "official-race-index:ordinary-day" };
	}

	return { session: "unknown", source: "unresolved" };
};

export const getBoatPredictionVenueTimeKind = (venue: BoatTodayVenueItem, races: BoatRaceItem[]): BoatPredictionVenueTimeKind =>
	resolveBoatPredictionVenueSession(venue, races).session;

export const getBoatPredictionRangeTimeKind = (
	venueTimeKind: BoatPredictionVenueTimeKind,
	races: BoatRaceItem[],
): BoatPredictionVenueTimeKind => {
	const raceSessions = new Set(
		races
			.map((race) => readExplicitSession(race as SessionSourceRecord))
			.filter((session): session is BoatPredictionVenueTimeKind => session !== null),
	);
	if (raceSessions.size === 1) return [...raceSessions][0];
	if (raceSessions.size > 1) return "unknown";
	return venueTimeKind;
};

export const getBoatPredictionRaceTimeLabel = (
	venueTimeKind: BoatPredictionVenueTimeKind,
	race: BoatRaceItem,
): BoatPredictionVenueTimeKind => {
	return readExplicitSession(race as SessionSourceRecord) ?? venueTimeKind;
};

export const getBoatPredictionRangePurposeLabel = (
	rangeTimeKind: BoatPredictionVenueTimeKind,
	raceRange: "1R〜6R" | "7R〜12R",
): string => {
	const rangeLabel = raceRange === "1R〜6R" ? "前半予想" : "後半予想";
	const prefix = {
		morning: "モーニング",
		summer: "サマータイム",
		day: "デイ",
		night: "ナイター",
		midnight: "ミッドナイト",
		unknown: "開催区分未取得",
	}[rangeTimeKind];

	return `${prefix}/${rangeLabel}`;
};

export const buildBoatPredictionGptBettingInstruction = (): string => [
	"【GPTへの賭け方指示】",
	"買い目は3連単10点。",
	"厚め2点、本線3点、中穴3点、大穴2点。",
	"2連単は使わない。",
	"オッズではなく展開を重視。",
	"展示未取得なら事前予想。展示取得後に再確認してください。",
	"1Rごとに分けて、コピーしやすい形式で出力してください。",
].join("\n");

export const buildBoatPredictionGptOutputFormatContract = ({
	date,
	venueName,
	raceNumbers,
}: {
	date: string;
	venueName: string;
	raceNumbers: readonly number[];
}): string => {
	const requiredRaces = raceNumbers.map((raceNo) => `${raceNo}R`).join(", ");
	const racePlaceholder = raceNumbers.length > 0 ? `${raceNumbers[0]}R` : "nR";

	return [
		"【予想出力フォーマット契約 / COPY RANGE】",
		`必須対象R: ${requiredRaces}`,
		"対象Rを順番どおり全部1回ずつ出力し、R抜け・重複・指定外R・省略・「以下同様」を禁止します。",
		"各Rは必ず独立した ```text コードブロックにし、複数Rを1ブロックへまとめないでください。",
		"headerの日付・会場・Rと date / venue / race を必ず一致させてください。",
		"買い目は3連単10点固定、1点100円、厚め2点・本線3点・中穴3点・大穴2点です。2連単は出力しないでください。",
		"買い目行以外の数字を買い目形式で出力しないでください。",
		"section順は 出走表 / 進入想定 / 展示 / 水面 / 展開 / 買い目 / 設計メモ で固定します。",
		"",
		"```text",
		`【${date} ${venueName} ${racePlaceholder}】`,
		`date: ${date}`,
		`venue: ${venueName}`,
		`race: ${racePlaceholder}`,
		"purchasePoints: 10",
		"investmentYen: 1000",
		"",
		"【出走表】",
		"1号艇 ...",
		"2号艇 ...",
		"3号艇 ...",
		"4号艇 ...",
		"5号艇 ...",
		"6号艇 ...",
		"",
		"【進入想定】",
		"123/456",
		"",
		"【展示】",
		"未取得 または source-backedな取得内容",
		"",
		"【水面】",
		"天候:",
		"風向:",
		"風速:",
		"波高:",
		"",
		"【展開】",
		"展開予想本文",
		"",
		"【買い目】",
		"01 | 3連単 | 1-2-3 | 厚め",
		"02 | 3連単 | 1-3-2 | 厚め",
		"03 | 3連単 | 1-2-4 | 本線",
		"04 | 3連単 | 1-4-2 | 本線",
		"05 | 3連単 | 2-1-3 | 本線",
		"06 | 3連単 | 2-3-1 | 中穴",
		"07 | 3連単 | 3-1-2 | 中穴",
		"08 | 3連単 | 3-2-1 | 中穴",
		"09 | 3連単 | 4-1-2 | 大穴",
		"10 | 3連単 | 4-2-1 | 大穴",
		"",
		"【設計メモ】",
		"展開根拠と厚め・本線・中穴・大穴の設計理由",
		"```",
	].join("\n");
};

export const applyBoatPredictionGptCopyTimeLabel = (material: string, timeLabel: BoatPredictionVenueTimeKind): string =>
	material.replace(/^時間帯:.*$/m, `時間帯: ${formatBoatPredictionSessionLabel(timeLabel)}`);
