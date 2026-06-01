import type { BoatRaceItem, BoatTodayFeed } from "./boatraceTypes";
import { withBasePath } from "./assetPath";
import { formatBoatOperationDate, shiftBoatOperationDate } from "./boatOperationDate";

export type BoatUpcomingScheduleItem = {
	id: string;
	venueName: string;
	title: string;
	grade?: string;
	startDate: string;
	endDate: string;
	dateRange?: string;
	session?: string;
	note?: string;
};

export type BoatUpcomingScheduleFeed = {
	version?: number;
	generatedAt?: string;
	source?: string;
	items: BoatUpcomingScheduleItem[];
};

export const BOAT_TODAY_FEED_URL = withBasePath("data/boatrace/today.generated.json");
export const BOAT_UPCOMING_SCHEDULE_URL = withBasePath("data/boatrace/upcoming-schedule.generated.json");
export const BOAT_TODAY_RACE_DETAILS_URL = withBasePath("data/boatrace/today-race-details.generated.json");

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

function normalizeBoatVenueRacesToTwelve(feed: BoatTodayFeed): BoatTodayFeed {
	return {
		...feed,
		venues: feed.venues.map((venue) => {
			const existingRaceMap = new Map((venue.races ?? []).map((race) => [race.raceNo, race]));
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

export async function loadBoatTodayFeed(): Promise<BoatTodayFeed | null> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_TODAY_FEED_URL), { cache: "no-store" });

		if (!response.ok) {
			return null;
		}

		return (await response.json()) as BoatTodayFeed;
	} catch {
		return null;
	}
}

export async function loadBoatUpcomingSchedule(): Promise<BoatUpcomingScheduleFeed | null> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_UPCOMING_SCHEDULE_URL), { cache: "no-store" });

		if (!response.ok) {
			return null;
		}

		return (await response.json()) as BoatUpcomingScheduleFeed;
	} catch {
		return null;
	}
}

export async function loadBoatTodayRaceDetailsFeed(): Promise<BoatTodayFeed | null> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_TODAY_RACE_DETAILS_URL), { cache: "no-store" });

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as BoatTodayFeed;

		return normalizeBoatVenueRacesToTwelve(payload);
	} catch {
		return null;
	}
}
