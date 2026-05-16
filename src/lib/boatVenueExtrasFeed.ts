import type { BoatRaceItem, BoatTodayVenueItem } from "./boatraceTypes";
import { withBasePath } from "./assetPath";

export type BoatVenueExtraRace = {
	raceNo?: number;
	[key: string]: unknown;
};

export type BoatVenueExtraVenue = {
	venueCode?: string;
	venueName?: string;
	venue?: string;
	name?: string;
	races?: BoatVenueExtraRace[];
	[key: string]: unknown;
};

export type BoatVenueExtrasFeed = {
	version?: number;
	generatedAt?: string;
	date?: string;
	source?: string;
	venues?: BoatVenueExtraVenue[];
};

export const BOAT_VENUE_EXTRAS_URL = withBasePath("data/boatrace/venue-extras.generated.json");

const buildNoCacheFeedUrl = (url: string): string => {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}ts=${Date.now()}`;
};

const toRecordArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const readString = (value: unknown): string => {
	if (typeof value !== "string") {
		return "";
	}

	return value.trim();
};

const normalizeVenueName = (value: unknown): string =>
	readString(value)
		.normalize("NFKC")
		.replace(/\s+/g, "");

const readVenueDisplayName = (venue: BoatVenueExtraVenue | null | undefined): string =>
	readString(venue?.venueName) || readString(venue?.venue) || readString(venue?.name);

export async function loadBoatVenueExtrasFeed(): Promise<BoatVenueExtrasFeed | null> {
	try {
		const response = await fetch(buildNoCacheFeedUrl(BOAT_VENUE_EXTRAS_URL), { cache: "no-store" });

		if (!response.ok) {
			return null;
		}

		const payload = (await response.json()) as BoatVenueExtrasFeed;
		if (!payload || !Array.isArray(payload.venues)) {
			return null;
		}

		return payload;
	} catch {
		return null;
	}
}

export function findSelectedVenueExtra(
	venueExtrasFeed: BoatVenueExtrasFeed | null,
	selectedVenue: BoatTodayVenueItem | undefined,
): BoatVenueExtraVenue | null {
	if (!venueExtrasFeed || !selectedVenue) {
		return null;
	}

	const venues = toRecordArray<BoatVenueExtraVenue>(venueExtrasFeed.venues);
	if (venues.length === 0) {
		return null;
	}

	const selectedVenueCode = readString(selectedVenue.venueCode);
	if (selectedVenueCode) {
		const matchedByCode = venues.find((venue) => readString(venue.venueCode) === selectedVenueCode);
		if (matchedByCode) {
			return matchedByCode;
		}
	}

	const selectedVenueName = normalizeVenueName(selectedVenue.venueName);
	if (!selectedVenueName) {
		return null;
	}

	return venues.find((venue) => normalizeVenueName(readVenueDisplayName(venue)) === selectedVenueName) ?? null;
}

export function findSelectedRaceExtra(
	selectedVenueExtra: BoatVenueExtraVenue | null,
	selectedRace: BoatRaceItem | undefined,
): BoatVenueExtraRace | null {
	if (!selectedVenueExtra || !selectedRace) {
		return null;
	}

	const raceNo = Number(selectedRace.raceNo);
	if (!Number.isFinite(raceNo)) {
		return null;
	}

	return toRecordArray<BoatVenueExtraRace>(selectedVenueExtra.races).find((race) => Number(race.raceNo) === raceNo) ?? null;
}
