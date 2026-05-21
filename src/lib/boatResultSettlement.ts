import type { BoatPayoutItem, BoatRaceItem, BoatRaceResult, BoatTodayFeed, BoatTodayVenueItem } from "./boatraceTypes";
import type { ParsedBoatBet } from "./boatBetParser";
import { normalizeBoatBetCombination } from "./boatBetParser";

export type BoatPracticeResultStatus = "pending" | "confirmed" | "missing";

export type BoatResultSettlement = {
	status: BoatPracticeResultStatus;
	finishOrderText: string;
	first?: number;
	second?: number;
	third?: number;
	kimarite?: string;
	startInfoText?: string;
	payouts: BoatPayoutItem[];
	hitBets: ParsedBoatBet[];
	payoutYen: number;
	profitYen: number;
	roi: number;
	resultSource?: string;
	message: string;
};

const readPayoutYen = (value: string | number | undefined): number => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value !== "string") {
		return 0;
	}

	const parsed = Number(value.normalize("NFKC").replace(/[^\d]/g, ""));
	return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeUnorderedCombination = (value: string): string =>
	normalizeBoatBetCombination(value)
		.split("-")
		.filter(Boolean)
		.sort()
		.join("-");

const readResultPayouts = (result: BoatRaceResult | undefined): BoatPayoutItem[] => {
	if (!result) {
		return [];
	}

	const rows = [
		...(Array.isArray(result.payoutsFull) ? result.payoutsFull : []),
		...(Array.isArray(result.payouts) ? result.payouts : []),
		result.payout3tan,
		result.payout3fuku,
		result.payout2tan,
		result.payout2fuku,
		...(Array.isArray(result.payoutWide) ? result.payoutWide : []),
	].filter((item): item is BoatPayoutItem => Boolean(item?.betType && item?.combination));

	const seen = new Set<string>();
	return rows.filter((row) => {
		const key = `${row.betType}:${row.combination}:${row.payout}`;
		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
};

const findPayoutForBet = (bet: ParsedBoatBet, payouts: BoatPayoutItem[]): BoatPayoutItem | null => {
	const orderedCombination = normalizeBoatBetCombination(bet.normalized);
	const unorderedCombination = normalizeUnorderedCombination(bet.normalized);

	return payouts.find((payout) => {
		const betType = payout.betType;
		const payoutOrdered = normalizeBoatBetCombination(payout.combination);
		const payoutUnordered = normalizeUnorderedCombination(payout.combination);

		if (bet.type === "trifecta") {
			return betType === "3連単" && payoutOrdered === orderedCombination;
		}

		if (bet.type === "exacta") {
			return betType === "2連単" && payoutOrdered === orderedCombination;
		}

		if (bet.type === "trio") {
			return betType === "3連複" && payoutUnordered === unorderedCombination;
		}

		if (bet.type === "quinella") {
			return betType === "2連複" && payoutUnordered === unorderedCombination;
		}

		if (bet.type === "wide") {
			return betType === "拡連複" && payoutUnordered === unorderedCombination;
		}

		return false;
	}) ?? null;
};

export function findBoatRaceForSettlement(params: {
	feed: BoatTodayFeed | null | undefined;
	date?: string;
	venueName?: string;
	venueCode?: string;
	raceNo?: number;
	raceId?: string;
}): { venue: BoatTodayVenueItem; race: BoatRaceItem } | null {
	const { feed, date, venueName, venueCode, raceNo, raceId } = params;
	if (!feed || !Array.isArray(feed.venues)) {
		return null;
	}

	for (const venue of feed.venues) {
		const venueMatched =
			(venueCode && venue.venueCode === venueCode) ||
			(venueName && venue.venueName === venueName) ||
			(date && venue.date === date && !venueCode && !venueName);

		if (!venueMatched) {
			continue;
		}

		const race = (venue.races ?? []).find((item) =>
			(raceId && item.raceId === raceId) ||
			(typeof raceNo === "number" && item.raceNo === raceNo)
		);

		if (race) {
			return { venue, race };
		}
	}

	return null;
}

export function settleBoatPredictionResult(params: {
	race: BoatRaceItem | null | undefined;
	bets: ParsedBoatBet[];
	investmentAmount: number;
	source?: string;
}): BoatResultSettlement {
	const { race, bets, investmentAmount, source } = params;
	const result = race?.result;

	if (!result) {
		return {
			status: "missing",
			finishOrderText: "",
			payouts: [],
			hitBets: [],
			payoutYen: 0,
			profitYen: 0,
			roi: 0,
			resultSource: source,
			message: "結果未取得",
		};
	}

	const finishOrderText = Array.isArray(result.finishOrder) ? result.finishOrder.slice(0, 3).join("-") : "";
	if (result.status !== "confirmed" || !finishOrderText) {
		return {
			status: "pending",
			finishOrderText,
			payouts: readResultPayouts(result),
			hitBets: [],
			payoutYen: 0,
			profitYen: 0,
			roi: 0,
			resultSource: source,
			message: "結果待ち",
		};
	}

	const payouts = readResultPayouts(result);
	const hitBets = bets.filter((bet) => Boolean(findPayoutForBet(bet, payouts)));
	const payoutYen = hitBets.reduce((sum, bet) => sum + readPayoutYen(findPayoutForBet(bet, payouts)?.payout), 0);
	const profitYen = payoutYen - investmentAmount;
	const roi = investmentAmount > 0 ? payoutYen / investmentAmount * 100 : 0;
	const finishNumbers = finishOrderText.split("-").map((value) => Number(value)).filter((value) => Number.isFinite(value));
	const startInfoRows = result.startInfo ?? result.startInfos ?? [];
	const startInfoText = Array.isArray(startInfoRows)
		? startInfoRows.map((row) => `${row.course ?? row.entryCourse ?? "-"}:${row.frameNo ?? row.frame ?? row.boatNumber ?? "-"} ST${row.stDisplay ?? row.startTiming ?? row.st ?? "-"}`).join(" / ")
		: "";

	return {
		status: "confirmed",
		finishOrderText,
		first: finishNumbers[0],
		second: finishNumbers[1],
		third: finishNumbers[2],
		kimarite: result.kimarite ?? result.winningMethod ?? result.winningMove,
		startInfoText,
		payouts,
		hitBets,
		payoutYen,
		profitYen,
		roi,
		resultSource: source,
		message: hitBets.length > 0 ? "的中" : "不的中",
	};
}
