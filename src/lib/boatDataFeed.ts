import type { BoatRaceItem, BoatTodayFeed } from "./boatraceTypes";

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

export const BOAT_TODAY_FEED_URL = "/data/boatrace/today.generated.json";
export const BOAT_UPCOMING_SCHEDULE_URL = "/data/boatrace/upcoming-schedule.generated.json";
export const BOAT_TODAY_RACE_DETAILS_URL = "/data/boatrace/today-race-details.generated.json";

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
