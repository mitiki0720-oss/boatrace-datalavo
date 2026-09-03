import { resolveBoatPredictionOutcome, type BoatPredictionOutcomeStatus } from "./boatResultSettlement";
import type { BoatReviewRaceEntry, BoatReviewVenueGroup } from "./boatReviewSummaryBuilder";

export type BoatReviewRaceStatus = BoatPredictionOutcomeStatus | "unpredicted";

export type BoatReviewRacePerformance = {
	raceNo: number;
	status: BoatReviewRaceStatus;
	hasPrediction: boolean;
	hasOfficialResult: boolean;
	settledPrediction: boolean;
	investment: number | null;
	payout: number | null;
	profit: number | null;
	finishOrder: string | null;
	kimarite: string | null;
};

export type BoatReviewPerformance = {
	targetRaceNos: number[];
	predictionRaceNos: number[];
	resultRaceNos: number[];
	missingPredictionRaceNos: number[];
	missingResultRaceNos: number[];
	targetRaceCount: number;
	predictionRaceCount: number;
	officialResultCount: number;
	settledPredictionRaceCount: number;
	evaluatedRaceCount: number;
	pendingRaceCount: number;
	parseWarningCount: number;
	refundCount: number;
	cancelledCount: number;
	hitCount: number;
	financialRaceCount: number;
	investment: number;
	payout: number;
	profit: number;
	hitRate: number | null;
	roi: number | null;
	races: BoatReviewRacePerformance[];
};

type ArchiveSection = {
	raceNo: number;
	text: string;
};

const readFiniteNumber = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").trim();
	if (!normalized || /未保存|未取得|結果待ち|^--$|^—$/.test(normalized)) return null;
	const parsed = Number(normalized.replace(/[^\d.-]/g, ""));
	return Number.isFinite(parsed) ? parsed : null;
};

const parseRaceSections = (text: string | null | undefined): ArchiveSection[] => {
	if (!text?.trim()) return [];
	const matches = Array.from(text.matchAll(/^■\s+.+?\s+([1-9]|1[0-2])R\s*$/gm));
	return matches.map((match, index) => ({
		raceNo: Number(match[1]),
		text: text.slice(match.index ?? 0, matches[index + 1]?.index ?? text.length),
	}));
};

const readLine = (section: string, label: string): string | null => {
	const match = section.match(new RegExp(`^${label}:\\s*(.+?)\\s*$`, "m"));
	return match?.[1]?.trim() || null;
};

const normalizeArchiveStatus = (section: string, hasPrediction: boolean): BoatReviewRaceStatus => {
	const value = readLine(section, "最終判定")?.toLowerCase() ?? "";
	if (/cancel|中止|不成立/.test(value)) return "cancelled";
	if (/refund|返還/.test(value)) return "refund";
	if (!hasPrediction) return "unpredicted";
	if (/parse-warning|parse warning|解析警告/.test(value)) return "parse-warning";
	if (/^miss$|不的中/.test(value)) return "miss";
	if (/^hit$|的中/.test(value)) return "hit";
	return "pending";
};

const getLiveInvestment = (entry: BoatReviewRaceEntry): number =>
	readFiniteNumber(entry.prediction?.totalStakeYen ?? entry.prediction?.betSummary?.totalStakeYen) ?? 0;

const getLiveFinishOrder = (entry: BoatReviewRaceEntry): string | null => {
	const result = entry.race?.result;
	if (Array.isArray(result?.finishOrder)) return result.finishOrder.slice(0, 3).join("-") || null;
	const finishers = Array.isArray(result?.finishers) ? result.finishers : [];
	const ordered = finishers
		.slice()
		.sort((left, right) => Number(left.rank ?? 99) - Number(right.rank ?? 99))
		.map((item) => item.frameNo ?? item.frame ?? item.boatNumber ?? item.lane)
		.filter((value) => value !== undefined && value !== null)
		.slice(0, 3)
		.join("-");
	return ordered || null;
};

const getLiveRacePerformance = (entry: BoatReviewRaceEntry): BoatReviewRacePerformance => {
	const prediction = entry.prediction;
	const race = entry.race;
	const hasPrediction = Boolean(prediction?.predictionText?.trim());
	const hasOfficialResult = race?.result?.status === "confirmed" || race?.result?.status === "unavailable";
	const finishOrder = getLiveFinishOrder(entry);
	const kimarite = race?.result?.kimarite ?? race?.result?.winningMethod ?? race?.result?.winningMove ?? null;

	if (!prediction || !hasPrediction) {
		return {
			raceNo: entry.raceNo,
			status: hasOfficialResult ? "unpredicted" : "pending",
			hasPrediction: false,
			hasOfficialResult,
			settledPrediction: false,
			investment: null,
			payout: null,
			profit: null,
			finishOrder,
			kimarite,
		};
	}

	const investment = getLiveInvestment(entry);
	const outcome = resolveBoatPredictionOutcome({
		race,
		bets: prediction.parsedBets ?? [],
		investmentAmount: investment,
		parseStatus: prediction.parseStatus,
		parseWarnings: prediction.parseWarnings,
		source: "boat-review",
	});
	const financial = outcome.status === "hit" || outcome.status === "miss";
	const settledPrediction = ["hit", "miss", "refund", "cancelled"].includes(outcome.status);

	return {
		raceNo: entry.raceNo,
		status: outcome.status,
		hasPrediction,
		hasOfficialResult,
		settledPrediction,
		investment: financial ? investment : null,
		payout: financial ? outcome.settlement.payoutYen : null,
		profit: financial ? outcome.settlement.profitYen : null,
		finishOrder: outcome.settlement.finishOrderText || finishOrder,
		kimarite: outcome.settlement.kimarite ?? kimarite,
	};
};

const getArchiveRacePerformance = (
	raceNo: number,
	predictionSection: string | undefined,
	resultSection: string | undefined,
): BoatReviewRacePerformance => {
	const hasPrediction = Boolean(predictionSection && !/(?:^|\n)\s*予想未保存\s*(?:\n|$)/.test(predictionSection));
	const hasOfficialResult = Boolean(resultSection && (
		/^結果確定:\s*confirmed\s*$/m.test(resultSection) ||
		/^着順:\s*[1-6](?:\s*[-=]\s*[1-6]){1,}/m.test(resultSection) ||
		/^最終判定:\s*(?:cancelled|refund|中止|返還)/im.test(resultSection)
	));
	const status = resultSection ? normalizeArchiveStatus(resultSection, hasPrediction) : hasPrediction ? "pending" : "unpredicted";
	const financial = status === "hit" || status === "miss";
	const investment = financial ? readFiniteNumber(readLine(resultSection ?? "", "投資")) : null;
	const payout = financial ? readFiniteNumber(readLine(resultSection ?? "", "払戻")) : null;
	const profit = financial ? readFiniteNumber(readLine(resultSection ?? "", "収支")) : null;

	return {
		raceNo,
		status,
		hasPrediction,
		hasOfficialResult,
		settledPrediction: hasPrediction && ["hit", "miss", "refund", "cancelled"].includes(status),
		investment,
		payout,
		profit,
		finishOrder: readLine(resultSection ?? "", "着順"),
		kimarite: readLine(resultSection ?? "", "決まり手"),
	};
};

const uniqueSortedRaceNos = (values: Iterable<number>): number[] =>
	Array.from(new Set(Array.from(values).filter((value) => Number.isInteger(value) && value >= 1 && value <= 12)))
		.sort((left, right) => left - right);

export function buildBoatReviewVenuePerformance(group: BoatReviewVenueGroup): BoatReviewPerformance {
	const predictionSections = parseRaceSections(group.predictionFileText);
	const resultSections = parseRaceSections(group.resultFileText);
	const predictionSectionMap = new Map(predictionSections.map((section) => [section.raceNo, section.text]));
	const resultSectionMap = new Map(resultSections.map((section) => [section.raceNo, section.text]));
	const liveEntries = group.races.filter((entry) => entry.race || entry.prediction);
	const targetRaceNos = uniqueSortedRaceNos([
		...(group.venue?.races ?? []).map((race) => race.raceNo),
		...liveEntries.map((entry) => entry.raceNo),
		...predictionSections.map((section) => section.raceNo),
		...resultSections.map((section) => section.raceNo),
	]);
	const liveEntryMap = new Map(liveEntries.map((entry) => [entry.raceNo, entry]));
	const races = targetRaceNos.map((raceNo) => {
		const liveEntry = liveEntryMap.get(raceNo);
		if (liveEntry && (liveEntry.race || liveEntry.prediction)) return getLiveRacePerformance(liveEntry);
		return getArchiveRacePerformance(raceNo, predictionSectionMap.get(raceNo), resultSectionMap.get(raceNo));
	});
	const predictionRaceNos = races.filter((race) => race.hasPrediction).map((race) => race.raceNo);
	const resultRaceNos = races.filter((race) => race.hasOfficialResult).map((race) => race.raceNo);
	const evaluated = races.filter((race) => race.hasPrediction && (race.status === "hit" || race.status === "miss"));
	const financial = evaluated.filter((race) => race.investment !== null && race.payout !== null && race.profit !== null);
	const investment = financial.reduce((sum, race) => sum + (race.investment ?? 0), 0);
	const payout = financial.reduce((sum, race) => sum + (race.payout ?? 0), 0);

	return {
		targetRaceNos,
		predictionRaceNos,
		resultRaceNos,
		missingPredictionRaceNos: targetRaceNos.filter((raceNo) => !predictionRaceNos.includes(raceNo)),
		missingResultRaceNos: targetRaceNos.filter((raceNo) => !resultRaceNos.includes(raceNo)),
		targetRaceCount: targetRaceNos.length,
		predictionRaceCount: predictionRaceNos.length,
		officialResultCount: resultRaceNos.length,
		settledPredictionRaceCount: races.filter((race) => race.settledPrediction).length,
		evaluatedRaceCount: evaluated.length,
		pendingRaceCount: races.filter((race) => race.hasPrediction && race.status === "pending").length,
		parseWarningCount: races.filter((race) => race.status === "parse-warning").length,
		refundCount: races.filter((race) => race.status === "refund").length,
		cancelledCount: races.filter((race) => race.status === "cancelled").length,
		hitCount: races.filter((race) => race.hasPrediction && race.status === "hit").length,
		financialRaceCount: financial.length,
		investment,
		payout,
		profit: payout - investment,
		hitRate: evaluated.length > 0 ? races.filter((race) => race.hasPrediction && race.status === "hit").length / evaluated.length * 100 : null,
		roi: financial.length > 0 && investment > 0 ? payout / investment * 100 : null,
		races,
	};
}

export function buildBoatReviewPagePerformance(groups: BoatReviewVenueGroup[]) {
	const uniqueGroups = Array.from(new Map(groups.map((group) => [group.key, group])).values());
	const venueMetrics = uniqueGroups.map(buildBoatReviewVenuePerformance);
	const financial = venueMetrics.filter((metrics) => metrics.financialRaceCount > 0);
	const investment = financial.reduce((sum, metrics) => sum + metrics.investment, 0);
	const payout = financial.reduce((sum, metrics) => sum + metrics.payout, 0);
	const evaluatedRaceCount = venueMetrics.reduce((sum, metrics) => sum + metrics.evaluatedRaceCount, 0);
	const hitCount = venueMetrics.reduce((sum, metrics) => sum + metrics.hitCount, 0);
	return {
		venueCount: uniqueGroups.length,
		targetRaceCount: venueMetrics.reduce((sum, metrics) => sum + metrics.targetRaceCount, 0),
		predictionRaceCount: venueMetrics.reduce((sum, metrics) => sum + metrics.predictionRaceCount, 0),
		officialResultCount: venueMetrics.reduce((sum, metrics) => sum + metrics.officialResultCount, 0),
		settledPredictionRaceCount: venueMetrics.reduce((sum, metrics) => sum + metrics.settledPredictionRaceCount, 0),
		evaluatedRaceCount,
		pendingRaceCount: venueMetrics.reduce((sum, metrics) => sum + metrics.pendingRaceCount, 0),
		parseWarningCount: venueMetrics.reduce((sum, metrics) => sum + metrics.parseWarningCount, 0),
		missingPredictionRaceCount: venueMetrics.reduce((sum, metrics) => sum + metrics.missingPredictionRaceNos.length, 0),
		missingResultRaceCount: venueMetrics.reduce((sum, metrics) => sum + metrics.missingResultRaceNos.length, 0),
		raceSetsMatch: venueMetrics.every((metrics) => metrics.missingPredictionRaceNos.length === 0 && metrics.missingResultRaceNos.length === 0),
		hitCount,
		investment,
		payout,
		profit: payout - investment,
		financialRaceCount: financial.reduce((sum, metrics) => sum + metrics.financialRaceCount, 0),
		hitRate: evaluatedRaceCount > 0 ? hitCount / evaluatedRaceCount * 100 : null,
		roi: financial.length > 0 && investment > 0 ? payout / investment * 100 : null,
		summaryCount: uniqueGroups.filter((group) => Boolean(group.summaryFileText?.trim())).length,
	};
}
