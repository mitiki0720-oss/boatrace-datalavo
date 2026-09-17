import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function loadTsModule(relativePath, dependencies = {}) {
	const source = fs.readFileSync(path.join(root, relativePath), "utf8");
	const compiled = ts.transpileModule(source, {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
	}).outputText;
	const module = { exports: {} };
	new Function("exports", "module", "require", compiled)(module.exports, module, (specifier) => {
		if (specifier in dependencies) return dependencies[specifier];
		throw new Error(`Unexpected checker dependency from ${relativePath}: ${specifier}`);
	});
	return module.exports;
}

const betParser = loadTsModule("src/lib/boatBetParser.ts");
const gptCopy = loadTsModule("src/lib/boatPredictionGptCopy.ts");
const settlement = loadTsModule("src/lib/boatResultSettlement.ts", { "./boatBetParser": betParser });
const performance = loadTsModule("src/lib/boatReviewPerformanceMetrics.ts", {
	"./boatBetParser": betParser,
	"./boatResultSettlement": settlement,
});

const {
	extractBoatPredictionArchiveSections,
	parseBoatBets,
	parseBoatPredictionCanonicalBlocks,
	validateBoatPredictionCanonicalSelection,
} = betParser;
const { buildBoatPredictionGptOutputFormatContract } = gptCopy;
const { buildBoatReviewVenuePerformance } = performance;

const combinations = [
	"1-2-3", "1-3-2", "1-2-4", "1-4-2", "2-1-3",
	"2-3-1", "3-1-2", "3-2-1", "4-1-2", "4-2-1",
];
const labels = ["厚め", "厚め", "本線", "本線", "本線", "中穴", "中穴", "中穴", "大穴", "大穴"];

const canonicalPrediction = (raceNo, overrides = {}) => [
	`【2026-09-17 大村 ${raceNo}R】`,
	"date: 2026-09-17",
	"venue: 大村",
	`race: ${overrides.metadataRaceNo ?? raceNo}R`,
	`purchasePoints: ${overrides.purchasePoints ?? 10}`,
	`investmentYen: ${overrides.investmentYen ?? 1000}`,
	"",
	"【出走表】",
	"1号艇 A / 2号艇 B / 3号艇 C / 4号艇 D / 5号艇 E / 6号艇 F",
	"【進入想定】",
	"123/456",
	"【展示】",
	"未取得",
	"【水面】",
	"天候: 晴 / 風向: 北 / 風速: 2m / 波高: 2cm",
	"【展開】",
	"source-backed material only",
	"【買い目】",
	...combinations.map((combination, index) =>
		`${String(index + 1).padStart(2, "0")} | 3連単 | ${combination} | ${labels[index]}`,
	),
	"【設計メモ】",
	"展開重視",
].join("\n");

const canonical = canonicalPrediction(1);
const parsedBlocks = parseBoatPredictionCanonicalBlocks(canonical);
assert.equal(parsedBlocks.length, 1);
assert.equal(parsedBlocks[0].status, "ready");
assert.equal(parsedBlocks[0].date, "2026-09-17");
assert.equal(parsedBlocks[0].venue, "大村");
assert.equal(parsedBlocks[0].raceNo, 1);
assert.equal(parsedBlocks[0].purchasePoints, 10);
assert.equal(parsedBlocks[0].investmentYen, 1000);

const parsed = parseBoatBets(canonical);
assert.equal(parsed.parseStatus, "ready");
assert.equal(parsed.totalBets, 10);
assert.equal(parsed.trifectaCount, 10);
assert.equal(parsed.exactaCount, 0);
assert.equal(parsed.totalStakeYen, 1000);
assert.equal(parsed.invalidRows.length, 0);
assert.equal(parsed.duplicateRows.length, 0);
assert.deepEqual(
	Object.fromEntries(["厚め", "本線", "中穴", "大穴"].map((label) => [label, parsed.bets.filter((bet) => bet.label === label).length])),
	{ 厚め: 2, 本線: 3, 中穴: 3, 大穴: 2 },
);

const selection = validateBoatPredictionCanonicalSelection(canonical, { date: "2026-09-17", venueName: "大村", raceNo: 1 });
assert.equal(selection.valid, true);
const mismatch = validateBoatPredictionCanonicalSelection(canonicalPrediction(1, { metadataRaceNo: 2 }), {
	date: "2026-09-17", venueName: "大村", raceNo: 1,
});
assert.equal(mismatch.valid, false);
assert.ok(mismatch.issues.some((issue) => issue.includes("race mismatch")));

const duplicate = parseBoatBets(canonical.replace("4-2-1 | 大穴", "4-1-2 | 大穴"));
assert.equal(duplicate.parseStatus, "warning");
assert.equal(duplicate.duplicateRows.length, 1);
const invalid = parseBoatBets(canonical.replace("1-2-3 | 厚め", "1-1-3 | 厚め"));
assert.equal(invalid.invalidRows.length, 1);
assert.equal(invalid.totalBets, 9);
assert.equal(parseBoatBets("【出走表】\n01 | 3連単 | 1-2-3 | 厚め").totalBets, 0);

for (const raceNumbers of [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]]) {
	const contract = buildBoatPredictionGptOutputFormatContract({ date: "2026-09-17", venueName: "大村", raceNumbers });
	assert.equal((contract.match(/【予想出力フォーマット契約 \/ COPY RANGE】/g) ?? []).length, 1);
	assert.ok(contract.includes(`必須対象R: ${raceNumbers.map((raceNo) => `${raceNo}R`).join(", ")}`));
	assert.ok(contract.includes("purchasePoints: 10"));
	assert.ok(contract.includes("investmentYen: 1000"));
}

const earlyPredictionText = [1, 2, 3, 4, 5, 6].map((raceNo) => canonicalPrediction(raceNo)).join("\n\n");
const latePredictionText = [7, 8, 9, 10, 11, 12].map((raceNo) => canonicalPrediction(raceNo)).join("\n\n");
assert.deepEqual(extractBoatPredictionArchiveSections(earlyPredictionText).sections.map((section) => section.raceNo), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(extractBoatPredictionArchiveSections(latePredictionText).sections.map((section) => section.raceNo), [7, 8, 9, 10, 11, 12]);

const archiveResultSection = (raceNo, status, payout) => [
	`■ 大村 ${raceNo}R`,
	"結果確定: confirmed",
	`着順: ${status === "hit" ? "1-2-3" : "6-5-4"}`,
	`最終判定: ${status}`,
	"投資: 1000",
	`払戻: ${payout}`,
	`収支: ${payout - 1000}`,
].join("\n");
const reviewGroup = (raceNos, predictionFileText, resultFileText) => ({
	key: "2026-09-17:omura",
	date: "2026-09-17",
	venueName: "大村",
	venueSlug: "omura",
	venueCode: "24",
	venue: { races: raceNos.map((raceNo) => ({ raceNo })) },
	races: [],
	predictionFileText,
	resultFileText,
});
const earlyResults = [
	archiveResultSection(1, "hit", 5000),
	...[2, 3, 4, 5, 6].map((raceNo) => archiveResultSection(raceNo, "miss", 0)),
].join("\n\n");
const earlyMetrics = buildBoatReviewVenuePerformance(reviewGroup([1, 2, 3, 4, 5, 6], earlyPredictionText, earlyResults));
assert.deepEqual(earlyMetrics.targetRaceNos, [1, 2, 3, 4, 5, 6]);
assert.deepEqual(earlyMetrics.predictionRaceNos, earlyMetrics.targetRaceNos);
assert.deepEqual(earlyMetrics.resultRaceNos, earlyMetrics.targetRaceNos);
assert.equal(earlyMetrics.missingPredictionRaceNos.length, 0);
assert.equal(earlyMetrics.missingResultRaceNos.length, 0);
const hitRace = earlyMetrics.races.find((race) => race.raceNo === 1);
const missRace = earlyMetrics.races.find((race) => race.raceNo === 2);
assert.deepEqual(
	{ investment: hitRace.investment, payout: hitRace.payout, profit: hitRace.profit },
	{ investment: 1000, payout: 5000, profit: 4000 },
);
assert.deepEqual(
	{ investment: missRace.investment, payout: missRace.payout, profit: missRace.profit },
	{ investment: 1000, payout: 0, profit: -1000 },
);
assert.equal(5000 / 1000 * 100, 500);

console.log(JSON.stringify({
	ok: true,
	canonical: {
		date: parsedBlocks[0].date,
		venue: parsedBlocks[0].venue,
		raceNo: parsedBlocks[0].raceNo,
		purchasePoints: parsedBlocks[0].purchasePoints,
		investmentYen: parsedBlocks[0].investmentYen,
		totalBets: parsed.totalBets,
		trifectaCount: parsed.trifectaCount,
		labels: { thick: 2, main: 3, medium: 3, longshot: 2 },
	},
	rangeCoverage: { early: [1, 2, 3, 4, 5, 6], late: [7, 8, 9, 10, 11, 12] },
	review: {
		racesMatch: true,
		hit: { investment: 1000, payout: 5000, profit: 4000, roi: 500 },
		miss: { investment: 1000, payout: 0, profit: -1000, roi: 0 },
	},
}, null, 2));
