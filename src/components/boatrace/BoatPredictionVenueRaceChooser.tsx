import type { CSSProperties } from "react";
import type { BoatRaceItem, BoatTodayVenueItem } from "../../lib/boatraceTypes";
import { resolveBoatVenueDayLabel } from "../../lib/boatVenueDayLabel";
import { boatTheme } from "../../lib/theme";

type RaceExhibitionStatus = {
	level: "ready" | "partial" | "waiting";
	title: string;
	shortLabel: string;
	detail: string;
};

type BoatPredictionVenueRaceChooserProps = {
	venues: BoatTodayVenueItem[];
	selectedVenueId: string;
	selectedRaceId: string;
	raceExhibitionStatusMap?: Record<string, RaceExhibitionStatus>;
	onSelectVenue: (venueId: string) => void;
	onSelectRace: (raceId: string) => void;
};

type SessionTone = {
	background: string;
	border: string;
	shadow: string;
	badgeBackground: string;
	badgeColor: string;
	badgeBorder: string;
	topLine: string;
};

type BoatVenueCancelSummary = {
	level: "none" | "warning" | "danger";
	label: string;
	cancelledRaceNos: number[];
	reason?: string;
};

const wrapStyle: CSSProperties = {
	padding: "20px",
	borderRadius: "28px",
	background: "rgba(255, 255, 255, 0.98)",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: boatTheme.shadow.soft,
	display: "grid",
	gap: "16px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
	overflow: "hidden",
};

const sectionLabelStyle: CSSProperties = {
	margin: 0,
	fontSize: "0.82rem",
	fontWeight: 800,
	letterSpacing: "0.08em",
	textTransform: "uppercase",
	color: boatTheme.colors.aquaDeep,
};

const venueRowStyle: CSSProperties = {
	display: "grid",
	gap: "12px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
};

const venueCardBaseStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	padding: "15px",
	borderRadius: "22px",
	display: "grid",
	gap: "9px",
	textAlign: "left",
	cursor: "pointer",
	appearance: "none",
	WebkitAppearance: "none",
	width: "100%",
	boxSizing: "border-box",
	minWidth: 0,
	minHeight: "132px",
	transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
};

const venueAccentLineStyle: CSSProperties = {
	position: "absolute",
	inset: "0 0 auto 0",
	height: "5px",
	pointerEvents: "none",
};

const venueTitleStyle: CSSProperties = {
	margin: 0,
	fontSize: "1rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
	letterSpacing: "-0.02em",
};

const venueMetaStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "8px",
	color: boatTheme.colors.muted,
	fontSize: "0.85rem",
};

const chipStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(236, 246, 251, 0.96)",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 800,
	fontSize: "0.76rem",
	lineHeight: 1.1,
	width: "fit-content",
	boxSizing: "border-box",
};

const dayChipStyle: CSSProperties = {
	...chipStyle,
	background: "rgba(255, 255, 255, 0.92)",
	border: "1px solid rgba(176, 198, 214, 0.32)",
	color: "#345166",
};

const cancelChipBaseStyle: CSSProperties = {
	...chipStyle,
	padding: "6px 10px",
	fontSize: "0.76rem",
	border: "1px solid rgba(248, 113, 113, 0.42)",
	color: "#991b1b",
	background: "rgba(254, 226, 226, 0.96)",
	boxShadow: "0 8px 18px rgba(248, 113, 113, 0.16)",
};

const weatherLineStyle: CSSProperties = {
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: "7px",
	color: boatTheme.colors.muted,
	fontSize: "0.78rem",
	fontWeight: 700,
};

const raceWrapStyle: CSSProperties = {
	display: "grid",
	gap: "12px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
};

const raceGridStyle: CSSProperties = {
	display: "grid",
	gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
	gap: "10px",
	width: "100%",
	maxWidth: "100%",
	minWidth: 0,
	boxSizing: "border-box",
};

const raceCardBaseStyle: CSSProperties = {
	position: "relative",
	overflow: "hidden",
	padding: "12px 8px 11px",
	borderRadius: "18px",
	border: `1px solid rgba(176, 198, 214, 0.42)`,
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 252, 255, 0.94) 100%)",
	display: "grid",
	gap: "6px",
	minHeight: "88px",
	textAlign: "center",
	cursor: "pointer",
	appearance: "none",
	WebkitAppearance: "none",
	width: "100%",
	minWidth: 0,
	boxSizing: "border-box",
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.05)",
	transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease",
};

const toLooseRecord = (value: unknown): Record<string, unknown> =>
	value && typeof value === "object" && !Array.isArray(value)
		? value as Record<string, unknown>
		: {};

const readLooseString = (value: unknown): string => {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
};

const normalizeLooseText = (value: unknown): string => readLooseString(value).normalize("NFKC").trim();

const cancelFieldNames = [
	"status",
	"statusText",
	"cancelStatus",
	"cancelReason",
	"raceStatus",
	"resultStatus",
	"resultLookupStatus",
	"notes",
	"memo",
	"resultText",
	"decision",
	"raceName",
];

const getCancelReasonLabel = (value: unknown): string => {
	const normalized = normalizeLooseText(value);
	const lowerText = normalized.toLowerCase();
	if (!normalized) return "";

	if (normalized.includes("順延")) return "順延";
	if (normalized.includes("発売中止")) return "発売中止";
	if (normalized.includes("荒天中止")) return "荒天中止";
	if (normalized.includes("開催中止")) return "開催中止";
	if (normalized.includes("欠航")) return "欠航";
	if (normalized.includes("不成立")) return "不成立";
	if (normalized.includes("打切") || normalized.includes("打ち切り")) return "打切";
	if (normalized.includes("中止")) return "開催中止";
	if (
		lowerText.includes("cancelled") ||
		lowerText.includes("canceled") ||
		lowerText.includes("suspend") ||
		lowerText.includes("abort") ||
		lowerText.includes("no race") ||
		lowerText.includes("norace")
	) {
		return "開催中止";
	}

	return "";
};

const readCancelReasonFromRecord = (record: Record<string, unknown>): string => {
	for (const fieldName of cancelFieldNames) {
		const label = getCancelReasonLabel(record[fieldName]);
		if (label) return label;
	}

	const resultRecord = toLooseRecord(record.result);
	for (const fieldName of ["status", "cancelReason", "remarks", "notes", "refundText", "decision"]) {
		const label = getCancelReasonLabel(resultRecord[fieldName]);
		if (label) return label;
	}

	return "";
};

const isBoatRaceCancelled = (race: BoatRaceItem): boolean => Boolean(readCancelReasonFromRecord(toLooseRecord(race)));

const getBoatVenueCancelStatus = (venue: BoatTodayVenueItem, races: BoatRaceItem[]): BoatVenueCancelSummary => {
	const venueReason = readCancelReasonFromRecord(toLooseRecord(venue));
	const cancelledRaceNos = races
		.filter(isBoatRaceCancelled)
		.map((race) => Number(race.raceNo))
		.filter((raceNo) => Number.isFinite(raceNo) && raceNo > 0)
		.sort((a, b) => a - b);
	const uniqueCancelledRaceNos = Array.from(new Set(cancelledRaceNos));
	const allRacesCancelled = races.length > 0 && uniqueCancelledRaceNos.length === races.length;

	if (venueReason || allRacesCancelled) {
		return {
			level: "danger",
			label: venueReason || "開催中止",
			cancelledRaceNos: uniqueCancelledRaceNos,
			reason: venueReason || undefined,
		};
	}

	if (uniqueCancelledRaceNos.length > 0) {
		const raceLabel = uniqueCancelledRaceNos.length <= 2
			? uniqueCancelledRaceNos.map((raceNo) => `${raceNo}R`).join("・")
			: `${uniqueCancelledRaceNos.length}件`;

		return {
			level: "warning",
			label: `中止あり ${raceLabel}`,
			cancelledRaceNos: uniqueCancelledRaceNos,
		};
	}

	return {
		level: "none",
		label: "",
		cancelledRaceNos: [],
	};
};

const getSessionLabel = (session?: string) => {
	if (session === "night") return "ナイター";
	if (session === "midnight") return "ミッドナイト";
	if (session === "day") return "デイ";
	if (session === "morning") return "モーニング";
	if (session === "relay") return "シリーズ";
	return "時間帯未取得";
};

const sessionTextFieldNames = [
	"sessionLabel",
	"sessionType",
	"timeZoneLabel",
	"category",
	"session",
	"title",
	"seriesName",
	"eventName",
	"name",
];

const normalizeBoatVenueSessionText = (value: unknown): string => normalizeLooseText(value).replace(/\s+/g, "").toLowerCase();

const readExplicitSession = (value: unknown): string => {
	const normalized = normalizeBoatVenueSessionText(value);
	if (!normalized) return "";

	if (normalized.includes("midnight") || normalized.includes("ミッドナイト") || normalized.includes("mnb")) return "midnight";
	if (normalized.includes("morning") || normalized.includes("モーニング")) return "morning";
	if (normalized.includes("night") || normalized.includes("ナイター")) return "night";
	if (normalized.includes("day") || normalized.includes("デイ")) return "day";
	if (normalized === "midnight" || normalized === "morning" || normalized === "night" || normalized === "day") return normalized;

	return "";
};

const parseBoatRaceTimeToMinutes = (value: unknown): number | null => {
	const rawValue = readLooseString(value).normalize("NFKC");
	const match = rawValue.match(/(\d{1,2}):(\d{2})/);
	if (!match) return null;

	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 29 || minutes < 0 || minutes > 59) {
		return null;
	}

	return hours * 60 + minutes;
};

const getRaceDisplayTimeMinutes = (race: BoatRaceItem): number | null => {
	const raceRecord = toLooseRecord(race);
	for (const fieldName of ["deadlineTime", "deadline", "closeTime", "startTime", "time"]) {
		const minutes = parseBoatRaceTimeToMinutes(raceRecord[fieldName]);
		if (minutes !== null) return minutes;
	}

	return null;
};

const resolveBoatVenueSession = (venue: BoatTodayVenueItem): string => {
	const venueRecord = toLooseRecord(venue);
	const races = getVenueRaces(venue);
	let hasExplicitDay = false;

	for (const fieldName of sessionTextFieldNames) {
		const session = readExplicitSession(venueRecord[fieldName]);
		if (session && session !== "day") return session;
		if (session === "day") hasExplicitDay = true;
	}

	for (const race of races) {
		const raceRecord = toLooseRecord(race);
		for (const fieldName of sessionTextFieldNames) {
			const session = readExplicitSession(raceRecord[fieldName]);
			if (session && session !== "day") return session;
			if (session === "day") hasExplicitDay = true;
		}
	}

	const raceTimes = races
		.map((race, index) => ({
			raceNo: Number((race as { raceNo?: unknown }).raceNo) || index + 1,
			minutes: getRaceDisplayTimeMinutes(race),
		}))
		.filter((entry): entry is { raceNo: number; minutes: number } => entry.minutes !== null);
	const finalRaceTime = raceTimes.reduce<{ raceNo: number; minutes: number } | null>((latest, entry) => {
		if (!latest || entry.raceNo > latest.raceNo) return entry;
		return latest;
	}, null);
	const firstRaceTime = raceTimes.reduce<{ raceNo: number; minutes: number } | null>((earliest, entry) => {
		if (!earliest || entry.raceNo < earliest.raceNo) return entry;
		return earliest;
	}, null);

	if (finalRaceTime) {
		if (finalRaceTime.minutes >= 22 * 60) return "midnight";
		if (hasExplicitDay) return "day";
		if (finalRaceTime.minutes >= 17 * 60) return "night";
		if (firstRaceTime && firstRaceTime.minutes < 10 * 60 && finalRaceTime.minutes <= 15 * 60) return "morning";
		return "day";
	}

	for (const fieldName of sessionTextFieldNames) {
		const session = readExplicitSession(venueRecord[fieldName]);
		if (session) return session;
	}

	for (const race of races) {
		const raceRecord = toLooseRecord(race);
		for (const fieldName of sessionTextFieldNames) {
			const session = readExplicitSession(raceRecord[fieldName]);
			if (session) return session;
		}
	}

	return "unknown";
};

const getSessionTone = (session?: string): SessionTone => {
	if (session === "morning") {
		return {
			background: "linear-gradient(180deg, rgba(232, 249, 255, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
			border: "rgba(93, 199, 232, 0.42)",
			shadow: "0 12px 26px rgba(93, 199, 232, 0.08)",
			badgeBackground: "rgba(224, 247, 255, 0.96)",
			badgeColor: "#147d9f",
			badgeBorder: "rgba(93, 199, 232, 0.34)",
			topLine: "linear-gradient(90deg, #5dc7e8 0%, #a7e9ff 100%)",
		};
	}

	if (session === "day") {
		return {
			background: "linear-gradient(180deg, rgba(236, 253, 245, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%)",
			border: "rgba(20, 184, 166, 0.36)",
			shadow: "0 12px 26px rgba(20, 184, 166, 0.08)",
			badgeBackground: "rgba(220, 252, 231, 0.96)",
			badgeColor: "#047857",
			badgeBorder: "rgba(20, 184, 166, 0.3)",
			topLine: "linear-gradient(90deg, #20c997 0%, #a7f3d0 100%)",
		};
	}

	if (session === "night") {
		return {
			background: "linear-gradient(180deg, rgba(233, 242, 255, 0.98) 0%, rgba(245, 249, 255, 0.98) 100%)",
			border: "rgba(36, 74, 112, 0.42)",
			shadow: "0 12px 26px rgba(36, 74, 112, 0.1)",
			badgeBackground: "rgba(224, 234, 255, 0.96)",
			badgeColor: "#213a67",
			badgeBorder: "rgba(36, 74, 112, 0.3)",
			topLine: "linear-gradient(90deg, #24365f 0%, #7aa7ff 100%)",
		};
	}

	if (session === "midnight") {
		return {
			background: "linear-gradient(180deg, rgba(238, 242, 255, 0.98) 0%, rgba(248, 245, 255, 0.98) 100%)",
			border: "rgba(67, 56, 202, 0.42)",
			shadow: "0 12px 28px rgba(49, 46, 129, 0.12)",
			badgeBackground: "rgba(49, 46, 129, 0.96)",
			badgeColor: "#ffffff",
			badgeBorder: "rgba(99, 102, 241, 0.38)",
			topLine: "linear-gradient(90deg, #111827 0%, #4c1d95 54%, #8b5cf6 100%)",
		};
	}

	return {
		background: "rgba(255, 255, 255, 0.96)",
		border: "rgba(176, 198, 214, 0.46)",
		shadow: "0 12px 26px rgba(17, 64, 92, 0.055)",
		badgeBackground: "rgba(236, 246, 251, 0.96)",
		badgeColor: boatTheme.colors.aquaDeep,
		badgeBorder: "rgba(176, 198, 214, 0.3)",
		topLine: "linear-gradient(90deg, rgba(93, 199, 232, 0.8) 0%, rgba(20, 184, 166, 0.65) 100%)",
	};
};

const normalizeSession = (session?: string) => String(session ?? "").trim().toLowerCase();

const getSessionSortOrder = (session?: string) => {
	const normalizedSession = normalizeSession(session);

	if (normalizedSession === "morning" || normalizedSession === "モーニング") return 0;
	if (normalizedSession === "day" || normalizedSession === "デイ") return 1;
	if (normalizedSession === "night" || normalizedSession === "ナイター") return 2;
	if (normalizedSession === "midnight" || normalizedSession === "ミッドナイト") return 3;
	return 9;
};

const getRaceKey = (venueId: string, race: BoatRaceItem) => race.raceId ?? `${venueId}-${race.raceNo}`;

const toArray = <T,>(value: unknown): T[] => {
	if (Array.isArray(value)) {
		return value as T[];
	}

	if (value && typeof value === "object") {
		return Object.values(value as Record<string, T>);
	}

	return [];
};

const getVenueRaces = (venue: BoatTodayVenueItem | undefined): BoatRaceItem[] =>
	toArray<BoatRaceItem>((venue as { races?: unknown } | undefined)?.races);

const getVenueWeather = (venue: BoatTodayVenueItem | undefined) => {
	const source =
		(venue as { weatherActual?: unknown } | undefined)?.weatherActual ??
		(venue as { weather?: unknown } | undefined)?.weather;

	if (!source || typeof source !== "object") {
		return {
			weather: "-",
			windSpeed: "-",
			waveHeight: "-",
		};
	}

	const record = source as Record<string, unknown>;

	return {
		weather: String(record.weather ?? record.condition ?? "-"),
		windSpeed: String(record.windSpeed ?? record.wind ?? "-"),
		waveHeight: String(record.waveHeight ?? record.wave ?? "-"),
	};
};

const getRaceTimeLabel = (race: BoatRaceItem | undefined) => {
	if (!race) return "--:--";

	return String(
		(race as { deadlineTime?: unknown }).deadlineTime ??
			(race as { startTime?: unknown }).startTime ??
			(race as { time?: unknown }).time ??
			"--:--",
	);
};

const hasRaceOddsPreview = (race: BoatRaceItem | undefined) => {
	const oddsPreview = (race as { oddsPreview?: unknown } | undefined)?.oddsPreview;

	if (Array.isArray(oddsPreview)) {
		return oddsPreview.length > 0;
	}

	if (oddsPreview && typeof oddsPreview === "object") {
		return Object.values(oddsPreview as Record<string, unknown>).some((value) => {
			if (Array.isArray(value)) {
				return value.length > 0;
			}

			return Boolean(value);
		});
	}

	return false;
};

const hasRaceResult = (race: BoatRaceItem | undefined) => {
	const result = (race as { result?: unknown } | undefined)?.result;
	const resultStatus = (race as { resultStatus?: unknown } | undefined)?.resultStatus;

	if (resultStatus === "confirmed") {
		return true;
	}

	if (result && typeof result === "object") {
		const status = (result as Record<string, unknown>).status;
		return status === "confirmed";
	}

	return false;
};

const getRaceExhibitionCount = (race: BoatRaceItem | undefined) => {
	const exhibitions = toArray<unknown>((race as { exhibitions?: unknown } | undefined)?.exhibitions);
	const startExhibition = toArray<unknown>((race as { startExhibition?: unknown } | undefined)?.startExhibition);

	return Math.max(exhibitions.length, startExhibition.length);
};

const getVenueStatusLabels = (races: BoatRaceItem[]) => {
	const hasExhibition = races.some((race) => getRaceExhibitionCount(race) > 0);
	const hasOdds = races.some(hasRaceOddsPreview);
	const hasResult = races.some(hasRaceResult);

	return [
		hasExhibition ? "展示あり" : "展示待ち",
		hasOdds ? "オッズあり" : "オッズ待ち",
		hasResult ? "結果あり" : "結果待ち",
	];
};

export function BoatPredictionVenueRaceChooser({
	venues,
	selectedVenueId,
	selectedRaceId,
	raceExhibitionStatusMap = {},
	onSelectVenue,
	onSelectRace,
}: BoatPredictionVenueRaceChooserProps) {
	const selectedVenue = venues.find((venue) => venue.id === selectedVenueId) ?? venues[0];
	const sortedVenues = venues
		.map((venue, index) => ({ venue, index, session: resolveBoatVenueSession(venue) }))
		.sort((a, b) => {
			const sessionDiff = getSessionSortOrder(a.session) - getSessionSortOrder(b.session);
			if (sessionDiff !== 0) return sessionDiff;
			return a.index - b.index;
		})
		.map(({ venue }) => venue);
	const races = getVenueRaces(selectedVenue);
	const venueWeather = getVenueWeather(selectedVenue);

	if (!selectedVenue) {
		return null;
	}

	return (
		<section style={wrapStyle}>
			<style>
				{`
					.boat-prediction-venue-grid {
						grid-template-columns: repeat(7, minmax(0, 1fr));
					}

					.boat-prediction-venue-card:hover {
						transform: translateY(-2px);
						box-shadow: 0 18px 36px rgba(17, 64, 92, 0.1);
					}

					.boat-prediction-race-card:hover {
						transform: translateY(-2px);
						box-shadow: 0 16px 32px rgba(17, 64, 92, 0.12);
					}

					@media (max-width: 1400px) {
						.boat-prediction-venue-grid {
							grid-template-columns: repeat(5, minmax(0, 1fr));
						}
					}

					@media (max-width: 980px) {
						.boat-prediction-venue-grid {
							grid-template-columns: repeat(3, minmax(0, 1fr));
						}

						.boat-prediction-race-grid {
							grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
						}
					}

					@media (max-width: 640px) {
						.boat-prediction-venue-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr));
						}

						.boat-prediction-race-grid {
							grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
						}
					}

					@media (max-width: 460px) {
						.boat-prediction-venue-grid {
							grid-template-columns: 1fr;
						}

						.boat-prediction-race-grid {
							grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
						}
					}
				`}
			</style>

			<div style={{ display: "grid", gap: "12px" }}>
				<p style={sectionLabelStyle}>Venues</p>

				<div className="boat-prediction-venue-grid" style={venueRowStyle}>
					{sortedVenues.map((venue) => {
						const isSelected = venue.id === selectedVenue.id;
						const displaySession = resolveBoatVenueSession(venue);
						const sessionTone = getSessionTone(displaySession);
						const racesForVenue = getVenueRaces(venue);
						const weather = getVenueWeather(venue);
						const statusLabels = getVenueStatusLabels(racesForVenue);
						const dayLabel = resolveBoatVenueDayLabel(venue, racesForVenue);
						const cancelStatus = getBoatVenueCancelStatus(venue, racesForVenue);
						const cancelTone = cancelStatus.level === "danger"
							? {
								background: "linear-gradient(180deg, rgba(255, 241, 242, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)",
								border: "rgba(248, 113, 113, 0.62)",
								shadow: "0 16px 32px rgba(185, 28, 28, 0.12)",
							}
							: cancelStatus.level === "warning"
								? {
									background: "linear-gradient(180deg, rgba(255, 251, 235, 0.98) 0%, rgba(255, 255, 255, 0.96) 100%)",
									border: "rgba(245, 158, 11, 0.54)",
									shadow: "0 16px 32px rgba(180, 83, 9, 0.10)",
								}
								: null;
						const style: CSSProperties = {
							...venueCardBaseStyle,
							background: cancelTone
								? cancelTone.background
								: isSelected
								? "linear-gradient(180deg, rgba(231, 243, 252, 0.98), rgba(225, 246, 241, 0.96))"
								: sessionTone.background,
							border: cancelTone
								? `1px solid ${cancelTone.border}`
								: isSelected
									? `1px solid ${boatTheme.colors.aquaDeep}`
									: `1px solid ${sessionTone.border}`,
							boxShadow: cancelTone
								? cancelTone.shadow
								: isSelected
									? "0 20px 42px rgba(17, 122, 146, 0.16)"
									: sessionTone.shadow,
							opacity: cancelStatus.level === "danger" ? 0.92 : 1,
						};
						const sessionChipStyle: CSSProperties = {
							...chipStyle,
							background: sessionTone.badgeBackground,
							color: sessionTone.badgeColor,
							border: `1px solid ${sessionTone.badgeBorder}`,
						};
						const cancelChipStyle: CSSProperties = {
							...cancelChipBaseStyle,
							background: cancelStatus.level === "warning"
								? "rgba(254, 243, 199, 0.96)"
								: cancelChipBaseStyle.background,
							border: cancelStatus.level === "warning"
								? "1px solid rgba(245, 158, 11, 0.44)"
								: cancelChipBaseStyle.border,
							color: cancelStatus.level === "warning" ? "#92400e" : "#991b1b",
							boxShadow: cancelStatus.level === "warning"
								? "0 8px 18px rgba(245, 158, 11, 0.12)"
								: cancelChipBaseStyle.boxShadow,
						};

						return (
							<button
								key={`${venue.id}-${displaySession}-${dayLabel}-${venue.title ?? venue.venueName}`}
								type="button"
								className="boat-prediction-venue-card"
								style={style}
								onClick={() => {
									onSelectVenue(venue.id);
								}}
							>
								<span style={{ ...venueAccentLineStyle, background: sessionTone.topLine }} />

								<h3 style={venueTitleStyle}>{venue.venueName}</h3>

								<div style={venueMetaStyle}>
									<span>{racesForVenue.length}R</span>
									<span style={sessionChipStyle}>{getSessionLabel(displaySession)}</span>
									<span style={dayChipStyle}>{dayLabel}</span>
								</div>

								{cancelStatus.level !== "none" ? (
									<span style={cancelChipStyle}>{cancelStatus.label}</span>
								) : null}

								<div style={weatherLineStyle}>
									<span style={chipStyle}>{weather.weather}</span>
									<span>風速: {weather.windSpeed}</span>
								</div>

								<div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
									{statusLabels.map((label) => (
										<span
	key={`${venue.id}-${label}`}
	style={{
		...chipStyle,
		padding: "4px 8px",
		fontSize: "0.68rem",
		background: label.includes("あり")
			? "rgba(255, 235, 243, 0.94)"
			: "rgba(236, 246, 251, 0.96)",
		border: label.includes("あり")
			? "1px solid rgba(244, 190, 211, 0.95)"
			: "1px solid rgba(176, 198, 214, 0.28)",
		color: label.includes("あり") ? "#b45d84" : boatTheme.colors.aquaDeep,
		boxShadow: label.includes("あり") ? "0 8px 18px rgba(244, 190, 211, 0.16)" : "none",
	}}
>
	{label}
</span>
									))}
								</div>
							</button>
						);
					})}
				</div>
			</div>

			<div style={raceWrapStyle}>
				<p style={sectionLabelStyle}>Races</p>

				<div className="boat-prediction-race-grid" style={raceGridStyle}>
					{races.map((race) => {
						const raceKey = getRaceKey(selectedVenue.id, race);
						const isSelected = raceKey === selectedRaceId;
						const exhibitionStatus = raceExhibitionStatusMap[raceKey];
						const isCancelled = isBoatRaceCancelled(race);
						const style: CSSProperties = {
							...raceCardBaseStyle,
							background: isSelected
								? "linear-gradient(180deg, #183a59 0%, #244a73 100%)"
								: isCancelled
									? "linear-gradient(180deg, rgba(255, 241, 242, 0.98) 0%, rgba(255, 255, 255, 0.94) 100%)"
									: "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(247, 252, 255, 0.94) 100%)",
							border: isSelected
								? `1px solid #183a59`
								: isCancelled
									? "1px solid rgba(248, 113, 113, 0.50)"
									: `1px solid rgba(176, 198, 214, 0.42)`,
							color: isSelected ? "#ffffff" : boatTheme.colors.navy,
							boxShadow: isSelected
								? "0 16px 34px rgba(24, 58, 89, 0.22)"
								: isCancelled
									? "0 12px 24px rgba(248, 113, 113, 0.10)"
									: "0 10px 22px rgba(17, 64, 92, 0.05)",
							};

						return (
							<button
								key={raceKey}
								type="button"
								className="boat-prediction-race-card"
								style={style}
								onClick={() => onSelectRace(raceKey)}
							>
								<strong style={{ fontSize: "0.95rem", letterSpacing: "-0.01em" }}>{race.raceNo}R</strong>

<span
	style={{
		fontSize: "0.72rem",
		fontWeight: 700,
		letterSpacing: "0.01em",
		color: isSelected ? "rgba(255,255,255,0.82)" : boatTheme.colors.muted,
	}}
>
	{getRaceTimeLabel(race)}
</span>

<span
	style={{
		fontSize: "0.68rem",
		fontWeight: 900,
		letterSpacing: "0.01em",
		color:
			exhibitionStatus?.level === "ready"
				? isSelected
					? "#a7f3d0"
					: "#15966a"
				: exhibitionStatus?.level === "partial"
					? isSelected
						? "#fde68a"
						: "#b7791f"
					: isSelected
						? "rgba(255,255,255,0.72)"
						: "#8aa0b8",
	}}
>
	{exhibitionStatus?.shortLabel ?? "展示未取得"}
</span>

								{isCancelled ? (
									<span
										style={{
											...cancelChipBaseStyle,
											justifySelf: "center",
											padding: "4px 8px",
											fontSize: "0.66rem",
											background: isSelected ? "rgba(254, 226, 226, 0.20)" : "rgba(254, 226, 226, 0.96)",
											color: isSelected ? "#fecaca" : "#991b1b",
											border: isSelected
												? "1px solid rgba(254, 202, 202, 0.34)"
												: "1px solid rgba(248, 113, 113, 0.42)",
											boxShadow: "none",
										}}
									>
										中止
									</span>
								) : null}
							</button>
						);
					})}
				</div>

				<p
					style={{
						margin: 0,
						color: boatTheme.colors.muted,
						fontSize: "0.8rem",
						lineHeight: 1.7,
						padding: "2px 2px 0",
						fontWeight: 600,
					}}
				>
					選択会場：{selectedVenue.venueName} / 天候：{venueWeather.weather} / 風速：{venueWeather.windSpeed} / 波：{venueWeather.waveHeight}
				</p>
			</div>
		</section>
	);
}
