import { VENUE_EXTRA_LABELS } from "./venueExtraLabels";
import type { VenueExtraPanelKey, VenueExtraPanelOption, VenueExtraVenueFlags } from "./venueExtraTypes";

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

function createPanel(
	key: VenueExtraPanelKey,
	label: string,
	hint: string,
	hasData: boolean,
	badgeWhenReady: string,
): VenueExtraPanelOption {
	return {
		key,
		label,
		hint,
		badge: hasData ? badgeWhenReady : VENUE_EXTRA_LABELS.waiting,
	};
}

function appendIf(options: VenueExtraPanelOption[], condition: boolean, option: VenueExtraPanelOption): void {
	if (condition) {
		options.push(option);
	}
}

export function buildVenueExtraPanelOptions(input: BuildVenueExtraPanelOptionsInput): VenueExtraPanelOption[] {
	const text = VENUE_EXTRA_LABELS;
	const hasOfficialScoreRows = input.officialScoreRowsCount > 0;
	const hasAbilityIndex = input.abilityIndexCount > 0;
	const options: VenueExtraPanelOption[] = [
		createPanel("official", text.labels.official, text.hints.official, input.hasOfficialPanelData, text.labels.officialShort),
		createPanel("start", text.labels.start, text.hints.startGeneral, input.hasStartPanelData, text.labels.startShort),
		createPanel("records", text.labels.records, text.hints.records, input.hasRecordsPanelData, text.labels.recordsShort),
		createPanel("exhibition", text.labels.exhibition, text.hints.exhibitionGeneral, input.hasExhibitionPanelData, text.labels.exhibitionShort),
		createPanel("motor", text.labels.motor, text.hints.motorGeneral, input.hasMotorPanelData, text.labels.motorShort),
		createPanel("water", text.labels.waterComment, text.hints.waterComment, input.hasWaterPanelData, text.labels.waterShort),
	];

	appendIf(options, input.isOmuraVenue, createPanel("omura-overview", text.labels.overview, text.hints.overview, input.hasSelectedVenueExtrasDetail, text.labels.overviewShort));
	appendIf(options, input.isOmuraVenue, createPanel("omura-prevday", text.labels.prevDay, text.hints.prevDay, input.hasOmuraPreviousDayData, text.labels.prevDay));
	appendIf(options, input.isOmuraVenue, createPanel("omura-national", text.labels.nationalFrame, text.hints.nationalFrame, input.hasOmuraNationalFrameStatsData, text.labels.nationalFrameShort));
	appendIf(options, input.isOmuraVenue, createPanel("omura-last10", text.labels.last10, text.hints.last10, input.hasOmuraFrameLast10Data, text.labels.last10Short));
	appendIf(options, input.isOmuraVenue, createPanel("omura-comments", text.labels.commentsAndMotor, text.hints.commentsAndMotor, input.hasOmuraCommentsMotorData, text.labels.commentShort));
	appendIf(options, input.isOmuraVenue, createPanel("omura-exhibition", text.labels.displayInfo, text.hints.displayInfo, input.hasOmuraExhibitionData, text.labels.exhibitionShort));

	appendIf(options, input.isTsuVenue, createPanel("tsu-before", text.labels.before, text.hints.beforeFull, input.hasTsuBeforeInfoData, text.labels.directBeforeShort));
	appendIf(options, input.isTsuVenue, createPanel("tsu-comments", text.labels.comments, text.hints.commentsTsu, input.hasTsuRacerCommentsData, text.labels.commentShort));
	appendIf(options, input.isTsuVenue, createPanel("tsu-series", text.labels.series, text.hints.seriesGeneral, input.hasTsuSeriesResultsData, text.labels.series));
	appendIf(options, input.isTsuVenue, createPanel("tsu-national3", text.labels.nationalRecent3, text.hints.nationalRecent3, input.hasTsuNationalRecent3Data, text.labels.national3Short));
	appendIf(options, input.isTsuVenue, createPanel("tsu-local3", text.labels.localRecent3, text.hints.localRecent3Tsu, input.hasTsuLocalRecent3Data, text.labels.local3Short));
	appendIf(options, input.isTsuVenue, createPanel("tsu-frame10", text.labels.framePast10, text.hints.framePast10, input.hasTsuFramePast10Data, text.labels.last10Short));
	appendIf(options, input.isTsuVenue, createPanel("tsu-score", text.labels.score, text.hints.scoreTsu, input.hasTsuScoreRateGuideData || hasOfficialScoreRows, text.labels.scoreShort));

	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-before", text.labels.before, text.hints.beforeWakamatsu, input.hasWakamatsuBeforeInfoData, text.labels.directBeforeShort));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-series", text.labels.series, text.hints.seriesGeneral, input.hasWakamatsuSeriesResultsData, text.labels.series));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-course", text.labels.course, text.hints.courseWakamatsu, input.hasWakamatsuCourseStatsData, "進入"));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-motor", text.labels.motorHistory, text.hints.motorHistory, input.hasWakamatsuMotorHistoryData, text.labels.historyShort));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-frame10", text.labels.framePast10, text.hints.framePast10, input.hasWakamatsuFramePast10Data, text.labels.last10Short));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-national3", text.labels.nationalRecent3, text.hints.nationalRecent3, input.hasWakamatsuNationalRecent3Data, text.labels.national3Short));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-local3", text.labels.localRecent3, text.hints.localRecent3Wakamatsu, input.hasWakamatsuLocalRecent3Data, text.labels.local3Short));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-entry", text.labels.entryTable, text.hints.entryTable, input.hasWakamatsuEntryData, text.labels.entryTable));
	appendIf(options, input.isWakamatsuVenue, createPanel("wakamatsu-score", text.labels.score, text.hints.scoreWakamatsu, input.hasWakamatsuScoreRateGuideData, text.labels.scoreShort));

	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-entry", text.labels.entry, text.hints.entryFukuoka, input.hasFukuokaEntryData, text.labels.entryShort));
	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-before", text.labels.before, text.hints.beforeDisplay, input.hasFukuokaBeforeInfoData, text.labels.directBeforeShort));
	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-motor", text.labels.motorEvaluation, text.hints.motorEvaluation, input.hasFukuokaMotorEvaluationData, text.labels.motorShort));
	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-series", text.labels.interval, text.hints.seriesGeneral, input.hasFukuokaSeriesResultsData, text.labels.intervalShort));
	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-comments", text.labels.comments, text.hints.commentsTsu, input.hasFukuokaRacerCommentsData, text.labels.commentShort));
	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-frame10", text.labels.framePast10, text.hints.framePast10, input.hasFukuokaFramePast10Data, text.labels.last10Short));
	appendIf(options, input.isFukuokaVenue, createPanel("fukuoka-score", text.labels.score, text.hints.scoreFukuoka, input.hasFukuokaScoreRateGuideData, text.labels.scoreShort));

	appendIf(options, input.isKojimaVenue, createPanel("kojima-before", text.labels.before, text.hints.beforeDisplay, input.hasKojimaBeforeInfoData, text.labels.directBeforeShort));
	appendIf(options, input.isKojimaVenue, createPanel("kojima-series", text.labels.series, text.hints.seriesGeneral, input.hasKojimaSeriesResultsData, text.labels.series));
	appendIf(options, input.isKojimaVenue, createPanel("kojima-recent", text.labels.recent, text.hints.recent, input.hasKojimaRecentResultsData, text.labels.recentShort));
	appendIf(options, input.isKojimaVenue, createPanel("kojima-course", text.labels.course, text.hints.courseCompare, input.hasKojimaCourseStatsData, "進入"));
	appendIf(options, input.isKojimaVenue, createPanel("kojima-motor", text.labels.motorStats, text.hints.motorStats, input.hasKojimaMotorStatsData, text.labels.motorShort));
	appendIf(options, input.isKojimaVenue, createPanel("kojima-frame", text.labels.frameStats, text.hints.frameStats, input.hasKojimaFrameStatsData, text.labels.frameStats));
	appendIf(options, input.isKojimaVenue, createPanel("kojima-score", text.labels.score, text.hints.scoreKojima, input.hasKojimaScoreRateGuideData, text.labels.scoreShort));

	appendIf(options, input.isTamagawaVenue, createPanel("tamagawa-overview", text.labels.overview, text.hints.overviewTamagawa, input.hasSelectedVenueExtrasDetail, text.labels.overviewShort));
	appendIf(options, input.isTamagawaVenue, createPanel("tamagawa-diagnosis", text.labels.diagnosis, text.hints.diagnosis, hasAbilityIndex, text.labels.indexShort));
	appendIf(options, input.isTamagawaVenue, createPanel("tamagawa-series", text.labels.interval, text.hints.interval, input.hasTamagawaSeriesResultsData, text.labels.intervalShort));
	appendIf(options, input.isTamagawaVenue, createPanel("tamagawa-cyokuzen", text.labels.directBeforeShort, text.hints.beforeTamagawa, input.hasTamagawaBeforeInfoData, text.labels.directBeforeShort));
	appendIf(options, input.isTamagawaVenue, createPanel("tamagawa-frame10", text.labels.framePast10, text.hints.framePast10Tamagawa, input.hasTamagawaFramePast10Data, text.labels.last10Short));
	appendIf(options, input.isTamagawaVenue, createPanel("tamagawa-score", text.labels.score, text.hints.scoreTamagawa, input.hasTamagawaScoreRateGuideData || hasOfficialScoreRows, text.labels.scoreShort));

	appendIf(options, input.isBiwakoVenue, createPanel("biwako-frame10", text.labels.framePast10, text.hints.framePast10, input.hasBiwakoFramePast10Data, text.labels.last10Short));
	appendIf(options, input.isBiwakoVenue, createPanel("biwako-series", text.labels.interval, text.hints.seriesBiwako, input.hasBiwakoSeriesResultsData, text.labels.intervalShort));

	return options;
}
