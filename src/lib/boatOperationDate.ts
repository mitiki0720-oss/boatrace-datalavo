const JST_TIME_ZONE = "Asia/Tokyo";
export const BOAT_OPERATIONAL_DAY_ROLLOVER_HOUR = 6;

export function formatBoatOperationDate(date: Date): string {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: JST_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

export function getBoatOperationDate(baseDate = new Date()): string {
	const hourPart = new Intl.DateTimeFormat("ja-JP", {
		timeZone: JST_TIME_ZONE,
		hour: "2-digit",
		hour12: false,
	}).formatToParts(baseDate).find((part) => part.type === "hour")?.value ?? "0";
	const hour = Number(hourPart);
	const operationalDate = new Date(baseDate);

	if (hour < BOAT_OPERATIONAL_DAY_ROLLOVER_HOUR) {
		operationalDate.setDate(operationalDate.getDate() - 1);
	}

	return formatBoatOperationDate(operationalDate);
}

export function shiftBoatOperationDate(dateText: string, days: number): string {
	const date = new Date(`${dateText}T00:00:00+09:00`);
	date.setDate(date.getDate() + days);
	return formatBoatOperationDate(date);
}

export function resolveActiveBoatOperationDate(feedDate?: string | null): string {
	return String(feedDate || "").trim() || getBoatOperationDate();
}

export function getPreviousBoatOperationDate(baseDate = new Date()): string {
	return shiftBoatOperationDate(getBoatOperationDate(baseDate), -1);
}
