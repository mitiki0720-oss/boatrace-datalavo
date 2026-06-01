export const BOAT_OPERATIONAL_DAY_ROLLOVER_HOUR = 6;
export const JST_TIME_ZONE = "Asia/Tokyo";

export function formatJstDateKey(date = new Date()) {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: JST_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

export function getJstHour(date = new Date()) {
	const hourPart = new Intl.DateTimeFormat("ja-JP", {
		timeZone: JST_TIME_ZONE,
		hour: "2-digit",
		hour12: false,
	}).formatToParts(date).find((part) => part.type === "hour")?.value ?? "0";
	return Number(hourPart);
}

export function shiftBoatOperationalDateKey(dateKey, days) {
	const date = new Date(`${dateKey}T00:00:00+09:00`);
	date.setDate(date.getDate() + days);
	return formatJstDateKey(date);
}

export function getBoatOperationalDateKey(baseDate = new Date()) {
	const operationalDate = new Date(baseDate);
	if (getJstHour(baseDate) < BOAT_OPERATIONAL_DAY_ROLLOVER_HOUR) {
		operationalDate.setDate(operationalDate.getDate() - 1);
	}
	return formatJstDateKey(operationalDate);
}

export function getPreviousBoatOperationalDateKey(baseDate = new Date()) {
	return shiftBoatOperationalDateKey(getBoatOperationalDateKey(baseDate), -1);
}

export function getJstIsoString(date = new Date()) {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("sv-SE", {
			timeZone: JST_TIME_ZONE,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hour12: false,
		}).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
	);
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000+09:00`;
}
