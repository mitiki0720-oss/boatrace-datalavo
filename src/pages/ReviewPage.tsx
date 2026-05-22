import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { loadBoatPredictionRecords } from "../lib/boatPredictionStorage";
import { loadBoatPracticeResultRecords } from "../lib/boatPracticeResultStorage";
import {
	getBoatReviewArchiveDates,
	getBoatReviewArchiveItemsByDate,
	loadBoatReviewArchiveIndex,
	loadBoatReviewArchiveVenueFiles,
	type BoatReviewArchiveIndex,
	type BoatReviewArchiveItem,
} from "../lib/boatReviewArchive";
import {
	buildBoatPredictionSummaryText,
	buildBoatResultSummaryText,
	buildLiveBoatReviewVenueGroups,
	createArchiveBoatReviewVenueGroup,
	getBoatReviewVenueMetrics,
	getBoatReviewVenueNameFromSlug,
	normalizeBoatPracticeResultList,
	normalizeBoatPredictionRecordList,
	type BoatReviewVenueGroup,
} from "../lib/boatReviewSummaryBuilder";
import type { BoatTodayFeed } from "../lib/boatraceTypes";
import { boatTheme } from "../lib/theme";

type ReviewDataMode = "live" | "archive";

const REVIEW_DRAFT_STORAGE_KEY = "kurari-boat-data-labo-review-summary-drafts";
const HERO_IMAGE_PATH = "review-page/hero/review-hero-boat-summary-kurari-funako.png";
const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const pageStyle: CSSProperties = {
	display: "grid",
	gap: "24px",
	width: "100%",
	padding: "18px 24px 96px",
	boxSizing: "border-box",
};

const heroStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.1fr) minmax(360px, 0.9fr)",
	gap: "28px",
	alignItems: "stretch",
	padding: "34px",
	borderRadius: "34px",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	background:
		"radial-gradient(circle at 10% 0%, rgba(222, 245, 255, 0.9), transparent 34%), radial-gradient(circle at 86% 12%, rgba(235, 226, 255, 0.84), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,252,255,0.96) 54%, rgba(239,246,255,0.95))",
	boxShadow: "0 26px 64px rgba(17, 64, 92, 0.1)",
	overflow: "hidden",
};

const heroImageWrapStyle: CSSProperties = {
	minHeight: "300px",
	borderRadius: "28px",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	background:
		"linear-gradient(135deg, rgba(255,255,255,0.86), rgba(224,247,255,0.76)), radial-gradient(circle at 60% 30%, rgba(197, 241, 255, 0.9), transparent 34%)",
	boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 18px 42px rgba(17, 64, 92, 0.08)",
	overflow: "hidden",
	position: "relative",
	display: "grid",
	placeItems: "center",
};

const heroImageStyle: CSSProperties = {
	width: "100%",
	height: "100%",
	objectFit: "cover",
	display: "block",
};

const heroFallbackStyle: CSSProperties = {
	display: "grid",
	gap: "10px",
	placeItems: "center",
	textAlign: "center",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 900,
	padding: "28px",
};

const titleStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "clamp(2rem, 3.4vw, 4rem)",
	lineHeight: 1.14,
	fontWeight: 950,
};

const textStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "1rem",
	lineHeight: 1.85,
};

const eyebrowStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.78rem",
	fontWeight: 950,
	letterSpacing: "0.14em",
};

const chipRowStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: "9px",
	alignItems: "center",
};

const chipStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "8px 12px",
	borderRadius: "999px",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	background: "rgba(255,255,255,0.86)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.78rem",
	fontWeight: 900,
	whiteSpace: "nowrap",
};

const panelStyle: CSSProperties = {
	padding: "24px",
	borderRadius: "28px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255,255,255,0.94)",
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "16px",
	minWidth: 0,
};

const sectionTitleStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "1.05rem",
	fontWeight: 950,
};

const dateGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
	gap: "8px",
};

const dateButtonStyle: CSSProperties = {
	border: "1px solid rgba(93, 199, 232, 0.2)",
	background: "rgba(255,255,255,0.92)",
	color: boatTheme.colors.navy,
	borderRadius: "16px",
	padding: "12px 10px",
	fontWeight: 900,
	cursor: "pointer",
};

const calendarGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
	gap: "7px",
};

const calendarDayStyle: CSSProperties = {
	minHeight: "42px",
	borderRadius: "14px",
	border: "1px solid rgba(93, 199, 232, 0.16)",
	background: "rgba(255,255,255,0.9)",
	color: boatTheme.colors.navy,
	fontWeight: 900,
	cursor: "pointer",
	position: "relative",
};

const mainGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "minmax(320px, 0.74fr) minmax(0, 1.26fr)",
	gap: "22px",
	alignItems: "start",
};

const venueListStyle: CSSProperties = {
	display: "grid",
	gap: "12px",
};

const venueCardStyle: CSSProperties = {
	width: "100%",
	textAlign: "left",
	padding: "18px",
	borderRadius: "22px",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,252,255,0.94))",
	boxShadow: "0 10px 24px rgba(17, 64, 92, 0.045)",
	cursor: "pointer",
	display: "grid",
	gap: "12px",
};

const metricGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	gap: "8px",
};

const metricStyle: CSSProperties = {
	padding: "10px",
	borderRadius: "14px",
	background: "rgba(238, 249, 252, 0.74)",
	border: "1px solid rgba(93, 199, 232, 0.14)",
	display: "grid",
	gap: "3px",
};

const metricLabelStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "0.68rem",
	fontWeight: 800,
};

const metricValueStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "0.88rem",
	fontWeight: 950,
};

const workbenchGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr) minmax(360px, 0.66fr)",
	gap: "18px",
	alignItems: "start",
};

const textareaStyle: CSSProperties = {
	width: "100%",
	minHeight: "340px",
	boxSizing: "border-box",
	padding: "16px",
	borderRadius: "18px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(250,254,255,0.96)",
	color: boatTheme.colors.navy,
	lineHeight: 1.7,
	fontSize: "0.84rem",
	fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
	resize: "vertical",
};

const summaryTextareaStyle: CSSProperties = {
	...textareaStyle,
	minHeight: "520px",
	fontFamily: "inherit",
};

const buttonRowStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	gap: "8px",
	alignItems: "center",
};

const primaryButtonStyle: CSSProperties = {
	padding: "10px 13px",
	borderRadius: "14px",
	border: "none",
	background: boatTheme.colors.navy,
	color: "#fff",
	fontWeight: 900,
	cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
	...primaryButtonStyle,
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255,255,255,0.95)",
	color: boatTheme.colors.navy,
};

const emptyStyle: CSSProperties = {
	margin: 0,
	padding: "24px",
	borderRadius: "22px",
	border: "1px dashed rgba(93, 199, 232, 0.38)",
	background: "rgba(247,253,255,0.9)",
	color: boatTheme.colors.muted,
	lineHeight: 1.8,
};

function formatJstDate(date: Date): string {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

function getOperationalToday(): string {
	const now = new Date();
	const hour = Number(new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", hour12: false }).format(now));
	const base = new Date(now);
	if (hour < 6) base.setDate(base.getDate() - 1);
	return formatJstDate(base);
}

function shiftDate(dateText: string, days: number): string {
	const date = new Date(`${dateText}T00:00:00+09:00`);
	date.setDate(date.getDate() + days);
	return formatJstDate(date);
}

function formatMonthLabel(month: string): string {
	const [year, monthNumber] = month.split("-").map(Number);
	return `${year}年${monthNumber}月`;
}

function shiftMonth(month: string, delta: number): string {
	const [year, monthNumber] = month.split("-").map(Number);
	const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarCells(month: string): string[] {
	const [year, monthNumber] = month.split("-").map(Number);
	const first = new Date(Date.UTC(year, monthNumber - 1, 1));
	const offset = (first.getUTCDay() + 6) % 7;
	const start = new Date(first);
	start.setUTCDate(first.getUTCDate() - offset);
	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
	});
}

function formatYen(value: number): string {
	return `${value.toLocaleString("ja-JP")}円`;
}

function formatSignedYen(value: number): string {
	return `${value >= 0 ? "+" : ""}${formatYen(value)}`;
}

function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function readDrafts(): Record<string, string> {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(REVIEW_DRAFT_STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
	} catch {
		return {};
	}
}

function saveDraft(key: string, value: string): void {
	if (typeof window === "undefined") return;
	const drafts = readDrafts();
	window.localStorage.setItem(REVIEW_DRAFT_STORAGE_KEY, JSON.stringify({ ...drafts, [key]: value }));
}

async function copyText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

function downloadText(filename: string, text: string): void {
	const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

function normalizeLocalStorageValues<T>(map: Record<string, T>): T[] {
	return Array.isArray(map) ? map : Object.values(map || {});
}

export function ReviewPage() {
	const operationalToday = useMemo(() => getOperationalToday(), []);
	const operationalYesterday = useMemo(() => shiftDate(operationalToday, -1), [operationalToday]);
	const [selectedDate, setSelectedDate] = useState(operationalToday);
	const [calendarMonth, setCalendarMonth] = useState(operationalToday.slice(0, 7));
	const [archiveIndex, setArchiveIndex] = useState<BoatReviewArchiveIndex>({ items: [] });
	const [todayFeed, setTodayFeed] = useState<BoatTodayFeed | null>(null);
	const [predictionPayload, setPredictionPayload] = useState(() => loadBoatPredictionRecords());
	const [practicePayload, setPracticePayload] = useState(() => loadBoatPracticeResultRecords());
	const [archiveGroups, setArchiveGroups] = useState<BoatReviewVenueGroup[]>([]);
	const [selectedVenueKey, setSelectedVenueKey] = useState("");
	const [summaryDraft, setSummaryDraft] = useState("");
	const [statusMessage, setStatusMessage] = useState("");
	const [heroImageAvailable, setHeroImageAvailable] = useState(true);

	useEffect(() => {
		let active = true;
		Promise.all([
			loadBoatTodayRaceDetailsFeed(),
			loadBoatReviewArchiveIndex(),
		]).then(([feed, index]) => {
			if (!active) return;
			setTodayFeed(feed);
			setArchiveIndex(index);
		});
		return () => {
			active = false;
		};
	}, []);

	const archiveDates = useMemo(() => getBoatReviewArchiveDates(archiveIndex), [archiveIndex]);
	const archiveDateSet = useMemo(() => new Set(archiveDates), [archiveDates]);
	const liveDateSet = useMemo(() => new Set([operationalToday, operationalYesterday, todayFeed?.date].filter(Boolean) as string[]), [operationalToday, operationalYesterday, todayFeed?.date]);
	const mode: ReviewDataMode = liveDateSet.has(selectedDate) ? "live" : "archive";
	const predictionRecords = useMemo(() => normalizeBoatPredictionRecordList(normalizeLocalStorageValues(predictionPayload)), [predictionPayload]);
	const practiceRecords = useMemo(() => normalizeBoatPracticeResultList(normalizeLocalStorageValues(practicePayload)), [practicePayload]);

	const liveGroups = useMemo(() => buildLiveBoatReviewVenueGroups({
		date: selectedDate,
		feed: todayFeed,
		predictions: predictionRecords,
		practiceResults: practiceRecords,
	}), [practiceRecords, predictionRecords, selectedDate, todayFeed]);

	useEffect(() => {
		let active = true;

		async function loadArchiveGroups() {
			if (mode !== "archive") {
				setArchiveGroups([]);
				return;
			}

			const items = getBoatReviewArchiveItemsByDate(archiveIndex, selectedDate);
			const groups = await Promise.all(items.map(async (item: BoatReviewArchiveItem) => {
				const files = await loadBoatReviewArchiveVenueFiles(item);
				return createArchiveBoatReviewVenueGroup({
					date: item.date,
					venueName: item.venueName || getBoatReviewVenueNameFromSlug(item.venueSlug),
					venueSlug: item.venueSlug,
					predictionFileText: files.predictionsText,
					resultFileText: files.resultsText,
					summaryFileText: files.summaryText,
				});
			}));

			if (active) setArchiveGroups(groups);
		}

		void loadArchiveGroups();
		return () => {
			active = false;
		};
	}, [archiveIndex, mode, selectedDate]);

	const groups = mode === "archive" ? archiveGroups : liveGroups;
	const selectedGroup = useMemo(() => {
		if (groups.length === 0) return undefined;
		return groups.find((group) => group.key === selectedVenueKey) ?? groups[0];
	}, [groups, selectedVenueKey]);

	useEffect(() => {
		if (!selectedGroup) {
			setSelectedVenueKey("");
			return;
		}
		if (!groups.some((group) => group.key === selectedVenueKey)) {
			setSelectedVenueKey(selectedGroup.key);
		}
	}, [groups, selectedGroup, selectedVenueKey]);

	useEffect(() => {
		if (!selectedGroup) {
			setSummaryDraft("");
			return;
		}
		if (mode === "archive") {
			setSummaryDraft(selectedGroup.summaryFileText || "summaryファイル未登録");
			return;
		}
		const draftKey = `${selectedGroup.date}:${selectedGroup.venueSlug}`;
		setSummaryDraft(readDrafts()[draftKey] ?? "");
	}, [mode, selectedGroup]);

	const metrics = useMemo(() => {
		const venueMetrics = groups.map(getBoatReviewVenueMetrics);
		const predictionCount = venueMetrics.reduce((sum, item) => sum + item.predictionCount, 0);
		const resultCount = venueMetrics.reduce((sum, item) => sum + item.resultCount, 0);
		const summaryCount = venueMetrics.filter((item) => item.hasSummary).length;
		return {
			venueCount: groups.length,
			predictionCount,
			resultCount,
			summaryCount,
		};
	}, [groups]);

	const predictionText = selectedGroup ? buildBoatPredictionSummaryText(selectedGroup) : "会場を選択してください";
	const resultText = selectedGroup ? buildBoatResultSummaryText(selectedGroup) : "会場を選択してください";
	const selectedMetrics = selectedGroup ? getBoatReviewVenueMetrics(selectedGroup) : null;
	const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);

	const selectDate = (date: string) => {
		if (date > operationalToday) return;
		setSelectedDate(date);
		setCalendarMonth(date.slice(0, 7));
		setStatusMessage("");
	};

	const refreshLiveData = () => {
		setPredictionPayload(loadBoatPredictionRecords());
		setPracticePayload(loadBoatPracticeResultRecords());
		void loadBoatTodayRaceDetailsFeed().then(setTodayFeed);
		setStatusMessage("今日・昨日のlocalStorage / generated JSONを再読み込みしました");
	};

	const handleCopy = async (text: string, label: string) => {
		const ok = await copyText(text);
		setStatusMessage(ok ? `${label}をコピーしました` : `${label}のコピーに失敗しました`);
	};

	const handleSummaryChange = (value: string) => {
		setSummaryDraft(value);
		if (selectedGroup && mode === "live") {
			saveDraft(`${selectedGroup.date}:${selectedGroup.venueSlug}`, value);
		}
	};

	return (
		<PageShell
			eyebrow="BOAT REVIEW"
			title="BOAT REVIEW WORKBENCH"
			description="GPT予想・公式結果・実践収支・レビューsummaryを会場ごとにまとめます。"
			contentMaxWidth="2040px"
			contentPaddingInline="24px"
			heroMaxWidth="2040px"
			hideHero
		>
			<div style={pageStyle}>
				<section style={heroStyle}>
					<div style={{ display: "grid", gap: "22px", alignContent: "center" }}>
						<p style={eyebrowStyle}>BOAT REVIEW SUMMARY</p>
						<h1 style={titleStyle}>今日の予想と結果を、次の一手につなげる</h1>
						<p style={textStyle}>GPT予想・公式結果・実践収支・レビューsummaryを、会場ごとにまとめて次回予想へ活かします。</p>
						<div style={chipRowStyle}>
							<span style={chipStyle}>選択日 {selectedDate}</span>
							<span style={chipStyle}>対象会場数 {metrics.venueCount}</span>
							<span style={chipStyle}>予想保存数 {metrics.predictionCount}</span>
							<span style={chipStyle}>結果取得数 {metrics.resultCount}</span>
							<span style={chipStyle}>summary {metrics.summaryCount > 0 ? `${metrics.summaryCount}件あり` : "未登録"}</span>
						</div>
					</div>
					<div style={heroImageWrapStyle}>
						{heroImageAvailable ? (
							<img
								src={withBasePath(HERO_IMAGE_PATH)}
								alt="ボートレビューまとめ"
								style={heroImageStyle}
								onError={() => setHeroImageAvailable(false)}
							/>
						) : (
							<div style={heroFallbackStyle}>
								<div style={{ fontSize: "2.4rem" }}>BOAT REVIEW</div>
								<div>画像配置待ち: {HERO_IMAGE_PATH}</div>
							</div>
						)}
					</div>
				</section>

				<section style={panelStyle}>
					<div style={chipRowStyle}>
						<p style={sectionTitleStyle}>Calendar / Date Selector</p>
						<button type="button" style={secondaryButtonStyle} onClick={refreshLiveData}>今日・昨日を再読み込み</button>
						{statusMessage ? <span style={chipStyle}>{statusMessage}</span> : null}
					</div>
					<div style={dateGridStyle}>
						<button type="button" style={{ ...dateButtonStyle, background: selectedDate === operationalToday ? boatTheme.background.highlight : dateButtonStyle.background }} onClick={() => selectDate(operationalToday)}>今日<br />{operationalToday}</button>
						<button type="button" style={{ ...dateButtonStyle, background: selectedDate === operationalYesterday ? boatTheme.background.highlight : dateButtonStyle.background }} onClick={() => selectDate(operationalYesterday)}>昨日<br />{operationalYesterday}</button>
						{todayFeed?.date && todayFeed.date !== operationalToday && todayFeed.date !== operationalYesterday ? (
							<button type="button" style={{ ...dateButtonStyle, background: selectedDate === todayFeed.date ? boatTheme.background.highlight : dateButtonStyle.background }} onClick={() => selectDate(todayFeed.date)}>generated JSON<br />{todayFeed.date}</button>
						) : null}
						{archiveDates.map((date) => (
							<button key={date} type="button" style={{ ...dateButtonStyle, background: selectedDate === date ? boatTheme.background.highlight : dateButtonStyle.background }} onClick={() => selectDate(date)}>archive<br />{date}</button>
						))}
					</div>
					<div style={{ display: "grid", gridTemplateColumns: "48px minmax(0, 1fr) 48px", gap: "10px", alignItems: "center" }}>
						<button type="button" style={secondaryButtonStyle} onClick={() => setCalendarMonth((current) => shiftMonth(current, -1))}>{"<"}</button>
						<p style={{ ...sectionTitleStyle, textAlign: "center" }}>{formatMonthLabel(calendarMonth)}</p>
						<button type="button" style={secondaryButtonStyle} onClick={() => setCalendarMonth((current) => shiftMonth(current, 1))}>{">"}</button>
					</div>
					<div style={calendarGridStyle}>
						{WEEKDAY_LABELS.map((label) => <div key={label} style={{ textAlign: "center", color: boatTheme.colors.aquaDeep, fontWeight: 900 }}>{label}</div>)}
						{calendarCells.map((date) => {
							const inMonth = date.slice(0, 7) === calendarMonth;
							const isSelected = date === selectedDate;
							const isFuture = date > operationalToday;
							const hasArchive = archiveDateSet.has(date);
							return (
								<button
									key={date}
									type="button"
									disabled={isFuture}
									onClick={() => selectDate(date)}
									style={{
										...calendarDayStyle,
										opacity: isFuture ? 0.32 : inMonth ? 1 : 0.42,
										cursor: isFuture ? "not-allowed" : "pointer",
										background: isSelected ? "linear-gradient(135deg, rgba(233,226,255,0.98), rgba(201,241,255,0.96))" : calendarDayStyle.background,
										border: isSelected ? "1px solid rgba(24, 115, 152, 0.5)" : calendarDayStyle.border,
									}}
								>
									{Number(date.slice(8, 10))}
									{hasArchive ? <span style={{ position: "absolute", left: "50%", bottom: "6px", width: "5px", height: "5px", borderRadius: "50%", background: "#f27aa9", transform: "translateX(-50%)" }} /> : null}
								</button>
							);
						})}
					</div>
				</section>

				<div style={mainGridStyle}>
					<section style={panelStyle}>
						<div style={chipRowStyle}>
							<h2 style={sectionTitleStyle}>会場カード</h2>
							<span style={chipStyle}>{mode === "live" ? "localStorage / generated JSON" : "public archive"}</span>
						</div>
						{groups.length > 0 ? (
							<div style={venueListStyle}>
								{groups.map((group) => {
									const itemMetrics = getBoatReviewVenueMetrics(group);
									const active = selectedGroup?.key === group.key;
									return (
										<button
											key={group.key}
											type="button"
											onClick={() => setSelectedVenueKey(group.key)}
											style={{
												...venueCardStyle,
												border: active ? "1px solid rgba(24, 115, 152, 0.62)" : venueCardStyle.border,
												background: active ? "linear-gradient(180deg, rgba(235,250,255,0.98), rgba(246,255,252,0.96))" : venueCardStyle.background,
											}}
										>
											<div style={chipRowStyle}>
												<strong style={{ color: boatTheme.colors.navy, fontSize: "1.05rem" }}>{group.venueName}</strong>
												<span style={chipStyle}>{itemMetrics.hasSummary ? "summaryあり" : "summaryなし"}</span>
											</div>
											<div style={metricGridStyle}>
												{[
													["予想保存R数", `${itemMetrics.predictionCount}R`],
													["結果取得R数", `${itemMetrics.resultCount}R`],
													["実践結果保存R数", `${itemMetrics.practiceCount}R`],
													["的中数", `${itemMetrics.hitCount}`],
													["投資", formatYen(itemMetrics.investment)],
													["払戻", formatYen(itemMetrics.payout)],
													["収支", formatSignedYen(itemMetrics.profit)],
													["回収率", formatPercent(itemMetrics.roi)],
												].map(([label, value]) => (
													<div key={label} style={metricStyle}>
														<p style={metricLabelStyle}>{label}</p>
														<p style={metricValueStyle}>{value}</p>
													</div>
												))}
											</div>
										</button>
									);
								})}
							</div>
						) : (
							<p style={emptyStyle}>この日付の会場データは未登録です。今日・昨日は保存済み予想または generated JSON、過去日は public/data/boatrace/reviews/index.json を確認します。</p>
						)}
					</section>

					<section style={workbenchGridStyle}>
						<div style={{ display: "grid", gap: "18px", minWidth: 0 }}>
							<section style={panelStyle}>
								<div style={chipRowStyle}>
									<h2 style={sectionTitleStyle}>予想まとめコピー</h2>
									{selectedGroup ? <span style={chipStyle}>{selectedGroup.venueName}</span> : null}
								</div>
								<textarea style={textareaStyle} value={predictionText} readOnly />
								<div style={buttonRowStyle}>
									<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(predictionText, "予想まとめ")}>予想まとめをコピー</button>
									<button type="button" style={secondaryButtonStyle} onClick={() => selectedGroup && downloadText(`${selectedGroup.date}-${selectedGroup.venueSlug}-predictions.txt`, predictionText)}>予想まとめを .txt ダウンロード</button>
								</div>
							</section>

							<section style={panelStyle}>
								<div style={chipRowStyle}>
									<h2 style={sectionTitleStyle}>結果まとめコピー</h2>
									{selectedMetrics ? <span style={chipStyle}>結果 {selectedMetrics.resultCount}R</span> : null}
								</div>
								<textarea style={textareaStyle} value={resultText} readOnly />
								<div style={buttonRowStyle}>
									<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(resultText, "結果まとめ")}>結果まとめをコピー</button>
									<button type="button" style={secondaryButtonStyle} onClick={() => selectedGroup && downloadText(`${selectedGroup.date}-${selectedGroup.venueSlug}-results.txt`, resultText)}>結果まとめを .txt ダウンロード</button>
								</div>
							</section>
						</div>

						<section style={panelStyle}>
							<div style={chipRowStyle}>
								<h2 style={sectionTitleStyle}>GPTレビューsummary</h2>
								<span style={chipStyle}>{mode === "archive" ? "public file" : "manual draft"}</span>
							</div>
							<textarea
								style={summaryTextareaStyle}
								value={summaryDraft}
								readOnly={mode === "archive"}
								onChange={(event) => handleSummaryChange(event.target.value)}
								placeholder="今日・昨日はここにsummaryを貼り付けできます。過去日はsummary.mdまたはsummary.txtがあれば表示します。"
							/>
							<div style={buttonRowStyle}>
								<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(summaryDraft, "summary")}>summaryをコピー</button>
								<button type="button" style={secondaryButtonStyle} onClick={() => selectedGroup && downloadText(`${selectedGroup.date}-${selectedGroup.venueSlug}-summary.md`, summaryDraft || "summaryファイル未登録")}>summaryを .md ダウンロード</button>
							</div>
						</section>
					</section>
				</div>
			</div>
		</PageShell>
	);
}
