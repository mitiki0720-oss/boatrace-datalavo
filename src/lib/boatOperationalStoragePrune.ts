import {
	loadBoatJohnsonPredictionRecords,
	saveBoatJohnsonPredictionRecords,
	type BoatJohnsonPredictionRecordMap,
	type SaveBoatJohnsonPredictionRecordsResult,
} from "./boatJohnsonPredictionStorage";
import { getBoatOperationDate, shiftBoatOperationDate } from "./boatOperationDate";
import {
	loadBoatPracticeResultRecords,
	saveBoatPracticeResultRecords,
	type BoatPracticeResultRecordMap,
	type SaveBoatPracticeResultRecordsResult,
} from "./boatPracticeResultStorage";
import {
	loadBoatPredictionRecords,
	saveBoatPredictionRecords,
	type BoatPredictionRecordMap,
	type SaveBoatPredictionRecordsResult,
} from "./boatPredictionStorage";

export const BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY = "kurari-boat-data-labo-last-pruned-operational-date";

export type PruneBoatOperationalLocalStorageParams = {
	activeDate?: string;
	previousDate?: string;
};

export type PruneBoatOperationalLocalStorageResult = {
	activeDate: string;
	keepDates: string[];
	prediction: SaveBoatPredictionRecordsResult;
	practice: SaveBoatPracticeResultRecordsResult;
	johnson: SaveBoatJohnsonPredictionRecordsResult;
	removed: {
		prediction: number;
		practice: number;
		johnson: number;
	};
	warnings: string[];
};

export type BoatOperationalStoragePruneOnceResult =
	| ({ skipped: true; reason: "storage-unavailable" | "already-pruned" | "in-flight"; activeDate: string; previousDate: string })
	| ({ skipped: false; activeDate: string; previousDate: string; result: PruneBoatOperationalLocalStorageResult });

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
let pruneInFlight: Promise<BoatOperationalStoragePruneOnceResult> | null = null;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const readRecordDate = (record: { date?: string }): string => String(record.date ?? "").trim();

const shouldKeepRecordDate = (params: {
	date: string;
	activeDate: string;
	previousDate: string;
	label: string;
	warnings: string[];
}): boolean => {
	const { date, activeDate, previousDate, label, warnings } = params;

	if (!ISO_DATE_PATTERN.test(date)) {
		warnings.push(`${label}: keep record with invalid date "${date || "(empty)"}"`);
		return true;
	}

	if (date > activeDate) {
		warnings.push(`${label}: keep future record "${date}"`);
		return true;
	}

	return date >= previousDate;
};

export function pruneBoatRecordMapByOperationalDate<T extends { date?: string }>(
	records: Record<string, T>,
	params: {
		activeDate: string;
		previousDate: string;
		label: string;
		warnings?: string[];
	},
): { records: Record<string, T>; removedCount: number; warnings: string[] } {
	const warnings = params.warnings ?? [];
	const nextRecords = Object.entries(records).reduce<Record<string, T>>((acc, [key, record]) => {
		if (shouldKeepRecordDate({
			date: readRecordDate(record),
			activeDate: params.activeDate,
			previousDate: params.previousDate,
			label: `${params.label}:${key}`,
			warnings,
		})) {
			acc[key] = record;
		}

		return acc;
	}, {});

	return {
		records: nextRecords,
		removedCount: Object.keys(records).length - Object.keys(nextRecords).length,
		warnings,
	};
}

export function pruneBoatOperationalLocalStorage(
	params: PruneBoatOperationalLocalStorageParams = {},
): PruneBoatOperationalLocalStorageResult {
	const activeDate = String(params.activeDate || getBoatOperationDate()).trim();
	const previousDate = String(params.previousDate || (activeDate ? shiftBoatOperationDate(activeDate, -1) : "")).trim();
	const keepDates = [previousDate, activeDate].filter(Boolean);
	const warnings: string[] = [];
	const predictionPrune = pruneBoatRecordMapByOperationalDate(loadBoatPredictionRecords(), {
		activeDate,
		previousDate,
		label: "prediction",
		warnings,
	});
	const practicePrune = pruneBoatRecordMapByOperationalDate(loadBoatPracticeResultRecords(), {
		activeDate,
		previousDate,
		label: "practice",
		warnings,
	});
	const johnsonPrune = pruneBoatRecordMapByOperationalDate(loadBoatJohnsonPredictionRecords(), {
		activeDate,
		previousDate,
		label: "johnson",
		warnings,
	});
	const predictionRecords = predictionPrune.records as BoatPredictionRecordMap;
	const practiceRecords = practicePrune.records as BoatPracticeResultRecordMap;
	const johnsonRecords = johnsonPrune.records as BoatJohnsonPredictionRecordMap;

	const result = {
		activeDate,
		keepDates,
		prediction: saveBoatPredictionRecords(predictionRecords),
		practice: saveBoatPracticeResultRecords(practiceRecords),
		johnson: saveBoatJohnsonPredictionRecords(johnsonRecords),
		removed: {
			prediction: predictionPrune.removedCount,
			practice: practicePrune.removedCount,
			johnson: johnsonPrune.removedCount,
		},
		warnings,
	};

	for (const warning of warnings) {
		console.warn(`[boat-operational-prune] ${warning}`);
	}

	return result;
}

export function shouldRunBoatOperationalPrune(activeDate = getBoatOperationDate()): boolean {
	if (!canUseStorage()) {
		return false;
	}

	return window.localStorage.getItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY) !== activeDate;
}

export function markBoatOperationalPruneCompleted(activeDate = getBoatOperationDate()): void {
	if (!canUseStorage()) {
		return;
	}

	window.localStorage.setItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY, activeDate);
}

export function pruneBoatOperationalStorageOnce(params: {
	now?: Date;
	activeDate?: string;
	previousDate?: string;
	reason?: string;
} = {}): Promise<BoatOperationalStoragePruneOnceResult> {
	const activeDate = String(params.activeDate || getBoatOperationDate(params.now)).trim();
	const previousDate = String(params.previousDate || shiftBoatOperationDate(activeDate, -1)).trim();

	if (!canUseStorage()) {
		return Promise.resolve({ skipped: true, reason: "storage-unavailable", activeDate, previousDate });
	}

	if (!shouldRunBoatOperationalPrune(activeDate)) {
		return Promise.resolve({ skipped: true, reason: "already-pruned", activeDate, previousDate });
	}

	if (pruneInFlight) {
		return Promise.resolve({ skipped: true, reason: "in-flight", activeDate, previousDate });
	}

	pruneInFlight = Promise.resolve().then(() => {
		const result = pruneBoatOperationalLocalStorage({ activeDate, previousDate });
		const ok = result.prediction.ok && result.practice.ok && result.johnson.ok;

		if (ok) {
			markBoatOperationalPruneCompleted(activeDate);
			console.info(
				`[boat-operational-prune] completed activeDate=${activeDate} previousDate=${previousDate} reason=${params.reason ?? "unknown"} removed=${JSON.stringify(result.removed)}`,
			);
		} else {
			console.warn(`[boat-operational-prune] skipped marker update after failed prune activeDate=${activeDate}`);
		}

		return { skipped: false as const, activeDate, previousDate, result };
	}).catch((error) => {
		console.warn("[boat-operational-prune] failed", error);
		throw error;
	}).finally(() => {
		pruneInFlight = null;
	});

	return pruneInFlight;
}
