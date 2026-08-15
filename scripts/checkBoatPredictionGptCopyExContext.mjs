import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const page = read("src/pages/PredictionPage.tsx");
const context = read("src/lib/boatPredictionGptCopyExContext.ts");
const panel = read("src/components/boatrace/BoatGptBulkMaterialPanel.tsx");

const requiredPageFragments = [
	'const expectedRaceNumbers = [7, 8, 9, 10, 11, 12];',
	"normalizeBoatRaceNo(race.raceNo)",
	"buildBoatPredictionGptCopyHeader({",
	"buildBoatPredictionGptCopyVenueContext({",
	"buildBoatPredictionGptCopyRaceContext({",
	"getBoatPredictionGptCopyExReference({",
	"exReferenceLevelCounts",
	'includesExContext={bulkGptMaterialRangeKey === "7r12r"}',
];
const requiredContextFragments = [
	"GPTへの素材",
	"source name:",
	"source acquired at:",
	"source status:",
	"対象日EX race-analysis source:",
	"対象日EX generatedAt:",
	"EX履歴source:",
	"EX履歴データ期間:",
	"EX履歴source種別:",
	"EX audit path:",
	"【EX会場共有情報 /",
	"[日付 ",
	"【出走表】",
	"【展示情報】",
	"【EXレース分析】",
	"【EX選手情報】",
	"【source-backed / cautions】",
	"officialRegistrationNo",
	"resolvedRegistrationNo",
	"buildBoatPredictionGptCopyExReferenceBlock",
	"KURARI BOAT EX 参照情報",
	"EX参照レベル:",
	"登録番号exactリンク:",
	"氏名推測リンク: 使用禁止",
	"derived/weather-water-history/latest.json",
	"【KURARI BOAT EX 天候・水面 履歴】",
	"【KURARI BOAT EX 履歴latest-day venue-evidence】",
	"EX履歴latest日:",
	"データ期間: 履歴",
	"用途: 履歴EXのlatest-day確認用。予想当日の通常素材coverageではありません。",
	"会場傾向 データ期間: 履歴",
	"荒れ指数 データ期間: 履歴",
	"racerFeatures",
	"formatRacerFeatureLines",
	"KURARI BOAT EX 選手特徴",
	"登録番号の完全一致と履歴ソースに基づく記述統計",
	"currentDayPredictionCoverage",
	"KURARI BOAT EX 当日予想coverage",
	"当日status:",
	"race-analysis:",
];
const forbiddenContextFragments = ["fake", "score", "rank", "generatedPrediction", "generatedTicket", "【KURARI BOAT EX 当日coverage】", "当日coverage: 対象日不一致のため予想当日データとしては使わない"];

const missing = [
	...requiredPageFragments.filter((fragment) => !page.includes(fragment)).map((fragment) => `PredictionPage: ${fragment}`),
	...requiredContextFragments.filter((fragment) => !context.includes(fragment)).map((fragment) => `context: ${fragment}`),
	...forbiddenContextFragments.filter((fragment) => context.includes(fragment)).map((fragment) => `forbidden context fragment: ${fragment}`),
];

const ok = missing.length === 0 && panel.includes("EX分析入り") && panel.includes("まとめコピー");
console.log(JSON.stringify({
	ok,
	checks: {
		sevenToTwelveSelection: requiredPageFragments.length,
		headerAndExSections: requiredContextFragments.length,
		forbiddenContextFragments: forbiddenContextFragments.length,
		panelExLabel: panel.includes("EX分析入り"),
	},
	missing,
}, null, 2));

if (!ok) {
	process.exitCode = 1;
}
