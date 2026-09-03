import {
	BOAT_MONTHLY_REVIEW_DATA_PATH,
	getBoatMonthlyAvailableMonths,
	getBoatMonthlyPartialMonths,
	getBoatMonthlyQualityCount,
} from "./boatMonthlyReview";
import type {
	BoatMonthlyOverview,
	BoatMonthlyReviewData,
	BoatMonthlyVenuePerformance,
} from "../types/boatMonthlyReview";
import type { BoatPredictionMonthlyReviewSnapshot } from "./boatraceTypes";

export type BoatPredictionMonthlyLoadState = "loading" | "ready" | "unavailable";

export type BoatPredictionMonthlyReference = {
	predictionMonth: string;
	referenceMonth: string | null;
	referenceOverview: BoatMonthlyOverview | null;
	latestAvailableMonth: string | null;
	latestAvailableStatus: "COMPLETE" | "PARTIAL" | null;
	partialMonths: string[];
};

export type BoatPredictionMonthlyFocus =
	| "10点構成監査を優先"
	| "展開読み監査を優先"
	| "構成・展開の両方を監査"
	| "外れ分類率未取得";

const isMonth = (value: string): boolean => /^\d{4}-\d{2}$/u.test(value);
const isPredictionDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/u.test(value);

const formatCount = (value: number | null | undefined): string =>
	Number.isFinite(value) ? Number(value).toLocaleString("ja-JP") : "未取得";

const formatPercent = (value: number | null | undefined): string =>
	Number.isFinite(value) ? `${Number(value).toFixed(2)}%` : "未取得";

const formatYen = (value: number | null | undefined): string =>
	Number.isFinite(value) ? `${Number(value).toLocaleString("ja-JP")}円` : "未取得";

export function resolveBoatPredictionMonthlyReferenceMonth(params: {
	predictionDate: string;
	monthlyData: BoatMonthlyReviewData;
}): BoatPredictionMonthlyReference {
	const { predictionDate, monthlyData } = params;
	if (!isPredictionDate(predictionDate)) {
		throw new Error("predictionDate must be YYYY-MM-DD.");
	}

	const predictionMonth = predictionDate.slice(0, 7);
	const availableMonths = getBoatMonthlyAvailableMonths(monthlyData).filter(isMonth);
	const partialMonths = getBoatMonthlyPartialMonths(monthlyData);
	const partialSet = new Set(partialMonths);
	const referenceCandidates = availableMonths
		.filter((month) => month < predictionMonth && !partialSet.has(month));
	const referenceMonth = referenceCandidates[referenceCandidates.length - 1] ?? null;
	const visibleAvailableMonths = availableMonths.filter((month) =>
		month < predictionMonth || (month === predictionMonth && partialSet.has(month)));
	const latestAvailableMonth = visibleAvailableMonths[visibleAvailableMonths.length - 1] ?? null;

	return {
		predictionMonth,
		referenceMonth,
		referenceOverview: referenceMonth
			? monthlyData.monthlyOverview.find((item) => item.month === referenceMonth) ?? null
			: null,
		latestAvailableMonth,
		latestAvailableStatus: latestAvailableMonth
			? partialSet.has(latestAvailableMonth) ? "PARTIAL" : "COMPLETE"
			: null,
		partialMonths,
	};
}

export function resolveBoatPredictionMonthlyFocus(
	structureMissRate: number | null | undefined,
	readMissRate: number | null | undefined,
): BoatPredictionMonthlyFocus {
	if (!Number.isFinite(structureMissRate) || !Number.isFinite(readMissRate)) {
		return "外れ分類率未取得";
	}
	if (Number(structureMissRate) > Number(readMissRate)) {
		return "10点構成監査を優先";
	}
	if (Number(readMissRate) > Number(structureMissRate)) {
		return "展開読み監査を優先";
	}
	return "構成・展開の両方を監査";
}

export function findBoatPredictionMonthlyVenue(params: {
	monthlyData: BoatMonthlyReviewData;
	referenceMonth: string;
	venueName: string;
}): BoatMonthlyVenuePerformance | null {
	return params.monthlyData.venueMonthly.find((item) =>
		item.month === params.referenceMonth && item.venue === params.venueName) ?? null;
}

const resolveSnapshotFocus = (focusLabel: BoatPredictionMonthlyFocus): BoatPredictionMonthlyReviewSnapshot["focus"] => {
	if (focusLabel === "10点構成監査を優先") return "structure";
	if (focusLabel === "展開読み監査を優先") return "read";
	if (focusLabel === "構成・展開の両方を監査") return "balanced";
	return null;
};

export function normalizeBoatPredictionMonthlyReviewSnapshot(
	value: BoatPredictionMonthlyReviewSnapshot | undefined,
): BoatPredictionMonthlyReviewSnapshot | undefined {
	if (!value || (value.referenceStatus !== "COMPLETE" && value.referenceStatus !== "UNAVAILABLE")) return undefined;
	return {
		...value,
		referenceMonth: value.referenceMonth && isMonth(value.referenceMonth) ? value.referenceMonth : null,
	};
}

export function preserveBoatPredictionMonthlyReviewSnapshot(
	existing: BoatPredictionMonthlyReviewSnapshot | undefined,
	current: BoatPredictionMonthlyReviewSnapshot,
): BoatPredictionMonthlyReviewSnapshot {
	return normalizeBoatPredictionMonthlyReviewSnapshot(existing) ?? current;
}

export function buildBoatPredictionMonthlyReviewSnapshot(params: {
	monthlyData: BoatMonthlyReviewData | null;
	loadState: BoatPredictionMonthlyLoadState;
	predictionDate: string;
	venueName: string;
}): BoatPredictionMonthlyReviewSnapshot {
	const { monthlyData, loadState, predictionDate, venueName } = params;
	if (!monthlyData || loadState !== "ready") {
		return { referenceMonth: null, referenceStatus: "UNAVAILABLE" };
	}

	let reference: BoatPredictionMonthlyReference;
	try {
		reference = resolveBoatPredictionMonthlyReferenceMonth({ predictionDate, monthlyData });
	} catch {
		return {
			referenceMonth: null,
			referenceStatus: "UNAVAILABLE",
			generatedAt: monthlyData.generated_at ?? null,
			periodStart: monthlyData.period?.start ?? null,
			periodEnd: monthlyData.period?.end ?? null,
		};
	}

	const overview = reference.referenceOverview;
	if (!reference.referenceMonth || !overview) {
		return {
			referenceMonth: null,
			referenceStatus: "UNAVAILABLE",
			latestAvailableMonth: reference.latestAvailableMonth,
			latestAvailableStatus: reference.latestAvailableStatus,
			generatedAt: monthlyData.generated_at ?? null,
			periodStart: monthlyData.period?.start ?? null,
			periodEnd: monthlyData.period?.end ?? null,
			classificationMethod: monthlyData.method?.classification ?? null,
			autoProxyIncluded: (getBoatMonthlyQualityCount(monthlyData, "classification_auto_proxy") ?? 0) > 0,
		};
	}

	const venue = findBoatPredictionMonthlyVenue({
		monthlyData,
		referenceMonth: reference.referenceMonth,
		venueName,
	});
	const focusLabel = resolveBoatPredictionMonthlyFocus(overview.structure_miss_rate_pct, overview.read_miss_rate_pct);

	return {
		referenceMonth: reference.referenceMonth,
		referenceStatus: "COMPLETE",
		latestAvailableMonth: reference.latestAvailableMonth,
		latestAvailableStatus: reference.latestAvailableStatus,
		generatedAt: monthlyData.generated_at ?? null,
		periodStart: monthlyData.period?.start ?? null,
		periodEnd: monthlyData.period?.end ?? null,
		focus: resolveSnapshotFocus(focusLabel),
		focusLabel,
		monthlyRaces: overview.races ?? null,
		monthlyHitRatePct: overview.hit_rate_pct ?? null,
		monthlyRoiPct: overview.roi_pct ?? null,
		monthlyStructureMissRatePct: overview.structure_miss_rate_pct ?? null,
		monthlyReadMissRatePct: overview.read_miss_rate_pct ?? null,
		monthlyDataHold: overview.DATA_HOLD ?? null,
		monthlyOneBoatWinRatePct: overview.actual_1boat_win_rate_pct ?? null,
		venue: venue ? venueName : null,
		venueSampleRaces: venue?.races ?? null,
		venueHitRatePct: venue?.hit_rate_pct ?? null,
		venueRoiPct: venue?.roi_pct ?? null,
		venueStructureMiss: venue?.STRUCTURE_MISS ?? null,
		venueReadMiss: venue?.READ_MISS ?? null,
		venueDataHold: venue?.DATA_HOLD ?? null,
		venueOneBoatWinRatePct: venue?.actual_1boat_win_rate_pct ?? null,
		classificationMethod: monthlyData.method?.classification ?? null,
		autoProxyIncluded: (getBoatMonthlyQualityCount(monthlyData, "classification_auto_proxy") ?? 0) > 0,
	};
}

const readWindSpeed = (value: unknown): number | null => {
	if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
	if (typeof value !== "string") return null;
	const match = /(?:^|\s)(\d+(?:\.\d+)?)\s*m?(?:\/s)?(?:\s|$)/iu.exec(value.trim());
	return match ? Number(match[1]) : null;
};

const matchesWindBand = (label: string, windSpeed: number): boolean => {
	const range = /(\d+(?:\.\d+)?)\s*[〜~～-]\s*(\d+(?:\.\d+)?)\s*m/iu.exec(label);
	if (range) return windSpeed >= Number(range[1]) && windSpeed <= Number(range[2]);
	const minimum = /(\d+(?:\.\d+)?)\s*m\s*以上/iu.exec(label);
	if (minimum) return windSpeed >= Number(minimum[1]);
	const maximum = /(\d+(?:\.\d+)?)\s*m\s*以下/iu.exec(label);
	return maximum ? windSpeed <= Number(maximum[1]) : false;
};

const resolvePredictionModeLabel = (mode: string | null | undefined): string | null => {
	if (mode === "pre-race") return "事前予想";
	if (mode === "exhibition-partial" || mode === "exhibition-complete") return "展示反映/不明";
	return null;
};

const buildUnavailableBlock = (loadState: BoatPredictionMonthlyLoadState): string => [
	"【月次振り返り反映】",
	`月次振り返り: ${loadState === "loading" ? "読込中（通常素材は利用可能）" : "未取得"}`,
	`data: ${BOAT_MONTHLY_REVIEW_DATA_PATH}`,
	"Monthlyが未取得でも、今回レースのofficial source・通常素材・EX素材を優先して予想してください。",
].join("\n");

export function buildBoatPredictionMonthlyReviewContext(params: {
	monthlyData: BoatMonthlyReviewData | null;
	loadState: BoatPredictionMonthlyLoadState;
	predictionDate: string;
	venueName: string;
	windSpeed?: unknown;
	predictionMode?: "pre-race" | "exhibition-partial" | "exhibition-complete" | null;
}): string {
	const { monthlyData, loadState, predictionDate, venueName } = params;
	if (!monthlyData || loadState !== "ready") return buildUnavailableBlock(loadState);
	const snapshot = buildBoatPredictionMonthlyReviewSnapshot({ monthlyData, loadState, predictionDate, venueName });
	const overview = snapshot.referenceMonth
		? monthlyData.monthlyOverview.find((item) => item.month === snapshot.referenceMonth) ?? null
		: null;
	if (!snapshot.referenceMonth || !overview) {
		return [
			"【月次振り返り反映】",
			"月次振り返り: 利用可能な直前完了月なし",
			`prediction date: ${predictionDate}`,
			`latest available: ${snapshot.latestAvailableMonth ?? "未取得"}${snapshot.latestAvailableStatus ? ` ${snapshot.latestAvailableStatus}` : ""}`,
			"未来月・予想対象月・PARTIAL月は参照しません。",
		].join("\n");
	}

	const oneBoatRows = monthlyData.oneBoatAnalysis.filter((item) => item.month === snapshot.referenceMonth);
	const windSpeed = readWindSpeed(params.windSpeed);
	const windBand = windSpeed === null
		? null
		: monthlyData.windBands.find((item) => item.month === snapshot.referenceMonth && matchesWindBand(item.wind_band, windSpeed)) ?? null;
	const predictionModeLabel = resolvePredictionModeLabel(params.predictionMode);
	const predictionMode = predictionModeLabel
		? monthlyData.predictionModes.find((item) => item.month === snapshot.referenceMonth && item.prediction_mode === predictionModeLabel) ?? null
		: null;
	const displayAudit = monthlyData.displayAudit.find((item) => item.month === snapshot.referenceMonth) ?? null;
	const focus = snapshot.focusLabel ?? "外れ分類率未取得";
	const summaryClassified = getBoatMonthlyQualityCount(monthlyData, "summary_classified_races");
	const autoProxy = getBoatMonthlyQualityCount(monthlyData, "classification_auto_proxy");
	const classificationCollision = getBoatMonthlyQualityCount(monthlyData, "summary_class_collision");

	return [
		`【月次振り返り反映 / ${snapshot.referenceMonth}】`,
		"source: KURARI BOAT Monthly Review",
		`data: ${BOAT_MONTHLY_REVIEW_DATA_PATH}`,
		`generated_at: ${monthlyData.generated_at}`,
		"reference status: COMPLETE",
		`対象: ${snapshot.referenceMonth}`,
		`latest available: ${snapshot.latestAvailableMonth ?? "未取得"}${snapshot.latestAvailableStatus ? ` ${snapshot.latestAvailableStatus}` : ""}`,
		"PARTIAL月は主referenceに使用しません。未来月・予想対象月の集計も使用しません。",
		"",
		"【月全体】",
		`対象R: ${formatCount(overview.races)}`,
		`正式的中: ${formatCount(overview.hits)}`,
		`3連単的中率: ${formatPercent(overview.hit_rate_pct)}`,
		`投資: ${formatYen(overview.investment_yen)}`,
		`払戻: ${formatYen(overview.return_yen)}`,
		`ROI: ${formatPercent(overview.roi_pct)}`,
		`STRUCTURE_MISS: ${formatCount(overview.STRUCTURE_MISS)} / ${formatPercent(overview.structure_miss_rate_pct)}`,
		`READ_MISS: ${formatCount(overview.READ_MISS)} / ${formatPercent(overview.read_miss_rate_pct)}`,
		`DATA_HOLD: ${formatCount(overview.DATA_HOLD)}`,
		`1号艇1着率: ${formatPercent(overview.actual_1boat_win_rate_pct)}`,
		`monthly_focus: ${focus}（過去月の外れ分類比率に基づく確認優先度）`,
		"",
		"【今回会場】",
		`会場: ${venueName || "未取得"}`,
		...(snapshot.venue ? [
			`sample: R=${formatCount(snapshot.venueSampleRaces)}`,
			`的中率: ${formatPercent(snapshot.venueHitRatePct)}`,
			`ROI: ${formatPercent(snapshot.venueRoiPct)}`,
			`STRUCTURE_MISS: ${formatCount(snapshot.venueStructureMiss)}`,
			`READ_MISS: ${formatCount(snapshot.venueReadMiss)}`,
			`DATA_HOLD: ${formatCount(snapshot.venueDataHold)}`,
			`1号艇1着率: ${formatPercent(snapshot.venueOneBoatWinRatePct)}`,
		] : ["会場別月次: 未取得（別会場のデータは代用しません）"]),
		"",
		"【1号艇・風・予想時点の月次参考】",
		`月全体1号艇1着率: ${formatPercent(overview.actual_1boat_win_rate_pct)}（過去実績。1頭固定の自動結論には使わない）`,
		...oneBoatRows.map((item) => `${item.result_type}: R=${formatCount(item.races)} / 的中率 ${formatPercent(item.hit_rate_pct)} / ROI ${formatPercent(item.roi_pct)}`),
		windSpeed === null
			? "当日風速対応band: 未取得（official current sourceに風速がないため照合しない）"
			: windBand
				? `当日風速 ${windSpeed}m → Monthly ${windBand.wind_band}: R=${formatCount(windBand.races)} / 的中率 ${formatPercent(windBand.hit_rate_pct)} / ROI ${formatPercent(windBand.roi_pct)} / 1号艇1着率 ${formatPercent(windBand.actual_1boat_win_rate_pct)}`
				: `当日風速 ${windSpeed}m: 対応するMonthly風速帯なし`,
		predictionMode
			? `現在mode ${params.predictionMode} → Monthly ${predictionMode.prediction_mode}: R=${formatCount(predictionMode.races)} / 的中率 ${formatPercent(predictionMode.hit_rate_pct)} / ROI ${formatPercent(predictionMode.roi_pct)}（因果関係として扱わない）`
			: "予想時点別月次: 安全に対応できる分類なし / 未取得",
		"",
		"【展示ST / 進入監査】",
		...(displayAudit ? [
			`比較coverage: ${formatCount(displayAudit.st_comparable_races)}R / ${formatPercent(displayAudit.coverage_pct)}`,
			`平均|展示ST-本番ST|: ${displayAudit.avg_abs_st_delta ?? "未取得"}`,
			`ST差大R: ${formatCount(displayAudit.races_with_large_st_delta_boat)}`,
			`展示F / 本番F: ${formatCount(displayAudit.display_f_total)} / ${formatCount(displayAudit.actual_f_total)}`,
			`展示進入変化R / 本番進入変化R: ${formatCount(displayAudit.display_entry_change_races)} / ${formatCount(displayAudit.actual_entry_change_races)}`,
			"展示単発STを過信せず、艇番と実進入を混同しない。",
		] : ["展示ST / 進入監査: 未取得"]),
		"",
		"【DATA QUALITY / classification source】",
		`classification method: ${monthlyData.method.classification ?? "未取得"}`,
		`summary_v2相当: ${formatCount(summaryClassified)}`,
		`auto_proxy: ${formatCount(autoProxy)}（AUTO / 参考分類。人手監査済み扱い禁止）`,
		`classification conflict: ${formatCount(classificationCollision)}`,
		"",
		"【次月KPI】",
		...monthlyData.nextKpi.map((item) => `- ${item.KPI}: baseline ${item.baseline || "未取得"} / target ${item.next_target || "未取得"} / ${item.meaning || "未取得"}`),
		"KPIは月次改善目標であり、1レース単位の強制買い目ルールではありません。",
		"",
		"【POST-RESULT AUDIT】",
		"配当帯と実勝ち艇motor帯は確定結果の事後分類です。未来配当の推測やmotor購入ルールへ自動変換しません。",
		"",
		"【情報優先順位】",
		"1. 今回レースのofficial source",
		"2. 当日展示 / ST / 進入 / 天候・水面",
		"3. 当日EX evidence",
		"4. 選手・モーター等のcurrent source",
		"5. 会場特徴",
		"6. Monthly retrospective",
		"Monthlyは過去結果の振り返り補助です。当日sourceと矛盾する場合は当日sourceを優先し、Monthlyだけで艇番・買い目・展開を決めないでください。",
	].join("\n");
}
