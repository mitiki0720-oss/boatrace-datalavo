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

	return racers.every((racer) => {
		const hasName = isMeaningfulPlayerName(racer.name, racer.frameNo);
		const hasClass = Boolean((racer.class || "").trim() && racer.class !== "-");
		const hasAverageStart = Boolean((racer.averageStart || "").trim() && racer.averageStart !== "-");
		const hasWinRate = Boolean((racer.winRate || "").trim() && racer.winRate !== "-");
		const hasSecondRate = Boolean((racer.secondRate || "").trim() && racer.secondRate !== "-");
		const hasMotorNo = Boolean((racer.motorNo || "").trim() && racer.motorNo !== "-");

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
	officialBeforeInfoScoreRows: OfficialBeforeInfoScoreRow[];
	originalExhibitionRows: VenueOriginalExhibitionRow[];
}) {
	const officialByFrameNo = new Map(input.officialBeforeInfoScoreRows.map((row) => [row.frameNo, row] as const));
	const exhibitionByFrameNo = new Map(input.originalExhibitionRows.map((row) => [row.frameNo, row] as const));
	const frameNumbers = new Set<BoatRacerItem["frameNo"]>();

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
			const officialRow = officialByFrameNo.get(frameNo);
			const exhibitionRow = exhibitionByFrameNo.get(frameNo);
			const playerName = isMeaningfulPlayerName(officialRow?.playerName, frameNo)
				? officialRow?.playerName || `枠${frameNo}`
				: isMeaningfulPlayerName(exhibitionRow?.playerName, frameNo)
					? exhibitionRow?.playerName || `枠${frameNo}`
					: `枠${frameNo}`;

			return {
				frameNo,
				boatNo: "-",
				name: playerName,
				branch: parseProfilePart(exhibitionRow?.profile, 1),
				class: officialRow?.className || exhibitionRow?.className || parseProfilePart(exhibitionRow?.profile, 0) || "-",
				age: parseProfilePart(exhibitionRow?.profile, 3),
				weight: exhibitionRow?.weight || "-",
				averageStart: officialRow?.averageStart || "-",
				winRate: officialRow?.winRate || "-",
				secondRate: officialRow?.secondRate || "-",
				motorNo: officialRow?.motorNo || exhibitionRow?.motorNo || "-",
				motorSecondRate: officialRow?.motorSecondRate || "-",
				boatMotorNo: "-",
				boatSecondRate: "-",
			};
		})
		.filter((row) => isMeaningfulPlayerName(row.name, row.frameNo) || row.averageStart !== "-" || row.winRate !== "-" || row.secondRate !== "-" || row.motorNo !== "-");
}

function buildVenueExtrasFallback(input: {
	originalExhibitionRows: VenueOriginalExhibitionRow[];
	startExhibitionRows: VenueStartExhibitionRow[];
	motorSummaryRows: VenueMotorSummaryRow[];
	racerCommentRows: VenueRacerCommentRow[];
}) {
	const exhibitionByFrameNo = new Map(input.originalExhibitionRows.map((row) => [row.frameNo, row] as const));
	const startByFrameNo = new Map(input.startExhibitionRows.map((row) => [row.frameNo, row] as const));
	const motorByFrameNo = new Map(input.motorSummaryRows.map((row) => [row.displayFrameNo ?? row.frameNo, row] as const));
	const commentByFrameNo = new Map(input.racerCommentRows.map((row) => [row.frameNo, row] as const));
	const frameNumbers = new Set<BoatRacerItem["frameNo"]>();

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
			const exhibitionRow = exhibitionByFrameNo.get(frameNo);
			const startRow = startByFrameNo.get(frameNo);
			const motorRow = motorByFrameNo.get(frameNo);
			const commentRow = commentByFrameNo.get(frameNo);
			const playerName = isMeaningfulPlayerName(exhibitionRow?.playerName, frameNo)
				? exhibitionRow?.playerName || "-"
				: isMeaningfulPlayerName(startRow?.playerName, frameNo)
					? startRow?.playerName || "-"
					: "-";

			return {
				frameNo,
				boatNo: "-",
				name: playerName,
				branch: parseProfilePart(exhibitionRow?.profile, 1),
				class: exhibitionRow?.className || startRow?.className || parseProfilePart(exhibitionRow?.profile, 0) || "-",
				age: parseProfilePart(exhibitionRow?.profile, 3),
				weight: exhibitionRow?.weight || "-",
				averageStart: startRow?.currentAverageStart || "-",
				winRate: "-",
				secondRate: "-",
				motorNo: exhibitionRow?.motorNo || motorRow?.motorNo || "-",
				motorSecondRate: "-",
				boatMotorNo: "-",
				boatSecondRate: "-",
				comment: commentRow?.comment || motorRow?.comment || exhibitionRow?.memo || "",
			};
		})
		.filter((row) => row.name !== "-" || row.averageStart !== "-" || row.motorNo !== "-" || Boolean(row.comment));
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

	return normalizedName !== `枠${frameNo}`;
}