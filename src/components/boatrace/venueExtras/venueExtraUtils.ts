import type { VenueExtraVenueFlags } from "./venueExtraTypes";

export function isVenueExtraRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readVenueExtraString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

export function readVenueExtraNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

export function readVenueExtraStringArray(value: unknown, limit: number): string[] {
	return Array.isArray(value)
		? value.map((item) => readVenueExtraString(item)).slice(0, limit)
		: [];
}

export function readVenueExtraRate(count: string, total: string): string {
	const countValue = Number.parseFloat(count);
	const totalValue = Number.parseFloat(total);

	if (!Number.isFinite(countValue) || !Number.isFinite(totalValue) || totalValue <= 0) {
		return "";
	}

	return ((countValue / totalValue) * 100).toFixed(1);
}

export function sumVenueExtraRates(...values: string[]): string {
	const numbers = values.map((value) => Number.parseFloat(value));

	if (numbers.some((value) => !Number.isFinite(value))) {
		return "";
	}

	return numbers.reduce((total, value) => total + value, 0).toFixed(1);
}

export function getOfficialStartTimingValue(startTiming: string): string {
	const normalized = startTiming.trim();
	return normalized.replace(/^[FL]/i, "") || "-";
}

export function getOfficialStartFlag(startTiming: string): string {
	const normalized = startTiming.trim().toUpperCase();
	if (normalized.startsWith("F")) {
		return "F";
	}

	if (normalized.startsWith("L")) {
		return "L";
	}

	return "-";
}

export function normalizeVenueExtraPlayerName(value: string | null | undefined): string {
	return typeof value === "string" ? value.replace(/\s+/g, "") : "";
}

export function getVenueExtraVenueFlags(venueName: string | null | undefined): VenueExtraVenueFlags {
	return {
		isNarutoVenue: venueName === "鳴門",
		isBiwakoVenue: venueName === "びわこ",
		isTamagawaVenue: venueName === "多摩川",
		isTsuVenue: venueName === "津",
		isWakamatsuVenue: venueName === "若松",
		isFukuokaVenue: venueName === "福岡",
		isKojimaVenue: venueName === "児島",
		isOmuraVenue: venueName === "大村",
		isMarugameVenue: venueName === "丸亀",
	};
}
