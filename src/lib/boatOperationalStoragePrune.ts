import {
	loadBoatJohnsonPredictionRecords,
	pruneBoatJohnsonPredictionRecordsByDate,
	saveBoatJohnsonPredictionRecords,
	type SaveBoatJohnsonPredictionRecordsResult,
} from "./boatJohnsonPredictionStorage";
import { getBoatOperationDate } from "./boatOperationDate";
import {
	loadBoatPracticeResultRecords,
	pruneBoatPracticeResultRecordsByDate,
	saveBoatPracticeResultRecords,
	type SaveBoatPracticeResultRecordsResult,
} from "./boatPracticeResultStorage";
import {
	loadBoatPredictionRecords,
	pruneBoatPredictionRecordsByDate,
	saveBoatPredictionRecords,
	type SaveBoatPredictionRecordsResult,
} from "./boatPredictionStorage";

export type PruneBoatOperationalLocalStorageParams = {
	activeDate?: string;
};

export type PruneBoatOperationalLocalStorageResult = {
	activeDate: string;
	keepDates: string[];
	prediction: SaveBoatPredictionRecordsResult;
	practice: SaveBoatPracticeResultRecordsResult;
	johnson: SaveBoatJohnsonPredictionRecordsResult;
};

export function pruneBoatOperationalLocalStorage(
	params: PruneBoatOperationalLocalStorageParams = {},
): PruneBoatOperationalLocalStorageResult {
	const activeDate = String(params.activeDate || getBoatOperationDate()).trim();
	const keepDates = activeDate ? [activeDate] : [];
	const predictionRecords = pruneBoatPredictionRecordsByDate(loadBoatPredictionRecords(), keepDates);
	const practiceRecords = pruneBoatPracticeResultRecordsByDate(loadBoatPracticeResultRecords(), keepDates);
	const johnsonRecords = pruneBoatJohnsonPredictionRecordsByDate(loadBoatJohnsonPredictionRecords(), keepDates);

	return {
		activeDate,
		keepDates,
		prediction: saveBoatPredictionRecords(predictionRecords),
		practice: saveBoatPracticeResultRecords(practiceRecords),
		johnson: saveBoatJohnsonPredictionRecords(johnsonRecords),
	};
}
