import {
	type SaveBoatPredictionRecordsResult,
} from "./boatPredictionStorage";
import {
	type SaveBoatPracticeResultRecordsResult,
} from "./boatPracticeResultStorage";
import type { SaveBoatJohnsonPredictionRecordsResult } from "./boatJohnsonPredictionStorage";
import { pruneBoatOperationalLocalStorage } from "./boatOperationalStoragePrune";

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
	const result = pruneBoatOperationalLocalStorage({ activeDate });

	return {
		activeDate: result.activeDate,
		keepDates: result.keepDates,
		prediction: result.prediction,
		practice: result.practice,
		johnson: result.johnson,
	};
}
