import type { BoatPredictionRecord, BoatPredictionTicket } from "./boatraceTypes";

export const BOAT_PREDICTION_STORAGE_KEY = "kurari-boat-data-labo-prediction-records";

export type BoatPredictionRecordMap = Record<string, BoatPredictionRecord>;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isRecordLike = (value: unknown): value is BoatPredictionRecordMap => typeof value === "object" && value !== null && !Array.isArray(value);

export function buildBoatPredictionRaceKey(params: {
	date: string;
	venueName: string;
	raceNo: number;
	raceId?: string;
}): string {
	const { date, venueName, raceNo, raceId } = params;

	if (raceId) {
		return `boat-prediction:${raceId}`;
	}

	return `boat-prediction:${date}:${venueName}:${raceNo}`;
}

export function loadBoatPredictionRecords(): BoatPredictionRecordMap {
	if (!canUseStorage()) {
		return {};
	}

	try {
		const raw = window.localStorage.getItem(BOAT_PREDICTION_STORAGE_KEY);
		if (!raw) {
			return {};
		}

		const parsed: unknown = JSON.parse(raw);
		return isRecordLike(parsed) ? (parsed as BoatPredictionRecordMap) : {};
	} catch {
		return {};
	}
}

export function saveBoatPredictionRecords(records: BoatPredictionRecordMap): void {
	if (!canUseStorage()) {
		return;
	}

	window.localStorage.setItem(BOAT_PREDICTION_STORAGE_KEY, JSON.stringify(records));
}

export function findBoatPredictionRecord(params: {
	date: string;
	venueName: string;
	raceNo: number;
	raceId?: string;
}): BoatPredictionRecord | undefined {
	const key = buildBoatPredictionRaceKey(params);
	const records = loadBoatPredictionRecords();

	return records[key] ?? records[buildBoatPredictionRaceKey({ ...params, raceId: undefined })];
}

export function upsertBoatPredictionRecord(record: BoatPredictionRecord): BoatPredictionRecordMap {
	const records = loadBoatPredictionRecords();
	const nextRecords: BoatPredictionRecordMap = {
		...records,
		[record.raceKey]: {
			...record,
			tickets: record.tickets as BoatPredictionTicket[] | undefined,
		},
	};

	saveBoatPredictionRecords(nextRecords);
	return nextRecords;
}

export function deleteBoatPredictionRecord(raceKey: string): BoatPredictionRecordMap {
	const records = loadBoatPredictionRecords();
	const nextRecords: BoatPredictionRecordMap = { ...records };

	delete nextRecords[raceKey];
	saveBoatPredictionRecords(nextRecords);

	return nextRecords;
}
