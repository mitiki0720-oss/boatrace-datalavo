import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const page = read("src/pages/PredictionPage.tsx");
const context = read("src/lib/boatPredictionGptCopyExContext.ts");
const panel = read("src/components/boatrace/BoatGptBulkMaterialPanel.tsx");

const requiredPageFragments = [
	'const expectedRaceNumbers = [7, 8, 9, 10, 11, 12];',
	"filter((race) => expectedRaceNumbers.includes(Number(race.raceNo)))",
	"buildBoatPredictionGptCopyHeader({",
	"buildBoatPredictionGptCopyVenueContext({",
	"buildBoatPredictionGptCopyRaceContext({",
	'includesExContext={bulkGptMaterialRangeKey === "7r12r"}',
];
const requiredContextFragments = [
	"GPTへの素材",
	"source name:",
	"source acquired at:",
	"source status:",
	"EX source:",
	"EX generatedAt:",
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
];
const forbiddenContextFragments = ["fake", "score", "rank", "generatedPrediction", "generatedTicket"];

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
