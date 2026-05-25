import {
	loadBoatPredictionRecords,
	pruneBoatPredictionRecordsByDate,
	saveBoatPredictionRecords,
	type SaveBoatPredictionRecordsResult,
} from "./boatPredictionStorage";
import {
	loadBoatPracticeResultRecords,
	pruneBoatPracticeResultRecordsByDate,
	saveBoatPracticeResultRecords,
	type SaveBoatPracticeResultRecordsResult,
} from "./boatPracticeResultStorage";

export type PruneBoatLocalRecordsByDateParams = {
	activeDate: string;
	keepDates: string[];
};

export type PruneBoatLocalRecordsByDateResult = {
	activeDate: string;
	keepDates: string[];
	prediction: SaveBoatPredictionRecordsResult;
	practice: SaveBoatPracticeResultRecordsResult;
};

export function pruneBoatLocalRecordsByDate(params: PruneBoatLocalRecordsByDateParams): PruneBoatLocalRecordsByDateResult {
	const keepDates = Array.from(new Set(params.keepDates.filter(Boolean)));
	const predictionRecords = pruneBoatPredictionRecordsByDate(loadBoatPredictionRecords(), keepDates);
	const practiceRecords = pruneBoatPracticeResultRecordsByDate(loadBoatPracticeResultRecords(), keepDates);

	return {
		activeDate: params.activeDate,
		keepDates,
		prediction: saveBoatPredictionRecords(predictionRecords),
		practice: saveBoatPracticeResultRecords(practiceRecords),
	};
}