import type { ParsedBoatBet, ParsedBoatBetSummary } from "./boatBetParser";
import type { BoatPredictionTicket } from "./boatraceTypes";
import type { BoatPracticeResultStatus, BoatResultLookupStatus } from "./boatResultSettlement";

export const BOAT_PRACTICE_RESULT_STORAGE_KEY = "kurari-boat-data-labo-practice-results";

export type BoatPracticeResultRecord = {
	id?: string;
	raceKey: string;
	raceId?: string;
	venueCode?: string;
	venueName: string;
	date: string;
	raceNo: number;
	raceTitle?: string;
	predictionText?: string;
	tickets?: BoatPredictionTicket[];
	parsedBets?: ParsedBoatBet[];
	betSummary?: Pick<ParsedBoatBetSummary, "totalBets" | "trifectaCount" | "exactaCount" | "totalStakeYen">;
	actualFinishOrderText: string;
	investmentAmount: number;
	payoutAmount: number;
	profitLoss: number;
	roi: number;
	resultStatus?: BoatPracticeResultStatus;
	resultLookupStatus?: BoatResultLookupStatus;
	actualOrder?: string;
	finishOrder?: string;
	kimarite?: string;
	startInfoText?: string;
	payouts?: unknown[];
	hitBets?: ParsedBoatBet[];
	hitBetType?: string;
	hitBetNumbers?: number[] | string;
	totalStakeYen?: number;
	payoutYen?: number;
	profitYen?: number;
	resultSource?: string;
	memo?: string;
	createdAt?: string;
	updatedAt?: string;
	practiceMemo: string;
	savedAt: string;
};

export type BoatPracticeResultRecordMap = Record<string, BoatPracticeResultRecord>;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isRecordLike = (value: unknown): value is BoatPracticeResultRecordMap => typeof value === "object" && value !== null && !Array.isArray(value);

const buildPracticeRecordKey = (record: BoatPracticeResultRecord): string =>
	record.raceKey ||
	record.id ||
	[
		record.date,
		record.venueCode || record.venueName,
		record.raceNo,
	].filter(Boolean).join(":");

const readNumber = (value: unknown): number => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value.replace(/[^\d.-]/g, ""));
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
};

export function isBoatPracticeHit(result: BoatPracticeResultRecord | null | undefined): boolean {
	if (!result) {
		return false;
	}

	return (
		readNumber(result.payoutYen) > 0 ||
		readNumber(result.profitYen) > 0 ||
		(Array.isArray(result.hitBets) && result.hitBets.length > 0) ||
		Boolean(result.hitBetNumbers) ||
		(result.resultStatus === "confirmed" && readNumber(result.payoutYen) > 0)
	);
}

export function normalizeBoatPracticeResultRecords(payload: unknown): BoatPracticeResultRecordMap {
	if (Array.isArray(payload)) {
		return payload.reduce<BoatPracticeResultRecordMap>((records, item) => {
			if (!item || typeof item !== "object") {
				return records;
			}

			const record = item as BoatPracticeResultRecord;
			const key = buildPracticeRecordKey(record);
			if (key) {
				records[key] = {
					...record,
					raceKey: record.raceKey || key,
				};
			}

			return records;
		}, {});
	}

	if (!isRecordLike(payload)) {
		return {};
	}

	return Object.entries(payload).reduce<BoatPracticeResultRecordMap>((records, [key, item]) => {
		if (!item || typeof item !== "object") {
			return records;
		}

		const record = item as BoatPracticeResultRecord;
		const recordKey = record.raceKey || key || buildPracticeRecordKey(record);
		if (recordKey) {
			records[recordKey] = {
				...record,
				raceKey: recordKey,
			};
		}

		return records;
	}, {});
}

export function calculateBoatPracticeProfitLoss(params: {
	investmentAmount: number;
	payoutAmount: number;
}): {
	profitLoss: number;
	roi: number;
} {
	const { investmentAmount, payoutAmount } = params;
	const profitLoss = payoutAmount - investmentAmount;
	const roi = investmentAmount > 0 ? (payoutAmount / investmentAmount) * 100 : 0;

	return { profitLoss, roi };
}

export function loadBoatPracticeResultRecords(): BoatPracticeResultRecordMap {
	if (!canUseStorage()) {
		return {};
	}

	try {
		const raw = window.localStorage.getItem(BOAT_PRACTICE_RESULT_STORAGE_KEY);
		if (!raw) {
			return {};
		}

		const parsed: unknown = JSON.parse(raw);
		return normalizeBoatPracticeResultRecords(parsed);
	} catch {
		return {};
	}
}

export function saveBoatPracticeResultRecords(records: BoatPracticeResultRecordMap): void {
	if (!canUseStorage()) {
		return;
	}

	window.localStorage.setItem(BOAT_PRACTICE_RESULT_STORAGE_KEY, JSON.stringify(records));
}

export function findBoatPracticeResultRecord(raceKey: string): BoatPracticeResultRecord | undefined {
	const records = loadBoatPracticeResultRecords();
	return records[raceKey] ?? Object.values(records).find((record) => record.raceKey === raceKey || record.id === raceKey);
}

export function upsertBoatPracticeResultRecord(record: BoatPracticeResultRecord): BoatPracticeResultRecordMap {
	const records = loadBoatPracticeResultRecords();
	const key = buildPracticeRecordKey(record);
	const nextRecords: BoatPracticeResultRecordMap = {
		...records,
		[key]: {
			...record,
			raceKey: record.raceKey || key,
			id: record.id || key,
		},
	};

	saveBoatPracticeResultRecords(nextRecords);
	return nextRecords;
}

export function deleteBoatPracticeResultRecord(raceKey: string): BoatPracticeResultRecordMap {
	const records = loadBoatPracticeResultRecords();
	const nextRecords: BoatPracticeResultRecordMap = { ...records };

	delete nextRecords[raceKey];
	saveBoatPracticeResultRecords(nextRecords);

	return nextRecords;
}
