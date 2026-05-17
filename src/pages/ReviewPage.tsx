import type { ChangeEvent, CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { SectionCard } from "../components/common/SectionCard";
import { PageShell } from "../components/layout/PageShell";
import { judgeBoatPredictionHit } from "../lib/boatHitJudge";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { withBasePath } from "../lib/assetPath";
import type { BoatPredictionRecord, BoatRaceItem, BoatRaceResult, BoatRacerItem, BoatTodayFeed, BoatTodayVenueItem } from "../lib/boatraceTypes";
import { boatTheme } from "../lib/theme";
import { loadBoatPredictionRecords, BOAT_PREDICTION_STORAGE_KEY } from "../lib/boatPredictionStorage";
import { loadBoatPracticeResultRecords, BOAT_PRACTICE_RESULT_STORAGE_KEY, type BoatPracticeResultRecord } from "../lib/boatPracticeResultStorage";
import { loadBoatVenueExtrasFeed, findSelectedVenueExtra, findSelectedRaceExtra, type BoatVenueExtraRace, type BoatVenueExtraVenue, type BoatVenueExtrasFeed } from "../lib/boatVenueExtrasFeed";

type ReviewMode = "today" | "yesterday" | "archive";

type ReviewReportMap = Record<string, { body: string; savedAt: string }>;

type PastReviewFile = {
	date?: string;
	venueName?: string;
	title?: string;
	predictionFile?: string;
	resultFile?: string;
	summaryFile?: string;
};

type PastReviewIndex = {
	items?: PastReviewFile[];
	files?: PastReviewFile[];
	reviews?: PastReviewFile[];
};

type ReviewRaceEntry = {
	raceKey: string;
	venue: BoatTodayVenueItem | null;
	race: BoatRaceItem | null;
	prediction?: BoatPredictionRecord;
	practiceResult?: BoatPracticeResultRecord;
	venueExtra?: BoatVenueExtraVenue | null;
	raceExtra?: BoatVenueExtraRace | null;
};

type ReviewVenueGroup = {
	key: string;
	venueName: string;
	date: string;
	title: string;
	session: "morning" | "day" | "night" | "midnight" | "unknown";
	entries: ReviewRaceEntry[];
};

const REVIEW_REPORT_STORAGE_KEY = "kurari-boat-data-labo-review-reports";
const PAST_REVIEW_INDEX_URL = withBasePath("data/reviews/index.json");

const modeLabels: Record<ReviewMode, string> = {
	today: "今日",
	yesterday: "昨日",
	archive: "過去ファイル",
};

const shellStyle = {
	display: "grid",
	gap: "28px",
	width: "100%",
	padding: "18px 24px 96px",
	boxSizing: "border-box" as const,
};

const heroCalendarGridStyle = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.18fr) minmax(360px, 460px)",
	gap: "24px",
	alignItems: "stretch",
};

const heroStyle = {
	padding: "42px",
	borderRadius: "38px",
	background:
		"radial-gradient(circle at 10% 0%, rgba(197, 241, 255, 0.8), transparent 32%), radial-gradient(circle at 88% 8%, rgba(233, 226, 255, 0.72), transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.98), rgba(235,250,247,0.96) 52%, rgba(239,246,255,0.96))",
	border: "1px solid rgba(93, 199, 232, 0.28)",
	boxShadow: "0 28px 68px rgba(17, 64, 92, 0.1)",
	display: "grid",
	gap: "30px",
	alignContent: "space-between",
	overflow: "hidden",
};

const heroTopStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "18px",
	flexWrap: "wrap" as const,
};

const heroTitleWrapStyle = {
	display: "grid",
	gap: "12px",
	maxWidth: "980px",
};

const eyebrowStyle = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.76rem",
	fontWeight: 900,
	letterSpacing: "0.13em",
	textTransform: "uppercase" as const,
};

const heroTitleStyle = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "clamp(2.2rem, 3.2vw, 4rem)",
	lineHeight: 1.12,
	fontWeight: 950,
};

const heroTextStyle = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "1rem",
	lineHeight: 1.8,
};

const chipRowStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "9px",
	alignItems: "center",
};

const chipStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "8px 12px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.86)",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.78rem",
	fontWeight: 900,
	whiteSpace: "nowrap" as const,
};

const summaryGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(172px, 1fr))",
	gap: "14px",
};

const summaryCardStyle = {
	padding: "20px 21px",
	borderRadius: "24px",
	background: "rgba(255, 255, 255, 0.82)",
	border: "1px solid rgba(93, 199, 232, 0.2)",
	display: "grid",
	gap: "5px",
	boxShadow: "0 12px 26px rgba(17, 64, 92, 0.045)",
};

const summaryLabelStyle = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.73rem",
	fontWeight: 900,
	letterSpacing: "0.08em",
};

const summaryValueStyle = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "1.32rem",
	fontWeight: 950,
	lineHeight: 1.25,
};

const controlsGridStyle = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.2fr) minmax(360px, 0.8fr)",
	gap: "20px",
	alignItems: "start",
};

const panelStyle = {
	padding: "28px",
	borderRadius: "30px",
	background: "rgba(255, 255, 255, 0.94)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "16px",
};

const calendarPanelStyle = {
	...panelStyle,
	minHeight: "100%",
	alignContent: "start",
	background:
		"radial-gradient(circle at 100% 0%, rgba(233, 226, 255, 0.58), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,251,253,0.93))",
};

const panelTitleStyle = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "1rem",
	fontWeight: 950,
};

const modeButtonRowStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "9px",
};

const modeButtonBaseStyle = {
	padding: "10px 14px",
	borderRadius: "999px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.94)",
	color: boatTheme.colors.navy,
	fontWeight: 900,
	cursor: "pointer",
};

const fieldGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "14px",
};

const fieldStyle = {
	display: "grid",
	gap: "7px",
};

const labelStyle = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.78rem",
	fontWeight: 900,
};

const inputStyle = {
	width: "100%",
	boxSizing: "border-box" as const,
	padding: "14px 15px",
	borderRadius: "17px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(250, 254, 255, 0.96)",
	color: boatTheme.colors.navy,
	outline: "none",
};

const contentGridStyle = {
	display: "grid",
	gap: "22px",
	alignItems: "start",
};

const venueListStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
	gap: "16px",
};

const venueCardBaseStyle = {
	width: "100%",
	padding: "22px",
	borderRadius: "26px",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(244,252,255,0.9))",
	boxShadow: "0 10px 24px rgba(17, 64, 92, 0.05)",
	textAlign: "left" as const,
	cursor: "pointer",
	display: "grid",
	gap: "14px",
};

const venueCardTitleStyle = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "1.04rem",
	fontWeight: 950,
};

const metricGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: "10px",
};

const metricBoxStyle = {
	padding: "12px 13px",
	borderRadius: "16px",
	background: "rgba(238, 249, 252, 0.74)",
	border: "1px solid rgba(93, 199, 232, 0.16)",
	display: "grid",
	gap: "3px",
};

const metricLabelStyle = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "0.68rem",
	fontWeight: 800,
};

const metricValueStyle = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "0.88rem",
	fontWeight: 950,
};

const workbenchGridStyle = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.16fr) minmax(380px, 0.84fr)",
	gap: "22px",
	alignItems: "start",
};

const copyColumnStyle = {
	display: "grid",
	gap: "18px",
	minWidth: 0,
};

const textPanelStyle = {
	...panelStyle,
	minWidth: 0,
};

const textareaStyle = {
	...inputStyle,
	minHeight: "300px",
	resize: "vertical" as const,
	lineHeight: 1.65,
	fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
	fontSize: "0.82rem",
};

const reviewTextareaStyle = {
	...textareaStyle,
	minHeight: "420px",
	fontFamily: "inherit",
};

const buttonRowStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "9px",
	alignItems: "center",
};

const primaryButtonStyle = {
	padding: "10px 13px",
	borderRadius: "14px",
	border: "none",
	background: boatTheme.colors.navy,
	color: "#fff",
	fontWeight: 900,
	cursor: "pointer",
};

const secondaryButtonStyle = {
	padding: "10px 13px",
	borderRadius: "14px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.94)",
	color: boatTheme.colors.navy,
	fontWeight: 900,
	cursor: "pointer",
};

const emptyStateStyle = {
	margin: 0,
	padding: "30px",
	borderRadius: "28px",
	background: "linear-gradient(180deg, rgba(250,254,255,0.94), rgba(240,249,252,0.9))",
	border: "1px dashed rgba(93, 199, 232, 0.42)",
	color: boatTheme.colors.muted,
	lineHeight: 1.8,
};

const archiveListStyle = {
	display: "grid",
	gap: "12px",
};

const archiveCardStyle = {
	padding: "16px",
	borderRadius: "20px",
	background: "rgba(255, 255, 255, 0.94)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "10px",
};

const boatNumberColorMap: Record<number, { background: string; color: string; border: string }> = {
	1: { background: "#ffffff", color: "#111827", border: "#cfd8e3" },
	2: { background: "#111827", color: "#ffffff", border: "#111827" },
	3: { background: "#ef4444", color: "#ffffff", border: "#ef4444" },
	4: { background: "#2563eb", color: "#ffffff", border: "#2563eb" },
	5: { background: "#facc15", color: "#111827", border: "#eab308" },
	6: { background: "#22c55e", color: "#ffffff", border: "#22c55e" },
};

const getBoatChipStyle = (value: unknown): CSSProperties => {
	const boatNo = Number(value);
	const palette = boatNumberColorMap[boatNo] ?? { background: "#eef4f8", color: boatTheme.colors.navy, border: "#d6dee8" };

	return {
		display: "inline-flex",
		alignItems: "center",
		justifyContent: "center",
		width: "30px",
		height: "30px",
		borderRadius: "10px",
		background: palette.background,
		color: palette.color,
		border: `1px solid ${palette.border}`,
		fontWeight: 950,
	};
};

const formatDate = (date: Date): string => {
	const formatter = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	return formatter.format(date);
};

const getOperationalToday = (): string => {
	const now = new Date();
	const jstHour = Number(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false }).format(now));
	const base = new Date(now);

	if (jstHour < 6) {
		base.setDate(base.getDate() - 1);
	}

	return formatDate(base);
};

const shiftDate = (dateText: string, days: number): string => {
	const date = new Date(`${dateText}T00:00:00+09:00`);
	date.setDate(date.getDate() + days);
	return formatDate(date);
};

const formatYen = (value: number): string => `${value.toLocaleString("ja-JP")}円`;

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const readString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const readNumber = (value: unknown): number | null => {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : null;
};

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const getRaceKey = (params: { date: string; venueName: string; raceNo: number; raceId?: string }): string => {
	if (params.raceId) {
		return `boat-prediction:${params.raceId}`;
	}

	return `boat-prediction:${params.date}:${params.venueName}:${params.raceNo}`;
};

const getVenueTimeBand = (venue: Pick<BoatTodayVenueItem, "session" | "title"> & Record<string, unknown>): ReviewVenueGroup["session"] => {
	const normalizedSession = String(venue.session ?? "").trim().normalize("NFKC").toLowerCase();
	const normalizedTitle = [
		venue.title,
		venue.seriesName,
		venue.eventName,
		venue.raceTitle,
		venue.gradeName,
	]
		.map((value) => String(value ?? "").trim())
		.join(" ")
		.replace(/\s+/g, "")
		.normalize("NFKC")
		.toLowerCase();

	if (normalizedSession === "midnight" || normalizedTitle.includes("mnb") || normalizedTitle.includes("ミッドナイト")) {
		return "midnight";
	}

	if (normalizedSession === "morning" || normalizedTitle.includes("morning") || normalizedTitle.includes("モーニング")) {
		return "morning";
	}

	if (normalizedSession === "night" || normalizedTitle.includes("night") || normalizedTitle.includes("ナイター")) {
		return "night";
	}

	if (normalizedSession === "day" || normalizedTitle.includes("day") || normalizedTitle.includes("デイ")) {
		return "day";
	}

	return "unknown";
};

const getSessionOrder = (session: ReviewVenueGroup["session"]): number => {
	if (session === "morning") return 0;
	if (session === "day") return 1;
	if (session === "night") return 2;
	if (session === "midnight") return 3;
	return 9;
};

const getSessionLabel = (session: ReviewVenueGroup["session"]): string => {
	if (session === "morning") return "MORNING";
	if (session === "day") return "DAY";
	if (session === "night") return "NIGHT";
	if (session === "midnight") return "MIDNIGHT";
	return "unknown";
};

const loadReviewReports = (): ReviewReportMap => {
	if (typeof window === "undefined") {
		return {};
	}

	try {
		const raw = window.localStorage.getItem(REVIEW_REPORT_STORAGE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as ReviewReportMap : {};
	} catch {
		return {};
	}
};

const saveReviewReports = (reports: ReviewReportMap): void => {
	if (typeof window === "undefined") {
		return;
	}

	window.localStorage.setItem(REVIEW_REPORT_STORAGE_KEY, JSON.stringify(reports));
};

const getRecordDate = (entry: ReviewRaceEntry): string =>
	entry.prediction?.date || entry.practiceResult?.date || entry.venue?.date || "";

const getRaceTitle = (entry: ReviewRaceEntry): string =>
	entry.race?.title || entry.practiceResult?.raceTitle || `${entry.prediction?.raceNo ?? entry.practiceResult?.raceNo ?? "-"}R`;

const getRaceResult = (entry: ReviewRaceEntry): BoatRaceResult | undefined => entry.race?.result;

const getFinishOrder = (entry: ReviewRaceEntry): string => {
	const practiceOrder = entry.practiceResult?.actualFinishOrderText?.trim();
	if (practiceOrder) return practiceOrder;

	const finishOrder = getRaceResult(entry)?.finishOrder;
	if (Array.isArray(finishOrder) && finishOrder.length > 0) {
		return finishOrder.slice(0, 3).join("-");
	}

	const finishers = toArray<Record<string, unknown>>(getRaceResult(entry)?.finishers)
		.slice()
		.sort((left, right) => (readNumber(left.rank) ?? 99) - (readNumber(right.rank) ?? 99));

	return finishers
		.map((item) => readString(item.frameNo) || readString(item.frame) || readString(item.boatNumber))
		.filter(Boolean)
		.slice(0, 3)
		.join("-");
};

const getRacerName = (entry: ReviewRaceEntry, frameNo: string): string => {
	const racers = toArray<BoatRacerItem>(entry.race?.racers);
	const racer = racers.find((item) => String(item.frameNo) === frameNo || String(item.boatNo) === frameNo);
	return racer?.name || "-";
};

const getPayoutLine = (label: string, value: unknown): string => {
	if (!value || typeof value !== "object") {
		return `${label}: -`;
	}

	const record = value as Record<string, unknown>;
	return `${label}: ${readString(record.combination) || "-"} / ${readString(record.payout) || "-"} / 人気 ${readString(record.popularity) || "-"}`;
};

const getStartInfoText = (entry: ReviewRaceEntry): string => {
	const result = getRaceResult(entry);
	const startInfo = toArray<Record<string, unknown>>(result?.startInfo ?? result?.startInfos);

	if (startInfo.length > 0) {
		const sorted = startInfo.slice().sort((left, right) => (readNumber(left.course) ?? readNumber(left.entryCourse) ?? 99) - (readNumber(right.course) ?? readNumber(right.entryCourse) ?? 99));
		const courses = sorted.map((item) => readString(item.frameNo) || readString(item.frame) || readString(item.boatNumber)).filter(Boolean).join("-");
		const st = sorted.map((item) => `${readString(item.frameNo) || readString(item.frame) || readString(item.boatNumber) || "-"}:${readString(item.st) || readString(item.startTiming) || "-"}`).join(" / ");
		return [`進入: ${courses || "-"}`, `ST: ${st || "-"}`].join("\n");
	}

	const startExhibition = toArray<Record<string, unknown>>(entry.raceExtra?.startExhibition);
	if (startExhibition.length > 0) {
		const sorted = startExhibition.slice().sort((left, right) => (readNumber(left.course) ?? 99) - (readNumber(right.course) ?? 99));
		const courses = sorted.map((item) => readString(item.frameNo)).filter(Boolean).join("-");
		const st = sorted.map((item) => `${readString(item.frameNo) || "-"}:${readString(item.startTiming) || readString(item.officialStartTiming) || "-"}`).join(" / ");
		return [`進入: ${courses || "-"}`, `展示ST: ${st || "-"}`].join("\n");
	}

	return "進入: -\nST: -";
};

const getExhibitionText = (entry: ReviewRaceEntry): string => {
	const raceExhibitions = toArray<Record<string, unknown>>(entry.race?.exhibitions);
	const beforeInfo = toArray<Record<string, unknown>>(entry.raceExtra?.wakamatsuBeforeInfo ?? entry.raceExtra?.beforeInfo);
	const original = toArray<Record<string, unknown>>(entry.raceExtra?.originalExhibition);
	const rows = raceExhibitions.length > 0 ? raceExhibitions : beforeInfo.length > 0 ? beforeInfo : original;

	if (rows.length === 0) {
		return "展示タイム: -\nチルト: -\nモーター: -";
	}

	return rows.slice(0, 6).map((item) => {
		const frameNo = readString(item.frameNo) || readString(item.frame) || readString(item.boatNo);
		const exhibition = readString(item.exhibitionTime);
		const tilt = readString(item.tilt);
		const motor = readString(item.motorNo) || readString(item.motorNumber);
		return `${frameNo || "-"}号艇 展示${exhibition || "-"} / チルト${tilt || "-"} / モーター${motor || "-"}`;
	}).join("\n");
};

const getVenueExtraSummary = (entry: ReviewRaceEntry): string => {
	const raceExtra = entry.raceExtra;
	const venueExtra = entry.venueExtra;
	if (!raceExtra && !venueExtra) {
		return "-";
	}

	const parts = [
		toArray<unknown>(raceExtra?.wakamatsuBeforeInfo ?? raceExtra?.beforeInfo).length ? `直前 ${toArray<unknown>(raceExtra?.wakamatsuBeforeInfo ?? raceExtra?.beforeInfo).length}艇` : "",
		toArray<unknown>(raceExtra?.startExhibition).length ? `進入/ST ${toArray<unknown>(raceExtra?.startExhibition).length}艇` : "",
		toArray<unknown>(raceExtra?.originalExhibition).length ? `独自展示 ${toArray<unknown>(raceExtra?.originalExhibition).length}艇` : "",
		toArray<unknown>(raceExtra?.motorSummary ?? raceExtra?.wakamatsuMotorHistory).length ? `モーター ${toArray<unknown>(raceExtra?.motorSummary ?? raceExtra?.wakamatsuMotorHistory).length}件` : "",
		venueExtra?.tideInfo ? "潮汐あり" : "",
		venueExtra?.waterSurfaceInfo ? "水面特性あり" : "",
	].filter(Boolean);

	return parts.length ? parts.join(" / ") : "-";
};

const buildPredictionCopyText = (group: ReviewVenueGroup | undefined): string => {
	if (!group) return "対象会場を選択してください。";

	const predictionEntries = group.entries
		.filter((entry) => entry.prediction?.predictionText?.trim())
		.sort((left, right) => (left.prediction?.raceNo ?? 0) - (right.prediction?.raceNo ?? 0));

	if (predictionEntries.length === 0) {
		return `${group.venueName} ${group.date}\n保存済み予想はありません。`;
	}

	return predictionEntries.map((entry) => [
		`■ ${group.venueName} ${entry.prediction?.raceNo ?? entry.practiceResult?.raceNo ?? "-"}R`,
		entry.prediction?.predictionText?.trim() || "",
		"----",
	].join("\n")).join("\n\n");
};

const buildResultCopyText = (group: ReviewVenueGroup | undefined): string => {
	if (!group) return "対象会場を選択してください。";

	const entries = group.entries
		.slice()
		.sort((left, right) => (left.prediction?.raceNo ?? left.practiceResult?.raceNo ?? left.race?.raceNo ?? 0) - (right.prediction?.raceNo ?? right.practiceResult?.raceNo ?? right.race?.raceNo ?? 0));

	if (entries.length === 0) {
		return `${group.venueName} ${group.date}\nレビュー対象レースはありません。`;
	}

	return entries.map((entry) => {
		const raceNo = entry.prediction?.raceNo ?? entry.practiceResult?.raceNo ?? entry.race?.raceNo ?? 0;
		const finishOrder = getFinishOrder(entry);
		const hit = judgeBoatPredictionHit({
			tickets: entry.prediction?.tickets ?? [],
			actualFinishOrderText: finishOrder,
		});
		const result = getRaceResult(entry);
		const weather = result?.weatherActual ?? entry.race?.weatherActual ?? entry.venue?.weatherActual;
		const investment = entry.practiceResult?.investmentAmount ?? 0;
		const payout = entry.practiceResult?.payoutAmount ?? 0;
		const profit = payout - investment;
		const roi = investment > 0 ? payout / investment * 100 : 0;
		const finishParts = finishOrder.split("-").filter(Boolean);

		return [
			`■ ${group.venueName} ${raceNo}R`,
			`レース名: ${getRaceTitle(entry)}`,
			`発走時刻: ${entry.race?.startTime || entry.race?.deadlineTime || "-"}`,
			`結果確定: ${result?.status || "-"}`,
			`着順: ${finishOrder || "-"}`,
			`3連単照合キー: ${hit.resultTop3 || finishOrder || "-"}`,
			`最終判定: ${hit.status === "hit" ? "的中" : hit.status === "miss" ? "不的中" : "判定待ち"}`,
			`的中組み合わせ: ${hit.hitCombination || "-"}`,
			`投資: ${formatYen(investment)}`,
			`払戻: ${formatYen(payout)}`,
			`収支: ${formatYen(profit)}`,
			`回収率: ${formatPercent(roi)}`,
			"",
			"【レース結果】",
			`1着: ${finishParts[0] || "-"} ${finishParts[0] ? getRacerName(entry, finishParts[0]) : ""}`.trim(),
			`2着: ${finishParts[1] || "-"} ${finishParts[1] ? getRacerName(entry, finishParts[1]) : ""}`.trim(),
			`3着: ${finishParts[2] || "-"} ${finishParts[2] ? getRacerName(entry, finishParts[2]) : ""}`.trim(),
			"",
			"【スタート/進入】",
			getStartInfoText(entry),
			`決まり手: ${result?.winningMethod || result?.winningMove || result?.kimarite || "-"}`,
			"",
			"【払戻】",
			getPayoutLine("3連単", result?.payout3tan),
			getPayoutLine("3連複", result?.payout3fuku),
			getPayoutLine("2連単", result?.payout2tan),
			getPayoutLine("2連複", result?.payout2fuku),
			`拡連複: ${Array.isArray(result?.payoutWide) ? result.payoutWide.map((item) => `${item.combination} ${item.payout}`).join(" / ") : "-"}`,
			"",
			"【水面/天候】",
			`天候: ${weather?.weather || "-"}`,
			`風向: ${weather?.windDirection || "-"}`,
			`風速: ${weather?.windSpeed || "-"}`,
			`波高: ${weather?.waveHeight || "-"}`,
			"",
			"【展示/モーター】",
			getExhibitionText(entry),
			`Venue Official Extras要点: ${getVenueExtraSummary(entry)}`,
			"----",
		].join("\n");
	}).join("\n\n");
};

const downloadText = (filename: string, text: string): void => {
	const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
};

const copyText = async (text: string): Promise<boolean> => {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
};

export function ReviewPage() {
	const operationalToday = useMemo(() => getOperationalToday(), []);
	const operationalYesterday = useMemo(() => shiftDate(operationalToday, -1), [operationalToday]);
	const [mode, setMode] = useState<ReviewMode>("today");
	const [selectedDate, setSelectedDate] = useState(operationalToday);
	const [todayFeed, setTodayFeed] = useState<BoatTodayFeed | null>(null);
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [pastReviewItems, setPastReviewItems] = useState<PastReviewFile[]>([]);
	const [predictionRecords, setPredictionRecords] = useState(() => loadBoatPredictionRecords());
	const [practiceResultRecords, setPracticeResultRecords] = useState(() => loadBoatPracticeResultRecords());
	const [reviewReports, setReviewReports] = useState(() => loadReviewReports());
	const [selectedVenueKey, setSelectedVenueKey] = useState("");
	const [venueQuery, setVenueQuery] = useState("");
	const [racerQuery, setRacerQuery] = useState("");
	const [keywordQuery, setKeywordQuery] = useState("");
	const [reviewBody, setReviewBody] = useState("");
	const [statusMessage, setStatusMessage] = useState("");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		let active = true;

		const loadFeeds = async () => {
			const [raceDetails, venueExtras] = await Promise.all([
				loadBoatTodayRaceDetailsFeed(),
				loadBoatVenueExtrasFeed(),
			]);

			if (!active) return;

			setTodayFeed(raceDetails);
			setVenueExtrasFeed(venueExtras);
		};

		void loadFeeds();

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		let active = true;

		const loadPastReviews = async () => {
			try {
				const response = await fetch(PAST_REVIEW_INDEX_URL, { cache: "no-store" });
				if (!response.ok) {
					if (active) setPastReviewItems([]);
					return;
				}

				const payload = await response.json() as PastReviewIndex;
				const items = payload.items ?? payload.files ?? payload.reviews ?? [];
				if (active) setPastReviewItems(Array.isArray(items) ? items : []);
			} catch {
				if (active) setPastReviewItems([]);
			}
		};

		void loadPastReviews();

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (mode === "today") {
			setSelectedDate(operationalToday);
		}

		if (mode === "yesterday") {
			setSelectedDate(operationalYesterday);
		}
	}, [mode, operationalToday, operationalYesterday]);

	const venueMap = useMemo(() => new Map((todayFeed?.venues ?? []).map((venue) => [venue.venueName, venue])), [todayFeed]);

	const groups = useMemo<ReviewVenueGroup[]>(() => {
		const entriesByVenue = new Map<string, ReviewVenueGroup>();
		const predictionValues = Object.values(predictionRecords).filter((record) => record.date === selectedDate);
		const practiceValues = Object.values(practiceResultRecords).filter((record) => record.date === selectedDate);
		const keys = new Set([...predictionValues.map((record) => record.raceKey), ...practiceValues.map((record) => record.raceKey)]);

		keys.forEach((raceKey) => {
			const prediction = predictionRecords[raceKey];
			const practiceResult = practiceResultRecords[raceKey];
			const venueName = prediction?.venueName ?? practiceResult?.venueName ?? "";
			const venue = venueMap.get(venueName) ?? null;
			const raceNo = prediction?.raceNo ?? practiceResult?.raceNo ?? 0;
			const race = venue?.races?.find((item) => item.raceNo === raceNo || item.raceId === prediction?.raceId || item.raceId === practiceResult?.raceId) ?? null;
			const venueExtra = findSelectedVenueExtra(venueExtrasFeed, venue ?? undefined);
			const raceExtra = findSelectedRaceExtra(venueExtra, race ?? undefined);
			const key = `${selectedDate}:${venueName}`;
			const current = entriesByVenue.get(key) ?? {
				key,
				venueName,
				date: selectedDate,
				title: venue?.title ?? "",
				session: venue ? getVenueTimeBand(venue as BoatTodayVenueItem & Record<string, unknown>) : "unknown",
				entries: [],
			};

			current.entries.push({
				raceKey,
				venue,
				race,
				prediction,
				practiceResult,
				venueExtra,
				raceExtra,
			});
			entriesByVenue.set(key, current);
		});

		const normalizedVenueQuery = venueQuery.trim().normalize("NFKC").toLowerCase();
		const normalizedRacerQuery = racerQuery.trim().normalize("NFKC").toLowerCase();
		const normalizedKeywordQuery = keywordQuery.trim().normalize("NFKC").toLowerCase();

		return Array.from(entriesByVenue.values())
			.map((group) => ({
				...group,
				entries: group.entries
					.filter((entry) => {
						const searchText = [
							group.venueName,
							group.title,
							entry.prediction?.predictionText,
							entry.practiceResult?.practiceMemo,
							entry.race?.title,
							...(entry.race?.racers ?? []).map((racer) => racer.name),
						].join(" ").normalize("NFKC").toLowerCase();

						if (normalizedVenueQuery && !group.venueName.normalize("NFKC").toLowerCase().includes(normalizedVenueQuery)) return false;
						if (normalizedRacerQuery && !(entry.race?.racers ?? []).some((racer) => racer.name.normalize("NFKC").toLowerCase().includes(normalizedRacerQuery))) return false;
						if (normalizedKeywordQuery && !searchText.includes(normalizedKeywordQuery)) return false;
						return true;
					})
					.sort((left, right) => (left.prediction?.raceNo ?? left.practiceResult?.raceNo ?? 0) - (right.prediction?.raceNo ?? right.practiceResult?.raceNo ?? 0)),
			}))
			.filter((group) => group.entries.length > 0)
			.sort((left, right) => {
				const sessionDiff = getSessionOrder(left.session) - getSessionOrder(right.session);
				if (sessionDiff !== 0) return sessionDiff;
				return left.venueName.localeCompare(right.venueName, "ja");
			});
	}, [predictionRecords, practiceResultRecords, racerQuery, selectedDate, todayFeed, venueExtrasFeed, venueMap, venueQuery, keywordQuery]);

	const selectedGroup = groups.find((group) => group.key === selectedVenueKey) ?? groups[0];

	useEffect(() => {
		if (!selectedGroup) {
			setSelectedVenueKey("");
			setReviewBody("");
			return;
		}

		setSelectedVenueKey((current) => groups.some((group) => group.key === current) ? current : selectedGroup.key);
	}, [groups, selectedGroup]);

	const activeReportKey = selectedGroup ? `${selectedDate}:${selectedGroup.venueName}` : "";

	useEffect(() => {
		if (!activeReportKey) {
			setReviewBody("");
			return;
		}

		setReviewBody(reviewReports[activeReportKey]?.body ?? "");
	}, [activeReportKey, reviewReports]);

	const predictionCopyText = useMemo(() => buildPredictionCopyText(selectedGroup), [selectedGroup]);
	const resultCopyText = useMemo(() => buildResultCopyText(selectedGroup), [selectedGroup]);

	const summary = useMemo(() => {
		const entries = groups.flatMap((group) => group.entries);
		const predictionCount = entries.filter((entry) => entry.prediction).length;
		const raceCount = entries.length;
		const totalInvestment = entries.reduce((sum, entry) => sum + (entry.practiceResult?.investmentAmount ?? 0), 0);
		const totalPayout = entries.reduce((sum, entry) => sum + (entry.practiceResult?.payoutAmount ?? 0), 0);
		const hitCount = entries.filter((entry) => {
			const finish = getFinishOrder(entry);
			return judgeBoatPredictionHit({ tickets: entry.prediction?.tickets ?? [], actualFinishOrderText: finish }).status === "hit";
		}).length;
		const judgedCount = entries.filter((entry) => {
			const finish = getFinishOrder(entry);
			return judgeBoatPredictionHit({ tickets: entry.prediction?.tickets ?? [], actualFinishOrderText: finish }).status !== "pending";
		}).length;
		const roi = totalInvestment > 0 ? totalPayout / totalInvestment * 100 : 0;

		return {
			venueCount: groups.length,
			raceCount,
			predictionCount,
			hitCount,
			hitRate: judgedCount > 0 ? hitCount / judgedCount * 100 : 0,
			totalInvestment,
			totalPayout,
			profitLoss: totalPayout - totalInvestment,
			roi,
		};
	}, [groups]);

	const handleModeChange = (nextMode: ReviewMode) => {
		setMode(nextMode);
		setStatusMessage("");
	};

	const handleDateChange = (event: ChangeEvent<HTMLInputElement>) => {
		const nextDate = event.target.value;
		if (nextDate > operationalToday) {
			return;
		}

		setSelectedDate(nextDate);
		if (nextDate === operationalToday) setMode("today");
		else if (nextDate === operationalYesterday) setMode("yesterday");
		else setMode("archive");
	};

	const handleRefreshStorage = () => {
		setPredictionRecords(loadBoatPredictionRecords());
		setPracticeResultRecords(loadBoatPracticeResultRecords());
		setReviewReports(loadReviewReports());
		setStatusMessage("localStorage を再読み込みしました。");
	};

	const handleCopy = async (text: string, label: string) => {
		const copied = await copyText(text);
		setStatusMessage(copied ? `${label}をコピーしました。` : `${label}のコピーに失敗しました。テキストを選択してコピーしてください。`);
	};

	const handleSaveReport = () => {
		if (!activeReportKey || mode === "archive") {
			setStatusMessage("過去ファイルモードでは localStorage 保存しません。");
			return;
		}

		const nextReports = {
			...reviewReports,
			[activeReportKey]: {
				body: reviewBody,
				savedAt: new Date().toISOString(),
			},
		};

		saveReviewReports(nextReports);
		setReviewReports(nextReports);
		setStatusMessage("GPTレビュー本文を保存しました。");
	};

	const handleDeleteReport = () => {
		if (!activeReportKey || mode === "archive") {
			setStatusMessage("過去ファイルモードでは削除対象がありません。");
			return;
		}

		const nextReports = { ...reviewReports };
		delete nextReports[activeReportKey];
		saveReviewReports(nextReports);
		setReviewReports(nextReports);
		setReviewBody("");
		setStatusMessage("GPTレビュー本文を削除しました。");
	};

	const handleReadTxt = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = () => {
			setReviewBody(String(reader.result ?? ""));
			setStatusMessage(`${file.name} を読み込みました。`);
		};
		reader.readAsText(file, "utf-8");
		event.target.value = "";
	};

	return (
		<PageShell
			eyebrow="BOAT REVIEW"
			title="BOAT REVIEW WORKBENCH"
			description="今日の予想と結果を、次の一手につなげるための競艇レビュー画面です。"
			contentMaxWidth="2040px"
			contentPaddingInline="24px"
			heroMaxWidth="2040px"
			hideHero
		>
			<div style={shellStyle}>
				<div style={heroCalendarGridStyle}>
				<section style={heroStyle}>
					<div style={heroTopStyle}>
						<div style={heroTitleWrapStyle}>
							<p style={eyebrowStyle}>BOAT REVIEW WORKBENCH</p>
							<h2 style={heroTitleStyle}>今日の予想と結果を、次の一手につなげる</h2>
							<p style={heroTextStyle}>保存済み予想、実践結果、公式結果、Venue Official Extras の要点をまとめて、GPTレビューに渡しやすい素材へ整えます。</p>
						</div>
						<div style={chipRowStyle}>
							<span style={chipStyle}>{modeLabels[mode]}</span>
							<span style={chipStyle}>対象日 {selectedDate}</span>
							<span style={chipStyle}>6時切替</span>
						</div>
					</div>
					<div style={summaryGridStyle}>
						{[
							{ label: "対象会場", value: `${summary.venueCount} 会場` },
							{ label: "対象R", value: `${summary.raceCount} R` },
							{ label: "保存予想", value: `${summary.predictionCount} 件` },
							{ label: "的中", value: `${summary.hitCount} 件` },
							{ label: "的中率", value: formatPercent(summary.hitRate) },
							{ label: "投資", value: formatYen(summary.totalInvestment) },
							{ label: "払戻", value: formatYen(summary.totalPayout) },
							{ label: "回収率", value: formatPercent(summary.roi) },
						].map((item) => (
							<article key={item.label} style={summaryCardStyle}>
								<p style={summaryLabelStyle}>{item.label}</p>
								<p style={summaryValueStyle}>{item.value}</p>
							</article>
						))}
					</div>
				</section>

					<section style={calendarPanelStyle}>
						<h3 style={panelTitleStyle}>レビュー日付カレンダー</h3>
						<div style={modeButtonRowStyle}>
							{(["today", "yesterday", "archive"] as ReviewMode[]).map((item) => (
								<button
									key={item}
									type="button"
									onClick={() => handleModeChange(item)}
									style={{
										...modeButtonBaseStyle,
										background: mode === item ? boatTheme.colors.navy : modeButtonBaseStyle.background,
										color: mode === item ? "#fff" : modeButtonBaseStyle.color,
									}}
								>
									{modeLabels[item]}
								</button>
							))}
							<button type="button" style={secondaryButtonStyle} onClick={handleRefreshStorage}>再読み込み</button>
						</div>
						<label style={fieldStyle}>
							<span style={labelStyle}>対象日</span>
							<input type="date" style={inputStyle} value={selectedDate} max={operationalToday} onChange={handleDateChange} />
						</label>
						<div style={summaryGridStyle}>
							<article style={summaryCardStyle}>
								<p style={summaryLabelStyle}>モード</p>
								<p style={summaryValueStyle}>{modeLabels[mode]}</p>
							</article>
							<article style={summaryCardStyle}>
								<p style={summaryLabelStyle}>対象R</p>
								<p style={summaryValueStyle}>{summary.raceCount}R</p>
							</article>
						</div>
						<p style={{ ...heroTextStyle, fontSize: "0.84rem" }}>
							今日/昨日はlocalStorageの予想・実践結果を読み、過去ファイルは登録済みTXTの参照に使います。
						</p>
					</section>
				</div>

				<div style={controlsGridStyle}>
					<section style={panelStyle}>
						<h3 style={panelTitleStyle}>検索・絞り込み</h3>
						<div style={fieldGridStyle}>
							<label style={fieldStyle}>
								<span style={labelStyle}>会場検索</span>
								<input style={inputStyle} value={venueQuery} onChange={(event) => setVenueQuery(event.target.value)} placeholder="若松 / 丸亀 / 鳴門" />
							</label>
							<label style={fieldStyle}>
								<span style={labelStyle}>選手検索</span>
								<input style={inputStyle} value={racerQuery} onChange={(event) => setRacerQuery(event.target.value)} placeholder="毒島 / 峰 / 守屋" />
							</label>
							<label style={fieldStyle}>
								<span style={labelStyle}>キーワード</span>
								<input style={inputStyle} value={keywordQuery} onChange={(event) => setKeywordQuery(event.target.value)} placeholder="イン逃げ / まくり / 差し / 向かい風 / 展示" />
							</label>
						</div>
						<p style={{ ...heroTextStyle, fontSize: "0.82rem" }}>
							使用キー: {BOAT_PREDICTION_STORAGE_KEY} / {BOAT_PRACTICE_RESULT_STORAGE_KEY} / {REVIEW_REPORT_STORAGE_KEY}
						</p>
					</section>

					<section style={panelStyle}>
						<h3 style={panelTitleStyle}>過去レビュー</h3>
						{pastReviewItems.length > 0 ? (
							<div style={archiveListStyle}>
								{pastReviewItems.slice(0, 6).map((item, index) => (
									<article key={`${item.date}-${item.venueName}-${index}`} style={archiveCardStyle}>
										<p style={venueCardTitleStyle}>{item.title || `${item.date ?? "-"} ${item.venueName ?? ""}`}</p>
										<div style={chipRowStyle}>
											{item.predictionFile ? <a href={withBasePath(item.predictionFile)} style={chipStyle}>予想TXT</a> : null}
											{item.resultFile ? <a href={withBasePath(item.resultFile)} style={chipStyle}>結果TXT</a> : null}
											{item.summaryFile ? <a href={withBasePath(item.summaryFile)} style={chipStyle}>レビューTXT</a> : null}
										</div>
									</article>
								))}
							</div>
						) : (
							<p style={emptyStateStyle}>保存レビューTXTはまだ登録されていません。`public/data/reviews/index.json` が追加されるとここに表示します。</p>
						)}
					</section>
				</div>

				{mode === "archive" && groups.length === 0 ? (
					<SectionCard title="過去ファイルモード" description="このモードでは localStorage ではなく、登録済みTXTだけを参照します。">
						<p style={emptyStateStyle}>対象日の保存済み予想が localStorage にない場合でも画面は利用できます。過去レビューTXTが登録されると右上の一覧に表示されます。</p>
					</SectionCard>
				) : null}

				<div style={contentGridStyle}>
					<section style={panelStyle}>
						<h3 style={panelTitleStyle}>会場カード</h3>
						{groups.length > 0 ? (
							<div style={venueListStyle}>
								{groups.map((group) => {
									const isSelected = selectedGroup?.key === group.key;
									const investment = group.entries.reduce((sum, entry) => sum + (entry.practiceResult?.investmentAmount ?? 0), 0);
									const payout = group.entries.reduce((sum, entry) => sum + (entry.practiceResult?.payoutAmount ?? 0), 0);
									const profit = payout - investment;
									const hitCount = group.entries.filter((entry) => judgeBoatPredictionHit({ tickets: entry.prediction?.tickets ?? [], actualFinishOrderText: getFinishOrder(entry) }).status === "hit").length;
									const judgedCount = group.entries.filter((entry) => judgeBoatPredictionHit({ tickets: entry.prediction?.tickets ?? [], actualFinishOrderText: getFinishOrder(entry) }).status !== "pending").length;

									return (
										<button
											key={group.key}
											type="button"
											onClick={() => setSelectedVenueKey(group.key)}
											style={{
												...venueCardBaseStyle,
												border: isSelected ? "1px solid rgba(24, 115, 152, 0.64)" : venueCardBaseStyle.border,
												background: isSelected
													? "linear-gradient(180deg, rgba(235, 250, 255, 0.98), rgba(245, 255, 251, 0.95))"
													: venueCardBaseStyle.background,
												boxShadow: isSelected ? "0 18px 34px rgba(17, 64, 92, 0.12)" : venueCardBaseStyle.boxShadow,
											}}
										>
											<div style={chipRowStyle}>
												<p style={venueCardTitleStyle}>{group.venueName}</p>
												<span style={chipStyle}>{getSessionLabel(group.session)}</span>
											</div>
											<p style={{ ...heroTextStyle, fontSize: "0.78rem" }}>{group.date} / {group.title || "開催名確認中"}</p>
											<div style={metricGridStyle}>
												{[
													{ label: "対象R", value: `${group.entries.length}R` },
													{ label: "投資", value: formatYen(investment) },
													{ label: "払戻", value: formatYen(payout) },
													{ label: "収支", value: formatYen(profit) },
													{ label: "回収率", value: formatPercent(investment > 0 ? payout / investment * 100 : 0) },
													{ label: "的中率", value: formatPercent(judgedCount > 0 ? hitCount / judgedCount * 100 : 0) },
												].map((item) => (
													<div key={item.label} style={metricBoxStyle}>
														<p style={metricLabelStyle}>{item.label}</p>
														<p style={metricValueStyle}>{item.value}</p>
													</div>
												))}
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<p style={emptyStateStyle}>この日付の保存済み予想・実践結果はまだありません。PredictionPageで予想を保存すると、ここに会場カードが表示されます。</p>
						)}
					</section>

					<div style={{ display: "grid", gap: "16px", minWidth: 0 }}>
						{selectedGroup ? (
							<div style={chipRowStyle}>
								<span style={chipStyle}>{selectedGroup.venueName}</span>
								<span style={chipStyle}>{selectedGroup.entries.length}R</span>
								{selectedGroup.entries.flatMap((entry) => getFinishOrder(entry).split("-").filter(Boolean).slice(0, 3)).slice(0, 6).map((boatNo, index) => (
									<span key={`${boatNo}-${index}`} style={getBoatChipStyle(boatNo)}>{boatNo}</span>
								))}
							</div>
						) : null}

						<div style={workbenchGridStyle}>
							<div style={copyColumnStyle}>
							<section style={textPanelStyle}>
								<h3 style={panelTitleStyle}>予想まとめコピー</h3>
								<textarea style={textareaStyle} value={predictionCopyText} readOnly />
								<div style={buttonRowStyle}>
									<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(predictionCopyText, "予想まとめ")}>コピー</button>
									<button type="button" style={secondaryButtonStyle} onClick={() => downloadText(`${selectedDate}-${selectedGroup?.venueName ?? "boat"}-predictions.txt`, predictionCopyText)}>TXTダウンロード</button>
								</div>
							</section>

							<section style={textPanelStyle}>
								<h3 style={panelTitleStyle}>結果まとめコピー</h3>
								<textarea style={textareaStyle} value={resultCopyText} readOnly />
								<div style={buttonRowStyle}>
									<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(resultCopyText, "結果まとめ")}>コピー</button>
									<button type="button" style={secondaryButtonStyle} onClick={() => downloadText(`${selectedDate}-${selectedGroup?.venueName ?? "boat"}-results.txt`, resultCopyText)}>TXTダウンロード</button>
								</div>
							</section>
						</div>

						<section style={panelStyle}>
							<div style={heroTopStyle}>
								<div>
									<h3 style={panelTitleStyle}>GPTレビュー貼り付け欄</h3>
									<p style={{ ...heroTextStyle, fontSize: "0.82rem" }}>
										{mode === "archive" ? "過去ファイルモードでは localStorage 保存しません。" : "選択会場ごとに localStorage へ保存できます。"}
									</p>
								</div>
								{reviewReports[activeReportKey]?.savedAt ? <span style={chipStyle}>保存済み {new Date(reviewReports[activeReportKey].savedAt).toLocaleString("ja-JP")}</span> : null}
							</div>
							<textarea
								style={reviewTextareaStyle}
								value={reviewBody}
								onChange={(event) => setReviewBody(event.target.value)}
								placeholder="GPTで作成した競艇レビューをここに貼り付けます。進入、ST、展示、モーター、水面、買い目の反省を残してください。"
							/>
							<input ref={fileInputRef} type="file" accept=".txt,text/plain" onChange={handleReadTxt} style={{ display: "none" }} />
							<div style={buttonRowStyle}>
								<button type="button" style={primaryButtonStyle} onClick={handleSaveReport}>レポート保存</button>
								<button type="button" style={secondaryButtonStyle} onClick={() => fileInputRef.current?.click()}>TXT読込</button>
								<button type="button" style={secondaryButtonStyle} onClick={() => downloadText(`${selectedDate}-${selectedGroup?.venueName ?? "boat"}-review.txt`, reviewBody)}>TXTダウンロード</button>
								<button type="button" style={secondaryButtonStyle} onClick={handleDeleteReport}>削除</button>
								{statusMessage ? <span style={chipStyle}>{statusMessage}</span> : null}
							</div>
						</section>
						</div>
					</div>
				</div>
			</div>
		</PageShell>
	);
}
