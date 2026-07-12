/**
 * BOATRACE EX DATA LABO schema types.
 *
 * Fake completion is prohibited. Do not invent registration numbers, racer
 * details, exhibition values, motor ratings, weather, results, or review facts.
 * Keep missing values as undefined/null/"unknown" and represent source gaps
 * with sourceStatus, coverageStatus, and SAMPLE_WARNING signals.
 */

export type BoatExSourceType = "official" | "user" | "derived";

export type BoatExSourceStatus =
	| "available"
	| "pending"
	| "not-published"
	| "not-supported"
	| "parse-empty"
	| "http-error"
	| "unknown"
	| "user-only"
	| "derived-ready"
	| "insufficient-sample";

export type BoatExCoverageStatus =
	| "complete"
	| "partial"
	| "missing"
	| "not-supported"
	| "unknown";

export interface BoatExSourceMeta {
	sourceName: string;
	sourceType: BoatExSourceType;
	sourceUrl?: string;
	sourcePath?: string;
	fetchedAt?: string;
	generatedAt?: string;
	createdAt?: string;
	sourceStatus: BoatExSourceStatus;
	coverageStatus: BoatExCoverageStatus;
	note?: string;
}

export type BoatExVenueCode = string;
export type BoatExRaceKey = string;
export type BoatExDateKey = string;

export type BoatExSessionType = "morning" | "day" | "night" | "unknown";

export type BoatExRaceStage =
	| "qualifying"
	| "general"
	| "semi-final"
	| "final"
	| "selection"
	| "unknown";

export type BoatExForecastTiming =
	| "pre-exhibition"
	| "post-exhibition"
	| "result-final"
	| "unknown";

export type BoatExLane = 1 | 2 | 3 | 4 | 5 | 6;

export type BoatExHitStatus = "hit" | "miss" | "pending" | "parse-warning" | "unknown";

export type BoatExYesNoUnknown = "yes" | "no" | "unknown";

export interface BoatExBet {
	betType: string;
	combination: string;
	amountYen?: number;
	sourceLine?: string;
}

export interface BoatExOddsItem {
	betType: string;
	combination: string;
	odds?: string | number | null;
	popularity?: number | string;
	sourceStatus?: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExPayout {
	betType: string;
	combination?: string;
	payoutYen?: number | null;
	popularity?: number | string;
	sourceStatus?: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawOfficialRacer {
	lane: BoatExLane;
	racerName: string;
	registrationNumber?: string | null;
	branch?: string | null;
	className?: string | null;
	motorNo?: string | null;
	boatNo?: string | null;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawOfficialRace {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	venueName: string;
	raceNo: number;
	title?: string;
	deadlineAt?: string;
	startAt?: string;
	racers: BoatExRawOfficialRacer[];
	sources: BoatExSourceMeta[];
}

export interface BoatExRawOfficialResult {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	raceNo: number;
	finishOrder: BoatExLane[];
	trifecta?: string | null;
	payout?: BoatExPayout[];
	winningTechnique?: string | null;
	approachOrder?: BoatExLane[] | null;
	startTiming?: Partial<Record<BoatExLane, string | number | null>>;
	refunds?: string[];
	finalOdds?: BoatExOddsItem[];
	sources: BoatExSourceMeta[];
}

export interface BoatExRawOfficialExhibitionEntry {
	lane: BoatExLane;
	racerName?: string | null;
	exhibitionTime?: string | number | null;
	oneLapTime?: string | number | null;
	turnTime?: string | number | null;
	straightTime?: string | number | null;
	startTiming?: string | number | null;
	course?: number | string | null;
	weight?: string | number | null;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExStartExhibitionEntry {
	course: number | string;
	lane: BoatExLane;
	startTiming?: string | number | null;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawOfficialExhibition {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	raceNo: number;
	entries: BoatExRawOfficialExhibitionEntry[];
	startExhibition?: BoatExStartExhibitionEntry[];
	tilt?: Partial<Record<BoatExLane, string | number | null>>;
	partsExchange?: Partial<Record<BoatExLane, string | null>>;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawOfficialWeather {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	raceNo?: number;
	weather?: string | null;
	windDirection?: string | null;
	windSpeedMps?: number | null;
	waveHeightCm?: number | null;
	airTemperatureC?: number | null;
	waterTemperatureC?: number | null;
	stableBoard?: boolean | null;
	observedAt?: string;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawUserPrediction {
	date: BoatExDateKey;
	venueName: string;
	venueCode?: BoatExVenueCode;
	raceNo: number;
	forecastTiming: BoatExForecastTiming;
	predictionText?: string;
	bets?: BoatExBet[];
	memo?: string;
	sourcePath?: string;
	createdAt?: string;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawUserSummary {
	date: BoatExDateKey;
	venueName: string;
	venueCode?: BoatExVenueCode;
	raceNo?: number;
	summaryText: string;
	nextFixes?: string[];
	sourcePath: string;
	createdAt?: string;
	sources: BoatExSourceMeta[];
}

export interface BoatExRawUserReview {
	date: BoatExDateKey;
	venueName: string;
	venueCode?: BoatExVenueCode;
	raceNo: number;
	hitStatus: BoatExHitStatus;
	returnAmount?: number | null;
	stakeAmount?: number | null;
	memo?: string;
	sources: BoatExSourceMeta[];
}

export interface BoatExCourseStats {
	course: number | string;
	startCount?: number;
	winRate?: number | null;
	top3Rate?: number | null;
	averageStartTiming?: string | number | null;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExRacer {
	lane: BoatExLane;
	racerName: string;
	registrationNumber?: string | null;
	branch?: string | null;
	className?: string | null;
	age?: number | string | null;
	averageStartTiming?: string | number | null;
	localWaterCompatibility?: string | null;
	courseStats?: BoatExCourseStats[];
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExMotor {
	lane: BoatExLane;
	motorNo?: string | null;
	secondRate?: number | string | null;
	thirdRate?: number | string | null;
	winRate?: number | string | null;
	legComment?: string | null;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExBoat {
	lane: BoatExLane;
	boatNo?: string | null;
	secondRate?: number | string | null;
	thirdRate?: number | string | null;
	winRate?: number | string | null;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExWaterSurface {
	waterType?: string | null;
	tide?: string | null;
	stableBoard?: boolean | null;
	memo?: string;
	sourceStatus: BoatExSourceStatus;
	sources: BoatExSourceMeta[];
}

export interface BoatExReview {
	hitStatus: BoatExHitStatus;
	returnAmount?: number | null;
	stakeAmount?: number | null;
	profitAmount?: number | null;
	roi?: number | null;
	memo?: string;
	sources: BoatExSourceMeta[];
}

export interface BoatExRaceCoverage {
	officialRace: BoatExCoverageStatus;
	officialResult: BoatExCoverageStatus;
	officialExhibition: BoatExCoverageStatus;
	weather: BoatExCoverageStatus;
	waterSurface: BoatExCoverageStatus;
	motor: BoatExCoverageStatus;
	boat: BoatExCoverageStatus;
	racer: BoatExCoverageStatus;
	prediction: BoatExCoverageStatus;
	summary: BoatExCoverageStatus;
	review: BoatExCoverageStatus;
	derivedSignals: BoatExCoverageStatus;
}

export interface BoatExRaceRecord {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	venueName: string;
	raceNo: number;
	raceKey: BoatExRaceKey;
	raceGrade?: string;
	raceStage?: BoatExRaceStage;
	sessionType: BoatExSessionType;
	officialRace?: BoatExRawOfficialRace;
	officialResult?: BoatExRawOfficialResult;
	officialExhibition?: BoatExRawOfficialExhibition;
	weather?: BoatExRawOfficialWeather;
	waterSurface?: BoatExWaterSurface;
	motor?: BoatExMotor[];
	boat?: BoatExBoat[];
	racer?: BoatExRacer[];
	prediction?: BoatExRawUserPrediction;
	summary?: BoatExRawUserSummary;
	review?: BoatExReview;
	derivedSignals?: BoatExPredictionSignal[];
	sources: BoatExSourceMeta[];
	coverage: BoatExRaceCoverage;
}

export interface BoatExVenueBias {
	venueCode: BoatExVenueCode;
	venueName: string;
	sampleSize: number;
	periodStart: BoatExDateKey;
	periodEnd: BoatExDateKey;
	lane1WinRate?: number | null;
	lane2SashiRate?: number | null;
	outsideFrameInTop3Rate?: number | null;
	trifectaOver10000Rate?: number | null;
	winningTechniqueCounts?: Record<string, number>;
	approachFixedRate?: number | null;
	sourceStatus: BoatExSourceStatus;
	sampleWarning?: string;
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export type BoatExRoughIndexScope = "race" | "venue" | "date" | "period";

export interface BoatExRoughIndex {
	scope: BoatExRoughIndexScope;
	date?: BoatExDateKey;
	venueCode?: BoatExVenueCode;
	raceNo?: number;
	sampleSize: number;
	roughScore: number;
	trifectaOver10000Rate?: number | null;
	outsideFrameRate?: number | null;
	favoriteLoseRate?: number | null;
	weatherAdjusted?: boolean;
	sampleWarning?: string;
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export interface BoatExWeatherTrend {
	venueCode?: BoatExVenueCode;
	conditionKey: string;
	windDirection?: string | null;
	windSpeedBand?: string | null;
	waveHeightBand?: string | null;
	sampleSize: number;
	lane1WinRate?: number | null;
	outsideFrameRate?: number | null;
	roughScore?: number | null;
	sampleWarning?: string;
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export interface BoatExTodayFlow {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	raceCount: number;
	lane1WinCount: number;
	outsideFrameCount: number;
	trifectaOver10000Count: number;
	trendLabel: string;
	caution: string[];
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export type BoatExPredictionSignalCategory =
	| "PRIMARY"
	| "CAUTION"
	| "SAMPLE_WARNING"
	| "CONFLICT";

export type BoatExSignalSeverity = "low" | "medium" | "high";

export type BoatExSignalConfidence = "low" | "medium" | "high" | "unknown";

export interface BoatExSignalEvidence {
	field: string;
	value: string | number | boolean | null;
	source: BoatExSourceMeta;
	note?: string;
}

export interface BoatExPredictionSignal {
	id: string;
	raceKey: BoatExRaceKey;
	category: BoatExPredictionSignalCategory;
	label: string;
	severity: BoatExSignalSeverity;
	confidence: BoatExSignalConfidence;
	evidence: BoatExSignalEvidence[];
	coverageStatus: BoatExCoverageStatus;
	generatedAt: string;
}

export interface BoatExReviewDiff {
	raceKey: BoatExRaceKey;
	date: BoatExDateKey;
	venueCode?: BoatExVenueCode;
	venueName: string;
	raceNo: number;
	hitStatus: BoatExHitStatus;
	whyHit?: string;
	whyMiss?: string;
	couldFixWithExhibition: BoatExYesNoUnknown;
	preExhibitionPriorityShouldHaveBeen?: string[];
	venueBiasMisread?: BoatExYesNoUnknown;
	motorOverestimated?: BoatExYesNoUnknown;
	weatherMissed?: BoatExYesNoUnknown;
	lane1OverOrUnderEstimated?: "over" | "under" | "no" | "unknown";
	outsideFrameWarningMissed?: BoatExYesNoUnknown;
	nextFixes: string[];
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export type BoatExCoverageScope = "venue" | "date" | "race" | "source";

export interface BoatExCoverage {
	date: BoatExDateKey;
	venueCode?: BoatExVenueCode;
	venueName?: string;
	raceNo?: number;
	scope: BoatExCoverageScope;
	official: Record<string, BoatExSourceStatus>;
	user: Record<string, BoatExSourceStatus>;
	derived: Record<string, BoatExSourceStatus>;
	completeness: number;
	warnings: string[];
	generatedAt: string;
}

export type BoatExFileKind =
	| "raw-official"
	| "raw-user"
	| "history"
	| "derived"
	| "signals"
	| "coverage"
	| "ui";

export interface BoatExFileManifestEntry {
	path: string;
	kind: BoatExFileKind;
	date?: BoatExDateKey;
	venueCode?: BoatExVenueCode;
	raceNo?: number;
	generatedAt: string;
	sourceStatus: BoatExSourceStatus;
	coverageStatus: BoatExCoverageStatus;
}

export interface BoatExRawOfficialBundle {
	races?: BoatExRawOfficialRace[];
	results?: BoatExRawOfficialResult[];
	exhibitions?: BoatExRawOfficialExhibition[];
	weather?: BoatExRawOfficialWeather[];
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export interface BoatExRawUserBundle {
	predictions?: BoatExRawUserPrediction[];
	summaries?: BoatExRawUserSummary[];
	reviews?: BoatExRawUserReview[];
	sources: BoatExSourceMeta[];
	generatedAt: string;
}

export interface BoatExDerivedBundle {
	venueBias?: BoatExVenueBias[];
	roughIndex?: BoatExRoughIndex[];
	weatherTrend?: BoatExWeatherTrend[];
	todayFlow?: BoatExTodayFlow[];
	reviewDiff?: BoatExReviewDiff[];
	sources: BoatExSourceMeta[];
	generatedAt: string;
}
