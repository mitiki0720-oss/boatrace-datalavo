import { useEffect, useMemo, useState } from "react";
import { BoatRaceDetailPanel } from "../components/boatrace/BoatRaceDetailPanel";
import { BoatRaceQuickSelector } from "../components/boatrace/BoatRaceQuickSelector";
import { BoatVenueSelectorPanel } from "../components/boatrace/BoatVenueSelectorPanel";
import { BoatVenueSpotlight } from "../components/boatrace/BoatVenueSpotlight";
import { SectionCard } from "../components/common/SectionCard";
import { PageShell } from "../components/layout/PageShell";
import { sampleBoatTodayFeed } from "../data/sampleBoatTodayFeed";
import type { BoatOddsPreviewGroup, BoatRacerItem } from "../lib/boatraceTypes";
import { loadBoatTodayRaceDetailsFeed } from "../lib/boatDataFeed";
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

const venueActionGroupStyle = {
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: "12px",
	flexWrap: "wrap" as const,
};

const refreshButtonStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: "8px",
	padding: "11px 18px",
	borderRadius: "999px",
	border: `1px solid rgba(93, 199, 232, 0.2)`,
	background: "rgba(255, 255, 255, 0.98)",
	color: boatTheme.colors.navy,
	fontSize: "0.86rem",
	fontWeight: 700,
	boxShadow: "0 10px 22px rgba(17, 64, 92, 0.08)",
	cursor: "pointer",
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
	padding: "26px",
	borderRadius: "32px",
	background:
		"linear-gradient(135deg, rgba(249, 254, 255, 0.99), rgba(235, 249, 247, 0.97) 56%, rgba(226, 244, 250, 0.96))",
	border: "1px solid rgba(93, 199, 232, 0.25)",
	boxShadow: "0 26px 64px rgba(17, 64, 92, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
	display: "grid",
	gap: "20px",
	overflow: "hidden" as const,
};

const venueExtrasHeaderStyle = {
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: "14px",
	flexWrap: "wrap" as const,
};

const venueExtrasTitleWrapStyle = {
	display: "grid",
	gap: "5px",
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
	fontSize: "1.08rem",
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
	padding: "8px 12px",
	borderRadius: "999px",
	background: "rgba(255, 255, 255, 0.94)",
	border: `1px solid ${boatTheme.colors.line}`,
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.76rem",
	fontWeight: 900,
	whiteSpace: "nowrap" as const,
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
	paddingBottom: "4px",
	marginInline: "-4px",
	paddingInline: "4px",
	WebkitOverflowScrolling: "touch" as const,
};

const venueExtrasPanelSelectorGridStyle = {
	display: "grid",
	gridAutoFlow: "column" as const,
	gridAutoColumns: "minmax(168px, 1fr)",
	gap: "10px",
	minWidth: "max-content",
};

const venueExtrasPanelButtonBaseStyle = {
	display: "grid",
	gap: "7px",
	padding: "14px 15px",
	borderRadius: "18px",
	border: `1px solid ${boatTheme.colors.line}`,
	background: "rgba(255, 255, 255, 0.94)",
	boxShadow: "0 10px 24px rgba(17, 64, 92, 0.05)",
	textAlign: "left" as const,
	cursor: "pointer",
	transition: "background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease",
	minHeight: "84px",
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
	fontSize: "0.73rem",
	lineHeight: 1.45,
	color: boatTheme.colors.muted,
};

const venueExtrasPanelButtonBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "fit-content",
	padding: "4px 9px",
	borderRadius: "999px",
	fontSize: "0.68rem",
	fontWeight: 900,
	letterSpacing: "0.04em",
	background: "rgba(235, 246, 253, 0.95)",
	color: boatTheme.colors.aquaDeep,
	border: "1px solid rgba(93, 199, 232, 0.16)",
};

const venueExtrasCategoryCaptionStyle = {
	margin: 0,
	fontSize: "0.76rem",
	lineHeight: 1.5,
	color: boatTheme.colors.muted,
};

const narutoStatsTabWrapStyle = {
	display: "grid",
	gap: "10px",
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
	padding: "13px 14px",
	borderRadius: "18px",
	background: "rgba(255, 255, 255, 0.92)",
	border: `1px solid ${boatTheme.colors.line}`,
	display: "grid",
	gap: "4px",
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

const venueExtrasEmptyStyle = {
	margin: 0,
	padding: "15px 16px",
	borderRadius: "18px",
	background: "rgba(247, 252, 255, 0.94)",
	border: `1px dashed rgba(93, 199, 232, 0.35)`,
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
	padding: "20px",
	borderRadius: "26px",
	background: "linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 253, 255, 0.94))",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	boxShadow: "0 14px 32px rgba(17, 64, 92, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.86)",
	display: "grid",
	gap: "15px",
};

const venueExtrasPanelTitleStyle = {
	margin: 0,
	fontSize: "0.95rem",
	fontWeight: 900,
	color: boatTheme.colors.navy,
};

const venueExtrasTableWrapStyle = {
	overflowX: "auto" as const,
	borderRadius: "20px",
	border: "1px solid rgba(93, 199, 232, 0.22)",
	background: "rgba(255, 255, 255, 0.98)",
	boxShadow: "0 10px 26px rgba(17, 64, 92, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
};

const venueExtrasTableStyle = {
	width: "100%",
	minWidth: "520px",
	borderCollapse: "collapse" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.84rem",
};

const venueExtrasHeadCellStyle = {
	padding: "11px 12px",
	background: "linear-gradient(180deg, rgba(225, 243, 250, 0.98), rgba(214, 236, 246, 0.92))",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	textAlign: "left" as const,
	whiteSpace: "nowrap" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.76rem",
	fontWeight: 900,
};

const venueExtrasBodyCellStyle = {
	padding: "11px 12px",
	borderBottom: `1px solid ${boatTheme.colors.line}`,
	whiteSpace: "nowrap" as const,
	color: boatTheme.colors.navy,
	fontSize: "0.82rem",
	fontWeight: 800,
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
	fontSize: "0.84rem",
	lineHeight: 1.65,
	color: boatTheme.colors.navy,
	fontWeight: 800,
};

const narutoFramePalette: Record<number, { background: string; color: string; border: string }> = {
	1: { background: "#f8fbff", color: "#16324a", border: "rgba(22, 50, 74, 0.18)" },
	2: { background: "#1f2733", color: "#ffffff", border: "rgba(31, 39, 51, 0.28)" },
	3: { background: "#df4747", color: "#ffffff", border: "rgba(183, 52, 52, 0.32)" },
	4: { background: "#2d6be5", color: "#ffffff", border: "rgba(45, 107, 229, 0.28)" },
	5: { background: "#f1cf46", color: "#3f3100", border: "rgba(206, 171, 33, 0.3)" },
	6: { background: "#2aa45d", color: "#ffffff", border: "rgba(42, 164, 93, 0.3)" },
};

const narutoStartScrollStyle = {
	overflowX: "auto" as const,
	paddingBottom: "4px",
};

const narutoStartBoardStyle = {
	minWidth: "860px",
	display: "grid",
	gap: "12px",
	padding: "14px",
	borderRadius: "22px",
	background: "linear-gradient(180deg, rgba(239, 248, 252, 0.98), rgba(226, 243, 248, 0.94))",
	border: `1px solid ${boatTheme.colors.line}`,
	boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78)",
};

const narutoStartRowStyle = {
	display: "grid",
	gridTemplateColumns: "minmax(250px, 280px) minmax(420px, 1fr)",
	gap: "14px",
	alignItems: "center",
	padding: "12px 14px",
	borderRadius: "18px",
	background: "rgba(255, 255, 255, 0.88)",
	border: `1px solid ${boatTheme.colors.line}`,
};

const narutoStartMetaStyle = {
	display: "grid",
	gap: "8px",
	alignContent: "center",
};

const narutoStartMetaTopStyle = {
	display: "flex",
	alignItems: "center",
	gap: "8px",
	flexWrap: "wrap" as const,
};

const narutoStartCourseBadgeStyle = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "4px 9px",
	borderRadius: "999px",
	background: "rgba(221, 239, 247, 0.95)",
	color: boatTheme.colors.aquaDeep,
	fontSize: "0.7rem",
	fontWeight: 900,
	letterSpacing: "0.04em",
	whiteSpace: "nowrap" as const,
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

const raceHeroImageSrc = "/races-page/races-hero-boat-team.png";

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

type VenueExtraPanelKey =
	| "official"
	| "start"
	| "records"
	| "exhibition"
	| "motor"
	| "water"
	| "tamagawa-overview"
	| "tamagawa-diagnosis"
	| "tamagawa-series"
	| "tamagawa-cyokuzen"
	| "tamagawa-frame10"
	| "tamagawa-score"
	| "omura-overview"
	| "omura-prevday"
	| "omura-national"
	| "omura-last10"
	| "omura-comments"
	| "omura-exhibition"
	| "tamagawa-odds"
	| "tamagawa-entry";

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

type BoatOfficialBeforeInfoExhibitionRow = {
	frameNo: number;
	playerName: string;
	exhibitionTime: string;
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
	source?: string | undefined;
};

type BoatOfficialBeforeInfoDisplay = {
	status: string;
	source: string;
	exhibitionRows: BoatOfficialBeforeInfoExhibitionRow[];
	startExhibition: BoatOfficialBeforeInfoStartRow[];
	scoreQuickLook: BoatOfficialBeforeInfoScoreRow[];
};

async function loadBoatVenueExtrasFeed(): Promise<BoatVenueExtrasFeed | null> {
	try {
		const response = await fetch(`/data/boatrace/venue-extras.generated.json?ts=${Date.now()}`, {
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

function isVenueExtraRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPresent<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

function readVenueExtraString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function readVenueExtraNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
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

function getOfficialStartTimingValue(startTiming: string): string {
	const normalized = startTiming.trim();
	return normalized.replace(/^[FL]/i, "") || "-";
}

function getOfficialStartFlag(startTiming: string): string {
	const normalized = startTiming.trim().toUpperCase();
	if (normalized.startsWith("F")) {
		return "F";
	}

	if (normalized.startsWith("L")) {
		return "L";
	}

	return "-";
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
			playerName: readVenueExtraString(item.playerName) || undefined,
			registerNo: readVenueExtraString(item.registerNo) || undefined,
			weight: readVenueExtraString(item.weight) || undefined,
			weightAdjustment: readVenueExtraString(item.weightAdjustment) || undefined,
			tilt: readVenueExtraString(item.tilt) || undefined,
			exhibitionTime: readVenueExtraString(item.exhibitionTime) || undefined,
			motorNo: readVenueExtraString(item.motorNo),
			oneLapTime: readVenueExtraString(item.oneLapTime),
			turnTime: readVenueExtraString(item.turnTime),
			straightTime: readVenueExtraString(item.straightTime),
			exhibitionEvaluation: readVenueExtraString(item.exhibitionEvaluation),
			memo: readVenueExtraString(item.memo),
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

	for (const item of raceExtra.startExhibition) {
		if (!isVenueExtraRecord(item)) {
			continue;
		}

		const course = readVenueExtraNumber(item.course);
		const frameNo = readVenueExtraNumber(item.frameNo);
		const currentAverageStart = readVenueExtraString(item.currentAverageStart);
		const style = readVenueExtraString(item.style);
		const startTiming = readVenueExtraString(item.startTiming);
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
	桐生: {
		summary: "淡水で干満差がないぶん、水面の変化より足色の比較を先に見たい会場です。インの押し切りと、外のまくり差し気配を並べて確認したいです。",
		imageSrc: "/races-page/venue-spotlights/kiryu-spotlight.png",
		imageAlt: "桐生の会場イメージ",
	},
	戸田: {
		summary: "淡水で干満差がなく、展示の気配差を素直に比べやすい会場です。内枠の安定感を土台にしつつ、差し筋があるかを先に見たいです。",
		imageSrc: "/races-page/venue-spotlights/toda-spotlight.png",
		imageAlt: "戸田の会場イメージ",
	},
	江戸川: {
		summary: "汽水で干満差ありの水面なので、まず水面状況そのものを優先したい会場です。足色だけで決めず、風と潮の影響まで重ねて見たいです。",
		imageSrc: "/races-page/venue-spotlights/edogawa-spotlight.png",
		imageAlt: "江戸川の会場イメージ",
	},
	平和島: {
		summary: "海水で干満差ありのぶん、水面の荒れ方と展示足をセットで見たい会場です。内の信頼度だけでなく、差し・まくり差しの届き方も先に確認したいです。",
		imageSrc: "/races-page/venue-spotlights/heiwajima-spotlight.png",
		imageAlt: "平和島の会場イメージ",
	},
	多摩川: {
		summary: "淡水で干満差がなく、まず舟足の良し悪しを丁寧に見たい会場です。内枠の安定感を軸にしつつ、展示で上向いた艇を拾いたいです。",
		imageSrc: "/races-page/venue-spotlights/tamagawa-spotlight.png",
		imageAlt: "多摩川の会場イメージ",
	},
	浜名湖: {
		summary: "海水で干満差ありなので、水面の影響と展示気配を一緒に見たい会場です。内外の力差より、直前の乗り味が変わっていないかを確認したいです。",
		imageSrc: "/races-page/venue-spotlights/hamanako-spotlight.png",
		imageAlt: "浜名湖の会場イメージ",
	},
	蒲郡: {
		summary: "海水で干満差ありのナイター水面なので、時間帯ごとの気配変化を見たい会場です。展示足の上積みがある艇を、人気より先に拾いたいです。",
		imageSrc: "/races-page/venue-spotlights/gamagori-spotlight.png",
		imageAlt: "蒲郡の会場イメージ",
	},
	常滑: {
		summary: "海水で干満差ありの水面なので、水面状況とコース取りを重ねて見たい会場です。内を信じ切る前に、センター勢の伸びも比べたいです。",
		imageSrc: "/races-page/venue-spotlights/tokoname-spotlight.png",
		imageAlt: "常滑の会場イメージ",
	},
	津: {
		summary: "海水で干満差ありですが、まずは展示気配を素直に比べたい会場です。内枠の押し切りを本線にしつつ、差し筋の有無も先に見たいです。",
		imageSrc: "/races-page/venue-spotlights/tsu-spotlight.png",
		imageAlt: "津の会場イメージ",
	},
	三国: {
		summary: "海水で干満差ありのモーニング水面なので、朝の風と水面の軽さを見たい会場です。内優勢を土台にしつつ、展示の伸び差を優先したいです。",
		imageSrc: "/races-page/venue-spotlights/mikuni-spotlight.png",
		imageAlt: "三国の会場イメージ",
	},
	びわこ: {
		summary: "淡水で干満差がなく、展示足の差を見比べやすい会場です。内枠の安定感を意識しつつ、出足寄りの艇がどこまで残せるか見たいです。",
		imageSrc: "/races-page/venue-spotlights/biwako-spotlight.png",
		imageAlt: "びわこの会場イメージ",
	},
	住之江: {
		summary: "淡水で干満差がなく、まずは舟足と展示気配の比較を優先したい会場です。ナイターらしい時間帯変化も踏まえて、インの信頼度を見極めたいです。",
		imageSrc: "/races-page/venue-spotlights/suminoe-spotlight.png",
		imageAlt: "住之江の会場イメージ",
	},
	尼崎: {
		summary: "汽水で干満差ありのぶん、水面状況を軽視せずに入りたい会場です。展示の出足と回り足を見て、差しが届くかを先に確認したいです。",
		imageSrc: "/races-page/venue-spotlights/amagasaki-spotlight.png",
		imageAlt: "尼崎の会場イメージ",
	},
	鳴門: {
		summary: "海水で干満差ありなので、潮と風の影響を前提に見たい会場です。展示足だけで決めず、枠なりが崩れそうかも一緒に確認したいです。",
		imageSrc: "/races-page/venue-spotlights/naruto-spotlight.png",
		imageAlt: "鳴門の会場イメージ",
	},
	丸亀: {
		summary: "海水で干満差ありのナイター水面なので、時間帯での気配変化を意識したい会場です。内を軸にしつつ、外のまくり差し気配を丁寧に見たいです。",
		imageSrc: "/races-page/venue-spotlights/marugame-spotlight.png",
		imageAlt: "丸亀の会場イメージ",
	},
	児島: {
		summary: "海水で干満差ありの水面なので、潮位と風を踏まえて見たい会場です。内枠の強さだけでなく、展示で上向いた艇の差し脚も確認したいです。",
		imageSrc: "/races-page/venue-spotlights/kojima-spotlight.png",
		imageAlt: "児島の会場イメージ",
	},
	宮島: {
		summary: "海水で干満差ありの水面なので、水面状況の確認を優先したい会場です。イン有利に見える番組でも、直前気配が変わっていないか見たいです。",
		imageSrc: "/races-page/venue-spotlights/miyajima-spotlight.png",
		imageAlt: "宮島の会場イメージ",
	},
	徳山: {
		summary: "海水で干満差ありのモーニング水面なので、朝の風と展示足を先に見たい会場です。内の安定感を軸にしつつ、センターの伸び差も確認したいです。",
		imageSrc: "/races-page/venue-spotlights/tokuyama-spotlight.png",
		imageAlt: "徳山の会場イメージ",
	},
	下関: {
		summary: "海水で干満差ありのぶん、水面変化を軽視せずに見たい会場です。展示の回り足と差し気配を見て、内を崩せる艇がいるか確認したいです。",
		imageSrc: "/races-page/venue-spotlights/shimonoseki-spotlight.png",
		imageAlt: "下関の会場イメージ",
	},
	若松: {
		summary: "海水で干満差ありのナイター水面なので、時間帯ごとの気配差を見たい会場です。インの押し切りと外の攻め脚を、展示で丁寧に比べたいです。",
		imageSrc: "/races-page/venue-spotlights/wakamatsu-spotlight.png",
		imageAlt: "若松の会場イメージ",
	},
	芦屋: {
		summary: "海水で干満差ありのモーニング水面なので、まずは風向と波を先に見たい会場です。展示足を土台にしつつ、センター勢の攻め筋も確認したいです。",
		imageSrc: "/races-page/venue-spotlights/ashiya-spotlight.png",
		imageAlt: "芦屋の会場イメージ",
	},
	福岡: {
		summary: "海水で干満差ありの都市型水面なので、水面状況と足色を一緒に見たい会場です。人気のインをそのまま信じる前に、差し筋の有無を確認したいです。",
		imageSrc: "/races-page/venue-spotlights/fukuoka-spotlight.png",
		imageAlt: "福岡の会場イメージ",
	},
	唐津: {
		summary: "海水で干満差ありのモーニング水面なので、朝の水面の軽さを見ながら入りたい会場です。内枠中心で考えつつ、展示で伸びた艇を先に拾いたいです。",
		imageSrc: "/races-page/venue-spotlights/karatsu-spotlight.png",
		imageAlt: "唐津の会場イメージ",
	},
	大村: {
		summary: "海水で干満差ありの水面ですが、まずは内の安定感を基準に見たい会場です。ホーム寄りの強さを踏まえつつ、外の仕掛けが届く気配も確認したいです。",
		imageSrc: "/races-page/venue-spotlights/omura-spotlight.png",
		imageAlt: "大村の会場イメージ",
	},
};

export function RacesPage() {
	const [todayFeed, setTodayFeed] = useState(sampleBoatTodayFeed);
	const [dataUpdatedAt, setDataUpdatedAt] = useState("");
	const [venueExtrasFeed, setVenueExtrasFeed] = useState<BoatVenueExtrasFeed | null>(null);
	const [isRefreshingFeed, setIsRefreshingFeed] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [selectedVenueExtraPanel, setSelectedVenueExtraPanel] = useState<VenueExtraPanelKey>("official");
	const [selectedNarutoStatsTab, setSelectedNarutoStatsTab] = useState<NarutoStatsTab>("score");
	const initialVenue = todayFeed.venues[0];
	const initialRace = initialVenue ? getFirstSelectableRace(initialVenue.races) : undefined;
	const [selectedVenueId, setSelectedVenueId] = useState<string>(initialVenue?.id ?? "");
	const [selectedRaceId, setSelectedRaceId] = useState<string>(getRaceKey(initialVenue?.id ?? "", initialRace?.raceId, initialRace?.raceNo ?? 0));

	const refreshTodayFeed = async (options?: { silent?: boolean; cancelled?: () => boolean }) => {
		if (!options?.silent) {
			setIsRefreshingFeed(true);
			setRefreshMessage("画面表示用の JSON を再読み込み中です...");
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
		const firstVenue = todayFeed.venues[0];
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
	}, [todayFeed, selectedVenueId, selectedRaceId]);

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
				summary: "水面状況や風向に注意したい会場です。",
				imageSrc: undefined,
				imageAlt: undefined,
			};
		}

		return venueSpotlightCopy[selectedVenue.venueName] ?? {
			summary: "直前気配と展示足を優先して見たい会場です。",
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

	return `Venue extras: ${updatedAt} / ${venueCount} venues`;
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

const selectedStartExhibition = useMemo(
	() => getVenueStartExhibition(selectedRaceExtra),
	[selectedRaceExtra],
);

const selectedWaterMemo = useMemo(
	() => getVenueWaterMemo(selectedRaceExtra, selectedVenueExtra),
	[selectedRaceExtra, selectedVenueExtra],
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
			.map((row) => [row.playerName.replace(/\s+/g, ""), row.frameNo] as const)
			.filter(([playerName]) => Boolean(playerName)),
	);

	const playerNameByFrameNo = new Map(
		selectedTamagawaBeforeInfo.map((row) => [row.frameNo, row.playerName] as const),
	);

	return selectedStartExhibition
		.map((row) => {
			const normalizedPlayerName = (row.playerName || "").replace(/\s+/g, "");
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

const isNarutoVenue = selectedVenue?.venueName === "鳴門";
const isTamagawaVenue = selectedVenue?.venueName === "多摩川";
const isOmuraVenue = selectedVenue?.venueName === "大村";
const isMarugameVenue = selectedVenue?.venueName === "丸亀";
const hasOmuraEntryData = selectedOmuraEntryTable.length > 0;
const hasOmuraPreviousDayData = selectedOmuraPreviousDayResults.some((row) => row.items.length > 0);
const hasOmuraNationalFrameStatsData = selectedOmuraNationalFrameStats.length > 0;
const hasOmuraFrameLast10Data = selectedOmuraFrameLast10.length > 0;
const hasOmuraCommentsMotorData = selectedOmuraRacerCommentsMotor.length > 0;
const hasOmuraExhibitionData = omuraExhibitionInfoDisplay.length >= 6;
const hasTamagawaEntryData = selectedTamagawaEntryTable.length > 0;

// 多摩川は公式HP由来の出走表が取れている場合、メイン出走表にも必ずそちらを使う。
// 旧判定の「人数が足りない時だけ fallback」だと、6人分はあるが中身が薄いレースで空欄表示になるため。
const shouldUseTamagawaOfficialEntry = isTamagawaVenue && hasTamagawaEntryData;

// Venue Official Extras 内の「公式出走表 補助表示」は重複表示になるので出さない。
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

const selectedRaceDisplayRacers = shouldUseTamagawaOfficialEntry ? tamagawaFallbackRacers : (selectedRace?.racers ?? []);
const selectedRaceForDetail = useMemo(() => {
	if (!selectedRace) {
		return selectedRace;
	}

	return {
		...selectedRace,
		racers: selectedRaceDisplayRacers,
	};
}, [selectedRace, selectedRaceDisplayRacers]);
const hasTamagawaBeforeInfoData = selectedTamagawaBeforeInfo.length > 0;
const hasTamagawaMotorHistoryData = selectedTamagawaMotorHistory.length > 0;
const hasTamagawaSeriesResultsData = selectedTamagawaSeriesResults.length > 0;
const hasTamagawaFramePast10Data = selectedTamagawaFramePast10.length > 0;
const hasTamagawaScoreRateGuideData = selectedTamagawaScoreRateGuide.length > 0;
const hasTamagawaOddsResultData = Boolean(selectedTamagawaOddsResult);
const hasOfficialBeforeInfoDetail = Boolean(
	selectedOfficialBeforeInfo && (
		selectedOfficialBeforeInfo.exhibitionRows.length > 0 ||
		selectedOfficialBeforeInfo.startExhibition.length > 0 ||
		selectedOfficialBeforeInfo.scoreQuickLook.length > 0
	),
);
const shouldShowOfficialBeforeInfoWaiting = Boolean(selectedOfficialBeforeInfo && !hasOfficialBeforeInfoDetail);
const hasOriginalExhibitionData = selectedOriginalExhibitionRows.length > 0;
const hasStartExhibitionData = selectedStartExhibition.length > 0;
const hasVenuePredictionFocus = Boolean(selectedVenuePrediction && selectedVenuePrediction.mainFocus.length > 0);
const shouldShowOriginalExhibitionWaiting = Boolean(selectedRaceExtra && !hasOriginalExhibitionData);
const shouldShowVenuePredictionWaiting = Boolean(hasVenuePredictionRecord && !hasVenuePredictionFocus);
const hasSelectedMotorSummaryData = selectedMotorSummaryDisplay.items.length > 0;
const shouldShowMotorSummaryWaiting = selectedMotorSummaryDisplay.isAwaitingMatch;
const hasNarutoPerformanceData = Boolean(
	selectedNarutoRacerPerformance && (
		selectedNarutoRacerPerformance.byFramePast10.length > 0 ||
		selectedNarutoRacerPerformance.narutoRecent.length > 0 ||
		selectedNarutoRacerPerformance.nationalRecent.length > 0
	),
);
const shouldShowNarutoPerformanceWaiting = Boolean(isNarutoVenue && selectedRaceExtra && !hasNarutoPerformanceData);

const hasOfficialPanelData = hasOfficialBeforeInfoDetail || shouldShowOfficialBeforeInfoWaiting;
const hasStartPanelData = Boolean(
	(selectedOfficialBeforeInfo && selectedOfficialBeforeInfo.startExhibition.length > 0) ||
	hasStartExhibitionData,
);
const hasRecordsPanelData = Boolean(
	(selectedOfficialBeforeInfo && selectedOfficialBeforeInfo.scoreQuickLook.length > 0) ||
	hasNarutoPerformanceData ||
	selectedAbilityIndex.length > 0,
);
const hasExhibitionPanelData = hasOriginalExhibitionData || shouldShowOriginalExhibitionWaiting;
const hasMotorPanelData = hasSelectedMotorSummaryData || shouldShowMotorSummaryWaiting || hasTamagawaMotorHistoryData;
const hasWaterPanelData = Boolean(
	hasVenuePredictionFocus ||
	shouldShowVenuePredictionWaiting ||
	selectedRacerComments.length > 0 ||
	selectedWaterMemo,
);
const tamagawaScoreRows = selectedTamagawaScoreRateGuide.length
	? selectedTamagawaScoreRateGuide
	: selectedOfficialBeforeInfo?.scoreQuickLook ?? [];

const hasSelectedVenueExtrasDetail =
	hasOriginalExhibitionData ||
	selectedRacerComments.length > 0 ||
	hasStartExhibitionData ||
	hasSelectedMotorSummaryData ||
	hasNarutoPerformanceData ||
	hasOmuraEntryData ||
	hasOmuraPreviousDayData ||
	hasOmuraNationalFrameStatsData ||
	hasOmuraFrameLast10Data ||
	hasOmuraCommentsMotorData ||
	hasOmuraExhibitionData ||
	hasTamagawaEntryData ||
	hasTamagawaBeforeInfoData ||
	hasTamagawaMotorHistoryData ||
	hasTamagawaSeriesResultsData ||
	hasTamagawaFramePast10Data ||
	hasTamagawaScoreRateGuideData ||
	hasTamagawaOddsResultData ||
	shouldShowOriginalExhibitionWaiting ||
	shouldShowVenuePredictionWaiting ||
	shouldShowMotorSummaryWaiting ||
	shouldShowNarutoPerformanceWaiting ||
	selectedAbilityIndex.length > 0 ||
	Boolean(selectedWaterMemo);

const preferredVenueExtraPanel = useMemo<VenueExtraPanelKey>(() => {
	if (isOmuraVenue) {
		if (hasOmuraCommentsMotorData) {
			return "omura-comments";
		}

		if (hasOmuraExhibitionData) {
			return "omura-exhibition";
		}

		if (hasOmuraFrameLast10Data) {
			return "omura-last10";
		}

		if (hasOmuraNationalFrameStatsData) {
			return "omura-national";
		}

		if (hasOmuraPreviousDayData) {
			return "omura-prevday";
		}

		return "omura-overview";
	}

	if (isTamagawaVenue) {
		if (hasTamagawaBeforeInfoData) {
			return "tamagawa-cyokuzen";
		}

		if (hasStartPanelData) {
			return "start";
		}

		if (hasOriginalExhibitionData) {
			return "exhibition";
		}

		if (hasTamagawaMotorHistoryData) {
			return "motor";
		}

		if (selectedAbilityIndex.length > 0) {
			return "tamagawa-diagnosis";
		}

		if (hasTamagawaSeriesResultsData) {
			return "tamagawa-series";
		}

		if (hasTamagawaFramePast10Data) {
			return "tamagawa-frame10";
		}

		if (hasTamagawaScoreRateGuideData || selectedOfficialBeforeInfo?.scoreQuickLook.length) {
			return "tamagawa-score";
		}

		return "tamagawa-overview";
	}

	if (hasOfficialPanelData) {
		return "official";
	}

	if (hasExhibitionPanelData) {
		return "exhibition";
	}

	if (hasStartPanelData) {
		return "start";
	}

	if (hasRecordsPanelData) {
		return "records";
	}

	if (hasMotorPanelData) {
		return "motor";
	}

	if (hasWaterPanelData) {
		return "water";
	}

	return "official";
}, [
	isOmuraVenue,
	hasOmuraCommentsMotorData,
	hasOmuraExhibitionData,
	hasOmuraFrameLast10Data,
	hasOmuraNationalFrameStatsData,
	hasOmuraPreviousDayData,
	isTamagawaVenue,
	hasTamagawaBeforeInfoData,
	hasTamagawaMotorHistoryData,
	hasTamagawaSeriesResultsData,
	hasTamagawaFramePast10Data,
	hasTamagawaScoreRateGuideData,
	hasTamagawaOddsResultData,
	hasTamagawaEntryData,
	selectedOfficialBeforeInfo,
	selectedAbilityIndex.length,
	hasOfficialPanelData,
	hasExhibitionPanelData,
	hasStartPanelData,
	hasRecordsPanelData,
	hasMotorPanelData,
	hasWaterPanelData,
]);

useEffect(() => {
	setSelectedVenueExtraPanel(isOmuraVenue ? "omura-overview" : isTamagawaVenue ? "tamagawa-overview" : preferredVenueExtraPanel);
}, [selectedVenueId, isOmuraVenue, isTamagawaVenue, preferredVenueExtraPanel]);

useEffect(() => {
	setSelectedNarutoStatsTab("score");
}, [selectedVenueId]);

const venueExtraPanelOptions = useMemo(
	() => isOmuraVenue ? [
		{ key: "omura-overview", label: "全体", hint: "大村公式データの取得状況", badge: hasSelectedVenueExtrasDetail ? "全体" : "待ち" },
		{ key: "omura-prevday", label: "前日", hint: "前日成績を確認", badge: hasOmuraPreviousDayData ? "前日" : "待ち" },
		{ key: "omura-national", label: "全国枠", hint: "全国枠番別成績を確認", badge: hasOmuraNationalFrameStatsData ? "全国枠" : "待ち" },
		{ key: "omura-last10", label: "10走", hint: "枠番別過去10走データ", badge: hasOmuraFrameLast10Data ? "10走" : "待ち" },
		{ key: "omura-comments", label: "コメント・モーター", hint: "選手コメントとモーター評価", badge: hasOmuraCommentsMotorData ? "コメント" : "待ち" },
		{ key: "omura-exhibition", label: "展示情報", hint: "大村公式の展示情報を確認", badge: hasOmuraExhibitionData ? "展示" : "待ち" },
	] as Array<{ key: VenueExtraPanelKey; label: string; hint: string; badge: string }> : isTamagawaVenue ? [
		{ key: "tamagawa-overview", label: "全体", hint: "多摩川公式タブの全体像", badge: hasSelectedVenueExtrasDetail ? "全体" : "待ち" },
		{ key: "motor", label: "モーター", hint: "モーター履歴を確認", badge: hasTamagawaMotorHistoryData ? "機歴" : "待ち" },
		{ key: "tamagawa-diagnosis", label: "診断", hint: "能力指数を確認", badge: selectedAbilityIndex.length > 0 ? "指数" : "待ち" },
		{ key: "tamagawa-series", label: "節間", hint: "節間成績を確認", badge: hasTamagawaSeriesResultsData ? "節間" : "待ち" },
		{ key: "tamagawa-cyokuzen", label: "直前", hint: "体重・調整・部品交換", badge: hasTamagawaBeforeInfoData ? "直前" : "待ち" },
		{ key: "start", label: "ST", hint: "スタート展示を確認", badge: hasStartPanelData ? "ST" : "待ち" },
		{ key: "exhibition", label: "展示", hint: "オリジナル展示データ", badge: hasOriginalExhibitionData ? "展示" : "待ち" },
		{ key: "tamagawa-frame10", label: "枠番過去10走", hint: "枠別の直近10走", badge: hasTamagawaFramePast10Data ? "10走" : "待ち" },
		{ key: "tamagawa-score", label: "得点率", hint: "得点率早見", badge: hasTamagawaScoreRateGuideData || selectedOfficialBeforeInfo?.scoreQuickLook.length ? "得点" : "待ち" },
	] as Array<{ key: VenueExtraPanelKey; label: string; hint: string; badge: string }> : [
		{ key: "official", label: "公式直前", hint: "展示タイムと公式の直前基礎情報", badge: hasOfficialPanelData ? "公式" : "待ち" },
		{ key: "start", label: "スタート展示", hint: "公式STと進入・展示STを確認", badge: hasStartPanelData ? "ST" : "待ち" },
		{ key: "records", label: "成績・勝率", hint: "得点率早見と鳴門の成績系", badge: hasRecordsPanelData ? "成績" : "待ち" },
		{ key: "exhibition", label: "会場独自展示", hint: "一周・回り足・直線の比較", badge: hasExhibitionPanelData ? "展示" : "待ち" },
		{ key: "motor", label: "モーター", hint: "機歴やモーター総括を確認", badge: hasMotorPanelData ? "機力" : "待ち" },
		{ key: "water", label: "水面・コメント", hint: "潮汐・水面傾向・コメント", badge: hasWaterPanelData ? "水面" : "待ち" },
	] as Array<{ key: VenueExtraPanelKey; label: string; hint: string; badge: string }>,
	[
		isOmuraVenue,
		isTamagawaVenue,
		hasOmuraPreviousDayData,
		hasOmuraNationalFrameStatsData,
		hasOmuraFrameLast10Data,
		hasOmuraCommentsMotorData,
		hasOmuraExhibitionData,
		hasSelectedVenueExtrasDetail,
		hasTamagawaMotorHistoryData,
		selectedAbilityIndex.length,
		hasTamagawaSeriesResultsData,
		hasTamagawaBeforeInfoData,
		hasTamagawaFramePast10Data,
		hasTamagawaScoreRateGuideData,
		hasTamagawaOddsResultData,
		hasTamagawaEntryData,
		selectedOfficialBeforeInfo,
		hasOfficialPanelData,
		hasStartPanelData,
		hasRecordsPanelData,
		hasExhibitionPanelData,
		hasMotorPanelData,
		hasWaterPanelData,
	],
);

const narutoStatsTabOptions = useMemo(
	() => [
		{ key: "score", label: "公式得点率", hint: "全国・当地・モーター2連率" },
		{ key: "frameHistory", label: "枠番別10走", hint: "枠別の過去10走と平均ST" },
		{ key: "narutoRecent", label: "鳴門近況", hint: "鳴門での直近3節を確認" },
		{ key: "nationalRecent", label: "全国近況", hint: "全国の直近3節を確認" },
	] as Array<{ key: NarutoStatsTab; label: string; hint: string }>,
	[],
);

const venueExtrasDisplayText = useMemo(() => {
	if (!venueExtrasFeed) {
		return "会場独自データと BOATRACE公式直前データはまだ読み込まれていません。上の「画面データを再読み込み」を押すと JSON の再取得を確認できます。";
	}

	if ((venueExtrasFeed.venues?.length ?? 0) === 0) {
		return "BOATRACE公式直前データの受け皿は準備済みです。会場独自データは対応会場分だけ追加表示されます。";
	}

	if (!selectedVenueExtra) {
		return "この会場の追加データはまだ取得していません。BOATRACE公式直前データまたは会場独自データが揃うと、ここに表示されます。";
	}

	if (!selectedRaceExtra) {
		return "この会場の追加データは見つかりましたが、選択中レースのデータはまだありません。";
	}

	if (hasOfficialBeforeInfoDetail && hasSelectedVenueExtrasDetail) {
		return "BOATRACE公式の直前データと会場独自データを表示できます。展示・ST・得点率早見と会場メモをあわせて確認できます。";
	}

	if (hasOfficialBeforeInfoDetail) {
		return "BOATRACE公式の直前データを表示できます。会場独自データは対応会場分のみ追加されます。";
	}

	if (hasSelectedVenueExtrasDetail) {
		return "会場独自データを表示できます。BOATRACE公式の直前データは更新待ちです。";
	}

	return "選択中レースの追加データは更新待ちです。";
}, [venueExtrasFeed, selectedVenueExtra, selectedRaceExtra, hasOfficialBeforeInfoDetail, hasSelectedVenueExtrasDetail]);

	const dataDateWarnings = useMemo(() => {
		const warnings: string[] = [];
		const todayDate = todayFeed.date?.trim() || "";
		const venueDate = venueExtrasFeed?.date?.trim() || "";
		const jstToday = getJstTodayDate();

		if (todayDate && venueDate && todayDate !== venueDate) {
			warnings.push(`データ日付が一致していません。開催一覧: ${todayDate} / 直前情報: ${venueDate}。更新スクリプトの実行状況を確認してください。`);
		}

		if (todayDate && todayDate !== jstToday) {
			warnings.push(`開催一覧データが今日ではありません。today.generated.json の date は ${todayDate} です。`);
		}

		if (venueDate && venueDate !== jstToday) {
			warnings.push(`直前情報データが今日ではありません。venue-extras.generated.json の date は ${venueDate} です。`);
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
			<div style={pageContentStyle}>
<section style={heroShellStyle}>
  <div style={heroInnerStyle}>
    <div style={heroImageAreaStyle}>
      <img
        src={raceHeroImageSrc}
        alt="ボートレース場を背景にしたキャラクタービジュアル"
        style={heroImageStyle}
      />
    </div>

    <div style={heroTextAreaStyle}>
      <span style={heroEyebrowStyle}>Today Races</span>
      <h2 style={heroTitleStyle}>今日のレース</h2>
      <p style={heroDescriptionStyle}>
        会場とレースを素早く選び、天候・オッズ・結果まで一気に確認できる流れに整理しています。
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
		<button
			type="button"
			style={{
				...refreshButtonStyle,
				opacity: isRefreshingFeed ? 0.7 : 1,
				cursor: isRefreshingFeed ? "wait" : "pointer",
			}}
			disabled={isRefreshingFeed}
			onClick={() => {
				void refreshTodayFeed();
			}}
		>
			<span aria-hidden="true">🔄</span>
			画面データを再読み込み
		</button>

		{dataUpdatedAt ? (
			<p style={{ ...updatedChipStyle, margin: 0 }}>
				Data updated: {dataUpdatedAt}
			</p>
		) : null}

		{venueExtrasStatusText ? (
	        <p style={{ ...updatedChipStyle, margin: 0 }}>
		        {venueExtrasStatusText}
	        </p>
        ) : null}
	</div>

	<p style={{ margin: 0, fontSize: "0.78rem", lineHeight: 1.6, color: boatTheme.colors.muted, textAlign: "right" as const }}>
		この操作は画面用 JSON の再取得です。元データを今日分へ更新するには Node スクリプトの実行が必要です。
	</p>

	{refreshMessage && refreshMessageStyle ? (
		<p
			style={{
				margin: 0,
				padding: "10px 13px",
				borderRadius: "14px",
				fontSize: "0.8rem",
				fontWeight: 700,
				lineHeight: 1.55,
				...refreshMessageStyle,
			}}
		>
			{refreshMessage}
		</p>
	) : null}
</div>

				<div style={openSectionStyle}>
					<BoatVenueSelectorPanel
						venues={todayFeed.venues}
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
						venueWeatherActual={selectedVenue?.weatherActual}
						race={selectedRaceForDetail}
						entryNote={shouldUseTamagawaOfficialEntry ? "多摩川公式HP由来の出走表をメイン表示しています。" : undefined}
						
						afterEntryContent={
							<section style={venueExtrasSectionStyle}>
		<div style={venueExtrasHeaderStyle}>
			<div style={venueExtrasTitleWrapStyle}>
				<p style={venueExtrasLabelStyle}>Venue Official Extras</p>
				<h3 style={venueExtrasTitleStyle}>🏟️ BOATRACE公式 直前データ / 会場独自データ</h3>
				<p style={venueExtrasTextStyle}>
					BOATRACE公式の直前情報と、唐津・鳴門・丸亀など会場公式HPの独自データを別枠で整理しています。
				</p>
			</div>

			<span style={venueExtrasBadgeStyle}>
				{selectedVenue?.venueName ?? "会場未選択"} / {selectedRace?.raceNo ? `${selectedRace.raceNo}R` : "R未選択"}
			</span>
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
		</div>

		<div style={venueExtrasPanelSelectorWrapStyle}>
			<div style={venueExtrasPanelSelectorScrollStyle}>
				<div style={venueExtrasPanelSelectorGridStyle}>
					{venueExtraPanelOptions.map((option) => {
						const isActive = selectedVenueExtraPanel === option.key;

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
								<span
									style={{
										...venueExtrasPanelButtonBadgeStyle,
										background: isActive ? "rgba(255, 255, 255, 0.14)" : venueExtrasPanelButtonBadgeStyle.background,
										color: isActive ? "#f4fbff" : venueExtrasPanelButtonBadgeStyle.color,
										border: isActive ? "1px solid rgba(255, 255, 255, 0.18)" : venueExtrasPanelButtonBadgeStyle.border,
									}}
								>
									{option.badge}
								</span>
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
							</button>
						);
					})}
				</div>
			</div>
			<p style={venueExtrasCategoryCaptionStyle}>選択中のカテゴリだけ表示します。スマホでは横にスクロールして切り替えできます。</p>
		</div>

		{isOmuraVenue && selectedVenueExtraPanel === "omura-overview" ? (
			<div style={venueExtrasDataGridStyle}>
				<section style={venueExtrasPanelStyle}>
					<h4 style={venueExtrasPanelTitleStyle}>🧭 大村公式タブの全体像</h4>
					<div style={venueExtrasStatusGridStyle}>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>前日成績</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraPreviousDayData ? "取得あり" : "取得なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>全国枠番別成績</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraNationalFrameStatsData ? "取得あり" : "取得なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>枠番別過去10走</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraFrameLast10Data ? "取得あり" : "取得なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>コメント・モーター</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraCommentsMotorData ? "取得あり" : "取得なし"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>展示情報</p>
							<p style={venueExtrasStatusValueStyle}>{hasOmuraExhibitionData ? "取得あり" : "取得なし"}</p>
						</article>
					</div>
					<p style={venueExtrasEmptyStyle}>大村は 出走表 / 前日 / 全国枠 / 10走 / コメント・モーター / 展示情報 を race 単位で保持しています。オッズ・結果・リプレイは重複するためここでは出していません。</p>
				</section>

				{hasOmuraEntryData ? (
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>🚤 出走表サマリー</h4>
						<p style={venueExtrasEmptyStyle}>既存の上部出走表と重複しない範囲で、F/L・事故率・独自評価だけを要約表示しています。</p>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1020px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別 / 登番</th>
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
						<h4 style={venueExtrasPanelTitleStyle}>📚 前日成績</h4>
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
																<span>R {race.raceNo || "-"} / 進 {race.course || "-"}</span>
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
				<p style={venueExtrasEmptyStyle}>大村公式の前日成績は更新待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-national" ? (
			hasOmuraNationalFrameStatsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>🌐 全国枠番別成績</h4>
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
				<p style={venueExtrasEmptyStyle}>大村公式の全国枠番別成績は更新待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-last10" ? (
			hasOmuraFrameLast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📚 枠番別過去10走データ</h4>
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
				<p style={venueExtrasEmptyStyle}>大村公式の枠番別過去10走データは更新待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-comments" ? (
			hasOmuraCommentsMotorData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>💬 選手コメント / モーター評価</h4>
						<div style={venueExtrasCommentListStyle}>
							{omuraCommentsMotorDisplay.map((item) => (
								<article key={`omura-comment-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
									<div style={venueExtrasRacerCommentHeaderStyle}>
										<p style={venueExtrasRacerCommentFrameStyle}>{item.frameNo}号艇 / {item.playerName}</p>
										<span style={venueExtrasFocusPillStyle}>M {item.motorEvaluation || "-"} / {item.motorNo || "-"}号機</span>
									</div>
									<p style={venueExtrasRacerCommentTextStyle}>{item.comment || "コメントは更新待ちです。"}</p>
								</article>
							))}
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>大村公式の選手コメント / モーター評価は更新待ちです。</p>
			)
		) : null}

		{isOmuraVenue && selectedVenueExtraPanel === "omura-exhibition" ? (
			hasOmuraExhibitionData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>🚤 展示情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1180px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>進入</th>
										<th style={venueExtrasHeadCellStyle}>名前</th>
										<th style={venueExtrasHeadCellStyle}>ST</th>
										<th style={venueExtrasHeadCellStyle}>展示T</th>
										<th style={venueExtrasHeadCellStyle}>一周</th>
										<th style={venueExtrasHeadCellStyle}>回り足</th>
										<th style={venueExtrasHeadCellStyle}>直線</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>部品交換</th>
										<th style={venueExtrasHeadCellStyle}>スタート</th>
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
				<p style={venueExtrasEmptyStyle}>展示情報はまだ取得できていません。展示航走後に更新される可能性があります。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-overview" ? (
			<div style={venueExtrasDataGridStyle}>
				<section style={venueExtrasPanelStyle}>
					<h4 style={venueExtrasPanelTitleStyle}>🧭 多摩川公式タブの全体像</h4>
					<div style={venueExtrasStatusGridStyle}>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>直前情報</p>
							<p style={venueExtrasStatusValueStyle}>{hasTamagawaBeforeInfoData ? `${selectedTamagawaBeforeInfo.length}艇` : "更新待ち"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>スタート展示</p>
							<p style={venueExtrasStatusValueStyle}>{tamagawaStartExhibitionDisplay.length ? `${tamagawaStartExhibitionDisplay.length}艇` : "更新待ち"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>オリジナル展示</p>
							<p style={venueExtrasStatusValueStyle}>{hasOriginalExhibitionData ? `${selectedOriginalExhibitionRows.length}艇` : "更新待ち"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>モーター履歴</p>
							<p style={venueExtrasStatusValueStyle}>{hasTamagawaMotorHistoryData ? `${selectedTamagawaMotorHistory.length}艇` : "更新待ち"}</p>
						</article>
						<article style={venueExtrasStatusCardStyle}>
							<p style={venueExtrasStatusLabelStyle}>節間 / 枠番別10走</p>
							<p style={venueExtrasStatusValueStyle}>{hasTamagawaSeriesResultsData || hasTamagawaFramePast10Data ? "表示可" : "更新待ち"}</p>
						</article>
					</div>
					<p style={venueExtrasEmptyStyle}>多摩川公式の優先タブを上から順に切り替えて確認できます。まずは 直前 / ST / 展示 を見る構成です。</p>
				</section>

				{hasTamagawaBeforeInfoData ? (
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📝 直前情報サマリー</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>体重 / 調整</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走成績</th>
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

				{shouldShowTamagawaEntryFallback ? (
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>🚤 公式出走表 補助表示</h4>
						<p style={venueExtrasEmptyStyle}>
							メインの出走表データが空のため、多摩川公式HP由来の出走表を補助表示しています。
						</p>

						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1180px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>級別 / 登番</th>
										<th style={venueExtrasHeadCellStyle}>F/L</th>
										<th style={venueExtrasHeadCellStyle}>平均ST</th>
										<th style={venueExtrasHeadCellStyle}>全国勝率</th>
										<th style={venueExtrasHeadCellStyle}>全国2連率</th>
										<th style={venueExtrasHeadCellStyle}>当地勝率</th>
										<th style={venueExtrasHeadCellStyle}>当地2連率</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
										<th style={venueExtrasHeadCellStyle}>ボート</th>
									</tr>
								</thead>
								<tbody>
									{selectedTamagawaEntryTable.map((item) => (
										<tr key={`tamagawa-entry-fallback-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.className || "-"} / {item.registerNo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.fl || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.averageStart || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.nationalWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.nationalSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localWinRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.localSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.boatNo || "-"} / {item.boatSecondRate || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				) : null}
			</div>
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-cyokuzen" ? (
			hasTamagawaBeforeInfoData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📝 直前情報</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={{ ...venueExtrasTableStyle, minWidth: "1120px" }}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>選手</th>
										<th style={venueExtrasHeadCellStyle}>体重</th>
										<th style={venueExtrasHeadCellStyle}>調整</th>
										<th style={venueExtrasHeadCellStyle}>モーター</th>
										<th style={venueExtrasHeadCellStyle}>チルト</th>
										<th style={venueExtrasHeadCellStyle}>前走成績</th>
										<th style={venueExtrasHeadCellStyle}>部品交換</th>
									</tr>
								</thead>
								<tbody>
									{selectedTamagawaBeforeInfo.map((item) => (
										<tr key={`tamagawa-cyokuzen-${item.frameNo}`}>
											<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
											<td style={venueExtrasBodyCellStyle}>
												<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
													<strong>{item.playerName}</strong>
													<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>{item.className || "-"} / {item.registerNo || "-"}</span>
												</div>
											</td>
											<td style={venueExtrasBodyCellStyle}>{item.weight || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.weightAdjustment || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.motorNo || "-"} / {item.motorSecondRate || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.previousRaceInfo || "-"}</td>
											<td style={venueExtrasBodyCellStyle}>{item.partsExchange || "-"}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</section>
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>多摩川公式の直前情報は更新待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-diagnosis" ? (
			selectedAbilityIndex.length > 0 ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📊 診断指数</h4>
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>能力値</th>
										<th style={venueExtrasHeadCellStyle}>枠番相性</th>
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
				<p style={venueExtrasEmptyStyle}>多摩川公式の診断指数は更新待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-series" ? (
			hasTamagawaSeriesResultsData ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📚 節間成績</h4>
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
														<span style={{ fontSize: "0.69rem", color: boatTheme.colors.muted }}>進 {item.courses[index] || "-"}</span>
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
				<p style={venueExtrasEmptyStyle}>多摩川公式の節間成績は更新待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-frame10" ? (
			hasTamagawaFramePast10Data ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📚 枠番別 過去10走</h4>
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
				<p style={venueExtrasEmptyStyle}>多摩川公式の枠番別 過去10走は更新待ちです。</p>
			)
		) : null}

		{isTamagawaVenue && selectedVenueExtraPanel === "tamagawa-score" ? (
			tamagawaScoreRows.length > 0 ? (
				<div style={venueExtrasDataGridStyle}>
					<section style={venueExtrasPanelStyle}>
						<h4 style={venueExtrasPanelTitleStyle}>📈 得点率早見</h4>
						{selectedTamagawaScoreRateGuide.length === 0 ? <p style={venueExtrasEmptyStyle}>多摩川公式の得点率早見は更新待ちのため、BOATRACE公式の早見を代替表示しています。</p> : null}
						<div style={venueExtrasTableWrapStyle}>
							<table style={venueExtrasTableStyle}>
								<thead>
									<tr>
										<th style={venueExtrasHeadCellStyle}>枠</th>
										<th style={venueExtrasHeadCellStyle}>登番</th>
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
				<p style={venueExtrasEmptyStyle}>多摩川公式の得点率早見はまだ更新されていません。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "official" ? (
			hasOfficialPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{selectedOfficialBeforeInfo?.exhibitionRows.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>🚤 公式展示タイム</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手</th>
											<th style={venueExtrasHeadCellStyle}>チルト</th>
											<th style={venueExtrasHeadCellStyle}>展示タイム</th>
										</tr>
									</thead>
									<tbody>
										{selectedOfficialBeforeInfo.exhibitionRows.map((item) => (
											<tr key={`official-beforeinfo-exhibition-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												<td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : null}

					{!hasOfficialBeforeInfoDetail ? (
						<p style={venueExtrasEmptyStyle}>BOATRACE公式 直前データは更新待ちです。</p>
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
							<h4 style={venueExtrasPanelTitleStyle}>🚦 公式スタート展示</h4>

							{isNarutoVenue ? (
								<div style={narutoStartScrollStyle}>
									<div style={narutoStartBoardStyle}>
										{narutoStartExhibitionDisplay.map((item) => {
											const frameTone = narutoFramePalette[item.frameNo] ?? narutoFramePalette[1];
											const startFlag = getOfficialStartFlag(item.startTiming);
											const isFlaggedStart = startFlag !== "-";

											return (
												<div key={`official-beforeinfo-start-visual-${item.course}-${item.frameNo}`} style={narutoStartRowStyle}>
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
															<span>スタート順 {item.startOrder ?? "-"}</span>
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
															<div style={narutoStartLineStyle} />
															<div style={narutoStartLineLabelStyle}>
																<span>START LINE</span>
																<span>0.00</span>
															</div>
															<p style={narutoStartTrackHintStyle}>遅い ←</p>
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
															</span>
														</div>
														<div style={{ ...narutoStartMetaDetailStyle, justifyContent: "flex-end" as const, textAlign: "right" as const }}>
															<span>今回ST {item.startTiming || "-"}</span>
															<span>今節平均ST {item.currentAverageStart || "-"}</span>
															<span>スタート順 {item.startOrder ?? "-"}</span>
														</div>
													</div>
												</div>
											);
										})}
									</div>
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
							<h4 style={venueExtrasPanelTitleStyle}>🚦 スタート展示</h4>
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
															<span>スタート順 {item.startOrder ?? "-"}</span>
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
															<p style={narutoStartTrackHintStyle}>遅い ←</p>
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
											{isTamagawaVenue ? <th style={venueExtrasHeadCellStyle}>選手</th> : null}
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
												{isTamagawaVenue ? <td style={venueExtrasBodyCellStyle}>{item.playerName || "-"}</td> : null}
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

		{selectedVenueExtraPanel === "records" ? (
			hasRecordsPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{!isNarutoVenue && selectedOfficialBeforeInfo?.scoreQuickLook.length ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>📈 公式得点率早見</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>登番</th>
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
								<h4 style={venueExtrasPanelTitleStyle}>📘 成績・脚勢</h4>
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
								<h4 style={venueExtrasPanelTitleStyle}>📈 公式得点率早見</h4>
								{selectedOfficialBeforeInfo?.scoreQuickLook.length ? (
									<div style={venueExtrasTableWrapStyle}>
										<table style={venueExtrasTableStyle}>
											<thead>
												<tr>
													<th style={venueExtrasHeadCellStyle}>枠</th>
													<th style={venueExtrasHeadCellStyle}>登番</th>
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
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できません。</p>
								)}
							</section>
							) : null}

							{selectedNarutoStatsTab === "frameHistory" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>📚 枠番別 過去10走成績</h4>
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
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できません。</p>
								)}
							</section>
							) : null}

							{selectedNarutoStatsTab === "narutoRecent" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>🗂️ 鳴門近況成績</h4>
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
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できません。</p>
								)}
							</section>
							) : null}

							{selectedNarutoStatsTab === "nationalRecent" ? (
							<section style={venueExtrasPanelStyle}>
								<h4 style={venueExtrasPanelTitleStyle}>🌐 全国近況成績</h4>
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
									<p style={venueExtrasEmptyStyle}>この成績データはまだ取得できません。</p>
								)}
							</section>
							) : null}
						</section>
					) : null}

					{selectedAbilityIndex.length > 0 ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>📊 能力指数</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>能力値</th>
											<th style={venueExtrasHeadCellStyle}>枠番相性</th>
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
							<h4 style={venueExtrasPanelTitleStyle}>🚤 会場独自展示</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={venueExtrasTableStyle}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											{isNarutoVenue ? <th style={venueExtrasHeadCellStyle}>選手</th> : null}
											{isNarutoVenue ? <th style={venueExtrasHeadCellStyle}>体重 / 調整</th> : null}
											{isNarutoVenue ? <th style={venueExtrasHeadCellStyle}>チルト</th> : null}
											{isNarutoVenue ? <th style={venueExtrasHeadCellStyle}>展示</th> : null}
											<th style={venueExtrasHeadCellStyle}>一周</th>
											<th style={venueExtrasHeadCellStyle}>回り足</th>
											<th style={venueExtrasHeadCellStyle}>直線</th>
											<th style={venueExtrasHeadCellStyle}>展示評価</th>
										</tr>
									</thead>
									<tbody>
										{selectedOriginalExhibitionRows.map((item) => (
											<tr key={`venue-extra-exhibition-${item.frameNo}`}>
												<td style={venueExtrasBodyCellStyle}>{item.frameNo}</td>
												{isNarutoVenue ? (
													<td style={venueExtrasBodyCellStyle}>
														<div style={{ display: "grid", gap: "4px", lineHeight: 1.35 }}>
															<strong>{item.playerName || `枠${item.frameNo}`}</strong>
															<span style={{ fontSize: "0.72rem", color: boatTheme.colors.muted }}>
																{item.className || "-"} / {item.registerNo || "-"}
															</span>
														</div>
													</td>
												) : null}
												{isNarutoVenue ? (
													<td style={venueExtrasBodyCellStyle}>{item.weight || "-"} / {item.weightAdjustment || "-"}</td>
												) : null}
												{isNarutoVenue ? <td style={venueExtrasBodyCellStyle}>{item.tilt || "-"}</td> : null}
												{isNarutoVenue ? <td style={venueExtrasBodyCellStyle}>{item.exhibitionTime || "-"}</td> : null}
												<td style={venueExtrasBodyCellStyle}>{item.oneLapTime || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.turnTime || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.straightTime || "-"}</td>
												<td style={venueExtrasBodyCellStyle}>{item.exhibitionEvaluation || "-"}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</section>
					) : shouldShowOriginalExhibitionWaiting ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>{isMarugameVenue ? "🧭 モーター補助データ・水面特性" : "🚤 会場独自展示"}</h4>
							<p style={venueExtrasEmptyStyle}>
								{isMarugameVenue
									? "この会場は展示タイム中心ではなく、モーター補助データ・水面特性を中心に表示しています。直前展示はまだ未取得です。"
									: "展示公開待ちです。直前展示はまだ未取得です。"}
							</p>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。</p>
			)
		) : null}

		{selectedVenueExtraPanel === "motor" ? (
			hasMotorPanelData ? (
				<div style={venueExtrasDataGridStyle}>
					{isTamagawaVenue && hasTamagawaMotorHistoryData ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>⚙️ モーター履歴</h4>
							<div style={venueExtrasTableWrapStyle}>
								<table style={{ ...venueExtrasTableStyle, minWidth: "1160px" }}>
									<thead>
										<tr>
											<th style={venueExtrasHeadCellStyle}>枠</th>
											<th style={venueExtrasHeadCellStyle}>選手 / モーター</th>
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
							<h4 style={venueExtrasPanelTitleStyle}>{isMarugameVenue ? "⚙️ モーター補助データ" : "⚙️ モーター総括"}</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedMotorSummaryDisplay.items.map((item) => (
									<article key={`venue-extra-motor-summary-${item.frameNo}`} style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>{item.displayFrameNo ?? item.frameNo}号艇 / モーター{item.motorNo}</p>
											{item.motorGrade ? <span style={venueExtrasFocusPillStyle}>素性 {item.motorGrade}</span> : null}
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>
											{item.previousUser ? `前回使用：${item.previousUser}` : "前回使用：-"}
											{item.recentResults ? ` / 節間成績：${item.recentResults}` : ""}
										</p>
										{item.comment ? <p style={venueExtrasCommentStyle}>{item.comment}</p> : null}
									</article>
								))}
								{shouldShowMotorSummaryWaiting ? (
									<p style={venueExtrasEmptyStyle}>{isNarutoVenue ? "一部モーター番号の照合待ちです。照合できたものから表示しています。" : "モーター詳細は照合待ちです。"}</p>
								) : null}
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
							<h4 style={venueExtrasPanelTitleStyle}>📝 公式直前予想</h4>
							<div style={venueExtrasStatusGridStyle}>
								<article style={venueExtrasStatusCardStyle}>
									<p style={venueExtrasStatusLabelStyle}>自信度</p>
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
							<h4 style={venueExtrasPanelTitleStyle}>📝 公式直前予想</h4>
							<p style={venueExtrasEmptyStyle}>公式直前予想は更新待ちです。</p>
						</section>
					) : null}

					{selectedRacerComments.length > 0 ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>💬 選手コメント</h4>
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

					{selectedWaterMemo ? (
						<section style={venueExtrasPanelStyle}>
							<h4 style={venueExtrasPanelTitleStyle}>{isMarugameVenue ? "🌊 水面特性" : "🌊 水面・潮メモ"}</h4>
							<div style={venueExtrasCommentListStyle}>
								{selectedWaterMemo.tideInfo ? (
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
								{selectedWaterMemo.waterSurfaceInfo?.surfaceSummary ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>水面概要</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{selectedWaterMemo.waterSurfaceInfo.surfaceSummary}</p>
									</article>
								) : null}
								{selectedWaterMemo.waterSurfaceInfo?.featureSummary ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>特徴</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{selectedWaterMemo.waterSurfaceInfo.featureSummary}</p>
									</article>
								) : null}
								{selectedWaterMemo.waterSurfaceInfo?.courseSummary ? (
									<article style={venueExtrasRacerCommentCardStyle}>
										<div style={venueExtrasRacerCommentHeaderStyle}>
											<p style={venueExtrasRacerCommentFrameStyle}>コース傾向</p>
										</div>
										<p style={venueExtrasRacerCommentTextStyle}>{selectedWaterMemo.waterSurfaceInfo.courseSummary}</p>
									</article>
								) : null}
							</div>
						</section>
					) : null}
				</div>
			) : (
				<p style={venueExtrasEmptyStyle}>このカテゴリのデータはまだ取得できていません。展示公開後、または対象会場の公式データ更新後に表示される可能性があります。</p>
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
