import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { getBoatOperationDate, resolveActiveBoatOperationDate, shiftBoatOperationDate } from "../lib/boatOperationDate";
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
const REVIEW_PAGE_BACKGROUND_URL = withBasePath("review-page/backgrounds/review-page-bg-water-archive.png");
const WEEKDAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const reviewRootStyle: CSSProperties = {
	position: "relative",
	minHeight: "100%",
	overflow: "hidden",
	paddingBottom: "40px",
};

const reviewBackgroundStyle: CSSProperties = {
	display: "none",
};

const reviewGlowStyle: CSSProperties = {
	position: "absolute",
	inset: 0,
	background: "radial-gradient(circle at 12% 0%, rgba(191, 239, 255, 0.28), transparent 28%), radial-gradient(circle at 88% 12%, rgba(226, 232, 255, 0.26), transparent 30%)",
	pointerEvents: "none",
	zIndex: 1,
};

const pageStyle: CSSProperties = {
	display: "grid",
	gap: "24px",
	width: "100%",
	padding: "18px 24px 96px",
	boxSizing: "border-box",
	position: "relative",
	zIndex: 2,
};

const topGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.45fr) minmax(330px, 0.55fr)",
	gap: "22px",
	alignItems: "stretch",
};

const heroStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.06fr) minmax(320px, 0.94fr)",
	gap: "28px",
	alignItems: "center",
	padding: "34px",
	borderRadius: "34px",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	background:
		"radial-gradient(circle at 12% 0%, rgba(222, 245, 255, 0.9), transparent 34%), radial-gradient(circle at 88% 12%, rgba(235, 226, 255, 0.84), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.98), rgba(244,252,255,0.96) 54%, rgba(239,246,255,0.95))",
	boxShadow: "0 26px 64px rgba(17, 64, 92, 0.1)",
	overflow: "hidden",
};

const heroImageWrapStyle: CSSProperties = {
	minHeight: "270px",
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
	fontSize: "clamp(2rem, 3.2vw, 3.8rem)",
	lineHeight: 1.14,
	fontWeight: 950,
};

const textStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "0.96rem",
	lineHeight: 1.82,
};

const eyebrowStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.74rem",
	fontWeight: 950,
	letterSpacing: "0.14em",
	textTransform: "uppercase",
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
	fontSize: "0.76rem",
	fontWeight: 900,
	whiteSpace: "nowrap",
};

const panelStyle: CSSProperties = {
	padding: "24px",
	borderRadius: "28px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255,255,255,0.88)",
	backdropFilter: "blur(16px)",
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "16px",
	minWidth: 0,
};

const calendarPanelStyle: CSSProperties = {
	...panelStyle,
	background:
		"radial-gradient(circle at 100% 0%, rgba(233, 226, 255, 0.58), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.97), rgba(240,251,253,0.93))",
	alignContent: "start",
};

const sectionHeaderStyle: CSSProperties = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "flex-start",
	gap: "18px",
	flexWrap: "wrap",
};

const sectionTitleStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "1.2rem",
	fontWeight: 950,
};

const dateGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: "10px",
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

const dateButtonStyle: CSSProperties = {
	border: "1px solid rgba(93, 199, 232, 0.2)",
	background: "rgba(255,255,255,0.92)",
	color: boatTheme.colors.navy,
	borderRadius: "16px",
	padding: "12px 10px",
	fontWeight: 900,
	cursor: "pointer",
};

const overviewGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
	gap: "12px",
};

const summaryCardStyle: CSSProperties = {
	padding: "16px 17px",
	borderRadius: "22px",
	background: "rgba(255, 255, 255, 0.86)",
	border: "1px solid rgba(93, 199, 232, 0.2)",
	display: "grid",
	gap: "5px",
	boxShadow: "0 12px 26px rgba(17, 64, 92, 0.04)",
};

const summaryLabelStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.68rem",
	fontWeight: 900,
	letterSpacing: "0.08em",
};

const summaryValueStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "1.08rem",
	fontWeight: 950,
	lineHeight: 1.2,
};

const venueRowsStyle: CSSProperties = {
	display: "grid",
	gap: "16px",
};

const venueRowStyle: CSSProperties = {
	display: "grid",
	gap: "16px",
	alignItems: "stretch",
};

const venueCardStyle: CSSProperties = {
	width: "100%",
	minHeight: "202px",
	textAlign: "left",
	padding: "16px",
	borderRadius: "26px",
	border: "1px solid rgba(93, 199, 232, 0.2)",
	background:
		"radial-gradient(circle at 10% 0%, rgba(202, 243, 255, 0.58), transparent 38%), radial-gradient(circle at 100% 10%, rgba(232, 224, 255, 0.44), transparent 36%), linear-gradient(150deg, rgba(255,255,255,0.99), rgba(242,253,255,0.95) 55%, rgba(248,255,252,0.94))",
	boxShadow: "0 14px 34px rgba(17, 64, 92, 0.055)",
	cursor: "pointer",
	display: "grid",
	gridTemplateRows: "auto auto 1fr",
	gap: "10px",
	position: "relative",
	overflow: "hidden",
};

const metricGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
	gap: "7px",
	alignSelf: "end",
};

const metricStyle: CSSProperties = {
	padding: "8px",
	borderRadius: "15px",
	background: "rgba(239, 251, 255, 0.78)",
	border: "1px solid rgba(93, 199, 232, 0.16)",
	display: "grid",
	gap: "2px",
};

const metricLabelStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.muted,
	fontSize: "0.6rem",
	fontWeight: 850,
};

const metricValueStyle: CSSProperties = {
	margin: 0,
	color: boatTheme.colors.navy,
	fontSize: "0.78rem",
	fontWeight: 950,
	lineHeight: 1.15,
};

const workbenchGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "minmax(0, 1.18fr) minmax(360px, 0.82fr)",
	gap: "22px",
	alignItems: "start",
};

const textareaStyle: CSSProperties = {
	width: "100%",
	minHeight: "300px",
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

function normalizeLocalStorageValues<T>(map: Record<string, T> | T[]): T[] {
	return Array.isArray(map) ? map : Object.values(map || {});
}

function getReviewFileName(date: string, venueSlug: string, suffix: "predictions" | "results" | "summary"): string {
	const ext = "txt";
	return `${date}-${venueSlug}-${suffix}.${ext}`;
}

function getMonthDates(dateSet: Set<string>, selectedDate: string): string[] {
	return Array.from(dateSet)
		.filter((date) => date.slice(0, 7) === selectedDate.slice(0, 7))
		.sort((a, b) => a.localeCompare(b));
}

function formatFileSize(sizeBytes: number | null | undefined): string {
	if (!sizeBytes || sizeBytes <= 0) return "-";
	if (sizeBytes < 1024) return `${sizeBytes}B`;
	return `${(sizeBytes / 1024).toFixed(sizeBytes >= 10 * 1024 ? 0 : 1)}KB`;
}

export function ReviewPage() {
	const operationalToday = useMemo(() => getBoatOperationDate(), []);
	const operationalYesterday = useMemo(() => shiftBoatOperationDate(operationalToday, -1), [operationalToday]);
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
	const archiveItemMap = useMemo(
		() => new Map<string, BoatReviewArchiveItem>(archiveIndex.items.map((item) => [`${item.date}:${item.venueSlug}`, item])),
		[archiveIndex],
	);
	const archiveDateSet = useMemo(() => new Set(archiveDates), [archiveDates]);
	const activeLiveDate = useMemo(() => resolveActiveBoatOperationDate(todayFeed?.date), [todayFeed?.date]);
	const liveDateSet = useMemo(() => new Set([activeLiveDate, shiftBoatOperationDate(activeLiveDate, -1)].filter(Boolean) as string[]), [activeLiveDate]);
	const selectableDateSet = useMemo(() => new Set([...liveDateSet, ...archiveDateSet]), [archiveDateSet, liveDateSet]);
	const mode: ReviewDataMode = liveDateSet.has(selectedDate) ? "live" : "archive";
	const predictionRecords = useMemo(() => normalizeBoatPredictionRecordList(predictionPayload), [predictionPayload]);
	const practiceRecords = useMemo(() => normalizeBoatPracticeResultList(practicePayload), [practicePayload]);

	const liveGroups = useMemo(() => buildLiveBoatReviewVenueGroups({
		date: selectedDate,
		feed: todayFeed,
		predictions: predictionRecords,
		practiceResults: practiceRecords,
	}), [practiceRecords, predictionRecords, selectedDate, todayFeed]);

	useEffect(() => {
		let active = true;

		async function loadArchiveGroups() {
			const items = getBoatReviewArchiveItemsByDate(archiveIndex, selectedDate);
			if (items.length <= 0) {
				setArchiveGroups([]);
				return;
			}

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
	}, [archiveIndex, selectedDate]);

	const archiveGroupMap = useMemo(
		() => new Map<string, BoatReviewVenueGroup>(archiveGroups.map((group) => [group.key, group])),
		[archiveGroups],
	);

	const groups = useMemo(() => {
	if (mode === "archive") {
		return archiveGroups;
	}

	const hasSavedPrediction = (group: BoatReviewVenueGroup) =>
		group.races.some((entry) => Boolean(entry.prediction?.predictionText?.trim()));

	const hasArchivePrediction = (group: BoatReviewVenueGroup) =>
		Boolean(archiveItemMap.get(group.key)?.predictionFile);

	const mergedGroups = liveGroups.filter(hasSavedPrediction);

	for (const archiveGroup of archiveGroups) {
		if (hasArchivePrediction(archiveGroup) && !mergedGroups.some((group) => group.key === archiveGroup.key)) {
			mergedGroups.push(archiveGroup);
		}
	}

	return mergedGroups;
}, [archiveGroups, archiveItemMap, liveGroups, mode]);
	const venueRows = useMemo(() => {
		if (groups.length <= 1) return groups.length === 1 ? [groups] : [];
		const firstRowCount = Math.ceil(groups.length / 2);
		return [groups.slice(0, firstRowCount), groups.slice(firstRowCount)].filter((row) => row.length > 0);
	}, [groups]);
	const selectedGroup = useMemo(() => {
		if (groups.length === 0) return undefined;
		return groups.find((group) => group.key === selectedVenueKey) ?? groups[0];
	}, [groups, selectedVenueKey]);
	const selectedLiveGroup = useMemo(
		() => selectedGroup ? liveGroups.find((group) => group.key === selectedGroup.key) : undefined,
		[liveGroups, selectedGroup],
	);
	const selectedArchiveGroup = useMemo(
		() => selectedGroup ? archiveGroupMap.get(selectedGroup.key) : undefined,
		[archiveGroupMap, selectedGroup],
	);

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
			setSummaryDraft(selectedArchiveGroup?.summaryFileText || selectedGroup.summaryFileText || "summary未登録");
			return;
		}
		const draftKey = `${selectedGroup.date}:${selectedGroup.venueSlug}`;
		setSummaryDraft(readDrafts()[draftKey] ?? selectedArchiveGroup?.summaryFileText ?? "summary未登録");
	}, [mode, selectedArchiveGroup, selectedGroup]);

	const metrics = useMemo(() => {
		const venueMetrics = groups.map(getBoatReviewVenueMetrics);
		const predictionCount = venueMetrics.reduce((sum, item) => sum + item.predictionCount, 0);
		const resultCount = venueMetrics.reduce((sum, item) => sum + item.resultCount, 0);
		const practiceCount = venueMetrics.reduce((sum, item) => sum + item.practiceCount, 0);
		const hitCount = venueMetrics.reduce((sum, item) => sum + item.hitCount, 0);
		const investment = venueMetrics.reduce((sum, item) => sum + item.investment, 0);
		const payout = venueMetrics.reduce((sum, item) => sum + item.payout, 0);
		const summaryCount = venueMetrics.filter((item) => item.hasSummary).length;
		return {
			venueCount: groups.length,
			predictionCount,
			resultCount,
			practiceCount,
			hitCount,
			investment,
			payout,
			profit: payout - investment,
			roi: investment > 0 ? payout / investment * 100 : 0,
			summaryCount,
		};
	}, [groups]);

	const selectedMetrics = selectedGroup ? getBoatReviewVenueMetrics(selectedGroup) : null;
	const predictionText = useMemo(() => {
		if (!selectedGroup) {
			return "会場を選択してください";
		}

		if (mode === "archive") {
			return selectedArchiveGroup ? buildBoatPredictionSummaryText(selectedArchiveGroup) : "予想ファイル未登録";
		}

		if (selectedLiveGroup) {
			const hasLivePrediction = selectedLiveGroup.races.some((entry) => Boolean(entry.prediction?.predictionText?.trim()));
			if (hasLivePrediction || !selectedArchiveGroup?.predictionFileText?.trim()) {
				return buildBoatPredictionSummaryText(selectedLiveGroup);
			}
		}

		return selectedArchiveGroup ? buildBoatPredictionSummaryText(selectedArchiveGroup) : "予想ファイル未登録";
	}, [mode, selectedArchiveGroup, selectedGroup, selectedLiveGroup]);
	const resultText = useMemo(() => {
		if (!selectedGroup) {
			return "会場を選択してください";
		}

		if (mode === "archive") {
			return selectedArchiveGroup ? buildBoatResultSummaryText(selectedArchiveGroup) : "結果ファイル未登録";
		}

		if (selectedLiveGroup) {
			const hasLiveResult = selectedLiveGroup.races.some((entry) => entry.practiceResult || entry.race?.result);
			if (hasLiveResult || !selectedArchiveGroup?.resultFileText?.trim()) {
				return buildBoatResultSummaryText(selectedLiveGroup);
			}
		}

		return selectedArchiveGroup ? buildBoatResultSummaryText(selectedArchiveGroup) : "結果ファイル未登録";
	}, [mode, selectedArchiveGroup, selectedGroup, selectedLiveGroup]);
	const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
	const monthRegisteredDates = useMemo(() => getMonthDates(selectableDateSet, `${calendarMonth}-01`), [calendarMonth, selectableDateSet]);
	const modeLabel = mode === "archive" ? "ARCHIVE FILE" : selectedDate === operationalToday ? "TODAY LIVE" : "YESTERDAY LIVE";
	const sourceLabel = mode === "archive"
		? "archive txt"
		: selectedDate === operationalYesterday
			? "localStorage優先 / archive fallback"
			: "today localStorage";

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
		setStatusMessage("今日・昨日のlocalStorageを優先しつつ、必要なら archive も再読み込みしました");
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
			<div className="review-page-root" style={reviewRootStyle}>
				<div aria-hidden="true" style={reviewBackgroundStyle} />
				<div aria-hidden="true" style={reviewGlowStyle} />
				<div className="boat-review-workbench" style={pageStyle}>
				<section className="boat-review-top" style={topGridStyle}>
					<div className="boat-review-hero" style={heroStyle}>
						<div style={{ display: "grid", gap: "22px", alignContent: "center" }}>
							<p style={eyebrowStyle}>REVIEW ARCHIVE LOUNGE</p>
							<h1 style={titleStyle}>今日の予想と結果を、次の一手につなげる</h1>
							<p style={textStyle}>会場ごとに 1R〜12R の予想・結果・summary をまとめ、今日と昨日は localStorage、過去日は保存済み txt から自然に振り返るラウンジです。</p>
							<div style={chipRowStyle}>
								<span style={chipStyle}>{modeLabel}</span>
								<span style={chipStyle}>選択日 {selectedDate}</span>
								<span style={chipStyle}>今日 / 昨日 / Archive</span>
								<span style={chipStyle}>Summary {metrics.summaryCount > 0 ? `${metrics.summaryCount}件` : "未登録"}</span>
							</div>
						</div>
						<div style={heroImageWrapStyle}>
							{heroImageAvailable ? (
								<img
									src={withBasePath(HERO_IMAGE_PATH)}
									alt="競艇レビュー用ヒーロー"
									style={heroImageStyle}
									onError={() => setHeroImageAvailable(false)}
								/>
							) : (
								<div style={heroFallbackStyle}>
									<span style={{ fontSize: "0.72rem", letterSpacing: "0.18em" }}>BOAT REVIEW</span>
									<span>public/review-page/hero に画像を配置してください</span>
								</div>
							)}
						</div>
					</div>

					<aside style={calendarPanelStyle}>
						<div style={sectionHeaderStyle}>
							<div>
								<p style={eyebrowStyle}>Review Calendar</p>
								<h2 style={sectionTitleStyle}>{formatMonthLabel(calendarMonth)}</h2>
							</div>
							<div style={buttonRowStyle}>
								<button type="button" style={secondaryButtonStyle} onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}>←</button>
								<button type="button" style={secondaryButtonStyle} onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}>→</button>
							</div>
						</div>
						<div style={dateGridStyle}>
							<button type="button" style={{ ...dateButtonStyle, background: selectedDate === operationalToday ? boatTheme.colors.navy : dateButtonStyle.background, color: selectedDate === operationalToday ? "#fff" : dateButtonStyle.color }} onClick={() => selectDate(operationalToday)}>今日<br />{operationalToday}</button>
							<button type="button" style={{ ...dateButtonStyle, background: selectedDate === operationalYesterday ? boatTheme.colors.navy : dateButtonStyle.background, color: selectedDate === operationalYesterday ? "#fff" : dateButtonStyle.color }} onClick={() => selectDate(operationalYesterday)}>昨日<br />{operationalYesterday}</button>
						</div>
						<div style={overviewGridStyle}>
							{[
								["Archive件数", `${archiveIndex.items.length}件`],
								["Summary件数", `${archiveIndex.items.filter((item) => item.summaryFile).length}件`],
								["データ源", sourceLabel],
							].map(([label, value]) => (
								<article key={label} style={summaryCardStyle}>
									<p style={summaryLabelStyle}>{label}</p>
									<p style={{ ...summaryValueStyle, fontSize: "0.92rem" }}>{value}</p>
								</article>
							))}
						</div>
						<div style={calendarGridStyle}>
							{WEEKDAY_LABELS.map((label) => <div key={label} style={{ textAlign: "center", color: boatTheme.colors.muted, fontWeight: 900, fontSize: "0.72rem" }}>{label}</div>)}
							{calendarCells.map((date) => {
								const isSelected = date === selectedDate;
								const isMonth = date.slice(0, 7) === calendarMonth;
								const hasData = selectableDateSet.has(date);
								return (
									<button
										key={date}
										type="button"
										disabled={date > operationalToday}
										onClick={() => selectDate(date)}
										style={{
											...calendarDayStyle,
											opacity: isMonth ? 1 : 0.36,
											background: isSelected ? boatTheme.colors.navy : hasData ? "rgba(235, 250, 255, 0.95)" : calendarDayStyle.background,
											color: isSelected ? "#fff" : calendarDayStyle.color,
											cursor: date > operationalToday ? "not-allowed" : "pointer",
										}}
									>
										{Number(date.slice(-2))}
										{hasData ? <span style={{ position: "absolute", left: "50%", bottom: 5, width: 5, height: 5, borderRadius: 999, background: isSelected ? "#fff" : boatTheme.colors.aquaDeep, transform: "translateX(-50%)" }} /> : null}
									</button>
								);
							})}
						</div>
						<p style={{ ...textStyle, fontSize: "0.78rem" }}>登録日: {monthRegisteredDates.length > 0 ? monthRegisteredDates.join(" / ") : "この月の保存ファイルは未登録"}</p>
					</aside>
				</section>

				<section style={panelStyle}>
					<div style={sectionHeaderStyle}>
						<div>
							<p style={eyebrowStyle}>Status Strip</p>
							<h2 style={sectionTitleStyle}>対象日とレビューソース</h2>
						</div>
						<div style={buttonRowStyle}>
							<button type="button" style={secondaryButtonStyle} onClick={refreshLiveData}>localStorage / generated JSON 再読み込み</button>
							{statusMessage ? <span style={chipStyle}>{statusMessage}</span> : null}
						</div>
					</div>
					<div style={overviewGridStyle}>
						{[
	["対象会場", `${metrics.venueCount}会場`],
	["投資", formatYen(metrics.investment)],
	["払戻", formatYen(metrics.payout)],
	["回収率", formatPercent(metrics.roi)],
].map(([label, value]) => (
							<article key={label} style={summaryCardStyle}>
								<p style={summaryLabelStyle}>{label}</p>
								<p style={summaryValueStyle}>{value}</p>
							</article>
						))}
					</div>
				</section>

				<section style={panelStyle}>
					<div style={sectionHeaderStyle}>
						<div>
							<p style={eyebrowStyle}>Venue Cards</p>
							<h2 style={sectionTitleStyle}>{mode === "archive" ? "保存した txt を会場ごとに開く" : "予想を保存した会場だけ振り返る"}</h2>
						</div>
						<p style={{ ...textStyle, fontSize: "0.82rem", textAlign: "right" }}>会場カードを押すと、予想全文・結果全文・summary全文が下の欄で切り替わります。</p>
					</div>
					{groups.length > 0 ? (
						<div style={venueRowsStyle}>
							{venueRows.map((row, rowIndex) => (
								<div
									key={`venue-row-${rowIndex}`}
									className="boat-review-venue-row"
									style={{ ...venueRowStyle, gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}
								>
									{row.map((group) => {
										const isSelected = selectedGroup?.key === group.key;
										const itemMetrics = getBoatReviewVenueMetrics(group);
											const archiveItem = archiveItemMap.get(group.key);
											const hasPredictionAsset = Boolean(group.races.some((entry) => entry.prediction?.predictionText?.trim()) || archiveItem?.predictionFile);
											const hasResultAsset = Boolean(group.races.some((entry) => entry.practiceResult || entry.race?.result) || archiveItem?.resultFile);
											const hasSummaryAsset = Boolean(summaryDraft && selectedGroup?.key === group.key ? summaryDraft !== "summary未登録" : archiveItem?.summaryFile || group.summaryFileText);
										return (
											<button
												key={group.key}
												type="button"
												className="boat-review-venue-card"
												onClick={() => setSelectedVenueKey(group.key)}
												style={{
													...venueCardStyle,
													border: isSelected ? "1px solid rgba(24, 115, 152, 0.68)" : venueCardStyle.border,
													background: isSelected
														? "radial-gradient(circle at 12% 0%, rgba(179, 238, 255, 0.72), transparent 40%), linear-gradient(150deg, rgba(232,250,255,0.99), rgba(245,255,252,0.97))"
														: venueCardStyle.background,
													boxShadow: isSelected ? "0 20px 38px rgba(17,64,92,0.14)" : venueCardStyle.boxShadow,
												}}
											>
												<div style={{ ...chipRowStyle, justifyContent: "space-between", alignItems: "center" }}>
													<strong style={{ color: boatTheme.colors.navy, fontSize: "1.08rem", lineHeight: 1.15 }}>{group.venueName}</strong>
														<span style={{ ...chipStyle, padding: "7px 10px", fontSize: "0.66rem", background: mode === "archive" ? "rgba(232, 224, 255, 0.84)" : "rgba(224, 242, 254, 0.88)" }}>{mode === "archive" ? "archive" : archiveItem ? "live + archive" : "live"}</span>
												</div>
												<p style={{ ...textStyle, fontSize: "0.72rem", lineHeight: 1.55, minHeight: "2.25em" }}>{group.date} / {group.title || "開催名確認中"}</p>
													<div style={chipRowStyle}>
														<span style={{ ...chipStyle, fontSize: "0.68rem", background: hasPredictionAsset ? "rgba(224, 242, 254, 0.9)" : "rgba(248, 250, 252, 0.9)" }}>prediction {hasPredictionAsset ? "あり" : "なし"}</span>
														<span style={{ ...chipStyle, fontSize: "0.68rem", background: hasResultAsset ? "rgba(224, 242, 254, 0.9)" : "rgba(248, 250, 252, 0.9)" }}>result {hasResultAsset ? "あり" : "なし"}</span>
														<span style={{ ...chipStyle, fontSize: "0.68rem", background: hasSummaryAsset ? "rgba(221, 252, 239, 0.92)" : "rgba(248, 250, 252, 0.9)" }}>summary {hasSummaryAsset ? "あり" : "なし"}</span>
													</div>
												<div style={metricGridStyle}>
													{[
															["予想", archiveItem?.predictionSizeBytes ? formatFileSize(archiveItem.predictionSizeBytes) : `${itemMetrics.predictionCount}R`],
															["結果", archiveItem?.resultSizeBytes ? formatFileSize(archiveItem.resultSizeBytes) : `${itemMetrics.resultCount}R`],
															["summary", archiveItem?.summarySizeBytes ? formatFileSize(archiveItem.summarySizeBytes) : itemMetrics.hasSummary ? "あり" : "なし"],
															["収支", formatSignedYen(itemMetrics.profit)],
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
							))}
						</div>
					) : (
						<p style={emptyStyle}>この日付の会場データは未登録です。今日・昨日は localStorage を優先し、過去日は public/data/reviews/index.json から txt を読み込みます。</p>
					)}
				</section>

				<section className="boat-review-copy-grid" style={workbenchGridStyle}>
					<div style={{ display: "grid", gap: "18px", minWidth: 0 }}>
						<section style={panelStyle}>
							<div style={sectionHeaderStyle}>
								<div>
									<p style={eyebrowStyle}>Prediction Copy</p>
									<h2 style={sectionTitleStyle}>予想まとめコピー</h2>
								</div>
								{selectedGroup ? <span style={chipStyle}>{selectedGroup.venueName} / {selectedGroup.races.length}R</span> : null}
							</div>
							<textarea style={textareaStyle} value={predictionText} readOnly />
							<div style={buttonRowStyle}>
								<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(predictionText, "予想まとめ")}>予想まとめをコピー</button>
								<button type="button" style={secondaryButtonStyle} onClick={() => selectedGroup && downloadText(getReviewFileName(selectedGroup.date, selectedGroup.venueSlug, "predictions"), predictionText)}>予想まとめを .txt ダウンロード</button>
							</div>
						</section>

						<section style={panelStyle}>
							<div style={sectionHeaderStyle}>
								<div>
									<p style={eyebrowStyle}>Result Copy</p>
									<h2 style={sectionTitleStyle}>結果まとめコピー</h2>
								</div>
								{selectedMetrics ? <span style={chipStyle}>収支 {formatSignedYen(selectedMetrics.profit)} / 回収率 {formatPercent(selectedMetrics.roi)}</span> : null}
							</div>
							<textarea style={textareaStyle} value={resultText} readOnly />
							<div style={buttonRowStyle}>
								<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(resultText, "結果まとめ")}>結果まとめをコピー</button>
								<button type="button" style={secondaryButtonStyle} onClick={() => selectedGroup && downloadText(getReviewFileName(selectedGroup.date, selectedGroup.venueSlug, "results"), resultText)}>結果まとめを .txt ダウンロード</button>
							</div>
						</section>
					</div>

					<section style={panelStyle}>
						<div style={sectionHeaderStyle}>
							<div>
								<p style={eyebrowStyle}>GPT Review Summary</p>
								<h2 style={sectionTitleStyle}>GPTレビュー貼り付け欄</h2>
							</div>
							{mode === "archive" ? <span style={chipStyle}>保存ファイル表示</span> : <span style={chipStyle}>localStorage下書き / archive fallback</span>}
						</div>
						<textarea
							style={summaryTextareaStyle}
							value={summaryDraft}
							onChange={(event) => handleSummaryChange(event.target.value)}
							readOnly={mode === "archive"}
							placeholder="ここにGPTレビューsummaryを貼り付けます。保存ファイルがある過去日は summary.txt を表示します。"
						/>
						<div style={buttonRowStyle}>
							<button type="button" style={primaryButtonStyle} onClick={() => void handleCopy(summaryDraft, "summary")}>summaryをコピー</button>
							<button type="button" style={secondaryButtonStyle} onClick={() => selectedGroup && downloadText(getReviewFileName(selectedGroup.date, selectedGroup.venueSlug, "summary"), summaryDraft)}>summaryを .txt ダウンロード</button>
							{mode === "live" ? <span style={chipStyle}>入力内容は会場ごとに自動保存</span> : null}
						</div>
					</section>
				</section>

				<style>{`

					body:has(.review-page-root) {
						background: #eaf8ff;
					}

					#root:has(.review-page-root) {
						position: relative;
						isolation: isolate;
					}

					#root:has(.review-page-root)::before {
						content: "";
						position: fixed;
						inset: 0;
						width: 100vw;
						height: 100vh;
						background-image:
							linear-gradient(180deg, rgba(241, 250, 255, 0.04), rgba(244, 250, 255, 0.16)),
							url("${REVIEW_PAGE_BACKGROUND_URL}");
						background-size: cover;
						background-position: center center;
						background-repeat: no-repeat;
						pointer-events: none;
						z-index: 0;
					}

					.review-page-root {
						position: relative;
						z-index: 1;
					}

					@media (max-width: 1380px) {
						.boat-review-venue-row {
							grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)) !important;
						}
					}
					@media (max-width: 1180px) {
						.boat-review-top,
						.boat-review-copy-grid {
							grid-template-columns: 1fr !important;
						}
						.boat-review-hero {
							grid-template-columns: 1fr !important;
						}
					}
					@media (max-width: 760px) {
						.boat-review-workbench {
							padding-inline: 4px !important;
						}
						.boat-review-venue-row {
							grid-template-columns: 1fr !important;
						}
					}
				`}</style>
				</div>
			</div>
		</PageShell>
	);
}
