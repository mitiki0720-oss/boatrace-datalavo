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
	ticketsCount?: number;
	parsedBetsCount?: number;
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
	observedFeedGeneratedAt?: string;
	autoSettled?: boolean;
	autoSettledAt?: string;
	resultFingerprint?: string;
	settlementReason?: string;
	memo?: string;
	createdAt?: string;
	updatedAt?: string;
	practiceMemo: string;
	savedAt: string;
};

export type BoatPracticeResultRecordMap = Record<string, BoatPracticeResultRecord>;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const PRACTICE_RESULT_MAX_RECORDS = 200;
const PRACTICE_RESULT_WARNING_REASON = "quota-exceeded";

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

const readDateValue = (value: string | undefined): number => {
	if (!value) {
		return 0;
	}

	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const compactHitBets = (hitBets: ParsedBoatBet[] | undefined): ParsedBoatBet[] | undefined => {
	if (!Array.isArray(hitBets) || hitBets.length <= 0) {
		return undefined;
	}

	return hitBets.slice(0, 3).map((bet) => ({
		type: bet.type,
		label: bet.label,
		numbers: Array.isArray(bet.numbers) ? bet.numbers.slice(0, 3) : [],
		normalized: bet.normalized,
		amountYen: bet.amountYen,
		sourceLine: "",
	}));
};

export const compactBoatPracticeResultRecord = (record: BoatPracticeResultRecord): BoatPracticeResultRecord => {
	const ticketsCount = record.ticketsCount ?? (Array.isArray(record.tickets) ? record.tickets.length : undefined);
	const parsedBetsCount = record.parsedBetsCount ?? (Array.isArray(record.parsedBets) ? record.parsedBets.length : undefined);
	const compactedBetSummary = record.betSummary
		? {
			totalBets: readNumber(record.betSummary.totalBets),
			trifectaCount: readNumber(record.betSummary.trifectaCount),
			exactaCount: readNumber(record.betSummary.exactaCount),
			totalStakeYen: readNumber(record.betSummary.totalStakeYen),
		}
		: undefined;

	return {
		id: record.id,
		raceKey: record.raceKey,
		raceId: record.raceId,
		venueCode: record.venueCode,
		venueName: record.venueName,
		date: record.date,
		raceNo: record.raceNo,
		raceTitle: record.raceTitle,
		actualFinishOrderText: record.actualFinishOrderText,
		actualOrder: record.actualOrder,
		finishOrder: record.finishOrder,
		investmentAmount: readNumber(record.investmentAmount),
		payoutAmount: readNumber(record.payoutAmount),
		profitLoss: readNumber(record.profitLoss),
		roi: readNumber(record.roi),
		resultStatus: record.resultStatus,
		resultLookupStatus: record.resultLookupStatus,
		totalStakeYen: readNumber(record.totalStakeYen ?? compactedBetSummary?.totalStakeYen ?? record.investmentAmount),
		payoutYen: readNumber(record.payoutYen ?? record.payoutAmount),
		profitYen: readNumber(record.profitYen ?? record.profitLoss),
		hitBetType: record.hitBetType,
		hitBetNumbers: record.hitBetNumbers,
		hitBets: compactHitBets(record.hitBets),
		ticketsCount,
		parsedBetsCount,
		betSummary: compactedBetSummary,
		kimarite: record.kimarite,
		startInfoText: record.startInfoText,
		resultSource: record.resultSource,
		observedFeedGeneratedAt: record.observedFeedGeneratedAt,
		autoSettled: record.autoSettled,
		autoSettledAt: record.autoSettledAt,
		resultFingerprint: record.resultFingerprint,
		settlementReason: record.settlementReason,
		memo: record.memo,
		practiceMemo: record.practiceMemo,
		savedAt: record.savedAt,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	};
};

const prioritizePracticeRecords = (records: BoatPracticeResultRecord[]): BoatPracticeResultRecord[] => {
	const uniqueDates = Array.from(new Set(records.map((record) => record.date).filter(Boolean))).sort((left, right) => right.localeCompare(left));
	const preferredDates = new Set(uniqueDates.slice(0, 2));

	return [...records].sort((left, right) => {
		const leftPriority = preferredDates.has(left.date) ? 0 : 1;
		const rightPriority = preferredDates.has(right.date) ? 0 : 1;

		if (leftPriority !== rightPriority) {
			return leftPriority - rightPriority;
		}

		return readDateValue(right.updatedAt ?? right.savedAt ?? right.createdAt) - readDateValue(left.updatedAt ?? left.savedAt ?? left.createdAt);
	});
};

export function pruneBoatPracticeResultRecordsByDate(records: BoatPracticeResultRecordMap, keepDates: string[]): BoatPracticeResultRecordMap {
	const keepDateSet = new Set(keepDates.filter(Boolean));
	if (keepDateSet.size <= 0) {
		return {};
	}

	return compactBoatPracticeResultRecords(
		Object.values(records)
			.filter((record) => keepDateSet.has(record.date))
			.reduce<BoatPracticeResultRecordMap>((acc, record) => {
				acc[buildPracticeRecordKey(record)] = record;
				return acc;
			}, {}),
	);
}

export function compactBoatPracticeResultRecords(records: BoatPracticeResultRecordMap, maxRecords = PRACTICE_RESULT_MAX_RECORDS): BoatPracticeResultRecordMap {
	const compactedRecords = prioritizePracticeRecords(Object.values(records).map(compactBoatPracticeResultRecord)).slice(0, maxRecords);

	return compactedRecords.reduce<BoatPracticeResultRecordMap>((acc, record) => {
		const key = buildPracticeRecordKey(record);
		if (key) {
			acc[key] = {
				...record,
				raceKey: record.raceKey || key,
				id: record.id || key,
			};
		}

		return acc;
	}, {});
}

export type SaveBoatPracticeResultRecordsResult = {
	ok: boolean;
	records: BoatPracticeResultRecordMap;
	reason?: "quota-exceeded" | "unknown";
	compacted?: boolean;
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
				records[key] = compactBoatPracticeResultRecord({
					...record,
					raceKey: record.raceKey || key,
				});
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
			records[recordKey] = compactBoatPracticeResultRecord({
				...record,
				raceKey: recordKey,
			});
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

export function saveBoatPracticeResultRecords(records: BoatPracticeResultRecordMap): SaveBoatPracticeResultRecordsResult {
	if (!canUseStorage()) {
		return { ok: true, records };
	}

	const compactedRecords = compactBoatPracticeResultRecords(records);

	try {
		window.localStorage.setItem(BOAT_PRACTICE_RESULT_STORAGE_KEY, JSON.stringify(compactedRecords));
		return { ok: true, records: compactedRecords, compacted: true };
	} catch (error) {
		if (error instanceof DOMException && error.name === "QuotaExceededError") {
			console.warn("[practice-results] localStorage quota exceeded. Trying compact save.", error);
			const fallbackRecords = compactBoatPracticeResultRecords(compactedRecords, 120);

			try {
				window.localStorage.setItem(BOAT_PRACTICE_RESULT_STORAGE_KEY, JSON.stringify(fallbackRecords));
				return {
					ok: true,
					records: fallbackRecords,
					reason: PRACTICE_RESULT_WARNING_REASON,
					compacted: true,
				};
			} catch (secondError) {
				console.error("[practice-results] compact save failed", secondError);
				return { ok: false, records: fallbackRecords, reason: PRACTICE_RESULT_WARNING_REASON, compacted: true };
			}
		}

		console.error("[practice-results] save failed", error);
		return { ok: false, records: compactedRecords, reason: "unknown", compacted: true };
	}
}

export function findBoatPracticeResultRecord(raceKey: string): BoatPracticeResultRecord | undefined {
	const records = loadBoatPracticeResultRecords();
	return records[raceKey] ?? Object.values(records).find((record) => record.raceKey === raceKey || record.id === raceKey);
}

export function upsertBoatPracticeResultRecord(record: BoatPracticeResultRecord): SaveBoatPracticeResultRecordsResult {
	const records = loadBoatPracticeResultRecords();
	const compactedRecord = compactBoatPracticeResultRecord(record);
	const key = buildPracticeRecordKey(compactedRecord);
	const nextRecords: BoatPracticeResultRecordMap = {
		...records,
		[key]: {
			...compactedRecord,
			raceKey: compactedRecord.raceKey || key,
			id: compactedRecord.id || key,
		},
	};

	return saveBoatPracticeResultRecords(nextRecords);
}

export function deleteBoatPracticeResultRecord(raceKey: string): BoatPracticeResultRecordMap {
	const records = loadBoatPracticeResultRecords();
	const nextRecords: BoatPracticeResultRecordMap = { ...records };

	delete nextRecords[raceKey];
	saveBoatPracticeResultRecords(nextRecords);

	return nextRecords;
}
