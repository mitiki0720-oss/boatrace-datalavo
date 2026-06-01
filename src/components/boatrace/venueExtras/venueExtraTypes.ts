export type VenueExtraPanelKey =
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
	| "biwako-frame10"
	| "biwako-series"
	| "biwako-score"
	| "biwako-course"
	| "biwako-current"
	| "biwako-result"
	| "tamagawa-score"
	| "omura-overview"
	| "omura-prevday"
	| "omura-national"
	| "omura-last10"
	| "omura-comments"
	| "omura-exhibition"
	| "tamagawa-odds"
	| "tamagawa-entry"
	| "tsu-before"
	| "tsu-comments"
	| "tsu-series"
	| "tsu-national3"
	| "tsu-local3"
	| "tsu-frame10"
	| "tsu-score"
	| "wakamatsu-entry"
	| "wakamatsu-before"
	| "wakamatsu-series"
	| "wakamatsu-course"
	| "wakamatsu-national3"
	| "wakamatsu-local3"
	| "wakamatsu-frame10"
	| "wakamatsu-score"
	| "wakamatsu-motor"
	| "fukuoka-entry"
	| "fukuoka-before"
	| "fukuoka-motor"
	| "fukuoka-series"
	| "fukuoka-comments"
	| "fukuoka-frame10"
	| "fukuoka-score"
	| "kojima-before"
	| "kojima-series"
	| "kojima-recent"
	| "kojima-course"
	| "kojima-motor"
	| "kojima-frame"
	| "kojima-score";

export type VenueExtraPanelOption = {
	key: VenueExtraPanelKey;
	label: string;
	hint: string;
	badge: string;
};

export type VenueExtraVenueFlags = {
	isNarutoVenue: boolean;
	isKaratsuVenue: boolean;
	isBiwakoVenue: boolean;
	isTamagawaVenue: boolean;
	isTsuVenue: boolean;
	isWakamatsuVenue: boolean;
	isFukuokaVenue: boolean;
	isKojimaVenue: boolean;
	isOmuraVenue: boolean;
	isMarugameVenue: boolean;
};
