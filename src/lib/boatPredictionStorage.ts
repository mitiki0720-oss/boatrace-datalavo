import {
	normalizeBoatBetCombination,
	parseBoatBets,
	type ParsedBoatBet,
	type ParsedBoatBetSummary,
} from "./boatBetParser";
import { parseBoatPredictionTickets } from "./boatPredictionParser";
import type { BoatPredictionRecord, BoatPredictionTicket } from "./boatraceTypes";

export const BOAT_PREDICTION_STORAGE_KEY = "kurari-boat-data-labo-prediction-records";

export type BoatPredictionRecordMap = Record<string, BoatPredictionRecord>;

const canUseStorage = () => typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const isRecordLike = (value: unknown): value is BoatPredictionRecordMap => typeof value === "object" && value !== null && !Array.isArray(value);

const inferParsedBetTypeFromTicket = (ticket: BoatPredictionTicket): ParsedBoatBet["type"] | null => {
	if (ticket.betType.includes("3連単")) {
		return "trifecta";
	}

	if (ticket.betType.includes("2連単")) {
		return "exacta";
	}

	if (ticket.betType.includes("3連複")) {
		return "trio";
	}

	if (ticket.betType.includes("2連複")) {
		return "quinella";
	}

	if (ticket.betType.includes("拡連複") || ticket.betType.toLowerCase().includes("wide")) {
		return "wide";
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
		}];
	});

const buildBetSummary = (parsedBets: ParsedBoatBet[]): ParsedBoatBetSummary => ({
	bets: parsedBets,
	totalBets: parsedBets.length,
	trifectaCount: parsedBets.filter((bet) => bet.type === "trifecta").length,
	exactaCount: parsedBets.filter((bet) => bet.type === "exacta").length,
	totalStakeYen: parsedBets.length * 100,
});

const normalizeTickets = (record: BoatPredictionRecord): BoatPredictionTicket[] => {
	if (Array.isArray(record.tickets) && record.tickets.length > 0) {
		return record.tickets;
	}

	return parseBoatPredictionTickets(record.predictionText ?? "");
};

const normalizeParsedBets = (record: BoatPredictionRecord, tickets: BoatPredictionTicket[]): ParsedBoatBet[] => {
	if (Array.isArray(record.parsedBets) && record.parsedBets.length > 0) {
		return record.parsedBets;
	}

	const parsedFromText = parseBoatBets(record.predictionText ?? "").bets;
	if (parsedFromText.length > 0) {
		return parsedFromText;
	}

	return buildParsedBetsFromTickets(tickets);
};

export function hydrateBoatPredictionRecord(record: BoatPredictionRecord): BoatPredictionRecord {
	const tickets = normalizeTickets(record);
	const parsedBets = normalizeParsedBets(record, tickets);
	const betSummary = parsedBets.length > 0
		? buildBetSummary(parsedBets)
		: record.betSummary ?? buildBetSummary([]);
	const totalStakeYen = record.totalStakeYen ?? betSummary.totalStakeYen;
	const updatedAt = record.updatedAt ?? record.savedAt;

	return {
		...record,
		tickets,
		parsedBets,
		betSummary,
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
	const hydratedRecord = hydrateBoatPredictionRecord(record);
	const nextRecords: BoatPredictionRecordMap = {
		...records,
		[hydratedRecord.raceKey]: {
			...hydratedRecord,
			tickets: hydratedRecord.tickets as BoatPredictionTicket[] | undefined,
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
