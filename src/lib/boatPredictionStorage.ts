import {
	BOAT_BET_PARSER_VERSION,
	normalizeBoatBetCombination,
	normalizeBoatBetType,
	parseBoatBets,
	type ParsedBoatBet,
	type ParsedBoatBetSummary,
} from "./boatBetParser";
import { parseBoatPredictionTickets } from "./boatPredictionParser";
import type { BoatPredictionRecord, BoatPredictionTicket } from "./boatraceTypes";

export const BOAT_PREDICTION_STORAGE_KEY = "kurari-boat-data-labo-prediction-records";

export type BoatPredictionRecordMap = Record<string, BoatPredictionRecord>;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const BOAT_PREDICTION_FALLBACK_KEEP_DAYS = 2;

const isRecordLike = (value: unknown): value is BoatPredictionRecordMap => typeof value === "object" && value !== null && !Array.isArray(value);

const inferParsedBetTypeFromTicket = (ticket: BoatPredictionTicket): ParsedBoatBet["type"] | null => {
	const normalizedType = normalizeBoatBetType(ticket.betType);
	if (normalizedType) {
		return normalizedType;
	}

	const count = ticket.combination.split("-").filter(Boolean).length;
	return count >= 3 ? "trifecta" : count === 2 ? "exacta" : null;
};

const buildParsedBetsFromTickets = (tickets: BoatPredictionTicket[]): ParsedBoatBet[] =>
	tickets.flatMap<ParsedBoatBet>((ticket) => {
		const type = inferParsedBetTypeFromTicket(ticket);
		const normalized = normalizeBoatBetCombination(ticket.combination);
		const numbers = normalized
			.split("-")
			.map((value) => Number(value))
			.filter((value) => Number.isFinite(value));

		if (!type || numbers.length < 2) {
			return [];
		}

		return [{
			type,
			label: ticket.betType,
			numbers,
			normalized,
			amountYen: 100,
			sourceLine: `${ticket.index} ${ticket.betType} ${ticket.combination}`,
			index: ticket.index,
		}];
	});

const buildBetSummary = (parsedBets: ParsedBoatBet[], template?: Partial<ParsedBoatBetSummary>): ParsedBoatBetSummary => ({
	bets: parsedBets,
	totalBets: parsedBets.length,
	trifectaCount: parsedBets.filter((bet) => bet.type === "trifecta").length,
	exactaCount: parsedBets.filter((bet) => bet.type === "exacta").length,
	totalStakeYen: parsedBets.reduce((sum, bet) => sum + (bet.amountYen || 100), 0),
	warnings: template?.warnings ?? [],
	betSectionText: template?.betSectionText ?? "",
	parseStatus: template?.parseStatus ?? (parsedBets.length > 0 ? "ready" : "invalid"),
	parsedAt: template?.parsedAt ?? "",
	parserVersion: template?.parserVersion ?? BOAT_BET_PARSER_VERSION,
	invalidRows: template?.invalidRows ?? [],
	duplicateRows: template?.duplicateRows ?? [],
});

const normalizeTickets = (record: BoatPredictionRecord): BoatPredictionTicket[] => {
	if (Array.isArray(record.tickets) && record.tickets.length > 0) {
		return record.tickets;
	}

	return parseBoatPredictionTickets(record.rawPredictionText ?? record.predictionText ?? "");
};

const normalizeParsedBets = (record: BoatPredictionRecord, tickets: BoatPredictionTicket[]): ParsedBoatBet[] => {
	if (Array.isArray(record.parsedBets) && record.parsedBets.length > 0) {
		return record.parsedBets;
	}

	const parsedFromText = parseBoatBets(record.rawPredictionText ?? record.predictionText ?? "").bets;
	if (parsedFromText.length > 0) {
		return parsedFromText;
	}

	return buildParsedBetsFromTickets(tickets);
};

const shouldRepairBoatPredictionParse = (
	record: BoatPredictionRecord,
	parsedFromText: ParsedBoatBetSummary,
): boolean => {
	const rawPredictionText = record.rawPredictionText ?? record.predictionText ?? "";
	if (!rawPredictionText.trim()) {
		return false;
	}

	const storedBetCount = Array.isArray(record.parsedBets) ? record.parsedBets.length : 0;
	const storedTicketCount = Array.isArray(record.tickets) ? record.tickets.length : 0;
	const parsedCount = parsedFromText.bets.length;

	return (
		record.parserVersion !== BOAT_BET_PARSER_VERSION ||
		parsedCount > storedBetCount ||
		parsedCount !== storedTicketCount ||
		storedBetCount <= 0 ||
		record.parseStatus === "warning" ||
		record.parseStatus === "invalid" ||
		record.parseStatus === "missing-section"
	);
};

export function repairBoatPredictionParseIfNeeded(record: BoatPredictionRecord): BoatPredictionRecord {
	const rawPredictionText = record.rawPredictionText ?? record.predictionText ?? "";
	const parsedFromText = parseBoatBets(rawPredictionText);

	if (!shouldRepairBoatPredictionParse(record, parsedFromText)) {
		return {
			...record,
			rawPredictionText,
			betSectionText: record.betSectionText ?? parsedFromText.betSectionText,
			parseWarnings: record.parseWarnings ?? parsedFromText.warnings ?? [],
			parseStatus: record.parseStatus ?? parsedFromText.parseStatus,
			parsedAt: record.parsedAt ?? parsedFromText.parsedAt,
			parserVersion: record.parserVersion ?? parsedFromText.parserVersion,
			invalidBetRows: record.invalidBetRows ?? parsedFromText.invalidRows ?? [],
			duplicateBetRows: record.duplicateBetRows ?? parsedFromText.duplicateRows ?? [],
		};
	}

	const nextTickets = parsedFromText.bets.length > 0
		? parseBoatPredictionTickets(rawPredictionText)
		: record.tickets ?? [];
	const nextParsedBets = parsedFromText.bets.length > 0
		? parsedFromText.bets
		: normalizeParsedBets(record, nextTickets);
	const nextBetSummary = parsedFromText.bets.length > 0
		? parsedFromText
		: buildBetSummary(nextParsedBets, parsedFromText);

	return {
		...record,
		rawPredictionText,
		tickets: nextTickets,
		parsedBets: nextParsedBets,
		betSummary: nextBetSummary,
		totalStakeYen: nextBetSummary.totalStakeYen,
		betSectionText: parsedFromText.betSectionText,
		parseWarnings: parsedFromText.warnings ?? [],
		parseStatus: parsedFromText.parseStatus,
		parsedAt: parsedFromText.parsedAt,
		parserVersion: parsedFromText.parserVersion,
		invalidBetRows: parsedFromText.invalidRows ?? [],
		duplicateBetRows: parsedFromText.duplicateRows ?? [],
	};
}

const readPredictionDateValue = (record: BoatPredictionRecord): number => {
	const parsed = Date.parse(record.updatedAt ?? record.savedAt ?? "");
	return Number.isFinite(parsed) ? parsed : 0;
};

const sortBoatPredictionRecordsByRecency = (records: BoatPredictionRecord[]): BoatPredictionRecord[] =>
	[...records].sort((left, right) => {
		if (left.date !== right.date) {
			return right.date.localeCompare(left.date);
		}

		return readPredictionDateValue(right) - readPredictionDateValue(left);
	});

const reduceBoatPredictionRecords = (records: BoatPredictionRecord[]): BoatPredictionRecordMap =>
	records.reduce<BoatPredictionRecordMap>((acc, record) => {
		if (record.raceKey) {
			acc[record.raceKey] = hydrateBoatPredictionRecord(record);
		}

		return acc;
	}, {});

const selectLatestPredictionDates = (records: BoatPredictionRecordMap, keepDays = BOAT_PREDICTION_FALLBACK_KEEP_DAYS): string[] => Array.from(
	new Set(Object.values(records).map((record) => record.date).filter(Boolean)),
).sort((left, right) => right.localeCompare(left)).slice(0, keepDays);

export function pruneBoatPredictionRecordsByDate(records: BoatPredictionRecordMap, keepDates: string[]): BoatPredictionRecordMap {
	const keepDateSet = new Set(keepDates.filter(Boolean));
	if (keepDateSet.size <= 0) {
		return {};
	}

	return reduceBoatPredictionRecords(
		sortBoatPredictionRecordsByRecency(Object.values(records)).filter((record) => keepDateSet.has(record.date)),
	);
}

export type SaveBoatPredictionRecordsResult = {
	ok: boolean;
	records: BoatPredictionRecordMap;
	reason?: "quota-exceeded" | "unknown";
};

export function hydrateBoatPredictionRecord(record: BoatPredictionRecord): BoatPredictionRecord {
	const repairedRecord = repairBoatPredictionParseIfNeeded(record);
	const tickets = normalizeTickets(repairedRecord);
	const parsedBets = normalizeParsedBets(repairedRecord, tickets);
	const fallbackSummary = buildBetSummary(parsedBets, repairedRecord.betSummary);
	const betSummary = parsedBets.length > 0
		? fallbackSummary
		: repairedRecord.betSummary ?? fallbackSummary;
	const totalStakeYen = repairedRecord.totalStakeYen ?? betSummary.totalStakeYen;
	const updatedAt = repairedRecord.updatedAt ?? repairedRecord.savedAt;

	return {
		...repairedRecord,
		tickets,
		parsedBets,
		betSummary: {
			...betSummary,
			betSectionText: repairedRecord.betSectionText ?? betSummary.betSectionText,
			warnings: repairedRecord.parseWarnings ?? betSummary.warnings ?? [],
			parseStatus: repairedRecord.parseStatus ?? betSummary.parseStatus,
			parsedAt: repairedRecord.parsedAt ?? betSummary.parsedAt,
			parserVersion: repairedRecord.parserVersion ?? betSummary.parserVersion,
			invalidRows: repairedRecord.invalidBetRows ?? betSummary.invalidRows ?? [],
			duplicateRows: repairedRecord.duplicateBetRows ?? betSummary.duplicateRows ?? [],
		},
		rawPredictionText: repairedRecord.rawPredictionText ?? repairedRecord.predictionText,
		betSectionText: repairedRecord.betSectionText ?? betSummary.betSectionText,
		parseWarnings: repairedRecord.parseWarnings ?? betSummary.warnings ?? [],
		parseStatus: repairedRecord.parseStatus ?? betSummary.parseStatus,
		parsedAt: repairedRecord.parsedAt ?? betSummary.parsedAt,
		parserVersion: repairedRecord.parserVersion ?? betSummary.parserVersion,
		invalidBetRows: repairedRecord.invalidBetRows ?? betSummary.invalidRows ?? [],
		duplicateBetRows: repairedRecord.duplicateBetRows ?? betSummary.duplicateRows ?? [],
		totalStakeYen,
		updatedAt,
	};
}

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
		if (!isRecordLike(parsed)) {
			return {};
		}

		const records = Object.entries(parsed as BoatPredictionRecordMap).reduce<BoatPredictionRecordMap>((acc, [key, record]) => {
			acc[key] = hydrateBoatPredictionRecord(record);
			return acc;
		}, {});

		if (JSON.stringify(parsed) !== JSON.stringify(records)) {
			saveBoatPredictionRecords(records);
		}

		return records;
	} catch {
		return {};
	}
}

export function saveBoatPredictionRecords(records: BoatPredictionRecordMap): SaveBoatPredictionRecordsResult {
	if (!canUseStorage()) {
		return { ok: true, records };
	}

	const normalizedRecords = reduceBoatPredictionRecords(sortBoatPredictionRecordsByRecency(Object.values(records)));

	try {
		window.localStorage.setItem(BOAT_PREDICTION_STORAGE_KEY, JSON.stringify(normalizedRecords));
		return { ok: true, records: normalizedRecords };
	} catch (error) {
		if (error instanceof DOMException && error.name === "QuotaExceededError") {
			const fallbackRecords = pruneBoatPredictionRecordsByDate(normalizedRecords, selectLatestPredictionDates(normalizedRecords));

			try {
				window.localStorage.setItem(BOAT_PREDICTION_STORAGE_KEY, JSON.stringify(fallbackRecords));
				return { ok: true, records: fallbackRecords, reason: "quota-exceeded" };
			} catch (fallbackError) {
				console.error("[boat-prediction-storage] compact save failed", fallbackError);
				return { ok: false, records: fallbackRecords, reason: "quota-exceeded" };
			}
		}

		console.error("[boat-prediction-storage] save failed", error);
		return { ok: false, records: normalizedRecords, reason: "unknown" };
	}
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
	const hydratedRecord = hydrateBoatPredictionRecord(record);
	const nextRecords: BoatPredictionRecordMap = {
		...records,
		[hydratedRecord.raceKey]: {
			...hydratedRecord,
			tickets: hydratedRecord.tickets as BoatPredictionTicket[] | undefined,
		},
	};

	return saveBoatPredictionRecords(nextRecords).records;
}

export function deleteBoatPredictionRecord(raceKey: string): BoatPredictionRecordMap {
	const records = loadBoatPredictionRecords();
	const nextRecords: BoatPredictionRecordMap = { ...records };

	delete nextRecords[raceKey];
	saveBoatPredictionRecords(nextRecords);

	return nextRecords;
}
