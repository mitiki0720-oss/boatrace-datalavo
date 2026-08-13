import type { BoatRaceItem, BoatTodayVenueItem } from "./boatraceTypes";

export type BoatPredictionVenueTimeKind = "morning" | "day" | "night" | "midnight";

const CLOCK_PATTERN = /(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/;

export const readBoatPredictionCopyTimeMinutes = (value: string | undefined): number | null => {
	const match = value?.match(CLOCK_PATTERN);
	if (!match) {
		return null;
	}

	const hour = Number(match[1]);
	const minute = Number(match[2]);
	return hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
};

const raceMinutes = (race: BoatRaceItem): number | null =>
	readBoatPredictionCopyTimeMinutes(race.deadlineTime) ?? readBoatPredictionCopyTimeMinutes(race.startTime);

export const getBoatPredictionVenueTimeKind = (venue: BoatTodayVenueItem, races: BoatRaceItem[]): BoatPredictionVenueTimeKind => {
	const title = `${venue.title ?? ""} ${venue.venueName}`;
	const minutes = races.map(raceMinutes).filter((value): value is number => value !== null).sort((left, right) => left - right);
	const firstClosingTime = minutes[0] ?? null;
	const latestClosingTime = minutes.length > 0 ? minutes[minutes.length - 1] : null;

	if (title.includes("ミッドナイト") || (latestClosingTime !== null && latestClosingTime >= 21 * 60) || (
		firstClosingTime !== null && firstClosingTime >= 17 * 60 && latestClosingTime !== null && latestClosingTime >= 21 * 60
	)) {
		return "midnight";
	}
	if (firstClosingTime !== null && firstClosingTime < 10 * 60 + 30) {
		return "morning";
	}
	if (firstClosingTime !== null && firstClosingTime >= 17 * 60) {
		return "night";
	}

	return "day";
};

export const getBoatPredictionRaceTimeLabel = (
	venueTimeKind: BoatPredictionVenueTimeKind,
	race: BoatRaceItem,
): BoatPredictionVenueTimeKind => {
	if (venueTimeKind === "midnight") {
		return "midnight";
	}

	const closingTime = raceMinutes(race);
	if (closingTime === null) {
		return venueTimeKind;
	}
	if (closingTime < 10 * 60 + 30) {
		return "morning";
	}
	if (closingTime < 17 * 60) {
		return "day";
	}
	if (closingTime < 21 * 60) {
		return "night";
	}

	return "midnight";
};

export const getBoatPredictionRangePurposeLabel = (
	venueTimeKind: BoatPredictionVenueTimeKind,
	raceRange: "1R〜6R" | "7R〜12R",
): string => {
	const rangeLabel = raceRange === "1R〜6R" ? "前半予想用" : "後半予想用";
	const prefix = {
		morning: "モーニング",
		day: "デイ",
		night: "ナイター",
		midnight: "ミッドナイト",
	}[venueTimeKind];

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
	material.replace(/^時間帯:.*$/m, `時間帯: ${timeLabel}`);
