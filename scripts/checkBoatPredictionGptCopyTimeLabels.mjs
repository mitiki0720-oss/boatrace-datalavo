import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const copy = read("src/lib/boatPredictionGptCopy.ts");
const material = read("src/lib/boatPredictionMaterial.ts");
const page = read("src/pages/PredictionPage.tsx");
const exContext = read("src/lib/boatPredictionGptCopyExContext.ts");

const compiledCopy = ts.transpileModule(copy, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const copyModule = { exports: {} };
new Function("exports", "module", compiledCopy)(copyModule.exports, copyModule);
const {
	buildBoatPredictionGptBettingInstruction,
	formatBoatPredictionSessionLabel,
	getBoatPredictionRaceTimeLabel,
	getBoatPredictionRangePurposeLabel,
	getBoatPredictionRangeTimeKind,
	getBoatPredictionVenueTimeKind,
} = copyModule.exports;

const fixtureRace = (raceNo, deadlineTime) => ({ raceNo, deadlineTime });
const fixtureVenue = (venueName, title, session, races) => ({ venueName, title, session, races });
const shimonoseki = fixtureVenue("下関", "ミッドナイトボートレース", "midnight", [
	fixtureRace(1, "17:41"),
	fixtureRace(6, "20:25"),
	fixtureRace(7, "20:55"),
	fixtureRace(12, "22:30"),
]);
const karatsu = fixtureVenue("唐津", "モーニング", "morning", [
	fixtureRace(1, "08:45"),
	fixtureRace(6, "10:20"),
	fixtureRace(7, "11:10"),
	fixtureRace(12, "14:00"),
]);
const toda = fixtureVenue("戸田", "デイ", "day", [
	fixtureRace(1, "10:45"),
	fixtureRace(6, "13:20"),
	fixtureRace(7, "13:50"),
	fixtureRace(12, "16:30"),
]);
const gamagori = fixtureVenue("蒲郡", "通常開催", "night", [
	fixtureRace(1, "12:00"),
	fixtureRace(6, "16:30"),
	fixtureRace(7, "18:03"),
	fixtureRace(12, "20:50"),
]);
const omura = fixtureVenue("大村", "ナイター", "night", [
	fixtureRace(1, "17:25"),
	fixtureRace(6, "19:55"),
	fixtureRace(7, "20:25"),
	fixtureRace(12, "20:50"),
]);

const venueKind = (fixture) => getBoatPredictionVenueTimeKind(fixture, fixture.races);
const rangeKind = (fixture, raceNumbers) =>
	getBoatPredictionRangeTimeKind(venueKind(fixture), fixture.races.filter((race) => raceNumbers.includes(race.raceNo)));
const firstHalf = [1, 2, 3, 4, 5, 6];
const latterHalf = [7, 8, 9, 10, 11, 12];
const bettingInstruction = buildBoatPredictionGptBettingInstruction();
const instructionBlock = material.match(/\[J\.[\s\S]*?(?=\[K\.)/)?.[0] ?? "";

const requiredFragments = [
	"getBoatPredictionRangeTimeKind",
	'getBoatPredictionRangeTimeKind(venueTimeKind, selectedRaces)',
	'getBoatPredictionRangePurposeLabel(rangeTimeKind, "1R〜6R")',
	'getBoatPredictionRangePurposeLabel(rangeTimeKind, "7R〜12R")',
	"コピー範囲時間帯:",
	"rangeTimeKind: BoatPredictionVenueTimeKind",
	"formatBoatPredictionSessionLabel",
];
const requiredBettingInstructions = [
	"買い目は3連単10点。",
	"厚め2点、本線3点、中穴3点、大穴2点。",
	"2連単は使わない。",
	"オッズではなく展開を重視。",
	"展示未取得なら事前予想。",
	"1Rごとに分けて、コピーしやすい形式で出力してください。",
];
const forbiddenBettingInstructions = [
	"3連単は厚め2点、本線6点",
	"2連単は穴狙い2点",
	"本線6点",
];
const forbiddenCopyFragments = ["fake", "score", "rank", "generatedPrediction", "generatedTicket"];

const missing = [
	...requiredFragments.filter((fragment) => !`${copy}\n${page}\n${exContext}`.includes(fragment)).map((fragment) => `required: ${fragment}`),
	...requiredBettingInstructions.filter((fragment) => !bettingInstruction.includes(fragment)).map((fragment) => `betting: ${fragment}`),
	...forbiddenBettingInstructions.filter((fragment) => instructionBlock.includes(fragment)).map((fragment) => `legacy betting: ${fragment}`),
	...forbiddenCopyFragments.filter((fragment) => copy.includes(fragment)).map((fragment) => `forbidden copy helper: ${fragment}`),
];

const behaviorChecks = {
	shimonosekiMidnight:
		venueKind(shimonoseki) === "midnight" &&
		rangeKind(shimonoseki, firstHalf) === "midnight" &&
		rangeKind(shimonoseki, latterHalf) === "midnight" &&
		shimonoseki.races.every((race) => getBoatPredictionRaceTimeLabel("midnight", race) === "midnight"),
	karatsuMorning:
		venueKind(karatsu) === "morning" &&
		rangeKind(karatsu, firstHalf) === "morning" &&
		rangeKind(karatsu, latterHalf) === "morning" &&
		karatsu.races.every((race) => getBoatPredictionRaceTimeLabel(venueKind(karatsu), race) === "morning") &&
		getBoatPredictionRangePurposeLabel(rangeKind(karatsu, firstHalf), "1R〜6R") === "モーニング/前半予想",
	todaDay:
		venueKind(toda) === "day" &&
		rangeKind(toda, firstHalf) === "day" &&
		rangeKind(toda, latterHalf) === "day" &&
		getBoatPredictionRangePurposeLabel(rangeKind(toda, latterHalf), "7R〜12R") === "デイ/後半予想",
	gamagoriLateNight:
		venueKind(gamagori) === "night" &&
		rangeKind(gamagori, firstHalf) === "night" &&
		rangeKind(gamagori, latterHalf) === "night" &&
		gamagori.races.every((race) => getBoatPredictionRaceTimeLabel(venueKind(gamagori), race) === "night"),
	omuraNight:
		venueKind(omura) === "night" &&
		rangeKind(omura, firstHalf) === "night" &&
		rangeKind(omura, latterHalf) === "night" &&
		getBoatPredictionRaceTimeLabel(venueKind(omura), omura.races.at(-1)) === "night",
	copyPerRaceLabel: page.includes("getBoatPredictionRaceTimeLabel(venueTimeKind, race)"),
	japaneseLabels:
		formatBoatPredictionSessionLabel("morning") === "モーニング" &&
		formatBoatPredictionSessionLabel("summer-time") === "サマータイム" &&
		formatBoatPredictionSessionLabel("night") === "ナイター" &&
		formatBoatPredictionSessionLabel("midnight") === "ミッドナイト" &&
		formatBoatPredictionSessionLabel("day") === "デイ",
};

const ok = missing.length === 0 && Object.values(behaviorChecks).every(Boolean);
console.log(JSON.stringify({ ok, checks: behaviorChecks, missing }, null, 2));

if (!ok) {
	process.exitCode = 1;
}
