import { normalizeBoatRaceNo } from "./boatDataFeed";

export const BOAT_PREDICTION_EARLY_RACE_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
export const BOAT_PREDICTION_LATE_RACE_NUMBERS = [7, 8, 9, 10, 11, 12] as const;

export type BoatPredictionRangeMaterialResult<TRace> = {
	materialText: string;
	availableRaces: TRace[];
	generatedRaceCount: number;
	expectedRaceCount: number;
	missingRaceNumbers: number[];
};

export function buildBoatPredictionRaceMaterialSection(params: {
	raceNo: number;
	normalMaterial: string;
	preRaceSupport?: string;
	exMaterial: string;
}): string {
	return [
		"====================",
		`${params.raceNo}R`,
		"====================",
		"【通常のレース素材】",
		params.normalMaterial,
		params.preRaceSupport,
		"【EX参照情報】",
		params.exMaterial,
	].filter((line): line is string => Boolean(line)).join("\n");
}

export function buildBoatPredictionRangeMaterial<TRace extends { raceNo?: unknown }>(params: {
	races: TRace[];
	expectedRaceNumbers: readonly number[];
	buildRaceSection: (race: TRace, raceNo: number) => string;
	buildMissingSection: (raceNo: number) => string;
}): BoatPredictionRangeMaterialResult<TRace> {
	const racesByRaceNo = new Map<number, TRace>();
	for (const race of params.races) {
		const raceNo = normalizeBoatRaceNo(race.raceNo);
		if (raceNo !== null && params.expectedRaceNumbers.includes(raceNo) && !racesByRaceNo.has(raceNo)) {
			racesByRaceNo.set(raceNo, race);
		}
	}

	const availableRaces: TRace[] = [];
	const missingRaceNumbers: number[] = [];
	const sections = params.expectedRaceNumbers.map((raceNo) => {
		const race = racesByRaceNo.get(raceNo);
		if (!race) {
			missingRaceNumbers.push(raceNo);
			return params.buildMissingSection(raceNo);
		}

		availableRaces.push(race);
		return params.buildRaceSection(race, raceNo);
	});

	return {
		materialText: sections.join("\n\n"),
		availableRaces,
		generatedRaceCount: availableRaces.length,
		expectedRaceCount: params.expectedRaceNumbers.length,
		missingRaceNumbers,
	};
}
