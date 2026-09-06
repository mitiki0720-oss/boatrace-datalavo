import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const compiled = ts.transpileModule(read("src/lib/boatPredictionRangeClipboard.ts"), {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const module = { exports: {} };
new Function("exports", "module", compiled)(module.exports, module);
const { copyBoatPredictionRangePreset } = module.exports;

const exLabels = [
	"【KURARI BOAT EX 当日予想coverage】",
	"【KURARI BOAT EX 天候・水面 履歴】",
	"【KURARI BOAT EX 履歴latest-day venue-evidence】",
	"【KURARI BOAT EX レース帯履歴】",
	"【EXレース分析】",
	"【EX選手情報】",
	"【KURARI BOAT EX 選手特徴】",
	"【source-backed / cautions】",
];
const buildPayload = (key, venue, raceNumbers) => ({
	key,
	label: key === "1r6r" ? "1R〜6R" : "7R〜12R",
	materialText: [
		"【GPT素材ヘッダー】",
		`対象会場: ${venue}`,
		`【EX会場共有情報 / ${venue}】`,
		...raceNumbers.map((raceNo) => [
			"====================",
			`${raceNo}R`,
			"====================",
			"【通常のレース素材】",
			`会場名: ${venue}`,
			"日付: 2026-09-06",
			`レース番号: ${raceNo}R`,
			`race_id: ${venue}-${raceNo}`,
			"【事前予想サポート】",
			"【EX参照情報】",
			...exLabels,
		].join("\n")),
	].join("\n"),
});

const runClick = async (preset, selectedRaceNo) => {
	let clipboardText = "";
	const raceNumbers = await copyBoatPredictionRangePreset(preset, async (text) => {
		clipboardText = text;
	});
	return {
		selectedRaceNo,
		raceNumbers: [...raceNumbers],
		clipboardText,
	};
};

const earlyPreset = buildPayload("1r6r", "三国", [1, 2, 3, 4, 5, 6]);
const lateMikuniPreset = buildPayload("7r12r", "三国", [7, 8, 9, 10, 11, 12]);
const lateNarutoPreset = buildPayload("7r12r", "鳴門", [7, 8, 9, 10, 11, 12]);
const lateFromSelected1 = await runClick(lateMikuniPreset, 1);
const earlyFromSelected12 = await runClick(earlyPreset, 12);
const narutoFromSelected1 = await runClick(lateNarutoPreset, 1);
let rejectedSingleRace = false;
try {
	await runClick(buildPayload("7r12r", "三国", [1]), 1);
} catch {
	rejectedSingleRace = true;
}

const panelSource = read("src/components/boatrace/BoatGptBulkMaterialPanel.tsx");
const checks = {
	mikuniLateClipboard: JSON.stringify(lateFromSelected1.raceNumbers) === JSON.stringify([7, 8, 9, 10, 11, 12]),
	narutoLateClipboard: JSON.stringify(narutoFromSelected1.raceNumbers) === JSON.stringify([7, 8, 9, 10, 11, 12]),
	earlyClipboard: JSON.stringify(earlyFromSelected12.raceNumbers) === JSON.stringify([1, 2, 3, 4, 5, 6]),
	selectedRaceIndependent: lateFromSelected1.selectedRaceNo === 1 && earlyFromSelected12.selectedRaceNo === 12,
	singleRaceRejected: rejectedSingleRace,
	fullPayloadWritten: lateFromSelected1.clipboardText === lateMikuniPreset.materialText,
	buttonUsesRuntimeGuard: panelSource.includes("copyRangePreset(preset)")
		&& panelSource.includes("copyBoatPredictionRangePreset(preset, writeClipboardText)"),
	rangeApiExcludesSingleRace: !panelSource.includes("singleRaceMaterialText")
		&& !panelSource.includes("selectedRaceLabel")
		&& panelSource.includes('data-copy-kind="range"')
		&& panelSource.includes('data-range-key={preset.key}'),
	clipboardFallback: panelSource.includes('document.execCommand("copy")'),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, mikuni: lateFromSelected1.raceNumbers, naruto: narutoFromSelected1.raceNumbers }, null, 2));
if (!ok) process.exitCode = 1;
