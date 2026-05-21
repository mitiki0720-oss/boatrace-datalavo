import type { BoatPayoutItem, BoatRaceItem, BoatRaceResult, BoatTodayFeed, BoatTodayVenueItem } from "./boatraceTypes";
import type { ParsedBoatBet } from "./boatBetParser";
import { normalizeBoatBetCombination } from "./boatBetParser";

export type BoatPracticeResultStatus = "pending" | "confirmed" | "missing";
export type BoatResultLookupStatus = "matched" | "date-mismatch" | "pending" | "missing" | "payout-missing" | "manual";

export type BoatRaceResultLookupDebug = {
	targetDate?: string;
	feedDate?: string;
	targetVenueName?: string;
	targetVenueCode?: string;
	matchedVenueName?: string;
	matchedVenueCode?: string;
	raceNo?: number;
	raceFound: boolean;
	resultFound: boolean;
	payoutFound: boolean;
	finishOrderText?: string;
	trifectaPayout?: string | number;
	exactaPayout?: string | number;
};

export type BoatResultSettlement = {
	status: BoatPracticeResultStatus;
	lookupStatus: BoatResultLookupStatus;
	lookupDebug?: BoatRaceResultLookupDebug;
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

const normalizeVenueName = (value: string | undefined): string =>
	String(value ?? "")
		.normalize("NFKC")
		.replace(/\s+/g, "")
		.replace(/^ボートレース/, "")
		.replace(/^BOATRACE/i, "")
		.toLowerCase();

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

	const record = result as BoatRaceResult & Record<string, unknown>;
	const rows = [
		...(Array.isArray(result.payoutsFull) ? result.payoutsFull : []),
		...(Array.isArray(result.payouts) ? result.payouts : []),
		...(Array.isArray(record.payout) ? record.payout as BoatPayoutItem[] : []),
		...(Array.isArray(record.oddsPayouts) ? record.oddsPayouts as BoatPayoutItem[] : []),
		...(Array.isArray(record.refunds) ? record.refunds as unknown as BoatPayoutItem[] : []),
		result.payout3tan,
		record.trifecta,
		record.sanrentan,
		result.payout3fuku,
		result.payout2tan,
		record.exacta,
		record.nirentan,
		result.payout2fuku,
		...(Array.isArray(result.payoutWide) ? result.payoutWide : []),
	].filter((item): item is BoatPayoutItem => {
		if (!item || typeof item !== "object") {
			return false;
		}

		const row = item as Record<string, unknown>;
		return Boolean((row.betType || row.type || row.label) && (row.combination || row.numbers || row.result));
	}).map((item) => {
		const row = item as BoatPayoutItem & Record<string, unknown>;
		return {
			betType: String(row.betType ?? row.type ?? row.label ?? ""),
			combination: String(row.combination ?? row.numbers ?? row.result ?? ""),
			payout: String(row.payout ?? row.payoff ?? row.amount ?? row.refund ?? ""),
			popularity: row.popularity as number | string | undefined,
		};
	});

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
		const betType = String(payout.betType).normalize("NFKC").toLowerCase();
		const payoutOrdered = normalizeBoatBetCombination(payout.combination);
		const payoutUnordered = normalizeUnorderedCombination(payout.combination);

		if (bet.type === "trifecta") {
			return (/3\s*連\s*単|三\s*連\s*単|trifecta|sanrentan/.test(betType)) && payoutOrdered === orderedCombination;
		}

		if (bet.type === "exacta") {
			return (/2\s*連\s*単|二\s*連\s*単|exacta|nirentan/.test(betType)) && payoutOrdered === orderedCombination;
		}

		if (bet.type === "trio") {
			return (/3\s*連\s*複|三\s*連\s*複|trio/.test(betType)) && payoutUnordered === unorderedCombination;
		}

		if (bet.type === "quinella") {
			return (/2\s*連\s*複|二\s*連\s*複|quinella/.test(betType)) && payoutUnordered === unorderedCombination;
		}

		if (bet.type === "wide") {
			return (/拡\s*連\s*複|wide|ワイド/.test(betType)) && payoutUnordered === unorderedCombination;
		}

		return false;
	}) ?? null;
};

const readFinishOrderText = (result: (BoatRaceResult & Record<string, unknown>) | undefined): string => {
	if (!result) {
		return "";
	}

	const order = result.finishOrder ?? result.resultTop3 ?? result.top3;
	if (Array.isArray(order)) {
		return order.slice(0, 3).map(String).join("-");
	}

	const arrivals = result.arrivals;
	if (Array.isArray(arrivals)) {
		return arrivals
			.slice(0, 3)
			.map((row) => {
				if (typeof row === "number" || typeof row === "string") {
					return String(row);
				}
				const record = row as Record<string, unknown>;
				return String(record.frameNo ?? record.frame ?? record.boatNumber ?? record.lane ?? "");
			})
			.filter(Boolean)
			.join("-");
	}

	if (Array.isArray(result.finishers)) {
		return result.finishers
			.slice(0, 3)
			.map((row) => String(row.frameNo ?? row.frame ?? row.boatNumber ?? row.lane ?? ""))
			.filter(Boolean)
			.join("-");
	}

	return "";
};

const buildLookupDebug = (params: {
	feed?: BoatTodayFeed | null;
	targetDate?: string;
	targetVenueName?: string;
	targetVenueCode?: string;
	matchedVenue?: BoatTodayVenueItem;
	race?: BoatRaceItem;
	raceNo?: number;
}): BoatRaceResultLookupDebug => {
	const { feed, targetDate, targetVenueName, targetVenueCode, matchedVenue, race, raceNo } = params;
	const result = race?.result as (BoatRaceResult & Record<string, unknown>) | undefined;
	const payouts = readResultPayouts(result);
	const findByType = (pattern: RegExp) => payouts.find((payout) => pattern.test(String(payout.betType).normalize("NFKC")));

	return {
		targetDate,
		feedDate: feed?.date,
		targetVenueName,
		targetVenueCode,
		matchedVenueName: matchedVenue?.venueName,
		matchedVenueCode: matchedVenue?.venueCode,
		raceNo,
		raceFound: Boolean(race),
		resultFound: Boolean(result),
		payoutFound: payouts.length > 0,
		finishOrderText: readFinishOrderText(result),
		trifectaPayout: findByType(/3\s*連\s*単|trifecta|sanrentan/)?.payout,
		exactaPayout: findByType(/2\s*連\s*単|exacta|nirentan/)?.payout,
	};
};

export function findBoatRaceResultForPractice(params: {
	feed: BoatTodayFeed | null | undefined;
	date?: string;
	venueName?: string;
	venueCode?: string;
	raceNo?: number;
}): { venue?: BoatTodayVenueItem; race?: BoatRaceItem; lookupStatus: BoatResultLookupStatus; debug: BoatRaceResultLookupDebug } {
	const { feed, date, venueName, venueCode, raceNo } = params;
	if (!feed || !Array.isArray(feed.venues)) {
		return {
			lookupStatus: "missing",
			debug: buildLookupDebug({ feed, targetDate: date, targetVenueName: venueName, targetVenueCode: venueCode, raceNo }),
		};
	}

	const normalizedVenueName = normalizeVenueName(venueName);
	const venue = feed.venues.find((item) => {
		if (venueCode && item.venueCode === venueCode) {
			return true;
		}

		return normalizedVenueName && normalizeVenueName(item.venueName) === normalizedVenueName;
	});

	const race = venue?.races?.find((item) => Number(item.raceNo) === Number(raceNo));
	const debug = buildLookupDebug({ feed, targetDate: date, targetVenueName: venueName, targetVenueCode: venueCode, matchedVenue: venue, race, raceNo });

	if (!venue || !race) {
		return { venue, race, lookupStatus: "missing", debug };
	}

	if (!race.result || race.result.status === "pending" || !debug.finishOrderText) {
		return { venue, race, lookupStatus: "pending", debug };
	}

	if (date && feed.date && date !== feed.date) {
		return { venue, race, lookupStatus: "date-mismatch", debug };
	}

	return { venue, race, lookupStatus: debug.payoutFound ? "matched" : "payout-missing", debug };
}

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
			(venueName && normalizeVenueName(venue.venueName) === normalizeVenueName(venueName)) ||
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
			lookupStatus: "missing",
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

	const finishOrderText = readFinishOrderText(result as BoatRaceResult & Record<string, unknown>);
	if (result.status !== "confirmed" || !finishOrderText) {
		return {
			status: "pending",
			lookupStatus: "pending",
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
		lookupStatus: payouts.length > 0 ? "matched" : "payout-missing",
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
