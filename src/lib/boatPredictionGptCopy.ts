import type { BoatRaceItem, BoatTodayVenueItem } from "./boatraceTypes";

export type BoatPredictionVenueTimeKind = "morning" | "summer" | "day" | "night" | "midnight" | "unknown";

type SessionSourceRecord = {
	session?: unknown;
	sessionType?: unknown;
	sessionLabel?: unknown;
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

export const getBoatPredictionVenueTimeKind = (venue: BoatTodayVenueItem, races: BoatRaceItem[]): BoatPredictionVenueTimeKind => {
	const venueSession = readExplicitSession(venue as SessionSourceRecord);
	if (venueSession) return venueSession;

	const titleSession = normalizeBoatPredictionSession(venue.title);
	if (titleSession) return titleSession;

	const raceSessions = new Set(
		races
			.map((race) => readExplicitSession(race as SessionSourceRecord))
			.filter((session): session is BoatPredictionVenueTimeKind => session !== null),
	);
	return raceSessions.size === 1 ? [...raceSessions][0] : "unknown";
};

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

export const applyBoatPredictionGptCopyTimeLabel = (material: string, timeLabel: BoatPredictionVenueTimeKind): string =>
	material.replace(/^時間帯:.*$/m, `時間帯: ${formatBoatPredictionSessionLabel(timeLabel)}`);
