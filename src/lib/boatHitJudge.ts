import type { BoatPredictionTicket } from "./boatraceTypes";
import { normalizeBoatCombination } from "./boatPredictionParser";

export type BoatHitStatus = "hit" | "miss" | "pending";

export type BoatHitJudgeResult = {
	status: BoatHitStatus;
	hitTicket?: BoatPredictionTicket;
	hitBetType?: string;
	hitCombination?: string;
	resultTop3?: string;
	resultTop2?: string;
};

export function getBoatResultTopCombination(
	actualFinishOrderText: string,
	count: 2 | 3,
): string {
	const normalized = normalizeBoatCombination(actualFinishOrderText ?? "");
	const numbers = normalized.split("-").filter(Boolean);

	return numbers.slice(0, count).join("-");
}

export function judgeBoatPredictionHit(params: {
	tickets: BoatPredictionTicket[];
	actualFinishOrderText?: string;
}): BoatHitJudgeResult {
	const { tickets, actualFinishOrderText } = params;
	if (!actualFinishOrderText?.trim()) {
		return { status: "pending" };
	}

	if (!tickets.length) {
		return { status: "pending" };
	}

	const resultTop3 = getBoatResultTopCombination(actualFinishOrderText, 3);
	const resultTop2 = getBoatResultTopCombination(actualFinishOrderText, 2);
	const normalizedTickets = tickets.map((ticket) => ({
		...ticket,
		combination: normalizeBoatCombination(ticket.combination),
	}));

	const trifectaHit = normalizedTickets.find(
		(ticket) => ticket.betType.includes("3連単") && ticket.combination === resultTop3,
	);
	if (trifectaHit) {
		return {
			status: "hit",
			hitTicket: trifectaHit,
			hitBetType: trifectaHit.betType,
			hitCombination: trifectaHit.combination,
			resultTop3,
			resultTop2,
		};
	}

	const exactaHit = normalizedTickets.find(
		(ticket) => ticket.betType.includes("2連単") && ticket.combination === resultTop2,
	);
	if (exactaHit) {
		return {
			status: "hit",
			hitTicket: exactaHit,
			hitBetType: exactaHit.betType,
			hitCombination: exactaHit.combination,
			resultTop3,
			resultTop2,
		};
	}

	return {
		status: "miss",
		resultTop3,
		resultTop2,
	};
}