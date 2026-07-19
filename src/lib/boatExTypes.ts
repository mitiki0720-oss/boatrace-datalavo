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
	| "pending"
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

export type BoatExDerivedReadinessStatus = "pending" | "insufficient-history";

export interface BoatExDerivedReadiness {
	status: BoatExDerivedReadinessStatus;
	reason: string;
}

export interface BoatExVenueEvidenceCoverage {
	race: "available" | "partial" | "missing" | "pending" | "unknown";
	result: "available" | "partial" | "missing" | "pending" | "unknown";
	exhibition: "available" | "partial" | "missing" | "pending" | "unknown";
	weather: "available" | "partial" | "missing" | "pending" | "unknown";
	motor: "available" | "partial" | "missing" | "pending" | "unknown";
	boat: "available" | "partial" | "missing" | "pending" | "unknown";
	racer: "available" | "partial" | "missing" | "pending" | "unknown";
}

export interface BoatExVenueEvidenceItem {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	venueName: string;
	raceCount: number;
	coverage: BoatExVenueEvidenceCoverage;
	availability: {
		officialRaceCount: number;
		officialResultCount: number;
		officialExhibitionCount: number;
		weatherCount: number;
	};
	resultEvidence: {
		resultAvailableCount: number;
		trifectaAvailableCount: number;
		payoutAvailableCount: number;
		winningTechniqueCounts: Record<string, number>;
		courseWinCounts: Record<string, number>;
		averageTrifectaPayout: number | null;
		maxTrifectaPayout: number | null;
		highPayoutRaceCount: number | null;
	};
	exhibitionEvidence: {
		availableCount: number;
		missingCount: number;
		topExhibitionTimeFrames: Array<{
			frame: number;
			averageExhibitionTime: number;
		}>;
		averageExhibitionTimeByFrame: Record<string, number | null>;
	};
	weatherEvidence: {
		availableCount: number;
		windSpeedAverageMps: number | null;
		windSpeedMaxMps: number | null;
		waveHeightAverageCm: number | null;
		waveHeightMaxCm: number | null;
	};
	derivedReadiness: {
		venueBias: BoatExDerivedReadiness;
		roughIndex: BoatExDerivedReadiness;
		todayFlow: BoatExDerivedReadiness;
		predictionSignals: BoatExDerivedReadiness;
	};
	warnings: string[];
}

export interface BoatExVenueEvidenceFile {
	schemaVersion: 1;
	kind: "boatrace-ex-venue-evidence";
	date: BoatExDateKey;
	generatedAt: string;
	sourceFiles: BoatExSourceMeta[];
	summary: {
		venueCount: number;
		recordCount: number;
		historyDays: number;
		analysisStatus: "insufficient-history" | "missing";
	};
	venues: BoatExVenueEvidenceItem[];
}

export interface BoatExRacerRaceEvidence {
	date: BoatExDateKey;
	venueCode: BoatExVenueCode;
	venueName: string;
	raceNo: number;
	raceKey: BoatExRaceKey;
	frameNo: number;
	finalCourse: number | null;
	exhibitionCourse: number | null;
	finishOrder: number | null;
	startTiming: number | null;
	exhibitionTime: number | null;
	motorNo: string | null;
	boatNo: string | null;
	sourceStatus: "available" | "partial" | "missing";
}

export interface BoatExRacerCourseChangeEvidence {
	availableCount: number;
	frameToFinalCourseChangedCount: number | null;
	exhibitionToFinalCourseChangedCount: number | null;
	examples: Array<{
		raceKey: BoatExRaceKey;
		frameNo: number;
		finalCourse?: number | null;
		exhibitionCourse?: number | null;
	}>;
	sourceStatus: "partial" | "missing";
	note: string;
}

export interface BoatExRacerDerivedReadiness {
	racerProfile: BoatExDerivedReadiness;
	courseChangePattern: BoatExDerivedReadiness;
	exhibitionReliability: BoatExDerivedReadiness;
	startTimingPattern: BoatExDerivedReadiness;
	predictionSignals: BoatExDerivedReadiness;
}

export interface BoatExRacerEvidenceItem {
	racerKey: string;
	identityStatus: "verified" | "unverified";
	registrationNumber: string | null;
	racerName: string;
	branch: string | null;
	className: string | null;
	age: string | number | null;
	appearanceCount: number;
	venues: Array<{
		venueCode: BoatExVenueCode;
		venueName: string;
		raceCount: number;
	}>;
	frames: Record<string, {
		count: number;
		resultAvailableCount: number;
		exhibitionAvailableCount: number;
	}>;
	raceEvidence: BoatExRacerRaceEvidence[];
	startEvidence: {
		availableCount: number;
		averageST: number | null;
		minST: number | null;
		maxST: number | null;
		lateStartCount: number | null;
		flyingOrLateCount: number | null;
		sourceStatus: "partial" | "missing";
	};
	exhibitionEvidence: {
		availableCount: number;
		averageExhibitionTime: number | null;
		bestExhibitionTime: number | null;
		sourceStatus: "partial" | "missing";
	};
	courseChangeEvidence: BoatExRacerCourseChangeEvidence;
	resultEvidence: {
		availableCount: number;
		finishCounts: Record<string, number>;
		top3Count: number;
		winCount: number;
		sourceStatus: "partial" | "missing";
	};
	motorBoatEvidence: {
		motorNos: string[];
		boatNos: string[];
		sourceStatus: "partial" | "missing";
	};
	derivedReadiness: BoatExRacerDerivedReadiness;
	warnings: string[];
}

export interface BoatExRacerEvidenceFile {
	schemaVersion: 1;
	kind: "boatrace-ex-racer-evidence";
	date: BoatExDateKey;
	generatedAt: string;
	sourceFiles: BoatExSourceMeta[];
	summary: {
		racerCount: number;
		appearanceCount: number;
		historyDays: number;
		analysisStatus: "insufficient-history" | "missing";
	};
	racers: BoatExRacerEvidenceItem[];
}

export type BoatExVenueBiasReadinessStatus = "ready" | "insufficient-history";

export interface BoatExVenueBiasReadiness {
	status: BoatExVenueBiasReadinessStatus;
	reason: string;
	minDateCount?: number;
}

export type BoatExBoatNumberCounts = Record<"1" | "2" | "3" | "4" | "5" | "6", number>;
export type BoatExBoatNumberRates = Record<"1" | "2" | "3" | "4" | "5" | "6", number | null>;

export interface BoatExVenueBiasV1Item {
	venueId: BoatExVenueCode;
	venueName: string;
	dateCount: number;
	raceCount: number;
	resultAvailableRaceCount: number;
	exhibitionAvailableRaceCount: number;
	readiness: BoatExVenueBiasReadiness;
	firstPlaceBoatNumberCounts: BoatExBoatNumberCounts;
	firstPlaceBoatNumberRates: BoatExBoatNumberRates;
	top3BoatNumberCounts: BoatExBoatNumberCounts;
	top3BoatNumberRates: BoatExBoatNumberRates;
}

export interface BoatExVenueBiasV1File {
	schemaVersion: "boat-ex-venue-bias-v1";
	generatedAt: string;
	status: "available";
	readiness: BoatExVenueBiasReadiness;
	dateRange: {
		from: BoatExDateKey;
		to: BoatExDateKey;
		dates: BoatExDateKey[];
		dateCount: number;
	};
	summary: {
		raceCount: number;
		venueCount: number;
		resultAvailableRaceCount: number;
		exhibitionAvailableRaceCount: number;
	};
	venues: BoatExVenueBiasV1Item[];
	sourceFiles: string[];
	warnings: string[];
}

export type BoatExRoughIndexReadinessStatus = "ready" | "insufficient-history";

export interface BoatExRoughIndexReadiness {
        status: BoatExRoughIndexReadinessStatus;
        reason: string;
        minDateCount: number;
        minPayoutRaceCount: number;
}

export interface BoatExRoughIndexV1Item {
        venueId: BoatExVenueCode;
        venueName: string;
        dateCount: number;
        raceCount: number;
        resultAvailableRaceCount: number;
        payoutAvailableRaceCount: number;
        trifectaAvailableRaceCount: number;
        trifectaOver10000RaceCount: number;
        readiness: BoatExRoughIndexReadiness;
}

export interface BoatExRoughIndexV1File {
        schemaVersion: "boat-ex-rough-index-v1";
        generatedAt: string;
        status: "available";
        readiness: BoatExRoughIndexReadiness;
        dateRange: {
                from: BoatExDateKey;
                to: BoatExDateKey;
                dates: BoatExDateKey[];
                dateCount: number;
        };
        thresholds: {
                minDateCount: number;
                minPayoutRaceCount: number;
                trifectaHighPayoutThreshold: number;
        };
        summary: {
                raceCount: number;
                venueCount: number;
                resultAvailableRaceCount: number;
                payoutAvailableRaceCount: number;
                trifectaAvailableRaceCount: number;
                trifectaOver10000RaceCount: number;
        };
        venues: BoatExRoughIndexV1Item[];
        sourceFiles: string[];
        warnings: string[];
}

export type BoatExTodayFlowReadinessStatus =
	| "ready"
	| "available"
	| "insufficient-history"
	| "pending";

export interface BoatExTodayFlowReadiness {
	status: BoatExTodayFlowReadinessStatus;
	reason: string;
}

export interface BoatExTodayFlowSequenceItem {
	raceNo: number;
	firstPlaceBoat: string | null;
	trifecta: string | null;
	payoutYen: number | null;
}

export interface BoatExTodayFlowVenue {
	venueCode: BoatExVenueCode;
	venueName: string;
	raceCount: number;
	resultAvailableRaceCount: number;
	firstPlaceBoatCounts: BoatExBoatNumberCounts;
	firstPlaceBoatSequence: BoatExTodayFlowSequenceItem[];
	latestKnownRaceNo: number | null;
	recentFirstPlaceBoats: string[];
	insideWinCount: number;
	outsideWinCount: number;
	payoutAvailableRaceCount: number;
	highPayoutRaceCount: number;
	notes: string[];
}

export interface BoatExTodayFlowSourceFile {
	sourceName: string;
	sourcePath: string;
	sourceStatus: string;
	coverageStatus: string;
}

export interface BoatExTodayFlowV1File {
	schemaVersion: "boat-ex-today-flow-v1";
	generatedAt: string;
	status: "available" | "missing" | "error";
	readiness: BoatExTodayFlowReadiness;
	targetDate: BoatExDateKey | null;
	dateRange?: {
		from: BoatExDateKey;
		to: BoatExDateKey;
		dateCount: number;
	};
	summary: {
		venueCount: number;
		raceCount: number;
		resultAvailableRaceCount: number;
		trifectaAvailableRaceCount: number;
		payoutAvailableRaceCount: number;
	};
	venues: BoatExTodayFlowVenue[];
	sourceFiles: BoatExTodayFlowSourceFile[];
	warnings: string[];
}

export type BoatExDateIndexStatus = "available" | "partial" | "missing" | "pending" | "unknown";

export interface BoatExDateIndexSourceState {
	path: string;
	status: BoatExDateIndexStatus;
	recordCount?: number | null;
	venueCount?: number | null;
	racerCount?: number | null;
	appearanceCount?: number | null;
}

export interface BoatExDateIndexReadiness {
	multiDayAnalysis: BoatExDerivedReadinessStatus;
	venueBias: BoatExDerivedReadinessStatus;
	roughIndex: BoatExDerivedReadinessStatus;
	racerProfile: BoatExDerivedReadinessStatus;
	todayFlow: BoatExDerivedReadinessStatus;
	predictionSignals: BoatExDerivedReadinessStatus;
}

export interface BoatExDateIndexEntry {
	date: BoatExDateKey;
	history: BoatExDateIndexSourceState;
	coverage: BoatExDateIndexSourceState;
	venueEvidence: BoatExDateIndexSourceState;
	racerEvidence: BoatExDateIndexSourceState;
	readiness: BoatExDateIndexReadiness;
	warnings: string[];
}

export interface BoatExDateIndexFile {
	schemaVersion: 1;
	kind: "boatrace-ex-date-index";
	generatedAt: string;
	latestDate: BoatExDateKey | null;
	availableDates: BoatExDateKey[];
	summary: {
		dateCount: number;
		historyDateCount: number;
		coverageDateCount: number;
		venueEvidenceDateCount: number;
		racerEvidenceDateCount: number;
	};
	dates: BoatExDateIndexEntry[];
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
