import { load } from "cheerio";

const OFFICIAL_ORIGIN = "https://www.boatrace.jp";

const compactText = (value) => String(value ?? "").replace(/\s+/gu, " ").trim();

const readVenueCode = (href) => {
	try {
		return new URL(String(href ?? ""), OFFICIAL_ORIGIN).searchParams.get("jcd") ?? "";
	} catch {
		return "";
	}
};

const isPartialCancellation = (value) => (
	/(?:\d{1,2}\s*R\s*以降|途中(?:から)?|一部)\s*中止/u.test(value)
);

export function resolveOfficialVenueEventStatus({ statusText, explicitStatus } = {}) {
	const explicit = compactText(explicitStatus).normalize("NFKC").toLowerCase();
	if (["postponed", "postpone", "rescheduled", "順延"].includes(explicit)) {
		return "postponed";
	}
	if (["cancelled", "canceled", "cancel", "中止"].includes(explicit)) {
		return "cancelled";
	}
	if (explicit === "normal") {
		return "normal";
	}

	const officialText = compactText(statusText).normalize("NFKC");
	if (isPartialCancellation(officialText)) {
		return "cancelled";
	}
	if (officialText.includes("順延")) {
		return "postponed";
	}
	if (officialText.includes("中止")) {
		return "cancelled";
	}

	return "normal";
}

export function parseOfficialVenueEventStatuses(html, { date = "" } = {}) {
	const $ = load(String(html ?? ""));
	const statuses = [];

	$("tr").each((_, element) => {
		const row = $(element);
		const titleLink = row.find('a[href*="/owpc/pc/race/raceindex?jcd="]').first();
		const venueImage = row.find("img[alt]").first();
		if (!titleLink.length || !venueImage.length) return;

		const venueCell = venueImage.closest("td");
		const statusCell = venueCell.next("td");
		const venueCode = readVenueCode(titleLink.attr("href"));
		if (!venueCode || !statusCell.length) return;

		const eventStatusText = compactText(statusCell.text());
		const eventStatus = resolveOfficialVenueEventStatus({ statusText: eventStatusText });
		statuses.push({
			date,
			venueCode,
			venueName: compactText(venueImage.attr("alt")),
			eventStatus,
			eventStatusText: eventStatus === "normal" ? "" : eventStatusText,
			rawStatusText: eventStatusText,
			source: "official:owpc-race-index",
		});
	});

	return statuses;
}

export async function fetchOfficialVenueEventStatuses({ targetDate, fetchImpl = fetch } = {}) {
	const date = compactText(targetDate);
	if (!/^\d{4}-\d{2}-\d{2}$/u.test(date)) {
		throw new Error(`targetDate must be YYYY-MM-DD: ${date || "(empty)"}`);
	}

	const dateKey = date.replaceAll("-", "");
	const url = `${OFFICIAL_ORIGIN}/owpc/pc/race/index?hd=${dateKey}`;
	const response = await fetchImpl(url, {
		headers: {
			"user-agent": "boatrace-datalavo/0.1 event-status-refresh",
			accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"accept-language": "ja,en-US;q=0.9,en;q=0.8",
		},
		signal: AbortSignal.timeout(10000),
	});
	if (!response.ok) {
		throw new Error(`official race index request failed: ${response.status} ${response.statusText}`);
	}

	const html = await response.text();
	const statuses = parseOfficialVenueEventStatuses(html, { date });
	if (!statuses.length) {
		throw new Error(`official race index returned no venue rows for ${date}`);
	}

	return { date, url, statuses };
}
