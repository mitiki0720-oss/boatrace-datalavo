import { withBasePath } from "./assetPath";
import type {
	BoatMonthlyDataQuality,
	BoatMonthlyReviewData,
	BoatMonthlyReviewManifest,
} from "../types/boatMonthlyReview";

export const BOAT_MONTHLY_REVIEW_DATA_FILE = "public/data/monthly-review/boat/monthly-review-data.json";
export const BOAT_MONTHLY_REVIEW_DATA_PATH = "data/monthly-review/boat/monthly-review-data.json";
export const BOAT_MONTHLY_REVIEW_MANIFEST_PATH = "data/monthly-review/boat/manifest.json";

const requiredArrays = [
	"monthlyOverview",
	"venueMonthly",
	"venueAllPeriod",
	"payoutBands",
	"ticketRoles",
	"missAnalysis",
	"oneBoatAnalysis",
	"windBands",
	"predictionModes",
	"displayAudit",
	"winnerMotorBands",
	"dataQuality",
	"nextKpi",
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

export function validateBoatMonthlyReviewData(value: unknown): BoatMonthlyReviewData {
	if (!isRecord(value)) {
		throw new Error("Monthly Review JSON is not an object.");
	}

	if (typeof value.generated_at !== "string" || !isRecord(value.period)) {
		throw new Error("Monthly Review metadata is missing.");
	}

	if (typeof value.period.start !== "string" || typeof value.period.end !== "string") {
		throw new Error("Monthly Review period is invalid.");
	}

	for (const key of requiredArrays) {
		if (!Array.isArray(value[key])) {
			throw new Error(`Monthly Review ${key} must be an array.`);
		}
	}

	const monthlyOverview = value.monthlyOverview;
	if (!Array.isArray(monthlyOverview) || monthlyOverview.length === 0 || monthlyOverview.some((item: unknown) => !isRecord(item) || typeof item.month !== "string")) {
		throw new Error("Monthly Review monthlyOverview is empty or invalid.");
	}

	return value as BoatMonthlyReviewData;
}

async function fetchJson(path: string): Promise<unknown> {
	const response = await fetch(withBasePath(path), { cache: "no-store" });
	if (!response.ok) {
		throw new Error(`${path} could not be loaded (${response.status}).`);
	}
	return response.json();
}

export async function loadBoatMonthlyReviewData(): Promise<BoatMonthlyReviewData> {
	return validateBoatMonthlyReviewData(await fetchJson(BOAT_MONTHLY_REVIEW_DATA_PATH));
}

export async function loadBoatMonthlyReviewManifest(): Promise<BoatMonthlyReviewManifest | null> {
	try {
		const value = await fetchJson(BOAT_MONTHLY_REVIEW_MANIFEST_PATH);
		return isRecord(value) ? value as BoatMonthlyReviewManifest : null;
	} catch {
		return null;
	}
}

export function getBoatMonthlyAvailableMonths(data: BoatMonthlyReviewData): string[] {
	return [...new Set(data.monthlyOverview.map((item) => item.month).filter(Boolean))].sort();
}

const monthLastDay = (month: string): number => {
	const match = /^(\d{4})-(\d{2})$/u.exec(month);
	if (!match) return 0;
	return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
};

export function getBoatMonthlyPartialMonths(data: BoatMonthlyReviewData): string[] {
	const months = getBoatMonthlyAvailableMonths(data);
	const startMatch = /^(\d{4}-\d{2})-(\d{2})$/u.exec(data.period.start);
	const endMatch = /^(\d{4}-\d{2})-(\d{2})$/u.exec(data.period.end);
	const partial = new Set<string>();

	if (startMatch && Number(startMatch[2]) !== 1 && months.includes(startMatch[1])) {
		partial.add(startMatch[1]);
	}
	if (endMatch && Number(endMatch[2]) !== monthLastDay(endMatch[1]) && months.includes(endMatch[1])) {
		partial.add(endMatch[1]);
	}

	return [...partial].sort();
}

export function getBoatMonthlyQualityCount(data: BoatMonthlyReviewData, item: string): number | null {
	return data.dataQuality.find((entry: BoatMonthlyDataQuality) => entry.item === item)?.count ?? null;
}
