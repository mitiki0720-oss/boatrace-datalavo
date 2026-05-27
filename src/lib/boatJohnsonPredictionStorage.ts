import type { BoatPredictionRecord, BoatJohnsonPredictionPayload, BoatJohnsonPredictionRecord } from "./boatraceTypes";
import type { BoatPracticeResultRecord, BoatPracticeResultRecordMap } from "./boatPracticeResultStorage";
import { hydrateBoatPredictionRecord, type BoatPredictionRecordMap } from "./boatPredictionStorage";

export const BOAT_JOHNSON_PREDICTION_STORAGE_KEY = "kurari-boat-data-labo-johnson-predictions";

export type BoatJohnsonPredictionRecordMap = Record<string, BoatJohnsonPredictionRecord>;

const BOAT_JOHNSON_FALLBACK_KEEP_DAYS = 2;

const readPracticeNumber = (value: unknown): number => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value.replace(/[^\d.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
};

const formatJohnsonHitBetNumbers = (value: unknown): string => {
	if (Array.isArray(value)) {
		return value.map((item) => readPracticeNumber(item)).filter((item) => item > 0).join("-");
	}

	return String(value ?? "")
		.trim()
		.replace(/[\s,、/]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
};

const resolvePracticeStakeYen = (record: BoatPracticeResultRecord): number =>
	readPracticeNumber(record.totalStakeYen ?? record.betSummary?.totalStakeYen ?? record.investmentAmount);

const resolvePracticePayoutYen = (record: BoatPracticeResultRecord): number =>
	readPracticeNumber(record.payoutYen ?? record.payoutAmount);

const resolvePracticeProfitYen = (record: BoatPracticeResultRecord): number => {
	const storedProfit = record.profitYen ?? record.profitLoss;
	if (storedProfit !== undefined) {
		return readPracticeNumber(storedProfit);
	}

	return resolvePracticePayoutYen(record) - resolvePracticeStakeYen(record);
};

const toPredictionRecordArray = (records: BoatPredictionRecordMap | BoatPredictionRecord[]): BoatPredictionRecord[] =>
	Array.isArray(records) ? records : Object.values(records);

const buildRecordSortValue = (record: { date?: string; venueName?: string; raceNo?: number; updatedAt?: string; savedAt?: string }) => ({
	date: String(record.date ?? ""),
	venueName: String(record.venueName ?? ""),
	raceNo: Number(record.raceNo ?? 0),
	updatedAt: String(record.updatedAt ?? record.savedAt ?? ""),
});

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isRecordLike = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const readSavedDateValue = (record: BoatJohnsonPredictionRecord): number => {
	const parsed = Date.parse(record.updatedAt ?? record.savedAt ?? "");
	return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeBoatJohnsonPredictionRecord = (record: BoatJohnsonPredictionRecord): BoatJohnsonPredictionRecord => ({
	...record,
	johnsonText: record.johnsonText ?? record.predictionText,
	ticketsCount: record.ticketsCount ?? (Array.isArray(record.tickets) ? record.tickets.length : 0),
	parsedBetsCount: record.parsedBetsCount ?? (Array.isArray(record.parsedBets) ? record.parsedBets.length : 0),
	updatedAt: record.updatedAt ?? record.savedAt,
});

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
			acc[record.raceKey] = normalizeBoatJohnsonPredictionRecord(record);
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

export function buildBoatJohnsonRecordFromPredictionRecord(
	predictionRecord: BoatPredictionRecord,
	options?: {
		existingRecord?: BoatJohnsonPredictionRecord;
		practiceRecord?: BoatPracticeResultRecord;
		updatedAt?: string;
	},
): BoatJohnsonPredictionRecord | null {
	const hydratedRecord = hydrateBoatPredictionRecord(predictionRecord);
	const predictionText = hydratedRecord.predictionText?.trim() ?? "";

	if (!hydratedRecord.raceKey || !hydratedRecord.date || !hydratedRecord.venueName || !hydratedRecord.raceNo || !predictionText) {
		return null;
	}

	const existingRecord = options?.existingRecord;
	const practiceRecord = options?.practiceRecord;
	const updatedAt = options?.updatedAt ?? new Date().toISOString();
	const tickets = Array.isArray(hydratedRecord.tickets) ? hydratedRecord.tickets : existingRecord?.tickets;
	const parsedBets = Array.isArray(hydratedRecord.parsedBets) ? hydratedRecord.parsedBets : existingRecord?.parsedBets;
	const betSummary = hydratedRecord.betSummary ?? existingRecord?.betSummary;
	const hitBetNumbers = formatJohnsonHitBetNumbers(practiceRecord?.hitBetNumbers);

	return normalizeBoatJohnsonPredictionRecord({
		raceKey: hydratedRecord.raceKey,
		raceId: hydratedRecord.raceId ?? existingRecord?.raceId,
		venueCode: hydratedRecord.venueCode ?? existingRecord?.venueCode,
		venueName: hydratedRecord.venueName,
		date: hydratedRecord.date,
		raceNo: hydratedRecord.raceNo,
		predictionText,
		johnsonText: predictionText,
		tickets,
		parsedBets,
		betSummary,
		ticketsCount: Array.isArray(tickets) ? tickets.length : 0,
		parsedBetsCount: Array.isArray(parsedBets) ? parsedBets.length : 0,
		totalStakeYen: hydratedRecord.totalStakeYen ?? betSummary?.totalStakeYen ?? existingRecord?.totalStakeYen ?? 0,
		resultStatus: practiceRecord?.resultStatus ?? existingRecord?.resultStatus,
		hitBetType: practiceRecord?.hitBetType ?? existingRecord?.hitBetType,
		hitBetNumbers: hitBetNumbers || existingRecord?.hitBetNumbers,
		finishOrder: practiceRecord?.finishOrder ?? practiceRecord?.actualOrder ?? existingRecord?.finishOrder,
		payoutYen: practiceRecord ? resolvePracticePayoutYen(practiceRecord) : existingRecord?.payoutYen,
		profitYen: practiceRecord ? resolvePracticeProfitYen(practiceRecord) : existingRecord?.profitYen,
		roi: practiceRecord ? readPracticeNumber(practiceRecord.roi) : existingRecord?.roi,
		mobileMemo: practiceRecord?.practiceMemo || practiceRecord?.memo || existingRecord?.mobileMemo || "",
		sourceRecordSavedAt: hydratedRecord.savedAt,
		updatedAt,
		savedAt: existingRecord?.savedAt ?? updatedAt,
	});
}

export function mergeBoatJohnsonRecords(
	existingRecords: BoatJohnsonPredictionRecordMap,
	nextRecords: BoatJohnsonPredictionRecordMap,
): BoatJohnsonPredictionRecordMap {
	return reduceBoatJohnsonPredictionRecords(
		sortBoatJohnsonPredictionRecordsByRecency(Object.values({
			...existingRecords,
			...nextRecords,
		})),
	);
}

export function buildBoatJohnsonRecordsFromPredictionRecords(
	predictionRecords: BoatPredictionRecordMap | BoatPredictionRecord[],
	options?: {
		existingRecords?: BoatJohnsonPredictionRecordMap;
		practiceResultRecords?: BoatPracticeResultRecordMap;
		updatedAt?: string;
	},
): BoatJohnsonPredictionRecordMap {
	const existingRecords = options?.existingRecords ?? {};
	const practiceResultRecords = options?.practiceResultRecords ?? {};
	const updatedAt = options?.updatedAt ?? new Date().toISOString();
	const nextRecords = toPredictionRecordArray(predictionRecords)
		.sort((left, right) => {
			const leftSort = buildRecordSortValue(left);
			const rightSort = buildRecordSortValue(right);

			if (leftSort.date !== rightSort.date) {
				return rightSort.date.localeCompare(leftSort.date);
			}

			if (leftSort.venueName !== rightSort.venueName) {
				return leftSort.venueName.localeCompare(rightSort.venueName, "ja");
			}

			if (leftSort.raceNo !== rightSort.raceNo) {
				return leftSort.raceNo - rightSort.raceNo;
			}

			return rightSort.updatedAt.localeCompare(leftSort.updatedAt);
		})
		.reduce<BoatJohnsonPredictionRecordMap>((acc, record) => {
			const nextRecord = buildBoatJohnsonRecordFromPredictionRecord(record, {
				existingRecord: acc[record.raceKey] ?? existingRecords[record.raceKey],
				practiceRecord: practiceResultRecords[record.raceKey],
				updatedAt,
			});

			if (nextRecord) {
				acc[nextRecord.raceKey] = nextRecord;
			}

			return acc;
		}, {});

	return mergeBoatJohnsonRecords(existingRecords, nextRecords);
}

export function buildBoatJohnsonGeneratedPayload(records: BoatJohnsonPredictionRecordMap): BoatJohnsonPredictionPayload {
	const sortedRecords = sortBoatJohnsonPredictionRecordsByRecency(Object.values(records)).map(normalizeBoatJohnsonPredictionRecord);

	return {
		version: 1,
		generatedAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		source: "kurari-boat-prediction-page",
		records: sortedRecords,
		notifiedSlackResultKeys: [],
		notifiedSlackHitKeys: [],
	};
}

export function buildBoatJohnsonPredictionPayload(records: BoatJohnsonPredictionRecordMap): BoatJohnsonPredictionPayload {
	return buildBoatJohnsonGeneratedPayload(records);
}