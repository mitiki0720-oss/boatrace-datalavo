import { withBasePath } from "./assetPath";

export type BoatReviewArchiveItem = {
	date: string;
	venueName: string;
	venueSlug: string;
	predictionFile?: string | null;
	resultFile?: string | null;
	summaryFile?: string | null;
	predictionSizeBytes?: number | null;
	resultSizeBytes?: number | null;
	summarySizeBytes?: number | null;
};

export type BoatReviewArchiveIndex = {
	generatedAt?: string;
	source?: string;
	items: BoatReviewArchiveItem[];
};

export type BoatReviewArchiveVenueFiles = {
	predictionsText: string | null;
	resultsText: string | null;
	summaryText: string | null;
};

const BOAT_REVIEW_ARCHIVE_INDEX_URLS = [
	"data/reviews/index.json",
	"data/boatrace/reviews/index.json",
];
const BOAT_REVIEW_ARCHIVE_FILE_PREFIXES = [
	"data/reviews",
	"data/boatrace/reviews",
];

async function fetchTextFile(path: string | null | undefined): Promise<string | null> {
	if (!path) return null;

	for (const prefix of BOAT_REVIEW_ARCHIVE_FILE_PREFIXES) {
		try {
			const response = await fetch(withBasePath(`${prefix}/${path}`), { cache: "no-store" });
			if (!response.ok) {
				continue;
			}
			return await response.text();
		} catch {
			continue;
		}
	}

	return null;
}

export async function loadBoatReviewArchiveIndex(): Promise<BoatReviewArchiveIndex> {
	for (const indexUrl of BOAT_REVIEW_ARCHIVE_INDEX_URLS) {
		try {
			const response = await fetch(withBasePath(indexUrl), { cache: "no-store" });
			if (!response.ok) {
				continue;
			}

			const payload = await response.json() as Partial<BoatReviewArchiveIndex>;
			return {
				generatedAt: payload.generatedAt,
				source: payload.source,
				items: Array.isArray(payload.items) ? payload.items.filter((item) => item?.date && item?.venueSlug) as BoatReviewArchiveItem[] : [],
			};
		} catch {
			continue;
		}
	}

	return { items: [] };
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
