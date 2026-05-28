import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BoatRaceDetailPanel } from "../components/boatrace/BoatRaceDetailPanel";
import { BoatRaceQuickSelector } from "../components/boatrace/BoatRaceQuickSelector";
import { BoatVenueSelectorPanel } from "../components/boatrace/BoatVenueSelectorPanel";
import { BoatVenueSpotlight } from "../components/boatrace/BoatVenueSpotlight";
import { buildVenueExtraPanelOptions } from "../components/boatrace/venueExtras/venueExtraPanelOptions";
import {
	createVenueExtraPanelFlags,
	resolveInitialVenueExtraPanel,
	resolvePreferredVenueExtraPanel,
	resolveValidVenueExtraPanel,
} from "../components/boatrace/venueExtras/venueExtraPanelState";
import {
	venueExtrasBodyCellStyle,
	venueExtrasHeadCellStyle,
	venueExtrasTableStyle,
	venueExtrasTableWrapStyle,
} from "../components/boatrace/venueExtras/venueExtraStyles";
import type { VenueExtraPanelKey } from "../components/boatrace/venueExtras/venueExtraTypes";
import {
	getOfficialStartFlag,
	getOfficialStartTimingValue,
	getVenueExtraVenueFlags,
	isVenueExtraRecord,
	normalizeVenueExtraPlayerName,
	readVenueExtraNumber,
	readVenueExtraRate,
	readVenueExtraString,
	readVenueExtraStringArray,
	sumVenueExtraRates,
} from "../components/boatrace/venueExtras/venueExtraUtils";
import { SectionCard } from "../components/common/SectionCard";
import { PageShell } from "../components/layout/PageShell";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import { withBasePath } from "../lib/assetPath";
import type { BoatOddsPreviewGroup, BoatRacerItem, BoatTodayVenueItem, BoatWeatherActual } from "../lib/boatraceTypes";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
import { buildCommonRaceFallbackRacers, isRaceEntryMissingOrThin } from "../lib/boatRaceRacerNormalizer";
import { boatTheme } from "../lib/theme";


const venueFlowStyle = {
	display: "grid",
	gap: "26px",
	marginTop: "28px",
};

const feedActionGroupStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const venueActionRowStyle = {
	display: "grid",
	gap: "10px",
	justifyItems: "end" as const,
};

function getVenueTimeBandPriority(venue: BoatTodayVenueItem) {
	const timeBand = getVenueTimeBand(venue);

	if (timeBand === "morning") {
		return 0;
	}

	if (timeBand === "day") {
		return 1;
	}

	if (timeBand === "night") {
		return 2;
	}

	if (timeBand === "midnight") {
		return 3;
	}

	return 9;
}

function getVenueTimeBand(venue: BoatTodayVenueItem): "morning" | "day" | "night" | "midnight" | "unknown" {
	const venueRecord = venue as BoatTodayVenueItem & Record<string, unknown>;
	const normalizedSession = String(venue.session ?? "").trim().normalize("NFKC").toLowerCase();
	const titleText = [
		venue.title,
		venueRecord.seriesName,
		venueRecord.eventName,
		venueRecord.raceTitle,
		venueRecord.gradeName,
	]
		.map((value) => String(value ?? "").trim())
		.filter(Boolean)
		.join(" ");
	const normalizedTitle = titleText.replace(/\s+/g, "").normalize("NFKC").toLowerCase();

	if (
		normalizedSession === "midnight" ||
		normalizedTitle.includes("mnb") ||
		normalizedTitle.includes("ミッドナイト")
	) {
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
}

function getVenueDisplaySession(venue: BoatTodayVenueItem): BoatTodayVenueItem["session"] {
	const timeBand = getVenueTimeBand(venue);

	return timeBand === "unknown" ? venue.session : timeBand as BoatTodayVenueItem["session"];
}

function getVenueFirstRaceSortableTime(venue: BoatTodayVenueItem) {
	const firstRace = venue.races.find((race) => race.raceNo === 1) ?? venue.races[0];
	const rawValue = firstRace?.deadlineTime?.trim() || firstRace?.startTime?.trim() || "";
	const match = rawValue.match(/^(\d{1,2}):(\d{2})$/);

	if (!match) {
		return null;
	}

	return Number(match[1]) * 60 + Number(match[2]);
}

function sortTodayVenues(venues: BoatTodayVenueItem[]) {
	return venues
		.map((venue, index) => ({
			venue,
			index,
			priority: getVenueTimeBandPriority(venue),
			firstRaceTime: getVenueFirstRaceSortableTime(venue),
			stableKey: (venue.venueCode || venue.venueName || "").toString(),
		}))
		.sort((left, right) => {
			if (left.priority !== right.priority) {
				return left.priority - right.priority;
			}

			if (left.firstRaceTime !== null && right.firstRaceTime !== null && left.firstRaceTime !== right.firstRaceTime) {
				return left.firstRaceTime - right.firstRaceTime;
			}

			const stableKeyCompare = left.stableKey.localeCompare(right.stableKey, "ja");
			if (stableKeyCompare !== 0) {
				return stableKeyCompare;
			}

			return left.index - right.index;
		})
		.map((item) => item.venue);
}

const venueActionGroupStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const updatedChipStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "11px 15px",
	borderRadius: "999px",
	background: "rgba(240, 248, 253, 0.94)",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.78rem",
	fontWeight: 700,
	lineHeight: 1.4,
};

const pageContentStyle = {
	width: "100%",
	minWidth: 0,
	marginInline: "auto",
	display: "grid",
	gap: "22px",
	paddingTop: "20px",
	marginTop: "-304px",
	position: "relative" as const,
	zIndex: 1,
};

const openSectionStyle = {
	display: "grid",
	gap: "18px",
};

const detailIntroCardStyle = {
	padding: "18px 20px",
	borderRadius: "24px",
	background: "linear-gradient(180deg, rgba(248, 253, 255, 0.96), rgba(233, 247, 244, 0.92))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "8px",
	boxShadow: "0 14px 32px rgba(17, 64, 92, 0.05)",
};

const detailIntroLabelStyle = {
	margin: 0,
	fontSize: "0.72rem",
	letterSpacing: "0.12em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 800,
};

const detailIntroTitleStyle = {
	margin: 0,
	fontSize: "1.28rem",
	lineHeight: 1.18,
	color: boatTheme.colors.navy,
	fontWeight: 800,
};

const detailIntroTextStyle = {
	margin: 0,
	fontSize: "0.88rem",
	lineHeight: 1.6,
	color: boatTheme.colors.muted,
};

const venueExtrasSectionStyle = {
	position: "relative" as const,
	padding: "30px",
	borderRadius: "34px",
	background:
		"radial-gradient(circle at 12% 0%, rgba(206, 243, 255, 0.72), transparent 30%), radial-gradient(circle at 92% 12%, rgba(231, 224, 255, 0.72), transparent 28%), linear-gradient(135deg, rgba(250, 254, 255, 0.99), rgba(235, 250, 247, 0.98) 48%, rgba(236, 243, 255, 0.96))",
	border: "1px solid rgba(104, 203, 227, 0.3)",
	boxShadow: "0 26px 60px rgba(17, 64, 92, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.92)",
	display: "grid",
	gap: "22px",
	overflow: "hidden" as const,
};

const venueExtrasHeaderStyle = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "18px",
	flexWrap: "wrap" as const,
};

const venueExtrasTitleWrapStyle = {
	display: "grid",
	gap: "7px",
	maxWidth: "760px",
};

const venueExtrasLabelStyle = {
	margin: 0,
	fontSize: "0.74rem",
	letterSpacing: "0.12em",
	textTransform: "uppercase" as const,
	color: boatTheme.colors.aquaDeep,
	fontWeight: 900,
};

const venueExtrasTitleStyle = {
	margin: 0,
	fontSize: "1.2rem",
	lineHeight: 1.3,
	color: boatTheme.colors.navy,
	fontWeight: 900,
};

const venueExtrasTextStyle = {
	margin: 0,
	fontSize: "0.86rem",
	lineHeight: 1.7,
	color: boatTheme.colors.muted,
};

const venueExtrasBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "8px 13px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.86)",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.76rem",
	fontWeight: 900,
	whiteSpace: "nowrap" as const,
};

const venueExtrasHeaderMetaStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "8px",
	justifyContent: "flex-end",
	alignItems: "center",
	maxWidth: "560px",
};

const venueExtrasStatusGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
	gap: "10px",
};

const venueExtrasPanelSelectorWrapStyle = {
	display: "grid",
	gap: "10px",
};

const venueExtrasPanelSelectorScrollStyle = {
	overflowX: "auto" as const,
	overflowY: "hidden" as const,
	paddingBottom: "4px",
	marginInline: "-4px",
	paddingInline: "4px",
	WebkitOverflowScrolling: "touch" as const,
	scrollbarColor: "rgba(93, 199, 232, 0.34) rgba(255, 255, 255, 0.42)",
	scrollbarWidth: "thin" as const,
};

const venueExtrasPanelSelectorGridStyle = {
	display: "flex",
	flexWrap: "nowrap" as const,
	gap: "12px",
	minWidth: "max-content",
	alignItems: "stretch" as const,
	scrollSnapType: "x proximity" as const,
};

const venueExtrasPanelButtonBaseStyle = {
	display: "grid",
	gap: "9px",
	flex: "0 0 240px",
	padding: "16px",
	borderRadius: "22px",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(247, 253, 255, 0.82))",
	boxShadow: "0 12px 26px rgba(17, 64, 92, 0.055), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
	textAlign: "left" as const,
	cursor: "pointer",
	transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
	minHeight: "146px",
	height: "100%",
	scrollSnapAlign: "start" as const,
};

const venueExtrasPanelButtonTopStyle = {
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	gap: "8px",
};

const venueExtrasPanelButtonBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "5px 9px",
	borderRadius: "999px",
	background: "rgba(225, 247, 253, 0.92)",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.7rem",
	fontWeight: 900,
	letterSpacing: "0.04em",
	whiteSpace: "nowrap" as const,
};

const venueExtrasPanelStatusDotStyle = {
	width: "9px",
	height: "9px",
	borderRadius: "999px",
	background: "#64d7ba",
	boxShadow: "0 0 0 4px rgba(100, 215, 186, 0.14)",
};

const venueExtrasPanelButtonTitleStyle = {
	margin: 0,
	fontSize: "0.9rem",
	lineHeight: 1.35,
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const venueExtrasPanelButtonHintStyle = {
	margin: 0,
	fontSize: "0.72rem",
	lineHeight: 1.5,
	color: boatTheme.colors.muted,
};

const venueExtrasPanelButtonSummaryStyle = {
	margin: 0,
	alignSelf: "end",
	padding: "9px 10px",
	borderRadius: "15px",
	background: "rgba(238, 249, 252, 0.72)",
	border: "1px solid rgba(93, 199, 232, 0.18)",
	color: boatTheme.colors.navy,
	fontSize: "0.74rem",
	lineHeight: 1.45,
	fontWeight: 800,
};

const venueExtrasCategoryCaptionStyle = {
	margin: 0,
	fontSize: "0.76rem",
	lineHeight: 1.65,
	color: boatTheme.colors.muted,
	fontWeight: 700,
};

const narutoStatsTabWrapStyle = {
	display: "grid",
	gap: "12px",
};

const narutoStatsTabScrollStyle = {
	overflowX: "auto" as const,
	paddingBottom: "4px",
	marginInline: "-4px",
	paddingInline: "4px",
	WebkitOverflowScrolling: "touch" as const,
};

const narutoStatsTabGridStyle = {
	display: "grid",
	gridAutoFlow: "column" as const,
	gridAutoColumns: "minmax(148px, 1fr)",
	gap: "10px",
	minWidth: "max-content",
};

const narutoStatsTabButtonBaseStyle = {
	display: "grid",
	gap: "6px",
	padding: "12px 14px",
	borderRadius: "16px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.94)",
	boxShadow: "0 8px 20px rgba(17, 64, 92, 0.05)",
	textAlign: "left" as const,
	cursor: "pointer",
	transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
	minHeight: "72px",
};

const narutoStatsTabTitleStyle = {
	margin: 0,
	fontSize: "0.84rem",
	lineHeight: 1.35,
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const narutoStatsTabHintStyle = {
	margin: 0,
	fontSize: "0.7rem",
	lineHeight: 1.45,
	color: boatTheme.colors.muted,
};

const venueExtrasStatusCardStyle = {
	padding: "14px 16px",
	borderRadius: "20px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(246, 253, 255, 0.86))",
	border: "1px solid rgba(93, 199, 232, 0.2)",
	display: "grid",
	gap: "4px",
	boxShadow: "0 10px 24px rgba(17, 64, 92, 0.045)",
};

const venueExtrasStatusLabelStyle = {
	margin: 0,
	fontSize: "0.72rem",
	letterSpacing: "0.08em",
	color: boatTheme.colors.aquaDeep,
	fontWeight: 900,
};

const venueExtrasStatusValueStyle = {
	margin: 0,
	fontSize: "0.96rem",
	lineHeight: 1.45,
	color: boatTheme.colors.navy,
	fontWeight: 900,
};

const venueOfficialLinkStatusChipBaseStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "8px 13px",
	borderRadius: "999px",
	fontSize: "0.76rem",
	fontWeight: 900,
	whiteSpace: "nowrap" as const,
	letterSpacing: "0.02em",
	border: "1px solid transparent",
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.06)",
};

const venueOfficialLinkStatusValueStyle = {
	...venueExtrasStatusValueStyle,
	display: "inline-flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const venueOfficialLinkStatusDescriptionStyle = {
	margin: 0,
	fontSize: "0.74rem",
	lineHeight: 1.55,
	color: boatTheme.colors.muted,
};

const venueExtrasEmptyStyle = {
	margin: 0,
	padding: "16px 17px",
	borderRadius: "20px",
	background: "linear-gradient(180deg, rgba(250, 253, 255, 0.9), rgba(242, 250, 253, 0.86))",
	border: "1px dashed rgba(93, 199, 232, 0.42)",
	color: boatTheme.colors.muted,
	fontSize: "0.86rem",
	lineHeight: 1.75,
};

const venueExtrasDataGridStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
	gap: "18px",
	alignItems: "start" as const,
};

const venueExtrasPanelStyle = {
	padding: "21px",
	borderRadius: "28px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(246, 253, 255, 0.9))",
	border: "1px solid rgba(93, 199, 232, 0.2)",
	boxShadow: "0 14px 30px rgba(17, 64, 92, 0.055), inset 0 1px 0 rgba(255, 255, 255, 0.86)",
	display: "grid",
	gap: "15px",
};

const venueExtrasPanelTitleStyle = {
	margin: 0,
	fontSize: "0.95rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const venueExtrasFocusListStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "8px",
};

const venueExtrasFocusPillStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "6px 10px",
	borderRadius: "999px",
	background: "rgba(225, 247, 253, 0.9)",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 900,
	whiteSpace: "nowrap" as const,
};

const venueExtrasCommentStyle = {
	margin: 0,
	padding: "10px 11px",
	borderRadius: "14px",
	background: "rgba(245, 251, 253, 0.92)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.muted,
	fontSize: "0.8rem",
	lineHeight: 1.65,
	fontWeight: 700,
};

const venueExtrasCommentListStyle = {
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
	gap: "10px",
	alignItems: "stretch" as const,
};

const venueExtrasRacerCommentCardStyle = {
	padding: "13px 14px",
	borderRadius: "18px",
	background: "linear-gradient(180deg, rgba(250, 254, 255, 0.98), rgba(243, 251, 253, 0.94))",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "8px",
	boxShadow: "0 8px 18px rgba(17, 64, 92, 0.04)",
};

const venueExtrasRacerCommentHeaderStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
};

const venueExtrasRacerCommentFrameStyle = {
	margin: 0,
	fontSize: "0.78rem",
	fontWeight: 900,
	color: boatTheme.colors.aquaDeep,
};

const venueExtrasRacerCommentTextStyle = {
	margin: 0,
	fontSize: "0.8rem",
	lineHeight: 1.65,
	color: boatTheme.colors.navy,
	fontWeight: 700,
	whiteSpace: "pre-wrap" as const,
};

const narutoStartScrollStyle = {
	overflowX: "auto" as const,
	paddingBottom: "4px",
	marginInline: "-4px",
	paddingInline: "4px",
	WebkitOverflowScrolling: "touch" as const,
};

const narutoStartBoardStyle = {
	display: "grid",
	gap: "12px",
	minWidth: "720px",
};

const narutoFramePalette: Record<number, { background: string; color: string; border: string }> = {
	1: { background: "linear-gradient(135deg, #f8fbff, #e6eef7)", color: "#20364a", border: "rgba(112, 138, 162, 0.58)" },
	2: { background: "linear-gradient(135deg, #2b2b2b, #4a4a4a)", color: "#ffffff", border: "rgba(255, 255, 255, 0.36)" },
	3: { background: "linear-gradient(135deg, #ef5350, #d32f2f)", color: "#ffffff", border: "rgba(255, 255, 255, 0.28)" },
	4: { background: "linear-gradient(135deg, #3b82f6, #1d4ed8)", color: "#ffffff", border: "rgba(255, 255, 255, 0.28)" },
	5: { background: "linear-gradient(135deg, #f7d54a, #e0a400)", color: "#3c2d00", border: "rgba(120, 89, 0, 0.34)" },
	6: { background: "linear-gradient(135deg, #4caf50, #2e7d32)", color: "#ffffff", border: "rgba(255, 255, 255, 0.28)" },
};

const narutoStartRowStyle = {
	display: "grid",
	gap: "10px",
};

const narutoStartMetaStyle = {
	display: "grid",
	gap: "6px",
};

const narutoStartMetaTopStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const narutoStartCourseBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: "72px",
	padding: "5px 10px",
	borderRadius: "999px",
	background: "rgba(221, 239, 247, 0.95)",
	border: "1px solid rgba(93, 199, 232, 0.24)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.72rem",
	fontWeight: 900,
	letterSpacing: "0.04em",
};

const narutoStartPlayerStyle = {
	margin: 0,
	fontSize: "0.9rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
	lineHeight: 1.4,
};

const narutoStartMetaDetailStyle = {
	display: "flex",
	flexWrap: "wrap" as const,
	gap: "8px",
	fontSize: "0.76rem",
	fontWeight: 800,
	lineHeight: 1.5,
	color: boatTheme.colors.muted,
};

const narutoStartWaterStyle = {
	display: "grid",
	gridTemplateColumns: "84px minmax(0, 1fr) auto",
	alignItems: "center",
	gap: "12px",
	minHeight: "74px",
	padding: "10px 12px",
	borderRadius: "18px",
	background: "linear-gradient(90deg, rgba(219, 238, 247, 0.58), rgba(183, 221, 235, 0.78) 22%, rgba(136, 196, 219, 0.92) 72%, rgba(102, 178, 206, 0.98))",
	border: "1px solid rgba(84, 153, 186, 0.22)",
	position: "relative" as const,
	overflow: "hidden" as const,
};

const narutoStartLaneLabelStyle = {
	display: "grid",
	gap: "4px",
	justifyItems: "start" as const,
	position: "relative" as const,
	zIndex: 1,
};

const narutoStartLaneTextStyle = {
	margin: 0,
	fontSize: "0.7rem",
	fontWeight: 900,
	letterSpacing: "0.05em",
	color: "rgba(13, 56, 82, 0.82)",
	textTransform: "uppercase" as const,
};

const narutoStartLaneSubTextStyle = {
	margin: 0,
	fontSize: "0.76rem",
	fontWeight: 800,
	color: boatTheme.colors.navy,
	lineHeight: 1.35,
};

const narutoStartTrackStyle = {
	position: "relative" as const,
	minHeight: "54px",
	borderRadius: "16px",
	background: "linear-gradient(90deg, rgba(255,255,255,0.12), rgba(255,255,255,0.22))",
	border: "1px dashed rgba(255,255,255,0.36)",
	boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)",
	overflow: "hidden" as const,
};

const narutoStartLineStyle = {
	position: "absolute" as const,
	top: "-6px",
	bottom: "-6px",
	left: "84%",
	width: "0px",
	borderLeft: "2px solid rgba(255,255,255,0.88)",
	boxShadow: "0 0 0 1px rgba(11, 67, 94, 0.1)",
	zIndex: 1,
};

const narutoStartLineLabelStyle = {
	position: "absolute" as const,
	right: "12px",
	top: "8px",
	zIndex: 2,
	display: "inline-flex",
	flexDirection: "column" as const,
	alignItems: "center",
	justifyContent: "center",
	gap: "1px",
	padding: "5px 9px",
	borderRadius: "999px",
	background: "rgba(15, 74, 101, 0.72)",
	border: "1px solid rgba(255, 255, 255, 0.42)",
	color: "#fff",
	fontSize: "0.64rem",
	fontWeight: 900,
	lineHeight: 1.05,
	letterSpacing: "0.04em",
	boxShadow: "0 8px 16px rgba(17, 64, 92, 0.16)",
	pointerEvents: "none" as const,
};

const narutoStartTrackWaveStyle = {
	position: "absolute" as const,
	inset: 0,
	background: "repeating-linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 8px, rgba(255,255,255,0) 8px, rgba(255,255,255,0) 16px)",
	opacity: 0.75,
};

const narutoStartBoatBaseStyle = {
	position: "absolute" as const,
	top: "50%",
	transform: "translate(-50%, -50%)",
	display: "grid",
	justifyItems: "center" as const,
	gap: "2px",
	minWidth: "106px",
	padding: "8px 16px 8px 14px",
	borderRadius: "999px",
	fontSize: "0.74rem",
	fontWeight: 900,
	lineHeight: 1.1,
	boxShadow: "0 10px 22px rgba(10, 53, 81, 0.2)",
	borderWidth: "1px",
	borderStyle: "solid",
	clipPath: "polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%, 5% 50%)",
	zIndex: 1,
};

const narutoStartTimingBaseStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: "62px",
	padding: "4px 9px",
	borderRadius: "999px",
	fontSize: "0.76rem",
	fontWeight: 900,
	lineHeight: 1,
	boxShadow: "0 8px 18px rgba(12, 58, 88, 0.12)",
	border: "1px solid rgba(255,255,255,0.32)",
	background: "rgba(255,255,255,0.24)",
	position: "relative" as const,
	zIndex: 1,
};

const narutoStartFlagBadgeStyle = {
	position: "absolute" as const,
	right: "-12px",
	top: "-14px",
	zIndex: 5,
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	minWidth: "28px",
	height: "24px",
	padding: "0 8px",
	borderRadius: "999px",
	background: "linear-gradient(135deg, #ff4d5f, #b91c1c)",
	border: "1px solid rgba(255, 255, 255, 0.82)",
	color: "#fff",
	fontSize: "0.68rem",
	fontWeight: 900,
	letterSpacing: "0.06em",
	boxShadow: "0 8px 18px rgba(185, 28, 28, 0.28)",
	pointerEvents: "none" as const,
};

const narutoStartTrackHintStyle = {
	position: "absolute" as const,
	left: "12px",
	bottom: "6px",
	fontSize: "0.62rem",
	fontWeight: 800,
	letterSpacing: "0.03em",
	color: "rgba(10, 61, 88, 0.72)",
	zIndex: 1,
	pointerEvents: "none" as const,
};

const narutoHistoryStackStyle = {
	display: "grid",
	gap: "3px",
	justifyItems: "center" as const,
	minWidth: "34px",
};

const narutoHistoryCourseStyle = {
	fontSize: "0.63rem",
	fontWeight: 900,
	lineHeight: 1,
	color: boatTheme.colors.aquaDeep,
	minHeight: "0.8rem",
};

const narutoHistoryFinishStyle = {
	fontSize: "0.86rem",
	fontWeight: 900,
	lineHeight: 1,
	color: boatTheme.colors.navy,
};

const narutoMeetCellStyle = {
	display: "grid",
	gap: "4px",
	minWidth: "150px",
	whiteSpace: "normal" as const,
	lineHeight: 1.45,
};

const narutoMeetLabelStyle = {
	fontSize: "0.72rem",
	fontWeight: 800,
	color: boatTheme.colors.aquaDeep,
};

const narutoMeetResultStyle = {
	fontSize: "0.82rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const racePageBackgroundImageSrc = withBasePath("races-page/races-page-bg-water-sky-sparkle.png");
const raceHeroImageSrc = withBasePath("races-page/races-hero-boat-team.png");

const getVenueSpotlightImageSrc = (fileName: string) => withBasePath(`races-page/venue-spotlights/${fileName}`);

const heroShellStyle = {
  marginTop: "270px",
  padding: "26px",
  borderRadius: "34px",
  background: "linear-gradient(135deg, rgba(244, 251, 255, 0.98), rgba(220, 244, 241, 0.92))",
  border: `1px solid ${boatTheme.colors.line}`,
  boxShadow: "0 20px 44px rgba(17, 64, 92, 0.08)",
};

const heroInnerStyle = {
  display: "grid",
  gridTemplateColumns: "minmax(460px, 0.95fr) minmax(0, 1.05fr)",
  gap: "28px",
  alignItems: "center",
  minHeight: "420px",
};

const heroImageAreaStyle = {
  minHeight: "360px",
  borderRadius: "28px",
  overflow: "hidden",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  background:
    "radial-gradient(circle at 50% 26%, rgba(255,255,255,0.92), rgba(217,239,245,0.72) 58%, rgba(203,234,232,0.66) 100%)",
};

const heroImageStyle = {
  width: "118%",
  maxWidth: "none",
  height: "auto",
  objectFit: "contain" as const,
  objectPosition: "center bottom",
  display: "block",
  filter: "drop-shadow(0 24px 44px rgba(17, 64, 92, 0.16))",
};

const heroTextAreaStyle = {
  display: "grid",
  alignContent: "center",
  gap: "16px",
  minHeight: "360px",
  padding: "8px 6px 8px 4px",
};

const heroEyebrowStyle = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "8px 14px",
  borderRadius: "999px",
  background: "rgba(255, 255, 255, 0.74)",
  color: boatTheme.colors.aquaDeep,
  fontSize: "0.8rem",
  fontWeight: 800,
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
};

const heroTitleStyle = {
  margin: 0,
  fontSize: "clamp(2.6rem, 4vw, 4.2rem)",
  lineHeight: 1.05,
  color: boatTheme.colors.navy,
  fontWeight: 800,
};

const heroDescriptionStyle = {
  margin: 0,
  fontSize: "1rem",
  lineHeight: 1.9,
  color: boatTheme.colors.muted,
  maxWidth: "36rem",
};

function hasOddsPreviewData(oddsPreview: typeof sampleBoatTodayFeed.venues[number]["races"][number]["oddsPreview"]) {
	if (!oddsPreview) {
		return false;
	}

	if (Array.isArray(oddsPreview)) {
		return oddsPreview.length > 0;
	}

	const groupedOdds = oddsPreview as BoatOddsPreviewGroup;

	return Boolean(
		(groupedOdds.trifectaTop?.length ?? 0)
		|| (groupedOdds.exactaTop?.length ?? 0)
		|| (groupedOdds.quinellaTop?.length ?? 0),
	);
}

const getRaceKey = (venueId: string, raceId: string | undefined, raceNo: number) => raceId ?? `${venueId}-${raceNo}`;

const getFirstSelectableRace = (races: typeof sampleBoatTodayFeed.venues[number]["races"]) => {
	const hasMeaningfulTitle = (raceTitle: string | undefined, raceNo: number) => {
		if (!raceTitle) {
			return false;
		}

		return raceTitle.trim() !== `${raceNo}R`;
	};

	const meaningfulRace = races.find((race) => Boolean(
		hasMeaningfulTitle(race.title, race.raceNo)
		|| race.deadlineTime?.trim()
		|| race.startTime?.trim()
		|| race.racers?.length
		|| race.exhibitions?.length
		|| hasOddsPreviewData(race.oddsPreview)
		|| race.result?.status === "confirmed",
	));

	return meaningfulRace ?? races[0];
};

type BoatVenueExtraRace = {
	raceNo?: number;
	[key: string]: unknown;
};

type BoatVenueExtraVenue = {
	venueCode?: string;
	venueName?: string;
	races?: BoatVenueExtraRace[];
	[key: string]: unknown;
};

type BoatVenueExtrasFeed = {
	version?: number;
	generatedAt?: string;
	date?: string;
	source?: string;
	venues?: BoatVenueExtraVenue[];
};

type BoatVenueOriginalExhibition = {
	frameNo: number;
	className?: string;
	playerName?: string;
	registerNo?: string;
	weight?: string;
	weightAdjustment?: string;
	tilt?: string;
	exhibitionTime?: string;
	motorNo: string;
	oneLapTime: string;
	turnTime: string;
	straightTime: string;
	exhibitionEvaluation: string;
	memo: string;
	source?: string | undefined;
};

type BoatNarutoFrameHistoryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseHistory: string[];
	finishHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatNarutoRecentMeetHistory = {
	label: string;
	results: string;
};

type BoatNarutoRecentHistoryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	histories: BoatNarutoRecentMeetHistory[];
	source?: string | undefined;
};

type BoatNarutoRacerPerformance = {
	byFramePast10: BoatNarutoFrameHistoryRow[];
	narutoRecent: BoatNarutoRecentHistoryRow[];
	nationalRecent: BoatNarutoRecentHistoryRow[];
};

type BoatBiwakoSeriesResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	raceNumbers: string[];
	courses: string[];
	startTimings: string[];
	finishOrders: string[];
	dayLabels: string[];
	source?: string | undefined;
};

type BoatBiwakoFramePast10Row = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatTsuBeforeInfoRow = {
	frameNo: number;
	registerNo: string;
	playerName: string;
	profile: string;
	className: string;
	weight: string;
	weightAdjustment: string;
	tilt: string;
	partsExchange: string;
	previousRaceNo: string;
	previousRaceCourse: string;
	previousRaceStartTiming: string;
	previousRaceFinishOrder: string;
	motorComment: string;
	source?: string | undefined;
};

type BoatTsuRacerCommentRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	comment: string;
	motorComment: string;
	source?: string | undefined;
};

type BoatTsuSeriesResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	raceNumbers: string[];
	courses: string[];
	startTimings: string[];
	finishOrders: string[];
	dayLabels: string[];
	source?: string | undefined;
};

type BoatTsuRecent3History = {
	label: string;
	venueName: string;
	grade: string;
	dateRange: string;
	results: string;
};

type BoatTsuRecent3Row = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	histories: BoatTsuRecent3History[];
	source?: string | undefined;
};

type BoatTsuFramePast10Row = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatTsuMotorHistoryEntry = {
	title: string;
	dateRange: string;
	racerName: string;
	playerName: string;
	results: string;
};

type BoatTsuMotorHistoryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	motorNo: string;
	motorSecondRate: string;
	motorWinRate: string;
	boatNo: string;
	boatSecondRate: string;
	boatWinRate: string;
	previousUser: string;
	recentResults: string;
	motorGrade: string;
	historyEntries: BoatTsuMotorHistoryEntry[];
	boatHistoryEntries: BoatTsuMotorHistoryEntry[];
	source?: string | undefined;
};

type BoatWakamatsuEntryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	averageStart: string;
	nationalWinRate: string;
	nationalSecondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	boatNo: string;
	boatSecondRate: string;
	comment: string;
	motorEvaluation: string;
	earlyGuide: string;
	source?: string | undefined;
};

type BoatWakamatsuBeforeInfoRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	exhibitionTime: string;
	weight: string;
	weightAdjustment: string;
	tilt: string;
	previousRaceNo: string;
	previousRaceCourse: string;
	previousRaceStartTiming: string;
	previousRaceFinishOrder: string;
	previousRaceInfo: string;
	partsExchange: string;
	source?: string | undefined;
};

type BoatWakamatsuSeriesResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	raceNumbers: string[];
	courses: string[];
	startTimings: string[];
	startOrders: string[];
	finishOrders: string[];
	dayLabels: string[];
	source?: string | undefined;
};

type BoatWakamatsuCourseStatsItem = {
	courseNo: number;
	entryCount: string;
	averageStart: string;
	firstCount: string;
	secondCount: string;
	thirdCount: string;
};

type BoatWakamatsuCourseStatsRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseRows: BoatWakamatsuCourseStatsItem[];
	source?: string | undefined;
};

type BoatWakamatsuRecent3History = {
	label: string;
	venueName: string;
	grade: string;
	dateRange: string;
	results: string;
};

type BoatWakamatsuRecent3Row = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	histories: BoatWakamatsuRecent3History[];
	source?: string | undefined;
};

type BoatWakamatsuFramePast10Row = {
	frameNo: number;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatWakamatsuScoreRateGuideRow = {
	frameNo: number;
	registrationNo: string;
	playerName: string;
	className: string;
	averageStart: string;
	winRate: string;
	secondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	scoreRate?: string;
	sectionResults?: string;
	source?: string | undefined;
};

type BoatWakamatsuMotorHistoryEntry = {
	seriesTitle: string;
	playerName: string;
	results: string;
};

type BoatWakamatsuMotorHistoryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	motorNo: string;
	motorWinRate: string;
	motorSecondRate: string;
	bestExhibitionTime: string;
	bestOneLapTime: string;
	bestStraightTime: string;
	bestTurnTime: string;
	historyEntries: BoatWakamatsuMotorHistoryEntry[];
	source?: string | undefined;
};

type BoatFukuokaEntryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	averageStart: string;
	nationalWinRate: string;
	nationalSecondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	boatNo: string;
	boatSecondRate: string;
	comment: string;
	motorEvaluation: string;
	earlyGuide: string;
	source?: string | undefined;
};

type BoatFukuokaBeforeInfoRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	exhibitionTime: string;
	weight: string;
	weightAdjustment: string;
	tilt: string;
	partsExchange: string;
	previousRaceInfo: string;
	motorNo: string;
	motorSecondRate: string;
	source?: string | undefined;
};

type BoatFukuokaMotorEvaluationRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	motorNo: string;
	motorSecondRate: string;
	motorEvaluation: string;
	motorComment: string;
	bestExhibitionTime: string;
	partsExchange: string;
	source?: string | undefined;
};

type BoatFukuokaSeriesResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	raceNumbers: string[];
	courses: string[];
	startTimings: string[];
	finishOrders: string[];
	dayLabels: string[];
	source?: string | undefined;
};

type BoatFukuokaRacerCommentRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	comment: string;
	motorComment: string;
	source?: string | undefined;
};

type BoatFukuokaFramePast10Row = {
	frameNo: number;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatTokuyamaFramePast10Row = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatAshiyaFrameLast10Row = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatKiryuFrameLast10Row = BoatAshiyaFrameLast10Row;

type BoatKiryuCourseResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	course: string;
	entryRate: string;
	averageStart: string;
	firstRate: string;
	secondRate: string;
	thirdRate: string;
	source?: string | undefined;
};

type BoatFukuokaScoreRateGuideRow = {
	frameNo: number;
	registrationNo: string;
	playerName: string;
	className: string;
	averageStart: string;
	winRate: string;
	secondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	scoreRate: string;
	source?: string | undefined;
};

type BoatKojimaBeforeInfoRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	exhibitionTime: string;
	weight: string;
	adjustment: string;
	tilt: string;
	partsExchange: string;
	previousRaceInfo: string;
	motorNo: string;
	motorSecondRate: string;
	preInspectionTime: string;
	source?: string | undefined;
};

type BoatKojimaSeriesResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	raceNumbers: string[];
	courses: string[];
	startTimings: string[];
	finishOrders: string[];
	dayLabels: string[];
	source?: string | undefined;
};

type BoatKojimaRecentHistory = {
	venueName: string;
	grade: string;
	dateRange: string;
	results: string;
};

type BoatKojimaRecentResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	histories: BoatKojimaRecentHistory[];
	source?: string | undefined;
};

type BoatKojimaCourseStatsItem = {
	courseNo: number;
	entryRate: string;
	averageStart: string;
	firstRate: string;
	secondRate: string;
	thirdRate: string;
	fourthRate: string;
	fifthRate: string;
	sixthRate: string;
};

type BoatKojimaCourseStatsRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseRows: BoatKojimaCourseStatsItem[];
	source?: string | undefined;
};

type BoatKojimaMotorStatsRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	motorNo: string;
	motorSecondRate: string;
	motorWinRate: string;
	motorRank: string;
	comment: string;
	bestExhibitionTime: string;
	preInspectionTime: string;
	source?: string | undefined;
};

type BoatKojimaFrameStatsRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	frameStartOrder: string;
	source?: string | undefined;
};

type BoatKojimaScoreRateGuideRow = {
	frameNo: number;
	registrationNo: string;
	playerName: string;
	className: string;
	averageStart: string;
	winRate: string;
	secondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	scoreRate: string;
	source?: string | undefined;
};

type BoatNarutoStartExhibitionDisplayRow = {
	course: number;
	frameNo: number;
	playerName: string;
	currentAverageStart: string;
	startTiming: string;
	startOrder: number | null;
	startLanePosition: number;
	style: string;
};

type NarutoStatsTab = "score" | "frameHistory" | "narutoRecent" | "nationalRecent";

type BoatOmuraEntryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	branch: string;
	age: string;
	weight: string;
	f: string;
	l: string;
	averageStart: string;
	accidentRate: string;
	earlyGuide: string;
	dashEvaluation: string;
	stretchEvaluation: string;
	turnEvaluation: string;
	motorEvaluation: string;
	nationalWinRate: string;
	nationalSecondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	boatNo: string;
	boatSecondRate: string;
	source?: string | undefined;
};

type BoatOmuraPreviousDayResultItem = {
	date: string;
	raceNo: string;
	course: string;
	startTiming: string;
	finishOrder: string;
};

type BoatOmuraPreviousDayResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	date: string;
	items: BoatOmuraPreviousDayResultItem[];
	source?: string | undefined;
};

type BoatOmuraNationalFrameStatsRow = {
	frameNo: number;
	playerName: string;
	firstRate: string;
	secondRate: string;
	thirdRate: string;
	otherRate: string;
	frameTrifectaRate: string;
	frameAverageStart: string;
	frameAverageStartRank: string;
	source?: string | undefined;
};

type BoatOmuraFrameLast10Row = {
	frameNo: number;
	playerName: string;
	courseHistory: string[];
	finishHistory: string[];
	startTimingHistory: string[];
	frameWinRate: string;
	frameAverageStart: string;
	source?: string | undefined;
};

type BoatOmuraRacerCommentsMotorRow = {
	frameNo: number;
	playerName: string;
	comment: string;
	motorEvaluation: string;
	motorNo: string;
	pastCommentUrl: string;
	source?: string | undefined;
};

type BoatOmuraExhibitionInfoRow = {
	frameNo: number;
	course: string;
	playerName: string;
	startTiming: string;
	exhibitionTime: string;
	oneLapTime: string;
	turnTime: string;
	straightTime: string;
	tilt: string;
	partsExchange: string;
	startType: string;
	evaluation: string;
	source?: string | undefined;
};

type BoatVenuePredictionDisplay = {
	confidence: string;
	mainFocus: string[];
	comment: string;
};

type BoatVenueRacerComment = {
	frameNo: number;
	comment: string;
	source?: string | undefined;
};

type BoatVenueMotorSummary = {
	frameNo: number;
	displayFrameNo?: number;
	motorNo: string;
	previousUser: string;
	recentResults: string;
	motorGrade: string;
	comment: string;
	source?: string | undefined;
};

type BoatVenueAbilityIndex = {
	frameNo: number;
	abilityValue: string;
	frameCompatibility: string;
	startPower: string;
	source?: string | undefined;
};

type BoatVenueStartExhibition = {
	course: number;
	frameNo: number;
	playerName?: string;
	className?: string;
	registerNo?: string;
	exhibitionTime?: string;
	currentAverageStart: string;
	style: string;
	startTiming: string;
	startOrder: string;
	startLaneOffset?: number | null;
	source?: string | undefined;
};

type BoatTamagawaEntryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	mark: string;
	fl: string;
	averageStart: string;
	nationalWinRate: string;
	nationalSecondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	boatNo: string;
	boatSecondRate: string;
	earlyGuide: string;
	source?: string | undefined;
};

type BoatTamagawaBeforeInfoRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	weight: string;
	weightAdjustment: string;
	motorNo: string;
	motorSecondRate: string;
	tilt: string;
	previousRaceInfo: string;
	partsExchange: string;
	source?: string | undefined;
};

type BoatTamagawaMotorHistoryEntry = {
	label: string;
	playerName: string;
	results: string;
};

type BoatTamagawaMotorHistoryRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	motorNo: string;
	motorSecondRate: string;
	finals: string;
	championships: string;
	historyEntries: BoatTamagawaMotorHistoryEntry[];
	source?: string | undefined;
};

type BoatTamagawaSeriesResultRow = {
	frameNo: number;
	className: string;
	registerNo: string;
	playerName: string;
	profile: string;
	raceNumbers: string[];
	courses: string[];
	startTimings: string[];
	finishOrders: string[];
	source?: string | undefined;
};

type BoatTamagawaOddsResultDisplay = {
	finishers: Array<{
		rank: string;
		frameNo: number;
		playerName: string;
		raceTime: string;
	}>;
	payouts: Array<{
		betType: string;
		combination: string;
		payout: string;
		popularity: string;
	}>;
	source?: string | undefined;
};

type BoatVenueTideInfo = {
	date: string;
	dayLabel: string;
	highTideTime: string;
	lowTideTime: string;
	tideType: string;
	source?: string | undefined;
};

type BoatVenueWaterSurfaceInfo = {
	surfaceSummary: string;
	featureSummary: string;
	courseSummary: string;
	source?: string | undefined;
};

type BoatVenueWaterMemo = {
	tideInfo: BoatVenueTideInfo | null;
	waterSurfaceInfo: BoatVenueWaterSurfaceInfo | null;
};

type BoatOfficialWeatherCondition = BoatWeatherActual;

type BoatOfficialBeforeInfoExhibitionRow = {
	frameNo: number;
	playerName: string;
	exhibitionTime: string;
	weight?: string;
	weightAdjustment?: string;
	tilt: string;
	course: string;
	startTiming: string;
	partsExchange: string;
	memo: string;
	source?: string | undefined;
};

type BoatOfficialBeforeInfoStartRow = {
	course: number;
	frameNo: number;
	startTiming: string;
	currentAverageStart: string;
	source?: string | undefined;
};

type BoatOfficialBeforeInfoScoreRow = {
	frameNo: number;
	registrationNo: string;
	playerName: string;
	className: string;
	averageStart: string;
	winRate: string;
	secondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	scoreRate?: string;
	sectionResults?: string;
	source?: string | undefined;
};

type BoatOfficialBeforeInfoDisplay = {
	status: string;
	source: string;
	exhibitionRows: BoatOfficialBeforeInfoExhibitionRow[];
	startExhibition: BoatOfficialBeforeInfoStartRow[];
	scoreQuickLook: BoatOfficialBeforeInfoScoreRow[];
	weatherActual?: BoatOfficialWeatherCondition | null;
	weatherCondition?: BoatOfficialWeatherCondition | null;
};

type BoatMikuniScoreRateGuideRow = {
	frameNo: number;
	registrationNo: string;
	playerName: string;
	className: string;
	branch: string;
	averageStart: string;
	winRate: string;
	secondRate: string;
	localWinRate: string;
	localSecondRate: string;
	motorNo: string;
	motorSecondRate: string;
	scoreRate: string;
	score: string;
	deduction: string;
	starts: string;
	sectionResults: string;
	remarks: string;
	source?: string | undefined;
};

type BoatMikuniCourseStatRow = {
	courseNo: number;
	entryRate: string;
	averageStart: string;
	firstRate: string;
	secondRate: string;
	thirdRate: string;
	fourthRate: string;
	fifthRate: string;
	sixthRate: string;
};

type BoatMikuniCourseResultRow = {
	frameNo: number;
	playerName: string;
	className: string;
	registrationNo: string;
	courseRows: BoatMikuniCourseStatRow[];
	source?: string | undefined;
};

type BoatMikuniMotorHistoryEntry = {
	dateRange: string;
	title: string;
	racerName: string;
	results: string;
	source?: string | undefined;
};

type BoatMikuniMotorHistoryRow = {
	frameNo: number;
	motorNo: string;
	playerName: string;
	className: string;
	registerNo: string;
	motorSecondRate: string;
	motorWinRate: string;
	boatNo: string;
	boatSecondRate: string;
	preinspectionTime: string;
	previousUser: string;
	recentResults: string;
	motorGrade: string;
	comment: string;
	historyEntries: BoatMikuniMotorHistoryEntry[];
	source?: string | undefined;
};

type BoatMikuniWaterSurfaceDisplay = {
	waterType: string;
	flowStatus: string;
	tiltRange: string;
	surfaceFeature: string;
	raceFeature: string;
	metricsNote: string;
	courseNote: string;
};

async function loadBoatVenueExtrasFeed(): Promise<BoatVenueExtrasFeed | null> {
	try {
		const response = await fetch(`${withBasePath("data/boatrace/venue-extras.generated.json")}?ts=${Date.now()}`, {
			cache: "no-store",
		});

		if (!response.ok) {
			return null;
		}

		const data = (await response.json()) as BoatVenueExtrasFeed;

		if (!data || !Array.isArray(data.venues)) {
			return null;
		}

		return data;
	} catch {
		return null;
	}
}

function getJstTodayDate(): string {
	return new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date());
}

function formatJstDateTimeLabel(value: string | undefined): string {
	if (!value) {
		return "未取得";
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).format(date);
}

function isPresent<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function getOfficialBeforeInfoDisplay(raceExtra: BoatVenueExtraRace | null): BoatOfficialBeforeInfoDisplay | null {
	if (!raceExtra || !isVenueExtraRecord(raceExtra.officialBeforeInfo)) {
		return null;
	}

	const officialBeforeInfo = raceExtra.officialBeforeInfo;
	const exhibitionRows: BoatOfficialBeforeInfoExhibitionRow[] = [];
	if (Array.isArray(officialBeforeInfo.exhibitionRows)) {
		for (const item of officialBeforeInfo.exhibitionRows) {
			if (!isVenueExtraRecord(item)) {
				continue;
			}

			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				continue;
			}

			exhibitionRows.push({
				frameNo,
				playerName: readVenueExtraString(item.playerName),
				exhibitionTime: readVenueExtraString(item.exhibitionTime),
				weight: readVenueExtraString(item.weight) || undefined,
				weightAdjustment: readVenueExtraString(item.weightAdjustment) || readVenueExtraString(item.adjustment) || undefined,
				tilt: readVenueExtraString(item.tilt),
				course: readVenueExtraString(item.course),
				startTiming: readVenueExtraString(item.startTiming),
				partsExchange: readVenueExtraString(item.partsExchange),
				memo: readVenueExtraString(item.memo),
				source: readVenueExtraString(item.source) || undefined,
			});
		}
	}
	exhibitionRows.sort((left, right) => left.frameNo - right.frameNo);

	const startExhibition: BoatOfficialBeforeInfoStartRow[] = [];
	if (Array.isArray(officialBeforeInfo.startExhibition)) {
		for (const item of officialBeforeInfo.startExhibition) {
			if (!isVenueExtraRecord(item)) {
				continue;
			}

			const course = readVenueExtraNumber(item.course);
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!course || !frameNo) {
				continue;
			}

			startExhibition.push({
				course,
				frameNo,
				startTiming: readVenueExtraString(item.startTiming),
				currentAverageStart: readVenueExtraString(item.currentAverageStart),
				source: readVenueExtraString(item.source) || undefined,
			});
		}
	}
	startExhibition.sort((left, right) => left.course - right.course);

	const scoreQuickLook: BoatOfficialBeforeInfoScoreRow[] = [];
	if (Array.isArray(officialBeforeInfo.scoreQuickLook)) {
		for (const item of officialBeforeInfo.scoreQuickLook) {
			if (!isVenueExtraRecord(item)) {
				continue;
			}

			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				continue;
			}

			scoreQuickLook.push({
				frameNo,
				registrationNo: readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName),
				className: readVenueExtraString(item.className),
				averageStart: readVenueExtraString(item.averageStart),
				winRate: readVenueExtraString(item.winRate),
				secondRate: readVenueExtraString(item.secondRate),
				localWinRate: readVenueExtraString(item.localWinRate),
				localSecondRate: readVenueExtraString(item.localSecondRate),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				scoreRate: readVenueExtraString(item.scoreRate),
				sectionResults: readVenueExtraString(item.sectionResults),
				source: readVenueExtraString(item.source) || undefined,
			});
		}
	}
	scoreQuickLook.sort((left, right) => left.frameNo - right.frameNo);

	return {
		status: readVenueExtraString(officialBeforeInfo.status) || "waiting",
		source: readVenueExtraString(officialBeforeInfo.source) || "boatrace.jp",
		exhibitionRows,
		startExhibition,
		scoreQuickLook,
	};
}

function getVenueOriginalExhibitionRows(raceExtra: BoatVenueExtraRace | null): BoatVenueOriginalExhibition[] {
	if (!raceExtra || !Array.isArray(raceExtra.originalExhibition)) {
		return [];
	}

	const rows: BoatVenueOriginalExhibition[] = [];

	for (const item of raceExtra.originalExhibition.filter(isVenueExtraRecord)) {
		const frameNo = readVenueExtraNumber(item.frameNo);

		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			className: readVenueExtraString(item.className) || undefined,
			playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || undefined,
			registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo) || undefined,
			weight: readVenueExtraString(item.weight) || undefined,
			weightAdjustment: readVenueExtraString(item.weightAdjustment) || readVenueExtraString(item.adjustment) || undefined,
			tilt: readVenueExtraString(item.tilt) || undefined,
			exhibitionTime: readVenueExtraString(item.exhibitionTime) || undefined,
			motorNo: readVenueExtraString(item.motorNo),
			oneLapTime: readVenueExtraString(item.oneLapTime) || readVenueExtraString(item.lapTime),
			turnTime: readVenueExtraString(item.turnTime),
			straightTime: readVenueExtraString(item.straightTime),
			exhibitionEvaluation: readVenueExtraString(item.exhibitionEvaluation),
			memo: readVenueExtraString(item.memo) || readVenueExtraString(item.lapMemo) || readVenueExtraString(item.sourceLabel),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getVenuePredictionDisplay(raceExtra: BoatVenueExtraRace | null): BoatVenuePredictionDisplay | null {
	if (!raceExtra || !isVenueExtraRecord(raceExtra.venuePrediction)) {
		return null;
	}

	const prediction = raceExtra.venuePrediction;
	const mainFocus = Array.isArray(prediction.mainFocus)
		? prediction.mainFocus.map((item) => String(item).trim()).filter(Boolean)
		: [];

	const confidence = readVenueExtraString(prediction.confidence);
	const comment = readVenueExtraString(prediction.comment);

	if (!confidence && mainFocus.length === 0 && !comment) {
		return null;
	}

	return {
		confidence,
		mainFocus,
		comment,
	};
}

function getVenueRacerComments(raceExtra: BoatVenueExtraRace | null): BoatVenueRacerComment[] {
	if (!raceExtra || !Array.isArray(raceExtra.racerComments)) {
		return [];
	}

	const comments: BoatVenueRacerComment[] = [];

	for (const item of raceExtra.racerComments) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		const comment = readVenueExtraString(item.comment);
		const source = readVenueExtraString(item.source);

		if (!frameNo || !comment) {
			continue;
		}

		comments.push({
			frameNo,
			comment,
			source: source || undefined,
		});
	}

	return comments.sort((left, right) => left.frameNo - right.frameNo);
}

function getVenueMotorSummary(raceExtra: BoatVenueExtraRace | null): BoatVenueMotorSummary[] {
	if (!raceExtra || !Array.isArray(raceExtra.motorSummary)) {
		return [];
	}

	const summaries: BoatVenueMotorSummary[] = [];

	for (const item of raceExtra.motorSummary) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		const motorNo = readVenueExtraString(item.motorNo);
		const previousUser = readVenueExtraString(item.previousUser);
		const recentResults = readVenueExtraString(item.recentResults);
		const motorGrade = readVenueExtraString(item.motorGrade);
		const comment = readVenueExtraString(item.comment);
		const source = readVenueExtraString(item.source);

		if (!frameNo || !motorNo) {
			continue;
		}

		summaries.push({
			frameNo,
			motorNo,
			previousUser,
			recentResults,
			motorGrade,
			comment,
			source: source || undefined,
		});
	}

	return summaries.sort((left, right) => left.frameNo - right.frameNo);
}

function resolveVenueMotorSummaryDisplay(
	venueName: string | undefined,
	originalRows: BoatVenueOriginalExhibition[],
	motorSummaries: BoatVenueMotorSummary[],
): { items: BoatVenueMotorSummary[]; isAwaitingMatch: boolean } {
	if (motorSummaries.length === 0) {
		return { items: [], isAwaitingMatch: false };
	}

	if (venueName !== "鳴門") {
		return { items: motorSummaries, isAwaitingMatch: false };
	}

	const frameByMotorNo = new Map(
		originalRows
			.filter((item) => item.motorNo)
			.map((item) => [item.motorNo, item.frameNo]),
	);

	const items = motorSummaries.flatMap((item) => {
		const matchedFrameNo = frameByMotorNo.get(item.motorNo);

		if (!matchedFrameNo) {
			return [];
		}

		return [{
			...item,
			displayFrameNo: matchedFrameNo,
		}];
	});

	return {
		items,
		isAwaitingMatch: motorSummaries.length > items.length,
	};
}

function getVenueAbilityIndex(raceExtra: BoatVenueExtraRace | null): BoatVenueAbilityIndex[] {
	if (!raceExtra || !Array.isArray(raceExtra.abilityIndex)) {
		return [];
	}

	const abilityRows: BoatVenueAbilityIndex[] = [];

	for (const item of raceExtra.abilityIndex) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		const abilityValue = readVenueExtraString(item.abilityValue);
		const frameCompatibility = readVenueExtraString(item.frameCompatibility);
		const startPower = readVenueExtraString(item.startPower);
		const source = readVenueExtraString(item.source);

		if (!frameNo || !abilityValue) {
			continue;
		}

		abilityRows.push({
			frameNo,
			abilityValue,
			frameCompatibility,
			startPower,
			source: source || undefined,
		});
	}

	return abilityRows.sort((left, right) => left.frameNo - right.frameNo);
}

function getVenueStartExhibition(raceExtra: BoatVenueExtraRace | null): BoatVenueStartExhibition[] {
	if (!raceExtra || !Array.isArray(raceExtra.startExhibition)) {
		return [];
	}

	const rows: BoatVenueStartExhibition[] = [];

	for (const [index, item] of raceExtra.startExhibition.entries()) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		const course =
			readVenueExtraNumber(item.course) ??
			readVenueExtraNumber(item.courseNo) ??
			frameNo ??
			index + 1;
		const currentAverageStart = readVenueExtraString(item.currentAverageStart) || readVenueExtraString(item.averageStart);
		const style = readVenueExtraString(item.style) || readVenueExtraString(item.startType);
		const startTiming = readVenueExtraString(item.startTiming) || readVenueExtraString(item.exhibitionStartTiming);
		const startOrder = readVenueExtraString(item.startOrder);
		const source = readVenueExtraString(item.source);

		if (!course || !frameNo) {
			continue;
		}

		rows.push({
			course,
			frameNo,
			playerName: readVenueExtraString(item.playerName) || undefined,
			className: readVenueExtraString(item.className) || undefined,
			registerNo: readVenueExtraString(item.registerNo) || undefined,
			exhibitionTime: readVenueExtraString(item.exhibitionTime) || undefined,
			currentAverageStart,
			style,
			startTiming,
			startOrder,
			startLaneOffset: typeof item.startLaneOffset === "number" ? item.startLaneOffset : null,
			source: source || undefined,
		});
	}

	return rows.sort((left, right) => left.course - right.course);
}

function readVenueTideInfo(value: unknown): BoatVenueTideInfo | null {
	if (!isVenueExtraRecord(value)) {
		return null;
	}

	const date = readVenueExtraString(value.date);
	const dayLabel = readVenueExtraString(value.dayLabel);
	const highTideTime = readVenueExtraString(value.highTideTime);
	const lowTideTime = readVenueExtraString(value.lowTideTime);
	const tideType = readVenueExtraString(value.tideType);
	const source = readVenueExtraString(value.source);

	if (!date && !dayLabel && !highTideTime && !lowTideTime && !tideType) {
		return null;
	}

	return {
		date,
		dayLabel,
		highTideTime,
		lowTideTime,
		tideType,
		source: source || undefined,
	};
}

function readVenueWaterSurfaceInfo(value: unknown): BoatVenueWaterSurfaceInfo | null {
	if (!isVenueExtraRecord(value)) {
		return null;
	}

	const surfaceSummary = readVenueExtraString(value.surfaceSummary);
	const featureSummary = readVenueExtraString(value.featureSummary);
	const courseSummary = readVenueExtraString(value.courseSummary);
	const source = readVenueExtraString(value.source);

	if (!surfaceSummary && !featureSummary && !courseSummary) {
		return null;
	}

	return {
		surfaceSummary,
		featureSummary,
		courseSummary,
		source: source || undefined,
	};
}

function getVenueWaterMemo(
	raceExtra: BoatVenueExtraRace | null,
	venueExtra: BoatVenueExtraVenue | null,
): BoatVenueWaterMemo | null {
	const tideInfo =
		readVenueTideInfo(raceExtra?.tideInfo) ??
		readVenueTideInfo(venueExtra?.tideInfo);

	const waterSurfaceInfo =
		readVenueWaterSurfaceInfo(raceExtra?.waterSurfaceInfo) ??
		readVenueWaterSurfaceInfo(venueExtra?.waterSurfaceInfo);

	if (!tideInfo && !waterSurfaceInfo) {
		return null;
	}

	return {
		tideInfo,
		waterSurfaceInfo,
	};
}

function readVenueWeatherCondition(value: unknown): BoatOfficialWeatherCondition | null {
	if (!isVenueExtraRecord(value)) {
		return null;
	}

	const weather: BoatOfficialWeatherCondition = {
		weather: readVenueExtraString(value.weather),
		windDirection: readVenueExtraString(value.windDirection) || readVenueExtraString(value.windDirectionText),
		windDirectionText: readVenueExtraString(value.windDirectionText),
		windSpeed: readVenueExtraString(value.windSpeed),
		waveHeight: readVenueExtraString(value.waveHeight),
		temperature: readVenueExtraString(value.temperature) || readVenueExtraString(value.airTemperature),
		airTemperature: readVenueExtraString(value.airTemperature),
		waterTemperature: readVenueExtraString(value.waterTemperature),
		pressure: readVenueExtraString(value.pressure),
		humidity: readVenueExtraString(value.humidity),
		rainfall: readVenueExtraString(value.rainfall),
		observedAt: readVenueExtraString(value.observedAt),
		updatedAt: readVenueExtraString(value.updatedAt),
		fetchedAt: readVenueExtraString(value.fetchedAt),
		source: readVenueExtraString(value.source) || undefined,
		sourceUrl: readVenueExtraString(value.sourceUrl) || undefined,
		sourceLabel: readVenueExtraString(value.sourceLabel) || undefined,
	};

	const hasValue = [
		weather.weather,
		weather.windDirection,
		weather.windSpeed,
		weather.waveHeight,
		weather.temperature,
		weather.waterTemperature,
		weather.pressure,
		weather.humidity,
		weather.rainfall,
		weather.observedAt,
		weather.updatedAt,
	].some((item) => Boolean(item && item.trim()));

	return hasValue ? weather : null;
}

function getVenueOfficialWeatherCondition(
	raceExtra: BoatVenueExtraRace | null,
	venueExtra: BoatVenueExtraVenue | null,
	fallbackWeatherActual?: BoatWeatherActual | null,
): BoatOfficialWeatherCondition | null {
	const officialBeforeInfo = isVenueExtraRecord(raceExtra?.officialBeforeInfo) ? raceExtra.officialBeforeInfo : null;

	return (
		readVenueWeatherCondition(raceExtra?.weatherCondition) ??
		readVenueWeatherCondition(officialBeforeInfo?.weatherCondition) ??
		readVenueWeatherCondition(officialBeforeInfo?.weatherActual) ??
		readVenueWeatherCondition(raceExtra?.waterCondition) ??
		readVenueWeatherCondition(venueExtra?.weatherCondition) ??
		readVenueWeatherCondition(venueExtra?.officialWeatherCondition) ??
		readVenueWeatherCondition(fallbackWeatherActual) ??
		null
	);
}

function buildOfficialWeatherSummary(weather: BoatOfficialWeatherCondition | null, variant: "primary" | "secondary"): string {
	if (!weather) {
		return "";
	}

	const items = variant === "primary"
		? [
				weather.weather,
				weather.windDirection ? `風向 ${weather.windDirection}` : "",
				weather.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather.waveHeight ? `波 ${weather.waveHeight}` : "",
			]
		: [
				weather.temperature || weather.airTemperature ? `気温 ${weather.temperature || weather.airTemperature}` : "",
				weather.waterTemperature ? `水温 ${weather.waterTemperature}` : "",
				weather.pressure ? `気圧 ${weather.pressure}` : "",
				weather.humidity ? `湿度 ${weather.humidity}` : "",
				weather.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather.observedAt || weather.updatedAt ? `表示 ${weather.observedAt || weather.updatedAt}` : "",
			];

	return items.filter(Boolean).join(" / ");
}

function getOfficialWeatherSourceLabel(weather: BoatOfficialWeatherCondition | null): string {
	return weather?.sourceLabel || weather?.source || "";
}

function getMikuniBeforeInfo(raceExtra: BoatVenueExtraRace | null): BoatOfficialBeforeInfoExhibitionRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.beforeInfo)) {
		return [];
	}

	const rows: BoatOfficialBeforeInfoExhibitionRow[] = [];

	for (const item of raceExtra.beforeInfo) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			playerName: readVenueExtraString(item.playerName),
			exhibitionTime: readVenueExtraString(item.exhibitionTime),
			tilt: readVenueExtraString(item.tilt),
			course: readVenueExtraString(item.course),
			startTiming: readVenueExtraString(item.startTiming),
			partsExchange: readVenueExtraString(item.partsExchange),
			memo: readVenueExtraString(item.memo),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getMikuniScoreRateGuide(raceExtra: BoatVenueExtraRace | null): BoatMikuniScoreRateGuideRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.mikuniScoreRateGuide)) {
		return [];
	}

	const rows: BoatMikuniScoreRateGuideRow[] = [];

	for (const item of raceExtra.mikuniScoreRateGuide) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			registrationNo: readVenueExtraString(item.registrationNo),
			playerName: readVenueExtraString(item.playerName),
			className: readVenueExtraString(item.className),
			branch: readVenueExtraString(item.branch),
			averageStart: readVenueExtraString(item.averageStart),
			winRate: readVenueExtraString(item.winRate),
			secondRate: readVenueExtraString(item.secondRate),
			localWinRate: readVenueExtraString(item.localWinRate),
			localSecondRate: readVenueExtraString(item.localSecondRate),
			motorNo: readVenueExtraString(item.motorNo),
			motorSecondRate: readVenueExtraString(item.motorSecondRate),
			scoreRate: readVenueExtraString(item.scoreRate),
			score: readVenueExtraString(item.score),
			deduction: readVenueExtraString(item.deduction),
			starts: readVenueExtraString(item.starts),
			sectionResults: readVenueExtraString(item.sectionResults),
			remarks: readVenueExtraString(item.remarks),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getMikuniCourseResults(raceExtra: BoatVenueExtraRace | null): BoatMikuniCourseResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.mikuniCourseResults)) {
		return [];
	}

	const rows: BoatMikuniCourseResultRow[] = [];

	for (const item of raceExtra.mikuniCourseResults) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		const courseRows = Array.isArray(item.courseRows)
			? item.courseRows
				.filter(isVenueExtraRecord)
				.map((courseRow) => {
					const courseNo = readVenueExtraNumber(courseRow.courseNo);
					if (!courseNo) {
						return null;
					}

					return {
						courseNo,
						entryRate: readVenueExtraString(courseRow.entryRate),
						averageStart: readVenueExtraString(courseRow.averageStart),
						firstRate: readVenueExtraString(courseRow.firstRate),
						secondRate: readVenueExtraString(courseRow.secondRate),
						thirdRate: readVenueExtraString(courseRow.thirdRate),
						fourthRate: readVenueExtraString(courseRow.fourthRate),
						fifthRate: readVenueExtraString(courseRow.fifthRate),
						sixthRate: readVenueExtraString(courseRow.sixthRate),
					};
				})
				.filter(isPresent)
				.sort((left, right) => left.courseNo - right.courseNo)
			: [];

		rows.push({
			frameNo,
			playerName: readVenueExtraString(item.playerName),
			className: readVenueExtraString(item.className),
			registrationNo: readVenueExtraString(item.registrationNo),
			courseRows,
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getMikuniMotorHistory(raceExtra: BoatVenueExtraRace | null): BoatMikuniMotorHistoryRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.mikuniMotorHistory)) {
		return [];
	}

	const rows: BoatMikuniMotorHistoryRow[] = [];

	for (const item of raceExtra.mikuniMotorHistory) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		const historyEntries = Array.isArray(item.historyEntries)
			? item.historyEntries
				.filter(isVenueExtraRecord)
				.map((historyItem) => ({
					dateRange: readVenueExtraString(historyItem.dateRange),
					title: readVenueExtraString(historyItem.title),
					racerName: readVenueExtraString(historyItem.racerName),
					results: readVenueExtraString(historyItem.results),
					source: readVenueExtraString(historyItem.source) || undefined,
				}))
				.filter((historyItem) => Boolean(historyItem.dateRange || historyItem.title || historyItem.racerName || historyItem.results))
			: [];

		rows.push({
			frameNo,
			motorNo: readVenueExtraString(item.motorNo),
			playerName: readVenueExtraString(item.playerName),
			className: readVenueExtraString(item.className),
			registerNo: readVenueExtraString(item.registerNo),
			motorSecondRate: readVenueExtraString(item.motorSecondRate),
			motorWinRate: readVenueExtraString(item.motorWinRate),
			boatNo: readVenueExtraString(item.boatNo),
			boatSecondRate: readVenueExtraString(item.boatSecondRate),
			preinspectionTime: readVenueExtraString(item.preinspectionTime),
			previousUser: readVenueExtraString(item.previousUser),
			recentResults: readVenueExtraString(item.recentResults),
			motorGrade: readVenueExtraString(item.motorGrade),
			comment: readVenueExtraString(item.comment),
			historyEntries,
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function normalizeDenseText(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readBetweenLabels(source: string, startLabel: string, endLabel?: string): string {
	const normalizedSource = normalizeDenseText(source);
	const pattern = endLabel
		? new RegExp(`${escapeRegExp(startLabel)}\\s*(.+?)\\s*${escapeRegExp(endLabel)}`)
		: new RegExp(`${escapeRegExp(startLabel)}\\s*(.+)$`);
	const match = normalizedSource.match(pattern);
	return match?.[1]?.trim() ?? "";
}

function getMikuniWaterSurfaceDisplay(waterSurfaceInfo: BoatVenueWaterSurfaceInfo | null): BoatMikuniWaterSurfaceDisplay | null {
	if (!waterSurfaceInfo) {
		return null;
	}

	const surfaceSummary = normalizeDenseText(waterSurfaceInfo.surfaceSummary);
	const metaMatch = surfaceSummary.match(/水質\s+(.+?)\s+流れ・水位変化\s+(.+?)\s+チルト角度\s+(.+?)(?:\s+水面特性|$)/);
	const surfaceFeature = readBetweenLabels(surfaceSummary, "水面特性", "レースの特徴");
	const raceFeature = readBetweenLabels(surfaceSummary, "レースの特徴");
	const hasMetrics = Boolean(normalizeDenseText(waterSurfaceInfo.featureSummary));
	const hasCourseSummary = Boolean(normalizeDenseText(waterSurfaceInfo.courseSummary));

	if (!metaMatch && !surfaceFeature && !raceFeature && !hasMetrics && !hasCourseSummary) {
		return null;
	}

	return {
		waterType: metaMatch?.[1]?.trim() ?? "",
		flowStatus: metaMatch?.[2]?.trim() ?? "",
		tiltRange: metaMatch?.[3]?.trim() ?? "",
		surfaceFeature,
		raceFeature,
		metricsNote: hasMetrics ? "決まり手の数値一覧は三国専用の成績表で確認できます。" : "",
		courseNote: hasCourseSummary ? "枠番ごとの進入傾向は三国専用の進入別成績に反映しています。" : "",
	};
}

function getOmuraEntryTable(raceExtra: BoatVenueExtraRace | null): BoatOmuraEntryRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.omuraEntryTable)) {
		return [];
	}

	return raceExtra.omuraEntryTable
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				branch: readVenueExtraString(item.branch),
				age: readVenueExtraString(item.age),
				weight: readVenueExtraString(item.weight),
				f: readVenueExtraString(item.f),
				l: readVenueExtraString(item.l),
				averageStart: readVenueExtraString(item.averageStart),
				accidentRate: readVenueExtraString(item.accidentRate),
				earlyGuide: readVenueExtraString(item.earlyGuide),
				dashEvaluation: readVenueExtraString(item.dashEvaluation),
				stretchEvaluation: readVenueExtraString(item.stretchEvaluation),
				turnEvaluation: readVenueExtraString(item.turnEvaluation),
				motorEvaluation: readVenueExtraString(item.motorEvaluation),
				nationalWinRate: readVenueExtraString(item.nationalWinRate),
				nationalSecondRate: readVenueExtraString(item.nationalSecondRate),
				localWinRate: readVenueExtraString(item.localWinRate),
				localSecondRate: readVenueExtraString(item.localSecondRate),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				boatNo: readVenueExtraString(item.boatNo),
				boatSecondRate: readVenueExtraString(item.boatSecondRate),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getOmuraPreviousDayResults(raceExtra: BoatVenueExtraRace | null): BoatOmuraPreviousDayResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.omuraPreviousDayResults)) {
		return [];
	}

	return raceExtra.omuraPreviousDayResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			const items = Array.isArray(item.items)
				? item.items
					.filter(isVenueExtraRecord)
					.map((entry) => ({
						date: readVenueExtraString(entry.date),
						raceNo: readVenueExtraString(entry.raceNo),
						course: readVenueExtraString(entry.course),
						startTiming: readVenueExtraString(entry.startTiming),
						finishOrder: readVenueExtraString(entry.finishOrder),
					}))
					.filter((entry) => entry.raceNo || entry.finishOrder || entry.startTiming)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				date: readVenueExtraString(item.date),
				items,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getOmuraNationalFrameStats(raceExtra: BoatVenueExtraRace | null): BoatOmuraNationalFrameStatsRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.omuraNationalFrameStats)) {
		return [];
	}

	return raceExtra.omuraNationalFrameStats
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				playerName,
				firstRate: readVenueExtraString(item.firstRate),
				secondRate: readVenueExtraString(item.secondRate),
				thirdRate: readVenueExtraString(item.thirdRate),
				otherRate: readVenueExtraString(item.otherRate),
				frameTrifectaRate: readVenueExtraString(item.frameTrifectaRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameAverageStartRank: readVenueExtraString(item.frameAverageStartRank),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getOmuraFrameLast10(raceExtra: BoatVenueExtraRace | null): BoatOmuraFrameLast10Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.omuraFrameLast10)) {
		return [];
	}

	return raceExtra.omuraFrameLast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				playerName,
				courseHistory: Array.isArray(item.courseHistory) ? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				finishHistory: Array.isArray(item.finishHistory) ? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				startTimingHistory: Array.isArray(item.startTimingHistory) ? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getOmuraRacerCommentsMotor(raceExtra: BoatVenueExtraRace | null): BoatOmuraRacerCommentsMotorRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.omuraRacerCommentsMotor)) {
		return [];
	}

	return raceExtra.omuraRacerCommentsMotor
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				playerName,
				comment: readVenueExtraString(item.comment),
				motorEvaluation: readVenueExtraString(item.motorEvaluation),
				motorNo: readVenueExtraString(item.motorNo),
				pastCommentUrl: readVenueExtraString(item.pastCommentUrl),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getOmuraExhibitionInfo(raceExtra: BoatVenueExtraRace | null): BoatOmuraExhibitionInfoRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.omuraExhibitionInfo)) {
		return [];
	}

	return raceExtra.omuraExhibitionInfo
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				course: readVenueExtraString(item.course),
				playerName,
				startTiming: readVenueExtraString(item.startTiming),
				exhibitionTime: readVenueExtraString(item.exhibitionTime),
				oneLapTime: readVenueExtraString(item.oneLapTime),
				turnTime: readVenueExtraString(item.turnTime),
				straightTime: readVenueExtraString(item.straightTime),
				tilt: readVenueExtraString(item.tilt),
				partsExchange: readVenueExtraString(item.partsExchange),
				startType: readVenueExtraString(item.startType),
				evaluation: readVenueExtraString(item.evaluation),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getBiwakoSeriesResults(raceExtra: BoatVenueExtraRace | null): BoatBiwakoSeriesResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.biwakoSeriesResults)) {
		return [];
	}

	return raceExtra.biwakoSeriesResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				raceNumbers: Array.isArray(item.raceNumbers)
					? item.raceNumbers.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				courses: Array.isArray(item.courses)
					? item.courses.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				startTimings: Array.isArray(item.startTimings)
					? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				finishOrders: Array.isArray(item.finishOrders)
					? item.finishOrders.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				dayLabels: Array.isArray(item.dayLabels)
					? item.dayLabels.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getBiwakoFramePast10(raceExtra: BoatVenueExtraRace | null): BoatBiwakoFramePast10Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.biwakoFramePast10)) {
		return [];
	}

	return raceExtra.biwakoFramePast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				courseHistory: Array.isArray(item.courseHistory)
					? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				finishHistory: Array.isArray(item.finishHistory)
					? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				startTimingHistory: Array.isArray(item.startTimingHistory)
					? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuBeforeInfo(raceExtra: BoatVenueExtraRace | null): BoatTsuBeforeInfoRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuBeforeInfo)) {
		return [];
	}

	return raceExtra.tsuBeforeInfo
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				className: readVenueExtraString(item.className),
				weight: readVenueExtraString(item.weight),
				weightAdjustment: readVenueExtraString(item.weightAdjustment),
				tilt: readVenueExtraString(item.tilt),
				partsExchange: readVenueExtraString(item.partsExchange),
				previousRaceNo: readVenueExtraString(item.previousRaceNo),
				previousRaceCourse: readVenueExtraString(item.previousRaceCourse),
				previousRaceStartTiming: readVenueExtraString(item.previousRaceStartTiming),
				previousRaceFinishOrder: readVenueExtraString(item.previousRaceFinishOrder),
				motorComment: readVenueExtraString(item.motorComment) || readVenueExtraString(item.motorEvaluation),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuRacerComments(raceExtra: BoatVenueExtraRace | null): BoatTsuRacerCommentRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuRacerComments)) {
		return [];
	}

	return raceExtra.tsuRacerComments
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				comment: readVenueExtraString(item.comment),
				motorComment: readVenueExtraString(item.motorComment),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuSeriesResults(raceExtra: BoatVenueExtraRace | null): BoatTsuSeriesResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuSeriesResults)) {
		return [];
	}

	return raceExtra.tsuSeriesResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				raceNumbers: Array.isArray(item.raceNumbers)
					? item.raceNumbers.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				courses: Array.isArray(item.courses)
					? item.courses.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				startTimings: Array.isArray(item.startTimings)
					? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				finishOrders: Array.isArray(item.finishOrders)
					? item.finishOrders.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				dayLabels: Array.isArray(item.dayLabels)
					? item.dayLabels.map((value) => readVenueExtraString(value)).slice(0, 12)
					: [],
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuNationalRecent3(raceExtra: BoatVenueExtraRace | null): BoatTsuRecent3Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuNationalRecent3)) {
		return [];
	}

	return raceExtra.tsuNationalRecent3
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			const histories = Array.isArray(item.histories)
				? item.histories
					.filter(isVenueExtraRecord)
					.map((entry) => ({
						label: readVenueExtraString(entry.label),
						venueName: readVenueExtraString(entry.venueName),
						grade: readVenueExtraString(entry.grade),
						dateRange: readVenueExtraString(entry.dateRange),
						results: readVenueExtraString(entry.results),
					}))
					.filter((entry) => entry.label || entry.venueName || entry.grade || entry.dateRange || entry.results)
					.slice(0, 3)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				histories,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuLocalRecent3(raceExtra: BoatVenueExtraRace | null): BoatTsuRecent3Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuLocalRecent3)) {
		return [];
	}

	return raceExtra.tsuLocalRecent3
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);

			if (!frameNo || !playerName) {
				return null;
			}

			const histories = Array.isArray(item.histories)
				? item.histories
					.filter(isVenueExtraRecord)
					.map((entry) => ({
						label: readVenueExtraString(entry.label),
						venueName: readVenueExtraString(entry.venueName),
						grade: readVenueExtraString(entry.grade),
						dateRange: readVenueExtraString(entry.dateRange),
						results: readVenueExtraString(entry.results),
					}))
					.filter((entry) => entry.label || entry.venueName || entry.grade || entry.dateRange || entry.results)
					.slice(0, 3)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				histories,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuFramePast10(raceExtra: BoatVenueExtraRace | null): BoatTsuFramePast10Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuFramePast10)) {
		return [];
	}

	return raceExtra.tsuFramePast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName =
				readVenueExtraString(item.playerName) ||
				readVenueExtraString(item.racerName) ||
				readVenueExtraString(item.name);

			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				courseHistory: Array.isArray(item.courseHistory)
					? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				finishHistory: Array.isArray(item.finishHistory)
					? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				startTimingHistory: Array.isArray(item.startTimingHistory)
					? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: Array.isArray(item.startTimings)
						? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuScoreRateGuide(raceExtra: BoatVenueExtraRace | null): BoatOfficialBeforeInfoScoreRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tsuScoreRateGuide)) {
		return [];
	}

	const rows: BoatOfficialBeforeInfoScoreRow[] = [];
	for (const item of raceExtra.tsuScoreRateGuide) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			registrationNo: readVenueExtraString(item.registrationNo) || readVenueExtraString(item.registerNo),
			playerName:
				readVenueExtraString(item.playerName) ||
				readVenueExtraString(item.racerName) ||
				readVenueExtraString(item.name),
			className: readVenueExtraString(item.className) || readVenueExtraString(item.gradeClass),
			averageStart: readVenueExtraString(item.averageStart),
			winRate: readVenueExtraString(item.winRate) || readVenueExtraString(item.nationalWinRate),
			secondRate: readVenueExtraString(item.secondRate) || readVenueExtraString(item.nationalSecondRate),
			localWinRate: readVenueExtraString(item.localWinRate) || readVenueExtraString(item.localWinningRate),
			localSecondRate:
				readVenueExtraString(item.localSecondRate) ||
				readVenueExtraString(item.local2Rate) ||
				readVenueExtraString(item.localSecondRatio),
			motorNo: readVenueExtraString(item.motorNo),
			motorSecondRate:
				readVenueExtraString(item.motorSecondRate) ||
				readVenueExtraString(item.motor2Rate) ||
				readVenueExtraString(item.motorSecondRatio),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getTsuMotorHistory(raceExtra: BoatVenueExtraRace | null): BoatTsuMotorHistoryRow[] {
	if (!raceExtra || !Array.isArray((raceExtra as Record<string, unknown>).tsuMotorHistory)) {
		return [];
	}

	return ((raceExtra as Record<string, unknown>).tsuMotorHistory as unknown[])
		.filter(isVenueExtraRecord)
		.flatMap((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return [];
			}

			const historyEntries = Array.isArray(item.historyEntries)
				? item.historyEntries.filter(isVenueExtraRecord).map((history) => ({
						title: readVenueExtraString(history.title),
						dateRange: readVenueExtraString(history.dateRange),
						racerName: readVenueExtraString(history.racerName),
						playerName: readVenueExtraString(history.playerName),
						results: readVenueExtraString(history.results),
					}))
				: [];
			const boatHistoryEntries = Array.isArray(item.boatHistoryEntries)
				? item.boatHistoryEntries.filter(isVenueExtraRecord).map((history) => ({
						title: readVenueExtraString(history.title),
						dateRange: readVenueExtraString(history.dateRange),
						racerName: readVenueExtraString(history.racerName),
						playerName: readVenueExtraString(history.playerName),
						results: readVenueExtraString(history.results),
					}))
				: [];

			return [{
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName),
				profile: readVenueExtraString(item.profile),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				motorWinRate: readVenueExtraString(item.motorWinRate),
				boatNo: readVenueExtraString(item.boatNo),
				boatSecondRate: readVenueExtraString(item.boatSecondRate),
				boatWinRate: readVenueExtraString(item.boatWinRate),
				previousUser: readVenueExtraString(item.previousUser),
				recentResults: readVenueExtraString(item.recentResults),
				motorGrade: readVenueExtraString(item.motorGrade),
				historyEntries,
				boatHistoryEntries,
				source: readVenueExtraString(item.source) || undefined,
			}];
		})
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuEntryRows(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuEntryRow[] {
	const sourceRows = !raceExtra
		? null
		: Array.isArray(raceExtra.wakamatsuEntryTable)
			? raceExtra.wakamatsuEntryTable
			: Array.isArray(raceExtra.wakamatsuEntryRows)
				? raceExtra.wakamatsuEntryRows
				: Array.isArray(raceExtra.wakamatsuRacerStats)
					? raceExtra.wakamatsuRacerStats
					: null;

	if (!sourceRows) {
		return [];
	}

	return sourceRows
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName:
					readVenueExtraString(item.playerName) ||
					readVenueExtraString(item.racerName) ||
					readVenueExtraString(item.name) ||
					`枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				averageStart: readVenueExtraString(item.averageStart),
				nationalWinRate: readVenueExtraString(item.nationalWinRate) || readVenueExtraString(item.winRate),
				nationalSecondRate: readVenueExtraString(item.nationalSecondRate) || readVenueExtraString(item.secondRate),
				localWinRate: readVenueExtraString(item.localWinRate),
				localSecondRate: readVenueExtraString(item.localSecondRate),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				boatNo: readVenueExtraString(item.boatNo),
				boatSecondRate: readVenueExtraString(item.boatSecondRate),
				comment: readVenueExtraString(item.comment),
				motorEvaluation: readVenueExtraString(item.motorEvaluation),
				earlyGuide: readVenueExtraString(item.earlyGuide),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuBeforeInfo(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuBeforeInfoRow[] {
	const sourceRows = !raceExtra
		? null
		: Array.isArray(raceExtra.wakamatsuBeforeInfo)
			? raceExtra.wakamatsuBeforeInfo
			: Array.isArray(raceExtra.wakamatsuCyokuzen)
				? raceExtra.wakamatsuCyokuzen
				: null;

	if (!sourceRows) {
		return [];
	}

	return sourceRows
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				exhibitionTime: readVenueExtraString(item.exhibitionTime),
				weight: readVenueExtraString(item.weight),
				weightAdjustment: readVenueExtraString(item.weightAdjustment),
				tilt: readVenueExtraString(item.tilt),
				previousRaceNo: readVenueExtraString(item.previousRaceNo),
				previousRaceCourse: readVenueExtraString(item.previousRaceCourse),
				previousRaceStartTiming: readVenueExtraString(item.previousRaceStartTiming),
				previousRaceFinishOrder: readVenueExtraString(item.previousRaceFinishOrder),
				previousRaceInfo: readVenueExtraString(item.previousRaceInfo),
				partsExchange: readVenueExtraString(item.partsExchange),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuSeriesResults(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuSeriesResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.wakamatsuSeriesResults)) {
		return [];
	}

	return raceExtra.wakamatsuSeriesResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				raceNumbers: Array.isArray(item.raceNumbers)
					? item.raceNumbers.map((value) => readVenueExtraString(value)).slice(0, 16)
					: [],
				courses: Array.isArray(item.courses)
					? item.courses.map((value) => readVenueExtraString(value)).slice(0, 16)
					: [],
				startTimings: Array.isArray(item.startTimings)
					? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 16)
					: [],
				startOrders: Array.isArray(item.startOrders)
					? item.startOrders.map((value) => readVenueExtraString(value)).slice(0, 16)
					: [],
				finishOrders: Array.isArray(item.finishOrders)
					? item.finishOrders.map((value) => readVenueExtraString(value)).slice(0, 16)
					: [],
				dayLabels: Array.isArray(item.dayLabels)
					? item.dayLabels.map((value) => readVenueExtraString(value)).slice(0, 16)
					: [],
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuCourseStats(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuCourseStatsRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.wakamatsuCourseStats)) {
		return [];
	}

	return raceExtra.wakamatsuCourseStats
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			const courseRows = Array.isArray(item.courseRows)
				? item.courseRows
					.filter(isVenueExtraRecord)
					.map((entry) => ({
						courseNo: readVenueExtraNumber(entry.courseNo) ?? 0,
						entryCount: readVenueExtraString(entry.entryCount),
						averageStart: readVenueExtraString(entry.averageStart),
						firstCount: readVenueExtraString(entry.firstCount),
						secondCount: readVenueExtraString(entry.secondCount),
						thirdCount: readVenueExtraString(entry.thirdCount),
					}))
					.filter((entry) => entry.courseNo > 0)
					.slice(0, 6)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				courseRows,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuRecent3Rows(sourceRows: unknown): BoatWakamatsuRecent3Row[] {
	if (!Array.isArray(sourceRows)) {
		return [];
	}

	return sourceRows
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			const histories = Array.isArray(item.histories)
				? item.histories
					.filter(isVenueExtraRecord)
					.map((entry) => ({
						label: readVenueExtraString(entry.label),
						venueName: readVenueExtraString(entry.venueName),
						grade: readVenueExtraString(entry.grade),
						dateRange: readVenueExtraString(entry.dateRange),
						results: readVenueExtraString(entry.results),
					}))
					.filter((entry) => entry.label || entry.venueName || entry.grade || entry.dateRange || entry.results)
					.slice(0, 3)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				histories,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuNationalRecent3(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuRecent3Row[] {
	return getWakamatsuRecent3Rows(raceExtra?.wakamatsuNationalRecent3);
}

function getWakamatsuLocalRecent3(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuRecent3Row[] {
	return getWakamatsuRecent3Rows(raceExtra?.wakamatsuLocalRecent3);
}

function getWakamatsuFramePast10(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuFramePast10Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.wakamatsuFramePast10)) {
		return [];
	}

	return raceExtra.wakamatsuFramePast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				courseHistory: Array.isArray(item.courseHistory)
					? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				finishHistory: Array.isArray(item.finishHistory)
					? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: [],
				startTimingHistory: Array.isArray(item.startTimingHistory)
					? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: Array.isArray(item.startTimings)
						? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 10)
						: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuScoreRateGuide(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuScoreRateGuideRow[] {
	const sourceRows = !raceExtra
		? null
		: Array.isArray(raceExtra.wakamatsuScoreRateGuide)
			? raceExtra.wakamatsuScoreRateGuide
			: Array.isArray(raceExtra.wakamatsuScoreGuide)
				? raceExtra.wakamatsuScoreGuide
				: null;

	if (!sourceRows) {
		return [];
	}

	const rows: BoatWakamatsuScoreRateGuideRow[] = [];
	for (const item of sourceRows) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			registrationNo: readVenueExtraString(item.registrationNo) || readVenueExtraString(item.registerNo),
			playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name),
			className: readVenueExtraString(item.className),
			averageStart: readVenueExtraString(item.averageStart),
			winRate: readVenueExtraString(item.winRate) || readVenueExtraString(item.nationalWinRate),
			secondRate: readVenueExtraString(item.secondRate) || readVenueExtraString(item.nationalSecondRate),
			localWinRate: readVenueExtraString(item.localWinRate),
			localSecondRate: readVenueExtraString(item.localSecondRate),
			motorNo: readVenueExtraString(item.motorNo),
			motorSecondRate: readVenueExtraString(item.motorSecondRate),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getWakamatsuMotorHistory(raceExtra: BoatVenueExtraRace | null): BoatWakamatsuMotorHistoryRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.wakamatsuMotorHistory)) {
		return [];
	}

	return raceExtra.wakamatsuMotorHistory
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			const historyEntries = Array.isArray(item.historyEntries)
				? item.historyEntries
					.filter(isVenueExtraRecord)
					.map((entry) => {
						const results = Array.isArray(entry.results)
							? entry.results
								.filter(isVenueExtraRecord)
								.slice(0, 3)
								.map((result) => {
									const dayLabel = readVenueExtraString(result.dayLabel);
									const raceNo = readVenueExtraString(result.raceNo);
									const finishOrder = readVenueExtraString(result.finishOrder);
									const course = readVenueExtraString(result.course);
									const startTiming = readVenueExtraString(result.startTiming);
									return [dayLabel, raceNo ? `${raceNo}` : "", finishOrder, course, startTiming ? `ST${startTiming}` : ""]
										.filter(Boolean)
										.join(" ");
								})
								.filter(Boolean)
								.join(" / ")
							: "";

						return {
							seriesTitle: readVenueExtraString(entry.seriesTitle),
							playerName: readVenueExtraString(entry.playerName),
							results,
						};
					})
					.filter((entry) => entry.seriesTitle || entry.playerName || entry.results)
					.slice(0, 6)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				motorNo: readVenueExtraString(item.motorNo),
				motorWinRate: readVenueExtraString(item.motorWinRate),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				bestExhibitionTime: readVenueExtraString(item.bestExhibitionTime),
				bestOneLapTime: readVenueExtraString(item.bestOneLapTime),
				bestStraightTime: readVenueExtraString(item.bestStraightTime),
				bestTurnTime: readVenueExtraString(item.bestTurnTime),
				historyEntries,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getFukuokaEntryRows(raceExtra: BoatVenueExtraRace | null): BoatFukuokaEntryRow[] {
	const sourceRows = !raceExtra
		? null
		: Array.isArray(raceExtra.fukuokaEntryRows)
			? raceExtra.fukuokaEntryRows
			: Array.isArray(raceExtra.fukuokaRacerStats)
				? raceExtra.fukuokaRacerStats
				: null;

	if (!sourceRows) {
		return [];
	}

	return sourceRows
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				averageStart: readVenueExtraString(item.averageStart),
				nationalWinRate: readVenueExtraString(item.nationalWinRate) || readVenueExtraString(item.winRate),
				nationalSecondRate: readVenueExtraString(item.nationalSecondRate) || readVenueExtraString(item.secondRate),
				localWinRate: readVenueExtraString(item.localWinRate),
				localSecondRate: readVenueExtraString(item.localSecondRate),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				boatNo: readVenueExtraString(item.boatNo),
				boatSecondRate: readVenueExtraString(item.boatSecondRate),
				comment: readVenueExtraString(item.comment),
				motorEvaluation: readVenueExtraString(item.motorEvaluation),
				earlyGuide: readVenueExtraString(item.earlyGuide),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getFukuokaBeforeInfo(raceExtra: BoatVenueExtraRace | null): BoatFukuokaBeforeInfoRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.fukuokaBeforeInfo)) {
		return [];
	}

	return raceExtra.fukuokaBeforeInfo
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				exhibitionTime: readVenueExtraString(item.exhibitionTime),
				weight: readVenueExtraString(item.weight),
				weightAdjustment: readVenueExtraString(item.weightAdjustment),
				tilt: readVenueExtraString(item.tilt),
				partsExchange: readVenueExtraString(item.partsExchange),
				previousRaceInfo: readVenueExtraString(item.previousRaceInfo),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getFukuokaMotorEvaluation(raceExtra: BoatVenueExtraRace | null): BoatFukuokaMotorEvaluationRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.fukuokaMotorEvaluation)) {
		return [];
	}

	return raceExtra.fukuokaMotorEvaluation
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				motorEvaluation: readVenueExtraString(item.motorEvaluation),
				motorComment: readVenueExtraString(item.motorComment) || readVenueExtraString(item.comment),
				bestExhibitionTime: readVenueExtraString(item.bestExhibitionTime) || readVenueExtraString(item.exhibitionTime),
				partsExchange: readVenueExtraString(item.partsExchange),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getFukuokaSeriesResults(raceExtra: BoatVenueExtraRace | null): BoatFukuokaSeriesResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.fukuokaSeriesResults)) {
		return [];
	}

	return raceExtra.fukuokaSeriesResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				raceNumbers: Array.isArray(item.raceNumbers) ? item.raceNumbers.map((value) => readVenueExtraString(value)).slice(0, 12) : [],
				courses: Array.isArray(item.courses) ? item.courses.map((value) => readVenueExtraString(value)).slice(0, 12) : [],
				startTimings: Array.isArray(item.startTimings) ? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 12) : [],
				finishOrders: Array.isArray(item.finishOrders) ? item.finishOrders.map((value) => readVenueExtraString(value)).slice(0, 12) : [],
				dayLabels: Array.isArray(item.dayLabels) ? item.dayLabels.map((value) => readVenueExtraString(value)).slice(0, 12) : [],
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getFukuokaRacerComments(raceExtra: BoatVenueExtraRace | null): BoatFukuokaRacerCommentRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.fukuokaRacerComments)) {
		return [];
	}

	return raceExtra.fukuokaRacerComments
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				comment: readVenueExtraString(item.comment),
				motorComment: readVenueExtraString(item.motorComment),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getFukuokaFramePast10(raceExtra: BoatVenueExtraRace | null): BoatFukuokaFramePast10Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.fukuokaFramePast10)) {
		return [];
	}

	return raceExtra.fukuokaFramePast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				courseHistory: Array.isArray(item.courseHistory) ? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				finishHistory: Array.isArray(item.finishHistory) ? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				startTimingHistory: Array.isArray(item.startTimingHistory)
					? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: Array.isArray(item.startTimings)
						? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 10)
						: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTokuyamaFramePast10(raceExtra: BoatVenueExtraRace | null): BoatTokuyamaFramePast10Row[] {
	if (!raceExtra || !Array.isArray(raceExtra.tokuyamaFramePast10)) {
		return [];
	}

	return raceExtra.tokuyamaFramePast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				courseHistory: Array.isArray(item.courseHistory) ? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				finishHistory: Array.isArray(item.finishHistory) ? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				startTimingHistory: Array.isArray(item.startTimingHistory)
					? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: Array.isArray(item.startTimings)
						? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 10)
						: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getAshiyaFrameLast10(raceExtra: BoatVenueExtraRace | null): BoatAshiyaFrameLast10Row[] {
	const frameLast10 = raceExtra && isVenueExtraRecord(raceExtra)
		? (raceExtra as Record<string, unknown>).ashiyaFrameLast10
		: null;

	if (!Array.isArray(frameLast10)) {
		return [];
	}

	return frameLast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				courseHistory: Array.isArray(item.courseHistory) ? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				finishHistory: Array.isArray(item.finishHistory) ? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				startTimingHistory: Array.isArray(item.startTimingHistory)
					? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10)
					: Array.isArray(item.startTimings)
						? item.startTimings.map((value) => readVenueExtraString(value)).slice(0, 10)
						: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKiryuFrameLast10(raceExtra: BoatVenueExtraRace | null): BoatKiryuFrameLast10Row[] {
	const frameLast10 = raceExtra && isVenueExtraRecord(raceExtra)
		? (raceExtra as Record<string, unknown>).kiryuFrameLast10
		: null;

	if (!Array.isArray(frameLast10)) {
		return [];
	}

	return frameLast10
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				courseHistory: Array.isArray(item.courseHistory) ? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				finishHistory: Array.isArray(item.finishHistory) ? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				startTimingHistory: Array.isArray(item.startTimingHistory) ? item.startTimingHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKiryuCourseResults(raceExtra: BoatVenueExtraRace | null): BoatKiryuCourseResultRow[] {
	const courseResults = raceExtra && isVenueExtraRecord(raceExtra)
		? (raceExtra as Record<string, unknown>).kiryuCourseResults
		: null;

	if (!Array.isArray(courseResults)) {
		return [];
	}

	return courseResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || `枠${frameNo}`,
				course: readVenueExtraString(item.course),
				entryRate: readVenueExtraString(item.entryRate),
				averageStart: readVenueExtraString(item.averageStart),
				firstRate: readVenueExtraString(item.firstRate),
				secondRate: readVenueExtraString(item.secondRate),
				thirdRate: readVenueExtraString(item.thirdRate),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo || Number(left.course) - Number(right.course));
}

function getFukuokaScoreRateGuide(raceExtra: BoatVenueExtraRace | null): BoatFukuokaScoreRateGuideRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.fukuokaScoreRateGuide)) {
		return [];
	}

	const rows: BoatFukuokaScoreRateGuideRow[] = [];
	for (const item of raceExtra.fukuokaScoreRateGuide) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			registrationNo: readVenueExtraString(item.registrationNo) || readVenueExtraString(item.registerNo),
			playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name),
			className: readVenueExtraString(item.className),
			averageStart: readVenueExtraString(item.averageStart),
			winRate: readVenueExtraString(item.winRate) || readVenueExtraString(item.nationalWinRate),
			secondRate: readVenueExtraString(item.secondRate) || readVenueExtraString(item.nationalSecondRate),
			localWinRate: readVenueExtraString(item.localWinRate),
			localSecondRate: readVenueExtraString(item.localSecondRate),
			motorNo: readVenueExtraString(item.motorNo),
			motorSecondRate: readVenueExtraString(item.motorSecondRate),
			scoreRate: readVenueExtraString(item.scoreRate),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaBeforeInfo(raceExtra: BoatVenueExtraRace | null): BoatKojimaBeforeInfoRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaBeforeInfo)) {
		return [];
	}

	return raceExtra.kojimaBeforeInfo
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				exhibitionTime: readVenueExtraString(item.exhibitionTime),
				weight: readVenueExtraString(item.weight),
				adjustment: readVenueExtraString(item.adjustment) || readVenueExtraString(item.weightAdjustment),
				tilt: readVenueExtraString(item.tilt),
				partsExchange: readVenueExtraString(item.partsExchange),
				previousRaceInfo: readVenueExtraString(item.previousRaceInfo),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				preInspectionTime: readVenueExtraString(item.preInspectionTime),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaSeriesResults(raceExtra: BoatVenueExtraRace | null): BoatKojimaSeriesResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaSeriesResults)) {
		return [];
	}

	return raceExtra.kojimaSeriesResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				raceNumbers: readVenueExtraStringArray(item.raceNumbers, 12),
				courses: readVenueExtraStringArray(item.courses, 12),
				startTimings: readVenueExtraStringArray(item.startTimings, 12),
				finishOrders: readVenueExtraStringArray(item.finishOrders, 12),
				dayLabels: readVenueExtraStringArray(item.dayLabels, 12),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaRecentResults(raceExtra: BoatVenueExtraRace | null): BoatKojimaRecentResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaRecentResults)) {
		return [];
	}

	return raceExtra.kojimaRecentResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			const sourceHistories = Array.isArray(item.histories)
				? item.histories
				: Array.isArray(item.history)
					? item.history
					: [];

			const histories = sourceHistories
				.filter(isVenueExtraRecord)
				.map((entry) => ({
					venueName: readVenueExtraString(entry.venueName) || readVenueExtraString(entry.stadium),
					grade: readVenueExtraString(entry.grade) || readVenueExtraString(entry.seriesClass),
					dateRange: readVenueExtraString(entry.dateRange),
					results: readVenueExtraString(entry.results),
				}))
				.filter((entry) => entry.venueName || entry.grade || entry.dateRange || entry.results)
				.slice(0, 5);

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				histories,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaCourseStats(raceExtra: BoatVenueExtraRace | null): BoatKojimaCourseStatsRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaCourseStats)) {
		return [];
	}

	return raceExtra.kojimaCourseStats
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			const courseRows = Array.isArray(item.courseRows)
				? item.courseRows
					.filter(isVenueExtraRecord)
					.map((entry) => {
						const courseNo = readVenueExtraNumber(entry.course) ?? readVenueExtraNumber(entry.courseNo);
						if (!courseNo) {
							return null;
						}

						return {
							courseNo,
							entryRate: readVenueExtraString(entry.entryRate),
							averageStart: readVenueExtraString(entry.averageStart),
							firstRate: readVenueExtraString(entry.firstRate),
							secondRate: readVenueExtraString(entry.secondRate),
							thirdRate: readVenueExtraString(entry.thirdRate),
							fourthRate: readVenueExtraString(entry.fourthRate),
							fifthRate: readVenueExtraString(entry.fifthRate),
							sixthRate: readVenueExtraString(entry.sixthRate),
						};
					})
					.filter(isPresent)
					.sort((left, right) => left.courseNo - right.courseNo)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				courseRows,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaMotorStats(raceExtra: BoatVenueExtraRace | null): BoatKojimaMotorStatsRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaMotorStats)) {
		return [];
	}

	return raceExtra.kojimaMotorStats
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			const motorWinRate = readVenueExtraRate(readVenueExtraString(item.firstCount), readVenueExtraString(item.starts));
			const history = Array.isArray(item.history) ? item.history.filter(isVenueExtraRecord) : [];
			const latestHistory = history[0];
			const comment = latestHistory
				? [readVenueExtraString(latestHistory.playerName), readVenueExtraString(latestHistory.dateRange), readVenueExtraString(latestHistory.results)].filter(Boolean).join(" / ")
				: "";

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				motorWinRate,
				motorRank: readVenueExtraString(item.motorRank),
				comment,
				bestExhibitionTime: readVenueExtraString(item.bestExhibitionTime),
				preInspectionTime: readVenueExtraString(item.preInspectionTime),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaFrameStats(raceExtra: BoatVenueExtraRace | null): BoatKojimaFrameStatsRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaFrameStats)) {
		return [];
	}

	return raceExtra.kojimaFrameStats
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo) || readVenueExtraString(item.registrationNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				profile: readVenueExtraString(item.profile),
				courseHistory: readVenueExtraStringArray(item.courseHistory, 10),
				finishHistory: readVenueExtraStringArray(item.finishHistory, 10),
				startTimingHistory: readVenueExtraStringArray(item.startTimingHistory, 10),
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getKojimaScoreRateGuide(raceExtra: BoatVenueExtraRace | null): BoatKojimaScoreRateGuideRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.kojimaScoreRateGuide)) {
		return [];
	}

	return raceExtra.kojimaScoreRateGuide
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			if (!frameNo) {
				return null;
			}

			return {
				frameNo,
				registrationNo: readVenueExtraString(item.registrationNo) || readVenueExtraString(item.registerNo),
				playerName: readVenueExtraString(item.playerName) || readVenueExtraString(item.racerName) || readVenueExtraString(item.name) || `枠${frameNo}`,
				className: readVenueExtraString(item.className),
				averageStart: readVenueExtraString(item.averageStart),
				winRate: readVenueExtraString(item.winRate) || readVenueExtraString(item.nationalWinRate),
				secondRate: readVenueExtraString(item.secondRate) || readVenueExtraString(item.nationalSecondRate),
				localWinRate: readVenueExtraString(item.localWinRate),
				localSecondRate: readVenueExtraString(item.localSecondRate),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				scoreRate: readVenueExtraString(item.scoreRate),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaEntryTable(raceExtra: BoatVenueExtraRace | null): BoatTamagawaEntryRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tamagawaEntryTable)) {
		return [];
	}

	return raceExtra.tamagawaEntryTable
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				mark: readVenueExtraString(item.mark),
				fl: readVenueExtraString(item.fl),
				averageStart: readVenueExtraString(item.averageStart),
				nationalWinRate: readVenueExtraString(item.nationalWinRate),
				nationalSecondRate: readVenueExtraString(item.nationalSecondRate),
				localWinRate: readVenueExtraString(item.localWinRate),
				localSecondRate: readVenueExtraString(item.localSecondRate),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				boatNo: readVenueExtraString(item.boatNo),
				boatSecondRate: readVenueExtraString(item.boatSecondRate),
				earlyGuide: readVenueExtraString(item.earlyGuide),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaBeforeInfo(raceExtra: BoatVenueExtraRace | null): BoatTamagawaBeforeInfoRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tamagawaBeforeInfo)) {
		return [];
	}

	return raceExtra.tamagawaBeforeInfo
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				weight: readVenueExtraString(item.weight),
				weightAdjustment: readVenueExtraString(item.weightAdjustment),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				tilt: readVenueExtraString(item.tilt),
				previousRaceInfo: readVenueExtraString(item.previousRaceInfo),
				partsExchange: readVenueExtraString(item.partsExchange),
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaMotorHistory(raceExtra: BoatVenueExtraRace | null): BoatTamagawaMotorHistoryRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tamagawaMotorHistory)) {
		return [];
	}

	return raceExtra.tamagawaMotorHistory
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			const historyEntries = Array.isArray(item.historyEntries)
				? item.historyEntries
					.filter(isVenueExtraRecord)
					.map((entry) => ({
						label: readVenueExtraString(entry.label),
						playerName: readVenueExtraString(entry.playerName),
						results: readVenueExtraString(entry.results),
					}))
					.filter((entry) => entry.label || entry.playerName || entry.results)
				: [];

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				motorNo: readVenueExtraString(item.motorNo),
				motorSecondRate: readVenueExtraString(item.motorSecondRate),
				finals: readVenueExtraString(item.finals),
				championships: readVenueExtraString(item.championships),
				historyEntries,
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaSeriesResults(raceExtra: BoatVenueExtraRace | null): BoatTamagawaSeriesResultRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tamagawaSeriesResults)) {
		return [];
	}

	return raceExtra.tamagawaSeriesResults
		.filter(isVenueExtraRecord)
		.map((item) => {
			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				return null;
			}

			return {
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				raceNumbers: Array.isArray(item.raceNumbers) ? item.raceNumbers.map((value) => readVenueExtraString(value)) : [],
				courses: Array.isArray(item.courses) ? item.courses.map((value) => readVenueExtraString(value)) : [],
				startTimings: Array.isArray(item.startTimings) ? item.startTimings.map((value) => readVenueExtraString(value)) : [],
				finishOrders: Array.isArray(item.finishOrders) ? item.finishOrders.map((value) => readVenueExtraString(value)) : [],
				source: readVenueExtraString(item.source) || undefined,
			};
		})
		.filter(isPresent)
		.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaFramePast10(raceExtra: BoatVenueExtraRace | null): BoatNarutoFrameHistoryRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tamagawaFramePast10)) {
		return [];
	}

	const rows: BoatNarutoFrameHistoryRow[] = [];
	for (const item of raceExtra.tamagawaFramePast10) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		const playerName = readVenueExtraString(item.playerName);
		if (!frameNo || !playerName) {
			continue;
		}

		rows.push({
			frameNo,
			className: readVenueExtraString(item.className),
			registerNo: readVenueExtraString(item.registerNo),
			playerName,
			profile: readVenueExtraString(item.profile),
			courseHistory: Array.isArray(item.courseHistory) ? item.courseHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
			finishHistory: Array.isArray(item.finishHistory) ? item.finishHistory.map((value) => readVenueExtraString(value)).slice(0, 10) : [],
			frameWinRate: readVenueExtraString(item.frameWinRate),
			frameAverageStart: readVenueExtraString(item.frameAverageStart),
			frameStartOrder: readVenueExtraString(item.frameStartOrder),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaScoreRateGuide(raceExtra: BoatVenueExtraRace | null): BoatOfficialBeforeInfoScoreRow[] {
	if (!raceExtra || !Array.isArray(raceExtra.tamagawaScoreRateGuide)) {
		return [];
	}

	const rows: BoatOfficialBeforeInfoScoreRow[] = [];
	for (const item of raceExtra.tamagawaScoreRateGuide) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const frameNo = readVenueExtraNumber(item.frameNo);
		if (!frameNo) {
			continue;
		}

		rows.push({
			frameNo,
			registrationNo: readVenueExtraString(item.registrationNo),
			playerName: readVenueExtraString(item.playerName),
			className: readVenueExtraString(item.className),
			averageStart: readVenueExtraString(item.averageStart),
			winRate: readVenueExtraString(item.winRate),
			secondRate: readVenueExtraString(item.secondRate),
			localWinRate: readVenueExtraString(item.localWinRate),
			localSecondRate: readVenueExtraString(item.localSecondRate),
			motorNo: readVenueExtraString(item.motorNo),
			motorSecondRate: readVenueExtraString(item.motorSecondRate),
			source: readVenueExtraString(item.source) || undefined,
		});
	}

	return rows.sort((left, right) => left.frameNo - right.frameNo);
}

function getTamagawaOddsResult(raceExtra: BoatVenueExtraRace | null): BoatTamagawaOddsResultDisplay | null {
	if (!raceExtra || !isVenueExtraRecord(raceExtra.tamagawaOddsResult)) {
		return null;
	}

	const root = raceExtra.tamagawaOddsResult;
	const finishers = Array.isArray(root.finishers)
		? root.finishers
			.filter(isVenueExtraRecord)
			.map((item) => ({
				rank: readVenueExtraString(item.rank),
				frameNo: readVenueExtraNumber(item.frameNo) ?? 0,
				playerName: readVenueExtraString(item.playerName),
				raceTime: readVenueExtraString(item.raceTime),
			}))
			.filter((item) => item.rank && item.frameNo && item.playerName)
		: [];

	const payouts = Array.isArray(root.payouts)
		? root.payouts
			.filter(isVenueExtraRecord)
			.map((item) => ({
				betType: readVenueExtraString(item.betType),
				combination: readVenueExtraString(item.combination),
				payout: readVenueExtraString(item.payout),
				popularity: readVenueExtraString(item.popularity),
			}))
			.filter((item) => item.betType && (item.combination || item.payout))
		: [];

	if (!finishers.length && !payouts.length) {
		return null;
	}

	return {
		finishers,
		payouts,
		source: readVenueExtraString(root.source) || undefined,
	};
}

function getNarutoRacerPerformance(raceExtra: BoatVenueExtraRace | null): BoatNarutoRacerPerformance | null {
	if (!raceExtra || !isVenueExtraRecord(raceExtra.narutoRacerPerformance)) {
		return null;
	}

	const root = raceExtra.narutoRacerPerformance;

	const readFrameHistoryRows = (value: unknown): BoatNarutoFrameHistoryRow[] => {
		if (!Array.isArray(value)) {
			return [];
		}

		const rows: BoatNarutoFrameHistoryRow[] = [];

		for (const item of value) {
			if (!isVenueExtraRecord(item)) {
				continue;
			}

			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				continue;
			}

			rows.push({
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				courseHistory: Array.isArray(item.courseHistory)
					? item.courseHistory.map((course) => readVenueExtraString(course)).slice(0, 10)
					: [],
				finishHistory: Array.isArray(item.finishHistory)
					? item.finishHistory.map((result) => readVenueExtraString(result)).slice(0, 10)
					: [],
				frameWinRate: readVenueExtraString(item.frameWinRate),
				frameAverageStart: readVenueExtraString(item.frameAverageStart),
				frameStartOrder: readVenueExtraString(item.frameStartOrder),
				source: readVenueExtraString(item.source) || undefined,
			});
		}

		return rows.sort((left, right) => left.frameNo - right.frameNo);
	};

	const readRecentHistoryRows = (value: unknown): BoatNarutoRecentHistoryRow[] => {
		if (!Array.isArray(value)) {
			return [];
		}

		const rows: BoatNarutoRecentHistoryRow[] = [];

		for (const item of value) {
			if (!isVenueExtraRecord(item)) {
				continue;
			}

			const frameNo = readVenueExtraNumber(item.frameNo);
			const playerName = readVenueExtraString(item.playerName);
			if (!frameNo || !playerName) {
				continue;
			}

			const histories = Array.isArray(item.histories)
				? item.histories
					.filter(isVenueExtraRecord)
					.map((history) => ({
						label: readVenueExtraString(history.label),
						results: readVenueExtraString(history.results),
					}))
					.filter((history) => history.label || history.results)
				: [];

			rows.push({
				frameNo,
				className: readVenueExtraString(item.className),
				registerNo: readVenueExtraString(item.registerNo),
				playerName,
				profile: readVenueExtraString(item.profile),
				histories,
				source: readVenueExtraString(item.source) || undefined,
			});
		}

		return rows.sort((left, right) => left.frameNo - right.frameNo);
	};

	const byFramePast10 = readFrameHistoryRows(root.byFramePast10);
	const narutoRecent = readRecentHistoryRows(root.narutoRecent);
	const nationalRecent = readRecentHistoryRows(root.nationalRecent);

	if (!byFramePast10.length && !narutoRecent.length && !nationalRecent.length) {
		return null;
	}

	return {
		byFramePast10,
		narutoRecent,
		nationalRecent,
	};
}

function getNarutoStartOrderValue(startTiming: string): number | null {
	const timingValue = getOfficialStartTimingValue(startTiming);
	if (timingValue === "-") {
		return null;
	}

	const numericValue = Number.parseFloat(timingValue);
	if (!Number.isFinite(numericValue)) {
		return null;
	}

	const flag = getOfficialStartFlag(startTiming);
	if (flag === "F") {
		return numericValue - 1;
	}

	if (flag === "L") {
		return numericValue + 1;
	}

	return numericValue;
}

function getStartLanePosition(startTiming: string): number {
	const timingValue = getOfficialStartTimingValue(startTiming);
	if (timingValue === "-") {
		return 56;
	}

	const numericValue = Number.parseFloat(timingValue);
	if (!Number.isFinite(numericValue)) {
		return 56;
	}

	const flag = getOfficialStartFlag(startTiming);
	if (flag === "F") {
		return Math.max(87, Math.min(96, 86.5 + (numericValue * 150)));
	}

	if (flag === "L") {
		return Math.max(24, Math.min(82, 82 - (numericValue * 190)));
	}

	return Math.max(28, Math.min(84, 86 - (numericValue * 190)));
}

function getTamagawaStartLanePosition(startTiming: string): number {
	const startLinePct = 82;
	const minPct = 8;
	const maxPct = 94;
	const pixelsPerSt = 190;
	const timingValue = getOfficialStartTimingValue(startTiming);

	if (timingValue === "-") {
		return startLinePct;
	}

	const numericValue = Number.parseFloat(timingValue);
	if (!Number.isFinite(numericValue)) {
		return startLinePct;
	}

	const signedTiming = getOfficialStartFlag(startTiming) === "F" ? -numericValue : numericValue;
	const position = startLinePct - (signedTiming * pixelsPerSt);

	return Math.max(minPct, Math.min(maxPct, position));
}

function getNarutoStartExhibitionDisplay(
	officialBeforeInfo: BoatOfficialBeforeInfoDisplay | null,
	venueStartExhibition: BoatVenueStartExhibition[],
): BoatNarutoStartExhibitionDisplayRow[] {
	if (!officialBeforeInfo?.startExhibition.length) {
		return [];
	}

	const nameByFrame = new Map<number, string>();
	for (const row of officialBeforeInfo.exhibitionRows) {
		if (row.playerName) {
			nameByFrame.set(row.frameNo, row.playerName);
		}
	}
	for (const row of officialBeforeInfo.scoreQuickLook) {
		if (row.playerName && !nameByFrame.has(row.frameNo)) {
			nameByFrame.set(row.frameNo, row.playerName);
		}
	}

	const venueStartByCourse = new Map(
		venueStartExhibition.map((row) => [row.course, row]),
	);

	const rows = officialBeforeInfo.startExhibition.map((row) => {
		const matchedVenueRow = venueStartByCourse.get(row.course);
		return {
			course: row.course,
			frameNo: row.frameNo,
			playerName: nameByFrame.get(row.frameNo) ?? `枠${row.frameNo}`,
			currentAverageStart: matchedVenueRow?.currentAverageStart || row.currentAverageStart,
			startTiming: matchedVenueRow?.startTiming || row.startTiming,
			startOrder: matchedVenueRow?.startOrder ? readVenueExtraNumber(matchedVenueRow.startOrder) : null,
			startLanePosition: getStartLanePosition(matchedVenueRow?.startTiming || row.startTiming),
			style: matchedVenueRow?.style || "",
		};
	});

	const rowsNeedingOrder = rows
		.map((row, index) => ({
			index,
			value: getNarutoStartOrderValue(row.startTiming),
		}))
		.filter((item) => item.value !== null)
		.sort((left, right) => (left.value ?? 0) - (right.value ?? 0));

	for (const [orderIndex, row] of rowsNeedingOrder.entries()) {
		if (rows[row.index].startOrder === null) {
			rows[row.index].startOrder = orderIndex + 1;
		}
	}

	return rows.sort((left, right) => left.course - right.course);
}

const venueSpotlightCopy: Record<string, { summary: string; imageSrc?: string; imageAlt?: string }> = {
	桐生: { summary: "インの強さと水面特性を起点に組み立てやすい会場です。", imageSrc: getVenueSpotlightImageSrc("kiryu-spotlight.png"), imageAlt: "桐生の会場イメージ" },
	戸田: { summary: "スタートと旋回精度の差が結果へ直結しやすい会場です。", imageSrc: getVenueSpotlightImageSrc("toda-spotlight.png"), imageAlt: "戸田の会場イメージ" },
	江戸川: { summary: "風と水面状況の影響を強く受けやすく、波乱も出やすい会場です。", imageSrc: getVenueSpotlightImageSrc("edogawa-spotlight.png"), imageAlt: "江戸川の会場イメージ" },
	平和島: { summary: "基本の足比較に加えて展示気配を重視したい会場です。", imageSrc: getVenueSpotlightImageSrc("heiwajima-spotlight.png"), imageAlt: "平和島の会場イメージ" },
	多摩川: { summary: "水面の素直さを前提に、直前情報と展示の変化を見たい会場です。", imageSrc: getVenueSpotlightImageSrc("tamagawa-spotlight.png"), imageAlt: "多摩川の会場イメージ" },
	浜名湖: { summary: "モーター評価とコース実績の両面から整理しやすい会場です。", imageSrc: getVenueSpotlightImageSrc("hamanako-spotlight.png"), imageAlt: "浜名湖の会場イメージ" },
	蒲郡: { summary: "気配差とスタート精度を丁寧に見たいナイター会場です。", imageSrc: getVenueSpotlightImageSrc("gamagori-spotlight.png"), imageAlt: "蒲郡の会場イメージ" },
	常滑: { summary: "機力比較と枠順の優位を素直に評価しやすい会場です。", imageSrc: getVenueSpotlightImageSrc("tokoname-spotlight.png"), imageAlt: "常滑の会場イメージ" },
	津: { summary: "展示から本番までの足色変化を追う価値が高い会場です。", imageSrc: getVenueSpotlightImageSrc("tsu-spotlight.png"), imageAlt: "津の会場イメージ" },
	三国: { summary: "コース取りと回り足の差が着順へ表れやすい会場です。", imageSrc: getVenueSpotlightImageSrc("mikuni-spotlight.png"), imageAlt: "三国の会場イメージ" },
	びわこ: { summary: "節間成績と枠別の近走を並べて比較しやすい会場です。", imageSrc: getVenueSpotlightImageSrc("biwako-spotlight.png"), imageAlt: "びわこの会場イメージ" },
	住之江: { summary: "イン信頼度と差し場の有無をセットで見たい会場です。", imageSrc: getVenueSpotlightImageSrc("suminoe-spotlight.png"), imageAlt: "住之江の会場イメージ" },
	尼崎: { summary: "機力の底上げとターンの安定感が重要になりやすい会場です。", imageSrc: getVenueSpotlightImageSrc("amagasaki-spotlight.png"), imageAlt: "尼崎の会場イメージ" },
	鳴門: { summary: "公式の直前情報や独自指数を横断して見たい会場です。", imageSrc: getVenueSpotlightImageSrc("naruto-spotlight.png"), imageAlt: "鳴門の会場イメージ" },
	丸亀: { summary: "ナイターの気配変化とモーター比較が効きやすい会場です。", imageSrc: getVenueSpotlightImageSrc("marugame-spotlight.png"), imageAlt: "丸亀の会場イメージ" },
	児島: { summary: "直前情報、今節成績、進入コース別の比較が有効な会場です。", imageSrc: getVenueSpotlightImageSrc("kojima-spotlight.png"), imageAlt: "児島の会場イメージ" },
	宮島: { summary: "回り足と実戦足のバランスを見極めたい会場です。", imageSrc: getVenueSpotlightImageSrc("miyajima-spotlight.png"), imageAlt: "宮島の会場イメージ" },
	徳山: { summary: "モーター気配と展示内容の一致を見たい会場です。", imageSrc: getVenueSpotlightImageSrc("tokuyama-spotlight.png"), imageAlt: "徳山の会場イメージ" },
	下関: { summary: "スタートの踏み込みと機力差が結果へ出やすい会場です。", imageSrc: getVenueSpotlightImageSrc("shimonoseki-spotlight.png"), imageAlt: "下関の会場イメージ" },
	若松: { summary: "ナイターの展示気配とモーター評価を重ねて見たい会場です。", imageSrc: getVenueSpotlightImageSrc("wakamatsu-spotlight.png"), imageAlt: "若松の会場イメージ" },
	芦屋: { summary: "センター勢の攻めとイン残りの両方を比較したい会場です。", imageSrc: getVenueSpotlightImageSrc("ashiya-spotlight.png"), imageAlt: "芦屋の会場イメージ" },
	福岡: { summary: "モーター評価と当地実績を重ねて判断しやすい会場です。", imageSrc: getVenueSpotlightImageSrc("fukuoka-spotlight.png"), imageAlt: "福岡の会場イメージ" },
	唐津: { summary: "回り足と展示気配の良化を拾いたい会場です。", imageSrc: getVenueSpotlightImageSrc("karatsu-spotlight.png"), imageAlt: "唐津の会場イメージ" },
	大村: { summary: "出足系の比較と展示タイムの裏付けを重視したい会場です。", imageSrc: getVenueSpotlightImageSrc("omura-spotlight.png"), imageAlt: "大村の会場イメージ" },
};

type VenueOfficialLinkStatus = "complete" | "partial" | "checking";

const venueOfficialLinkStatusMap: Record<string, VenueOfficialLinkStatus> = {
	若松: "complete",
	三国: "complete",
	鳴門: "complete",
	丸亀: "complete",
	徳山: "complete",
	常滑: "complete",
	芦屋: "complete",
	桐生: "complete",
	津: "complete",
	宮島: "complete",
	浜名湖: "complete",
};

const venueOfficialLinkStatusMeta: Record<
	VenueOfficialLinkStatus,
	{
		label: string;
		description: string;
		chipStyle: CSSProperties;
	}
> = {
	complete: {
		label: "公式連携OK",
		description: "この会場は公式データ連携を運用確認済みです。",
		chipStyle: {
			...venueOfficialLinkStatusChipBaseStyle,
			background: "linear-gradient(180deg, rgba(232, 255, 247, 0.98), rgba(214, 248, 236, 0.94))",
			border: "1px solid rgba(85, 188, 150, 0.32)",
			color: "#186951",
		},
	},
	partial: {
		label: "一部連携OK",
		description: "主要な公式データは連携済みです。未取得カテゴリは待機表示にしています。",
		chipStyle: {
			...venueOfficialLinkStatusChipBaseStyle,
			background: "linear-gradient(180deg, rgba(234, 247, 255, 0.98), rgba(218, 240, 255, 0.94))",
			border: "1px solid rgba(88, 155, 222, 0.3)",
			color: "#225f9a",
		},
	},
	checking: {
		label: "連携確認中",
		description: "この会場は公式データ連携を確認中です。",
		chipStyle: {
			...venueOfficialLinkStatusChipBaseStyle,
			background: "linear-gradient(180deg, rgba(246, 244, 255, 0.96), rgba(240, 241, 250, 0.92))",
			border: "1px solid rgba(165, 168, 208, 0.28)",
			color: "#66689c",
		},
	},
};

function getVenueOfficialLinkStatus(venueName?: string | null): VenueOfficialLinkStatus {
	if (!venueName) {
		return "checking";
	}

	return venueOfficialLinkStatusMap[venueName] ?? "checking";
}

export function RacesPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [dataUpdatedAt, setDataUpdatedAt] = useState("");
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [selectedVenueExtraPanel, setSelectedVenueExtraPanel] = useState<VenueExtraPanelKey>("official");
	const [selectedNarutoStatsTab, setSelectedNarutoStatsTab] = useState<NarutoStatsTab>("score");
	const sortedTodayVenues = useMemo(() => sortTodayVenues(todayFeed.venues), [todayFeed]);
	const venueSelectorVenues = useMemo(
		() => sortedTodayVenues.map((venue) => ({
			...venue,
			session: getVenueDisplaySession(venue),
		})),
		[sortedTodayVenues],
	);
	const initialVenue = sortedTodayVenues[0];
	const initialRace = initialVenue ? getFirstSelectableRace(initialVenue.races) : undefined;
	const [selectedVenueId, setSelectedVenueId] = useState<string>(initialVenue?.id ?? "");
	const [selectedRaceId, setSelectedRaceId] = useState<string>(getRaceKey(initialVenue?.id ?? "", initialRace?.raceId, initialRace?.raceNo ?? 0));

	const refreshTodayFeed = async (options?: { silent?: boolean; cancelled?: () => boolean }) => {
		if (!options?.silent) {
			setIsRefreshingFeed(true);
			setRefreshMessage("画面表示用の JSON を読み込み中です...");
		}

		try {
			const [result, venueExtrasResult] = await Promise.all([
				loadBoatTodayRaceDetailsFeed(),
				loadBoatVenueExtrasFeed(),
			]);

			if (options?.cancelled?.()) {
				return;
			}

			if (!result) {
				if (!options?.silent) {
					setRefreshMessage("画面表示用の JSON を取得できませんでした。現在表示中のデータを維持します。");
				}
				return;
			}

			setTodayFeed(result);
			setDataUpdatedAt(result.generatedAt ?? "");
			setVenueExtrasFeed(venueExtrasResult);

			if (!options?.silent) {
				setRefreshMessage(
					venueExtrasResult
						? "画面表示用の最新 JSON を読み込みました。元データ更新にはスクリプト実行が必要です。"
						: "画面表示用の最新 JSON を読み込みました。会場独自データはまだ未取得です。",
				);
			}
		} catch {
			if (!options?.silent && !options?.cancelled?.()) {
				setRefreshMessage("データ更新中にエラーが発生しました。");
			}
		} finally {
			if (!options?.silent && !options?.cancelled?.()) {
				setIsRefreshingFeed(false);
			}
		}
	};

	useEffect(() => {
		let cancelled = false;

		void refreshTodayFeed({
			silent: true,
			cancelled: () => cancelled,
		});

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const firstVenue = sortedTodayVenues[0];
		const firstRace = firstVenue ? getFirstSelectableRace(firstVenue.races) : undefined;

		if (!firstVenue || !firstRace) {
			return;
		}

		const currentVenue = todayFeed.venues.find((venue) => venue.id === selectedVenueId);
		const currentRace = currentVenue?.races.find((race) => {
			const raceId = race.raceId || `${currentVenue.id}-${race.raceNo}`;
			return raceId === selectedRaceId;
		});

		if (!currentVenue || !currentRace) {
			setSelectedVenueId(firstVenue.id);
			setSelectedRaceId(firstRace.raceId || `${firstVenue.id}-${firstRace.raceNo}`);
		}
	}, [todayFeed, sortedTodayVenues, selectedVenueId, selectedRaceId]);

	const selectedVenue = useMemo(
		() => todayFeed.venues.find((venue) => venue.id === selectedVenueId) ?? initialVenue,
		[todayFeed, selectedVenueId, initialVenue],
	);
	const selectedRace = useMemo(
		() => selectedVenue?.races.find((race) => getRaceKey(selectedVenue.id, race.raceId, race.raceNo) === selectedRaceId) ?? selectedVenue?.races[0],
		[selectedVenue, selectedRaceId],
	);

	const handleSelectRace = (venueId: string, raceId: string) => {
		setSelectedVenueId(venueId);
		setSelectedRaceId(raceId);
	};

	const handleSelectVenue = (venueId: string) => {
		const venue = todayFeed.venues.find((item) => item.id === venueId);
		const firstRace = venue ? getFirstSelectableRace(venue.races) : undefined;

		setSelectedVenueId(venueId);
		if (venue && firstRace) {
			setSelectedRaceId(getRaceKey(venue.id, firstRace.raceId, firstRace.raceNo));
		}
	};

	const refreshMessageStyle = useMemo(() => {
		if (!refreshMessage) {
			return null;
		}

		if (refreshMessage.includes("エラー") || refreshMessage.includes("取得できませんでした")) {
			return {
				color: "#b45454",
				background: "rgba(255, 237, 237, 0.9)",
				border: "1px solid rgba(212, 104, 104, 0.18)",
			};
		}

		if (refreshMessage.includes("読み込み中")) {
			return {
				color: boatTheme.colors.navy,
				background: "rgba(240, 248, 253, 0.94)",
				border: "1px solid rgba(93, 199, 232, 0.18)",
			};
		}

		return {
			color: boatTheme.colors.aquaDeep,
			background: "rgba(236, 250, 246, 0.92)",
			border: "1px solid rgba(139, 225, 208, 0.2)",
		};
	}, [refreshMessage]);

	const spotlightContent = useMemo(() => {
		if (!selectedVenue) {
			return {
				summary: "会場特性と直前情報を横断して確認できる画面です。",
				imageSrc: undefined,
				imageAlt: undefined,
			};
		}

		return venueSpotlightCopy[selectedVenue.venueName] ?? {
			summary: "直前情報と展示気配を横断して確認したい会場です。",
			imageSrc: undefined,
			imageAlt: undefined,
		};
	}, [selectedVenue]);

	const selectedRaceLabel = useMemo(() => {
		if (!selectedRace) {
			return "未選択";
		}

		return `${selectedRace.raceNo}R`;
	}, [selectedRace]);

	const selectedRaceMeta = useMemo(() => {
		if (!selectedRace) {
			return "詳細未選択";
		}

		const title = selectedRace.title?.trim();
		if (title && title !== `${selectedRace.raceNo}R`) {
			return title;
		}

		return `締切 ${selectedRace.deadlineTime?.trim() || "--:--"}`;
	}, [selectedRace]);
	
	const venueExtrasStatusText = useMemo(() => {
	if (!venueExtrasFeed) {
		return "";
	}

	const venueCount = venueExtrasFeed.venues?.length ?? 0;
	const updatedAt = venueExtrasFeed.generatedAt?.trim() || "準備中";

	return `会場独自データ更新：${formatJstDateTimeLabel(updatedAt)} / ${venueCount}会場`;
}, [venueExtrasFeed]);

const selectedVenueExtra = useMemo(() => {
	if (!venueExtrasFeed || !selectedVenue) {
		return null;
	}

	return venueExtrasFeed.venues?.find((venue) => venue.venueName === selectedVenue.venueName) ?? null;
}, [venueExtrasFeed, selectedVenue]);

const selectedRaceExtra = useMemo(() => {
	if (!selectedVenueExtra || !selectedRace) {
		return null;
	}

	return selectedVenueExtra.races?.find((race) => race.raceNo === selectedRace.raceNo) ?? null;
}, [selectedVenueExtra, selectedRace]);

const selectedOfficialBeforeInfo = useMemo(
	() => getOfficialBeforeInfoDisplay(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOriginalExhibitionRows = useMemo(
	() => getVenueOriginalExhibitionRows(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedVenuePrediction = useMemo(
	() => getVenuePredictionDisplay(selectedRaceExtra),
	[selectedRaceExtra],
);

const hasVenuePredictionRecord = useMemo(
	() => Boolean(selectedRaceExtra && isVenueExtraRecord(selectedRaceExtra.venuePrediction)),
	[selectedRaceExtra],
);

const selectedRacerComments = useMemo(
	() => getVenueRacerComments(selectedRaceExtra),
	[selectedRaceExtra],
);

const shouldShowVenuePrediction = false as boolean;

const selectedMotorSummary = useMemo(
	() => getVenueMotorSummary(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedMotorSummaryDisplay = useMemo(
	() => resolveVenueMotorSummaryDisplay(selectedVenue?.venueName, selectedOriginalExhibitionRows, selectedMotorSummary),
	[selectedVenue?.venueName, selectedOriginalExhibitionRows, selectedMotorSummary],
);

const selectedAbilityIndex = useMemo(
	() => getVenueAbilityIndex(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedAbilityIndexByFrame = useMemo(
	() => new Map(selectedAbilityIndex.map((item) => [item.frameNo, item])),
	[selectedAbilityIndex],
);

const selectedStartExhibition = useMemo(
	() => getVenueStartExhibition(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWaterMemo = useMemo(
	() => getVenueWaterMemo(selectedRaceExtra, selectedVenueExtra),
	[selectedRaceExtra, selectedVenueExtra],
);

const selectedOfficialWeatherCondition = useMemo(
	() => getVenueOfficialWeatherCondition(selectedRaceExtra, selectedVenueExtra, selectedVenue?.weatherActual),
	[selectedRaceExtra, selectedVenueExtra, selectedVenue?.weatherActual],
);

const selectedMikuniBeforeInfo = useMemo(
	() => getMikuniBeforeInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedMikuniScoreRateGuide = useMemo(
	() => getMikuniScoreRateGuide(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedMikuniCourseResults = useMemo(
	() => getMikuniCourseResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedMikuniMotorHistory = useMemo(
	() => getMikuniMotorHistory(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedMikuniWaterSurfaceDisplay = useMemo(
	() => selectedVenue?.venueName === "三国" ? getMikuniWaterSurfaceDisplay(selectedWaterMemo?.waterSurfaceInfo ?? null) : null,
	[selectedVenue?.venueName, selectedWaterMemo],
);

const selectedNarutoRacerPerformance = useMemo(
	() => getNarutoRacerPerformance(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOmuraEntryTable = useMemo(
	() => getOmuraEntryTable(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOmuraPreviousDayResults = useMemo(
	() => getOmuraPreviousDayResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOmuraNationalFrameStats = useMemo(
	() => getOmuraNationalFrameStats(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOmuraFrameLast10 = useMemo(
	() => getOmuraFrameLast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOmuraRacerCommentsMotor = useMemo(
	() => getOmuraRacerCommentsMotor(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedOmuraExhibitionInfo = useMemo(
	() => getOmuraExhibitionInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const omuraNationalFrameStatsDisplay = useMemo(
	() => selectedOmuraEntryTable.map((entry) => selectedOmuraNationalFrameStats.find((item) => item.frameNo === entry.frameNo) ?? {
		frameNo: entry.frameNo,
		playerName: entry.playerName,
		firstRate: "",
		secondRate: "",
		thirdRate: "",
		otherRate: "",
		frameTrifectaRate: "",
		frameAverageStart: "",
		frameAverageStartRank: "",
	}),
	[selectedOmuraEntryTable, selectedOmuraNationalFrameStats],
);

const omuraFrameLast10Display = useMemo(
	() => selectedOmuraEntryTable.map((entry) => selectedOmuraFrameLast10.find((item) => item.frameNo === entry.frameNo) ?? {
		frameNo: entry.frameNo,
		playerName: entry.playerName,
		courseHistory: [],
		finishHistory: [],
		startTimingHistory: [],
		frameWinRate: "",
		frameAverageStart: "",
	}),
	[selectedOmuraEntryTable, selectedOmuraFrameLast10],
);

const omuraPreviousDayResultsDisplay = useMemo(
	() => selectedOmuraEntryTable.map((entry) => selectedOmuraPreviousDayResults.find((item) => item.frameNo === entry.frameNo) ?? {
		frameNo: entry.frameNo,
		className: entry.className,
		registerNo: entry.registerNo,
		playerName: entry.playerName,
		date: "",
		items: [],
	}),
	[selectedOmuraEntryTable, selectedOmuraPreviousDayResults],
);

const omuraCommentsMotorDisplay = useMemo(
	() => selectedOmuraEntryTable.map((entry) => selectedOmuraRacerCommentsMotor.find((item) => item.frameNo === entry.frameNo) ?? {
		frameNo: entry.frameNo,
		playerName: entry.playerName,
		comment: "",
		motorEvaluation: entry.motorEvaluation,
		motorNo: entry.motorNo,
		pastCommentUrl: "",
	}),
	[selectedOmuraEntryTable, selectedOmuraRacerCommentsMotor],
);

const omuraExhibitionInfoDisplay = useMemo(
	() => {
		if (selectedOmuraEntryTable.length > 0) {
			return selectedOmuraEntryTable.map((entry) => selectedOmuraExhibitionInfo.find((item) => item.frameNo === entry.frameNo) ?? {
				frameNo: entry.frameNo,
				course: "",
				playerName: entry.playerName,
				startTiming: "",
				exhibitionTime: "",
				oneLapTime: "",
				turnTime: "",
				straightTime: "",
				tilt: "",
				partsExchange: "",
				startType: "",
				evaluation: "",
			});
		}

		return selectedOmuraExhibitionInfo;
	},
	[selectedOmuraEntryTable, selectedOmuraExhibitionInfo],
);

const selectedBiwakoSeriesResults = useMemo(
	() => getBiwakoSeriesResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedBiwakoFramePast10 = useMemo(
	() => getBiwakoFramePast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuBeforeInfo = useMemo(
	() => getTsuBeforeInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuRacerComments = useMemo(
	() => getTsuRacerComments(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuSeriesResults = useMemo(
	() => getTsuSeriesResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuNationalRecent3 = useMemo(
	() => getTsuNationalRecent3(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuLocalRecent3 = useMemo(
	() => getTsuLocalRecent3(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuFramePast10 = useMemo(
	() => getTsuFramePast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuScoreRateGuide = useMemo(
	() => getTsuScoreRateGuide(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuMotorHistory = useMemo(
	() => getTsuMotorHistory(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuEntryRows = useMemo(
	() => getWakamatsuEntryRows(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuBeforeInfo = useMemo(
	() => getWakamatsuBeforeInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuSeriesResults = useMemo(
	() => getWakamatsuSeriesResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuCourseStats = useMemo(
	() => getWakamatsuCourseStats(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuNationalRecent3 = useMemo(
	() => getWakamatsuNationalRecent3(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuLocalRecent3 = useMemo(
	() => getWakamatsuLocalRecent3(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuFramePast10 = useMemo(
	() => getWakamatsuFramePast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuScoreRateGuide = useMemo(
	() => getWakamatsuScoreRateGuide(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWakamatsuMotorHistory = useMemo(
	() => getWakamatsuMotorHistory(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaEntryRows = useMemo(
	() => getFukuokaEntryRows(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaBeforeInfo = useMemo(
	() => getFukuokaBeforeInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaMotorEvaluation = useMemo(
	() => getFukuokaMotorEvaluation(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaSeriesResults = useMemo(
	() => getFukuokaSeriesResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaRacerComments = useMemo(
	() => getFukuokaRacerComments(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaFramePast10 = useMemo(
	() => getFukuokaFramePast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTokuyamaFramePast10 = useMemo(
	() => getTokuyamaFramePast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedAshiyaFrameLast10 = useMemo(
	() => getAshiyaFrameLast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKiryuFrameLast10 = useMemo(
	() => getKiryuFrameLast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKiryuCourseResults = useMemo(
	() => getKiryuCourseResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedFukuokaScoreRateGuide = useMemo(
	() => getFukuokaScoreRateGuide(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaBeforeInfo = useMemo(
	() => getKojimaBeforeInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaSeriesResults = useMemo(
	() => getKojimaSeriesResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaRecentResults = useMemo(
	() => getKojimaRecentResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaCourseStats = useMemo(
	() => getKojimaCourseStats(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaMotorStats = useMemo(
	() => getKojimaMotorStats(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaFrameStats = useMemo(
	() => getKojimaFrameStats(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedKojimaScoreRateGuide = useMemo(
	() => getKojimaScoreRateGuide(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTsuFramePast10Display = useMemo(
	() => selectedTsuFramePast10.map((row) => {
		const beforeInfo = selectedTsuBeforeInfo.find((item) => item.frameNo === row.frameNo);

		return {
			...row,
			className: row.className || beforeInfo?.className || "",
			registerNo: row.registerNo || beforeInfo?.registerNo || "",
			playerName: row.playerName || beforeInfo?.playerName || `枠${row.frameNo}`,
			profile: row.profile || beforeInfo?.profile || "",
		};
	}),
	[selectedTsuFramePast10, selectedTsuBeforeInfo],
);

const selectedTamagawaEntryTable = useMemo(
	() => getTamagawaEntryTable(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTamagawaBeforeInfo = useMemo(
	() => getTamagawaBeforeInfo(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTamagawaMotorHistory = useMemo(
	() => getTamagawaMotorHistory(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTamagawaSeriesResults = useMemo(
	() => getTamagawaSeriesResults(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTamagawaFramePast10 = useMemo(
	() => getTamagawaFramePast10(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTamagawaScoreRateGuide = useMemo(
	() => getTamagawaScoreRateGuide(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedTamagawaOddsResult = useMemo(
	() => getTamagawaOddsResult(selectedRaceExtra),
	[selectedRaceExtra],
);

const narutoStartExhibitionDisplay = useMemo(
	() => getNarutoStartExhibitionDisplay(selectedOfficialBeforeInfo, selectedStartExhibition),
	[selectedOfficialBeforeInfo, selectedStartExhibition],
);

const tamagawaStartExhibitionDisplay = useMemo(() => {
	const frameNoByPlayerName = new Map(
		selectedTamagawaBeforeInfo
			.map((row) => [normalizeVenueExtraPlayerName(row.playerName), row.frameNo] as const)
			.filter(([playerName]) => Boolean(playerName)),
	);

	const playerNameByFrameNo = new Map(
		selectedTamagawaBeforeInfo.map((row) => [row.frameNo, row.playerName] as const),
	);

	return selectedStartExhibition
		.map((row) => {
			const normalizedPlayerName = normalizeVenueExtraPlayerName(row.playerName);
			const correctedFrameNo = frameNoByPlayerName.get(normalizedPlayerName) ?? row.frameNo;

			return {
				course: row.course,
				frameNo: correctedFrameNo,
				playerName: row.playerName || playerNameByFrameNo.get(correctedFrameNo) || `枠${correctedFrameNo}`,
				currentAverageStart: row.currentAverageStart,
				startTiming: row.startTiming,
				startOrder: row.startOrder ? readVenueExtraNumber(row.startOrder) : null,
				startLanePosition: getTamagawaStartLanePosition(row.startTiming),
				style: row.style,
			};
		})
		.sort((left, right) => left.course - right.course);
}, [selectedStartExhibition, selectedTamagawaBeforeInfo]);
const { isNarutoVenue, isKaratsuVenue, isBiwakoVenue, isTamagawaVenue, isTsuVenue, isWakamatsuVenue, isFukuokaVenue, isKojimaVenue, isOmuraVenue, isMarugameVenue } = getVenueExtraVenueFlags(selectedVenue?.venueName);
const isMikuniVenue = selectedVenue?.venueName === "三国";
const isTokuyamaVenue = selectedVenue?.venueName === "徳山";
const isTokonameVenue = selectedVenue?.venueName === "常滑";
const isAshiyaVenue = selectedVenue?.venueName === "芦屋";
const isKiryuVenue = selectedVenue?.venueName === "桐生";
const isMiyajimaVenue = selectedVenue?.venueName === "宮島";
const selectedVenueOfficialLinkStatus = getVenueOfficialLinkStatus(selectedVenue?.venueName);
const selectedVenueOfficialLinkStatusMeta = venueOfficialLinkStatusMeta[selectedVenueOfficialLinkStatus];
const hasOmuraEntryData = selectedOmuraEntryTable.length > 0;
const hasOmuraPreviousDayData = selectedOmuraPreviousDayResults.some((row) => row.items.length > 0);
const hasOmuraNationalFrameStatsData = selectedOmuraNationalFrameStats.length > 0;
const hasOmuraFrameLast10Data = selectedOmuraFrameLast10.length > 0;
const hasOmuraCommentsMotorData = selectedOmuraRacerCommentsMotor.length > 0;
const hasOmuraExhibitionData = omuraExhibitionInfoDisplay.length >= 6;
const hasBiwakoFramePast10Data = selectedBiwakoFramePast10.length > 0;
const hasBiwakoSeriesResultsData = selectedBiwakoSeriesResults.length > 0;
const hasTsuBeforeInfoData = selectedTsuBeforeInfo.length > 0;
const hasTsuRacerCommentsData = selectedTsuRacerComments.length > 0;
const hasTsuSeriesResultsData = selectedTsuSeriesResults.length > 0;
const hasTsuNationalRecent3Data = selectedTsuNationalRecent3.length > 0;
const hasTsuLocalRecent3Data = selectedTsuLocalRecent3.length > 0;
const hasTsuFramePast10Data = selectedTsuFramePast10Display.length > 0;
const hasTsuScoreRateGuideData = selectedTsuScoreRateGuide.length > 0;
const hasTsuMotorHistoryData = selectedTsuMotorHistory.length > 0;
const hasWakamatsuEntryData = selectedWakamatsuEntryRows.length > 0;
const hasWakamatsuBeforeInfoData = selectedWakamatsuBeforeInfo.length > 0;
const hasWakamatsuSeriesResultsData = selectedWakamatsuSeriesResults.length > 0;
const hasWakamatsuCourseStatsData = selectedWakamatsuCourseStats.length > 0;
const hasWakamatsuNationalRecent3Data = selectedWakamatsuNationalRecent3.length > 0;
const hasWakamatsuLocalRecent3Data = selectedWakamatsuLocalRecent3.length > 0;
const hasWakamatsuFramePast10Data = selectedWakamatsuFramePast10.length > 0;
const hasWakamatsuScoreRateGuideData = selectedWakamatsuScoreRateGuide.length > 0;
const hasWakamatsuMotorHistoryData = selectedWakamatsuMotorHistory.length > 0;
const hasFukuokaEntryData = selectedFukuokaEntryRows.length > 0;
const hasFukuokaBeforeInfoData = selectedFukuokaBeforeInfo.length > 0;
const hasFukuokaMotorEvaluationData = selectedFukuokaMotorEvaluation.length > 0;
const hasFukuokaSeriesResultsData = selectedFukuokaSeriesResults.length > 0;
const hasFukuokaRacerCommentsData = selectedFukuokaRacerComments.length > 0;
const hasFukuokaFramePast10Data = selectedFukuokaFramePast10.length > 0;
const hasTokuyamaFramePast10Data = selectedTokuyamaFramePast10.length > 0;
const hasAshiyaFrameLast10Data = selectedAshiyaFrameLast10.length > 0;
const hasKiryuFrameLast10Data = selectedKiryuFrameLast10.length > 0;
const hasKiryuCourseResultsData = selectedKiryuCourseResults.length > 0;
const hasKojimaBeforeInfoData = selectedKojimaBeforeInfo.length > 0;
const hasKojimaSeriesResultsData = selectedKojimaSeriesResults.length > 0;
const hasKojimaRecentResultsData = selectedKojimaRecentResults.length > 0;
const hasKojimaCourseStatsData = selectedKojimaCourseStats.length > 0;
const hasKojimaMotorStatsData = selectedKojimaMotorStats.length > 0;
const hasKojimaFrameStatsData = selectedKojimaFrameStats.length > 0;
const hasTamagawaEntryData = selectedTamagawaEntryTable.length > 0;

// 多摩川は公式由来の出走表データが取れている場合、メイン出走表にもそちらを使う。
// 公式データがあるのに通常の出走表を使うと、選手情報が不足して空欄表示になる場合があるため。
const shouldUseTamagawaOfficialEntry = isTamagawaVenue && hasTamagawaEntryData;

// Venue Official Extras内に「多摩川公式の出走表補完表示」を重複表示しないため false にしている
const shouldShowTamagawaEntryFallback = false as boolean;

const tamagawaFallbackRacers = useMemo<BoatRacerItem[]>(() => {
	return selectedTamagawaEntryTable.map((item) => {
		const profileParts = item.profile.split("/").map((value) => value.trim());

		return {
			frameNo: item.frameNo as BoatRacerItem["frameNo"],
			boatNo: item.boatNo || "-",
			name: item.playerName,
			branch: (profileParts[0] || "-").replace(/\s+/g, ""),
			class: item.className || "-",
			age: (profileParts[2] || "-").replace(/\s+/g, ""),
			averageStart: item.averageStart || "-",
			winRate: item.nationalWinRate || "-",
			secondRate: item.nationalSecondRate || "-",
			motorNo: item.motorNo || "-",
			motorSecondRate: item.motorSecondRate || "-",
			boatMotorNo: item.boatNo || "-",
			boatSecondRate: item.boatSecondRate || "-",
		};
	});
}, [selectedTamagawaEntryTable]);
const hasTamagawaBeforeInfoData = selectedTamagawaBeforeInfo.length > 0;
const hasTamagawaMotorHistoryData = selectedTamagawaMotorHistory.length > 0;
const hasTamagawaSeriesResultsData = selectedTamagawaSeriesResults.length > 0;
const hasTamagawaFramePast10Data = selectedTamagawaFramePast10.length > 0;
const hasTamagawaScoreRateGuideData = selectedTamagawaScoreRateGuide.length > 0;
const hasTamagawaOddsResultData = Boolean(selectedTamagawaOddsResult);
const hasOfficialBeforeInfoDetail = Boolean(
	(selectedOfficialBeforeInfo && (
		selectedOfficialBeforeInfo.exhibitionRows.length > 0 ||
		selectedOfficialBeforeInfo.startExhibition.length > 0 ||
		selectedOfficialBeforeInfo.scoreQuickLook.length > 0
	)) ||
	selectedMikuniBeforeInfo.length > 0,
);
const shouldShowOfficialBeforeInfoWaiting = Boolean(selectedOfficialBeforeInfo && !hasOfficialBeforeInfoDetail);
const hasOriginalExhibitionData = selectedOriginalExhibitionRows.length > 0;
const hasStartExhibitionData = selectedStartExhibition.length > 0;
const hasVenuePredictionFocus = Boolean(
	shouldShowVenuePrediction &&
	selectedVenuePrediction &&
	selectedVenuePrediction.mainFocus.length > 0,
);
const shouldShowOriginalExhibitionWaiting = Boolean(selectedRaceExtra && !hasOriginalExhibitionData);
const shouldShowVenuePredictionWaiting = Boolean(
	shouldShowVenuePrediction &&
	hasVenuePredictionRecord &&
	!hasVenuePredictionFocus,
);
const hasSelectedMotorSummaryData = selectedMotorSummaryDisplay.items.length > 0;
const shouldShowMotorSummaryWaiting = selectedMotorSummaryDisplay.isAwaitingMatch;
const hasOriginalOneLapTimeData = selectedOriginalExhibitionRows.some((row) => Boolean(row.oneLapTime));
const hasOriginalTurnTimeData = selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime));
const hasOriginalStraightTimeData = selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime));
const hasNarutoPerformanceData = Boolean(
	selectedNarutoRacerPerformance && (
		selectedNarutoRacerPerformance.byFramePast10.length > 0 ||
		selectedNarutoRacerPerformance.narutoRecent.length > 0 ||
		selectedNarutoRacerPerformance.nationalRecent.length > 0
	),
);
const shouldShowNarutoPerformanceWaiting = Boolean(isNarutoVenue && selectedRaceExtra && !hasNarutoPerformanceData);
const hasFukuokaScoreRateGuideData = Boolean(selectedFukuokaScoreRateGuide.length || selectedOfficialBeforeInfo?.scoreQuickLook.length);
const hasKojimaScoreRateGuideData = Boolean(selectedKojimaScoreRateGuide.length || selectedOfficialBeforeInfo?.scoreQuickLook.length);
const venueExtraPanelFlags = useMemo(
	() => createVenueExtraPanelFlags({
		hasOfficialBeforeInfoDetail,
		shouldShowOfficialBeforeInfoWaiting,
		hasOfficialStartExhibition: Boolean(selectedOfficialBeforeInfo && selectedOfficialBeforeInfo.startExhibition.length > 0),
		hasOfficialScoreRows: Boolean(selectedOfficialBeforeInfo && selectedOfficialBeforeInfo.scoreQuickLook.length > 0),
		hasOriginalExhibitionData,
		hasStartExhibitionData,
		hasVenuePredictionFocus,
		shouldShowOriginalExhibitionWaiting,
		shouldShowVenuePredictionWaiting,
		hasSelectedMotorSummaryData,
		shouldShowMotorSummaryWaiting,
		hasNarutoPerformanceData,
		shouldShowNarutoPerformanceWaiting,
		hasTamagawaMotorHistoryData,
		hasRacerComments: selectedRacerComments.length > 0,
		hasWaterMemo: Boolean(selectedWaterMemo || selectedOfficialWeatherCondition),
		hasAbilityIndex: selectedAbilityIndex.length > 0,
		hasOmuraEntryData,
		hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasBiwakoFramePast10Data,
		hasBiwakoSeriesResultsData,
		hasTsuBeforeInfoData,
		hasTsuRacerCommentsData,
		hasTsuSeriesResultsData,
		hasTsuNationalRecent3Data,
		hasTsuLocalRecent3Data,
		hasTsuFramePast10Data,
		hasTsuScoreRateGuideData,
		hasWakamatsuEntryData,
		hasWakamatsuBeforeInfoData,
		hasWakamatsuSeriesResultsData,
		hasWakamatsuCourseStatsData,
		hasWakamatsuNationalRecent3Data,
		hasWakamatsuLocalRecent3Data,
		hasWakamatsuFramePast10Data,
		hasWakamatsuScoreRateGuideData,
		hasWakamatsuMotorHistoryData,
		hasFukuokaEntryData,
		hasFukuokaBeforeInfoData,
		hasFukuokaMotorEvaluationData,
		hasFukuokaSeriesResultsData,
		hasFukuokaRacerCommentsData,
		hasFukuokaFramePast10Data,
		hasFukuokaScoreRateGuideData,
		hasKojimaBeforeInfoData,
		hasKojimaSeriesResultsData,
		hasKojimaRecentResultsData,
		hasKojimaCourseStatsData,
		hasKojimaMotorStatsData,
		hasKojimaFrameStatsData,
		hasKojimaScoreRateGuideData,
		hasTamagawaEntryData,
		hasTamagawaBeforeInfoData,
		hasTamagawaSeriesResultsData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasTamagawaOddsResultData,
	}),
	[
		hasOfficialBeforeInfoDetail,
		shouldShowOfficialBeforeInfoWaiting,
		selectedOfficialBeforeInfo,
		hasOriginalExhibitionData,
		hasStartExhibitionData,
		hasVenuePredictionFocus,
		shouldShowOriginalExhibitionWaiting,
		shouldShowVenuePredictionWaiting,
		hasSelectedMotorSummaryData,
		shouldShowMotorSummaryWaiting,
		hasNarutoPerformanceData,
		shouldShowNarutoPerformanceWaiting,
		hasTamagawaMotorHistoryData,
		selectedRacerComments.length,
		selectedWaterMemo,
		selectedOfficialWeatherCondition,
		selectedAbilityIndex.length,
		hasOmuraEntryData,
		hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasBiwakoFramePast10Data,
		hasBiwakoSeriesResultsData,
		hasTsuBeforeInfoData,
		hasTsuRacerCommentsData,
		hasTsuSeriesResultsData,
		hasTsuNationalRecent3Data,
		hasTsuLocalRecent3Data,
		hasTsuFramePast10Data,
		hasTsuScoreRateGuideData,
		hasWakamatsuEntryData,
		hasWakamatsuBeforeInfoData,
		hasWakamatsuSeriesResultsData,
		hasWakamatsuCourseStatsData,
		hasWakamatsuNationalRecent3Data,
		hasWakamatsuLocalRecent3Data,
		hasWakamatsuFramePast10Data,
		hasWakamatsuScoreRateGuideData,
		hasWakamatsuMotorHistoryData,
		hasFukuokaEntryData,
		hasFukuokaBeforeInfoData,
		hasFukuokaMotorEvaluationData,
		hasFukuokaSeriesResultsData,
		hasFukuokaRacerCommentsData,
		hasFukuokaFramePast10Data,
		hasFukuokaScoreRateGuideData,
		hasKojimaBeforeInfoData,
		hasKojimaSeriesResultsData,
		hasKojimaRecentResultsData,
		hasKojimaCourseStatsData,
		hasKojimaMotorStatsData,
		hasKojimaFrameStatsData,
		hasKojimaScoreRateGuideData,
		hasTamagawaEntryData,
		hasTamagawaBeforeInfoData,
		hasTamagawaSeriesResultsData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasTamagawaOddsResultData,
	],
);
const {
	hasSelectedVenueExtrasDetail,
	hasOfficialPanelData,
	hasStartPanelData,
	hasRecordsPanelData,
	hasExhibitionPanelData,
	hasMotorPanelData,
	hasWaterPanelData,
} = venueExtraPanelFlags;
const hasOfficialWeightData = Boolean(selectedOfficialBeforeInfo?.exhibitionRows.some((item) => item.weight || item.weightAdjustment));
const tamagawaScoreRows = selectedTamagawaScoreRateGuide.length
	? selectedTamagawaScoreRateGuide
	: selectedOfficialBeforeInfo?.scoreQuickLook ?? [];

const tsuScoreRows = useMemo(() => {
	const officialRows = selectedOfficialBeforeInfo?.scoreQuickLook ?? [];
	const officialByFrameNo = new Map(officialRows.map((row) => [row.frameNo, row] as const));

	if (selectedTsuScoreRateGuide.length === 0) {
		return officialRows;
	}

	return selectedTsuScoreRateGuide.map((row) => {
		const officialRow = officialByFrameNo.get(row.frameNo);

		return {
			frameNo: row.frameNo,
			registrationNo: row.registrationNo || officialRow?.registrationNo || "",
			playerName: row.playerName || officialRow?.playerName || "",
			className: row.className || officialRow?.className || "",
			averageStart: row.averageStart || officialRow?.averageStart || "",
			winRate: row.winRate || officialRow?.winRate || "",
			secondRate: row.secondRate || officialRow?.secondRate || "",
			localWinRate: row.localWinRate || officialRow?.localWinRate || "",
			localSecondRate: row.localSecondRate || officialRow?.localSecondRate || "",
			motorNo: row.motorNo || officialRow?.motorNo || "",
			motorSecondRate: row.motorSecondRate || officialRow?.motorSecondRate || "",
			source: row.source || officialRow?.source,
		};
	}).sort((left, right) => left.frameNo - right.frameNo);
}, [selectedOfficialBeforeInfo, selectedTsuScoreRateGuide]);

const fukuokaScoreRows = useMemo(() => {
	const officialRows = selectedOfficialBeforeInfo?.scoreQuickLook ?? [];
	const officialByFrameNo = new Map(officialRows.map((row) => [row.frameNo, row] as const));

	if (selectedFukuokaScoreRateGuide.length === 0) {
		return officialRows.map((row) => ({
			frameNo: row.frameNo,
			registrationNo: row.registrationNo,
			playerName: row.playerName,
			className: row.className,
			averageStart: row.averageStart,
			winRate: row.winRate,
			secondRate: row.secondRate,
			localWinRate: row.localWinRate,
			localSecondRate: row.localSecondRate,
			motorNo: row.motorNo,
			motorSecondRate: row.motorSecondRate,
			scoreRate: "",
			source: row.source,
		}));
	}

	return selectedFukuokaScoreRateGuide.map((row) => {
		const officialRow = officialByFrameNo.get(row.frameNo);

		return {
			frameNo: row.frameNo,
			registrationNo: row.registrationNo || officialRow?.registrationNo || "",
			playerName: row.playerName || officialRow?.playerName || "",
			className: row.className || officialRow?.className || "",
			averageStart: row.averageStart || officialRow?.averageStart || "",
			winRate: row.winRate || officialRow?.winRate || "",
			secondRate: row.secondRate || officialRow?.secondRate || "",
			localWinRate: row.localWinRate || officialRow?.localWinRate || "",
			localSecondRate: row.localSecondRate || officialRow?.localSecondRate || "",
			motorNo: row.motorNo || officialRow?.motorNo || "",
			motorSecondRate: row.motorSecondRate || officialRow?.motorSecondRate || "",
			scoreRate: row.scoreRate || "",
			source: row.source || officialRow?.source,
		};
	}).sort((left, right) => left.frameNo - right.frameNo);
}, [selectedOfficialBeforeInfo, selectedFukuokaScoreRateGuide]);

const kojimaScoreRows = useMemo(() => {
	const officialRows = selectedOfficialBeforeInfo?.scoreQuickLook ?? [];
	const officialByFrameNo = new Map(officialRows.map((row) => [row.frameNo, row] as const));

	if (selectedKojimaScoreRateGuide.length === 0) {
		return officialRows.map((row) => ({
			frameNo: row.frameNo,
			registrationNo: row.registrationNo,
			playerName: row.playerName,
			className: row.className,
			averageStart: row.averageStart,
			winRate: row.winRate,
			secondRate: row.secondRate,
			localWinRate: row.localWinRate,
			localSecondRate: row.localSecondRate,
			motorNo: row.motorNo,
			motorSecondRate: row.motorSecondRate,
			scoreRate: "",
			source: row.source,
		}));
	}

	return selectedKojimaScoreRateGuide.map((row) => {
		const officialRow = officialByFrameNo.get(row.frameNo);

		return {
			frameNo: row.frameNo,
			registrationNo: row.registrationNo || officialRow?.registrationNo || "",
			playerName: row.playerName || officialRow?.playerName || "",
			className: row.className || officialRow?.className || "",
			averageStart: row.averageStart || officialRow?.averageStart || "",
			winRate: row.winRate || officialRow?.winRate || "",
			secondRate: row.secondRate || officialRow?.secondRate || "",
			localWinRate: row.localWinRate || officialRow?.localWinRate || "",
			localSecondRate: row.localSecondRate || officialRow?.localSecondRate || "",
			motorNo: row.motorNo || officialRow?.motorNo || "",
			motorSecondRate: row.motorSecondRate || officialRow?.motorSecondRate || "",
			scoreRate: row.scoreRate || "",
			source: row.source || officialRow?.source,
		};
	}).sort((left, right) => left.frameNo - right.frameNo);
}, [selectedOfficialBeforeInfo, selectedKojimaScoreRateGuide]);

const kojimaFallbackRacers = useMemo<BoatRacerItem[]>(() => {
	const scoreByFrameNo = new Map(kojimaScoreRows.map((row) => [row.frameNo, row] as const));
	const beforeByFrameNo = new Map(selectedKojimaBeforeInfo.map((row) => [row.frameNo, row] as const));
	const motorByFrameNo = new Map(selectedKojimaMotorStats.map((row) => [row.frameNo, row] as const));
	const exhibitionByFrameNo = new Map(selectedOriginalExhibitionRows.map((row) => [row.frameNo, row] as const));
	const frameNumbers = new Set<BoatRacerItem["frameNo"]>();

	for (const row of kojimaScoreRows) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of selectedKojimaBeforeInfo) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of selectedKojimaMotorStats) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of selectedOriginalExhibitionRows) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	return Array.from(frameNumbers)
		.sort((left, right) => left - right)
		.map((frameNo) => {
			const scoreRow = scoreByFrameNo.get(frameNo);
			const beforeRow = beforeByFrameNo.get(frameNo);
			const motorRow = motorByFrameNo.get(frameNo);
			const exhibitionRow = exhibitionByFrameNo.get(frameNo);

			return {
				frameNo,
				boatNo: "-",
				name: scoreRow?.playerName || beforeRow?.playerName || motorRow?.playerName || exhibitionRow?.playerName || `枠${frameNo}`,
				branch: "-",
				class: scoreRow?.className || beforeRow?.className || motorRow?.className || exhibitionRow?.className || "-",
				age: "-",
				weight: exhibitionRow?.weight || beforeRow?.weight || "-",
				averageStart: scoreRow?.averageStart || "-",
				winRate: scoreRow?.winRate || motorRow?.motorWinRate || "-",
				secondRate: scoreRow?.secondRate || "-",
				motorNo: scoreRow?.motorNo || beforeRow?.motorNo || motorRow?.motorNo || exhibitionRow?.motorNo || "-",
				motorSecondRate: scoreRow?.motorSecondRate || beforeRow?.motorSecondRate || motorRow?.motorSecondRate || "-",
				boatMotorNo: "-",
				boatSecondRate: "-",
				comment: motorRow?.comment || "",
			};
		});
}, [kojimaScoreRows, selectedKojimaBeforeInfo, selectedKojimaMotorStats, selectedOriginalExhibitionRows]);

const commonRaceFallback = useMemo(
	() => buildCommonRaceFallbackRacers({
		racers: selectedRace?.racers,
		officialBeforeInfoScoreRows: selectedOfficialBeforeInfo?.scoreQuickLook ?? [],
		originalExhibitionRows: selectedOriginalExhibitionRows,
		startExhibitionRows: selectedStartExhibition,
		motorSummaryRows: selectedMotorSummaryDisplay.items,
		racerCommentRows: selectedRacerComments,
	}),
	[selectedRace?.racers, selectedOfficialBeforeInfo, selectedOriginalExhibitionRows, selectedStartExhibition, selectedMotorSummaryDisplay.items, selectedRacerComments],
);

const shouldUseKojimaOfficialEntry =
	isKojimaVenue &&
	isRaceEntryMissingOrThin(selectedRace?.racers) &&
	kojimaFallbackRacers.length > 0;

const shouldUseCommonRaceFallback =
	isRaceEntryMissingOrThin(selectedRace?.racers) &&
	!shouldUseTamagawaOfficialEntry &&
	!shouldUseKojimaOfficialEntry &&
	commonRaceFallback.racers.length > 0;

const selectedRaceDisplayRacers = shouldUseTamagawaOfficialEntry
	? tamagawaFallbackRacers
	: shouldUseKojimaOfficialEntry
		? kojimaFallbackRacers
		: shouldUseCommonRaceFallback
			? commonRaceFallback.racers
				: (selectedRace?.racers ?? []);

const selectedRaceEntryNote = shouldUseTamagawaOfficialEntry
	? "多摩川公式の出走表をメイン表示しています。"
	: shouldUseKojimaOfficialEntry
		? "児島公式の直前情報・得点率早見・モーター成績・展示情報をもとに出走表を補完表示しています。"
		: shouldUseCommonRaceFallback
			? commonRaceFallback.reason === "official-before-info"
				? "BOATRACE公式の直前データをもとに出走表を補完表示しています。"
				: "会場公式の展示情報・モーター情報・コメントをもとに出走表を補完表示しています。"
		: undefined;

const selectedRaceForDetail = useMemo(() => {
	if (!selectedRace) {
		return selectedRace;
	}

	return {
		...selectedRace,
		racers: selectedRaceDisplayRacers,
	};
}, [selectedRace, selectedRaceDisplayRacers]);

const preferredVenueExtraPanel = useMemo<VenueExtraPanelKey>(
	() => resolvePreferredVenueExtraPanel({
		isNarutoVenue,
		isKaratsuVenue,
		isBiwakoVenue,
		isTamagawaVenue,
		isTsuVenue,
		isWakamatsuVenue,
		isFukuokaVenue,
		isKojimaVenue,
		isOmuraVenue,
		isMarugameVenue,
		...venueExtraPanelFlags,
		hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasTsuBeforeInfoData,
		hasTsuRacerCommentsData,
		hasTsuSeriesResultsData,
		hasTsuNationalRecent3Data,
		hasTsuLocalRecent3Data,
		hasTsuFramePast10Data,
		hasTsuScoreRateGuideData,
		hasWakamatsuEntryData,
		hasWakamatsuBeforeInfoData,
		hasWakamatsuSeriesResultsData,
		hasWakamatsuCourseStatsData,
		hasWakamatsuNationalRecent3Data,
		hasWakamatsuLocalRecent3Data,
		hasWakamatsuFramePast10Data,
		hasWakamatsuMotorHistoryData,
		hasFukuokaEntryData,
		hasFukuokaBeforeInfoData,
		hasFukuokaMotorEvaluationData,
		hasFukuokaSeriesResultsData,
		hasFukuokaRacerCommentsData,
		hasFukuokaFramePast10Data,
		hasKojimaBeforeInfoData,
		hasKojimaSeriesResultsData,
		hasKojimaRecentResultsData,
		hasKojimaCourseStatsData,
		hasKojimaMotorStatsData,
		hasKojimaFrameStatsData,
		hasKojimaScoreRateGuideData,
		hasTamagawaBeforeInfoData,
		hasTamagawaSeriesResultsData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasBiwakoFramePast10Data,
		hasBiwakoSeriesResultsData,
	}),
	[
		isNarutoVenue,
		isKaratsuVenue,
		isBiwakoVenue,
		isTamagawaVenue,
		isTsuVenue,
		isWakamatsuVenue,
		isFukuokaVenue,
		isKojimaVenue,
		isOmuraVenue,
		isMarugameVenue,
		venueExtraPanelFlags,
		hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasTsuBeforeInfoData,
		hasTsuRacerCommentsData,
		hasTsuSeriesResultsData,
		hasTsuNationalRecent3Data,
		hasTsuLocalRecent3Data,
		hasTsuFramePast10Data,
		hasTsuScoreRateGuideData,
		hasWakamatsuEntryData,
		hasWakamatsuBeforeInfoData,
		hasWakamatsuSeriesResultsData,
		hasWakamatsuCourseStatsData,
		hasWakamatsuNationalRecent3Data,
		hasWakamatsuLocalRecent3Data,
		hasWakamatsuFramePast10Data,
		hasWakamatsuMotorHistoryData,
		hasFukuokaEntryData,
		hasFukuokaBeforeInfoData,
		hasFukuokaMotorEvaluationData,
		hasFukuokaSeriesResultsData,
		hasFukuokaRacerCommentsData,
		hasFukuokaFramePast10Data,
		hasKojimaBeforeInfoData,
		hasKojimaSeriesResultsData,
		hasKojimaRecentResultsData,
		hasKojimaCourseStatsData,
		hasKojimaMotorStatsData,
		hasKojimaFrameStatsData,
		hasKojimaScoreRateGuideData,
		hasTamagawaBeforeInfoData,
		hasTamagawaSeriesResultsData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasBiwakoFramePast10Data,
		hasBiwakoSeriesResultsData,
	],
);

const initialVenueExtraPanel = useMemo<VenueExtraPanelKey>(
	() => resolveInitialVenueExtraPanel({
		isKaratsuVenue,
		isOmuraVenue,
		isTamagawaVenue,
		isKojimaVenue,
		isFukuokaVenue,
		preferredVenueExtraPanel,
	}),
	[isKaratsuVenue, isOmuraVenue, isTamagawaVenue, isKojimaVenue, isFukuokaVenue, preferredVenueExtraPanel],
);

useEffect(() => {
	setSelectedVenueExtraPanel(initialVenueExtraPanel);
}, [selectedVenueId, initialVenueExtraPanel]);

useEffect(() => {
	setSelectedNarutoStatsTab("score");
}, [selectedVenueId]);

const venueExtraPanelOptions = useMemo(
	() => buildVenueExtraPanelOptions({
		isNarutoVenue,
		isKaratsuVenue,
		isBiwakoVenue,
		isTamagawaVenue,
		isTsuVenue,
		isWakamatsuVenue,
		isFukuokaVenue,
		isKojimaVenue,
		isOmuraVenue,
		isMarugameVenue,
		...venueExtraPanelFlags,
		hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasBiwakoFramePast10Data,
		hasBiwakoSeriesResultsData,
		hasTsuBeforeInfoData,
		hasTsuRacerCommentsData,
		hasTsuSeriesResultsData,
		hasTsuNationalRecent3Data,
		hasTsuLocalRecent3Data,
		hasTsuFramePast10Data,
		hasTsuScoreRateGuideData,
		hasWakamatsuEntryData,
		hasWakamatsuBeforeInfoData,
		hasWakamatsuSeriesResultsData,
		hasWakamatsuCourseStatsData,
		hasWakamatsuNationalRecent3Data,
		hasWakamatsuLocalRecent3Data,
		hasWakamatsuFramePast10Data,
		hasWakamatsuScoreRateGuideData,
		hasWakamatsuMotorHistoryData,
		hasFukuokaEntryData,
		hasFukuokaBeforeInfoData,
		hasFukuokaMotorEvaluationData,
		hasFukuokaSeriesResultsData,
		hasFukuokaRacerCommentsData,
		hasFukuokaFramePast10Data,
		hasFukuokaScoreRateGuideData,
		hasKojimaBeforeInfoData,
		hasKojimaSeriesResultsData,
		hasKojimaRecentResultsData,
		hasKojimaCourseStatsData,
		hasKojimaMotorStatsData,
		hasKojimaFrameStatsData,
		hasKojimaScoreRateGuideData,
		hasTamagawaMotorHistoryData,
		hasTamagawaSeriesResultsData,
		hasTamagawaBeforeInfoData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasTamagawaEntryData,
		officialScoreRowsCount: selectedOfficialBeforeInfo?.scoreQuickLook.length ?? 0,
		abilityIndexCount: selectedAbilityIndex.length,
	}),
	[
		isOmuraVenue,
		isTsuVenue,
		isWakamatsuVenue,
		isFukuokaVenue,
		isKojimaVenue,
		isTamagawaVenue,
		isBiwakoVenue,
	    hasBiwakoFramePast10Data,
		hasBiwakoSeriesResultsData,
	    hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasTsuBeforeInfoData,
		hasTsuRacerCommentsData,
		hasTsuSeriesResultsData,
		hasTsuNationalRecent3Data,
		hasTsuLocalRecent3Data,
		hasTsuFramePast10Data,
		hasTsuScoreRateGuideData,
		hasWakamatsuEntryData,
		hasWakamatsuBeforeInfoData,
		hasWakamatsuSeriesResultsData,
		hasWakamatsuCourseStatsData,
		hasWakamatsuNationalRecent3Data,
		hasWakamatsuLocalRecent3Data,
		hasWakamatsuFramePast10Data,
		hasWakamatsuScoreRateGuideData,
		hasWakamatsuMotorHistoryData,
		hasFukuokaEntryData,
		hasFukuokaBeforeInfoData,
		hasFukuokaMotorEvaluationData,
		hasFukuokaSeriesResultsData,
		hasFukuokaRacerCommentsData,
		hasFukuokaFramePast10Data,
		hasFukuokaScoreRateGuideData,
		hasKojimaBeforeInfoData,
		hasKojimaSeriesResultsData,
		hasKojimaRecentResultsData,
		hasKojimaCourseStatsData,
		hasKojimaMotorStatsData,
		hasKojimaFrameStatsData,
		hasKojimaScoreRateGuideData,
		venueExtraPanelFlags,
		hasTamagawaMotorHistoryData,
		selectedAbilityIndex.length,
		hasTamagawaSeriesResultsData,
		hasTamagawaBeforeInfoData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasTamagawaOddsResultData,
		hasTamagawaEntryData,
		selectedOfficialBeforeInfo?.scoreQuickLook.length,
	],
);

const validVenueExtraPanel = useMemo<VenueExtraPanelKey>(
	() => resolveValidVenueExtraPanel({
		selectedVenueExtraPanel,
		initialVenueExtraPanel,
		venueExtraPanelOptions,
	}),
	[selectedVenueExtraPanel, initialVenueExtraPanel, venueExtraPanelOptions],
);

useEffect(() => {
	if (selectedVenueExtraPanel !== validVenueExtraPanel) {
		setSelectedVenueExtraPanel(validVenueExtraPanel);
	}
}, [selectedVenueExtraPanel, validVenueExtraPanel]);

const getVenueExtraPanelSummary = (option: { key: VenueExtraPanelKey; badge: string }): string => {
	const isWaiting = option.badge === "待機中";
	const officialRows = selectedOfficialBeforeInfo?.exhibitionRows.length ?? 0;
	const officialScores = selectedOfficialBeforeInfo?.scoreQuickLook.length ?? 0;
	const startRows = Math.max(selectedOfficialBeforeInfo?.startExhibition.length ?? 0, selectedStartExhibition.length);
	const mikuniBeforeRows = selectedMikuniBeforeInfo.length;
	const mikuniScoreRows = selectedMikuniScoreRateGuide.length;
	const mikuniCourseRows = selectedMikuniCourseResults.length;
	const mikuniMotorRows = selectedMikuniMotorHistory.length;
	const scoreRows = Math.max(officialScores, selectedWakamatsuScoreRateGuide.length, selectedTsuScoreRateGuide.length, selectedFukuokaScoreRateGuide.length, selectedKojimaScoreRateGuide.length, mikuniScoreRows);
	const weather = selectedOfficialWeatherCondition;
	const wakamatsuRecordsLabels = [
		selectedWakamatsuScoreRateGuide.length > 0 ? `得点率 ${selectedWakamatsuScoreRateGuide.length}件` : "",
		selectedWakamatsuSeriesResults.length > 0 ? "節間成績あり" : "",
		selectedWakamatsuCourseStats.length > 0 ? "進入別あり" : "",
		(selectedWakamatsuNationalRecent3.length > 0 || selectedWakamatsuLocalRecent3.length > 0) ? "過去3節あり" : "",
		selectedWakamatsuFramePast10.length > 0 ? "10走あり" : "",
	].filter(Boolean);
	const tokuyamaRecordsLabels = [
		officialScores > 0 ? `得点率 ${officialScores}件` : "",
		selectedAbilityIndex.length > 0 ? "能力指数あり" : "",
		selectedTokuyamaFramePast10.length > 0 ? "枠番別10走あり" : "",
	].filter(Boolean);

	if (isWakamatsuVenue) {
		if (option.key === "official" || option.key === "wakamatsu-before") {
			return selectedWakamatsuBeforeInfo.length > 0 ? `展示 ${selectedWakamatsuBeforeInfo.length}艇` : "若松公式データ未取得";
		}

		if (option.key === "start") {
			return selectedStartExhibition.length > 0 ? `進入・ST ${selectedStartExhibition.length}艇` : "スタート展示待ち";
		}

		if (option.key === "records" || option.key === "wakamatsu-score") {
			return wakamatsuRecordsLabels.length > 0 ? wakamatsuRecordsLabels.slice(0, 3).join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			return selectedOriginalExhibitionRows.length > 0 ? `独自展示 ${selectedOriginalExhibitionRows.length}艇` : "展示公開待ち";
		}

		if (option.key === "motor" || option.key === "wakamatsu-motor") {
			const motorCount = Math.max(selectedMotorSummaryDisplay.items.length, selectedWakamatsuMotorHistory.length);
			return motorCount > 0 ? `モーター ${motorCount}件` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterLabels = [
				selectedWaterMemo?.tideInfo ? "潮汐" : "",
				selectedWaterMemo?.waterSurfaceInfo ? "水面" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.pressure ? `気圧 ${weather.pressure}` : "",
				weather?.humidity ? `湿度 ${weather.humidity}` : "",
				weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}

		if (option.key === "wakamatsu-series") {
			return selectedWakamatsuSeriesResults.length > 0 ? `節間成績 ${selectedWakamatsuSeriesResults.length}艇` : "成績データ待ち";
		}

		if (option.key === "wakamatsu-course") {
			return selectedWakamatsuCourseStats.length > 0 ? `進入コース別 ${selectedWakamatsuCourseStats.length}艇` : "進入別データ待ち";
		}

		if (option.key === "wakamatsu-national3") {
			return selectedWakamatsuNationalRecent3.length > 0 ? `全国過去3節 ${selectedWakamatsuNationalRecent3.length}艇` : "全国成績待ち";
		}

		if (option.key === "wakamatsu-local3") {
			return selectedWakamatsuLocalRecent3.length > 0 ? `当地過去3節 ${selectedWakamatsuLocalRecent3.length}艇` : "当地成績待ち";
		}

		if (option.key === "wakamatsu-frame10") {
			return selectedWakamatsuFramePast10.length > 0 ? `枠番別10走 ${selectedWakamatsuFramePast10.length}艇` : "10走データ待ち";
		}

		if (option.key === "wakamatsu-entry") {
			return selectedWakamatsuEntryRows.length > 0 ? `出走表 ${selectedWakamatsuEntryRows.length}艇` : "出走表待ち";
		}
	}

	if (isMikuniVenue) {
		if (option.key === "official") {
			return mikuniBeforeRows > 0 ? `直前情報 ${mikuniBeforeRows}艇 / 得点率 ${mikuniScoreRows}件` : "直前情報待ち";
		}

		if (option.key === "start") {
			return startRows > 0 ? `進入・ST ${startRows}艇` : "公式スタート展示は未掲載";
		}

		if (option.key === "records") {
			const recordsLabels = [
				mikuniScoreRows > 0 ? `得点率 ${mikuniScoreRows}件` : "",
				mikuniScoreRows > 0 ? "節間成績あり" : "",
				mikuniCourseRows > 0 ? "進入別あり" : "",
			].filter(Boolean);

			return recordsLabels.length > 0 ? recordsLabels.join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			if (selectedOriginalExhibitionRows.length > 0) {
				const labels = [
					`独自展示 ${selectedOriginalExhibitionRows.length}艇`,
					selectedOriginalExhibitionRows.some((row) => Boolean(row.oneLapTime)) ? "半周ラップあり" : "",
					selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime)) ? "まわり足あり" : "",
					selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime)) ? "直線あり" : "",
				].filter(Boolean);

				return labels.join(" / ");
			}

			return "独自展示ページ確認中";
		}

		if (option.key === "motor") {
			const motorCount = Math.max(selectedMotorSummaryDisplay.items.length, mikuniMotorRows);
			return motorCount > 0 ? `モーター ${motorCount}件 / 履歴あり` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterLabels = [
				selectedMikuniWaterSurfaceDisplay?.surfaceFeature ? "水面特性" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.pressure ? `気圧 ${weather.pressure}` : "",
				weather?.humidity ? `湿度 ${weather.humidity}` : "",
				weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (isTokuyamaVenue && option.key === "records") {
		return tokuyamaRecordsLabels.length > 0 ? tokuyamaRecordsLabels.join(" / ") : "成績データ待ち";
	}

	if (isTsuVenue) {
		if (option.key === "official" || option.key === "tsu-before") {
			const labels = [
				selectedTsuBeforeInfo.length > 0 ? `展示 ${selectedTsuBeforeInfo.length}艇` : "",
				selectedTsuBeforeInfo.some((row) => Boolean(row.weight)) ? "体重あり" : "",
				selectedTsuBeforeInfo.some((row) => Boolean(row.weightAdjustment)) ? "調整あり" : "",
				selectedTsuBeforeInfo.some((row) => Boolean(row.tilt)) ? "チルトあり" : "",
				selectedTsuBeforeInfo.some((row) => Boolean(row.partsExchange)) ? "部品交換あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "公式直前情報待ち";
		}

		if (option.key === "records" || option.key === "tsu-score") {
			const labels = [
				selectedTsuScoreRateGuide.length > 0 ? `得点率 ${selectedTsuScoreRateGuide.length}件` : "",
				selectedTsuScoreRateGuide.length > 0 ? "得点率早見あり" : "",
				selectedTsuSeriesResults.length > 0 ? "今節成績あり" : "",
				selectedTsuFramePast10.length > 0 ? "枠番別10走あり" : "",
				selectedTsuNationalRecent3.length > 0 ? "全国過去3節あり" : "",
				selectedTsuLocalRecent3.length > 0 ? "当地過去3節あり" : "",
				selectedTsuRacerComments.length > 0 ? "選手コメントあり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			const labels = [
				selectedOriginalExhibitionRows.length > 0 ? `展示 ${selectedOriginalExhibitionRows.length}艇` : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.exhibitionTime)) ? "展示タイムあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.oneLapTime)) ? "一周あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime)) ? "まわり足あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime)) ? "直線あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.tilt)) ? "チルトあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.motorNo)) ? "モーター番号あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "展示公開待ち";
		}

		if (option.key === "motor") {
			const labels = [
				selectedMotorSummaryDisplay.items.length > 0 ? `モーター ${selectedMotorSummaryDisplay.items.length}件` : "",
				hasTsuMotorHistoryData ? "モーター履歴あり" : "",
				selectedTsuMotorHistory.some((row) => Boolean(row.boatNo)) ? "ボートデータあり" : "",
				selectedTsuMotorHistory.some((row) => Boolean(row.boatHistoryEntries.length)) ? "ボート履歴あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterSurfaceInfo = selectedWaterMemo?.waterSurfaceInfo;
			const waterLabels = [
				waterSurfaceInfo ? "水面特性あり" : "",
				waterSurfaceInfo?.surfaceSummary?.includes("鈴鹿") ? "鈴鹿おろし" : "",
				waterSurfaceInfo?.surfaceSummary?.includes("夏") ? "春夏の追い風傾向" : "",
				waterSurfaceInfo?.surfaceSummary?.includes("荒れやすい") ? "荒れやすい水面" : "",
				waterSurfaceInfo?.courseSummary ? "コース別入着率あり" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.temperature || weather?.airTemperature ? `気温 ${weather.temperature || weather.airTemperature}` : "",
				weather?.waterTemperature ? `水温 ${weather.waterTemperature}` : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (isTokonameVenue) {
		if (option.key === "official") {
			return officialRows > 0 ? `展示 ${officialRows}艇 / 体重・チルト・部品交換` : "公式直前情報待ち";
		}

		if (option.key === "start") {
			return startRows > 0 ? `進入・ST ${startRows}艇` : "スタート展示待ち";
		}

		if (option.key === "records") {
			const tokonameSectionResults = (selectedRaceExtra as Record<string, unknown> | null)?.tokonameSectionResults;
			const tokonameCourseResults = (selectedRaceExtra as Record<string, unknown> | null)?.tokonameCourseResults;
			const labels = [
				officialScores > 0 ? `得点率 ${officialScores}件` : "",
				officialScores > 0 ? "得点率ランキングあり" : "",
				Array.isArray(tokonameSectionResults) && tokonameSectionResults.length > 0 ? "今節成績あり" : "",
				Array.isArray(tokonameCourseResults) && tokonameCourseResults.length > 0 ? "進入コース別成績あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			const labels = [
				selectedOriginalExhibitionRows.length > 0 ? `独自展示 ${selectedOriginalExhibitionRows.length}艇` : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.exhibitionTime)) ? "展示タイムあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.oneLapTime)) ? "一周あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime)) ? "まわり足あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime)) ? "直線あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.tilt)) ? "チルトあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.motorNo)) ? "モーター番号あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "展示公開待ち";
		}

		if (option.key === "motor") {
			return selectedMotorSummaryDisplay.items.length > 0 ? `モーター ${selectedMotorSummaryDisplay.items.length}件 / ボートデータあり` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterLabels = [
				selectedWaterMemo?.waterSurfaceInfo ? "水面特性あり" : "",
				selectedWaterMemo?.waterSurfaceInfo?.surfaceSummary ? selectedWaterMemo.waterSurfaceInfo.surfaceSummary : "",
				selectedWaterMemo?.waterSurfaceInfo?.courseSummary ? selectedWaterMemo.waterSurfaceInfo.courseSummary : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.pressure ? `気圧 ${weather.pressure}` : "",
				weather?.humidity ? `湿度 ${weather.humidity}` : "",
				weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (isAshiyaVenue) {
		if (option.key === "official") {
			return officialRows > 0 ? `展示 ${officialRows}艇 / 展示タイム・チルト・部品交換` : "公式直前情報待ち";
		}

		if (option.key === "start") {
			return startRows > 0 ? `進入・ST ${startRows}艇` : "スタート展示待ち";
		}

		if (option.key === "records") {
			const ashiyaSectionResults = (selectedRaceExtra as Record<string, unknown> | null)?.ashiyaSectionResults;
			const ashiyaCourseResults = (selectedRaceExtra as Record<string, unknown> | null)?.ashiyaCourseResults;
			const ashiyaFrameLast10 = (selectedRaceExtra as Record<string, unknown> | null)?.ashiyaFrameLast10;
			const labels = [
				officialScores > 0 ? `得点率 ${officialScores}件` : "",
				officialScores > 0 ? "得点率ランキングあり" : "",
				Array.isArray(ashiyaSectionResults) && ashiyaSectionResults.length > 0 ? "節間成績あり" : "",
				Array.isArray(ashiyaFrameLast10) && ashiyaFrameLast10.length > 0 ? "枠番別10走あり" : "",
				Array.isArray(ashiyaCourseResults) && ashiyaCourseResults.length > 0 ? "進入コース別選手成績あり" : "",
				selectedRacerComments.length > 0 ? "選手コメントあり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			const labels = [
				selectedOriginalExhibitionRows.length > 0 ? `独自展示 ${selectedOriginalExhibitionRows.length}艇` : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.oneLapTime)) ? "一周あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime)) ? "まわり足あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime)) ? "直線あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.exhibitionTime)) ? "展示タイムあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.tilt)) ? "チルトあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.motorNo)) ? "モーター番号あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "展示公開待ち";
		}

		if (option.key === "motor") {
			return selectedMotorSummaryDisplay.items.length > 0 ? `モーター ${selectedMotorSummaryDisplay.items.length}件 / ボートデータあり / 前検タイムあり` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterLabels = [
				selectedWaterMemo?.waterSurfaceInfo ? "水面特性あり" : "",
				selectedWaterMemo?.waterSurfaceInfo?.courseSummary ? "進入コース別情報あり" : "",
				selectedWaterMemo?.waterSurfaceInfo?.surfaceSummary ? selectedWaterMemo.waterSurfaceInfo.surfaceSummary : "",
				selectedRacerComments.length > 0 ? "選手コメントあり" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.temperature || weather?.airTemperature ? `気温 ${weather.temperature || weather.airTemperature}` : "",
				weather?.waterTemperature ? `水温 ${weather.waterTemperature}` : "",
				weather?.pressure ? `気圧 ${weather.pressure}` : "",
				weather?.humidity ? `湿度 ${weather.humidity}` : "",
				weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (isKiryuVenue) {
		if (option.key === "official") {
			return officialRows > 0 ? `展示 ${officialRows}艇 / 展示タイム・体重・チルト` : "公式直前情報待ち";
		}

		if (option.key === "start") {
			return startRows > 0 ? `進入・ST ${startRows}艇` : "スタート展示待ち";
		}

		if (option.key === "records") {
			const kiryuSectionResults = (selectedRaceExtra as Record<string, unknown> | null)?.kiryuSectionResults;
			const labels = [
				officialScores > 0 ? `得点率 ${officialScores}件` : "",
				officialScores > 0 ? "得点率早見あり" : "",
				Array.isArray(kiryuSectionResults) && kiryuSectionResults.length > 0 ? "節間成績あり" : "",
				hasKiryuFrameLast10Data ? "枠番別10走あり" : "",
				hasKiryuCourseResultsData ? "進入コース別成績あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			const labels = [
				selectedOriginalExhibitionRows.length > 0 ? `展示 ${selectedOriginalExhibitionRows.length}艇` : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.exhibitionTime)) ? "展示タイムあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.tilt)) ? "チルトあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.motorNo)) ? "モーター番号あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime)) ? "まわり足あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime)) ? "直線あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "展示公開待ち";
		}

		if (option.key === "motor") {
			return selectedMotorSummaryDisplay.items.length > 0 ? `モーター ${selectedMotorSummaryDisplay.items.length}件 / ボートデータあり / 前検タイムあり / 使用履歴あり` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterSurfaceInfo = selectedWaterMemo?.waterSurfaceInfo;
			const waterLabels = [
				waterSurfaceInfo ? "水面特性あり" : "",
				waterSurfaceInfo?.surfaceSummary?.includes("淡水") ? "淡水" : "",
				waterSurfaceInfo?.surfaceSummary?.includes("なし") ? "水位変化なし" : "",
				waterSurfaceInfo?.featureSummary?.includes("赤城おろし") ? "赤城おろし/夏場まくり傾向あり" : "",
				waterSurfaceInfo?.featureSummary?.includes("ナイター") ? "ナイター/標高特性あり" : "",
				waterSurfaceInfo?.courseSummary ? "コース別入着率あり" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.temperature || weather?.airTemperature ? `気温 ${weather.temperature || weather.airTemperature}` : "",
				weather?.waterTemperature ? `水温 ${weather.waterTemperature}` : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (isMiyajimaVenue) {
		if (option.key === "official") {
			return officialRows > 0 ? `展示 ${officialRows}艇 / 展示タイム・チルト・部品交換` : "公式直前情報待ち";
		}

		if (option.key === "start") {
			return startRows > 0 ? `進入・ST ${startRows}艇` : "スタート展示待ち";
		}

		if (option.key === "records") {
			const raceExtraRecord = selectedRaceExtra as Record<string, unknown> | null;
			const labels = [
				officialScores > 0 ? `得点率 ${officialScores}件` : "",
				Array.isArray(raceExtraRecord?.miyajimaSectionResults) && raceExtraRecord.miyajimaSectionResults.length > 0 ? "今節成績あり" : "",
				Array.isArray(raceExtraRecord?.miyajimaFrameLast10) && raceExtraRecord.miyajimaFrameLast10.length > 0 ? "枠番別10走あり" : "",
				Array.isArray(raceExtraRecord?.miyajimaNationalRecent3) && raceExtraRecord.miyajimaNationalRecent3.length > 0 ? "全国過去3節あり" : "",
				Array.isArray(raceExtraRecord?.miyajimaLocalRecent3) && raceExtraRecord.miyajimaLocalRecent3.length > 0 ? "当地過去3節あり" : "",
				Array.isArray(raceExtraRecord?.miyajimaCourseResults) && raceExtraRecord.miyajimaCourseResults.length > 0 ? "進入コース別あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			const labels = [
				selectedOriginalExhibitionRows.length > 0 ? `展示 ${selectedOriginalExhibitionRows.length}艇` : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.exhibitionTime)) ? "展示タイムあり" : "",
				hasOriginalOneLapTimeData ? "周回タイムあり" : "",
				hasOriginalTurnTimeData ? "まわり足あり" : "",
				hasOriginalStraightTimeData ? "直線あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.tilt)) ? "チルトあり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.motorNo)) ? "モーター番号あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "展示公開待ち";
		}

		if (option.key === "motor") {
			return selectedMotorSummaryDisplay.items.length > 0 ? `モーター ${selectedMotorSummaryDisplay.items.length}件 / ボートデータあり / 前検タイムあり` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterLabels = [
				selectedWaterMemo?.waterSurfaceInfo ? "水面特性あり" : "",
				selectedWaterMemo?.waterSurfaceInfo?.courseSummary ? "進入コース別情報あり" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.temperature || weather?.airTemperature ? `気温 ${weather.temperature || weather.airTemperature}` : "",
				weather?.waterTemperature ? `水温 ${weather.waterTemperature}` : "",
				weather?.pressure ? `気圧 ${weather.pressure}` : "",
				weather?.humidity ? `湿度 ${weather.humidity}` : "",
				weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (isMarugameVenue) {
		if (option.key === "official") {
			return officialRows > 0 ? `展示 ${officialRows}艇 / 得点率 ${officialScores}件` : "公式直前情報待ち";
		}

		if (option.key === "start") {
			return startRows > 0 ? `進入・ST ${startRows}艇` : "スタート展示待ち";
		}

		if (option.key === "records") {
			return officialScores > 0 ? `得点率 ${officialScores}件 / 節間成績あり` : "成績データ待ち";
		}

		if (option.key === "exhibition") {
			const labels = [
				selectedOriginalExhibitionRows.length > 0 ? `独自展示 ${selectedOriginalExhibitionRows.length}艇` : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.oneLapTime)) ? "一周あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.turnTime)) ? "まわり足あり" : "",
				selectedOriginalExhibitionRows.some((row) => Boolean(row.straightTime)) ? "直線あり" : "",
			].filter(Boolean);
			return labels.length > 0 ? labels.join(" / ") : "独自展示待ち";
		}

		if (option.key === "motor") {
			return selectedMotorSummaryDisplay.items.length > 0 ? `モーター ${selectedMotorSummaryDisplay.items.length}件 / ボートデータあり` : "モーター情報待ち";
		}

		if (option.key === "water") {
			const waterLabels = [
				selectedWaterMemo?.waterSurfaceInfo ? "水面特性あり" : "",
				selectedWaterMemo?.tideInfo ? "潮見表あり" : "",
				weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
				weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
				weather?.pressure ? `気圧 ${weather.pressure}` : "",
				weather?.humidity ? `湿度 ${weather.humidity}` : "",
				weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
				weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
			].filter(Boolean);
			return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
		}
	}

	if (option.key === "official" || option.key.endsWith("-before") || option.key === "tamagawa-cyokuzen") {
		return officialRows > 0 ? `展示 ${officialRows}艇 / 成績 ${officialScores}件` : "公式データ待ち";
	}

	if (option.key === "start") {
		return startRows > 0 ? `進入・ST ${startRows}艇` : "スタート展示待ち";
	}

	if (option.key === "records" || option.key.endsWith("-score")) {
		return scoreRows > 0 ? `勝率・得点率 ${scoreRows}件` : "成績データ待ち";
	}

	if (option.key === "exhibition") {
		return selectedOriginalExhibitionRows.length > 0 ? `一周・回り足 ${selectedOriginalExhibitionRows.length}艇` : "展示公開待ち";
	}

	if (option.key === "motor" || option.key.endsWith("-motor")) {
		const motorCount = Math.max(selectedMotorSummaryDisplay.items.length, selectedWakamatsuMotorHistory.length, selectedKojimaMotorStats.length, selectedTamagawaMotorHistory.length);
		return motorCount > 0 ? `モーター ${motorCount}件` : "モーター情報待ち";
	}

	if (option.key === "water") {
		const waterLabels = [
			selectedWaterMemo?.tideInfo ? "潮汐" : "",
			selectedWaterMemo?.waterSurfaceInfo ? "水面" : "",
			weather?.windSpeed ? `風 ${weather.windSpeed}` : "",
			weather?.waveHeight ? `波 ${weather.waveHeight}` : "",
			weather?.pressure ? `気圧 ${weather.pressure}` : "",
			weather?.humidity ? `湿度 ${weather.humidity}` : "",
			weather?.rainfall ? `雨量 ${weather.rainfall}` : "",
			weather?.observedAt || weather?.updatedAt ? (weather.observedAt || weather.updatedAt) : "",
		].filter(Boolean);
		return waterLabels.length > 0 ? waterLabels.join(" / ") : "水面情報確認中";
	}

	if (isWaiting) {
		return "この会場の独自データは準備中";
	}

	return "会場公式データを表示中";
};

const narutoStatsTabOptions = useMemo(
	() => [
		{ key: "score", label: "公式スコア", hint: "全国成績とモーター2連率を確認" },
		{ key: "frameHistory", label: "枠番別10走", hint: "枠番別の直近10走を確認" },
		{ key: "narutoRecent", label: "鳴門近況", hint: "鳴門での直近成績を確認" },
		{ key: "nationalRecent", label: "全国近況", hint: "全国での直近成績を確認" },
	] as Array<{ key: NarutoStatsTab; label: string; hint: string }>,
	[],
);

const venueExtrasDisplayText = useMemo(() => {
	if (!venueExtrasFeed) {
		return "会場独自データを読み込み中です。";
	}

	if ((venueExtrasFeed.venues?.length ?? 0) === 0) {
		return "会場独自データはまだ取得されていません。";
	}

	if (!selectedVenueExtra) {
		return "この会場の独自データはまだ準備されていません。";
	}

	if (!selectedRaceExtra) {
		return "選択中レースの独自データはまだありません。";
	}

	if (hasOfficialBeforeInfoDetail && hasSelectedVenueExtrasDetail) {
		return "BOATRACE公式の直前情報と会場独自データを表示しています。";
	}

	if (hasOfficialBeforeInfoDetail) {
		return "BOATRACE公式の直前情報を表示しています。";
	}

	if (hasSelectedVenueExtrasDetail) {
		return "会場独自データを表示しています。";
	}

	return "選択中レースの表示データは準備中です。";
}, [venueExtrasFeed, selectedVenueExtra, selectedRaceExtra, hasOfficialBeforeInfoDetail, hasSelectedVenueExtrasDetail]);

	const dataDateWarnings = useMemo(() => {
		const warnings: string[] = [];
		const todayDate = todayFeed.date?.trim() || "";
		const venueDate = venueExtrasFeed?.date?.trim() || "";
		const jstToday = getJstTodayDate();

		if (todayDate && venueDate && todayDate !== venueDate) {
			warnings.push(`データ日付が一致していません。基本情報: ${todayDate} / 会場独自: ${venueDate}`);
		}

		if (todayDate && todayDate !== jstToday) {
			warnings.push(`today.generated.json の date は ${todayDate} です。`);
		}

		if (venueDate && venueDate !== jstToday) {
			warnings.push(`venue-extras.generated.json の date は ${venueDate} です。`);
		}

		return warnings;
	}, [todayFeed.date, venueExtrasFeed?.date]);

	return (
		<PageShell
  hideHero
  eyebrow=""
  title=""
  description=""
  contentMaxWidth="1680px"
  contentPaddingInline="24px"
  heroMaxWidth="1680px"
>
			<style>
				{`
body:has(.races-page-root) {
	background: #eefbff;
}

#root:has(.races-page-root) {
	position: relative;
	min-height: 100vh;
	background: #eefbff;
}

#root:has(.races-page-root)::before {
	content: "";
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background-color: #eefbff;
	background-image:
		linear-gradient(180deg, rgba(248, 253, 255, 0.24) 0%, rgba(238, 250, 253, 0.18) 46%, rgba(226, 248, 250, 0.28) 100%),
		url("${racePageBackgroundImageSrc}");
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}

#root:has(.races-page-root) > div {
	position: relative;
	z-index: 1;
	background: transparent !important;
}

#root:has(.races-page-root) main,
.races-page-root {
	position: relative;
	z-index: 1;
}

#root:has(.races-page-root) main > section {
	background: transparent !important;
}

.races-page-root > * {
	position: relative;
	z-index: 1;
}
				`}
			</style>
			<div className="races-page-root" style={pageContentStyle}>
<section style={heroShellStyle}>
  <div style={heroInnerStyle}>
    <div style={heroImageAreaStyle}>
      <img
        src={raceHeroImageSrc}
		alt="ボートレース会場を象徴するキービジュアル"
        style={heroImageStyle}
      />
    </div>

    <div style={heroTextAreaStyle}>
      <span style={heroEyebrowStyle}>Today Races</span>
      <h2 style={heroTitleStyle}>今日のレース</h2>
      <p style={heroDescriptionStyle}>
		会場とレースを選ぶと、展示オッズや直前情報まで一画面で比較しながら確認できます。
      </p>
    </div>
  </div>
</section>

{dataDateWarnings.length ? (
	<div
		style={{
			display: "grid",
			gap: "8px",
			padding: "12px 14px",
			borderRadius: "16px",
			background: "rgba(255, 244, 224, 0.92)",
			border: "1px solid rgba(209, 146, 61, 0.24)",
			color: "#8a5a12",
			fontSize: "0.8rem",
			fontWeight: 700,
			lineHeight: 1.6,
		}}
	>
		{dataDateWarnings.map((warning) => (
			<p key={warning} style={{ margin: 0 }}>
				{warning}
			</p>
		))}
	</div>
) : null}

<div style={venueActionRowStyle}>
	<div style={venueActionGroupStyle}>
		{dataUpdatedAt ? (
			<p style={{ ...updatedChipStyle, margin: 0 }}>
				基本データ更新：{formatJstDateTimeLabel(dataUpdatedAt)}
			</p>
		) : null}

		{venueExtrasStatusText ? (
			<p style={{ ...updatedChipStyle, margin: 0 }}>
				{venueExtrasStatusText}
			</p>
		) : null}
	</div>
</div>

				<div style={openSectionStyle}>
					<BoatVenueSelectorPanel
						venues={venueSelectorVenues}
						selectedVenueId={selectedVenueId}
						onSelectVenue={handleSelectVenue}
					/>

					<BoatVenueSpotlight
						venue={selectedVenue}
						summaryText={spotlightContent.summary}
						imageSrc={spotlightContent.imageSrc}
						imageAlt={spotlightContent.imageAlt}
					/>

					<BoatRaceQuickSelector
						venueId={selectedVenue?.id ?? ""}
						races={selectedVenue?.races ?? []}
						selectedRaceId={selectedRaceId}
						onSelectRace={(raceId) => {
							if (!selectedVenue) {
								return;
							}

							handleSelectRace(selectedVenue.id, raceId);
						}}
					/>
				</div>
				<div style={openSectionStyle}>
					<BoatRaceDetailPanel
						venueName={selectedVenue?.venueName ?? "-"}
						venueWeatherActual={selectedOfficialWeatherCondition}
						race={selectedRaceForDetail}
						venueRaceExtra={selectedRaceExtra}
						entryNote={selectedRaceEntryNote}
						
						afterEntryContent={
							<section style={venueExtrasSectionStyle}>
		<div style={venueExtrasHeaderStyle}>
			<div style={venueExtrasTitleWrapStyle}>
				<p style={venueExtrasLabelStyle}>Venue Official Extras</p>
				<h3 style={venueExtrasTitleStyle}>BOATRACE公式直前データ / 会場独自データ</h3>
				<p style={venueExtrasTextStyle}>
					BOATRACE公式の直前情報と、体重・気配・一周など会場公式HPの独自データを横断して確認できます。
				</p>
			</div>

			<div style={venueExtrasHeaderMetaStyle}>
				<span style={selectedVenueOfficialLinkStatusMeta.chipStyle}>{selectedVenueOfficialLinkStatusMeta.label}</span>
				<span style={venueExtrasBadgeStyle}>{selectedVenue?.venueName ?? "会場未選択"}</span>
				<span style={venueExtrasBadgeStyle}>{selectedRace?.raceNo ? `${selectedRace.raceNo}R` : "R未選択"}</span>
				<span style={venueExtrasBadgeStyle}>{venueExtrasFeed?.venues?.length ?? 0}会場取得</span>
			</div>
		</div>

		<div style={venueExtrasStatusGridStyle}>
			<article style={venueExtrasStatusCardStyle}>
				<p style={venueExtrasStatusLabelStyle}>対象会場</p>
				<p style={venueExtrasStatusValueStyle}>{selectedVenue?.venueName ?? "-"}</p>
			</article>

			<article style={venueExtrasStatusCardStyle}>
				<p style={venueExtrasStatusLabelStyle}>対象レース</p>
				<p style={venueExtrasStatusValueStyle}>{selectedRace?.raceNo ? `${selectedRace.raceNo}R` : "-"}</p>
			</article>

			<article style={venueExtrasStatusCardStyle}>
				<p style={venueExtrasStatusLabelStyle}>取得会場数</p>
				<p style={venueExtrasStatusValueStyle}>{venueExtrasFeed?.venues?.length ?? 0} 会場</p>
			</article>

			<article style={venueExtrasStatusCardStyle}>
				<p style={venueExtrasStatusLabelStyle}>会場公式データ連携ステータス</p>
				<p style={venueOfficialLinkStatusValueStyle}>
					<span style={selectedVenueOfficialLinkStatusMeta.chipStyle}>{selectedVenueOfficialLinkStatusMeta.label}</span>
				</p>
				<p style={venueOfficialLinkStatusDescriptionStyle}>{selectedVenueOfficialLinkStatusMeta.description}</p>
			</article>
		</div>

		<div style={venueExtrasPanelSelectorWrapStyle}>
			<div style={venueExtrasPanelSelectorScrollStyle}>
				<div style={venueExtrasPanelSelectorGridStyle}>
					{venueExtraPanelOptions.map((option) => {
						const isActive = selectedVenueExtraPanel === option.key;
						const isWaiting = option.badge === "待機中";
						const panelSummary = getVenueExtraPanelSummary(option);

						return (
							<button
								key={`venue-extra-panel-${option.key}`}
								type="button"
								onClick={() => setSelectedVenueExtraPanel(option.key)}
								style={{
									...venueExtrasPanelButtonBaseStyle,
									background: isActive
										? "linear-gradient(180deg, rgba(17, 64, 92, 0.98), rgba(28, 98, 140, 0.96))"
										: venueExtrasPanelButtonBaseStyle.background,
									border: isActive
										? "1px solid rgba(44, 145, 201, 0.38)"
										: venueExtrasPanelButtonBaseStyle.border,
									boxShadow: isActive
										? "0 14px 28px rgba(17, 64, 92, 0.16)"
										: venueExtrasPanelButtonBaseStyle.boxShadow,
									transform: isActive ? "translateY(-1px)" : "none",
								}}
							>
								<div style={venueExtrasPanelButtonTopStyle}>
									<span
										style={{
											...venueExtrasPanelButtonBadgeStyle,
											background: isActive
												? "rgba(255, 255, 255, 0.14)"
												: isWaiting
													? "rgba(244, 248, 252, 0.92)"
													: venueExtrasPanelButtonBadgeStyle.background,
											color: isActive
												? "#f4fbff"
												: isWaiting
													? boatTheme.colors.muted
													: venueExtrasPanelButtonBadgeStyle.color,
											border: isActive ? "1px solid rgba(255, 255, 255, 0.18)" : venueExtrasPanelButtonBadgeStyle.border,
										}}
									>
										{isWaiting ? "準備中" : option.badge}
									</span>
									<span
										style={{
											...venueExtrasPanelStatusDotStyle,
											background: isWaiting ? "#b8c7d3" : venueExtrasPanelStatusDotStyle.background,
											boxShadow: isWaiting ? "0 0 0 4px rgba(184, 199, 211, 0.14)" : venueExtrasPanelStatusDotStyle.boxShadow,
										}}
									/>
								</div>
								<p
									style={{
										...venueExtrasPanelButtonTitleStyle,
										color: isActive ? "#f7fbff" : venueExtrasPanelButtonTitleStyle.color,
									}}
								>
									{option.label}
								</p>
								<p
									style={{
										...venueExtrasPanelButtonHintStyle,
										color: isActive ? "rgba(238, 248, 255, 0.82)" : venueExtrasPanelButtonHintStyle.color,
									}}
								>
									{option.hint}
								</p>
								<p
									style={{
										...venueExtrasPanelButtonSummaryStyle,
										background: isActive ? "rgba(255, 255, 255, 0.13)" : venueExtrasPanelButtonSummaryStyle.background,
										border: isActive ? "1px solid rgba(255, 255, 255, 0.14)" : venueExtrasPanelButtonSummaryStyle.border,
										color: isActive ? "rgba(245, 252, 255, 0.9)" : venueExtrasPanelButtonSummaryStyle.color,
									}}
								>
									{panelSummary}
								</p>
							</button>
						);
					})}
				</div>
			</div>
			<p style={venueExtrasCategoryCaptionStyle}>選択中のカテゴリだけを表示します。スマホでは横にスクロールして切り替えてください。</p>
		</div>

		{isOmuraVenue && selectedVenueExtraPanel === "omura-overview" ? (
			<div style={venueExtrasDataGridStyle}>
				<section style={venueExtrasPanelStyle}>
					<h4 style={venueExtrasPanelTitleStyle}>大村公式タブの全体像</h4>
					<div style={venueExtrasStatusGridStyle}>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>前日成績</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraPreviousDayData ? "あり" : "なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>全国枠番別成績</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraNationalFrameStatsData ? "あり" : "なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>枠番別直近10走</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraFrameLast10Data ? "あり" : "なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>コメント / モーター</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraCommentsMotorData ? "あり" : "なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>展示情報</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraExhibitionData ? "あり" : "なし"}</p>
						</article>
					</div>
					<p style={venueExtrasEmptyStyle}>大村は出走表、前日成績、全国枠番、10走、コメント、モーター、展示情報を race 単位で表示します。</p>
				</section>

				{hasOmuraEntryData ? (
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>出走表サマリー</h4>
						<p style={venueExtrasEmptyStyle}>前日時点の出走表と、F/L、事故率、評価を一覧表示しています。</p>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1020px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別 / 登録番号</th>
										<th style={venueExtrasHeadCellStyle}>F / L</th>
										<th style={venueExtrasHeadCellStyle}>平均ST / 事故率</th>
										<th style={venueExtrasHeadCellStyle}>評価</th>
										<th style={venueExtrasHeadCellStyle}>モーター / ボート</th>
									</tr>
								</thead>
								<tbody>
									{selectedOmuraEntryTable.map((item) => (
										<tr key={`omura-overview-entry-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"} / {item.registerNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.f || "-"} / {item.l || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"} / {item.accidentRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>出 {item.dashEvaluation || "-"} / 伸 {item.stretchEvaluation || "-"} / 回 {item.turnEvaluation || "-"} / M {item.motorEvaluation || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.boatNo || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				) : null}
			</div>
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-prevday" ? (
			hasOmuraPreviousDayData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>前日成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>前日1走目</th>
										<th style={venueExtrasHeadCellStyle}>前日2走目</th>
									</tr>
								</thead>
								<tbody>
									{omuraPreviousDayResultsDisplay.map((item) => (
										<tr key={`omura-prevday-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											{Array.from({ length: 2 }, (_, index) => {
												const race = item.items[index];
												return (
													<td key={`omura-prevday-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{race ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "92px" }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>{race.date || item.date || "-"}</span>
																<span>R {race.raceNo || "-"} / 進入 {race.course || "-"}</span>
																<span>ST {race.startTiming || "-"}</span>
																<strong>{race.finishOrder || "-"}</strong>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>大村公式の前日成績は未取得待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-national" ? (
			hasOmuraNationalFrameStatsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>全国枠番別成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>1着率</th>
										<th style={venueExtrasHeadCellStyle}>2着率</th>
										<th style={venueExtrasHeadCellStyle}>3着率</th>
										<th style={venueExtrasHeadCellStyle}>その他</th>
										<th style={venueExtrasHeadCellStyle}>3連率</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>ST順位</th>
									</tr>
								</thead>
								<tbody>
									{omuraNationalFrameStatsDisplay.map((item) => (
										<tr key={`omura-national-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName}</td>
											<td style={venueExtrasBodyCellStyle}>{item.firstRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.thirdRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.otherRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameTrifectaRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameAverageStartRank || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>大村公式の全国枠番別成績は未取得待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-last10" ? (
			hasOmuraFrameLast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>枠番別10走データ</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 10 }, (_, index) => (
											<th key={`omura-last10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
										))}
										<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
										<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
									</tr>
								</thead>
								<tbody>
									{omuraFrameLast10Display.map((item) => (
										<tr key={`omura-last10-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName}</td>
											{Array.from({ length: 10 }, (_, index) => (
												<td key={`omura-last10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
													<div style={narutoHistoryStackStyle}>
														<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
														<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
														<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span>
													</div>
												</td>
											))}
											<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>大村公式の枠番別10走データは未取得待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-comments" ? (
			hasOmuraCommentsMotorData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>選手コメント / モーター評価</h4>
						<div style={venueExtrasCommentListStyle}>
							{omuraCommentsMotorDisplay.map((item) => (
								<article key={`omura-comment-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
									<div style={venueExtrasRacerCommentHeaderStyle}>
										<p style={venueExtrasRacerCommentFrameStyle}>{item.frameNo}号艇/ {item.playerName}</p>
										<span style={venueExtrasFocusPillStyle}>M {item.motorEvaluation || "-"} / {item.motorNo || "-"}号機</span>
									</div>
									<p style={venueExtrasRacerCommentTextStyle}>{item.comment || "-"}</p>
								</article>
							))}
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>大村公式の選手コメント/ モーター評価は未取得待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-exhibition" ? (
			hasOmuraExhibitionData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>展示情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1180px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>進入</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>ST</th>
										<th style={venueExtrasHeadCellStyle}>展示T</th>
										<th style={venueExtrasHeadCellStyle}>一周</th>
										<th style={venueExtrasHeadCellStyle}>回り足</th>
										<th style={venueExtrasHeadCellStyle}>直線</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
										<th style={venueExtrasHeadCellStyle}>スタート種別</th>
										<th style={venueExtrasHeadCellStyle}>評価</th>
									</tr>
								</thead>
								<tbody>
									{omuraExhibitionInfoDisplay.map((item) => (
										<tr key={`omura-exhibition-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.course || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.startTiming || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.oneLapTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.turnTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.straightTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.startType || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.evaluation || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>展示情報はまだ取得できていません。公開後に表示される可能性があります。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-overview" ? (
			<div style={venueExtrasDataGridStyle}>
				<section style={venueExtrasPanelStyle}>
					<h4 style={venueExtrasPanelTitleStyle}>多摩川データ全体像</h4>
					<div style={venueExtrasStatusGridStyle}>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>直前情報</p>
							<p style={venueExtrasStatusValueStyle}>{hasTamagawaBeforeInfoData ? `${selectedTamagawaBeforeInfo.length}件` : "-"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>スタート展示</p>
							<p style={venueExtrasStatusValueStyle}>{tamagawaStartExhibitionDisplay.length ? `${tamagawaStartExhibitionDisplay.length}件` : "-"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>オリジナル展示</p>
							<p style={venueExtrasStatusValueStyle}>{hasOriginalExhibitionData ? `${selectedOriginalExhibitionRows.length}件` : "-"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>モーター履歴</p>
							<p style={venueExtrasStatusValueStyle}>{hasTamagawaMotorHistoryData ? `${selectedTamagawaMotorHistory.length}件` : "-"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>節間 / 枠番別10走</p>
							<p style={venueExtrasStatusValueStyle}>{hasTamagawaSeriesResultsData || hasTamagawaFramePast10Data ? "表示中" : "-"}</p>
						</article>
					</div>
					<p style={venueExtrasEmptyStyle}>多摩川の直前情報、スタート展示、オリジナル展示を横断して確認できます。</p>
				</section>

				{hasTamagawaBeforeInfoData ? (
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>直前情報サマリー</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>体重 / 調整</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
									</tr>
								</thead>
								<tbody>
									{selectedTamagawaBeforeInfo.map((item) => (
										<tr key={`tamagawa-overview-cyokuzen-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName}</td>
											<td style={venueExtrasBodyCellStyle}>{item.weight || "-"} / {item.weightAdjustment || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.previousRaceInfo || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				) : null}

				{shouldShowTamagawaEntryFallback ? null : null}
			</div>
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-diagnosis" ? (
			selectedAbilityIndex.length > 0 ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>診断指数</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>能力値</th>
										<th style={venueExtrasHeadCellStyle}>枠番適性</th>
										<th style={venueExtrasHeadCellStyle}>スタート力</th>
									</tr>
								</thead>
								<tbody>
									{selectedAbilityIndex.map((item) => (
										<tr key={`tamagawa-diagnosis-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.abilityValue || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameCompatibility || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.startPower || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>多摩川公式の診断指数は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-before" ? (
			hasKojimaBeforeInfoData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>直前情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1340px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>展示T</th>
										<th style={venueExtrasHeadCellStyle}>体重</th>
										<th style={venueExtrasHeadCellStyle}>調整</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
										<th style={venueExtrasHeadCellStyle}>部品交換</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
									</tr>
								</thead>
								<tbody>
									{selectedKojimaBeforeInfo.map((item) => (
										<tr key={`kojima-before-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName || `枠${item.frameNo}`}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.weight || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.adjustment || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.previousRaceInfo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.motorSecondRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式の直前情報は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-series" ? (
			hasKojimaSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>今節成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1380px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 12 }, (_, index) => {
											const dayLabel = selectedKojimaSeriesResults.find((row) => row.dayLabels[index])?.dayLabels[index];
											return <th key={`kojima-series-head-${index}`} style={venueExtrasHeadCellStyle}>{dayLabel || `${index + 1}走`}</th>;
										})}
									</tr>
								</thead>
								<tbody>
									{selectedKojimaSeriesResults.map((item) => (
										<tr key={`kojima-series-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}><div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}><strong>{item.playerName || `枠${item.frameNo}`}</strong><span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span></div></td>
											{Array.from({ length: 12 }, (_, index) => {
												const raceNo = item.raceNumbers[index] || "";
												const course = item.courses[index] || "";
												const startTiming = item.startTimings[index] || "";
												const finishOrder = item.finishOrders[index] || "";
												const hasCellData = Boolean(raceNo || course || startTiming || finishOrder);
												return <td key={`kojima-series-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>{hasCellData ? <div style={{ display: "grid", gap: "3px", minWidth: "58px", lineHeight: 1.35 }}><span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>R {raceNo || "-"}</span><span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入 {course || "-"}</span><span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {startTiming || "-"}</span><strong>{finishOrder || "-"}</strong></div> : "-"}</td>;
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式の今節成績は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-recent" ? (
			hasKojimaRecentResultsData ? (
				<div style={venueExtrasDataGridStyle}><section style={venueExtrasPanelStyle}><h4 style={venueExtrasPanelTitleStyle}>最近成績</h4><div style={venueExtrasTableWrapStyle}><table style={{ ...venueExtrasTableStyle, minWidth: "1080px" }}><thead><tr><th style={venueExtrasHeadCellStyle}>枠</th><th style={venueExtrasHeadCellStyle}>選手</th><th style={venueExtrasHeadCellStyle}>1節前</th><th style={venueExtrasHeadCellStyle}>2節前</th><th style={venueExtrasHeadCellStyle}>3節前</th><th style={venueExtrasHeadCellStyle}>4節前</th><th style={venueExtrasHeadCellStyle}>5節前</th></tr></thead><tbody>{selectedKojimaRecentResults.map((item) => (<tr key={`kojima-recent-${item.frameNo}`}><td style={venueExtrasBodyCellStyle}>{item.frameNo}</td><td style={venueExtrasBodyCellStyle}><div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}><strong>{item.playerName || `枠${item.frameNo}`}</strong><span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span></div></td>{Array.from({ length: 5 }, (_, index) => { const history = item.histories[index]; return <td key={`kojima-recent-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>{history ? <div style={{ ...narutoMeetCellStyle, alignItems: "flex-start" }}><span style={narutoMeetLabelStyle}>{history.venueName || "-"}</span><span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.grade || "-"}</span><span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"}</span><span style={narutoMeetResultStyle}>{history.results || "-"}</span></div> : "-"}</td>; })}</tr>))}</tbody></table></div></section></div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式の最近成績は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-course" ? (
			hasKojimaCourseStatsData ? (
				<div style={venueExtrasDataGridStyle}><section style={venueExtrasPanelStyle}><h4 style={venueExtrasPanelTitleStyle}>進入コース別</h4><div style={venueExtrasTableWrapStyle}><table style={{ ...venueExtrasTableStyle, minWidth: "1380px" }}><thead><tr><th style={venueExtrasHeadCellStyle}>枠</th><th style={venueExtrasHeadCellStyle}>選手</th>{Array.from({ length: 6 }, (_, index) => (<th key={`kojima-course-head-${index}`} style={venueExtrasHeadCellStyle}>{index + 1}コース</th>))}</tr></thead><tbody>{selectedKojimaCourseStats.map((item) => (<tr key={`kojima-course-${item.frameNo}`}><td style={venueExtrasBodyCellStyle}>{item.frameNo}</td><td style={venueExtrasBodyCellStyle}><div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}><strong>{item.playerName || `枠${item.frameNo}`}</strong><span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span></div></td>{Array.from({ length: 6 }, (_, index) => { const course = item.courseRows[index]; return <td key={`kojima-course-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>{course ? <div style={{ display: "grid", gap: "3px", minWidth: "96px" }}><span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入率{course.entryRate || "-"}</span><span>1着率{course.firstRate || "-"}</span><span>2連率{sumVenueExtraRates(course.firstRate, course.secondRate) || "-"}</span><span>3連率{sumVenueExtraRates(course.firstRate, course.secondRate, course.thirdRate) || "-"}</span><span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>平均ST {course.averageStart || "-"}</span></div> : "-"}</td>; })}</tr>))}</tbody></table></div></section></div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式の進入コース別成績は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-motor" ? (
			hasKojimaMotorStatsData ? (
				<div style={venueExtrasDataGridStyle}><section style={venueExtrasPanelStyle}><h4 style={venueExtrasPanelTitleStyle}>モーター成績</h4><div style={venueExtrasTableWrapStyle}><table style={{ ...venueExtrasTableStyle, minWidth: "1360px" }}><thead><tr><th style={venueExtrasHeadCellStyle}>枠</th><th style={venueExtrasHeadCellStyle}>選手</th><th style={venueExtrasHeadCellStyle}>モーター</th><th style={venueExtrasHeadCellStyle}>2連率</th><th style={venueExtrasHeadCellStyle}>勝率</th><th style={venueExtrasHeadCellStyle}>評価</th><th style={venueExtrasHeadCellStyle}>コメント</th><th style={venueExtrasHeadCellStyle}>ベスト展示</th><th style={venueExtrasHeadCellStyle}>前検タイム</th></tr></thead><tbody>{selectedKojimaMotorStats.map((item) => (<tr key={`kojima-motor-${item.frameNo}`}><td style={venueExtrasBodyCellStyle}>{item.frameNo}</td><td style={venueExtrasBodyCellStyle}><div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}><strong>{item.playerName || `枠${item.frameNo}`}</strong><span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span></div></td><td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.motorWinRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.motorRank ? `順位${item.motorRank}` : "-"}</td><td style={venueExtrasBodyCellStyle}>{item.comment || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.bestExhibitionTime || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.preInspectionTime || "-"}</td></tr>))}</tbody></table></div></section></div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式のモーター成績は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-frame" ? (
			hasKojimaFrameStatsData ? (
				<div style={venueExtrasDataGridStyle}><section style={venueExtrasPanelStyle}><h4 style={venueExtrasPanelTitleStyle}>枠番別成績</h4><div style={venueExtrasTableWrapStyle}><table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}><thead><tr><th style={venueExtrasHeadCellStyle}>枠</th><th style={venueExtrasHeadCellStyle}>選手</th>{Array.from({ length: 10 }, (_, index) => (<th key={`kojima-frame-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>))}<th style={venueExtrasHeadCellStyle}>枠番勝率</th><th style={venueExtrasHeadCellStyle}>枠番平均ST</th><th style={venueExtrasHeadCellStyle}>スタート順</th></tr></thead><tbody>{selectedKojimaFrameStats.map((item) => (<tr key={`kojima-frame-${item.frameNo}`}><td style={venueExtrasBodyCellStyle}>{item.frameNo}</td><td style={venueExtrasBodyCellStyle}><div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}><strong>{item.playerName || `枠${item.frameNo}`}</strong><span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span></div></td>{Array.from({ length: 10 }, (_, index) => (<td key={`kojima-frame-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}><div style={narutoHistoryStackStyle}><span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span><span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span><span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span></div></td>))}<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td></tr>))}</tbody></table></div></section></div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式の枠番別成績は未取得待ちです。</p>
			)
		) : null}

		{isKojimaVenue && selectedVenueExtraPanel === "kojima-score" ? (
			hasKojimaScoreRateGuideData ? (
				<div style={venueExtrasDataGridStyle}><section style={venueExtrasPanelStyle}><h4 style={venueExtrasPanelTitleStyle}>得点率早見</h4>{selectedKojimaScoreRateGuide.length === 0 ? <p style={venueExtrasEmptyStyle}>児島公式の得点率早見は未取得のため、BOATRACE公式の掲載を確認してから表示します。</p> : null}<div style={venueExtrasTableWrapStyle}><table style={{ ...venueExtrasTableStyle, minWidth: "1420px" }}><thead><tr><th style={venueExtrasHeadCellStyle}>枠</th><th style={venueExtrasHeadCellStyle}>登録番号</th><th style={venueExtrasHeadCellStyle}>選手</th><th style={venueExtrasHeadCellStyle}>級別</th><th style={venueExtrasHeadCellStyle}>平均ST</th><th style={venueExtrasHeadCellStyle}>全国勝率</th><th style={venueExtrasHeadCellStyle}>全国2連率</th><th style={venueExtrasHeadCellStyle}>当地勝率</th><th style={venueExtrasHeadCellStyle}>当地2連率</th><th style={venueExtrasHeadCellStyle}>モーター2連率</th><th style={venueExtrasHeadCellStyle}>得点率</th></tr></thead><tbody>{kojimaScoreRows.map((item) => (<tr key={`kojima-score-${item.frameNo}`}><td style={venueExtrasBodyCellStyle}>{item.frameNo}</td><td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td><td style={venueExtrasBodyCellStyle}>{item.scoreRate || "-"}</td></tr>))}</tbody></table></div></section></div>
			) : (
				<p style={venueExtrasEmptyStyle}>児島公式の得点率早見は未取得待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-series" ? (
			hasTamagawaSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>節間成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1380px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 12 }, (_, index) => (
											<th key={`tamagawa-series-head-${index}`} style={venueExtrasHeadCellStyle}>{index + 1}走</th>
										))}
									</tr>
								</thead>
								<tbody>
									{selectedTamagawaSeriesResults.map((item) => (
										<tr key={`tamagawa-series-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											{Array.from({ length: 12 }, (_, index) => (
												<td key={`tamagawa-series-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "3px", minWidth: "54px" }}>
														<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>R {item.raceNumbers[index] || "-"}</span>
														<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入 {item.courses[index] || "-"}</span>
														<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {item.startTimings[index] || "-"}</span>
														<strong>{item.finishOrders[index] || "-"}</strong>
													</div>
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>多摩川公式の節間成績は未取得待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-frame10" ? (
			hasTamagawaFramePast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>枠番別過去10走</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 10 }, (_, index) => (
											<th key={`tamagawa-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
										))}
										<th style={venueExtrasHeadCellStyle}>勝率</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>スタート順</th>
									</tr>
								</thead>
								<tbody>
									{selectedTamagawaFramePast10.map((item) => (
										<tr key={`tamagawa-frame10-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											{Array.from({ length: 10 }, (_, index) => {
												const course = item.courseHistory[index] || "";
												const finish = item.finishHistory[index] || "-";
												return (
													<td key={`tamagawa-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														<div style={narutoHistoryStackStyle}>
															<span style={narutoHistoryCourseStyle}>{course || " "}</span>
															<span style={{ ...narutoHistoryFinishStyle, color: finish.includes("F") ? "#b23a3a" : narutoHistoryFinishStyle.color }}>{finish}</span>
														</div>
													</td>
												);
											})}
											<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>多摩川公式の枠番別過去10走は未取得待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-score" ? (
			tamagawaScoreRows.length > 0 ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>得点率早見</h4>
						{selectedTamagawaScoreRateGuide.length === 0 ? <p style={venueExtrasEmptyStyle}>多摩川公式の得点率早見は未取得のため、BOATRACE公式の掲載を確認してから表示します。</p> : null}
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>登録番号</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
									</tr>
								</thead>
								<tbody>
									{tamagawaScoreRows.map((item) => (
										<tr key={`tamagawa-score-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>多摩川公式の得点率早見はまだ取得されていません。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "official" ? (
			hasOfficialPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{selectedOfficialBeforeInfo?.exhibitionRows.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>公式展示タイム</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											{hasOfficialWeightData ? <th style={venueExtrasHeadCellStyle}>体重 / 調整</th> : null}
											<th style={venueExtrasHeadCellStyle}>チルト</th>
											<th style={venueExtrasHeadCellStyle}>展示タイム</th>
										</tr>
									</thead>
									<tbody>
										{selectedOfficialBeforeInfo.exhibitionRows.map((item) => (
											<tr key={`official-beforeinfo-exhibition-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
												{hasOfficialWeightData ? <td style={venueExtrasBodyCellStyle}>{item.weight || "-"} / {item.weightAdjustment || "-"}</td> : null}
												<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isMikuniVenue && selectedMikuniBeforeInfo.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>三国直前情報</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											<th style={venueExtrasHeadCellStyle}>コース</th>
											<th style={venueExtrasHeadCellStyle}>チルト</th>
											<th style={venueExtrasHeadCellStyle}>ST</th>
											<th style={venueExtrasHeadCellStyle}>展示</th>
											<th style={venueExtrasHeadCellStyle}>部品交換</th>
											<th style={venueExtrasHeadCellStyle}>メモ</th>
										</tr>
									</thead>
									<tbody>
										{selectedMikuniBeforeInfo.map((item) => {
											const scoreRow = selectedMikuniScoreRateGuide.find((score) => score.frameNo === item.frameNo);

											return (
												<tr key={`mikuni-beforeinfo-${item.frameNo}`}>
													<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
													<td style={venueExtrasBodyCellStyle}>{scoreRow?.playerName || item.playerName || `枠${item.frameNo}`}</td>
													<td style={venueExtrasBodyCellStyle}>{item.course || "-"}</td>
													<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
													<td style={venueExtrasBodyCellStyle}>{item.startTiming || "-"}</td>
													<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
													<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
													<td style={venueExtrasBodyCellStyle}>{item.memo || "-"}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{!hasOfficialBeforeInfoDetail ? (
						<p style={venueExtrasEmptyStyle}>{isMikuniVenue ? "三国の直前情報は未掲載です。公式更新後に展示値が反映される場合があります。" : "BOATRACE公式直前データは未取得待ちです。"}</p>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "start" ? (
			hasStartPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{!isTamagawaVenue && selectedOfficialBeforeInfo?.startExhibition.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>公式スタート展示</h4>

							{isNarutoVenue ? (
								<div style={venueExtrasTableWrapStyle}>
									<table style={venueExtrasTableStyle}>
										<thead>
											<tr>
												<th style={venueExtrasHeadCellStyle}>艇番</th>
												<th style={venueExtrasHeadCellStyle}>選手</th>
												<th style={venueExtrasHeadCellStyle}>進入</th>
												<th style={venueExtrasHeadCellStyle}>ST</th>
												<th style={venueExtrasHeadCellStyle}>展示ST</th>
												<th style={venueExtrasHeadCellStyle}>S/D</th>
												<th style={venueExtrasHeadCellStyle}>備考</th>
											</tr>
										</thead>
										<tbody>
											{narutoStartExhibitionDisplay.map((item) => {
												const frameTone = narutoFramePalette[item.frameNo] ?? narutoFramePalette[1];
												const startFlag = getOfficialStartFlag(item.startTiming);

												return (
													<tr key={`official-beforeinfo-start-naruto-${item.course}-${item.frameNo}`}>
														<td style={venueExtrasBodyCellStyle}>
															<span
																style={{
																	...narutoStartCourseBadgeStyle,
																	background: frameTone.background,
																	color: frameTone.color,
																	border: `1px solid ${frameTone.border}`,
																}}
															>
																{item.frameNo}号艇
															</span>
														</td>
														<td style={venueExtrasBodyCellStyle}>{item.playerName || `枠${item.frameNo}`}</td>
														<td style={venueExtrasBodyCellStyle}>{item.course}コース</td>
														<td style={venueExtrasBodyCellStyle}>{getOfficialStartTimingValue(item.startTiming)}</td>
														<td style={venueExtrasBodyCellStyle}>{item.startTiming || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.style === "S" ? "スロー" : item.style === "D" ? "ダッシュ" : item.style || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>
															{[
																startFlag !== "-" ? `F表示 ${startFlag}` : "",
																item.currentAverageStart ? `今節平均ST ${item.currentAverageStart}` : "",
																item.startOrder ? `スタート順 ${item.startOrder}` : "",
															].filter(Boolean).join(" / ") || "-"}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							) : (
								<div style={venueExtrasTableWrapStyle}>
									<table style={venueExtrasTableStyle}>
										<thead>
											<tr>
												<th style={venueExtrasHeadCellStyle}>コース</th>
												<th style={venueExtrasHeadCellStyle}>枠</th>
												<th style={venueExtrasHeadCellStyle}>ST</th>
												<th style={venueExtrasHeadCellStyle}>F表示</th>
												<th style={venueExtrasHeadCellStyle}>今節平均ST</th>
											</tr>
										</thead>
										<tbody>
											{selectedOfficialBeforeInfo.startExhibition.map((item) => (
												<tr key={`official-beforeinfo-start-${item.course}-${item.frameNo}`}>
													<td style={venueExtrasBodyCellStyle}>{item.course}コース</td>
													<td style={venueExtrasBodyCellStyle}>{item.frameNo}号艇</td>
													<td style={venueExtrasBodyCellStyle}>{getOfficialStartTimingValue(item.startTiming)}</td>
													<td style={venueExtrasBodyCellStyle}>{getOfficialStartFlag(item.startTiming)}</td>
													<td style={venueExtrasBodyCellStyle}>{item.currentAverageStart || "-"}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</section>
					) : null}

					{hasStartExhibitionData ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>スタート展示</h4>
							{isTamagawaVenue && tamagawaStartExhibitionDisplay.length > 0 ? (
								<div style={narutoStartScrollStyle}>
									<div style={narutoStartBoardStyle}>
										{tamagawaStartExhibitionDisplay.map((item) => {
											const frameTone = narutoFramePalette[item.frameNo] ?? narutoFramePalette[1];
											const startFlag = getOfficialStartFlag(item.startTiming);
											const isFlaggedStart = startFlag !== "-";

											return (
												<div key={`tamagawa-start-visual-${item.course}-${item.frameNo}`} style={narutoStartRowStyle}>
													<div style={narutoStartMetaStyle}>
														<div style={narutoStartMetaTopStyle}>
															<span style={narutoStartCourseBadgeStyle}>{item.course}コース</span>
															<span
																style={{
																	...narutoStartCourseBadgeStyle,
																	background: frameTone.background,
																	color: frameTone.color,
																	border: `1px solid ${frameTone.border}`,
																}}
															>
																{item.frameNo}号艇
															</span>
														</div>
														<p style={narutoStartPlayerStyle}>{item.playerName}</p>
														<div style={narutoStartMetaDetailStyle}>
															<span>今節平均ST {item.currentAverageStart || "-"}</span>
															<span>スタート順{item.startOrder ?? "-"}</span>
															{item.style ? <span>{item.style === "S" ? "スロー" : item.style === "D" ? "ダッシュ" : item.style}</span> : null}
														</div>
													</div>
													<div style={narutoStartWaterStyle}>
														<div style={narutoStartLaneLabelStyle}>
															<p style={narutoStartLaneTextStyle}>Water Lane</p>
															<p style={narutoStartLaneSubTextStyle}>{item.course}コース進入</p>
														</div>
														<div style={narutoStartTrackStyle}>
															<div style={narutoStartTrackWaveStyle} />
															<div style={{ ...narutoStartLineStyle, left: "82%" }} />
															<div style={narutoStartLineLabelStyle}>
																<span>START LINE</span>
																<span>0.00</span>
															</div>
															<p style={narutoStartTrackHintStyle}>早い / 遅い</p>
															<span
																style={{
																	...narutoStartBoatBaseStyle,
																	background: frameTone.background,
																	color: frameTone.color,
																	left: `${item.startLanePosition}%`,
																	backgroundImage: undefined,
																	borderColor: frameTone.border,
																	boxShadow: isFlaggedStart
																	    ? "0 0 0 3px rgba(225, 67, 67, 0.28), 0 12px 22px rgba(17, 64, 92, 0.16)"
																		: "0 10px 20px rgba(17, 64, 92, 0.12)",
																		}}
															>
																<span>{item.frameNo}号艇</span>
																<span
																	style={{
																		...narutoStartTimingBaseStyle,
																		color: boatTheme.colors.navy,
																		background: "rgba(255, 255, 255, 0.78)",
																		border: narutoStartTimingBaseStyle.border,
																	}}
																>
																	{item.startTiming || "-"}
																</span>
																{isFlaggedStart ? (
																	<span style={narutoStartFlagBadgeStyle}>{startFlag}</span>
																	) : null}
															</span>
														</div>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							) : null}
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>コース</th>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>進入</th>
											<th style={venueExtrasHeadCellStyle}>展示ST</th>
											<th style={venueExtrasHeadCellStyle}>今節平均ST</th>
											<th style={venueExtrasHeadCellStyle}>スタート順</th>
											{(isTamagawaVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue) ? <th style={venueExtrasHeadCellStyle}>選手</th> : null}
										</tr>
									</thead>
									<tbody>
										{selectedStartExhibition.map((item) => (
											<tr key={`venue-extra-start-exhibition-${item.course}-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.course}コース</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}号艇</td>
												<td style={venueExtrasBodyCellStyle}>
													{item.style === "S" ? "スロー" : item.style === "D" ? "ダッシュ" : item.style || "-"}
												</td>
												<td style={venueExtrasBodyCellStyle}>{item.startTiming || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.currentAverageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.startOrder || "-"}</td>
												{(isTamagawaVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue) ? <td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td> : null}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>{isMikuniVenue ? "三国のスタート展示は現状 JSON では 0 件です。公式ページ未掲載、または安定取得対象外のため反映待ちです。" : "このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。"}</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-before" ? (
			hasWakamatsuBeforeInfoData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>直前情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1180px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>展示T</th>
										<th style={venueExtrasHeadCellStyle}>体重</th>
										<th style={venueExtrasHeadCellStyle}>調整</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>部品交換</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuBeforeInfo.map((item) => {
										const previousRaceInfo = item.previousRaceInfo || [
											item.previousRaceNo ? `${item.previousRaceNo}R` : "",
											item.previousRaceCourse ? `${item.previousRaceCourse}コース` : "",
											item.previousRaceStartTiming ? `ST ${item.previousRaceStartTiming}` : "",
											item.previousRaceFinishOrder ? `${item.previousRaceFinishOrder}逹` : "",
										].filter(Boolean).join(" / ");

										return (
											<tr key={`wakamatsu-before-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{item.className || "-"} / {item.registerNo || "-"}
														</span>
													</div>
												</td>
												<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.weight || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.weightAdjustment || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{previousRaceInfo || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の直前情報は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-entry" ? (
			hasWakamatsuEntryData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>出走表</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1320px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
										<th style={venueExtrasHeadCellStyle}>ボート</th>
										<th style={venueExtrasHeadCellStyle}>コメント</th>
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuEntryRows.map((item) => (
										<tr key={`wakamatsu-entry-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName || `枠${item.frameNo}`}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.nationalWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.nationalSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.boatNo || "-"} / {item.boatSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.comment || item.motorEvaluation || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の出走表は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-series" ? (
			hasWakamatsuSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>今節成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1560px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 16 }, (_, index) => {
											const dayLabel = selectedWakamatsuSeriesResults.find((row) => row.dayLabels[index])?.dayLabels[index];

											return <th key={`wakamatsu-series-head-${index}`} style={venueExtrasHeadCellStyle}>{dayLabel || `${index + 1}走`}</th>;
										})}
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuSeriesResults.map((item) => (
										<tr key={`wakamatsu-series-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 16 }, (_, index) => {
												const raceNo = item.raceNumbers[index] || "";
												const course = item.courses[index] || "";
												const startTiming = item.startTimings[index] || "";
												const finishOrder = item.finishOrders[index] || "";
												const hasCellData = Boolean(raceNo || course || startTiming || finishOrder);

												return (
													<td key={`wakamatsu-series-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{hasCellData ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "58px", lineHeight: 1.35 }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>R {raceNo || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入 {course || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {startTiming || "-"}</span>
																<strong>{finishOrder || "-"}</strong>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の今節成績は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-course" ? (
			hasWakamatsuCourseStatsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>進入コース別成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1240px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 6 }, (_, index) => (
											<th key={`wakamatsu-course-head-${index}`} style={venueExtrasHeadCellStyle}>{index + 1}コース</th>
										))}
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuCourseStats.map((item) => (
										<tr key={`wakamatsu-course-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 6 }, (_, index) => {
												const course = item.courseRows[index];
												return (
													<td key={`wakamatsu-course-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{course ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "74px" }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入回数 {course.entryCount || "-"}</span>
																<span>1着 {course.firstCount || "-"}</span>
																<span>2着 {course.secondCount || "-"}</span>
																<span>3着 {course.thirdCount || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {course.averageStart || "-"}</span>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の進入コース別成績は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-national3" ? (
			hasWakamatsuNationalRecent3Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>全国過去3節</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>1節前</th>
										<th style={venueExtrasHeadCellStyle}>2節前</th>
										<th style={venueExtrasHeadCellStyle}>3節前</th>
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuNationalRecent3.map((item) => (
										<tr key={`wakamatsu-national3-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 3 }, (_, index) => {
												const history = item.histories[index];
												return (
													<td key={`wakamatsu-national3-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{history ? (
															<div style={{ ...narutoMeetCellStyle, alignItems: "flex-start" }}>
																<span style={narutoMeetLabelStyle}>{history.venueName || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.grade || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"}</span>
																<span style={narutoMeetResultStyle}>{history.results || "-"}</span>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の全国過去3節は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-local3" ? (
			hasWakamatsuLocalRecent3Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>当地過去3節</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>1節前</th>
										<th style={venueExtrasHeadCellStyle}>2節前</th>
										<th style={venueExtrasHeadCellStyle}>3節前</th>
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuLocalRecent3.map((item) => (
										<tr key={`wakamatsu-local3-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 3 }, (_, index) => {
												const history = item.histories[index];
												return (
													<td key={`wakamatsu-local3-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{history ? (
															<div style={{ ...narutoMeetCellStyle, alignItems: "flex-start" }}>
																<span style={narutoMeetLabelStyle}>{history.venueName || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.grade || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"}</span>
																<span style={narutoMeetResultStyle}>{history.results || "-"}</span>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の当地過去3節は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-frame10" ? (
			hasWakamatsuFramePast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>枠番別10走</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 10 }, (_, index) => (
											<th key={`wakamatsu-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
										))}
										<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
										<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
										<th style={venueExtrasHeadCellStyle}>スタート順</th>
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuFramePast10.map((item) => {
										const entry = selectedWakamatsuEntryRows.find((row) => row.frameNo === item.frameNo);

										return (
											<tr key={`wakamatsu-frame10-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{entry?.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{entry?.className || "-"} / {entry?.registerNo || "-"}
														</span>
													</div>
												</td>
												{Array.from({ length: 10 }, (_, index) => (
													<td key={`wakamatsu-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														<div style={narutoHistoryStackStyle}>
															<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
															<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
															<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span>
														</div>
													</td>
												))}
												<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の枠番別10走は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-motor" ? (
			hasWakamatsuMotorHistoryData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>モーター履歴</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1460px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手/ モーター</th>
										<th style={venueExtrasHeadCellStyle}>勝率 / 2連率</th>
										<th style={venueExtrasHeadCellStyle}>ベスト展示</th>
										<th style={venueExtrasHeadCellStyle}>ベスト一周</th>
										<th style={venueExtrasHeadCellStyle}>ベスト直線</th>
										<th style={venueExtrasHeadCellStyle}>ベスト回り足</th>
										{Array.from({ length: 3 }, (_, index) => (
											<th key={`wakamatsu-motor-head-${index}`} style={venueExtrasHeadCellStyle}>履歴{index + 1}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuMotorHistory.map((item) => (
										<tr key={`wakamatsu-motor-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>モーター {item.motorNo || "-"}</span>
												</div>
											</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorWinRate || "-"} / {item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.bestExhibitionTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.bestOneLapTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.bestStraightTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.bestTurnTime || "-"}</td>
											{Array.from({ length: 3 }, (_, index) => {
												const history = item.historyEntries[index];
												return (
													<td key={`wakamatsu-motor-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{history ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "126px" }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>{history.seriesTitle || "-"}</span>
																<strong>{history.playerName || "-"}</strong>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>{history.results || "-"}</span>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式のモーター履歴は未取得待ちです。</p>
			)
		) : null}

		{isWakamatsuVenue && selectedVenueExtraPanel === "wakamatsu-score" ? (
			hasWakamatsuScoreRateGuideData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>得点率早見</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>登録番号</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
									</tr>
								</thead>
								<tbody>
									{selectedWakamatsuScoreRateGuide.map((item) => (
										<tr key={`wakamatsu-score-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>若松公式の得点率早見は未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-before" ? (
			hasTsuBeforeInfoData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>直前情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1160px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>体重</th>
										<th style={venueExtrasHeadCellStyle}>調整</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
										<th style={venueExtrasHeadCellStyle}>部品交換</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
									</tr>
								</thead>
								<tbody>
									{selectedTsuBeforeInfo.map((item) => {
										const previousRaceInfo = [
											item.previousRaceNo ? `${item.previousRaceNo}R` : "",
											item.previousRaceCourse ? `${item.previousRaceCourse}コース` : "",
											item.previousRaceStartTiming ? `ST ${item.previousRaceStartTiming}` : "",
											item.previousRaceFinishOrder ? `${item.previousRaceFinishOrder}逹` : "",
										].filter(Boolean).join(" / ");

										return (
											<tr key={`tsu-before-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{item.className || "-"} / {item.registerNo || "-"}
														</span>
													</div>
												</td>
												<td style={venueExtrasBodyCellStyle}>{item.weight || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.weightAdjustment || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{previousRaceInfo || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.motorComment || "-"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の直前情報は未取得待ちです。</p>
			)
		) : null}

				{isBiwakoVenue && selectedVenueExtraPanel === "biwako-frame10" ? (
			hasBiwakoFramePast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>枠番別10走</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 10 }, (_, index) => (
											<th key={`biwako-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
										))}
										<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
										<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
										<th style={venueExtrasHeadCellStyle}>スタート順</th>
									</tr>
								</thead>
								<tbody>
									{selectedBiwakoFramePast10.map((item) => (
										<tr key={`biwako-frame10-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 10 }, (_, index) => (
												<td key={`biwako-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
													<div style={narutoHistoryStackStyle}>
														<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
														<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
														<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>
															ST {item.startTimingHistory[index] || "-"}
														</span>
													</div>
												</td>
											))}
											<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>びわこ公式の枠番別10走は未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-comments" ? (
			hasTsuRacerCommentsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>選手コメント</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>コメント</th>
										<th style={venueExtrasHeadCellStyle}>モーターコメント</th>
									</tr>
								</thead>
								<tbody>
									{selectedTsuRacerComments.map((item) => {
										const hasComment = Boolean(item.comment || item.motorComment);

										return (
											<tr key={`tsu-comments-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{item.className || "-"} / {item.registerNo || "-"}
														</span>
													</div>
												</td>
												<td style={venueExtrasBodyCellStyle}>{hasComment ? (item.comment || "-") : "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{hasComment ? (item.motorComment || "-") : "-"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の選手コメントは未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-series" ? (
			hasTsuSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>今節成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1380px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 12 }, (_, index) => {
											const dayLabel = selectedTsuSeriesResults.find((row) => row.dayLabels[index])?.dayLabels[index];

											return (
												<th key={`tsu-series-head-${index}`} style={venueExtrasHeadCellStyle}>
													{dayLabel || `${index + 1}走`}
												</th>
											);
										})}
									</tr>
								</thead>
								<tbody>
									{selectedTsuSeriesResults.map((item) => (
										<tr key={`tsu-series-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 12 }, (_, index) => {
												const raceNo = item.raceNumbers[index] || "";
												const course = item.courses[index] || "";
												const startTiming = item.startTimings[index] || "";
												const finishOrder = item.finishOrders[index] || "";
												const hasCellData = Boolean(raceNo || course || startTiming || finishOrder);

												return (
													<td key={`tsu-series-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{hasCellData ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "58px", lineHeight: 1.35 }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>R {raceNo || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入 {course || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {startTiming || "-"}</span>
																<strong>{finishOrder || "-"}</strong>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の今節成績は未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-national3" ? (
			hasTsuNationalRecent3Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>全国過去3節</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>1節前</th>
										<th style={venueExtrasHeadCellStyle}>2節前</th>
										<th style={venueExtrasHeadCellStyle}>3節前</th>
									</tr>
								</thead>
								<tbody>
									{selectedTsuNationalRecent3.map((item) => (
										<tr key={`tsu-national3-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 3 }, (_, index) => {
												const history = item.histories[index];

												return (
													<td key={`tsu-national3-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{history ? (
															<div style={{ ...narutoMeetCellStyle, alignItems: "flex-start" }}>
																<span style={narutoMeetLabelStyle}>{history.venueName || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.grade || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"}</span>
																<span style={narutoMeetResultStyle}>{history.results || "-"}</span>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の全国過去3節は未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-local3" ? (
			hasTsuLocalRecent3Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>当地過去3節</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>1節前</th>
										<th style={venueExtrasHeadCellStyle}>2節前</th>
										<th style={venueExtrasHeadCellStyle}>3節前</th>
									</tr>
								</thead>
								<tbody>
									{selectedTsuLocalRecent3.map((item) => (
										<tr key={`tsu-local3-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 3 }, (_, index) => {
												const history = item.histories[index];

												return (
													<td key={`tsu-local3-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{history ? (
															<div style={{ ...narutoMeetCellStyle, alignItems: "flex-start" }}>
																<span style={narutoMeetLabelStyle}>{history.venueName || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.grade || "-"}</span>
																<span style={{ fontSize: "0.68rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"}</span>
																<span style={narutoMeetResultStyle}>{history.results || "-"}</span>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の当地過去3節は未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-frame10" ? (
			hasTsuFramePast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>枠番別10走</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 10 }, (_, index) => (
											<th key={`tsu-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
										))}
										<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
										<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
										<th style={venueExtrasHeadCellStyle}>スタート順</th>
									</tr>
								</thead>
								<tbody>
									{selectedTsuFramePast10Display.map((item) => (
										<tr key={`tsu-frame10-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
														{item.className || "-"} / {item.registerNo || "-"}
													</span>
												</div>
											</td>
											{Array.from({ length: 10 }, (_, index) => (
												<td key={`tsu-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
													<div style={narutoHistoryStackStyle}>
														<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
														<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
														<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>
															ST {item.startTimingHistory[index] || "-"}
														</span>
													</div>
												</td>
											))}
											<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の枠番別10走は未取得待ちです。</p>
			)
		) : null}

		{isTsuVenue && selectedVenueExtraPanel === "tsu-score" ? (
			(tsuScoreRows.length > 0) ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>得点率早見</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>登録番号</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
									</tr>
								</thead>
								<tbody>
									{tsuScoreRows.map((item) => (
										<tr key={`tsu-score-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>津公式の得点率早見は未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-entry" ? (
			hasFukuokaEntryData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>選手成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1460px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別 / 登録番号</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
										<th style={venueExtrasHeadCellStyle}>ボート2連率</th>
										<th style={venueExtrasHeadCellStyle}>コメント</th>
									</tr>
								</thead>
								<tbody>
									{selectedFukuokaEntryRows.map((item) => (
										<tr key={`fukuoka-entry-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"} / {item.registerNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.nationalWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.nationalSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.boatSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.comment || item.motorEvaluation || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式の選手成績は未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-before" ? (
			hasFukuokaBeforeInfoData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>直前情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1320px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>展示T</th>
										<th style={venueExtrasHeadCellStyle}>体重</th>
										<th style={venueExtrasHeadCellStyle}>調整</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
										<th style={venueExtrasHeadCellStyle}>部品交換</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
									</tr>
								</thead>
								<tbody>
									{selectedFukuokaBeforeInfo.map((item) => (
										<tr key={`fukuoka-before-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName || `枠${item.frameNo}`}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.weight || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.weightAdjustment || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.previousRaceInfo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.motorSecondRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式の直前情報は未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-motor" ? (
			hasFukuokaMotorEvaluationData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>モーター評価</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1360px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
										<th style={venueExtrasHeadCellStyle}>2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター評価</th>
										<th style={venueExtrasHeadCellStyle}>モーターコメント</th>
										<th style={venueExtrasHeadCellStyle}>ベスト展示</th>
										<th style={venueExtrasHeadCellStyle}>前走情報</th>
									</tr>
								</thead>
								<tbody>
									{selectedFukuokaMotorEvaluation.map((item) => (
										<tr key={`fukuoka-motor-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorEvaluation || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorComment || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.bestExhibitionTime || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式のモーター評価は未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-series" ? (
			hasFukuokaSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>節間成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1340px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 12 }, (_, index) => {
											const dayLabel = selectedFukuokaSeriesResults.find((row) => row.dayLabels[index])?.dayLabels[index];
											return <th key={`fukuoka-series-head-${index}`} style={venueExtrasHeadCellStyle}>{dayLabel || `${index + 1}走`}</th>;
										})}
									</tr>
								</thead>
								<tbody>
									{selectedFukuokaSeriesResults.map((item) => (
										<tr key={`fukuoka-series-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName || `枠${item.frameNo}`}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											{Array.from({ length: 12 }, (_, index) => {
												const raceNo = item.raceNumbers[index] || "";
												const course = item.courses[index] || "";
												const startTiming = item.startTimings[index] || "";
												const finishOrder = item.finishOrders[index] || "";
												const hasCellData = Boolean(raceNo || course || startTiming || finishOrder);

												return (
													<td key={`fukuoka-series-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{hasCellData ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "58px", lineHeight: 1.35 }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>R {raceNo || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入 {course || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {startTiming || "-"}</span>
																<strong>{finishOrder || "-"}</strong>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式の節間成績は未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-comments" ? (
			hasFukuokaRacerCommentsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>選手コメント</h4>
						<div style={venueExtrasCommentListStyle}>
							{selectedFukuokaRacerComments.map((item) => {
								const commentText = item.comment || item.motorComment || "-";
								return (
									<article key={`fukuoka-comment-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>{item.frameNo}号艇/ {item.playerName || `枠${item.frameNo}`}</p>
											<span style={venueExtrasFocusPillStyle}>{item.className || "-"} / {item.registerNo || "-"}</span>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{commentText}</p>
										<p style={venueExtrasCommentStyle}>{item.motorComment || item.comment || "-"}</p>
									</article>
								);
							})}
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式の選手コメントは未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-frame10" ? (
			hasFukuokaFramePast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>枠番別10走</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 10 }, (_, index) => (
											<th key={`fukuoka-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
										))}
										<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
										<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
										<th style={venueExtrasHeadCellStyle}>スタート順</th>
									</tr>
								</thead>
								<tbody>
									{selectedFukuokaFramePast10.map((item) => {
										const entry = selectedFukuokaEntryRows.find((row) => row.frameNo === item.frameNo);
										return (
											<tr key={`fukuoka-frame10-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{entry?.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{entry?.className || "-"} / {entry?.registerNo || "-"}</span>
													</div>
												</td>
												{Array.from({ length: 10 }, (_, index) => (
													<td key={`fukuoka-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														<div style={narutoHistoryStackStyle}>
															<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
															<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
															<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span>
														</div>
													</td>
												))}
												<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式の枠番別10走は未取得待ちです。</p>
			)
		) : null}

		{isFukuokaVenue && selectedVenueExtraPanel === "fukuoka-score" ? (
			hasFukuokaScoreRateGuideData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>得点率早見</h4>
						{selectedFukuokaScoreRateGuide.length === 0 ? <p style={venueExtrasEmptyStyle}>福岡公式の得点率早見は未取得のため、BOATRACE公式の掲載を確認してから表示します。</p> : null}
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1380px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>登録番号</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
										<th style={venueExtrasHeadCellStyle}>得点率</th>
									</tr>
								</thead>
								<tbody>
									{fukuokaScoreRows.map((item) => (
										<tr key={`fukuoka-score-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.scoreRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>福岡公式の得点率早見は未取得待ちです。</p>
			)
		) : null}

				{isBiwakoVenue && selectedVenueExtraPanel === "biwako-series" ? (
			hasBiwakoSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>節間成績</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1380px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										{Array.from({ length: 12 }, (_, index) => {
											const dayLabel = selectedBiwakoSeriesResults.find((row) => row.dayLabels[index])?.dayLabels[index];

											return (
												<th key={`biwako-series-head-${index}`} style={venueExtrasHeadCellStyle}>
													{dayLabel || `${index + 1}走`}
												</th>
											);
										})}
									</tr>
								</thead>
								<tbody>
									{selectedBiwakoSeriesResults.map((item) => (
										<tr key={`biwako-series-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													{item.className || item.registerNo ? (
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{item.className || "-"} / {item.registerNo || "-"}
														</span>
													) : null}
												</div>
											</td>
											{Array.from({ length: 12 }, (_, index) => {
												const raceNo = item.raceNumbers[index] || "";
												const course = item.courses[index] || "";
												const startTiming = item.startTimings[index] || "";
												const finishOrder = item.finishOrders[index] || "";
												const hasCellData = Boolean(raceNo || course || startTiming || finishOrder);

												return (
													<td key={`biwako-series-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														{hasCellData ? (
															<div style={{ display: "grid", gap: "3px", minWidth: "58px", lineHeight: 1.35 }}>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>R {raceNo || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入 {course || "-"}</span>
																<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>ST {startTiming || "-"}</span>
																<strong>{finishOrder || "-"}</strong>
															</div>
														) : "-"}
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>びわこ公式の節間成績は未取得待ちです。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "records" ? (
			hasRecordsPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{!isNarutoVenue && !isMikuniVenue && selectedOfficialBeforeInfo?.scoreQuickLook.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>公式得点率早見</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>登録番号</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											<th style={venueExtrasHeadCellStyle}>級別</th>
											<th style={venueExtrasHeadCellStyle}>平均ST</th>
											<th style={venueExtrasHeadCellStyle}>全国勝率</th>
											<th style={venueExtrasHeadCellStyle}>全国2連率</th>
											<th style={venueExtrasHeadCellStyle}>当地勝率</th>
											<th style={venueExtrasHeadCellStyle}>当地2連率</th>
											<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
											<th style={venueExtrasHeadCellStyle}>得点率</th>
											<th style={venueExtrasHeadCellStyle}>節間成績</th>
										</tr>
									</thead>
									<tbody>
										{selectedOfficialBeforeInfo.scoreQuickLook.map((item) => (
											<tr key={`official-beforeinfo-score-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.scoreRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.sectionResults || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isMiyajimaVenue && selectedRaceExtra ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>宮島公式 予想素材データ</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1040px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>カテゴリ</th>
											<th style={venueExtrasHeadCellStyle}>件数</th>
											<th style={venueExtrasHeadCellStyle}>取得元</th>
										</tr>
									</thead>
									<tbody>
										{[
											["今節成績", (selectedRaceExtra as Record<string, unknown>).miyajimaSectionResults],
											["枠番別過去10走", (selectedRaceExtra as Record<string, unknown>).miyajimaFrameLast10],
											["全国過去3節", (selectedRaceExtra as Record<string, unknown>).miyajimaNationalRecent3],
											["当地過去3節", (selectedRaceExtra as Record<string, unknown>).miyajimaLocalRecent3],
											["進入コース別情報", (selectedRaceExtra as Record<string, unknown>).miyajimaCourseResults],
										].map(([label, value]) => {
											const rows = Array.isArray(value) ? value : [];
											const first = rows.find(isVenueExtraRecord);
											const sourceLabel = first ? readVenueExtraString(first.sourceLabel) || readVenueExtraString(first.source) : "";

											return (
												<tr key={`miyajima-record-source-${label}`}>
													<td style={venueExtrasBodyCellStyle}>{label as string}</td>
													<td style={venueExtrasBodyCellStyle}>{rows.length ? `${rows.length}件` : "-"}</td>
													<td style={venueExtrasBodyCellStyle}>{sourceLabel || "宮島公式"}</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isMikuniVenue && selectedMikuniScoreRateGuide.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>三国得点率・節間成績</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1240px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>登録番号</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											<th style={venueExtrasHeadCellStyle}>級別</th>
											<th style={venueExtrasHeadCellStyle}>支部</th>
											<th style={venueExtrasHeadCellStyle}>平均ST</th>
											<th style={venueExtrasHeadCellStyle}>全国勝率</th>
											<th style={venueExtrasHeadCellStyle}>全国2連率</th>
											<th style={venueExtrasHeadCellStyle}>当地勝率</th>
											<th style={venueExtrasHeadCellStyle}>当地2連率</th>
											<th style={venueExtrasHeadCellStyle}>モーター</th>
											<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
											<th style={venueExtrasHeadCellStyle}>得点率</th>
											<th style={venueExtrasHeadCellStyle}>得点</th>
											<th style={venueExtrasHeadCellStyle}>減点</th>
											<th style={venueExtrasHeadCellStyle}>出走</th>
											<th style={venueExtrasHeadCellStyle}>節間成績</th>
										</tr>
									</thead>
									<tbody>
										{selectedMikuniScoreRateGuide.map((item) => (
											<tr key={`mikuni-score-rate-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.branch || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.scoreRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.score || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.deduction || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.starts || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.sectionResults || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isMikuniVenue && selectedMikuniCourseResults.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>三国進入別成績</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1180px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											{Array.from({ length: 6 }, (_, index) => (
												<th key={`mikuni-course-head-${index + 1}`} style={venueExtrasHeadCellStyle}>{index + 1}コース</th>
											))}
										</tr>
									</thead>
									<tbody>
										{selectedMikuniCourseResults.map((item) => (
											<tr key={`mikuni-course-results-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registrationNo || "-"}</span>
													</div>
												</td>
												{Array.from({ length: 6 }, (_, index) => {
													const courseRow = item.courseRows.find((course) => course.courseNo === index + 1);
													return (
														<td key={`mikuni-course-results-cell-${item.frameNo}-${index + 1}`} style={venueExtrasBodyCellStyle}>
															{courseRow ? (
																<div style={{ display: "grid", gap: "3px", minWidth: "96px", lineHeight: 1.35 }}>
																	<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進入率 {courseRow.entryRate || "-"}%</span>
																	<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>平均ST {courseRow.averageStart || "-"}</span>
																	<strong>1着 {courseRow.firstRate || "-"}% / 2着 {courseRow.secondRate || "-"}%</strong>
																	<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>3着 {courseRow.thirdRate || "-"}% / 4-6着 {courseRow.fourthRate || "-"}%・{courseRow.fifthRate || "-"}%・{courseRow.sixthRate || "-"}%</span>
																</div>
															) : "-"}
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isNarutoVenue && (hasNarutoPerformanceData || shouldShowNarutoPerformanceWaiting) ? (
						<section style={{ ...venueExtrasPanelStyle, gap: "16px" }}>
							<div style={narutoStatsTabWrapStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>成績・傾向</h4>
								<div style={narutoStatsTabScrollStyle}>
									<div style={narutoStatsTabGridStyle}>
										{narutoStatsTabOptions.map((option) => {
											const isActive = selectedNarutoStatsTab === option.key;

											return (
												<button
													key={`naruto-stats-tab-${option.key}`}
													type="button"
													onClick={() => setSelectedNarutoStatsTab(option.key)}
													style={{
														...narutoStatsTabButtonBaseStyle,
														background: isActive
															? "linear-gradient(180deg, rgba(17, 64, 92, 0.98), rgba(28, 98, 140, 0.96))"
															: narutoStatsTabButtonBaseStyle.background,
														border: isActive
															? "1px solid rgba(44, 145, 201, 0.38)"
															: narutoStatsTabButtonBaseStyle.border,
														boxShadow: isActive
															? "0 14px 28px rgba(17, 64, 92, 0.16)"
															: narutoStatsTabButtonBaseStyle.boxShadow,
														transform: isActive ? "translateY(-1px)" : "none",
													}}
												>
													<p
														style={{
															...narutoStatsTabTitleStyle,
															color: isActive ? "#f7fbff" : narutoStatsTabTitleStyle.color,
														}}
													>
														{option.label}
													</p>
													<p
														style={{
															...narutoStatsTabHintStyle,
															color: isActive ? "rgba(238, 248, 255, 0.82)" : narutoStatsTabHintStyle.color,
														}}
													>
														{option.hint}
													</p>
												</button>
											);
										})}
									</div>
								</div>
							</div>

							{selectedNarutoStatsTab === "score" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>公式得点率早見</h4>
								{selectedOfficialBeforeInfo?.scoreQuickLook.length ? (
									<div style={venueExtrasTableWrapStyle}>
										<table style={venueExtrasTableStyle}>
											<thead>
												<tr>
													<th style={venueExtrasHeadCellStyle}>枠</th>
													<th style={venueExtrasHeadCellStyle}>登録番号</th>
													<th style={venueExtrasHeadCellStyle}>選手</th>
													<th style={venueExtrasHeadCellStyle}>級別</th>
													<th style={venueExtrasHeadCellStyle}>平均ST</th>
													<th style={venueExtrasHeadCellStyle}>全国勝率</th>
													<th style={venueExtrasHeadCellStyle}>全国2連率</th>
													<th style={venueExtrasHeadCellStyle}>当地勝率</th>
													<th style={venueExtrasHeadCellStyle}>当地2連率</th>
													<th style={venueExtrasHeadCellStyle}>モーター2連率</th>
													<th style={venueExtrasHeadCellStyle}>得点率</th>
													<th style={venueExtrasHeadCellStyle}>節間成績</th>
													<th style={venueExtrasHeadCellStyle}>能力値</th>
													<th style={venueExtrasHeadCellStyle}>枠番適性</th>
													<th style={venueExtrasHeadCellStyle}>ST力</th>
												</tr>
											</thead>
											<tbody>
												{selectedOfficialBeforeInfo.scoreQuickLook.map((item) => {
													const abilityRow = selectedAbilityIndexByFrame.get(item.frameNo);

													return (
													<tr key={`official-beforeinfo-score-${item.frameNo}`}>
														<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
														<td style={venueExtrasBodyCellStyle}>{item.registrationNo || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.className || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.winRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.secondRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.scoreRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.sectionResults || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{abilityRow?.abilityValue || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{abilityRow?.frameCompatibility || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{abilityRow?.startPower || "-"}</td>
													</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								) : (
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できていません。</p>
								)}
							</section>
							) : null}

							{selectedNarutoStatsTab === "frameHistory" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>枠番別過去10走成績</h4>
								{selectedNarutoRacerPerformance?.byFramePast10.length ? (
									<div style={venueExtrasTableWrapStyle}>
										<table style={{ ...venueExtrasTableStyle, minWidth: "980px" }}>
											<thead>
												<tr>
													<th style={venueExtrasHeadCellStyle}>枠</th>
													<th style={venueExtrasHeadCellStyle}>選手</th>
													{Array.from({ length: 10 }, (_, index) => (
														<th key={`naruto-frame-history-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
													))}
													<th style={venueExtrasHeadCellStyle}>勝率</th>
													<th style={venueExtrasHeadCellStyle}>平均ST</th>
													<th style={venueExtrasHeadCellStyle}>スタート順</th>
												</tr>
											</thead>
											<tbody>
												{selectedNarutoRacerPerformance.byFramePast10.map((item) => (
													<tr key={`naruto-frame-history-${item.frameNo}`}>
														<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
														<td style={venueExtrasBodyCellStyle}>
															<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
																<strong>{item.playerName}</strong>
																<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
															</div>
														</td>
														{Array.from({ length: 10 }, (_, index) => {
															const course = item.courseHistory[index] || "";
															const finish = item.finishHistory[index] || "-";
															return (
																<td key={`naruto-frame-history-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
																	<div style={narutoHistoryStackStyle}>
																		<span style={narutoHistoryCourseStyle}>{course || " "}</span>
																		<span style={{ ...narutoHistoryFinishStyle, color: finish.includes("F") ? "#b23a3a" : narutoHistoryFinishStyle.color }}>{finish}</span>
																	</div>
																</td>
															);
														})}
														<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
														<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できていません。</p>
								)}
							</section>
							) : null}

							{selectedNarutoStatsTab === "narutoRecent" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>当地最近成績</h4>
								{selectedNarutoRacerPerformance?.narutoRecent.length ? (
									<div style={venueExtrasTableWrapStyle}>
										<table style={{ ...venueExtrasTableStyle, minWidth: "840px" }}>
											<thead>
												<tr>
													<th style={venueExtrasHeadCellStyle}>枠</th>
													<th style={venueExtrasHeadCellStyle}>選手</th>
													<th style={venueExtrasHeadCellStyle}>1節前</th>
													<th style={venueExtrasHeadCellStyle}>2節前</th>
													<th style={venueExtrasHeadCellStyle}>3節前</th>
												</tr>
											</thead>
											<tbody>
												{selectedNarutoRacerPerformance.narutoRecent.map((item) => (
													<tr key={`naruto-recent-${item.frameNo}`}>
														<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
														<td style={venueExtrasBodyCellStyle}>
															<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
																<strong>{item.playerName}</strong>
																<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
															</div>
														</td>
														{Array.from({ length: 3 }, (_, index) => {
															const history = item.histories[index];
															return (
																<td key={`naruto-recent-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
																	{history ? (
																		<div style={narutoMeetCellStyle}>
																			<span style={narutoMeetLabelStyle}>{history.label}</span>
																			<span style={narutoMeetResultStyle}>{history.results || "-"}</span>
																		</div>
																	) : "-"}
																</td>
															);
														})}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できていません。</p>
								)}
							</section>
							) : null}

							{selectedNarutoStatsTab === "nationalRecent" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>全国最近成績</h4>
								{selectedNarutoRacerPerformance?.nationalRecent.length ? (
									<div style={venueExtrasTableWrapStyle}>
										<table style={{ ...venueExtrasTableStyle, minWidth: "900px" }}>
											<thead>
												<tr>
													<th style={venueExtrasHeadCellStyle}>枠</th>
													<th style={venueExtrasHeadCellStyle}>選手</th>
													<th style={venueExtrasHeadCellStyle}>1節前</th>
													<th style={venueExtrasHeadCellStyle}>2節前</th>
													<th style={venueExtrasHeadCellStyle}>3節前</th>
												</tr>
											</thead>
											<tbody>
												{selectedNarutoRacerPerformance.nationalRecent.map((item) => (
													<tr key={`naruto-national-recent-${item.frameNo}`}>
														<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
														<td style={venueExtrasBodyCellStyle}>
															<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
																<strong>{item.playerName}</strong>
																<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
															</div>
														</td>
														{Array.from({ length: 3 }, (_, index) => {
															const history = item.histories[index];
															return (
																<td key={`naruto-national-recent-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
																	{history ? (
																		<div style={narutoMeetCellStyle}>
																			<span style={narutoMeetLabelStyle}>{history.label}</span>
																			<span style={narutoMeetResultStyle}>{history.results || "-"}</span>
																		</div>
																	) : "-"}
																</td>
															);
														})}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できていません。</p>
								)}
							</section>
							) : null}
						</section>
					) : null}

					{isTokuyamaVenue && hasTokuyamaFramePast10Data ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>徳山枠番別10走</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											{Array.from({ length: 10 }, (_, index) => (
												<th key={`tokuyama-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
											))}
											<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
											<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
											<th style={venueExtrasHeadCellStyle}>スタート順</th>
										</tr>
									</thead>
									<tbody>
										{selectedTokuyamaFramePast10.map((item) => (
											<tr key={`tokuyama-frame10-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
													</div>
												</td>
												{Array.from({ length: 10 }, (_, index) => (
													<td key={`tokuyama-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														<div style={narutoHistoryStackStyle}>
															<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
															<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
															<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span>
														</div>
													</td>
												))}
												<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isAshiyaVenue && hasAshiyaFrameLast10Data ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>芦屋枠番別10走</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											{Array.from({ length: 10 }, (_, index) => (
												<th key={`ashiya-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
											))}
											<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
											<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
											<th style={venueExtrasHeadCellStyle}>スタート順</th>
										</tr>
									</thead>
									<tbody>
										{selectedAshiyaFrameLast10.map((item) => (
											<tr key={`ashiya-frame10-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{item.className || "-"} / {item.registerNo || "-"}
														</span>
													</div>
												</td>
												{Array.from({ length: 10 }, (_, index) => (
													<td key={`ashiya-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														<div style={narutoHistoryStackStyle}>
															<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
															<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
															<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span>
														</div>
													</td>
												))}
												<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameStartOrder || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isKiryuVenue && hasKiryuFrameLast10Data ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>桐生枠番別10走</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											{Array.from({ length: 10 }, (_, index) => (
												<th key={`kiryu-frame10-head-${index}`} style={venueExtrasHeadCellStyle}>{10 - index}走</th>
											))}
											<th style={venueExtrasHeadCellStyle}>枠番勝率</th>
											<th style={venueExtrasHeadCellStyle}>枠番平均ST</th>
										</tr>
									</thead>
									<tbody>
										{selectedKiryuFrameLast10.map((item) => (
											<tr key={`kiryu-frame10-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName || `枠${item.frameNo}`}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
															{item.className || "-"} / {item.registerNo || "-"}
														</span>
													</div>
												</td>
												{Array.from({ length: 10 }, (_, index) => (
													<td key={`kiryu-frame10-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
														<div style={narutoHistoryStackStyle}>
															<span style={narutoHistoryCourseStyle}>{item.courseHistory[index] || " "}</span>
															<span style={narutoHistoryFinishStyle}>{item.finishHistory[index] || "-"}</span>
															<span style={{ fontSize: "0.66rem", color: boatTheme.colors.muted }}>ST {item.startTimingHistory[index] || "-"}</span>
														</div>
													</td>
												))}
												<td style={venueExtrasBodyCellStyle}>{item.frameWinRate || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameAverageStart || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{isKiryuVenue && hasKiryuCourseResultsData ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>桐生進入コース別成績</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1240px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											{Array.from({ length: 6 }, (_, index) => (
												<th key={`kiryu-course-head-${index}`} style={venueExtrasHeadCellStyle}>{index + 1}コース</th>
											))}
										</tr>
									</thead>
									<tbody>
										{Array.from(new Set(selectedKiryuCourseResults.map((item) => item.frameNo))).map((frameNo) => {
											const rows = selectedKiryuCourseResults.filter((item) => item.frameNo === frameNo);
											const first = rows[0];
											return (
												<tr key={`kiryu-course-${frameNo}`}>
													<td style={venueExtrasBodyCellStyle}>{frameNo}</td>
													<td style={venueExtrasBodyCellStyle}>
														<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
															<strong>{first?.playerName || `枠${frameNo}`}</strong>
															<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
																{first?.className || "-"} / {first?.registerNo || "-"}
															</span>
														</div>
													</td>
													{Array.from({ length: 6 }, (_, index) => {
														const course = rows.find((item) => Number(item.course) === index + 1);
														return (
															<td key={`kiryu-course-cell-${frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
																{course ? (
																	<div style={{ display: "grid", gap: "3px", minWidth: "92px", lineHeight: 1.35 }}>
																		<span>進入率 {course.entryRate || "-"}</span>
																		<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>平均ST {course.averageStart || "-"}</span>
																		<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>1/2/3着 {course.firstRate || "-"} / {course.secondRate || "-"} / {course.thirdRate || "-"}</span>
																	</div>
																) : "-"}
															</td>
														);
													})}
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{selectedAbilityIndex.length > 0 && !isNarutoVenue ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>能力指数</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>能力値</th>
											<th style={venueExtrasHeadCellStyle}>枠番適性</th>
											<th style={venueExtrasHeadCellStyle}>ST力</th>
										</tr>
									</thead>
									<tbody>
										{selectedAbilityIndex.map((item) => (
											<tr key={`venue-extra-ability-index-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}号艇</td>
												<td style={venueExtrasBodyCellStyle}>{item.abilityValue || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.frameCompatibility || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.startPower || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "exhibition" ? (
			hasExhibitionPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{hasOriginalExhibitionData ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>会場独自展示</h4>
							{isMikuniVenue && selectedOriginalExhibitionRows[0]?.source ? (
								<p style={venueExtrasTextStyle}>三国オリジナルデータ / {selectedOriginalExhibitionRows[0].source}</p>
							) : null}
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											{(isMikuniVenue || isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? <th style={venueExtrasHeadCellStyle}>選手</th> : null}
											{isMikuniVenue ? <th style={venueExtrasHeadCellStyle}>モーター</th> : null}
											{isMarugameVenue ? <th style={venueExtrasHeadCellStyle}>モーター</th> : null}
											{isAshiyaVenue ? <th style={venueExtrasHeadCellStyle}>モーター</th> : null}
											{isMiyajimaVenue ? <th style={venueExtrasHeadCellStyle}>モーター</th> : null}
											{(isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? <th style={venueExtrasHeadCellStyle}>体重 / 調整</th> : null}
											{(isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? <th style={venueExtrasHeadCellStyle}>チルト</th> : null}
											{(isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? <th style={venueExtrasHeadCellStyle}>展示</th> : null}
											{(!isMiyajimaVenue || hasOriginalOneLapTimeData) ? <th style={venueExtrasHeadCellStyle}>{isMikuniVenue ? "半周" : "一周"}</th> : null}
											{(!isMiyajimaVenue || hasOriginalTurnTimeData) ? <th style={venueExtrasHeadCellStyle}>回り足</th> : null}
											{(!isMiyajimaVenue || hasOriginalStraightTimeData) ? <th style={venueExtrasHeadCellStyle}>直線</th> : null}
											<th style={venueExtrasHeadCellStyle}>{(isMikuniVenue || isMiyajimaVenue) ? "メモ" : "展示評価"}</th>
										</tr>
									</thead>
									<tbody>
										{selectedOriginalExhibitionRows.map((item) => (
											<tr key={`venue-extra-exhibition-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												{(isMikuniVenue || isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? (
													<td style={venueExtrasBodyCellStyle}>
														<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
															<strong>{item.playerName || `枠${item.frameNo}`}</strong>
															{item.className || item.registerNo ? (
															<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
																{item.className || "-"} / {item.registerNo || "-"}
															</span>
														) : null}
														</div>
													</td>
												) : null}
												{isMikuniVenue ? <td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td> : null}
												{isMarugameVenue ? <td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td> : null}
												{isAshiyaVenue ? <td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td> : null}
												{isMiyajimaVenue ? <td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"}</td> : null}
												{(isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? (
													<td style={venueExtrasBodyCellStyle}>{item.weight || "-"} / {item.weightAdjustment || "-"}</td>
												) : null}
												{(isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? <td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td> : null}
												{(isNarutoVenue || isBiwakoVenue || isTsuVenue || isWakamatsuVenue || isFukuokaVenue || isKojimaVenue || isTokuyamaVenue || isMarugameVenue || isTokonameVenue || isAshiyaVenue || isMiyajimaVenue) ? <td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td> : null}
												{(!isMiyajimaVenue || hasOriginalOneLapTimeData) ? <td style={venueExtrasBodyCellStyle}>{item.oneLapTime || "-"}</td> : null}
												{(!isMiyajimaVenue || hasOriginalTurnTimeData) ? <td style={venueExtrasBodyCellStyle}>{item.turnTime || "-"}</td> : null}
												{(!isMiyajimaVenue || hasOriginalStraightTimeData) ? <td style={venueExtrasBodyCellStyle}>{item.straightTime || "-"}</td> : null}
												<td style={venueExtrasBodyCellStyle}>{(isMikuniVenue || isMiyajimaVenue) ? (item.memo || "-") : (item.exhibitionEvaluation || "-")}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : shouldShowOriginalExhibitionWaiting ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>{isMarugameVenue ? "モーター展示特性" : "展示情報"}</h4>
							<p style={venueExtrasEmptyStyle}>
								{isMarugameVenue
									? "この会場は独自タイム集計中のため、モーター展示特性を表示しています。"
									: isMikuniVenue
										? "三国公式の独自展示データは安定取得ページを確認中です。公式直前情報とスタート展示は取得済みです。"
										: "展示情報は準備中です。"}
							</p>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>{isMikuniVenue ? "三国の独自展示は現状 JSON に未収録です。公式ページ未掲載、または未対応ページのため表示待ちです。" : "このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。"}</p>
			)
		) : null}

		{selectedVenueExtraPanel === "motor" ? (
			hasMotorPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{isTamagawaVenue && hasTamagawaMotorHistoryData ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>モーター履歴</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1160px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手/ モーター</th>
											<th style={venueExtrasHeadCellStyle}>2連率</th>
											{Array.from({ length: 6 }, (_, index) => (
												<th key={`tamagawa-motor-head-${index}`} style={venueExtrasHeadCellStyle}>履歴{index + 1}</th>
											))}
										</tr>
									</thead>
									<tbody>
										{selectedTamagawaMotorHistory.map((item) => (
											<tr key={`tamagawa-motor-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>
													<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
														<strong>{item.playerName}</strong>
														<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>モーター {item.motorNo || "-"}</span>
													</div>
												</td>
												<td style={venueExtrasBodyCellStyle}>{item.motorSecondRate || "-"}</td>
												{Array.from({ length: 6 }, (_, index) => {
													const history = item.historyEntries[index];
													return (
														<td key={`tamagawa-motor-cell-${item.frameNo}-${index}`} style={venueExtrasBodyCellStyle}>
															{history ? (
																<div style={{ display: "grid", gap: "3px", minWidth: "90px" }}>
																	<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>{history.label || "-"}</span>
																	<strong>{history.playerName || "-"}</strong>
																	<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>{history.results || "-"}</span>
																</div>
															) : "-"}
														</td>
													);
												})}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{hasSelectedMotorSummaryData || shouldShowMotorSummaryWaiting ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>{isMarugameVenue ? "モーター参考データ" : "モーター概況"}</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedMotorSummaryDisplay.items.map((item) => (
									<article key={`venue-extra-motor-summary-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>{item.displayFrameNo ?? item.frameNo}号艇/ モーター{item.motorNo}</p>
											{item.motorGrade ? <span style={venueExtrasFocusPillStyle}>評価 {item.motorGrade}</span> : null}
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>
											{item.previousUser ? `前使用者: ${item.previousUser}` : "前使用者: "}
											{item.recentResults ? ` / 節間成績: ${item.recentResults}` : ""}
										</p>
										{item.comment ? <p style={venueExtrasCommentStyle}>{item.comment}</p> : null}
									</article>
								))}
								{shouldShowMotorSummaryWaiting ? (
									<p style={venueExtrasEmptyStyle}>{isNarutoVenue ? "一部モーターの詳細は準備中です。" : "モーター詳細は準備中です。"}</p>
								) : null}
							</div>
						</section>
					) : null}

					{isTsuVenue && hasTsuMotorHistoryData ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>津モーター・ボート履歴</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedTsuMotorHistory.map((item) => (
									<article key={`tsu-motor-history-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>{item.frameNo}号艇 / モーター{item.motorNo || "-"}</p>
											{item.motorGrade ? <span style={venueExtrasFocusPillStyle}>出足/伸足 {item.motorGrade}</span> : null}
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{item.playerName || `枠${item.frameNo}`} {item.className ? `/ ${item.className}` : ""} {item.registerNo ? `/ ${item.registerNo}` : ""}</p>
										<p style={venueExtrasRacerCommentTextStyle}>モーター2連率 {item.motorSecondRate || "-"} / 勝率 {item.motorWinRate || "-"} / ボート {item.boatNo || "-"} / ボート2連率 {item.boatSecondRate || "-"} / ボート勝率 {item.boatWinRate || "-"}</p>
										<p style={venueExtrasRacerCommentTextStyle}>前使用者 {item.previousUser || "-"} / 直近成績 {item.recentResults || "-"}</p>
										{item.historyEntries.length > 0 || item.boatHistoryEntries.length > 0 ? (
											<div style={{ display: "grid", gap: "8px" }}>
												{item.historyEntries.slice(0, 3).map((history, index) => (
													<div key={`tsu-motor-history-entry-${item.frameNo}-${index}`} style={{ display: "grid", gap: "2px", paddingTop: "8px", borderTop: `1px solid ${boatTheme.colors.line}` }}>
														<strong style={{ fontSize: "0.76rem", color: boatTheme.colors.ink }}>{history.title || history.dateRange || "モーター履歴"}</strong>
														<span style={{ fontSize: "0.7rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"} / {history.racerName || history.playerName || "-"}</span>
														<span style={{ fontSize: "0.74rem", color: boatTheme.colors.ink }}>{history.results || "-"}</span>
													</div>
												))}
												{item.boatHistoryEntries.slice(0, 2).map((history, index) => (
													<div key={`tsu-boat-history-entry-${item.frameNo}-${index}`} style={{ display: "grid", gap: "2px", paddingTop: "8px", borderTop: `1px solid ${boatTheme.colors.line}` }}>
														<strong style={{ fontSize: "0.76rem", color: boatTheme.colors.ink }}>{history.title || history.dateRange || "ボート履歴"}</strong>
														<span style={{ fontSize: "0.7rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"} / {history.racerName || history.playerName || "-"}</span>
														<span style={{ fontSize: "0.74rem", color: boatTheme.colors.ink }}>{history.results || "-"}</span>
													</div>
												))}
											</div>
										) : null}
									</article>
								))}
							</div>
						</section>
					) : null}

					{isMikuniVenue && selectedMikuniMotorHistory.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>三国モーター履歴</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedMikuniMotorHistory.map((item) => (
									<article key={`mikuni-motor-history-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>{item.frameNo}号艇 / モーター{item.motorNo || "-"}</p>
											{item.motorGrade ? <span style={venueExtrasFocusPillStyle}>{item.motorGrade}</span> : null}
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{item.playerName || `枠${item.frameNo}`} {item.className ? `/ ${item.className}` : ""} {item.registerNo ? `/ ${item.registerNo}` : ""}</p>
										<p style={venueExtrasRacerCommentTextStyle}>2連率 {item.motorSecondRate || "-"} / 勝率 {item.motorWinRate || "-"} / ボート {item.boatNo || "-"} / ボート2連率 {item.boatSecondRate || "-"}</p>
										<p style={venueExtrasRacerCommentTextStyle}>前検 {item.preinspectionTime || "-"} / 前使用者 {item.previousUser || "-"}</p>
										{item.recentResults ? <p style={venueExtrasCommentStyle}>{item.recentResults}</p> : null}
										{item.comment ? <p style={venueExtrasCommentStyle}>{item.comment}</p> : null}
										{item.historyEntries.length > 0 ? (
											<div style={{ display: "grid", gap: "8px" }}>
												{item.historyEntries.slice(0, 4).map((history, index) => (
													<div key={`mikuni-motor-history-entry-${item.frameNo}-${index}`} style={{ display: "grid", gap: "2px", paddingTop: "8px", borderTop: `1px solid ${boatTheme.colors.line}` }}>
														<strong style={{ fontSize: "0.76rem", color: boatTheme.colors.ink }}>{history.title || history.dateRange || "履歴"}</strong>
														<span style={{ fontSize: "0.7rem", color: boatTheme.colors.muted }}>{history.dateRange || "-"} / {history.racerName || "-"}</span>
														<span style={{ fontSize: "0.74rem", color: boatTheme.colors.ink }}>{history.results || "-"}</span>
													</div>
												))}
											</div>
										) : null}
									</article>
								))}
							</div>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "water" ? (
			hasWaterPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{hasVenuePredictionFocus && selectedVenuePrediction ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>公式予想観点</h4>
							<div style={venueExtrasStatusGridStyle}>
								<article style={venueExtrasStatusCardStyle}>
									<p style={venueExtrasStatusLabelStyle}>信頼度</p>
									<p style={venueExtrasStatusValueStyle}>{selectedVenuePrediction.confidence || "-"}</p>
								</article>
								<article style={venueExtrasStatusCardStyle}>
									<p style={venueExtrasStatusLabelStyle}>フォーカス数</p>
									<p style={venueExtrasStatusValueStyle}>{selectedVenuePrediction.mainFocus.length}点</p>
								</article>
							</div>
							{selectedVenuePrediction.mainFocus.length > 0 ? (
								<div style={venueExtrasFocusListStyle}>
									{selectedVenuePrediction.mainFocus.map((focus) => (
										<span key={`venue-extra-focus-${focus}`} style={venueExtrasFocusPillStyle}>{focus}</span>
									))}
								</div>
							) : null}
							{selectedVenuePrediction.comment ? <p style={venueExtrasCommentStyle}>{selectedVenuePrediction.comment}</p> : null}
						</section>
					) : shouldShowVenuePredictionWaiting ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>公式予想観点</h4>
							<p style={venueExtrasEmptyStyle}>公式予想観点は未取得待ちです。</p>
						</section>
					) : null}

					{selectedRacerComments.length > 0 ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>選手コメント</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedRacerComments.map((item) => (
									<article key={`venue-extra-racer-comment-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>{item.frameNo}号艇</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{item.comment}</p>
									</article>
								))}
							</div>
						</section>
					) : null}

					{selectedWaterMemo || selectedOfficialWeatherCondition ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>{isMarugameVenue ? "水面特性" : "水面・潮メモ"}</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedOfficialWeatherCondition ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>公式水面気象</p>
											{getOfficialWeatherSourceLabel(selectedOfficialWeatherCondition) ? <span style={venueExtrasFocusPillStyle}>{getOfficialWeatherSourceLabel(selectedOfficialWeatherCondition)}</span> : null}
										</div>
										{buildOfficialWeatherSummary(selectedOfficialWeatherCondition, "primary") ? <p style={venueExtrasRacerCommentTextStyle}>{buildOfficialWeatherSummary(selectedOfficialWeatherCondition, "primary")}</p> : null}
										{buildOfficialWeatherSummary(selectedOfficialWeatherCondition, "secondary") ? <p style={venueExtrasCommentStyle}>{buildOfficialWeatherSummary(selectedOfficialWeatherCondition, "secondary")}</p> : null}
									</article>
								) : null}
								{selectedWaterMemo?.tideInfo ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>潮汐</p>
											{selectedWaterMemo.tideInfo.tideType ? <span style={venueExtrasFocusPillStyle}>{selectedWaterMemo.tideInfo.tideType}</span> : null}
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>
											{selectedWaterMemo.tideInfo.date || "-"}
											{selectedWaterMemo.tideInfo.dayLabel ? ` / ${selectedWaterMemo.tideInfo.dayLabel}` : ""}
											{selectedWaterMemo.tideInfo.highTideTime ? ` / 満潮 ${selectedWaterMemo.tideInfo.highTideTime}` : ""}
											{selectedWaterMemo.tideInfo.lowTideTime ? ` / 干潮 ${selectedWaterMemo.tideInfo.lowTideTime}` : ""}
										</p>
									</article>
								) : null}
								{selectedWaterMemo?.waterSurfaceInfo?.surfaceSummary ? (
									isMikuniVenue && selectedMikuniWaterSurfaceDisplay ? (
										<>
											{selectedMikuniWaterSurfaceDisplay.waterType || selectedMikuniWaterSurfaceDisplay.flowStatus || selectedMikuniWaterSurfaceDisplay.tiltRange ? (
												<article style={venueExtrasRacerCommentCardStyle}>
													<div style={venueExtrasRacerCommentHeaderStyle}>
														<p style={venueExtrasRacerCommentFrameStyle}>水面要約</p>
													</div>
													<p style={venueExtrasRacerCommentTextStyle}>水質 {selectedMikuniWaterSurfaceDisplay.waterType || "-"} / 流れ・水位変化 {selectedMikuniWaterSurfaceDisplay.flowStatus || "-"} / チルト角度 {selectedMikuniWaterSurfaceDisplay.tiltRange || "-"}</p>
												</article>
											) : null}
											{selectedMikuniWaterSurfaceDisplay.surfaceFeature ? (
												<article style={venueExtrasRacerCommentCardStyle}>
													<div style={venueExtrasRacerCommentHeaderStyle}>
														<p style={venueExtrasRacerCommentFrameStyle}>特徴</p>
													</div>
													<p style={venueExtrasRacerCommentTextStyle}>{selectedMikuniWaterSurfaceDisplay.surfaceFeature}</p>
												</article>
											) : null}
											{selectedMikuniWaterSurfaceDisplay.raceFeature ? (
												<article style={venueExtrasRacerCommentCardStyle}>
													<div style={venueExtrasRacerCommentHeaderStyle}>
														<p style={venueExtrasRacerCommentFrameStyle}>レースの特徴</p>
													</div>
													<p style={venueExtrasRacerCommentTextStyle}>{selectedMikuniWaterSurfaceDisplay.raceFeature}</p>
												</article>
											) : null}
											{selectedMikuniWaterSurfaceDisplay.metricsNote ? (
												<article style={venueExtrasRacerCommentCardStyle}>
													<div style={venueExtrasRacerCommentHeaderStyle}>
														<p style={venueExtrasRacerCommentFrameStyle}>数値メモ</p>
													</div>
													<p style={venueExtrasRacerCommentTextStyle}>{selectedMikuniWaterSurfaceDisplay.metricsNote}</p>
													{selectedMikuniWaterSurfaceDisplay.courseNote ? <p style={venueExtrasCommentStyle}>{selectedMikuniWaterSurfaceDisplay.courseNote}</p> : null}
												</article>
											) : null}
										</>
									) : (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>水面要約</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{selectedWaterMemo.waterSurfaceInfo.surfaceSummary}</p>
									</article>
									)
								) : null}
								{selectedWaterMemo?.waterSurfaceInfo?.featureSummary && !(isMikuniVenue && selectedMikuniWaterSurfaceDisplay) ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>特徴</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{selectedWaterMemo.waterSurfaceInfo.featureSummary}</p>
									</article>
								) : null}
								{selectedWaterMemo?.waterSurfaceInfo?.courseSummary && !(isMikuniVenue && selectedMikuniWaterSurfaceDisplay) ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>コース別傾向</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{selectedWaterMemo.waterSurfaceInfo.courseSummary}</p>
									</article>
								) : null}
							</div>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>{isMikuniVenue ? "三国の水面情報はまだ整っていません。公式水面ページ更新後に再取得される場合があります。" : "このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。"}</p>
			)
		) : null}

		{!hasOfficialPanelData && !hasSelectedVenueExtrasDetail && !hasStartPanelData && !hasRecordsPanelData && !hasExhibitionPanelData && !hasMotorPanelData && !hasWaterPanelData ? (
			<p style={venueExtrasEmptyStyle}>{venueExtrasDisplayText}</p>
		) : null}
							</section>
						}
					/>
				</div>
			</div>
		</PageShell>
	);
}
