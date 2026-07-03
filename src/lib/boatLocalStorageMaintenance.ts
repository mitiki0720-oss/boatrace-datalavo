import {
	loadBoatPredictionRecords,
	pruneBoatPredictionRecordsByDate,
	saveBoatPredictionRecords,
	type SaveBoatPredictionRecordsResult,
} from "./boatPredictionStorage";
import {
	loadBoatPracticeResultRecords,
	isBoatPracticePayoutPending,
	pruneBoatPracticeResultRecordsByDate,
	saveBoatPracticeResultRecords,
	type SaveBoatPracticeResultRecordsResult,
} from "./boatPracticeResultStorage";
import {
	loadBoatJohnsonPredictionRecords,
	pruneBoatJohnsonPredictionRecordsByDate,
	saveBoatJohnsonPredictionRecords,
	type SaveBoatJohnsonPredictionRecordsResult,
} from "./boatJohnsonPredictionStorage";
import { getBoatReviewVenueSlug } from "./boatReviewSummaryBuilder";

export const BOAT_REVIEW_DRAFT_STORAGE_KEY = "kurari-boat-data-labo-review-summary-drafts";

export type BoatVenueStorageTarget = {
	date: string;
	venueSlug?: string;
	venueName?: string;
	venueCode?: string;
};

export type BoatVenueStorageCleanupScope = "summary-draft" | "race-records" | "all";

export type BoatVenueStorageCleanupInspection = {
	target: BoatVenueStorageTarget;
	counts: {
		summaryDrafts: number;
		predictions: number;
		practiceResults: number;
		johnsonPredictions: number;
		total: number;
	};
	hasMemo: boolean;
	hasPayoutPending: boolean;
	estimatedBytes: number;
};

export type BoatVenueStorageCleanupResult = BoatVenueStorageCleanupInspection & {
	scope: BoatVenueStorageCleanupScope;
	ok: boolean;
	removedCount: number;
	usageBytesBefore: number;
	usageBytesAfter: number;
};

type VenueRecord = {
	date?: string;
	venueCode?: string;
	venueName?: string;
};

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const normalizeVenueValue = (value: unknown): string =>
	String(value ?? "").normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();

const matchesBoatVenueStorageTarget = (record: VenueRecord, target: BoatVenueStorageTarget): boolean => {
	if (String(record.date ?? "") !== target.date) {
		return false;
	}

	const targetCode = normalizeVenueValue(target.venueCode);
	const targetName = normalizeVenueValue(target.venueName);
	const targetSlug = normalizeVenueValue(target.venueSlug);
	const recordCode = normalizeVenueValue(record.venueCode);
	const recordName = normalizeVenueValue(record.venueName);
	const recordSlug = normalizeVenueValue(getBoatReviewVenueSlug(record.venueName));

	return Boolean(
		(targetCode && recordCode && targetCode === recordCode) ||
		(targetName && recordName && targetName === recordName) ||
		(targetSlug && recordSlug && targetSlug === recordSlug),
	);
};

const readReviewDrafts = (): Record<string, string> => {
	if (!canUseStorage()) {
		return {};
	}

	try {
		const raw = window.localStorage.getItem(BOAT_REVIEW_DRAFT_STORAGE_KEY);
		if (!raw) {
			return {};
		}
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? parsed as Record<string, string>
			: {};
	} catch {
		return {};
	}
};

const getTargetDraftKeys = (drafts: Record<string, string>, target: BoatVenueStorageTarget): string[] => {
	const identifiers = [target.venueSlug, target.venueName, target.venueCode]
		.map(normalizeVenueValue)
		.filter(Boolean);

	return Object.keys(drafts).filter((key) => {
		const separatorIndex = key.indexOf(":");
		if (separatorIndex < 0 || key.slice(0, separatorIndex) !== target.date) {
			return false;
		}
		return identifiers.includes(normalizeVenueValue(key.slice(separatorIndex + 1)));
	});
};

const getJsonBytes = (value: unknown): number => new Blob([JSON.stringify(value)]).size;

export function getBoatLocalStorageUsageBytes(): number {
	if (!canUseStorage()) {
		return 0;
	}

	let bytes = 0;
	for (let index = 0; index < window.localStorage.length; index += 1) {
		const key = window.localStorage.key(index);
		if (!key) continue;
		bytes += new Blob([key, window.localStorage.getItem(key) ?? ""]).size;
	}
	return bytes;
}

export function inspectBoatVenueLocalStorage(
	target: BoatVenueStorageTarget,
): BoatVenueStorageCleanupInspection {
	const drafts = readReviewDrafts();
	const draftKeys = getTargetDraftKeys(drafts, target);
	const predictions = Object.values(loadBoatPredictionRecords()).filter((record) =>
		matchesBoatVenueStorageTarget(record, target));
	const practiceResults = Object.values(loadBoatPracticeResultRecords()).filter((record) =>
		matchesBoatVenueStorageTarget(record, target));
	const johnsonPredictions = Object.values(loadBoatJohnsonPredictionRecords()).filter((record) =>
		matchesBoatVenueStorageTarget(record, target));
	const counts = {
		summaryDrafts: draftKeys.length,
		predictions: predictions.length,
		practiceResults: practiceResults.length,
		johnsonPredictions: johnsonPredictions.length,
		total: draftKeys.length + predictions.length + practiceResults.length + johnsonPredictions.length,
	};

	return {
		target,
		counts,
		hasMemo: practiceResults.some((record) => Boolean(record.memo?.trim() || record.practiceMemo?.trim())) ||
			johnsonPredictions.some((record) => Boolean(record.mobileMemo?.trim())),
		hasPayoutPending: practiceResults.some(isBoatPracticePayoutPending),
		estimatedBytes:
			draftKeys.reduce((sum, key) => sum + getJsonBytes({ [key]: drafts[key] }), 0) +
			predictions.reduce((sum, record) => sum + getJsonBytes(record), 0) +
			practiceResults.reduce((sum, record) => sum + getJsonBytes(record), 0) +
			johnsonPredictions.reduce((sum, record) => sum + getJsonBytes(record), 0),
	};
}

export function cleanupBoatVenueLocalStorage(
	target: BoatVenueStorageTarget,
	scope: BoatVenueStorageCleanupScope,
): BoatVenueStorageCleanupResult {
	const inspection = inspectBoatVenueLocalStorage(target);
	const usageBytesBefore = getBoatLocalStorageUsageBytes();
	let ok = true;
	let removedCount = 0;

	if (scope === "summary-draft" || scope === "all") {
		const drafts = readReviewDrafts();
		const draftKeys = getTargetDraftKeys(drafts, target);
		for (const key of draftKeys) {
			delete drafts[key];
		}
		if (canUseStorage() && draftKeys.length > 0) {
			try {
				if (Object.keys(drafts).length > 0) {
					window.localStorage.setItem(BOAT_REVIEW_DRAFT_STORAGE_KEY, JSON.stringify(drafts));
				} else {
					window.localStorage.removeItem(BOAT_REVIEW_DRAFT_STORAGE_KEY);
				}
				removedCount += draftKeys.length;
			} catch {
				ok = false;
			}
		}
	}

	if (scope === "race-records" || scope === "all") {
		const predictionRecords = loadBoatPredictionRecords();
		const practiceRecords = loadBoatPracticeResultRecords();
		const johnsonRecords = loadBoatJohnsonPredictionRecords();
		const nextPredictions = Object.fromEntries(Object.entries(predictionRecords).filter(([, record]) =>
			!matchesBoatVenueStorageTarget(record, target)));
		const nextPractice = Object.fromEntries(Object.entries(practiceRecords).filter(([, record]) =>
			!matchesBoatVenueStorageTarget(record, target)));
		const nextJohnson = Object.fromEntries(Object.entries(johnsonRecords).filter(([, record]) =>
			!matchesBoatVenueStorageTarget(record, target)));
		const predictionCount = Object.keys(predictionRecords).length - Object.keys(nextPredictions).length;
		const practiceCount = Object.keys(practiceRecords).length - Object.keys(nextPractice).length;
		const johnsonCount = Object.keys(johnsonRecords).length - Object.keys(nextJohnson).length;
		const predictionResult = predictionCount > 0 ? saveBoatPredictionRecords(nextPredictions) : { ok: true };
		const practiceResult = practiceCount > 0 ? saveBoatPracticeResultRecords(nextPractice) : { ok: true };
		const johnsonResult = johnsonCount > 0 ? saveBoatJohnsonPredictionRecords(nextJohnson) : { ok: true };

		ok = ok && predictionResult.ok && practiceResult.ok && johnsonResult.ok;
		if (predictionResult.ok) removedCount += predictionCount;
		if (practiceResult.ok) removedCount += practiceCount;
		if (johnsonResult.ok) removedCount += johnsonCount;
	}

	return {
		...inspection,
		scope,
		ok,
		removedCount,
		usageBytesBefore,
		usageBytesAfter: getBoatLocalStorageUsageBytes(),
	};
}

export type PruneBoatLocalRecordsByDateParams = {
	activeDate: string;
	keepDates: string[];
};

export type PruneBoatLocalRecordsByDateResult = {
	activeDate: string;
	keepDates: string[];
	prediction: SaveBoatPredictionRecordsResult;
	practice: SaveBoatPracticeResultRecordsResult;
	johnson: SaveBoatJohnsonPredictionRecordsResult;
};

export function pruneBoatLocalRecordsByDate(params: PruneBoatLocalRecordsByDateParams): PruneBoatLocalRecordsByDateResult {
	const activeDate = String(params.activeDate || params.keepDates[0] || "").trim();
	const keepDates = Array.from(
		new Set(
			params.keepDates
				.map((date) => String(date ?? "").trim())
				.filter(Boolean),
		),
	);

	return {
		activeDate,
		keepDates,
		prediction: saveBoatPredictionRecords(
			pruneBoatPredictionRecordsByDate(loadBoatPredictionRecords(), keepDates),
		),
		practice: saveBoatPracticeResultRecords(
			pruneBoatPracticeResultRecordsByDate(loadBoatPracticeResultRecords(), keepDates),
		),
		johnson: saveBoatJohnsonPredictionRecords(
			pruneBoatJohnsonPredictionRecordsByDate(loadBoatJohnsonPredictionRecords(), keepDates),
		),
	};
}
