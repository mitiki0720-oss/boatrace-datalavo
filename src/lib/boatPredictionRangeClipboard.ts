export type BoatPredictionRangePresetPayload = {
	key: string;
	label: string;
	materialText: string;
};

const EXPECTED_RACES: Record<string, readonly number[]> = {
	"1r6r": [1, 2, 3, 4, 5, 6],
	"7r12r": [7, 8, 9, 10, 11, 12],
};

const REQUIRED_EX_LABELS = [
	"【KURARI BOAT EX 当日予想coverage】",
	"【KURARI BOAT EX 天候・水面 履歴】",
	"【KURARI BOAT EX 履歴latest-day venue-evidence】",
	"【KURARI BOAT EX レース帯履歴】",
	"【EXレース分析】",
	"【EX選手情報】",
	"【KURARI BOAT EX 選手特徴】",
	"【source-backed / cautions】",
] as const;

export function readBoatPredictionMaterialRaceNumbers(materialText: string): number[] {
	return [...materialText.matchAll(/^レース番号:\s*(\d+)R\s*$/gmu)].map((match) => Number(match[1]));
}

export function assertBoatPredictionRangePayload(preset: BoatPredictionRangePresetPayload): readonly number[] {
	const expected = EXPECTED_RACES[preset.key];
	if (!expected) throw new Error(`未対応のコピー範囲です: ${preset.key}`);
	const actual = readBoatPredictionMaterialRaceNumbers(preset.materialText);
	if (JSON.stringify(actual) !== JSON.stringify(expected)) {
		throw new Error(`${preset.label}素材のレース構成が不正です: ${actual.join(",") || "なし"}`);
	}
	if (!preset.materialText.includes("【GPT素材ヘッダー】") || !preset.materialText.includes("【EX会場共有情報")) {
		throw new Error(`${preset.label}素材の共有ヘッダーが不足しています`);
	}
	for (const raceNo of expected) {
		const marker = `====================\n${raceNo}R\n====================`;
		const start = preset.materialText.indexOf(marker);
		const nextRaceNo = raceNo + 1;
		const end = expected.includes(nextRaceNo)
			? preset.materialText.indexOf(`====================\n${nextRaceNo}R\n====================`, start + marker.length)
			: preset.materialText.length;
		const block = start >= 0 && end >= 0 ? preset.materialText.slice(start, end) : "";
		if (!block.includes("【通常のレース素材】") || !block.includes("【EX参照情報】")) {
			throw new Error(`${raceNo}R素材の通常/EX区分が不足しています`);
		}
		for (const label of REQUIRED_EX_LABELS) {
			if (!block.includes(label)) throw new Error(`${raceNo}R素材に${label}がありません`);
		}
	}
	return expected;
}

export async function copyBoatPredictionRangePreset(
	preset: BoatPredictionRangePresetPayload,
	writeText: (text: string) => Promise<void>,
): Promise<readonly number[]> {
	const raceNumbers = assertBoatPredictionRangePayload(preset);
	await writeText(preset.materialText);
	return raceNumbers;
}
