import type { BoatRaceItem, BoatTodayVenueItem } from "./boatraceTypes";

const toLooseRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const readLooseString = (value: unknown): string => {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
};

const normalizeLooseText = (value: unknown): string => readLooseString(value).normalize("NFKC").trim();

const extractBoatSeriesDayLabel = (value: unknown): string => {
	const rawText = readLooseString(value).replace(/\s+/g, "");
	const dayText = rawText.replace(/^.*\d{1,2}\/\d{1,2}/, "");
	const normalized = normalizeLooseText(dayText || rawText).replace(/\s+/g, "");
	if (!normalized) return "";

	if (normalized.includes("優勝戦")) return "優勝戦日";
	if (normalized.includes("準優")) return "準優日";
	if (normalized.includes("最終日")) return "最終日";
	if (normalized.includes("初日")) return "初日";

	const dayMatch = normalized.match(/([0-9]+)日目/);
	if (dayMatch) return `${Number(dayMatch[1])}日目`;

	const bareNumberMatch = normalized.match(/^([0-9]+)$/);
	if (bareNumberMatch) return `${Number(bareNumberMatch[1])}日目`;

	return "";
};

export const resolveBoatVenueDayLabel = (venue: BoatTodayVenueItem, races: BoatRaceItem[] = venue.races): string => {
	const venueRecord = toLooseRecord(venue);
	const dayFieldNames = ["seriesDayLabel", "dayLabel", "eventDayLabel", "roundDayLabel", "dayText"];
	for (const fieldName of dayFieldNames) {
		const extractedVenueLabel = extractBoatSeriesDayLabel(venueRecord[fieldName]);
		if (extractedVenueLabel) return extractedVenueLabel;
	}

	for (const race of races) {
		const raceRecord = toLooseRecord(race);
		for (const fieldName of dayFieldNames) {
			const extractedRaceLabel = extractBoatSeriesDayLabel(raceRecord[fieldName]);
			if (extractedRaceLabel) return extractedRaceLabel;
		}
	}

	const textFields = ["seriesName", "eventName", "title", "raceName", "name"];
	for (const record of [venueRecord, ...races.map(toLooseRecord)]) {
		for (const fieldName of textFields) {
			const extractedLabel = extractBoatSeriesDayLabel(record[fieldName]);
			if (extractedLabel) return extractedLabel;
		}
	}

	for (const record of [venueRecord, ...races.map(toLooseRecord)]) {
		for (const fieldName of ["day", "eventDay", "seriesDay", "roundDay"]) {
			const value = Number(normalizeLooseText(record[fieldName]));
			if (Number.isFinite(value) && value > 0) return `${value}日目`;
		}
	}

	return "日目未取得";
};
