import type { BoatRacerItem } from "./boatraceTypes";

export type OfficialBeforeInfoScoreRow = {
	frameNo: number;
	registrationNo?: string;
	playerName: string;
	className: string;
	averageStart: string;
	winRate: string;
	secondRate: string;
	motorNo: string;
	motorSecondRate: string;
};

export type VenueOriginalExhibitionRow = {
	frameNo: number;
	className?: string;
	playerName?: string;
	registerNo?: string;
	weight?: string;
	motorNo?: string;
	memo?: string;
	profile?: string;
};

export type VenueStartExhibitionRow = {
	frameNo: number;
	playerName?: string;
	className?: string;
	registerNo?: string;
	currentAverageStart: string;
};

export type VenueMotorSummaryRow = {
	frameNo: number;
	displayFrameNo?: number;
	motorNo: string;
	comment: string;
};

export type VenueRacerCommentRow = {
	frameNo: number;
	comment: string;
};

export type CommonRaceFallbackReason = "official-before-info" | "venue-extras" | null;

export type CommonRaceFallbackInput = {
	racers?: BoatRacerItem[];
	officialBeforeInfoScoreRows?: OfficialBeforeInfoScoreRow[];
	originalExhibitionRows?: VenueOriginalExhibitionRow[];
	startExhibitionRows?: VenueStartExhibitionRow[];
	motorSummaryRows?: VenueMotorSummaryRow[];
	racerCommentRows?: VenueRacerCommentRow[];
};

export type CommonRaceFallbackResult = {
	racers: BoatRacerItem[];
	reason: CommonRaceFallbackReason;
};

export function isRaceEntryMissingOrThin(racers?: BoatRacerItem[]) {
	if (!racers || racers.length === 0) {
		return true;
	}

	if (racers.length < 6) {
		return true;
	}

	const nameCount = racers.filter((racer) => isMeaningfulPlayerName(racer.name, racer.frameNo)).length;
	const classCount = racers.filter((racer) => isMeaningfulValue(racer.class)).length;
	const averageStartCount = racers.filter((racer) => isMeaningfulValue(racer.averageStart)).length;
	const winRateCount = racers.filter((racer) => isMeaningfulValue(racer.winRate) || isMeaningfulValue(racer.secondRate)).length;
	const motorCount = racers.filter((racer) => isMeaningfulValue(racer.motorNo) || isMeaningfulValue(racer.motorSecondRate)).length;

	if (nameCount < 3 || classCount < 3 || averageStartCount < 3 || motorCount < 3) {
		return true;
	}

	return racers.every((racer) => {
		const hasName = isMeaningfulPlayerName(racer.name, racer.frameNo);
		const hasClass = isMeaningfulValue(racer.class);
		const hasAverageStart = isMeaningfulValue(racer.averageStart);
		const hasWinRate = isMeaningfulValue(racer.winRate);
		const hasSecondRate = isMeaningfulValue(racer.secondRate);
		const hasMotorNo = isMeaningfulValue(racer.motorNo);

		return !hasName && !hasClass && !hasAverageStart && !hasWinRate && !hasSecondRate && !hasMotorNo;
	});
}

export function buildCommonRaceFallbackRacers(input: CommonRaceFallbackInput): CommonRaceFallbackResult {
	const officialBeforeInfoScoreRows = input.officialBeforeInfoScoreRows ?? [];
	const originalExhibitionRows = input.originalExhibitionRows ?? [];
	const startExhibitionRows = input.startExhibitionRows ?? [];
	const motorSummaryRows = input.motorSummaryRows ?? [];
	const racerCommentRows = input.racerCommentRows ?? [];

	if (!isRaceEntryMissingOrThin(input.racers)) {
		return { racers: [], reason: null };
	}

	const officialBeforeInfoRacers = buildOfficialBeforeInfoFallback({
		baseRacers: input.racers ?? [],
		officialBeforeInfoScoreRows,
		originalExhibitionRows,
	});

	if (officialBeforeInfoRacers.length > 0) {
		return {
			racers: officialBeforeInfoRacers,
			reason: "official-before-info",
		};
	}

	const venueExtrasRacers = buildVenueExtrasFallback({
		baseRacers: input.racers ?? [],
		originalExhibitionRows,
		startExhibitionRows,
		motorSummaryRows,
		racerCommentRows,
	});

	if (venueExtrasRacers.length > 0) {
		return {
			racers: venueExtrasRacers,
			reason: "venue-extras",
		};
	}

	return { racers: [], reason: null };
}

function buildOfficialBeforeInfoFallback(input: {
	baseRacers: BoatRacerItem[];
	officialBeforeInfoScoreRows: OfficialBeforeInfoScoreRow[];
	originalExhibitionRows: VenueOriginalExhibitionRow[];
}) {
	const baseRacersByFrameNo = new Map(input.baseRacers.map((row) => [row.frameNo, row] as const));
	const officialByFrameNo = new Map(input.officialBeforeInfoScoreRows.map((row) => [row.frameNo, row] as const));
	const exhibitionByFrameNo = new Map(input.originalExhibitionRows.map((row) => [row.frameNo, row] as const));
	const frameNumbers = new Set<BoatRacerItem["frameNo"]>();

	for (const row of input.baseRacers) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of input.officialBeforeInfoScoreRows) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	if (input.officialBeforeInfoScoreRows.length < 6) {
		for (const row of input.originalExhibitionRows) {
			frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
		}
	}

	return Array.from(frameNumbers)
		.sort((left, right) => left - right)
		.map((frameNo) => {
			const baseRacer = baseRacersByFrameNo.get(frameNo);
			const officialRow = officialByFrameNo.get(frameNo);
			const exhibitionRow = exhibitionByFrameNo.get(frameNo);
			const playerName = firstMeaningfulPlayerName(frameNo, baseRacer?.name, officialRow?.playerName, exhibitionRow?.playerName) || `枠${frameNo}`;

			return {
				frameNo,
				boatNo: baseRacer?.boatNo || "-",
				name: playerName,
				branch: firstMeaningfulValue(baseRacer?.branch, parseProfilePart(exhibitionRow?.profile, 1)) || "-",
				class: firstMeaningfulValue(baseRacer?.class, officialRow?.className, exhibitionRow?.className, parseProfilePart(exhibitionRow?.profile, 0)) || "-",
				age: firstMeaningfulValue(baseRacer?.age, parseProfilePart(exhibitionRow?.profile, 3)) || "-",
				weight: firstMeaningfulValue(baseRacer?.weight, exhibitionRow?.weight) || "-",
				averageStart: firstMeaningfulValue(baseRacer?.averageStart, officialRow?.averageStart) || "-",
				winRate: firstMeaningfulValue(baseRacer?.winRate, officialRow?.winRate) || "-",
				secondRate: firstMeaningfulValue(baseRacer?.secondRate, officialRow?.secondRate) || "-",
				motorNo: firstMeaningfulValue(baseRacer?.motorNo, officialRow?.motorNo, exhibitionRow?.motorNo) || "-",
				motorSecondRate: firstMeaningfulValue(baseRacer?.motorSecondRate, officialRow?.motorSecondRate) || "-",
				boatMotorNo: firstMeaningfulValue(baseRacer?.boatMotorNo) || "-",
				boatSecondRate: firstMeaningfulValue(baseRacer?.boatSecondRate) || "-",
				comment: firstMeaningfulValue(baseRacer?.comment) || "",
			};
		})
		.filter((row) => isMeaningfulPlayerName(row.name, row.frameNo) || row.averageStart !== "-" || row.winRate !== "-" || row.secondRate !== "-" || row.motorNo !== "-");
}

function buildVenueExtrasFallback(input: {
	baseRacers: BoatRacerItem[];
	originalExhibitionRows: VenueOriginalExhibitionRow[];
	startExhibitionRows: VenueStartExhibitionRow[];
	motorSummaryRows: VenueMotorSummaryRow[];
	racerCommentRows: VenueRacerCommentRow[];
}) {
	const baseRacersByFrameNo = new Map(input.baseRacers.map((row) => [row.frameNo, row] as const));
	const exhibitionByFrameNo = new Map(input.originalExhibitionRows.map((row) => [row.frameNo, row] as const));
	const startByFrameNo = new Map(input.startExhibitionRows.map((row) => [row.frameNo, row] as const));
	const motorByFrameNo = new Map(input.motorSummaryRows.map((row) => [row.displayFrameNo ?? row.frameNo, row] as const));
	const commentByFrameNo = new Map(input.racerCommentRows.map((row) => [row.frameNo, row] as const));
	const frameNumbers = new Set<BoatRacerItem["frameNo"]>();

	for (const row of input.baseRacers) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of input.originalExhibitionRows) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of input.startExhibitionRows) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	for (const row of input.motorSummaryRows) {
		frameNumbers.add((row.displayFrameNo ?? row.frameNo) as BoatRacerItem["frameNo"]);
	}

	for (const row of input.racerCommentRows) {
		frameNumbers.add(row.frameNo as BoatRacerItem["frameNo"]);
	}

	return Array.from(frameNumbers)
		.sort((left, right) => left - right)
		.map((frameNo) => {
			const baseRacer = baseRacersByFrameNo.get(frameNo);
			const exhibitionRow = exhibitionByFrameNo.get(frameNo);
			const startRow = startByFrameNo.get(frameNo);
			const motorRow = motorByFrameNo.get(frameNo);
			const commentRow = commentByFrameNo.get(frameNo);
			const playerName = firstMeaningfulPlayerName(frameNo, baseRacer?.name, exhibitionRow?.playerName, startRow?.playerName) || "-";

			return {
				frameNo,
				boatNo: baseRacer?.boatNo || "-",
				name: playerName,
				branch: firstMeaningfulValue(baseRacer?.branch, parseProfilePart(exhibitionRow?.profile, 1)) || "-",
				class: firstMeaningfulValue(baseRacer?.class, exhibitionRow?.className, startRow?.className, parseProfilePart(exhibitionRow?.profile, 0)) || "-",
				age: firstMeaningfulValue(baseRacer?.age, parseProfilePart(exhibitionRow?.profile, 3)) || "-",
				weight: firstMeaningfulValue(baseRacer?.weight, exhibitionRow?.weight) || "-",
				averageStart: firstMeaningfulValue(baseRacer?.averageStart, startRow?.currentAverageStart) || "-",
				winRate: firstMeaningfulValue(baseRacer?.winRate) || "-",
				secondRate: firstMeaningfulValue(baseRacer?.secondRate) || "-",
				motorNo: firstMeaningfulValue(baseRacer?.motorNo, exhibitionRow?.motorNo, motorRow?.motorNo) || "-",
				motorSecondRate: firstMeaningfulValue(baseRacer?.motorSecondRate) || "-",
				boatMotorNo: firstMeaningfulValue(baseRacer?.boatMotorNo) || "-",
				boatSecondRate: firstMeaningfulValue(baseRacer?.boatSecondRate) || "-",
				comment: firstMeaningfulValue(baseRacer?.comment, commentRow?.comment, motorRow?.comment, exhibitionRow?.memo) || "",
			};
		})
		.filter((row) => row.name !== "-" || row.averageStart !== "-" || row.motorNo !== "-" || Boolean(row.comment));
}

function firstMeaningfulPlayerName(frameNo: number, ...values: Array<string | undefined>) {
	for (const value of values) {
		if (isMeaningfulPlayerName(value, frameNo)) {
			return value?.trim();
		}
	}

	return undefined;
}

function firstMeaningfulValue(...values: Array<string | number | undefined>) {
	for (const value of values) {
		if (isMeaningfulValue(value)) {
			return String(value).trim();
		}
	}

	return undefined;
}

function isMeaningfulValue(value: string | number | undefined) {
	if (value === undefined || value === null) {
		return false;
	}

	const normalizedValue = String(value).replace(/\s+/g, "").trim();

	if (!normalizedValue) {
		return false;
	}

	return normalizedValue !== "-" && normalizedValue !== "--";
}

function parseProfilePart(profile: string | undefined, index: number) {
	if (!profile) {
		return "-";
	}

	const parts = profile.split("/").map((value) => value.trim()).filter(Boolean);
	return parts[index] || "-";
}

function isMeaningfulPlayerName(playerName: string | undefined, frameNo: number) {
	if (!playerName) {
		return false;
	}

	const normalizedName = playerName.replace(/\s+/g, "").trim();

	if (!normalizedName || normalizedName === "-") {
		return false;
	}

	return normalizedName !== `枠${frameNo}` && normalizedName !== `${frameNo}号艇`;
}