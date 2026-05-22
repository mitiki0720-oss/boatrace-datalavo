import { withBasePath } from "./assetPath";

export type BoatReviewArchiveItem = {
	date: string;
	venueName: string;
	venueSlug: string;
	predictionFile?: string | null;
	resultFile?: string | null;
	summaryFile?: string | null;
};

export type BoatReviewArchiveIndex = {
	generatedAt?: string;
	items: BoatReviewArchiveItem[];
};

export type BoatReviewArchiveVenueFiles = {
	predictionsText: string | null;
	resultsText: string | null;
	summaryText: string | null;
};

const BOAT_REVIEW_ARCHIVE_INDEX_URL = "data/boatrace/reviews/index.json";

async function fetchTextFile(path: string | null | undefined): Promise<string | null> {
	if (!path) return null;

	try {
		const response = await fetch(withBasePath(`data/boatrace/reviews/${path}`), { cache: "no-store" });
		if (!response.ok) return null;
		return await response.text();
	} catch {
		return null;
	}
}

export async function loadBoatReviewArchiveIndex(): Promise<BoatReviewArchiveIndex> {
	try {
		const response = await fetch(withBasePath(BOAT_REVIEW_ARCHIVE_INDEX_URL), { cache: "no-store" });
		if (!response.ok) return { items: [] };

		const payload = await response.json() as Partial<BoatReviewArchiveIndex>;
		return {
			generatedAt: payload.generatedAt,
			items: Array.isArray(payload.items) ? payload.items.filter((item) => item?.date && item?.venueSlug) as BoatReviewArchiveItem[] : [],
		};
	} catch {
		return { items: [] };
	}
}

export async function loadBoatReviewArchiveVenueFiles(item: BoatReviewArchiveItem): Promise<BoatReviewArchiveVenueFiles> {
	const [predictionsText, resultsText, summaryText] = await Promise.all([
		fetchTextFile(item.predictionFile),
		fetchTextFile(item.resultFile),
		fetchTextFile(item.summaryFile),
	]);

	return {
		predictionsText,
		resultsText,
		summaryText,
	};
}

export function getBoatReviewArchiveDates(index: BoatReviewArchiveIndex): string[] {
	return Array.from(new Set(index.items.map((item) => item.date))).sort((a, b) => b.localeCompare(a));
}

export function getBoatReviewArchiveItemsByDate(index: BoatReviewArchiveIndex, date: string): BoatReviewArchiveItem[] {
	return index.items.filter((item) => item.date === date);
}
