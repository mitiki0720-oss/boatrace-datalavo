import { isBoatPracticeHit, type BoatPracticeResultRecord } from "./boatPracticeResultStorage";
import type { BoatPredictionMonthlyReviewSnapshot, BoatPredictionRecord } from "./boatraceTypes";

export type BoatPredictionMonthlyObservedOutcome =
	| "TICKET_HIT"
	| "STRUCTURE_MISS"
	| "READ_MISS"
	| "DATA_HOLD"
	| "UNCLASSIFIED";

export type BoatPredictionMonthlyFeedback = {
	raceKey: string;
	snapshotStatus: "available" | "unavailable" | "legacy";
	settlementOutcome: "hit" | "miss" | "pending";
	observedOutcome: BoatPredictionMonthlyObservedOutcome;
	classificationSource: string | null;
	monthlyReviewContext?: BoatPredictionMonthlyReviewSnapshot;
};

export type BoatPredictionMonthlyFeedbackSummary = {
	trackedCount: number;
	legacyCount: number;
	unavailableCount: number;
	settledCount: number;
	outcomes: Record<BoatPredictionMonthlyObservedOutcome, number>;
	byFocus: Record<"structure" | "read" | "balanced", {
		count: number;
		outcomes: Record<BoatPredictionMonthlyObservedOutcome, number>;
	}>;
};

const OUTCOMES = ["TICKET_HIT", "STRUCTURE_MISS", "READ_MISS", "DATA_HOLD", "UNCLASSIFIED"] as const;

const emptyOutcomeCounts = (): Record<BoatPredictionMonthlyObservedOutcome, number> => ({
	TICKET_HIT: 0,
	STRUCTURE_MISS: 0,
	READ_MISS: 0,
	DATA_HOLD: 0,
	UNCLASSIFIED: 0,
});

const readText = (value: unknown): string => typeof value === "string" ? value.trim() : "";

const readSourceBackedClassification = (
	practiceResult: BoatPracticeResultRecord | undefined,
): { outcome: BoatPredictionMonthlyObservedOutcome; source: string } | null => {
	if (!practiceResult) return null;
	const record = practiceResult as BoatPracticeResultRecord & Record<string, unknown>;
	const outcomeText = readText(record.monthlyFocusObservedOutcome ?? record.reviewClassification ?? record.resultClassification ?? record.classification).toUpperCase();
	const source = readText(record.monthlyFocusOutcomeSource ?? record.reviewClassificationSource ?? record.resultClassificationSource ?? record.classificationSource);
	if (!source || /auto|proxy|guess|infer|推測|補完/iu.test(source)) return null;
	if (!OUTCOMES.includes(outcomeText as BoatPredictionMonthlyObservedOutcome) || outcomeText === "UNCLASSIFIED") return null;
	return { outcome: outcomeText as BoatPredictionMonthlyObservedOutcome, source };
};

const hasConfirmedResult = (practiceResult: BoatPracticeResultRecord | undefined): boolean => Boolean(
	practiceResult
	&& practiceResult.resultStatus === "confirmed"
	&& (practiceResult.actualFinishOrderText || practiceResult.finishOrder || practiceResult.actualOrder),
);

export function buildBoatPredictionMonthlyFeedback(params: {
	prediction: BoatPredictionRecord;
	practiceResult?: BoatPracticeResultRecord;
}): BoatPredictionMonthlyFeedback {
	const { prediction, practiceResult } = params;
	const monthlyReviewContext = prediction.monthlyReviewContext;
	const snapshotStatus = !monthlyReviewContext
		? "legacy"
		: monthlyReviewContext.referenceStatus === "COMPLETE" && monthlyReviewContext.referenceMonth
			? "available"
			: "unavailable";
	const explicitClassification = readSourceBackedClassification(practiceResult);
	const settled = hasConfirmedResult(practiceResult);
	const hit = settled && isBoatPracticeHit(practiceResult);
	const settlementOutcome = !settled ? "pending" : hit ? "hit" : "miss";
	const observedOutcome = explicitClassification?.outcome
		?? (hit ? "TICKET_HIT" : "UNCLASSIFIED");

	return {
		raceKey: prediction.raceKey,
		snapshotStatus,
		settlementOutcome,
		observedOutcome,
		classificationSource: explicitClassification?.source ?? (hit ? "settlement-hit" : null),
		monthlyReviewContext,
	};
}

export function summarizeBoatPredictionMonthlyFeedback(
	feedback: BoatPredictionMonthlyFeedback[],
): BoatPredictionMonthlyFeedbackSummary {
	const summary: BoatPredictionMonthlyFeedbackSummary = {
		trackedCount: 0,
		legacyCount: 0,
		unavailableCount: 0,
		settledCount: 0,
		outcomes: emptyOutcomeCounts(),
		byFocus: {
			structure: { count: 0, outcomes: emptyOutcomeCounts() },
			read: { count: 0, outcomes: emptyOutcomeCounts() },
			balanced: { count: 0, outcomes: emptyOutcomeCounts() },
		},
	};

	for (const item of feedback) {
		if (item.snapshotStatus === "legacy") {
			summary.legacyCount += 1;
			continue;
		}
		if (item.snapshotStatus === "unavailable") {
			summary.unavailableCount += 1;
			continue;
		}
		summary.trackedCount += 1;
		if (item.settlementOutcome !== "pending") {
			summary.settledCount += 1;
			summary.outcomes[item.observedOutcome] += 1;
		}
		const focus = item.monthlyReviewContext?.focus;
		if (focus) {
			summary.byFocus[focus].count += 1;
			if (item.settlementOutcome !== "pending") summary.byFocus[focus].outcomes[item.observedOutcome] += 1;
		}
	}

	return summary;
}
