import type { BoatJohnsonPredictionPayload, BoatJohnsonPredictionRecord } from "./boatraceTypes";

export const BOAT_JOHNSON_PREDICTION_STORAGE_KEY = "kurari-boat-data-labo-johnson-predictions";

export type BoatJohnsonPredictionRecordMap = Record<string, BoatJohnsonPredictionRecord>;

const BOAT_JOHNSON_FALLBACK_KEEP_DAYS = 2;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isRecordLike = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const readSavedDateValue = (record: BoatJohnsonPredictionRecord): number => {
	const parsed = Date.parse(record.updatedAt ?? record.savedAt ?? "");
	return Number.isFinite(parsed) ? parsed : 0;
};

const sortBoatJohnsonPredictionRecordsByRecency = (records: BoatJohnsonPredictionRecord[]): BoatJohnsonPredictionRecord[] =>
	[...records].sort((left, right) => {
		if (left.date !== right.date) {
			return right.date.localeCompare(left.date);
		}

		return readSavedDateValue(right) - readSavedDateValue(left);
	});

const reduceBoatJohnsonPredictionRecords = (records: BoatJohnsonPredictionRecord[]): BoatJohnsonPredictionRecordMap =>
	records.reduce<BoatJohnsonPredictionRecordMap>((acc, record) => {
		if (record.raceKey) {
			acc[record.raceKey] = record;
		}

		return acc;
	}, {});

const selectLatestPredictionDates = (records: BoatJohnsonPredictionRecordMap, keepDays = BOAT_JOHNSON_FALLBACK_KEEP_DAYS): string[] =>
	Array.from(new Set(Object.values(records).map((record) => record.date).filter(Boolean)))
		.sort((left, right) => right.localeCompare(left))
		.slice(0, keepDays);

export function pruneBoatJohnsonPredictionRecordsByDate(
	records: BoatJohnsonPredictionRecordMap,
	keepDates: string[],
): BoatJohnsonPredictionRecordMap {
	const keepDateSet = new Set(keepDates.filter(Boolean));
	if (keepDateSet.size <= 0) {
		return {};
	}

	return reduceBoatJohnsonPredictionRecords(
		sortBoatJohnsonPredictionRecordsByRecency(Object.values(records)).filter((record) => keepDateSet.has(record.date)),
	);
}

export type SaveBoatJohnsonPredictionRecordsResult = {
	ok: boolean;
	records: BoatJohnsonPredictionRecordMap;
	reason?: "quota-exceeded" | "unknown";
};

export function loadBoatJohnsonPredictionRecords(): BoatJohnsonPredictionRecordMap {
	if (!canUseStorage()) {
		return {};
	}

	try {
		const raw = window.localStorage.getItem(BOAT_JOHNSON_PREDICTION_STORAGE_KEY);
		if (!raw) {
			return {};
		}

		const parsed: unknown = JSON.parse(raw);
		if (!isRecordLike(parsed)) {
			return {};
		}

		return reduceBoatJohnsonPredictionRecords(
			sortBoatJohnsonPredictionRecordsByRecency(
				Object.values(parsed as BoatJohnsonPredictionRecordMap).filter(
					(record): record is BoatJohnsonPredictionRecord => Boolean(record && typeof record === "object" && record.raceKey),
				),
			),
		);
	} catch {
		return {};
	}
}

export function saveBoatJohnsonPredictionRecords(records: BoatJohnsonPredictionRecordMap): SaveBoatJohnsonPredictionRecordsResult {
	if (!canUseStorage()) {
		return { ok: true, records };
	}

	const normalizedRecords = reduceBoatJohnsonPredictionRecords(sortBoatJohnsonPredictionRecordsByRecency(Object.values(records)));

	try {
		window.localStorage.setItem(BOAT_JOHNSON_PREDICTION_STORAGE_KEY, JSON.stringify(normalizedRecords));
		return { ok: true, records: normalizedRecords };
	} catch (error) {
		if (error instanceof DOMException && error.name === "QuotaExceededError") {
			const fallbackRecords = pruneBoatJohnsonPredictionRecordsByDate(normalizedRecords, selectLatestPredictionDates(normalizedRecords));

			try {
				window.localStorage.setItem(BOAT_JOHNSON_PREDICTION_STORAGE_KEY, JSON.stringify(fallbackRecords));
				return { ok: true, records: fallbackRecords, reason: "quota-exceeded" };
			} catch (fallbackError) {
				console.error("[boat-johnson-prediction-storage] compact save failed", fallbackError);
				return { ok: false, records: fallbackRecords, reason: "quota-exceeded" };
			}
		}

		console.error("[boat-johnson-prediction-storage] save failed", error);
		return { ok: false, records: normalizedRecords, reason: "unknown" };
	}
}

export function upsertBoatJohnsonPredictionRecord(record: BoatJohnsonPredictionRecord): SaveBoatJohnsonPredictionRecordsResult {
	const records = loadBoatJohnsonPredictionRecords();
	return saveBoatJohnsonPredictionRecords({
		...records,
		[record.raceKey]: record,
	});
}

export function buildBoatJohnsonPredictionPayload(records: BoatJohnsonPredictionRecordMap): BoatJohnsonPredictionPayload {
	return {
		version: 1,
		updatedAt: new Date().toISOString(),
		source: "kurari-boat-prediction-page",
		records: reduceBoatJohnsonPredictionRecords(sortBoatJohnsonPredictionRecordsByRecency(Object.values(records))),
	};
}