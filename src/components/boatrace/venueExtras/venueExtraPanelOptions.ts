import { VENUE_EXTRA_LABELS } from "./venueExtraLabels";
import type { VenueExtraPanelOption, VenueExtraVenueFlags } from "./venueExtraTypes";

export type BuildVenueExtraPanelOptionsInput = VenueExtraVenueFlags & {
	hasSelectedVenueExtrasDetail: boolean;
	hasOmuraPreviousDayData: boolean;
	hasOmuraNationalFrameStatsData: boolean;
	hasOmuraFrameLast10Data: boolean;
	hasOmuraCommentsMotorData: boolean;
	hasOmuraExhibitionData: boolean;
	hasBiwakoFramePast10Data: boolean;
	hasBiwakoSeriesResultsData: boolean;
	hasTsuBeforeInfoData: boolean;
	hasTsuRacerCommentsData: boolean;
	hasTsuSeriesResultsData: boolean;
	hasTsuNationalRecent3Data: boolean;
	hasTsuLocalRecent3Data: boolean;
	hasTsuFramePast10Data: boolean;
	hasTsuScoreRateGuideData: boolean;
	hasWakamatsuEntryData: boolean;
	hasWakamatsuBeforeInfoData: boolean;
	hasWakamatsuSeriesResultsData: boolean;
	hasWakamatsuCourseStatsData: boolean;
	hasWakamatsuNationalRecent3Data: boolean;
	hasWakamatsuLocalRecent3Data: boolean;
	hasWakamatsuFramePast10Data: boolean;
	hasWakamatsuScoreRateGuideData: boolean;
	hasWakamatsuMotorHistoryData: boolean;
	hasFukuokaEntryData: boolean;
	hasFukuokaBeforeInfoData: boolean;
	hasFukuokaMotorEvaluationData: boolean;
	hasFukuokaSeriesResultsData: boolean;
	hasFukuokaRacerCommentsData: boolean;
	hasFukuokaFramePast10Data: boolean;
	hasFukuokaScoreRateGuideData: boolean;
	hasKojimaBeforeInfoData: boolean;
	hasKojimaSeriesResultsData: boolean;
	hasKojimaRecentResultsData: boolean;
	hasKojimaCourseStatsData: boolean;
	hasKojimaMotorStatsData: boolean;
	hasKojimaFrameStatsData: boolean;
	hasKojimaScoreRateGuideData: boolean;
	hasTamagawaMotorHistoryData: boolean;
	hasTamagawaSeriesResultsData: boolean;
	hasTamagawaBeforeInfoData: boolean;
	hasTamagawaFramePast10Data: boolean;
	hasTamagawaScoreRateGuideData: boolean;
	hasTamagawaEntryData: boolean;
	hasOfficialPanelData: boolean;
	hasStartPanelData: boolean;
	hasRecordsPanelData: boolean;
	hasExhibitionPanelData: boolean;
	hasMotorPanelData: boolean;
	hasWaterPanelData: boolean;
	officialScoreRowsCount: number;
	abilityIndexCount: number;
};

export function buildVenueExtraPanelOptions(input: BuildVenueExtraPanelOptionsInput): VenueExtraPanelOption[] {
	const text = VENUE_EXTRA_LABELS;
	const hasOfficialScoreRows = input.officialScoreRowsCount > 0;
	const hasAbilityIndex = input.abilityIndexCount > 0;

	if (input.isKaratsuVenue) {
		return [
			{ key: "official", label: text.labels.official, hint: text.hints.official, badge: input.hasOfficialPanelData ? text.labels.officialShort : text.waiting },
			{ key: "exhibition", label: "会場独自展示", hint: text.hints.exhibitionGeneral, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "start", label: text.labels.start, hint: text.hints.startGeneral, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "motor", label: text.labels.motor, hint: text.hints.motorGeneral, badge: input.hasMotorPanelData ? text.labels.motorHistoryShort : text.waiting },
			{ key: "records", label: text.labels.records, hint: text.hints.records, badge: input.hasRecordsPanelData ? text.labels.recordsShort : text.waiting },
			{ key: "water", label: text.labels.waterComment, hint: text.hints.waterComment, badge: input.hasWaterPanelData ? text.labels.waterShort : text.waiting },
		];
	}

	if (input.isOmuraVenue) {
		return [
			{ key: "omura-overview", label: text.labels.overview, hint: text.hints.overview, badge: input.hasSelectedVenueExtrasDetail ? text.labels.overviewShort : text.waiting },
			{ key: "omura-prevday", label: text.labels.prevDay, hint: text.hints.prevDay, badge: input.hasOmuraPreviousDayData ? text.labels.prevDay : text.waiting },
			{ key: "omura-national", label: text.labels.nationalFrame, hint: text.hints.nationalFrame, badge: input.hasOmuraNationalFrameStatsData ? text.labels.nationalFrameShort : text.waiting },
			{ key: "omura-last10", label: text.labels.last10, hint: text.hints.last10, badge: input.hasOmuraFrameLast10Data ? text.labels.last10Short : text.waiting },
			{ key: "omura-comments", label: text.labels.commentsAndMotor, hint: text.hints.commentsAndMotor, badge: input.hasOmuraCommentsMotorData ? text.labels.commentShort : text.waiting },
			{ key: "omura-exhibition", label: text.labels.displayInfo, hint: text.hints.displayInfo, badge: input.hasOmuraExhibitionData ? text.labels.exhibitionShort : text.waiting },
		];
	}

	if (input.isTsuVenue) {
		return [
			{ key: "tsu-before", label: text.labels.before, hint: text.hints.beforeFull, badge: input.hasTsuBeforeInfoData ? text.labels.directBeforeShort : text.waiting },
			{ key: "start", label: text.labels.start, hint: text.hints.startTsu, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "exhibition", label: text.labels.exhibition, hint: text.hints.exhibitionFull, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "tsu-comments", label: text.labels.comments, hint: text.hints.commentsTsu, badge: input.hasTsuRacerCommentsData ? text.labels.commentShort : text.waiting },
			{ key: "tsu-series", label: text.labels.series, hint: text.hints.seriesGeneral, badge: input.hasTsuSeriesResultsData ? text.labels.series : text.waiting },
			{ key: "tsu-national3", label: text.labels.nationalRecent3, hint: text.hints.nationalRecent3, badge: input.hasTsuNationalRecent3Data ? text.labels.national3Short : text.waiting },
			{ key: "tsu-local3", label: text.labels.localRecent3, hint: text.hints.localRecent3Tsu, badge: input.hasTsuLocalRecent3Data ? text.labels.local3Short : text.waiting },
			{ key: "tsu-frame10", label: text.labels.framePast10, hint: text.hints.framePast10, badge: input.hasTsuFramePast10Data ? text.labels.last10Short : text.waiting },
			{ key: "tsu-score", label: text.labels.score, hint: text.hints.scoreTsu, badge: input.hasTsuScoreRateGuideData || hasOfficialScoreRows ? text.labels.scoreShort : text.waiting },
		];
	}

	if (input.isWakamatsuVenue) {
		return [
			{ key: "wakamatsu-before", label: text.labels.before, hint: text.hints.beforeWakamatsu, badge: input.hasWakamatsuBeforeInfoData ? text.labels.directBeforeShort : text.waiting },
			{ key: "start", label: text.labels.start, hint: text.hints.startWakamatsu, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "exhibition", label: text.labels.exhibition, hint: text.hints.exhibitionFull, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "wakamatsu-series", label: text.labels.series, hint: text.hints.seriesGeneral, badge: input.hasWakamatsuSeriesResultsData ? text.labels.series : text.waiting },
			{ key: "wakamatsu-course", label: text.labels.course, hint: text.hints.courseWakamatsu, badge: input.hasWakamatsuCourseStatsData ? "進入" : text.waiting },
			{ key: "wakamatsu-motor", label: text.labels.motorHistory, hint: text.hints.motorHistory, badge: input.hasWakamatsuMotorHistoryData ? text.labels.historyShort : text.waiting },
			{ key: "wakamatsu-frame10", label: text.labels.framePast10, hint: text.hints.framePast10, badge: input.hasWakamatsuFramePast10Data ? text.labels.last10Short : text.waiting },
			{ key: "wakamatsu-national3", label: text.labels.nationalRecent3, hint: text.hints.nationalRecent3, badge: input.hasWakamatsuNationalRecent3Data ? text.labels.national3Short : text.waiting },
			{ key: "wakamatsu-local3", label: text.labels.localRecent3, hint: text.hints.localRecent3Wakamatsu, badge: input.hasWakamatsuLocalRecent3Data ? text.labels.local3Short : text.waiting },
			{ key: "wakamatsu-entry", label: text.labels.entryTable, hint: text.hints.entryTable, badge: input.hasWakamatsuEntryData ? text.labels.entryTable : text.waiting },
			{ key: "wakamatsu-score", label: text.labels.score, hint: text.hints.scoreWakamatsu, badge: input.hasWakamatsuScoreRateGuideData ? text.labels.scoreShort : text.waiting },
		];
	}

	if (input.isFukuokaVenue) {
		return [
			{ key: "fukuoka-entry", label: text.labels.entry, hint: text.hints.entryFukuoka, badge: input.hasFukuokaEntryData ? text.labels.entryShort : text.waiting },
			{ key: "fukuoka-before", label: text.labels.before, hint: text.hints.beforeDisplay, badge: input.hasFukuokaBeforeInfoData ? text.labels.directBeforeShort : text.waiting },
			{ key: "start", label: text.labels.start, hint: text.hints.startFukuoka, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "exhibition", label: text.labels.displayInfo, hint: text.hints.exhibitionDisplay, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "fukuoka-motor", label: text.labels.motorEvaluation, hint: text.hints.motorEvaluation, badge: input.hasFukuokaMotorEvaluationData ? text.labels.motorShort : text.waiting },
			{ key: "fukuoka-series", label: text.labels.interval, hint: text.hints.seriesGeneral, badge: input.hasFukuokaSeriesResultsData ? text.labels.intervalShort : text.waiting },
			{ key: "fukuoka-comments", label: text.labels.comments, hint: text.hints.commentsTsu, badge: input.hasFukuokaRacerCommentsData ? text.labels.commentShort : text.waiting },
			{ key: "fukuoka-frame10", label: text.labels.framePast10, hint: text.hints.framePast10, badge: input.hasFukuokaFramePast10Data ? text.labels.last10Short : text.waiting },
			{ key: "fukuoka-score", label: text.labels.score, hint: text.hints.scoreFukuoka, badge: input.hasFukuokaScoreRateGuideData ? text.labels.scoreShort : text.waiting },
		];
	}

	if (input.isKojimaVenue) {
		return [
			{ key: "kojima-before", label: text.labels.before, hint: text.hints.beforeDisplay, badge: input.hasKojimaBeforeInfoData ? text.labels.directBeforeShort : text.waiting },
			{ key: "start", label: text.labels.start, hint: text.hints.startKojima, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "exhibition", label: text.labels.exhibition, hint: text.hints.exhibitionFull, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "kojima-series", label: text.labels.series, hint: text.hints.seriesGeneral, badge: input.hasKojimaSeriesResultsData ? text.labels.series : text.waiting },
			{ key: "kojima-recent", label: text.labels.recent, hint: text.hints.recent, badge: input.hasKojimaRecentResultsData ? text.labels.recentShort : text.waiting },
			{ key: "kojima-course", label: text.labels.course, hint: text.hints.courseCompare, badge: input.hasKojimaCourseStatsData ? "進入" : text.waiting },
			{ key: "kojima-motor", label: text.labels.motorStats, hint: text.hints.motorStats, badge: input.hasKojimaMotorStatsData ? text.labels.motorShort : text.waiting },
			{ key: "kojima-frame", label: text.labels.frameStats, hint: text.hints.frameStats, badge: input.hasKojimaFrameStatsData ? text.labels.frameStats : text.waiting },
			{ key: "kojima-score", label: text.labels.score, hint: text.hints.scoreKojima, badge: input.hasKojimaScoreRateGuideData ? text.labels.scoreShort : text.waiting },
		];
	}

	if (input.isTamagawaVenue) {
		return [
			{ key: "tamagawa-overview", label: text.labels.overview, hint: text.hints.overviewTamagawa, badge: input.hasSelectedVenueExtrasDetail ? text.labels.overviewShort : text.waiting },
			{ key: "motor", label: text.labels.motor, hint: text.hints.motorTamagawa, badge: input.hasTamagawaMotorHistoryData ? text.labels.historyShort : text.waiting },
			{ key: "tamagawa-diagnosis", label: text.labels.diagnosis, hint: text.hints.diagnosis, badge: hasAbilityIndex ? text.labels.indexShort : text.waiting },
			{ key: "tamagawa-series", label: text.labels.interval, hint: text.hints.interval, badge: input.hasTamagawaSeriesResultsData ? text.labels.intervalShort : text.waiting },
			{ key: "tamagawa-cyokuzen", label: text.labels.directBeforeShort, hint: text.hints.beforeTamagawa, badge: input.hasTamagawaBeforeInfoData ? text.labels.directBeforeShort : text.waiting },
			{ key: "start", label: text.labels.startShort, hint: text.hints.startTamagawa, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "exhibition", label: text.labels.exhibitionShort, hint: text.hints.exhibitionTamagawa, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "tamagawa-frame10", label: text.labels.framePast10, hint: text.hints.framePast10Tamagawa, badge: input.hasTamagawaFramePast10Data ? text.labels.last10Short : text.waiting },
			{ key: "tamagawa-score", label: text.labels.scoreShort, hint: text.hints.scoreTamagawa, badge: input.hasTamagawaScoreRateGuideData || hasOfficialScoreRows ? text.labels.scoreShort : text.waiting },
		];
	}

	if (input.isBiwakoVenue) {
		return [
			{ key: "exhibition", label: "会場独自展示", hint: text.hints.exhibitionBiwako, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
			{ key: "start", label: text.labels.start, hint: text.hints.startBiwako, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
			{ key: "biwako-frame10", label: text.labels.framePast10, hint: text.hints.framePast10, badge: input.hasBiwakoFramePast10Data ? text.labels.last10Short : text.waiting },
			{ key: "biwako-series", label: text.labels.interval, hint: text.hints.seriesBiwako, badge: input.hasBiwakoSeriesResultsData ? text.labels.intervalShort : text.waiting },
			{ key: "records", label: text.labels.score, hint: text.hints.scoreBiwako, badge: input.hasRecordsPanelData ? text.labels.scoreShort : text.waiting },
		];
	}

	return [
		{ key: "official", label: text.labels.official, hint: text.hints.official, badge: input.hasOfficialPanelData ? text.labels.officialShort : text.waiting },
		{ key: "start", label: text.labels.start, hint: text.hints.startGeneral, badge: input.hasStartPanelData ? text.labels.startShort : text.waiting },
		{ key: "records", label: text.labels.records, hint: text.hints.records, badge: input.hasRecordsPanelData ? text.labels.recordsShort : text.waiting },
		{ key: "exhibition", label: "会場独自展示", hint: text.hints.exhibitionGeneral, badge: input.hasExhibitionPanelData ? text.labels.exhibitionShort : text.waiting },
		{ key: "motor", label: text.labels.motor, hint: text.hints.motorGeneral, badge: input.hasMotorPanelData ? text.labels.motorHistoryShort : text.waiting },
		{ key: "water", label: text.labels.waterComment, hint: text.hints.waterComment, badge: input.hasWaterPanelData ? text.labels.waterShort : text.waiting },
	];
}
