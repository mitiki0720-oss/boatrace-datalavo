import {
	normalizeBoatBetCombination,
	normalizeBoatBetText,
	parseBoatBets,
	type BoatBetType,
	type ParsedBoatBet,
} from "./boatBetParser";
import type { BoatPredictionTicket } from "./boatraceTypes";

const normalizeIndex = (value: string | undefined, fallbackIndex: number) =>
	String(value || fallbackIndex + 1).padStart(2, "0");

const betTypeLabels: Record<BoatBetType, BoatPredictionTicket["betType"]> = {
	trifecta: "3連単",
	exacta: "2連単",
	trio: "3連複",
	quinella: "2連複",
	wide: "拡連複",
};

const normalizeGroup = (value?: string): BoatPredictionTicket["group"] => {
	const text = normalizeBoatBetText(value ?? "");

	if (/厚め/.test(text)) return "厚め";
	if (/本線/.test(text)) return "本線";
	if (/穴/.test(text)) return "穴狙い";

	return "その他";
};

export function normalizeBoatCombination(value: string): string {
	return normalizeBoatBetCombination(value);
}

export function predictionTicketFromParsedBet(bet: ParsedBoatBet, index: number): BoatPredictionTicket {
	return {
		index: normalizeIndex(bet.index, index),
		betType: betTypeLabels[bet.type] ?? bet.label,
		combination: bet.normalized,
		group: normalizeGroup(bet.label),
		note: bet.sourceLine,
	};
}

export function parseBoatPredictionTickets(predictionText: string): BoatPredictionTicket[] {
	return parseBoatBets(predictionText).bets.map(predictionTicketFromParsedBet);
}

export function countBoatPredictionTicketsByType(tickets: BoatPredictionTicket[]): {
	total: number;
	trifecta: number;
	exacta: number;
	other: number;
} {
	const trifecta = tickets.filter((ticket) => /3連単/.test(normalizeBoatBetText(ticket.betType))).length;
	const exacta = tickets.filter((ticket) => /2連単/.test(normalizeBoatBetText(ticket.betType))).length;
	const other = tickets.length - trifecta - exacta;

	return {
		total: tickets.length,
		trifecta,
		exacta,
		other,
	};
}
