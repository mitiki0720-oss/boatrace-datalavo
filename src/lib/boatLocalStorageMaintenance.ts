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
import {
	loadBoatJohnsonPredictionRecords,
	pruneBoatJohnsonPredictionRecordsByDate,
	saveBoatJohnsonPredictionRecords,
	type SaveBoatJohnsonPredictionRecordsResult,
} from "./boatJohnsonPredictionStorage";

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
