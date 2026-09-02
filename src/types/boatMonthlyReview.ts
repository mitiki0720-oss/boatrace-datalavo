export type BoatMonthlyPeriod = {
	start: string;
	end: string;
};
export type BoatMonthlyMethod = {
	ticket_judgement?: string;
	result_hit_miss?: string;
	classification?: string;
};

export type BoatMonthlyPerformance = {
	races: number | null;
	hits: number | null;
	hit_rate_pct: number | null;
	investment_yen: number | null;
	return_yen: number | null;
	profit_yen: number | null;
	roi_pct: number | null;
	avg_hit_payout_yen?: number | null;
	actual_1boat_win_rate_pct?: number | null;
};

export type BoatMonthlyOverview = BoatMonthlyPerformance & {
	month: string;
	TICKET_HIT: number | null;
	STRUCTURE_MISS: number | null;
	READ_MISS: number | null;
	DATA_HOLD: number | null;
	structure_miss_rate_pct: number | null;
	read_miss_rate_pct: number | null;
	pre_prediction_rate_pct: number | null;
	venues: number | null;
	days: number | null;
};

export type BoatMonthlyVenuePerformance = BoatMonthlyPerformance & {
	month?: string;
	venue: string;
	TICKET_HIT: number | null;
	STRUCTURE_MISS: number | null;
	READ_MISS: number | null;
	DATA_HOLD: number | null;
	days: number | null;
};

export type BoatMonthlyPayoutBand = BoatMonthlyPerformance & {
	payout_band: string;
};

export type BoatMonthlyTicketRole = {
	role: string;
	tickets: number | null;
	hits: number | null;
	per_ticket_hit_rate_pct: number | null;
	investment_yen: number | null;
	return_yen: number | null;
	roi_pct: number | null;
};

export type BoatMonthlyMissAnalysis = {
	month: string;
	classification: "TICKET_HIT" | "STRUCTURE_MISS" | "READ_MISS" | "DATA_HOLD" | string;
	races: number | null;
	rate_pct: number | null;
};

export type BoatMonthlyOneBoatAnalysis = BoatMonthlyPerformance & {
	month: string;
	result_type: string;
	avg_1boat_head_tickets?: number | null;
};

export type BoatMonthlyWindBand = BoatMonthlyPerformance & {
	month: string;
	wind_band: string;
};

export type BoatMonthlyPredictionMode = BoatMonthlyPerformance & {
	month: string;
	prediction_mode: string;
};

export type BoatMonthlyDisplayAudit = {
	month: string;
	races: number | null;
	st_comparable_races: number | null;
	coverage_pct: number | null;
	avg_abs_st_delta: number | string | null;
	races_with_large_st_delta_boat: number | null;
	display_f_total: number | null;
	actual_f_total: number | null;
	display_entry_change_races: number | null;
	actual_entry_change_races: number | null;
};

export type BoatMonthlyWinnerMotorBand = BoatMonthlyPerformance & {
	winner_motor_2rate_band: string;
};

export type BoatMonthlyDataQuality = {
	item: string;
	count: number | null;
	note: string;
};

export type BoatMonthlyNextKpi = {
	KPI: string;
	baseline: string;
	next_target: string;
	meaning: string;
};

export type BoatMonthlyReviewData = {
	generated_at: string;
	period: BoatMonthlyPeriod;
	method: BoatMonthlyMethod;
	monthlyOverview: BoatMonthlyOverview[];
	venueMonthly: BoatMonthlyVenuePerformance[];
	venueAllPeriod: BoatMonthlyVenuePerformance[];
	payoutBands: BoatMonthlyPayoutBand[];
	ticketRoles: BoatMonthlyTicketRole[];
	missAnalysis: BoatMonthlyMissAnalysis[];
	oneBoatAnalysis: BoatMonthlyOneBoatAnalysis[];
	windBands: BoatMonthlyWindBand[];
	predictionModes: BoatMonthlyPredictionMode[];
	displayAudit: BoatMonthlyDisplayAudit[];
	winnerMotorBands: BoatMonthlyWinnerMotorBand[];
	dataQuality: BoatMonthlyDataQuality[];
	nextKpi: BoatMonthlyNextKpi[];
	windDirections?: BoatMonthlyWindBand[];
	waveBands?: BoatMonthlyWindBand[];
	schemaVersion?: string;
	version?: string;
};

export type BoatMonthlyReviewManifest = {
	generated_at?: string;
	files?: Record<string, { bytes?: number }>;
};
