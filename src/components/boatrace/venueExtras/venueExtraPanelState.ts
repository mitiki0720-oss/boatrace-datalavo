import type { VenueExtraPanelKey, VenueExtraVenueFlags } from "./venueExtraTypes";

export type VenueExtraPanelFlags = {
	hasSelectedVenueExtrasDetail: boolean;
	hasOfficialPanelData: boolean;
	hasStartPanelData: boolean;
	hasRecordsPanelData: boolean;
	hasExhibitionPanelData: boolean;
	hasMotorPanelData: boolean;
	hasWaterPanelData: boolean;
	hasOfficialScoreRows: boolean;
	hasAbilityIndex: boolean;
};

export type CreateVenueExtraPanelFlagsInput = {
	hasOfficialBeforeInfoDetail: boolean;
	shouldShowOfficialBeforeInfoWaiting: boolean;
	hasOfficialStartExhibition: boolean;
	hasOfficialScoreRows: boolean;
	hasOriginalExhibitionData: boolean;
	hasStartExhibitionData: boolean;
	hasVenuePredictionFocus: boolean;
	shouldShowOriginalExhibitionWaiting: boolean;
	shouldShowVenuePredictionWaiting: boolean;
	hasSelectedMotorSummaryData: boolean;
	shouldShowMotorSummaryWaiting: boolean;
	hasNarutoPerformanceData: boolean;
	shouldShowNarutoPerformanceWaiting: boolean;
	hasTamagawaMotorHistoryData: boolean;
	hasRacerComments: boolean;
	hasWaterMemo: boolean;
	hasAbilityIndex: boolean;
	hasOmuraEntryData: boolean;
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
	hasTamagawaEntryData: boolean;
	hasTamagawaBeforeInfoData: boolean;
	hasTamagawaSeriesResultsData: boolean;
	hasTamagawaFramePast10Data: boolean;
	hasTamagawaScoreRateGuideData: boolean;
	hasTamagawaOddsResultData: boolean;
};

export type ResolvePreferredVenueExtraPanelInput = VenueExtraVenueFlags & VenueExtraPanelFlags & {
	hasOmuraPreviousDayData: boolean;
	hasOmuraNationalFrameStatsData: boolean;
	hasOmuraFrameLast10Data: boolean;
	hasOmuraCommentsMotorData: boolean;
	hasOmuraExhibitionData: boolean;
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
	hasWakamatsuMotorHistoryData: boolean;
	hasFukuokaEntryData: boolean;
	hasFukuokaBeforeInfoData: boolean;
	hasFukuokaMotorEvaluationData: boolean;
	hasFukuokaSeriesResultsData: boolean;
	hasFukuokaRacerCommentsData: boolean;
	hasFukuokaFramePast10Data: boolean;
	hasKojimaBeforeInfoData: boolean;
	hasKojimaSeriesResultsData: boolean;
	hasKojimaRecentResultsData: boolean;
	hasKojimaCourseStatsData: boolean;
	hasKojimaMotorStatsData: boolean;
	hasKojimaFrameStatsData: boolean;
	hasKojimaScoreRateGuideData: boolean;
	hasTamagawaBeforeInfoData: boolean;
	hasTamagawaSeriesResultsData: boolean;
	hasTamagawaFramePast10Data: boolean;
	hasTamagawaScoreRateGuideData: boolean;
	hasBiwakoFramePast10Data: boolean;
	hasBiwakoSeriesResultsData: boolean;
};

export function createVenueExtraPanelFlags(input: CreateVenueExtraPanelFlagsInput): VenueExtraPanelFlags {
	const hasOfficialPanelData = input.hasOfficialBeforeInfoDetail || input.shouldShowOfficialBeforeInfoWaiting;
	const hasStartPanelData = input.hasOfficialStartExhibition || input.hasStartExhibitionData;
	const hasRecordsPanelData = input.hasOfficialScoreRows || input.hasNarutoPerformanceData || input.hasAbilityIndex;
	const hasExhibitionPanelData = input.hasOriginalExhibitionData || input.shouldShowOriginalExhibitionWaiting;
	const hasMotorPanelData = input.hasSelectedMotorSummaryData || input.shouldShowMotorSummaryWaiting || input.hasTamagawaMotorHistoryData;
	const hasWaterPanelData = input.hasVenuePredictionFocus || input.shouldShowVenuePredictionWaiting || input.hasRacerComments || input.hasWaterMemo;
	const hasSelectedVenueExtrasDetail =
		input.hasOriginalExhibitionData ||
		input.hasRacerComments ||
		input.hasStartExhibitionData ||
		input.hasSelectedMotorSummaryData ||
		input.hasNarutoPerformanceData ||
		input.hasOmuraEntryData ||
		input.hasOmuraPreviousDayData ||
		input.hasOmuraNationalFrameStatsData ||
		input.hasOmuraFrameLast10Data ||
		input.hasOmuraCommentsMotorData ||
		input.hasOmuraExhibitionData ||
		input.hasBiwakoFramePast10Data ||
		input.hasBiwakoSeriesResultsData ||
		input.hasTsuBeforeInfoData ||
		input.hasTsuRacerCommentsData ||
		input.hasTsuSeriesResultsData ||
		input.hasTsuNationalRecent3Data ||
		input.hasTsuLocalRecent3Data ||
		input.hasTsuFramePast10Data ||
		input.hasTsuScoreRateGuideData ||
		input.hasWakamatsuEntryData ||
		input.hasWakamatsuBeforeInfoData ||
		input.hasWakamatsuSeriesResultsData ||
		input.hasWakamatsuCourseStatsData ||
		input.hasWakamatsuNationalRecent3Data ||
		input.hasWakamatsuLocalRecent3Data ||
		input.hasWakamatsuFramePast10Data ||
		input.hasWakamatsuScoreRateGuideData ||
		input.hasWakamatsuMotorHistoryData ||
		input.hasFukuokaEntryData ||
		input.hasFukuokaBeforeInfoData ||
		input.hasFukuokaMotorEvaluationData ||
		input.hasFukuokaSeriesResultsData ||
		input.hasFukuokaRacerCommentsData ||
		input.hasFukuokaFramePast10Data ||
		input.hasFukuokaScoreRateGuideData ||
		input.hasKojimaBeforeInfoData ||
		input.hasKojimaSeriesResultsData ||
		input.hasKojimaRecentResultsData ||
		input.hasKojimaCourseStatsData ||
		input.hasKojimaMotorStatsData ||
		input.hasKojimaFrameStatsData ||
		input.hasKojimaScoreRateGuideData ||
		input.hasTamagawaEntryData ||
		input.hasTamagawaBeforeInfoData ||
		input.hasTamagawaMotorHistoryData ||
		input.hasTamagawaSeriesResultsData ||
		input.hasTamagawaFramePast10Data ||
		input.hasTamagawaScoreRateGuideData ||
		input.hasTamagawaOddsResultData ||
		input.shouldShowOriginalExhibitionWaiting ||
		input.shouldShowVenuePredictionWaiting ||
		input.shouldShowMotorSummaryWaiting ||
		input.shouldShowNarutoPerformanceWaiting ||
		input.hasAbilityIndex ||
		input.hasWaterMemo;

	return {
		hasSelectedVenueExtrasDetail,
		hasOfficialPanelData,
		hasStartPanelData,
		hasRecordsPanelData,
		hasExhibitionPanelData,
		hasMotorPanelData,
		hasWaterPanelData,
		hasOfficialScoreRows: input.hasOfficialScoreRows,
		hasAbilityIndex: input.hasAbilityIndex,
	};
}

export function resolvePreferredVenueExtraPanel(input: ResolvePreferredVenueExtraPanelInput): VenueExtraPanelKey {
	if (input.isOmuraVenue) {
		if (input.hasOmuraCommentsMotorData) {
			return "omura-comments";
		}

		if (input.hasOmuraExhibitionData) {
			return "omura-exhibition";
		}

		if (input.hasOmuraFrameLast10Data) {
			return "omura-last10";
		}

		if (input.hasOmuraNationalFrameStatsData) {
			return "omura-national";
		}

		if (input.hasOmuraPreviousDayData) {
			return "omura-prevday";
		}

		return "omura-overview";
	}

	if (input.isTsuVenue) {
		if (input.hasTsuBeforeInfoData) {
			return "tsu-before";
		}

		if (input.hasStartPanelData) {
			return "start";
		}

		if (input.hasExhibitionPanelData) {
			return "exhibition";
		}

		if (input.hasTsuRacerCommentsData) {
			return "tsu-comments";
		}

		if (input.hasTsuSeriesResultsData) {
			return "tsu-series";
		}

		if (input.hasTsuFramePast10Data) {
			return "tsu-frame10";
		}

		if (input.hasTsuScoreRateGuideData || input.hasOfficialScoreRows) {
			return "tsu-score";
		}

		if (input.hasTsuNationalRecent3Data) {
			return "tsu-national3";
		}

		if (input.hasTsuLocalRecent3Data) {
			return "tsu-local3";
		}

		return "tsu-before";
	}

	if (input.isWakamatsuVenue) {
		if (input.hasWakamatsuBeforeInfoData) {
			return "wakamatsu-before";
		}

		if (input.hasStartPanelData) {
			return "start";
		}

		if (input.hasExhibitionPanelData) {
			return "exhibition";
		}

		if (input.hasWakamatsuSeriesResultsData) {
			return "wakamatsu-series";
		}

		if (input.hasWakamatsuCourseStatsData) {
			return "wakamatsu-course";
		}

		if (input.hasWakamatsuMotorHistoryData) {
			return "wakamatsu-motor";
		}

		if (input.hasWakamatsuFramePast10Data) {
			return "wakamatsu-frame10";
		}

		if (input.hasWakamatsuNationalRecent3Data) {
			return "wakamatsu-national3";
		}

		if (input.hasWakamatsuLocalRecent3Data) {
			return "wakamatsu-local3";
		}

		if (input.hasWakamatsuEntryData) {
			return "wakamatsu-entry";
		}

		return "wakamatsu-score";
	}

	if (input.isFukuokaVenue) {
		if (input.hasFukuokaBeforeInfoData) {
			return "fukuoka-before";
		}

		if (input.hasStartPanelData) {
			return "start";
		}

		if (input.hasExhibitionPanelData) {
			return "exhibition";
		}

		if (input.hasFukuokaMotorEvaluationData) {
			return "fukuoka-motor";
		}

		if (input.hasFukuokaSeriesResultsData) {
			return "fukuoka-series";
		}

		if (input.hasFukuokaRacerCommentsData) {
			return "fukuoka-comments";
		}

		if (input.hasFukuokaFramePast10Data) {
			return "fukuoka-frame10";
		}

		if (input.hasFukuokaEntryData) {
			return "fukuoka-entry";
		}

		return "fukuoka-score";
	}

	if (input.isKojimaVenue) {
		if (input.hasKojimaBeforeInfoData) {
			return "kojima-before";
		}

		if (input.hasStartPanelData) {
			return "start";
		}

		if (input.hasExhibitionPanelData) {
			return "exhibition";
		}

		if (input.hasKojimaSeriesResultsData) {
			return "kojima-series";
		}

		if (input.hasKojimaCourseStatsData) {
			return "kojima-course";
		}

		if (input.hasKojimaMotorStatsData) {
			return "kojima-motor";
		}

		if (input.hasKojimaFrameStatsData) {
			return "kojima-frame";
		}

		if (input.hasKojimaScoreRateGuideData || input.hasOfficialScoreRows) {
			return "kojima-score";
		}

		if (input.hasKojimaRecentResultsData) {
			return "kojima-recent";
		}

		return "kojima-before";
	}

	if (input.isTamagawaVenue) {
		if (input.hasTamagawaBeforeInfoData) {
			return "tamagawa-cyokuzen";
		}

		if (input.hasStartPanelData) {
			return "start";
		}

		if (input.hasExhibitionPanelData) {
			return "exhibition";
		}

		if (input.hasMotorPanelData) {
			return "motor";
		}

		if (input.hasAbilityIndex) {
			return "tamagawa-diagnosis";
		}

		if (input.hasTamagawaSeriesResultsData) {
			return "tamagawa-series";
		}

		if (input.hasTamagawaFramePast10Data) {
			return "tamagawa-frame10";
		}

		if (input.hasTamagawaScoreRateGuideData || input.hasOfficialScoreRows) {
			return "tamagawa-score";
		}

		return "tamagawa-overview";
	}

	if (input.isBiwakoVenue) {
		if (input.hasExhibitionPanelData) {
			return "exhibition";
		}

		if (input.hasStartPanelData) {
			return "start";
		}

		if (input.hasBiwakoFramePast10Data) {
			return "biwako-frame10";
		}

		if (input.hasBiwakoSeriesResultsData) {
			return "biwako-series";
		}

		if (input.hasRecordsPanelData) {
			return "records";
		}

		return "exhibition";
	}

	if (input.hasOfficialPanelData) {
		return "official";
	}

	if (input.hasExhibitionPanelData) {
		return "exhibition";
	}

	if (input.hasStartPanelData) {
		return "start";
	}

	if (input.hasRecordsPanelData) {
		return "records";
	}

	if (input.hasMotorPanelData) {
		return "motor";
	}

	if (input.hasWaterPanelData) {
		return "water";
	}

	return "official";
}