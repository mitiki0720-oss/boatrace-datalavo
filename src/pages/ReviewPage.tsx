import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../components/layout/PageShell";
import { withBasePath } from "../lib/assetPath";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { getBoatOperationDate, resolveActiveBoatOperationDate, shiftBoatOperationDate } from "../lib/boatOperationDate";
import { loadBoatPredictionRecords } from "../lib/boatPredictionStorage";
import { loadBoatPracticeResultRecords } from "../lib/boatPracticeResultStorage";
import {
	buildBoatPredictionMonthlyFeedback,
	summarizeBoatPredictionMonthlyFeedback,
} from "../lib/boatPredictionMonthlyFeedback";
import {
	cleanupBoatVenueLocalStorage,
	getBoatLocalStorageUsageBytes,
	inspectBoatVenueLocalStorage,
	type BoatVenueStorageCleanupScope,
	type BoatVenueStorageTarget,
} from "../lib/boatLocalStorageMaintenance";
import {
	loadBoatVenueExtrasFeed,
	type BoatVenueExtraVenue,
	type BoatVenueExtrasFeed,
} from "../lib/boatVenueExtrasFeed";
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
	getBoatReviewVenueNameFromSlug,
	normalizeBoatPracticeResultList,
	normalizeBoatPredictionRecordList,
	type BoatReviewVenueGroup,
} from "../lib/boatReviewSummaryBuilder";
import {
	buildBoatReviewPagePerformance,
	buildBoatReviewVenuePerformance,
	type BoatReviewRacePerformance,
} from "../lib/boatReviewPerformanceMetrics";
import { resolveBoatVenueDayLabel } from "../lib/boatVenueDayLabel";
import type { BoatRaceItem, BoatTodayFeed } from "../lib/boatraceTypes";

type ReviewDataMode = "live" | "archive";

const HERO_IMAGE_PATH = "review-page/hero/review-hero-boat-summary-kurari-funako.png";
const REVIEW_PAGE_BACKGROUND_URL = withBasePath("review-page/backgrounds/review-page-bg-water-archive.png");

function formatYen(value: number): string {
	return `${value.toLocaleString("ja-JP")}円`;
}

function formatSignedYen(value: number): string {
	return `${value >= 0 ? "+" : ""}${formatYen(value)}`;
}

function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

function formatStorageBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}
	return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatVenueCardDate(date: string): string {
	const [, month, day] = date.split("-");
	return month && day ? `${Number(month)}/${Number(day)}` : date;
}

function getVenueStageLabel(group: BoatReviewVenueGroup): string {
	const races = group.races
		.map((entry) => entry.race)
		.filter((race): race is BoatRaceItem => Boolean(race));

	if (group.venue) {
		const resolved = resolveBoatVenueDayLabel(group.venue, races);
		if (resolved !== "日目未取得") {
			return resolved;
		}
	}

	const title = group.title ?? "";
	const matched = title.match(/(初日|2日目|3日目|4日目|5日目|6日目|最終日|準優日|優勝戦日)/);

	return matched?.[1] ?? "日目未取得";
}

function getVenueSessionLabel(group: BoatReviewVenueGroup): string {
	const title = group.title ?? "";

	if (title.includes("モーニング")) return "🐣 モーニング";
	if (title.includes("ナイター")) return "🌙 ナイター";
	if (title.includes("ミッドナイト")) return "🌃 ミッドナイト";
	if (title.includes("デイ")) return "☀️ デイ";

	return "";
}

const reviewSessionTextFieldNames = [
	"sessionLabel",
	"sessionType",
	"timeZoneLabel",
	"category",
	"session",
	"title",
	"seriesName",
	"eventName",
	"name",
] as const;

function readReviewSession(value: unknown): "morning" | "day" | "night" | "midnight" | null {
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").toLowerCase();
	if (normalized.includes("midnight") || normalized.includes("\u30df\u30c3\u30c9\u30ca\u30a4\u30c8")) return "midnight";
	if (normalized.includes("morning") || normalized.includes("\u30e2\u30fc\u30cb\u30f3\u30b0")) return "morning";
	if (normalized.includes("night") || normalized.includes("\u30ca\u30a4\u30bf\u30fc")) return "night";
	if (normalized.includes("day") || normalized.includes("\u30c7\u30a4")) return "day";
	return null;
}

function parseReviewRaceTimeMinutes(value: unknown) {
	if (typeof value !== "string") return null;
	const match = value.normalize("NFKC").match(/(\d{1,2})\s*:\s*(\d{2})/);
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 29 || minutes < 0 || minutes > 59) {
		return null;
	}
	return hours * 60 + minutes;
}

function getReviewRaceDisplayTimeMinutes(race: BoatRaceItem) {
	const raceRecord = race as unknown as Record<string, unknown>;
	for (const fieldName of ["deadlineTime", "deadline", "closeTime", "startTime", "time"]) {
		const minutes = parseReviewRaceTimeMinutes(raceRecord[fieldName]);
		if (minutes !== null) return minutes;
	}
	return null;
}

function getReviewGroupRaces(group: BoatReviewVenueGroup) {
	const venueRaces = group.venue?.races ?? [];
	if (venueRaces.length > 0) return venueRaces;
	return group.races.map((entry) => entry.race).filter((race): race is BoatRaceItem => Boolean(race));
}

function resolveReviewGroupSession(group: BoatReviewVenueGroup) {
	const venueSession = readReviewSession(group.venue?.session);
	if (venueSession) return venueSession;

	const venueRecord = (group.venue ?? {}) as unknown as Record<string, unknown>;
	let hasExplicitDay = false;
	for (const fieldName of reviewSessionTextFieldNames) {
		const session = readReviewSession(venueRecord[fieldName]);
		if (session && session !== "day") return session;
		if (session === "day") hasExplicitDay = true;
	}

	const times = getReviewGroupRaces(group)
		.map(getReviewRaceDisplayTimeMinutes)
		.filter((minutes): minutes is number => minutes !== null);
	const firstRaceMinutes = times.length > 0 ? Math.min(...times) : null;
	const finalRaceMinutes = times.length > 0 ? Math.max(...times) : null;

	if (finalRaceMinutes !== null && finalRaceMinutes >= 22 * 60) return "midnight";
	if (hasExplicitDay) return "day";
	if (finalRaceMinutes !== null && finalRaceMinutes >= 17 * 60) return "night";
	if (firstRaceMinutes !== null && firstRaceMinutes < 10 * 60 && finalRaceMinutes !== null && finalRaceMinutes <= 15 * 60) {
		return "morning";
	}
	return finalRaceMinutes !== null ? "day" : null;
}

function getReviewSessionSortOrder(session: ReturnType<typeof resolveReviewGroupSession>) {
	switch (session) {
		case "morning":
			return 0;
		case "day":
			return 1;
		case "night":
			return 2;
		case "midnight":
			return 3;
		default:
			return 9;
	}
}

function getReviewGroupFirstRaceMinutes(group: BoatReviewVenueGroup) {
	const times = getReviewGroupRaces(group)
		.map(getReviewRaceDisplayTimeMinutes)
		.filter((minutes): minutes is number => minutes !== null);
	return times.length > 0 ? Math.min(...times) : null;
}

function sortLiveReviewGroups(groups: BoatReviewVenueGroup[]) {
	return groups
		.map((group, originalIndex) => ({
			group,
			originalIndex,
			sessionOrder: getReviewSessionSortOrder(resolveReviewGroupSession(group)),
			firstRaceMinutes: getReviewGroupFirstRaceMinutes(group),
		}))
		.sort((left, right) => {
			if (left.sessionOrder !== right.sessionOrder) return left.sessionOrder - right.sessionOrder;
			if (left.firstRaceMinutes === null && right.firstRaceMinutes !== null) return 1;
			if (left.firstRaceMinutes !== null && right.firstRaceMinutes === null) return -1;
			if (left.firstRaceMinutes !== null && right.firstRaceMinutes !== null && left.firstRaceMinutes !== right.firstRaceMinutes) {
				return left.firstRaceMinutes - right.firstRaceMinutes;
			}
			return left.originalIndex - right.originalIndex;
		})
		.map(({ group }) => group);
}

function formatOptionalYen(value: number, available: boolean): string {
	return available ? formatYen(value) : "--";
}

function formatOptionalSignedYen(value: number, available: boolean): string {
	return available ? formatSignedYen(value) : "--";
}

function formatOptionalPercent(value: number | null): string {
	return value === null ? "--" : formatPercent(value);
}

function getRaceStatusPresentation(race: BoatReviewRacePerformance) {
	const presentations = {
		hit: { label: "🎯 的中", color: "#137a63", background: "#e8f8f2" },
		miss: { label: "× 不的中", color: "#a53e5a", background: "#fff0f4" },
		pending: { label: "⏳ 結果待ち", color: "#687080", background: "#f3f4f6" },
		refund: { label: "↩ 返還", color: "#286f91", background: "#eaf7fc" },
		cancelled: { label: "⛔ 中止", color: "#6b7280", background: "#f1f3f6" },
		"parse-warning": { label: "⚠ 予想解析注意", color: "#a45b16", background: "#fff3e6" },
		unpredicted: { label: "予想なし", color: "#6b7280", background: "#f3f4f6" },
	} as const;
	return presentations[race.status];
}

function ReviewStatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
	return (
		<article className="boat-review-stat-card">
			<span>{label}</span>
			<strong>{value}</strong>
			<small>{sub}</small>
		</article>
	);
}

function ReviewMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
	return (
		<div className="boat-review-metric">
			<span>{label}</span>
			<strong>{value}</strong>
			<small>{sub}</small>
		</div>
	);
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

function getReviewFileName(date: string, venueSlug: string, suffix: "predictions" | "results" | "summary"): string {
	const ext = "txt";
	return `${date}-${venueSlug}-${suffix}.${ext}`;
}

function formatMissingRaceNos(raceNos: number[]): string {
	if (raceNos.length === 12 && raceNos.every((raceNo, index) => raceNo === index + 1)) return "1R〜12R";
	return raceNos.map((raceNo) => `${raceNo}R`).join("・");
}

function formatRaceNos(raceNos: number[]): string {
	return raceNos.length > 0 ? raceNos.map((raceNo) => `${raceNo}R`).join(", ") : "なし";
}

type ReviewExtraRecord = Record<string, unknown>;

function toReviewRecordArray(value: unknown): ReviewExtraRecord[] {
	if (Array.isArray(value)) {
		return value.filter((item): item is ReviewExtraRecord => Boolean(item) && typeof item === "object");
	}
	if (value && typeof value === "object") {
		return Object.values(value as Record<string, unknown>).filter((item): item is ReviewExtraRecord => Boolean(item) && typeof item === "object");
	}
	return [];
}

function readReviewString(value: unknown): string {
	return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function normalizeReviewVenueName(value: unknown): string {
	return readReviewString(value).normalize("NFKC").replace(/\s+/g, "");
}

function findReviewVenueExtra(feed: BoatVenueExtrasFeed | null, group: BoatReviewVenueGroup | undefined): BoatVenueExtraVenue | null {
	if (!feed || !group || feed.date !== group.date) {
		return null;
	}
	const venues = toReviewRecordArray(feed.venues) as BoatVenueExtraVenue[];
	const venueCode = readReviewString(group.venueCode || group.venue?.venueCode);
	if (venueCode) {
		const matched = venues.find((venue) => readReviewString(venue.venueCode) === venueCode);
		if (matched) return matched;
	}
	const venueName = normalizeReviewVenueName(group.venueName || group.venue?.venueName);
	return venues.find((venue) => normalizeReviewVenueName(venue.venueName || venue.venue || venue.name) === venueName) ?? null;
}

export function ReviewPage() {
	const operationalToday = useMemo(() => getBoatOperationDate(), []);
	const operationalYesterday = useMemo(() => shiftBoatOperationDate(operationalToday, -1), [operationalToday]);
	const [selectedDate, setSelectedDate] = useState(operationalToday);
	const [archiveIndex, setArchiveIndex] = useState<BoatReviewArchiveIndex>({ items: [] });
	const [todayFeed, setTodayFeed] = useState<BoatTodayFeed | null>(null);
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [predictionPayload, setPredictionPayload] = useState(() => loadBoatPredictionRecords());
	const [practicePayload, setPracticePayload] = useState(() => loadBoatPracticeResultRecords());
	const [archiveGroups, setArchiveGroups] = useState<BoatReviewVenueGroup[]>([]);
	const [selectedVenueKey, setSelectedVenueKey] = useState("");
	const [statusMessage, setStatusMessage] = useState("");
	const [heroImageAvailable, setHeroImageAvailable] = useState(true);
	const [storageUsageBytes, setStorageUsageBytes] = useState(() => getBoatLocalStorageUsageBytes());
	const [maintenanceRevision, setMaintenanceRevision] = useState(0);
	const [selectedStorageInspection, setSelectedStorageInspection] = useState<ReturnType<typeof inspectBoatVenueLocalStorage> | null>(null);

	useEffect(() => {
		let active = true;
		Promise.all([
			loadBoatTodayRaceDetailsFeed(),
			loadBoatReviewArchiveIndex(),
			loadBoatVenueExtrasFeed(),
		]).then(([feed, index, venueExtras]) => {
			if (!active) return;
			setTodayFeed(feed);
			setArchiveIndex(index);
			setVenueExtrasFeed(venueExtras);
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
	const activeLiveDate = useMemo(() => resolveActiveBoatOperationDate(todayFeed?.date), [todayFeed?.date]);
	const liveDateSet = useMemo(() => new Set([activeLiveDate].filter(Boolean) as string[]), [activeLiveDate]);
	const selectableDates = useMemo(() => Array.from(new Set([
		operationalToday,
		operationalYesterday,
		activeLiveDate,
		...archiveDates,
	].filter((date): date is string => Boolean(date) && date <= operationalToday))).sort((left, right) => right.localeCompare(left)), [activeLiveDate, archiveDates, operationalToday, operationalYesterday]);
	const mode: ReviewDataMode = selectedDate < operationalToday ? "archive" : liveDateSet.has(selectedDate) ? "live" : "archive";
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
		const uniqueArchiveGroups = Array.from(new Map(archiveGroups.map((group) => [group.key, group])).values());
		if (mode === "archive") {
			return uniqueArchiveGroups;
		}

		const hasArchivePrediction = (group: BoatReviewVenueGroup) =>
			Boolean(archiveItemMap.get(group.key)?.predictionFile);

		const mergedGroups = [...liveGroups];

		for (const archiveGroup of uniqueArchiveGroups) {
			if (hasArchivePrediction(archiveGroup) && !mergedGroups.some((group) => group.key === archiveGroup.key)) {
				mergedGroups.push(archiveGroup);
			}
		}

		return sortLiveReviewGroups(mergedGroups);
	}, [archiveGroups, archiveItemMap, liveGroups, mode]);
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
	const selectedStorageTarget = useMemo<BoatVenueStorageTarget | null>(() => selectedGroup ? ({
		date: selectedDate,
		venueSlug: selectedGroup.venueSlug,
		venueName: selectedGroup.venueName,
		venueCode: selectedGroup.venueCode || selectedGroup.venue?.venueCode,
	}) : null, [selectedDate, selectedGroup]);

	useEffect(() => {
		setSelectedStorageInspection(
			selectedStorageTarget ? inspectBoatVenueLocalStorage(selectedStorageTarget) : null,
		);
	}, [selectedStorageTarget, maintenanceRevision]);

	useEffect(() => {
		if (!selectedGroup) {
			setSelectedVenueKey("");
			return;
		}
		if (mode === "live" && !todayFeed && !selectedVenueKey) {
			return;
		}
		if (!groups.some((group) => group.key === selectedVenueKey)) {
			setSelectedVenueKey(selectedGroup.key);
		}
	}, [groups, mode, selectedGroup, selectedVenueKey, todayFeed]);

	const metrics = useMemo(() => buildBoatReviewPagePerformance(groups), [groups]);
	const selectedMetrics = useMemo(
		() => selectedGroup ? buildBoatReviewVenuePerformance(selectedGroup) : null,
		[selectedGroup],
	);
	const selectedVenueExtra = useMemo(
		() => findReviewVenueExtra(venueExtrasFeed, selectedLiveGroup),
		[selectedLiveGroup, venueExtrasFeed],
	);
	const monthlyFeedback = useMemo(() => groups.flatMap((group) => group.races.flatMap((entry) =>
		entry.prediction ? [buildBoatPredictionMonthlyFeedback({
			prediction: entry.prediction,
			practiceResult: entry.practiceResult,
		})] : [],
	)), [groups]);
	const monthlyFeedbackSummary = useMemo(
		() => summarizeBoatPredictionMonthlyFeedback(monthlyFeedback),
		[monthlyFeedback],
	);
	const selectedMonthlyFeedback = useMemo(() => selectedGroup?.races.flatMap((entry) =>
		entry.prediction ? [{
			raceNo: entry.raceNo,
			feedback: buildBoatPredictionMonthlyFeedback({
				prediction: entry.prediction,
				practiceResult: entry.practiceResult,
			}),
		}] : [],
	) ?? [], [selectedGroup]);
	const monthlyReferenceMonths = useMemo(() => Array.from(new Set(monthlyFeedback
		.map((item) => item.monthlyReviewContext?.referenceMonth)
		.filter((month): month is string => Boolean(month)))), [monthlyFeedback]);
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
				return buildBoatResultSummaryText(selectedLiveGroup, { venueExtra: selectedVenueExtra });
			}
		}

		return selectedArchiveGroup ? buildBoatResultSummaryText(selectedArchiveGroup) : "結果ファイル未登録";
	}, [mode, selectedArchiveGroup, selectedGroup, selectedLiveGroup, selectedVenueExtra]);
	const modeLabel = mode === "archive" ? "ARCHIVE FILE" : selectedDate === operationalToday ? "TODAY LIVE" : "LIVE";
	const sourceLabel = mode === "archive"
		? "archive txt"
		: "today localStorage";

	const selectDate = (date: string) => {
		if (date > operationalToday) return;
		setSelectedDate(date);
		setStatusMessage("");
	};

	const refreshLiveData = () => {
		setPredictionPayload(loadBoatPredictionRecords());
		setPracticePayload(loadBoatPracticeResultRecords());
		setStorageUsageBytes(getBoatLocalStorageUsageBytes());
		setMaintenanceRevision((value) => value + 1);
		void loadBoatTodayRaceDetailsFeed().then(setTodayFeed);
		void loadBoatVenueExtrasFeed().then(setVenueExtrasFeed);
		setStatusMessage("今日・昨日のlocalStorageを優先しつつ、必要なら archive も再読み込みしました");
	};

	const handleCopy = async (text: string, label: string) => {
		const ok = await copyText(text);
		setStatusMessage(ok ? `${label}をコピーしました` : `${label}のコピーに失敗しました`);
	};

	const handleVenueStorageCleanup = (scope: BoatVenueStorageCleanupScope) => {
		if (!selectedStorageTarget || !selectedGroup) return;

		const inspection = inspectBoatVenueLocalStorage(selectedStorageTarget);
		const scopeCount = scope === "summary-draft"
			? inspection.counts.summaryDrafts
			: scope === "race-records"
				? inspection.counts.predictions + inspection.counts.practiceResults + inspection.counts.johnsonPredictions
				: inspection.counts.total;
		if (scopeCount <= 0) {
			setStatusMessage(`${selectedGroup.venueName}の選択対象は0件です`);
			return;
		}

		const detail = [
			`summary下書き ${scope === "race-records" ? 0 : inspection.counts.summaryDrafts}件`,
			`予想 ${scope === "summary-draft" ? 0 : inspection.counts.predictions}件`,
			`実践結果 ${scope === "summary-draft" ? 0 : inspection.counts.practiceResults}件`,
			`ジョンソン ${scope === "summary-draft" ? 0 : inspection.counts.johnsonPredictions}件`,
		].join(" / ");
		const warningReasons = [
			selectedDate === operationalToday ? "今日のデータ" : "",
			selectedDate === operationalYesterday ? "昨日のデータ" : "",
			inspection.hasPayoutPending ? "払戻待ちあり" : "",
			inspection.hasMemo ? "メモあり" : "",
		].filter(Boolean);

		if (warningReasons.length > 0) {
			const confirmationText = `${selectedDate} ${selectedGroup.venueName} 整理`;
			const entered = window.prompt(
				`要注意: ${warningReasons.join("・")}\n${selectedDate} / ${selectedGroup.venueName} のブラウザ保存だけを整理します。他会場は削除しません。\n削除対象: ${detail}\narchive txtとGitHub上のファイルは変更しません。\n続行するには「${confirmationText}」と入力してください。`,
			);
			if (entered !== confirmationText) {
				setStatusMessage("整理を中止しました");
				return;
			}
		} else if (!window.confirm(
			`${selectedDate} / ${selectedGroup.venueName} のブラウザ保存だけを整理します。他会場は削除しません。\n削除対象: ${detail}\narchive txtとGitHub上のファイルは変更しません。よろしいですか？`,
		)) {
			setStatusMessage("整理を中止しました");
			return;
		}

		const result = cleanupBoatVenueLocalStorage(selectedStorageTarget, scope);
		setPredictionPayload(loadBoatPredictionRecords());
		setPracticePayload(loadBoatPracticeResultRecords());
		setStorageUsageBytes(result.usageBytesAfter);
		setMaintenanceRevision((revision) => revision + 1);
		setStatusMessage(result.ok
			? `${selectedGroup.venueName}を${result.removedCount}件整理しました（${formatStorageBytes(result.usageBytesBefore)} → ${formatStorageBytes(result.usageBytesAfter)}）`
			: `${selectedGroup.venueName}の整理中に保存エラーが発生しました`);
	};

	return (
		<PageShell eyebrow="BOAT REVIEW" title="BOAT REVIEW WORKBENCH" description="予想と公式結果を会場・レース単位で照合します。" contentMaxWidth="2040px" contentPaddingInline="24px" heroMaxWidth="2040px" hideHero>
			<div className="review-page-root">
				<main className="boat-review-workbench">
					<section className="boat-review-top-grid">
						<article className="boat-review-hero-panel">
							<div className="boat-review-hero-copy">
								<p className="boat-review-eyebrow">REVIEW ARCHIVE LOUNGE</p>
								<h1>今日の予想と結果を、次の一手につなげる</h1>
								<p>予想・公式結果・保存済みarchiveを同じレース単位で照合し、結果待ちを実績から分離して振り返ります。</p>
								<div className="boat-review-chip-row">
									<span>{modeLabel}</span>
									<span>選択日 {selectedDate}</span>
									<span>{sourceLabel}</span>
								</div>
								<div className="boat-review-hero-stats">
									<ReviewStatCard label="OPERATION DAY" value={selectedDate.replace(/-/g, "/")} sub="JST運用日" />
									<ReviewStatCard label="TARGETS" value={`${metrics.venueCount}会場 / ${metrics.targetRaceCount}R`} sub="実在するレース番号で集計" />
									<ReviewStatCard label="PERFORMANCE" value={metrics.financialRaceCount > 0 ? formatOptionalSignedYen(metrics.profit, true) : "--"} sub={`${metrics.hitCount}的中 / ${metrics.settledPredictionRaceCount}照合`} />
									<ReviewStatCard label="MODE" value={mode === "live" ? "MERGED SOURCES" : "FILE ARCHIVE"} sub="公式結果を優先" />
								</div>
							</div>
							<div className="boat-review-hero-image">
								{heroImageAvailable ? <img src={withBasePath(HERO_IMAGE_PATH)} alt="競艇レビュー用ヒーロー" onError={() => setHeroImageAvailable(false)} /> : <strong>BOAT REVIEW</strong>}
							</div>
						</article>

						<aside className="boat-review-workbench-card">
							<p className="boat-review-eyebrow">REVIEW WORKBENCH</p>
							<h2>今日の結果整理</h2>
							<p className="boat-review-muted">会場・R番号の差分を先に確認してから、コピー素材を使えます。</p>
							<div className="boat-review-workbench-grid">
								{[
									["対象日", selectedDate], ["読込モード", mode === "live" ? "LIVE" : "ARCHIVE"],
									["対象会場", `${metrics.venueCount}会場`], ["対象R", `${metrics.targetRaceCount}R`],
									["予想R", `${metrics.predictionRaceCount}R`], ["結果R", `${metrics.officialResultCount}R`],
									["結果待ち", `${metrics.pendingRaceCount}R`], ["R不一致", metrics.raceSetsMatch ? "なし" : `${metrics.missingPredictionRaceCount + metrics.missingResultRaceCount}件`],
								].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
							</div>
							<div className="boat-review-workbench-notes">
								<article><strong>コピー素材</strong><span>予想・結果まとめコピー / TXT保存 / R対応確認</span></article>
								<article><strong>保護ルール</strong><span>archive非変更 / production data非変更 / fake補完禁止</span></article>
							</div>
							<div className="boat-review-date-selector">
								<div><button type="button" onClick={() => selectDate(operationalToday)}>今日</button><button type="button" onClick={() => selectDate(operationalYesterday)}>昨日</button></div>
								<label><span>保存日</span><select value={selectedDate} onChange={(event) => selectDate(event.target.value)}>{selectableDates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label>
							</div>
							<button type="button" className="boat-review-secondary" onClick={refreshLiveData}>データを再読み込み</button>
							{statusMessage ? <p className="boat-review-status">{statusMessage}</p> : null}
						</aside>
					</section>

					<section className="boat-review-panel boat-review-performance">
							<p className="boat-review-eyebrow">PERFORMANCE</p>
							<div className="boat-review-section-heading"><h2>実予想成績</h2><span>pendingは実績に含めません</span></div>
							<div className="boat-review-performance-grid">
								<ReviewMetric label="予想R" value={`${metrics.predictionRaceCount}R`} sub={`対象 ${metrics.targetRaceCount}R`} />
								<ReviewMetric label="結果確定R" value={`${metrics.officialResultCount}R`} sub={`予想照合 ${metrics.settledPredictionRaceCount}R`} />
								<ReviewMetric label="的中R" value={`${metrics.hitCount}R`} sub={`評価対象 ${metrics.evaluatedRaceCount}R`} />
								<ReviewMetric label="投資" value={formatOptionalYen(metrics.investment, metrics.financialRaceCount > 0)} sub="確定した購入実績のみ" />
								<ReviewMetric label="払戻" value={formatOptionalYen(metrics.payout, metrics.financialRaceCount > 0)} sub="確定払戻のみ" />
								<ReviewMetric label="収支" value={formatOptionalSignedYen(metrics.profit, metrics.financialRaceCount > 0)} sub="払戻 - 投資" />
								<ReviewMetric label="的中率" value={formatOptionalPercent(metrics.hitRate)} sub="返還・中止を除外" />
								<ReviewMetric label="回収率" value={formatOptionalPercent(metrics.roi)} sub="確定実績のみ" />
							</div>
					</section>

					<section className="boat-review-panel boat-review-venues-panel">
						<div className="boat-review-section-heading">
							<div><p className="boat-review-eyebrow">VENUE CARDS</p><h2>会場別レビュー</h2></div>
							<span>モーニング → デイ → ナイター → ミッドナイト順</span>
						</div>
						{groups.length > 0 ? <div className="review-venue-grid">
							{groups.map((group) => {
								const itemMetrics = buildBoatReviewVenuePerformance(group);
								const isSelected = selectedGroup?.key === group.key;
								const sessionLabel = getVenueSessionLabel(group);
								return <button key={group.key} type="button" className="boat-review-venue-card" data-selected={isSelected} onClick={() => setSelectedVenueKey(group.key)}>
									<div className="boat-review-venue-head"><div><span>{formatVenueCardDate(group.date)}</span><strong>{group.venueName}</strong><small>{group.title || `${group.venueName} 出走表一覧`}</small></div><div><span>{getVenueStageLabel(group)}</span>{sessionLabel ? <small>{sessionLabel}</small> : null}</div></div>
									<div className="boat-review-venue-statuses"><span>{itemMetrics.predictionRaceCount > 0 ? "予想あり" : "予想未登録"}</span><span>{itemMetrics.officialResultCount > 0 ? "結果あり" : "結果待ち"}</span>{itemMetrics.missingPredictionRaceNos.length || itemMetrics.missingResultRaceNos.length ? <span data-warning="true">R不一致</span> : <span data-ready="true">R一致</span>}{itemMetrics.parseWarningCount > 0 ? <span data-warning="true">解析注意 {itemMetrics.parseWarningCount}R</span> : null}</div>
									<div className="boat-review-venue-metrics">
										<ReviewMetric label="的中" value={`${itemMetrics.hitCount}/${itemMetrics.evaluatedRaceCount}R`} sub="評価対象" />
										<ReviewMetric label="実収支" value={formatOptionalSignedYen(itemMetrics.profit, itemMetrics.financialRaceCount > 0)} sub="確定実績" />
										<ReviewMetric label="実回収率" value={formatOptionalPercent(itemMetrics.roi)} sub="確定実績" />
										<ReviewMetric label="結果確定" value={`${itemMetrics.officialResultCount}/${itemMetrics.targetRaceCount}R`} sub={`${itemMetrics.pendingRaceCount}R待ち`} />
									</div>
								</button>;
							})}
						</div> : <p className="boat-review-empty">この日付の会場データは未登録です。</p>}
					</section>

					{selectedGroup && selectedMetrics ? <>
						<section className="boat-review-panel boat-review-detail">
							<div className="boat-review-section-heading">
								<div><p className="boat-review-eyebrow">SELECTED VENUE</p><h2>{selectedGroup.venueName} / {formatVenueCardDate(selectedGroup.date)}</h2></div>
								<div className="boat-review-chip-row"><span>対象 {selectedMetrics.targetRaceCount}R</span><span>予想 {selectedMetrics.predictionRaceCount}R</span><span>結果 {selectedMetrics.officialResultCount}R</span></div>
							</div>
							<div className="boat-review-readiness">
								<span>予想不足: {selectedMetrics.missingPredictionRaceNos.length ? formatMissingRaceNos(selectedMetrics.missingPredictionRaceNos) : "なし"}</span>
								<span>結果待ち: {selectedMetrics.missingResultRaceNos.length ? formatMissingRaceNos(selectedMetrics.missingResultRaceNos) : "なし"}</span>
								{selectedMetrics.parseWarningCount > 0 ? <strong>解析警告 {selectedMetrics.parseWarningCount}R</strong> : <strong>parse OK</strong>}
							</div>
							<div className="boat-review-race-grid">
								{selectedMetrics.races.map((race) => {
									const status = getRaceStatusPresentation(race);
									const hasFinancial = race.investment !== null;
									return <article key={race.raceNo} className="boat-review-race-card">
										<div><strong>{race.raceNo}R</strong><span style={{ color: status.color, background: status.background }}>{status.label}</span></div>
										<dl><div><dt>着順</dt><dd>{race.finishOrder ?? "--"}</dd></div><div><dt>決まり手</dt><dd>{race.kimarite ?? "--"}</dd></div><div><dt>投資</dt><dd>{hasFinancial ? formatYen(race.investment ?? 0) : "--"}</dd></div><div><dt>払戻</dt><dd>{hasFinancial ? formatYen(race.payout ?? 0) : "--"}</dd></div><div><dt>収支</dt><dd>{hasFinancial ? formatSignedYen(race.profit ?? 0) : "--"}</dd></div></dl>
									</article>;
								})}
							</div>
						</section>

						<section className="boat-review-panel boat-review-copy-material">
							<div className="boat-review-section-heading"><div><p className="boat-review-eyebrow">COPY MATERIAL</p><h2>会場ごとのエクスポート素材</h2></div><span>本文は内部生成し、コピー / TXTで出力します</span></div>
							<div className="boat-review-copy-summary-grid">
								<ReviewMetric label="対象会場" value={`${selectedGroup.venueName} / ${formatVenueCardDate(selectedGroup.date)}`} sub="選択中" />
								<ReviewMetric label="対象R数" value={`${selectedMetrics.targetRaceCount}R`} sub="actual race set" />
								<ReviewMetric label="R対応" value={selectedMetrics.missingPredictionRaceNos.length === 0 && selectedMetrics.missingResultRaceNos.length === 0 ? "予想・結果一致" : "要確認"} sub="R番号で照合" />
							</div>
							<div className="boat-review-copy-statuses">{selectedMetrics.races.map((race) => { const status = getRaceStatusPresentation(race); return <span key={race.raceNo} style={{ color: status.color, background: status.background }}>{race.raceNo}R・{status.label}</span>; })}</div>
							<div className="boat-review-copy-list">
								<article className="boat-review-copy-card"><div><span>PREDICTION COPY</span><strong>予想まとめをコピー <em>({selectedMetrics.predictionRaceCount}/{selectedMetrics.targetRaceCount})</em></strong><small>{selectedMetrics.missingPredictionRaceNos.length ? `未入力: ${formatMissingRaceNos(selectedMetrics.missingPredictionRaceNos)}` : "全Rあり"}</small></div><div><button type="button" onClick={() => void handleCopy(predictionText, "予想まとめ")}>コピー</button><button type="button" onClick={() => downloadText(getReviewFileName(selectedGroup.date, selectedGroup.venueSlug, "predictions"), predictionText)}>TXT</button></div></article>
								<article className="boat-review-copy-card"><div><span>RESULT COPY</span><strong>結果まとめをコピー <em>({selectedMetrics.officialResultCount}/{selectedMetrics.targetRaceCount})</em></strong><small>{selectedMetrics.missingResultRaceNos.length ? `未取得: ${formatMissingRaceNos(selectedMetrics.missingResultRaceNos)}` : "全Rあり"}</small></div><div><button type="button" onClick={() => void handleCopy(resultText, "結果まとめ")}>コピー</button><button type="button" onClick={() => downloadText(getReviewFileName(selectedGroup.date, selectedGroup.venueSlug, "results"), resultText)}>TXT</button></div></article>
							</div>
							<div className={selectedMetrics.missingPredictionRaceNos.length === 0 && selectedMetrics.missingResultRaceNos.length === 0 ? "boat-review-r-match" : "boat-review-r-match boat-review-r-match-warning"}>
								<strong>{selectedMetrics.missingPredictionRaceNos.length === 0 && selectedMetrics.missingResultRaceNos.length === 0 ? "予想と結果のRが一致" : "予想と結果のRを確認"}</strong>
								<span>予想R: {formatRaceNos(selectedMetrics.predictionRaceNos)}</span><span>結果R: {formatRaceNos(selectedMetrics.resultRaceNos)}</span>
								{selectedMetrics.missingPredictionRaceNos.length ? <span>予想不足: {formatMissingRaceNos(selectedMetrics.missingPredictionRaceNos)}</span> : null}{selectedMetrics.missingResultRaceNos.length ? <span>結果不足: {formatMissingRaceNos(selectedMetrics.missingResultRaceNos)}</span> : null}
							</div>
						</section>

						<details className="boat-review-panel boat-review-monthly-hint">
							<summary>MONTHLY FEEDBACK / {monthlyReferenceMonths.length ? monthlyReferenceMonths.join(" / ") : "記録なし"} / 対象 {monthlyFeedbackSummary.trackedCount}R</summary>
							<div>{selectedMonthlyFeedback.length ? selectedMonthlyFeedback.map(({ raceNo, feedback }) => <span key={feedback.raceKey}>{raceNo}R: {feedback.snapshotStatus === "legacy" ? "記録なし" : feedback.snapshotStatus === "unavailable" ? "参照未取得" : `${feedback.monthlyReviewContext?.focusLabel ?? "Focus未取得"} / ${feedback.settlementOutcome === "pending" ? "結果待ち" : feedback.observedOutcome}`}</span>) : <span>選択会場に保存済み予想はありません。</span>}</div>
						</details>
					</> : null}

					<details className="boat-review-panel boat-review-maintenance">
						<summary>Local Storage Maintenance / {formatStorageBytes(storageUsageBytes)}</summary>
						{selectedGroup && selectedStorageInspection ? <div className="boat-review-maintenance-body">
							<p>対象: {selectedDate} / {selectedGroup.venueName}。削除対象は選択中の1会場だけです。他会場、archive txt、GitHubファイルは変更しません。</p>
							<div className="boat-review-chip-row"><span>summary {selectedStorageInspection.counts.summaryDrafts}件</span><span>予想 {selectedStorageInspection.counts.predictions}件</span><span>実践結果 {selectedStorageInspection.counts.practiceResults}件</span><span>ジョンソン {selectedStorageInspection.counts.johnsonPredictions}件</span>{selectedStorageInspection.hasPayoutPending ? <span>払戻待ちあり</span> : null}{selectedStorageInspection.hasMemo ? <span>メモあり</span> : null}</div>
							<div className="boat-review-maintenance-actions">
								<button type="button" onClick={() => handleVenueStorageCleanup("summary-draft")} disabled={selectedStorageInspection.counts.summaryDrafts <= 0}>summary下書きを整理</button>
								<button type="button" onClick={() => handleVenueStorageCleanup("race-records")} disabled={selectedStorageInspection.counts.predictions + selectedStorageInspection.counts.practiceResults + selectedStorageInspection.counts.johnsonPredictions <= 0}>予想・実践結果・ジョンソンを整理</button>
								<button type="button" onClick={() => handleVenueStorageCleanup("all")} disabled={selectedStorageInspection.counts.total <= 0}>選択会場を全部整理</button>
							</div>
						</div> : <p>整理する日付と会場を選択してください。</p>}
					</details>
				</main>

				<style>{`
					body:has(.review-page-root){background:#f6f8fc}.review-page-root{min-height:100vh;background:linear-gradient(180deg,rgba(255,255,255,.82),rgba(248,244,252,.9) 44%,rgba(241,248,252,.92)),url("${REVIEW_PAGE_BACKGROUND_URL}") center top/cover fixed;color:#111827}.boat-review-workbench{width:100%;max-width:2040px;margin:0 auto;padding:18px 24px 96px;box-sizing:border-box;display:grid;gap:22px}.boat-review-top-grid{display:grid;grid-template-columns:minmax(0,1.18fr) minmax(360px,460px);gap:22px}.boat-review-hero-panel,.boat-review-panel,.boat-review-workbench-card{min-width:0;border:1px solid rgba(223,210,245,.96);background:rgba(255,255,255,.96);box-shadow:0 22px 48px rgba(35,30,68,.07)}.boat-review-hero-panel{min-height:510px;border-radius:36px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(360px,.95fr);overflow:hidden}.boat-review-hero-copy{min-width:0;padding:32px;display:flex;flex-direction:column;justify-content:center;gap:16px}.boat-review-eyebrow{margin:0;color:#8a6bc7;font-size:10px;font-weight:900;letter-spacing:.18em}.boat-review-hero-copy h1{margin:0;max-width:680px;font-size:clamp(32px,3vw,50px);line-height:1.12;font-weight:900;letter-spacing:0;overflow-wrap:anywhere}.boat-review-hero-copy>p:not(.boat-review-eyebrow){margin:0;max-width:650px;color:#626b79;line-height:1.9}.boat-review-hero-image{min-width:0;min-height:420px;display:flex;align-items:flex-end;justify-content:center;background:linear-gradient(150deg,#f5effd,#fff5f8 55%,#eef9fc);overflow:hidden}.boat-review-hero-image img{display:block;width:100%;max-width:100%;height:100%;max-height:500px;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 22px 26px rgba(95,75,145,.14))}.boat-review-chip-row{display:flex;flex-wrap:wrap;gap:8px}.boat-review-chip-row>span,.boat-review-status{display:inline-flex;max-width:100%;width:fit-content;border:1px solid #e2d7f2;background:#faf7ff;color:#695396;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;overflow-wrap:anywhere}.boat-review-hero-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.boat-review-stat-card,.boat-review-metric{min-width:0;border:1px solid #e4daf2;background:linear-gradient(180deg,#fff,#f8f4fc);border-radius:18px;padding:12px;display:grid;gap:5px}.boat-review-stat-card span,.boat-review-metric span{color:#8a72b8;font-size:9px;font-weight:900;letter-spacing:.12em;overflow-wrap:anywhere}.boat-review-stat-card strong{font-size:22px;overflow-wrap:anywhere}.boat-review-stat-card small,.boat-review-metric small{color:#707887;line-height:1.45;overflow-wrap:anywhere}.boat-review-workbench-card{border-radius:32px;padding:20px;display:grid;gap:14px;align-content:start;background:linear-gradient(180deg,#fff,#f8f4fc 60%,#fff7f9)}.boat-review-workbench-card h2,.boat-review-panel h2{margin:0;font-size:25px}.boat-review-muted{margin:0;color:#697180;line-height:1.7;font-size:13px}.boat-review-workbench-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.boat-review-workbench-grid>div{min-width:0;border:1px solid #e5dcef;background:#fff;border-radius:15px;padding:10px;display:grid;gap:4px}.boat-review-workbench-grid span{font-size:9px;color:#8b7b9e;font-weight:800}.boat-review-workbench-grid strong{font-size:14px;overflow-wrap:anywhere}.boat-review-workbench-notes{display:grid;gap:9px}.boat-review-workbench-notes article{min-width:0;border:1px solid #e1d5ef;background:linear-gradient(135deg,#faf7ff,#f7faff);border-radius:20px;padding:12px;display:grid;gap:5px}.boat-review-workbench-notes article:last-child{border-color:#ead8e0;background:#fff9fb}.boat-review-workbench-notes strong{font-size:11px;color:#6f52b2}.boat-review-workbench-notes article:last-child strong{color:#a44f76}.boat-review-workbench-notes span{font-size:11px;line-height:1.6;color:#626b79;overflow-wrap:anywhere}.boat-review-secondary,.boat-review-calendar button,.boat-review-export-grid button{border:1px solid #ddd1ed;background:#fff;color:#3f3657;border-radius:12px;padding:9px 11px;font-weight:800;cursor:pointer}.boat-review-status{margin:0}.boat-review-summary-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,.65fr);gap:18px}.boat-review-panel{border-radius:30px;padding:22px;min-width:0}.boat-review-performance,.boat-review-data-check{display:grid;gap:14px}.boat-review-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}.boat-review-section-heading span{color:#717887;font-size:12px}.boat-review-performance-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.boat-review-metric strong{font-size:18px;line-height:1.15;overflow-wrap:anywhere}.boat-review-data-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.boat-review-alert,.boat-review-ok{margin:0;padding:10px;border-radius:12px;font-size:11px;font-weight:800}.boat-review-alert{background:#fff3e6;color:#a45b16}.boat-review-ok{background:#edf8f4;color:#16705d}.boat-review-venues-panel{display:grid;gap:16px}.boat-review-calendar{border:1px solid #e7def1;border-radius:16px;background:#faf8fd;padding:11px 13px}.boat-review-calendar summary,.boat-review-maintenance summary,.boat-review-monthly-hint summary{cursor:pointer;font-weight:850;color:#5f4c82;overflow-wrap:anywhere}.boat-review-calendar-controls{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.boat-review-calendar-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}.boat-review-calendar-grid strong{text-align:center;font-size:10px;color:#8f839e}.boat-review-calendar-grid button{min-width:0;min-height:34px;padding:5px}.boat-review-calendar-grid button[data-selected=true]{background:#5f4c82;color:#fff}.boat-review-calendar-grid button[data-has-data=true]:not([data-selected=true]){background:#edf8fb}.boat-review-calendar small{display:block;margin-top:9px;color:#777;overflow-wrap:anywhere}.review-venue-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr));gap:14px}.boat-review-venue-card{width:100%;min-width:0;min-height:220px;text-align:left;border:1px solid #e2d6f1;background:linear-gradient(145deg,#fff,#f9f5fc 60%,#f1f9fb);border-radius:24px;padding:18px;display:grid;gap:14px;cursor:pointer;box-shadow:0 12px 28px rgba(17,24,39,.05)}.boat-review-venue-card[data-selected=true]{border-color:#9272d2;background:linear-gradient(180deg,#f3ecff,#fff);box-shadow:0 18px 34px rgba(91,65,145,.13)}.boat-review-venue-head{display:flex;justify-content:space-between;gap:14px;min-width:0}.boat-review-venue-head>div{min-width:0;display:grid;gap:4px}.boat-review-venue-head strong{font-size:22px;overflow-wrap:anywhere}.boat-review-venue-head span{font-size:11px;font-weight:850;color:#7656b2}.boat-review-venue-head small{color:#707887;overflow-wrap:anywhere}.boat-review-venue-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.boat-review-venue-metrics .boat-review-metric{padding:9px;min-height:70px}.boat-review-venue-metrics .boat-review-metric strong{font-size:15px}.boat-review-empty{padding:20px;border:1px dashed #d8caea;border-radius:16px;color:#6d7480}.boat-review-detail{display:grid;gap:16px}.boat-review-readiness{display:flex;flex-wrap:wrap;gap:8px}.boat-review-readiness>*{max-width:100%;border:1px solid #e3d9ef;background:#faf8fd;border-radius:999px;padding:7px 10px;font-size:11px;color:#695a7f;overflow-wrap:anywhere}.boat-review-race-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(210px,100%),1fr));gap:10px}.boat-review-race-card{min-width:0;border:1px solid #e4dcec;background:#fff;border-radius:17px;padding:12px;display:grid;gap:10px}.boat-review-race-card>div{display:flex;justify-content:space-between;align-items:center;gap:8px}.boat-review-race-card>div>span{border-radius:999px;padding:5px 8px;font-size:10px;font-weight:850}.boat-review-race-card dl{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.boat-review-race-card dl>div{min-width:0;display:grid;gap:2px}.boat-review-race-card dt{font-size:9px;color:#8b8194}.boat-review-race-card dd{margin:0;font-size:12px;font-weight:800;overflow-wrap:anywhere}.boat-review-export-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.boat-review-export-grid article{min-width:0;border:1px solid #e1d5ef;background:linear-gradient(180deg,#fff,#f8f5fb);border-radius:18px;padding:14px;display:grid;gap:7px}.boat-review-export-grid article>span{font-size:9px;color:#876cb7;font-weight:900;letter-spacing:.12em;overflow-wrap:anywhere}.boat-review-export-grid article>strong{font-size:16px}.boat-review-export-grid article>small{color:#747b87;overflow-wrap:anywhere}.boat-review-export-grid article>div{display:flex;flex-wrap:wrap;gap:7px}.boat-review-monthly-hint{min-width:0;border:1px solid #e5dced;border-radius:15px;background:#faf8fd;padding:11px 13px}.boat-review-monthly-hint>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.boat-review-monthly-hint span{max-width:100%;font-size:11px;border:1px solid #e5dced;background:#fff;border-radius:10px;padding:7px;overflow-wrap:anywhere}.boat-review-maintenance{padding:14px 18px}.boat-review-maintenance-body{display:grid;gap:12px;margin-top:14px}.boat-review-maintenance-body p{margin:0;color:#6d7480;overflow-wrap:anywhere}.boat-review-maintenance-actions{display:flex;flex-wrap:wrap;gap:8px}.boat-review-maintenance-actions button{border:1px solid #d89aa6;background:#fff5f7;color:#a23248;border-radius:12px;padding:9px;font-weight:800}.boat-review-maintenance-actions button:disabled{opacity:.45}.boat-review-maintenance-actions button:last-child{background:#a23248;color:#fff}@media(max-width:1180px){.boat-review-top-grid,.boat-review-summary-grid{grid-template-columns:1fr}.boat-review-hero-panel{grid-template-columns:1fr}.boat-review-hero-image{min-height:330px}.boat-review-export-grid{grid-template-columns:1fr}}@media(max-width:760px){.boat-review-workbench{padding:10px 8px 72px}.boat-review-hero-copy,.boat-review-panel,.boat-review-workbench-card{padding:16px}.boat-review-hero-stats,.boat-review-performance-grid,.boat-review-data-grid,.boat-review-venue-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.review-venue-grid{grid-template-columns:1fr}.boat-review-hero-copy h1{font-size:30px}.boat-review-hero-image{min-height:270px}.boat-review-race-grid{grid-template-columns:1fr}.boat-review-venue-card{min-height:0}.boat-review-section-heading{align-items:flex-start}}
					.boat-review-date-selector{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:end;gap:9px}.boat-review-date-selector>div{display:flex;gap:7px}.boat-review-date-selector label{min-width:0;display:grid;gap:4px}.boat-review-date-selector label>span{font-size:9px;font-weight:900;color:#8b7b9e}.boat-review-date-selector button,.boat-review-date-selector select,.boat-review-copy-card button{min-width:0;border:1px solid #ddd1ed;background:#fff;color:#3f3657;border-radius:12px;padding:9px 11px;font-weight:800}.boat-review-date-selector select{width:100%;box-sizing:border-box}.boat-review-venue-statuses,.boat-review-copy-statuses{display:flex;flex-wrap:wrap;gap:6px}.boat-review-venue-statuses span,.boat-review-copy-statuses span{max-width:100%;border:1px solid #e2d7f2;background:#faf7ff;color:#695396;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:900;overflow-wrap:anywhere}.boat-review-venue-statuses span[data-ready=true]{border-color:#bfe6da;background:#edf8f4;color:#16705d}.boat-review-venue-statuses span[data-warning=true]{border-color:#f0cf9e;background:#fff3e6;color:#a45b16}.boat-review-copy-material{display:grid;gap:18px}.boat-review-copy-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.boat-review-copy-list{display:grid;gap:16px}.boat-review-copy-card{min-width:0;border:1px solid #e5dced;background:rgba(255,255,255,.94);border-radius:24px;padding:18px;display:flex;align-items:center;justify-content:space-between;gap:18px}.boat-review-copy-card>div:first-child{min-width:0;display:grid;gap:7px}.boat-review-copy-card>div:last-child{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px}.boat-review-copy-card span{font-size:10px;font-weight:900;letter-spacing:.16em;color:#9a7ad9}.boat-review-copy-card strong{font-size:22px;line-height:1.25;overflow-wrap:anywhere}.boat-review-copy-card em{font-style:normal;color:#16835b}.boat-review-copy-card small{color:#707887;overflow-wrap:anywhere}.boat-review-r-match{border:1px solid #bfe6da;background:#edf8f4;color:#16705d;border-radius:18px;padding:14px;display:grid;gap:6px}.boat-review-r-match-warning{border-color:#f0cf9e;background:#fff3e6;color:#a45b16}.boat-review-r-match span{font-size:11px;line-height:1.55;overflow-wrap:anywhere}@media(max-width:760px){.boat-review-date-selector{grid-template-columns:1fr}.boat-review-copy-summary-grid{grid-template-columns:1fr}.boat-review-copy-card{align-items:flex-start;flex-direction:column}.boat-review-copy-card>div:last-child{justify-content:flex-start}}
				`}</style>
			</div>
		</PageShell>
	);
}
