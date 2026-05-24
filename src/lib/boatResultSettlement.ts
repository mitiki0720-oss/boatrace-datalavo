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
	const rows: BoatPayoutItem[] = [];

	const appendPayout = (value: unknown, fallbackBetType?: string) => {
		if (!value) {
			return;
		}

		if (Array.isArray(value)) {
			value.forEach((item) => appendPayout(item, fallbackBetType));
			return;
		}

		if (typeof value !== "object") {
			return;
		}

		const row = value as Record<string, unknown>;

		const betType = String(row.betType ?? row.type ?? row.label ?? fallbackBetType ?? "");
		const combination = String(row.combination ?? row.numbers ?? row.result ?? row.combo ?? "");
		const payout = String(row.payout ?? row.payoff ?? row.amount ?? row.refund ?? row.yen ?? "");

		if (!betType || !combination) {
			return;
		}

		rows.push({
			betType: betType as BoatPayoutItem["betType"],
			combination,
			payout,
			popularity: row.popularity as number | string | undefined,
		});
	};

	appendPayout(record.payoutsFull);
	appendPayout(record.payouts);
	appendPayout(record.payout);
	appendPayout(record.oddsPayouts);
	appendPayout(record.refunds);

	appendPayout(result.payout3tan, "3連単");
	appendPayout(record.trifecta, "3連単");
	appendPayout(record.sanrentan, "3連単");

	appendPayout(result.payout3fuku, "3連複");
	appendPayout(record.trio, "3連複");

	appendPayout(result.payout2tan, "2連単");
	appendPayout(record.exacta, "2連単");
	appendPayout(record.nirentan, "2連単");

	appendPayout(result.payout2fuku, "2連複");
	appendPayout(record.quinella, "2連複");

	appendPayout(result.payoutWide, "拡連複");
	appendPayout(record.wide, "拡連複");

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

	const resultRecord = result as BoatRaceResult & Record<string, unknown>;
	const finishOrderText = readFinishOrderText(resultRecord);

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
	const finishNumbers = finishOrderText
		.split("-")
		.map((value) => Number(value))
		.filter((value) => Number.isFinite(value));

	const top3 = finishNumbers.slice(0, 3).join("-");
	const top2 = finishNumbers.slice(0, 2).join("-");
	const unorderedTop3 = [...finishNumbers.slice(0, 3)].sort().join("-");
	const unorderedTop2 = [...finishNumbers.slice(0, 2)].sort().join("-");

	const finishOrderHitBets = bets.filter((bet) => {
		if (bet.type === "trifecta") {
			return bet.normalized === top3;
		}

		if (bet.type === "exacta") {
			return bet.normalized === top2;
		}

		if (bet.type === "trio") {
			return [...bet.numbers].sort().join("-") === unorderedTop3;
		}

		if (bet.type === "quinella") {
			return [...bet.numbers].sort().join("-") === unorderedTop2;
		}

		if (bet.type === "wide") {
			return bet.numbers.every((number) => finishNumbers.slice(0, 3).includes(number));
		}

		return false;
	});

	const payoutMatchedHitBets = finishOrderHitBets.filter((bet) => Boolean(findPayoutForBet(bet, payouts)));
	const hitBets = payoutMatchedHitBets.length > 0 ? payoutMatchedHitBets : finishOrderHitBets;
	const payoutYen = hitBets.reduce((sum, bet) => sum + readPayoutYen(findPayoutForBet(bet, payouts)?.payout), 0);
	const profitYen = payoutYen - investmentAmount;
	const roi = investmentAmount > 0 ? (payoutYen / investmentAmount) * 100 : 0;

	const startInfoRows = result.startInfo ?? result.startInfos ?? [];
	const startInfoText = Array.isArray(startInfoRows)
		? startInfoRows
				.map((row) =>
					`${row.course ?? row.entryCourse ?? "-"}:${row.frameNo ?? row.frame ?? row.boatNumber ?? "-"} ST${row.stDisplay ?? row.startTiming ?? row.st ?? "-"}`,
				)
				.join(" / ")
		: "";

	const lookupStatus: BoatResultLookupStatus =
		hitBets.length > 0 && payoutYen <= 0
			? "payout-missing"
			: payouts.length > 0
				? "matched"
				: "payout-missing";

	const message =
		hitBets.length > 0
			? payoutYen > 0
				? "的中 / 払戻取得済み"
				: "的中候補 / 払戻未取得"
			: "不的中";

	return {
		status: "confirmed",
		lookupStatus,
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
		message,
	};
}
