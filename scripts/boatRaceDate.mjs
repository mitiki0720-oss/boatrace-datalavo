const JST_TIME_ZONE = "Asia/Tokyo";

function formatJstParts(date = new Date()) {
	const formatter = new Intl.DateTimeFormat("sv-SE", {
		timeZone: JST_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});

	return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function getTodayIsoJst(date = new Date()) {
	const parts = formatJstParts(date);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

export function normalizeTargetDate(value, fallbackDate = getTodayIsoJst()) {
	const normalized = String(value ?? "").trim();
	return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : fallbackDate;
}

export function getJstTimestampParts(targetDate, now = new Date()) {
	const parts = formatJstParts(now);
	const date = normalizeTargetDate(targetDate, `${parts.year}-${parts.month}-${parts.day}`);

	return {
		date,
		dateKey: date.replaceAll("-", ""),
		hour: Number.parseInt(parts.hour, 10),
		minute: Number.parseInt(parts.minute, 10),
		generatedAt: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`,
	};
}

export function getJstTimestamp(now = new Date()) {
	return getJstTimestampParts(undefined, now).generatedAt;
}