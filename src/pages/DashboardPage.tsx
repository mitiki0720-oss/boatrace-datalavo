import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import {
	filterBoatUpcomingScheduleByDateRange,
	loadBoatTodayFeed,
	loadBoatUpcomingSchedule,
	type BoatUpcomingScheduleItem,
} from "../lib/boatDataFeed";
import { withBasePath } from "../lib/assetPath";
import { boatTheme } from "../lib/theme";

type PulseMetric = {
	label: string;
	value: string;
};

type DashboardVenue = typeof sampleBoatTodayFeed.venues[number];
type DashboardVenueTimeBand = "morning" | "day" | "night" | "midnight" | "unknown";

const venueNotes = [
	"戸田は追い風時のイン残り率だけでなく、2コース差しの連対率も同時確認。",
	"平和島は波高が上がるほど展示順位より直前気配を優先。",
	"住之江ナイターは気温低下で出足型モーターの体感差が出やすい。",
];

const dashboardPageBackgroundImageSrc = withBasePath("dashboard/dashboard-bg-water-sky-sparkle.png");

const upcomingBoatSchedules: BoatUpcomingScheduleItem[] = [
	{ id: "kiryu-20260505", venueName: "桐生", title: "ナイター一般戦", grade: "一般", startDate: "2026-05-05", endDate: "2026-05-08", dateRange: "05.05 - 05.08", session: "Night" },
	{ id: "toda-20260507", venueName: "戸田", title: "ヴィーナスシリーズ", grade: "GIII", startDate: "2026-05-07", endDate: "2026-05-12", dateRange: "05.07 - 05.12", session: "Day" },
	{ id: "omura-20260509", venueName: "大村", title: "ミッドナイトボート", grade: "一般", startDate: "2026-05-09", endDate: "2026-05-12", dateRange: "05.09 - 05.12", session: "Midnight" },
	{ id: "heiwajima-20260510", venueName: "平和島", title: "GW Special Cup", grade: "GII", startDate: "2026-05-10", endDate: "2026-05-14", dateRange: "05.10 - 05.14", session: "Day" },
	{ id: "tokoname-20260511", venueName: "常滑", title: "海風チャレンジ", grade: "一般", startDate: "2026-05-11", endDate: "2026-05-15", dateRange: "05.11 - 05.15", session: "Day" },
	{ id: "suminoe-20260512", venueName: "住之江", title: "ナイタープレミア", grade: "GIII", startDate: "2026-05-12", endDate: "2026-05-16", dateRange: "05.12 - 05.16", session: "Night" },
	{ id: "tamagawa-20260513", venueName: "多摩川", title: "オールレディース", grade: "GIII", startDate: "2026-05-13", endDate: "2026-05-18", dateRange: "05.13 - 05.18", session: "Day" },
	{ id: "marugame-20260515", venueName: "丸亀", title: "サマー先取り戦", grade: "一般", startDate: "2026-05-15", endDate: "2026-05-19", dateRange: "05.15 - 05.19", session: "Night" },
	{ id: "wakamatsu-20260516", venueName: "若松", title: "Blue Water Cup", grade: "GI", startDate: "2026-05-16", endDate: "2026-05-21", dateRange: "05.16 - 05.21", session: "Night" },
	{ id: "fukuoka-20260518", venueName: "福岡", title: "都市圏シリーズ", grade: "GII", startDate: "2026-05-18", endDate: "2026-05-22", dateRange: "05.18 - 05.22", session: "Day" },
];

const sectionTitleStyle: CSSProperties = {
	margin: 0,
	fontSize: "clamp(1.45rem, 2.4vw, 2rem)",
	lineHeight: 1.15,
	color: boatTheme.colors.navy,
};

const panelStyle: CSSProperties = {
	borderRadius: "30px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: boatTheme.background.panel,
	boxShadow: boatTheme.shadow.soft,
	overflow: "hidden",
};

const sectionEyebrowStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	gap: "8px",
	padding: "7px 12px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.72)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.76rem",
	fontWeight: 800,
	letterSpacing: "0.16em",
	textTransform: "uppercase",
};

const heroEyebrowStyle: CSSProperties = {
	...sectionEyebrowStyle,
	padding: 0,
	borderRadius: 0,
	background: "transparent",
	border: "none",
	boxShadow: "none",
	letterSpacing: "0.18em",
	color: boatTheme.colors.aquaDeep,
	textShadow: "0 1px 0 rgba(255, 255, 255, 0.5)",
};

const characterPlaceholderStyle: CSSProperties = {
	borderRadius: "28px",
	padding: "20px 22px",
	minHeight: "180px",
	border: "1px solid rgba(125, 211, 252, 0.32)",
	background:
		"radial-gradient(circle at 24% 24%, rgba(93, 199, 232, 0.22), transparent 34%), radial-gradient(circle at 76% 18%, rgba(139, 225, 208, 0.24), transparent 30%), linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(237, 249, 252, 0.94))",
	display: "grid",
	alignContent: "end",
	gap: "10px",
	boxShadow: "0 24px 60px rgba(15, 53, 84, 0.1)",
};

const dashboardImageStyle: CSSProperties = {
	display: "block",
	width: "100%",
	height: "auto",
	objectFit: "contain",
	justifySelf: "center",
	alignSelf: "center",
	pointerEvents: "none",
	userSelect: "none",
};

const sectionVisualStyle: CSSProperties = {
	...characterPlaceholderStyle,
	alignContent: "center",
	justifyItems: "center",
	textAlign: "center",
};

const mobileLinkCardStyle: CSSProperties = {
	...panelStyle,
	padding: "24px",
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
	gap: "18px",
	alignItems: "center",
	textDecoration: "none",
	color: "inherit",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(232, 247, 251, 0.94))",
};

const heroCtaRowStyle: CSSProperties = {
	display: "flex",
	gap: "12px",
	flexWrap: "wrap",
	alignItems: "center",
};

const venueCardStyle: CSSProperties = {
	...panelStyle,
	padding: "20px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 250, 253, 0.94))",
	transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
	boxShadow: "0 18px 40px rgba(17, 64, 92, 0.08)",
	cursor: "default",
	willChange: "transform",
	transform: "translateY(0)",
	border: `1px solid rgba(125, 211, 252, 0.2)`,
};

const scheduleCardStyle: CSSProperties = {
	...panelStyle,
	padding: "20px",
	transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
	boxShadow: "0 18px 40px rgba(17, 64, 92, 0.08)",
	willChange: "transform",
	transform: "translateY(0)",
	border: `1px solid rgba(125, 211, 252, 0.18)`,
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.97), rgba(244, 251, 255, 0.94))",
};

const featuredVenueCardStyle: CSSProperties = {
	...venueCardStyle,
	padding: "24px 26px",
	minHeight: "188px",
	borderRadius: "28px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(236, 248, 252, 0.96))",
	boxShadow: "0 24px 52px rgba(17, 64, 92, 0.12)",
	border: "1px solid rgba(125, 211, 252, 0.24)",
};

const compactVenueCardStyle: CSSProperties = {
	...venueCardStyle,
	width: "180px",
	height: "180px",
	boxSizing: "border-box",
	padding: "14px",
	minHeight: 0,
	borderRadius: "24px",
	boxShadow: "0 16px 34px rgba(17, 64, 92, 0.08)",
};

const featuredScheduleCardStyle: CSSProperties = {
	...scheduleCardStyle,
	padding: "22px 22px 20px",
	minHeight: "172px",
	borderRadius: "28px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(236, 248, 252, 0.96))",
	boxShadow: "0 24px 50px rgba(17, 64, 92, 0.11)",
	border: "1px solid rgba(125, 211, 252, 0.24)",
};

const compactScheduleCardStyle: CSSProperties = {
	...scheduleCardStyle,
	padding: "18px",
	minHeight: "136px",
	borderRadius: "24px",
	boxShadow: "0 16px 32px rgba(17, 64, 92, 0.08)",
};

const scheduleRailCardStyle: CSSProperties = {
	...compactScheduleCardStyle,
	width: "236px",
	minWidth: "236px",
	flex: "0 0 auto",
	height: "100%",
	padding: "18px 18px 16px",
	boxShadow: "0 14px 28px rgba(17, 64, 92, 0.07)",
};

const heroPrimaryCtaStyle: CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "12px 20px",
	borderRadius: "999px",
	background: boatTheme.colors.navy,
	color: "#ffffff",
	fontWeight: 700,
	fontSize: "0.92rem",
	textDecoration: "none",
	border: `1px solid ${boatTheme.colors.navy}`,
	boxShadow: "0 12px 28px rgba(18, 50, 74, 0.16)",
};

const heroSecondaryCtaStyle: CSSProperties = {
	...heroPrimaryCtaStyle,
	background: "rgba(255, 255, 255, 0.9)",
	color: boatTheme.colors.navy,
	border: `1px solid rgba(93, 199, 232, 0.28)`,
	boxShadow: "0 12px 28px rgba(93, 199, 232, 0.12)",
};

function getGradeChipStyle(grade?: string): CSSProperties {
	if (grade === "GI") {
		return {
			background: "rgba(24, 115, 152, 0.14)",
			color: boatTheme.colors.aquaDeep,
		};
	}

	if (grade === "GII") {
		return {
			background: "rgba(139, 225, 208, 0.22)",
			color: boatTheme.colors.navy,
		};
	}

	if (grade === "GIII") {
		return {
			background: "rgba(223, 245, 255, 0.92)",
			color: boatTheme.colors.aquaDeep,
		};
	}

	return {
		background: "rgba(255, 255, 255, 0.88)",
		color: boatTheme.colors.muted,
	};
}

function getActiveRacesLabel(venues: typeof sampleBoatTodayFeed.venues): string {
	const totalRaceCount = venues.reduce((count, venue) => count + venue.races.length, 0);
	if (totalRaceCount > 0) {
		return `${totalRaceCount}R`;
	}

	return `${venues.length * 12}R予定`;
}

function getVenueSessionLabel(session?: string): string {
	const normalized = getNormalizedSession(session);

	if (!normalized) {
		return "SCHEDULE";
	}

	return normalized.toUpperCase();
}

function getNormalizedSession(session?: string): string {
	const normalized = session?.toLowerCase() ?? "";
	return normalized === "summer" ? "day" : normalized;
}

function getVenueSearchText(venue: DashboardVenue): string {
	const record = venue as Record<string, unknown>;
	return [
		record.title,
		record.raceTitle,
		record.seriesName,
		record.eventName,
		record.gradeName,
		record.grade,
	]
		.map((value) => String(value ?? ""))
		.join(" ")
		.normalize("NFKC")
		.toLowerCase();
}

function getDashboardVenueTimeBand(venue: DashboardVenue): DashboardVenueTimeBand {
	const titleText = getVenueSearchText(venue);
	const normalizedSession = getNormalizedSession(venue.session).normalize("NFKC").toLowerCase();

	if (titleText.includes("mnb") || titleText.includes("ミッドナイト")) {
		return "midnight";
	}

	if (normalizedSession === "morning" || normalizedSession === "モーニング" || titleText.includes("モーニング")) {
		return "morning";
	}

	if (normalizedSession === "night" || normalizedSession === "ナイター" || titleText.includes("ナイター")) {
		return "night";
	}

	if (normalizedSession === "day" || normalizedSession === "デイ") {
		return "day";
	}

	return "unknown";
}

function getVenueTimeBandSortOrder(timeBand: DashboardVenueTimeBand): number {
	if (timeBand === "morning") return 0;
	if (timeBand === "day") return 1;
	if (timeBand === "night") return 2;
	if (timeBand === "midnight") return 3;
	return 4;
}

function getVenueAccentColor(session?: string): string {
	const normalized = getNormalizedSession(session);

	if (normalized === "day") {
		return "#78dcc5";
	}

	if (normalized === "morning") {
		return "#5dc7e8";
	}

	if (normalized === "night") {
		return "#1c3b5c";
	}

	if (normalized === "midnight") {
		return "#887faa";
	}

	return boatTheme.colors.aquaDeep;
}

function getVenueCardTone(session?: string): CSSProperties {
	const normalized = getNormalizedSession(session);

	if (normalized === "day") {
		return {
			border: "1px solid rgba(139, 225, 208, 0.34)",
			boxShadow: "0 18px 38px rgba(139, 225, 208, 0.12)",
			background: "linear-gradient(180deg, rgba(248, 254, 252, 0.99), rgba(230, 248, 240, 0.97))",
		};
	}

	if (normalized === "morning") {
		return {
			border: "1px solid rgba(93, 199, 232, 0.34)",
			boxShadow: "0 18px 38px rgba(93, 199, 232, 0.12)",
			background: "linear-gradient(180deg, rgba(243, 251, 255, 0.99), rgba(220, 241, 255, 0.97))",
		};
	}

	if (normalized === "night") {
		return {
			border: "1px solid rgba(93, 113, 140, 0.32)",
			boxShadow: "0 18px 38px rgba(18, 50, 74, 0.12)",
			background: "linear-gradient(180deg, rgba(242, 246, 251, 0.99), rgba(224, 232, 242, 0.97))",
		};
	}

	if (normalized === "midnight") {
		return {
			border: "1px solid rgba(166, 156, 196, 0.32)",
			boxShadow: "0 18px 38px rgba(118, 102, 191, 0.1)",
			background: "linear-gradient(180deg, rgba(248, 247, 253, 0.99), rgba(234, 230, 244, 0.97))",
		};
	}

	return {
		border: "1px solid rgba(125, 211, 252, 0.28)",
		boxShadow: "0 18px 38px rgba(93, 199, 232, 0.1)",
		background: "linear-gradient(180deg, rgba(244, 251, 255, 0.98), rgba(255, 255, 255, 0.98))",
	};
}

function getVenueSessionStyle(session?: string): CSSProperties {
	const normalized = getNormalizedSession(session);

	if (normalized === "morning") {
		return {
			background: "rgba(223, 245, 255, 0.92)",
			color: boatTheme.colors.aquaDeep,
			border: "1px solid rgba(93, 199, 232, 0.18)",
		};
	}

	if (normalized === "night") {
		return {
			background: "rgba(18, 50, 74, 0.94)",
			color: "#ffffff",
			border: "1px solid rgba(18, 50, 74, 0.9)",
		};
	}

	if (normalized === "midnight") {
		return {
			background: "rgba(239, 235, 255, 0.96)",
			color: "#6659ad",
			border: "1px solid rgba(118, 102, 191, 0.18)",
		};
	}

	if (normalized === "day") {
		return {
			background: "rgba(234, 250, 246, 0.96)",
			color: "#1e6f61",
			border: "1px solid rgba(139, 225, 208, 0.22)",
		};
	}

	return {
		background: "rgba(93, 199, 232, 0.12)",
		color: boatTheme.colors.aquaDeep,
		border: "1px solid rgba(93, 199, 232, 0.16)",
	};
}

function getVenueGradeLabel(title?: string): string | null {
	if (!title) {
		return null;
	}

	const match = title.match(/G[1-3]/i);
	return match ? match[0].toUpperCase() : null;
}

function getFeaturedVenueNote(venueName: string): string {
	if (venueName === "丸亀") {
		return "グレード戦を優先確認";
	}

	if (venueName === "大村") {
		return "初日で流れを見たい";
	}

	return "注目度高め";
}

function getVenueWeatherSummary(weatherActual?: {
	weather?: string;
	windDirection?: string;
	windSpeed?: string;
	waveHeight?: string;
}): string {
	const weather = weatherActual?.weather?.trim() || "確認中";
	const windDirection = weatherActual?.windDirection?.trim() || "確認中";
	const windSpeed = weatherActual?.windSpeed?.trim() || "確認中";
	const waveHeight = weatherActual?.waveHeight?.trim() || "確認中";

	const isUnknown = [weather, windDirection, windSpeed, waveHeight].every((value) => value === "確認中");
	if (isUnknown) {
		return "水面情報確認中";
	}

	const windText = windDirection === "確認中" && windSpeed === "確認中"
		? "確認中"
		: `${windDirection} ${windSpeed}`.trim();
	const waveText = waveHeight === "確認中" ? "確認中" : `波 ${waveHeight}`;

	return `${weather} / ${windText} / ${waveText}`;
}

function getScheduleGradePriority(grade?: string): number {
	if (!grade) {
		return 0;
	}

	const normalized = grade.toUpperCase();
	if (normalized === "SG") {
		return 5;
	}

	if (normalized === "GI") {
		return 4;
	}

	if (normalized === "GII" || normalized === "G2") {
		return 3;
	}

	if (normalized === "GIII" || normalized === "G3") {
		return 2;
	}

	return 1;
}

function getScheduleSessionChipStyle(session?: string): CSSProperties {
	return getVenueSessionStyle(getNormalizedSession(session));
}

function elevateCard(target: HTMLElement, active: boolean, options?: { borderColor?: string; boxShadow?: string }): void {
	target.style.transform = active ? "translateY(-2px)" : "translateY(0)";
	target.style.boxShadow = active
		? "0 22px 44px rgba(17, 64, 92, 0.12)"
		: options?.boxShadow ?? "0 18px 40px rgba(17, 64, 92, 0.08)";
	target.style.borderColor = active ? "rgba(93, 199, 232, 0.28)" : options?.borderColor ?? "rgba(125, 211, 252, 0.2)";
}

export function DashboardPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [todayFeedUpdatedAt, setTodayFeedUpdatedAt] = useState("");
	const [upcomingSchedules, setUpcomingSchedules] = useState<BoatUpcomingScheduleItem[]>(upcomingBoatSchedules);
	const [upcomingUpdatedAt, setUpcomingUpdatedAt] = useState("");

	useEffect(() => {
		let isActive = true;

		const loadDashboardFeeds = async () => {
			const [todayResult, scheduleResult] = await Promise.all([
				loadBoatTodayFeed(),
				loadBoatUpcomingSchedule(),
			]);

			if (!isActive) {
				return;
			}

			if (todayResult) {
				setTodayFeed(todayResult);
				setTodayFeedUpdatedAt(todayResult.generatedAt ?? "");
			}

			if (scheduleResult) {
				setUpcomingSchedules(filterBoatUpcomingScheduleByDateRange(scheduleResult.items ?? []));
				setUpcomingUpdatedAt(scheduleResult.generatedAt ?? "");
			}
		};

		void loadDashboardFeeds();

		return () => {
			isActive = false;
		};
	}, []);

	const pulseMetrics = useMemo<PulseMetric[]>(
		() => [
			{
				label: "Today Venues",
				value: `${todayFeed.venues.length} venues`,
			},
			{
				label: "Active Races",
				value: getActiveRacesLabel(todayFeed.venues),
			},
			{
				label: "Upcoming Pickup",
				value: `${upcomingSchedules.length} meets`,
			},
		],
		[todayFeed, upcomingSchedules],
	);

	const featuredVenueNames = useMemo(() => new Set(["丸亀", "大村"]), []);

	const sortedTodayVenues = useMemo(
		() =>
			todayFeed.venues
				.map((venue, index) => ({ venue, index }))
				.sort((left, right) => {
					const timeBandDiff =
						getVenueTimeBandSortOrder(getDashboardVenueTimeBand(left.venue)) -
						getVenueTimeBandSortOrder(getDashboardVenueTimeBand(right.venue));
					if (timeBandDiff !== 0) {
						return timeBandDiff;
					}

					return left.index - right.index;
				})
				.map(({ venue }) => venue),
		[todayFeed.venues],
	);

	const featuredVenues: DashboardVenue[] = [];

	const standardVenues = sortedTodayVenues;

	const featuredScheduleIds = useMemo(() => {
		const sortedSchedules = [...upcomingSchedules]
			.sort((left, right) => getScheduleGradePriority(right.grade) - getScheduleGradePriority(left.grade));
		return new Set(sortedSchedules.slice(0, 3).map((schedule) => schedule.id));
	}, [upcomingSchedules]);

	const featuredSchedules = useMemo(
		() => upcomingSchedules.filter((schedule) => featuredScheduleIds.has(schedule.id)),
		[upcomingSchedules, featuredScheduleIds],
	);

	const standardSchedules = useMemo(
		() => upcomingSchedules.filter((schedule) => !featuredScheduleIds.has(schedule.id)),
		[upcomingSchedules, featuredScheduleIds],
	);

	const flowingSchedules = useMemo(
		() => [...standardSchedules, ...standardSchedules],
		[standardSchedules],
	);

	return (
		<div className="dashboard-page-root" style={{ display: "grid", gap: "16px" }}>
			<style>{`
				body:has(.dashboard-page-root) {
					background: #eefbff;
				}

				#root:has(.dashboard-page-root) {
					position: relative;
					min-height: 100vh;
					background: #eefbff;
				}

				#root:has(.dashboard-page-root)::before {
					content: "";
					position: fixed;
					inset: 0;
					z-index: 0;
					pointer-events: none;
					background-color: #eefbff;
					background-image:
						linear-gradient(180deg, rgba(248, 253, 255, 0.2) 0%, rgba(238, 250, 253, 0.16) 48%, rgba(226, 248, 250, 0.22) 100%),
						url("${dashboardPageBackgroundImageSrc}");
					background-size: cover;
					background-position: center;
					background-repeat: no-repeat;
				}

				#root:has(.dashboard-page-root) > div {
					position: relative;
					z-index: 1;
					background: transparent !important;
				}

				#root:has(.dashboard-page-root) main,
				.dashboard-page-root {
					position: relative;
					z-index: 1;
				}

				@keyframes boatScheduleRail {
					from {
						transform: translateX(0);
					}

					to {
						transform: translateX(calc(-50% - 7px));
					}
				}

				.boat-schedule-rail-track {
					display: flex;
					gap: 14px;
					width: max-content;
					animation: boatScheduleRail 28s linear infinite;
					will-change: transform;
				}

				.boat-schedule-rail-track:hover {
					animation-play-state: paused;
				}
			`}</style>
			<section
				style={{
					...panelStyle,
					padding: "clamp(1px, 1vw, 1px) clamp(20px, 3vw, 38px) clamp(1px, 1vw, 1px)",
					background: boatTheme.background.hero,
				}}
			>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
						gap: "clamp(20px, 3vw, 38px)",
						alignItems: "center",
						minHeight: "clamp(520px, 56vw, 580px)",
					}}
				>
					<article
						style={{
							display: "grid",
							gap: "clamp(18px, 2.4vw, 28px)",
							alignContent: "center",
							paddingBlock: "clamp(8px, 1.8vw, 18px)",
						}}
					>
						<span style={heroEyebrowStyle}>TODAY&apos;S BOAT RACE DATA</span>
						<div style={{ display: "grid", gap: "clamp(14px, 2vw, 20px)", maxWidth: "34rem" }}>
							<h2 style={{ ...sectionTitleStyle, fontSize: "clamp(2.2rem, 5vw, 3.8rem)" }}>
								Fresh water insights for today&apos;s boat race venues.
							</h2>
							<p style={{ margin: 0, color: boatTheme.colors.muted, lineHeight: 1.9, fontSize: "1rem" }}>
								今日のボートレース会場。予想から振り返りまで全部のせ🚣
								
								
							</p>
						</div>

						<div style={heroCtaRowStyle}>
							<a href="#races-page" style={heroPrimaryCtaStyle}>Today&apos;s Races</a>
							<a href="#prediction-page" style={heroSecondaryCtaStyle}>Build Prediction</a>
						</div>
					</article>

					<div style={{ display: "grid", alignContent: "center", justifyItems: "center" }}>
						<div
							style={{
								...sectionVisualStyle,
								minHeight: "clamp(340px, 39vw, 428px)",
								maxWidth: "min(100%, 620px)",
								width: "100%",
								padding: "18px 22px",
								justifySelf: "center",
							}}
						>
							<img
								src={withBasePath("dashboard/dashboard-hero-funako-kurari.png")}
								alt="ダッシュボードのヒーローセクションを彩る funako kurari のビジュアル"
								style={{ ...dashboardImageStyle, maxWidth: "clamp(460px, 48vw, 580px)", maxHeight: "420px" }}
								onError={(event) => {
									event.currentTarget.style.display = "none";
								}}
							/>
						</div>
					</div>
				</div>
			</section>

			<section
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
					gap: "14px",
				}}
			>
				{pulseMetrics.map((metric) => (
					<article key={metric.label} style={{ ...panelStyle, padding: "20px 22px" }}>
						<p style={{ margin: 0, fontSize: "0.84rem", textTransform: "uppercase", letterSpacing: "0.12em", color: boatTheme.colors.aquaDeep, fontWeight: 800 }}>
							{metric.label}
						</p>
						<p style={{ margin: "12px 0 8px", fontSize: "2.3rem", lineHeight: 1, fontWeight: 800, color: boatTheme.colors.navy }}>
							{metric.value}
						</p>
					</article>
				))}
			</section>


			<section style={{ display: "grid", gap: "18px" }}>
				<div
					style={{
						display: "grid",
						gap: "10px",
					}}
				>
<div
	style={{
		display: "grid",
		gap: "11px",
		marginTop: "60px",
		maxWidth: "520px",
	}}
>
	<span style={{ ...sectionEyebrowStyle, width: "fit-content", minWidth: "220px", padding: "6px 12px" }}>TODAY&apos;S VENUES</span>
	<h3 style={sectionTitleStyle}>今日開催される会場</h3>
	{todayFeedUpdatedAt ? (
		<p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: boatTheme.colors.aquaDeep, fontWeight: 700 }}>
			Data updated: {todayFeedUpdatedAt}
		</p>
	) : null}
</div>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
						gap: "18px",
						alignItems: "stretch",
					}}
				>
					{featuredVenues.map((venue) => (
						(() => {
							const venueTone = getVenueCardTone(venue.session);
							const accentColor = getVenueAccentColor(venue.session);
							const weatherSummary = getVenueWeatherSummary(venue.weatherActual);
							return (
						<article
							key={venue.id}
							style={{
								...featuredVenueCardStyle,
								...venueTone,
								boxShadow: "0 24px 52px rgba(17, 64, 92, 0.12)",
							}}
							onMouseEnter={(event) => {
								elevateCard(event.currentTarget, true, {
									borderColor: typeof venueTone.border === "string" ? venueTone.border : undefined,
									boxShadow: "0 24px 52px rgba(17, 64, 92, 0.12)",
								});
							}}
							onMouseLeave={(event) => {
								elevateCard(event.currentTarget, false, {
									borderColor: typeof venueTone.border === "string" ? venueTone.border : undefined,
									boxShadow: "0 24px 52px rgba(17, 64, 92, 0.12)",
								});
							}}
						>
							<div style={{ display: "grid", gap: "16px", height: "100%" }}>
								<div
									style={{
										height: "4px",
										width: "100%",
										borderRadius: "999px",
										background: `linear-gradient(90deg, ${accentColor}, rgba(255, 255, 255, 0.7))`,
										boxShadow: `0 8px 18px ${accentColor}22`,
									}}
								/>
								<span style={{ color: accentColor, fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
									Featured Venue
								</span>

								<div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
									<span style={{ color: accentColor, fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
									</span>
									<span
										style={{
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											padding: "6px 10px",
											borderRadius: "999px",
											fontSize: "0.72rem",
											fontWeight: 800,
											letterSpacing: "0.12em",
											textTransform: "uppercase",
											...getVenueSessionStyle(venue.session),
										}}
									>
										{getVenueSessionLabel(venue.session)}
									</span>
									{getVenueGradeLabel(venue.title) ? (
										<span
											style={{
												display: "inline-flex",
												alignItems: "center",
												justifyContent: "center",
												padding: "6px 10px",
												borderRadius: "999px",
												fontSize: "0.72rem",
												fontWeight: 800,
												letterSpacing: "0.08em",
												textTransform: "uppercase",
												...getGradeChipStyle(getVenueGradeLabel(venue.title) ?? undefined),
											}}
										>
											{getVenueGradeLabel(venue.title)}
										</span>
									) : null}
								</div>

								<div style={{ display: "grid", gap: "8px" }}>
									<h4 style={{ margin: 0, fontSize: "1.78rem", fontWeight: 800, color: boatTheme.colors.navy }}>{venue.venueName}</h4>
									<p style={{ margin: 0, color: boatTheme.colors.muted, fontWeight: 700, fontSize: "1.04rem" }}>{venue.title || "開催情報確認中"}</p>
								</div>

								<p style={{ margin: "auto 0 0", color: boatTheme.colors.muted, lineHeight: 1.7, fontSize: "0.94rem" }}>
									{getFeaturedVenueNote(venue.venueName)}
								</p>

								<p style={{ margin: 0, color: boatTheme.colors.muted, lineHeight: 1.55, fontSize: "0.84rem" }}>
									{weatherSummary}
								</p>
							</div>
						</article>
							);
						})()
					))}
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fill, 180px)",
						gridAutoRows: "180px",
						gap: "18px",
						alignItems: "start",
						justifyContent: "start",
					}}
				>
					{standardVenues.map((venue) => (
						(() => {
							const timeBand = getDashboardVenueTimeBand(venue);
							const venueTone = getVenueCardTone(timeBand);
							const accentColor = getVenueAccentColor(timeBand);
							const weatherSummary = getVenueWeatherSummary(venue.weatherActual);
							return (
						<article
							key={venue.id}
							style={{
								...compactVenueCardStyle,
								...venueTone,
								boxShadow: "0 14px 28px rgba(17, 64, 92, 0.07)",
								position: "relative",
								overflow: "hidden",
							}}
							onMouseEnter={(event) => {
								elevateCard(event.currentTarget, true, {
									borderColor: typeof venueTone.border === "string" ? venueTone.border : undefined,
									boxShadow: "0 14px 28px rgba(17, 64, 92, 0.07)",
								});
							}}
							onMouseLeave={(event) => {
								elevateCard(event.currentTarget, false, {
									borderColor: typeof venueTone.border === "string" ? venueTone.border : undefined,
									boxShadow: "0 14px 28px rgba(17, 64, 92, 0.07)",
								});
							}}
						>
							<div
								aria-hidden="true"
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									right: 0,
									height: "4px",
									background: `linear-gradient(90deg, ${accentColor}, rgba(255, 255, 255, 0.72))`,
									boxShadow: `0 8px 18px ${accentColor}22`,
								}}
							/>
							<div style={{ display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", gap: "8px", height: "100%", minHeight: 0 }}>
								<span
										style={{
											display: "inline-flex",
											alignItems: "center",
											justifyContent: "center",
											minWidth: "82px",
											height: "28px",
											padding: "0 10px",
											borderRadius: "999px",
											fontSize: "0.68rem",
											fontWeight: 800,
											letterSpacing: "0.08em",
											textTransform: "uppercase",
											whiteSpace: "nowrap",
											flexShrink: 0,
											...getVenueSessionStyle(timeBand),
										}}
									>
										{getVenueSessionLabel(timeBand)}
									</span>

								<div style={{ display: "grid", gap: "5px", minHeight: 0, overflow: "hidden" }}>
									<h4 style={{ margin: 0, fontSize: "1.32rem", fontWeight: 800, color: boatTheme.colors.navy }}>{venue.venueName}</h4>
									<p style={{ margin: 0, color: boatTheme.colors.muted, fontWeight: 700, fontSize: "0.94rem" }}>{venue.title || "開催情報確認中"}</p>
								</div>

								<p style={{ margin: "auto 0 0", color: boatTheme.colors.muted, lineHeight: 1.35, fontSize: "0.74rem", fontWeight: 700 }}>
									{weatherSummary}
								</p>

							</div>
						</article>
							);
						})()
					))}
				</div>
			</section>

			<section style={{ display: "grid", gap: "14px" }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
						gap: "18px",
						alignItems: "start",
					}}
				>
<article
	style={{
		display: "grid",
		gap: "6px",
		marginTop: "50px",
		maxWidth: "420px",
	}}
>
	<span style={{ ...sectionEyebrowStyle, width: "fit-content", padding: "6px 12px" }}>Upcoming Race Schedule</span>
	<h3 style={sectionTitleStyle}>直近の開催スケジュール</h3>
	{upcomingUpdatedAt ? (
		<p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: boatTheme.colors.aquaDeep, fontWeight: 700 }}>
			Schedule updated: {upcomingUpdatedAt}
		</p>
	) : null}
</article>

					<div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(180px, 240px)", gap: "12px" }}>
						<div
	style={{
		...panelStyle,
		padding: "18px 20px",
		background: boatTheme.background.highlight,
		marginTop: "50px",
	}}
>
							<p style={{ margin: 0, fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.14em", color: boatTheme.colors.aquaDeep, fontWeight: 800 }}>
								Upcoming Pickup
							</p>
							<p style={{ margin: "10px 0 0", fontSize: "2rem", fontWeight: 800, color: boatTheme.colors.navy }}>{upcomingSchedules.length}開催</p>
						</div>

						<div style={{ ...sectionVisualStyle, minHeight: "132px", padding: "14px 16px" ,marginTop: "50px",}}>
							<img
								src={withBasePath("dashboard/dashboard-upcoming-schedule-funako.png")}
								alt="Upcoming Race Schedule セクションに添える funako のスケジュール案内ビジュアル"
								style={{ ...dashboardImageStyle, maxWidth: "min(100%, 220px)", maxHeight: "164px" }}
								onError={(event) => {
									event.currentTarget.style.display = "none";
								}}
							/>
						</div>
					</div>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
						gap: "16px",
						alignItems: "stretch",
					}}
				>
					{featuredSchedules.map((schedule) => (
						<article
							key={schedule.id}
							style={featuredScheduleCardStyle}
							onMouseEnter={(event) => {
								elevateCard(event.currentTarget, true);
							}}
							onMouseLeave={(event) => {
								elevateCard(event.currentTarget, false);
							}}
						>
							<div style={{ display: "grid", gap: "14px", height: "100%" }}>
								<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
									<p style={{ margin: 0, fontWeight: 800, color: boatTheme.colors.navy, fontSize: "1.28rem" }}>{schedule.venueName}</p>
									<span
										style={{
											padding: "7px 11px",
											borderRadius: "999px",
											fontSize: "0.76rem",
											fontWeight: 800,
											letterSpacing: "0.08em",
											textTransform: "uppercase",
											border: "1px solid rgba(93, 199, 232, 0.12)",
											...getGradeChipStyle(schedule.grade),
										}}
									>
										{schedule.grade}
									</span>
								</div>

								<p style={{ margin: 0, color: boatTheme.colors.navy, fontWeight: 700, lineHeight: 1.5, fontSize: "1.02rem" }}>{schedule.title}</p>
								<p style={{ margin: 0, color: boatTheme.colors.navy, fontWeight: 800, letterSpacing: "0.03em", fontSize: "1rem" }}>{schedule.dateRange}</p>
								<p
									style={{
										margin: "auto 0 0",
										display: "inline-flex",
										width: "fit-content",
										padding: "6px 10px",
										borderRadius: "999px",
										fontWeight: 700,
										fontSize: "0.8rem",
										...getScheduleSessionChipStyle(schedule.session),
									}}
								>
									{schedule.session}
								</p>
							</div>
						</article>
					))}
				</div>

				<div
					style={{
						position: "relative",
						overflow: "hidden",
						padding: "12px 0 16px",
						marginTop: "4px",
					}}
				>
					<div
						aria-hidden="true"
						style={{
							position: "absolute",
							left: 0,
							top: 0,
							bottom: 0,
							width: "72px",
							zIndex: 2,
							pointerEvents: "none",
							background: "linear-gradient(90deg, rgba(244, 251, 255, 0.96), rgba(244, 251, 255, 0))",
						}}
					/>
					<div
						aria-hidden="true"
						style={{
							position: "absolute",
							right: 0,
							top: 0,
							bottom: 0,
							width: "72px",
							zIndex: 2,
							pointerEvents: "none",
							background: "linear-gradient(270deg, rgba(244, 251, 255, 0.96), rgba(244, 251, 255, 0))",
						}}
					/>
					<div className="boat-schedule-rail-track">
						{flowingSchedules.map((schedule, index) => (
							<article
								key={`${schedule.id}-${index}`}
								style={scheduleRailCardStyle}
								onMouseEnter={(event) => {
									elevateCard(event.currentTarget, true, {
										boxShadow: "0 14px 28px rgba(17, 64, 92, 0.07)",
									});
								}}
								onMouseLeave={(event) => {
									elevateCard(event.currentTarget, false, {
										boxShadow: "0 14px 28px rgba(17, 64, 92, 0.07)",
									});
								}}
							>
								<div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center" }}>
									<p style={{ margin: 0, fontWeight: 800, color: boatTheme.colors.navy, fontSize: "1.08rem" }}>{schedule.venueName}</p>
									<span
										style={{
											padding: "7px 11px",
											borderRadius: "999px",
											fontSize: "0.76rem",
											fontWeight: 800,
											letterSpacing: "0.08em",
											textTransform: "uppercase",
											border: "1px solid rgba(93, 199, 232, 0.12)",
											...getGradeChipStyle(schedule.grade),
										}}
									>
										{schedule.grade}
									</span>
								</div>

								<p style={{ margin: "14px 0 0", color: boatTheme.colors.navy, fontWeight: 700, lineHeight: 1.5 }}>{schedule.title}</p>
								<p style={{ margin: "12px 0 0", color: boatTheme.colors.navy, fontWeight: 800, letterSpacing: "0.03em" }}>{schedule.dateRange}</p>
								<p
									style={{
										margin: "8px 0 0",
										display: "inline-flex",
										width: "fit-content",
										padding: "6px 10px",
										borderRadius: "999px",
										background: "rgba(223, 245, 255, 0.76)",
										border: "1px solid rgba(93, 199, 232, 0.14)",
										color: boatTheme.colors.aquaDeep,
										fontWeight: 700,
										fontSize: "0.8rem",
									}}
								>
									{schedule.session}
								</p>
							</article>
						))}
					</div>
				</div>
			</section>

			<section
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "16px",
					marginTop: "50px",
				}}
			>
				<article style={{ ...panelStyle, padding: "24px" }}>
					<h3 style={sectionTitleStyle}>Surface Notes</h3>
					<div style={{ marginTop: "16px", display: "grid", gap: "12px" }}>
						{venueNotes.map((note) => (
							<div
								key={note}
								style={{
									padding: "14px 16px",
									borderRadius: "18px",
									background: boatTheme.background.subtle,
									border: `1px solid ${boatTheme.colors.line}`,
									lineHeight: 1.8,
									color: boatTheme.colors.muted,
								}}
							>
								{note}
							</div>
						))}
					</div>
				</article>

				<a href="#mobile-page" style={mobileLinkCardStyle}>
					<div style={{ display: "grid", gap: "12px" }}>
						<span style={{ ...sectionEyebrowStyle, width: "fit-content" }}>Mobile View</span>
						<h3 style={sectionTitleStyle}>スマホ向け画面へ移動</h3>
						<p style={{ margin: 0, color: boatTheme.colors.muted, lineHeight: 1.8 }}>
							スマホで今日のレースを確認。
						</p>
						<div style={{ marginTop: "4px", display: "grid", gap: "10px" }}>
							{boatTheme.tokens.slice(0, 3).map((token) => (
								<div
									key={token}
									style={{
										display: "flex",
										alignItems: "center",
										gap: "12px",
										padding: "12px 14px",
										borderRadius: "16px",
										background: "rgba(255, 255, 255, 0.86)",
										border: `1px solid ${boatTheme.colors.line}`,
										color: boatTheme.colors.navy,
										fontWeight: 600,
									}}
								>
									<span
										aria-hidden="true"
										style={{
											width: "10px",
											height: "10px",
											borderRadius: "999px",
											background: boatTheme.colors.aqua,
											boxShadow: `0 0 0 6px ${boatTheme.colors.glow}`,
										}}
									/>
									{token}
								</div>
							))}
						</div>
					</div>

					<div style={{ ...sectionVisualStyle, minHeight: "220px", padding: "18px" }}>
						<img
							src={withBasePath("dashboard/dashboard-mobile-view-funako.png")}
							alt="Mobile View ページへの導線を示す funako のモバイルビジュアル"
							style={{ ...dashboardImageStyle, maxWidth: "min(100%, 280px)", maxHeight: "240px" }}
							onError={(event) => {
								event.currentTarget.style.display = "none";
							}}
						/>
					</div>
				</a>
			</section>
		</div>
	);
}
