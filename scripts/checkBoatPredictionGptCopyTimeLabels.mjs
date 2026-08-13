import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const copy = read("src/lib/boatPredictionGptCopy.ts");
const material = read("src/lib/boatPredictionMaterial.ts");
const page = read("src/pages/PredictionPage.tsx");
const exContext = read("src/lib/boatPredictionGptCopyExContext.ts");

const requiredCopyFragments = [
	'title.includes("ミッドナイト")',
	"latestClosingTime >= 21 * 60",
	"firstClosingTime < 10 * 60 + 30",
	"firstClosingTime >= 17 * 60",
	'if (venueTimeKind === "midnight")',
	'if (closingTime < 10 * 60 + 30)',
	'if (closingTime < 17 * 60)',
	'if (closingTime < 21 * 60)',
	"買い目は3連単10点。",
	"厚め2点、本線3点、中穴3点、大穴2点。",
	"オッズではなく展開を重視。",
	"展示未取得なら事前予想。",
	"1Rごとに分けて、コピーしやすい形式で出力してください。",
];
const requiredPageFragments = [
	"bulkGptMaterialSummary1R6RWithTimeLabels",
	"bulkGptMaterialSummary7R12RWithEx",
	"applyBoatPredictionGptCopyTimeLabel(buildBoatPredictionMaterial({",
	"buildBoatPredictionGptBettingInstruction()",
	'getBoatPredictionRangePurposeLabel(venueTimeKind, "1R〜6R")',
	'getBoatPredictionRangePurposeLabel(venueTimeKind, "7R〜12R")',
];
const requiredExFragments = [
	"会場時間帯:",
	"用途:",
	"EX当日レース分析:",
	"当日race-analysis shard未取得",
	"EX全履歴レース数:",
	"EX選手情報: source-backed linkageのみを表示。",
];
const forbiddenBettingFragments = [
	"3連単は厚め2点、本線6点",
	"2連単は穴狙い2点",
	"本線6点",
	"3連単は10点",
];
const forbiddenCopyFragments = [
	"fake",
	"score",
	"rank",
	"generatedPrediction",
	"generatedTicket",
];

const compiledCopy = ts.transpileModule(copy, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const copyModule = { exports: {} };
new Function("exports", "module", compiledCopy)(copyModule.exports, copyModule);
const {
	getBoatPredictionVenueTimeKind,
	getBoatPredictionRaceTimeLabel,
	getBoatPredictionRangePurposeLabel,
	buildBoatPredictionGptBettingInstruction,
} = copyModule.exports;
const fixtureVenue = (venueName, title, races) => ({ venueName, title, races });
const fixtureRace = (deadlineTime) => ({ raceNo: 1, deadlineTime });
const midnightVenue = fixtureVenue("下関", "ミッドナイト開催", [fixtureRace("17:41"), fixtureRace("21:30")]);
const morningVenue = fixtureVenue("唐津", "モーニング開催", [fixtureRace("09:20"), fixtureRace("12:00")]);
const dayVenue = fixtureVenue("戸田", "デイ開催", [fixtureRace("12:00"), fixtureRace("16:50")]);
const nightVenue = fixtureVenue("大村", "ナイター開催", [fixtureRace("18:00"), fixtureRace("20:50")]);
const midnightKind = getBoatPredictionVenueTimeKind(midnightVenue, midnightVenue.races);
const morningKind = getBoatPredictionVenueTimeKind(morningVenue, morningVenue.races);
const dayKind = getBoatPredictionVenueTimeKind(dayVenue, dayVenue.races);
const nightKind = getBoatPredictionVenueTimeKind(nightVenue, nightVenue.races);
const bettingInstruction = buildBoatPredictionGptBettingInstruction();
const copyMaterialSources = `${copy}\n${material}`;
const instructionBlock = material.match(/\[J\.[\s\S]*?(?=\[K\.)/)?.[0] ?? "";
const twoExactaLines = instructionBlock.split(/\r?\n/).filter((line) => line.includes("2連単"));

const missing = [
	...requiredCopyFragments.filter((fragment) => !copy.includes(fragment)).map((fragment) => `copy: ${fragment}`),
	...requiredPageFragments.filter((fragment) => !page.includes(fragment)).map((fragment) => `page: ${fragment}`),
	...requiredExFragments.filter((fragment) => !exContext.includes(fragment)).map((fragment) => `EX context: ${fragment}`),
	...forbiddenBettingFragments.filter((fragment) => instructionBlock.includes(fragment)).map((fragment) => `forbidden betting instruction: ${fragment}`),
	...forbiddenCopyFragments.filter((fragment) => copy.includes(fragment)).map((fragment) => `forbidden copy helper fragment: ${fragment}`),
];

const behaviorChecks = {
	shimonosekiMidnight: midnightKind === "midnight" && getBoatPredictionRaceTimeLabel(midnightKind, fixtureRace("17:41")) === "midnight",
	karatsuMorning: morningKind === "morning" && getBoatPredictionRangePurposeLabel(morningKind, "1R〜6R") === "モーニング/前半予想用",
	todaDay: dayKind === "day" && getBoatPredictionRangePurposeLabel(dayKind, "1R〜6R") === "デイ/前半予想用",
	omuraNight: nightKind === "night" && getBoatPredictionRangePurposeLabel(nightKind, "7R〜12R") === "ナイター/後半予想用",
	bettingContract:
		bettingInstruction.includes("買い目は3連単10点。") &&
		bettingInstruction.includes("厚め2点、本線3点、中穴3点、大穴2点。") &&
		bettingInstruction.includes("2連単は使わない。") &&
		bettingInstruction.includes("オッズではなく展開を重視。") &&
		bettingInstruction.includes("展示未取得なら事前予想。"),
	legacyBettingInstructionsRemoved:
		forbiddenBettingFragments.every((fragment) => !instructionBlock.includes(fragment)) &&
		instructionBlock.includes("2連単は使わない。"),
	twoExactaRule: twoExactaLines.length === 1 && twoExactaLines[0].includes("2連単は使わない。"),
};
const ok = missing.length === 0 && Object.values(behaviorChecks).every(Boolean);
console.log(JSON.stringify({
	ok,
	checks: {
		...behaviorChecks,
		exUnavailableLabel: exContext.includes("当日race-analysis shard未取得"),
	},
	missing,
}, null, 2));

if (!ok) {
	process.exitCode = 1;
}
