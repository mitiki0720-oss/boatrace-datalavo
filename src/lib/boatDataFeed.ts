import type { BoatRaceItem, BoatTodayFeed } from "./boatraceTypes";
import { withBasePath } from "./assetPath";
import { formatBoatOperationDate, getBoatOperationDate, shiftBoatOperationDate } from "./boatOperationDate";

export type BoatUpcomingScheduleItem = {
	id: string;
	date: string;
	venueCode: string;
	venueName: string;
	seriesName: string;
	title: string;
	grade?: string;
	startDate: string;
	endDate: string;
	dateRange?: string;
	session?: string;
	note?: string;
	sourceUrl: string;
	sourceMonthUrl: string;
	updatedAt: string;
};

export type BoatUpcomingScheduleFeed = {
	version?: number;
	generatedAt?: string;
	source?: string;
	sourceStatus?: string;
	range?: { startDate: string; endDate: string };
	items: BoatUpcomingScheduleItem[];
};

export type BoatUpcomingScheduleState =
	| { status: "available"; items: BoatUpcomingScheduleItem[]; generatedAt: string }
	| { status: "verified-none"; items: []; generatedAt: string }
	| { status: "unavailable"; items: []; reason: string };

const unavailableSchedule = (reason: string): BoatUpcomingScheduleState => ({ status: "unavailable", items: [], reason });

function asScheduleRecord(value: unknown): Record<string, unknown> | null {
	return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function isScheduleDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isScheduleTimestamp(value: unknown): value is string {
	return typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value));
}

function scheduleTimestampJstDate(value: string): string {
	return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function officialMonthlyScheduleUrl(value: unknown, monthKey?: string): boolean {
	if (typeof value !== "string") return false;
	try {
		const url = new URL(value);
		return url.origin === "https://www.boatrace.jp" && url.pathname === "/owsp/sp/race/monthlyschedule" &&
			url.searchParams.getAll("ym").length === 1 && /^\d{6}$/.test(url.searchParams.get("ym") ?? "") &&
			(!monthKey || url.searchParams.get("ym") === monthKey);
	} catch {
		return false;
	}
}

function officialBoatRaceUrl(value: unknown): boolean {
	if (typeof value !== "string") return false;
	try { return new URL(value).origin === "https://www.boatrace.jp"; } catch { return false; }
}

function monthKeysInRange(range: { startDate: string; endDate: string }): string[] {
	const first = Number(range.startDate.slice(0, 4)) * 12 + Number(range.startDate.slice(5, 7)) - 1;
	const last = Number(range.endDate.slice(0, 4)) * 12 + Number(range.endDate.slice(5, 7)) - 1;
	return Array.from({ length: last - first + 1 }, (_, offset) => {
		const index = first + offset;
		return `${Math.floor(index / 12)}${String(index % 12 + 1).padStart(2, "0")}`;
	});
}

function hasVerifiedNoScheduleEvidence(feed: Record<string, unknown>, range: { startDate: string; endDate: string }): boolean {
	const evidence = asScheduleRecord(feed.noScheduleEvidence);
	const evidenceRange = asScheduleRecord(evidence?.range);
	const pages = evidence?.pages;
	if (evidence?.kind !== "official-monthly-pages-verified-empty" || evidenceRange?.startDate !== range.startDate ||
		evidenceRange?.endDate !== range.endDate || !Array.isArray(pages)) return false;
	const months = monthKeysInRange(range);
	if (pages.length !== months.length) return false;
	return months.every((monthKey) => pages.some((value: unknown) => {
		const page = asScheduleRecord(value);
		return page?.monthKey === monthKey && officialMonthlyScheduleUrl(page.url, monthKey) &&
			isScheduleTimestamp(page.retrievedAt) && typeof page.sha256 === "string" && /^[a-f0-9]{64}$/i.test(page.sha256) &&
			page.finding === "no-events-in-range";
	}));
}

function isVerifiedScheduleItem(value: unknown, range: { startDate: string; endDate: string }): value is BoatUpcomingScheduleItem {
	const item = asScheduleRecord(value);
	if (!item || !["id", "venueName", "title", "seriesName"].every((key) => typeof item[key] === "string" && String(item[key]).trim()) ||
		!/^\d{2}$/.test(String(item.venueCode ?? "")) || !isScheduleDate(item.date) ||
		!isScheduleDate(item.startDate) || !isScheduleDate(item.endDate) ||
		item.startDate > item.date || item.date > item.endDate || item.date < range.startDate || item.date > range.endDate ||
		!officialMonthlyScheduleUrl(item.sourceMonthUrl) || !monthKeysInRange(range).includes(new URL(String(item.sourceMonthUrl)).searchParams.get("ym") ?? "") ||
		!officialBoatRaceUrl(item.sourceUrl) || !isScheduleTimestamp(item.updatedAt)) return false;
	return true;
}

export function classifyBoatUpcomingSchedule(
	value: unknown,
	range = getBoatScheduleVisibleDateRange(),
): BoatUpcomingScheduleState {
	const feed = asScheduleRecord(value);
	const feedRange = asScheduleRecord(feed?.range);
	if (!feed || feed.version !== 1 || feed.source !== "boatrace-official-monthly-schedule" ||
		!isScheduleTimestamp(feed.generatedAt) || !feedRange || feedRange.startDate !== range.startDate ||
		feedRange.endDate !== range.endDate || !Array.isArray(feed.items)) return unavailableSchedule("invalid-feed-or-range");
	if (scheduleTimestampJstDate(feed.generatedAt) !== range.startDate) return unavailableSchedule("stale-generated-at");
	if (feed.sourceStatus === "no-schedule" && feed.items.length === 0 && hasVerifiedNoScheduleEvidence(feed, range)) {
		return { status: "verified-none", items: [], generatedAt: feed.generatedAt };
	}
	if (feed.sourceStatus !== "ok" || feed.items.length === 0) return unavailableSchedule("unverified-empty-or-status");
	const keys = new Set<string>();
	const ids = new Set<string>();
	for (const item of feed.items) {
		if (!isVerifiedScheduleItem(item, range)) return unavailableSchedule("invalid-schedule-item");
		const key = `${item.date}-${item.venueCode}`;
		if (keys.has(key) || ids.has(item.id)) return unavailableSchedule("duplicate-schedule-item");
		keys.add(key);
		ids.add(item.id);
	}
	return { status: "available", items: feed.items as BoatUpcomingScheduleItem[], generatedAt: feed.generatedAt };
}

export function getBoatUpcomingScheduleDisplay(state: BoatUpcomingScheduleState): {
	items: BoatUpcomingScheduleItem[]; countLabel: string; metricValue: string; message: string | null; updatedAt: string;
} {
	if (state.status === "available") return { items: state.items, countLabel: `${state.items.length}開催`, metricValue: `${state.items.length} meets`, message: null, updatedAt: state.generatedAt };
	if (state.status === "verified-none") return { items: [], countLabel: "0開催", metricValue: "0 meets", message: "公式に確認された期間内の開催予定はありません。", updatedAt: state.generatedAt };
	return { items: [], countLabel: "確認中", metricValue: "確認中", message: "開催日程を確認できません。データ更新待ちです。", updatedAt: "" };
}

export const BOAT_TODAY_FEED_URL = withBasePath("data/boatrace/today.generated.json");
export const BOAT_UPCOMING_SCHEDULE_URL = withBasePath("data/boatrace/upcoming-schedule.generated.json");
export const BOAT_TODAY_RACE_DETAILS_URL = withBasePath("data/boatrace/today-race-details.generated.json");
export const BOAT_TODAY_WAITING_MESSAGE_LINES = [
	"本日のレースデータを取得中です",
	"日付切替後の最新開催情報を反映しています。",
	"少し時間を置いて再読み込みしてください。",
] as const;

export type BoatTodayFeedLoadOptions = {
	activeDate?: string;
	now?: Date;
};

export function getBoatTodayFeedActiveDate(options: BoatTodayFeedLoadOptions = {}): string {
	return String(options.activeDate || getBoatOperationDate(options.now)).trim();
}

export function isBoatTodayFeedForActiveDate(feed: BoatTodayFeed | null | undefined, activeDate = getBoatTodayFeedActiveDate()): feed is BoatTodayFeed {
	return Boolean(feed && String(feed.date || "").trim() === activeDate);
}

export function createBoatTodayWaitingFeed(activeDate = getBoatTodayFeedActiveDate()): BoatTodayFeed {
	return {
		version: 1,
		date: activeDate,
		generatedAt: "",
		source: "waiting-for-active-date-feed",
		venues: [],
	};
}

export function getBoatScheduleVisibleDateRange(baseDate = new Date()): { startDate: string; endDate: string } {
	const startDate = formatBoatOperationDate(baseDate);
	return {
		startDate,
		endDate: shiftBoatOperationDate(startDate, 31),
	};
}

export function filterBoatUpcomingScheduleByDateRange(
	items: BoatUpcomingScheduleItem[],
	range = getBoatScheduleVisibleDateRange(),
): BoatUpcomingScheduleItem[] {
	return items.filter((item) => {
		const startDate = String(item.startDate ?? "").trim();
		const endDate = String(item.endDate || item.startDate || "").trim();

		if (!startDate && !endDate) {
			return false;
		}

		const effectiveStartDate = startDate || endDate;
		const effectiveEndDate = endDate || startDate;
		return effectiveEndDate >= range.startDate && effectiveStartDate <= range.endDate;
	});
}

function buildNoCacheFeedUrl(url: string): string {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}ts=${Date.now()}`;
}

function createPlaceholderRace(venueId: string, raceNo: number): BoatRaceItem {
	return {
		raceNo,
		raceId: `${venueId}-${String(raceNo).padStart(2, "0")}`,
		title: `${raceNo}R`,
		deadlineTime: "",
		startTime: "",
		status: "scheduled",
		racers: [],
		exhibitions: [],
		oddsPreview: [],
		result: {
			status: "pending",
			finishOrder: [],
		},
		memo: "generated placeholder",
	};
}

export function normalizeBoatRaceNo(value: unknown): number | null {
	if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12) {
		return value;
	}

	const match = String(value ?? "").trim().match(/^0*([1-9]|1[0-2])\s*(?:R)?$/iu);
	return match ? Number(match[1]) : null;
}

function normalizeBoatVenueRacesToTwelve(feed: BoatTodayFeed): BoatTodayFeed {
	return {
		...feed,
		venues: feed.venues.map((venue) => {
			const existingRaceMap = new Map<number, BoatRaceItem>();
			for (const race of venue.races ?? []) {
				const raceNo = normalizeBoatRaceNo(race.raceNo);
				if (raceNo !== null && !existingRaceMap.has(raceNo)) {
					existingRaceMap.set(raceNo, { ...race, raceNo });
				}
			}
			const normalizedRaces = Array.from({ length: 12 }, (_, index) => {
				const raceNo = index + 1;
				return existingRaceMap.get(raceNo) ?? createPlaceholderRace(venue.id, raceNo);
			});

			return {
				...venue,
				races: normalizedRaces,
			};
		}),
	};
}

export async function loadBoatTodayFeed(options: BoatTodayFeedLoadOptions = {}): Promise<BoatTodayFeed | null> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_TODAY_FEED_URL), { cache: "no-store" });

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as BoatTodayFeed;
		return isBoatTodayFeedForActiveDate(payload, getBoatTodayFeedActiveDate(options)) ? payload : null;
	} catch {
		return null;
	}
}

export async function loadBoatUpcomingSchedule(range = getBoatScheduleVisibleDateRange()): Promise<BoatUpcomingScheduleState> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_UPCOMING_SCHEDULE_URL), { cache: "no-store" });

		if (!response.ok) {
			return unavailableSchedule(`http-${response.status}`);
		}

		return classifyBoatUpcomingSchedule(await response.json(), range);
	} catch {
		return unavailableSchedule("fetch-or-json-error");
	}
}

export async function loadBoatTodayRaceDetailsFeed(options: BoatTodayFeedLoadOptions = {}): Promise<BoatTodayFeed | null> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_TODAY_RACE_DETAILS_URL), { cache: "no-store" });

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as BoatTodayFeed;
		if (!isBoatTodayFeedForActiveDate(payload, getBoatTodayFeedActiveDate(options))) {
			return null;
		}

		return normalizeBoatVenueRacesToTwelve(payload);
	} catch {
		return null;
	}
}
