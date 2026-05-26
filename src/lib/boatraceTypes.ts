import type { ParsedBoatBet, ParsedBoatBetSummary } from "./boatBetParser";

export type BoatFrameNumber = 1 | 2 | 3 | 4 | 5 | 6;

export type BoatFrameDisplay = BoatFrameNumber | string;

export type BoatRaceSession = "day" | "night" | "morning" | "relay" | "unknown";

export type BoatRaceStatus =
	| "scheduled"
	| "exhibition"
	| "selling"
	| "closed"
	| "finished"
	| "canceled";

export type BoatExhibitionEvaluation = "good" | "normal" | "bad" | "unknown";

export type BoatResultStatus = "pending" | "confirmed" | "finished" | "unavailable" | "empty";

export type BoatOddsBetType = "3連単" | "3連複" | "2連単" | "2連複" | "単勝" | "複勝" | "拡連複" | string;

export type BoatPredictionBetType = "3連単" | "2連単" | string;

export type BoatPredictionGroup = "厚め" | "本線" | "穴狙い" | "その他";

export type BoatPredictionHitStatus = "hit" | "miss" | "pending";

export type BoatVenueItem = {
	id: string;
	name: string;
	shortName?: string;
	area?: string;
	waterType?: string;
	featureMemo?: string;
};

export type BoatRacerItem = {
	frameNo: BoatFrameNumber;
	boatNo: string;
	name: string;
	branch?: string;
	class?: string;
	age?: number | string;
	weight?: string;
	fCount?: number | string;
	lCount?: number | string;
	averageStart?: string;
	winRate?: string;
	secondRate?: string;
	thirdRate?: string;
	motorNo?: string;
	motorSecondRate?: string;
	boatMotorNo?: string;
	boatSecondRate?: string;
	comment?: string;
};

export type BoatMotorItem = {
	motorNo: string;
	secondRate?: string;
	thirdRate?: string;
	rankLabel?: string;
	memo?: string;
};

export type BoatBodyItem = {
	boatNo: string;
	secondRate?: string;
	thirdRate?: string;
	rankLabel?: string;
	memo?: string;
};

export type BoatExhibitionItem = {
	frameNo: BoatFrameNumber;
	playerName?: string;
	exhibitionTime?: string;
	weight?: string;
	weightAdjustment?: string;
	tilt?: string;
	partsExchange?: string;
	oneLapTime?: string;
	turnTime?: string;
	straightTime?: string;
	startTiming?: string;
	course?: string;
	weatherMemo?: string;
	evaluation?: BoatExhibitionEvaluation;
	memo?: string;
};

export type BoatStartExhibitionItem = {
	course: string;
	frameNo: BoatFrameNumber;
	startTiming?: string;
	formationText?: string;
};

export type BoatWeatherActual = {
	weather?: string;
	windDirection?: string;
	windDirectionText?: string;
	windSpeed?: string;
	waveHeight?: string;
	temperature?: string;
	airTemperature?: string;
	waterTemperature?: string;
	pressure?: string;
	humidity?: string;
	rainfall?: string;
	observedAt?: string;
	updatedAt?: string;
	fetchedAt?: string;
	source?: string;
	sourceUrl?: string;
	sourceLabel?: string;
};

export type BoatOddsItem = {
	betType: BoatOddsBetType;
	combination: string;
	odds: string;
	popularity?: number | string;
	source?: string;
	fetchedAt?: string;
};

export type BoatOddsTopItem = {
	combination: string;
	odds: string;
	popularity?: number | string;
	source?: string;
	updatedAt?: string;
	fetchedAt?: string;
};

export type BoatOddsPreviewGroup = {
	trifectaTop?: BoatOddsTopItem[];
	exactaTop?: BoatOddsTopItem[];
	quinellaTop?: BoatOddsTopItem[];
	updatedAt?: string;
};

export type BoatOddsPreview = BoatOddsItem[] & Partial<BoatOddsPreviewGroup>;

export type BoatPayoutItem = {
	betType: BoatOddsBetType;
	combination: string;
	payout: string;
	popularity?: number | string;
};

export type BoatRaceResultFinisher = {
	rank?: number | string;
	frameNo?: BoatFrameDisplay;
	frame?: BoatFrameDisplay;
	lane?: number | string;
	boatNumber?: number | string;
	registrationNo?: string;
	racerId?: string;
	name?: string;
	playerName?: string;
	boatRacerName?: string;
	raceTime?: string;
	st?: string;
	course?: number | string;
	startTiming?: string;
	decision?: string;
	isFlying?: boolean;
	isLate?: boolean;
};

export type BoatRaceResultStartInfo = {
	course?: number | string;
	frameNo?: BoatFrameDisplay;
	frame?: BoatFrameDisplay;
	lane?: number | string;
	boatNumber?: number | string;
	st?: string;
	flag?: string;
	stDisplay?: string;
	startTiming?: string;
	entryCourse?: number | string;
	approachCourse?: number | string;
	note?: string;
};

export type BoatRaceFinalOdds = {
	trifectaTop?: BoatOddsTopItem[];
	exactaTop?: BoatOddsTopItem[];
	quinellaTop?: BoatOddsTopItem[];
	trifectaAll?: BoatOddsItem[];
	exactaAll?: BoatOddsItem[];
	quinellaAll?: BoatOddsItem[];
	updatedAt?: string;
};

export type BoatRaceResult = {
	status?: BoatResultStatus;
	finishOrder?: string[];
	finishers?: BoatRaceResultFinisher[];
	startInfo?: BoatRaceResultStartInfo[];
	startInfos?: BoatRaceResultStartInfo[];
	kimarite?: string;
	winningMethod?: string;
	winningMove?: string;
	payout3tan?: BoatPayoutItem | null;
	payout3fuku?: BoatPayoutItem | null;
	payout2tan?: BoatPayoutItem | null;
	payout2fuku?: BoatPayoutItem | null;
	payoutWide?: BoatPayoutItem[] | null;
	payoutWin?: BoatPayoutItem | null;
	payoutPlace?: BoatPayoutItem[] | null;
	payouts?: BoatPayoutItem[];
	payoutsFull?: BoatPayoutItem[];
	refunds?: string[];
	refundText?: string;
	remarks?: string;
	notes?: string;
	finalizedAt?: string;
	weatherActual?: BoatWeatherActual;
	finalOdds?: BoatRaceFinalOdds | null;
};

export type BoatRaceItem = {
	raceNo: number;
	raceId?: string;
	title?: string;
	deadlineTime?: string;
	startTime?: string;
	status?: BoatRaceStatus;
	racers?: BoatRacerItem[];
	motors?: BoatMotorItem[];
	boats?: BoatBodyItem[];
	exhibitions?: BoatExhibitionItem[];
	startExhibition?: BoatStartExhibitionItem[];
	weatherActual?: BoatWeatherActual;
	oddsPreview?: BoatOddsPreview;
	result?: BoatRaceResult;
	memo?: string;
};

export type BoatTodayVenueItem = {
	id: string;
	venueCode?: string;
	venueName: string;
	title?: string;
	date: string;
	session?: BoatRaceSession;
	status?: BoatRaceStatus;
	races: BoatRaceItem[];
	weatherActual?: BoatWeatherActual;
	source?: string;
	generatedAt?: string;
};

export type BoatTodayFeed = {
	version?: number;
	generatedAt?: string;
	date: string;
	source?: string;
	venues: BoatTodayVenueItem[];
};

export type BoatPredictionTicket = {
	index: string;
	betType: BoatPredictionBetType;
	combination: string;
	group?: BoatPredictionGroup;
	note?: string;
};

export type BoatPredictionRecord = {
	raceKey: string;
	raceId?: string;
	venueCode?: string;
	venueName: string;
	date: string;
	raceNo: number;
	predictionText: string;
	tickets?: BoatPredictionTicket[];
	parsedBets?: ParsedBoatBet[];
	betSummary?: ParsedBoatBetSummary;
	totalStakeYen?: number;
	updatedAt?: string;
	savedAt: string;
};

export type BoatJohnsonPredictionRecord = {
	raceKey: string;
	raceId?: string;
	venueCode?: string;
	venueName: string;
	date: string;
	raceNo: number;
	predictionText: string;
	tickets?: BoatPredictionTicket[];
	parsedBets?: ParsedBoatBet[];
	betSummary?: ParsedBoatBetSummary;
	totalStakeYen?: number;
	resultStatus?: string;
	hitBetType?: string;
	hitBetNumbers?: string;
	finishOrder?: string;
	payoutYen?: number;
	profitYen?: number;
	roi?: number;
	mobileMemo?: string;
	sourceRecordSavedAt?: string;
	updatedAt?: string;
	savedAt: string;
};

export type BoatJohnsonPredictionPayload = {
	version: number;
	updatedAt: string;
	source: string;
	records: Record<string, BoatJohnsonPredictionRecord>;
	notifiedSlackHitKeys?: string[];
	slackNotifiedAt?: string;
};

export type BoatPredictionResultRecord = {
	raceKey: string;
	raceId?: string;
	venueName: string;
	date: string;
	raceNo: number;
	resultOrder?: string;
	hitStatus: BoatPredictionHitStatus;
	hitBetType?: BoatPredictionBetType;
	hitCombination?: string;
	investment?: number;
	payout?: number;
	profitLoss?: number;
	roi?: number;
	memo?: string;
	savedAt: string;
};

export const BOAT_FRAME_COLORS: Record<BoatFrameNumber, string> = {
	1: "#f8fbff",
	2: "#1b2430",
	3: "#e53e3e",
	4: "#2563eb",
	5: "#facc15",
	6: "#16a34a",
};

export const BOAT_RACE_VENUES = [
	"桐生",
	"戸田",
	"江戸川",
	"平和島",
	"多摩川",
	"浜名湖",
	"蒲郡",
	"常滑",
	"津",
	"三国",
	"びわこ",
	"住之江",
	"尼崎",
	"鳴門",
	"丸亀",
	"児島",
	"宮島",
	"徳山",
	"下関",
	"若松",
	"芦屋",
	"福岡",
	"唐津",
	"大村",
] as const;
