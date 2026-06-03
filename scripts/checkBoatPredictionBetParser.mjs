import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const importTsModule = async (relativePath) => {
	const sourcePath = path.join(repoRoot, relativePath);
	const source = fs.readFileSync(sourcePath, "utf8");
	const transpiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
		},
	}).outputText;

	const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled, "utf8").toString("base64")}`;
	return import(moduleUrl);
};

const { parseBoatBets } = await importTsModule(path.join("src", "lib", "boatBetParser.ts"));
const { parseBoatPredictionTickets } = await importTsModule(path.join("src", "lib", "boatPredictionParser.ts"));

const fullPredictionText = `
【進入 / 展示】
スタート展示：
1 .16
2 .13
3 .15
4 .17
5 .14
6 .41

展示タイム：
1 6.75
2 6.89
3 6.81
4 6.85
5 6.93
6 6.79

一周タイム：
1 36.38
2 37.50
3 37.36
4 37.55
5 37.56
6 38.76

回り足：
1 7.67
2 8.07
3 8.06
4 8.12
5 8.21
6 8.73

直線：
1 7.73
2 7.78
3 7.82
4 7.81
5 7.84
6 7.77

【買い目📝】
3連単（厚め）
01 1-3-4
02 1-3-2

3連単（本線）
03 3-1-4
04 1-4-3
05 3-1-2
06 1-2-3
07 3-4-1
08 1-4-2

2連単（穴狙い）
09 3-4
10 2-1

【タグ】
#芦屋 #展示重視
`;

const parsed = parseBoatBets(fullPredictionText);
assert.equal(parsed.totalBets, 10, "should only parse 10 bet rows");
assert.equal(parsed.trifectaCount, 8, "should keep 8 trifecta rows");
assert.equal(parsed.exactaCount, 2, "should keep 2 exacta rows");
assert.deepEqual(parsed.bets.map((bet) => bet.normalized), [
	"1-3-4",
	"1-3-2",
	"3-1-4",
	"1-4-3",
	"3-1-2",
	"1-2-3",
	"3-4-1",
	"1-4-2",
	"3-4",
	"2-1",
]);
assert.ok(parsed.warnings?.some((warning) => warning.includes("2連単")), "should warn when exacta rows are present");

const tickets = parseBoatPredictionTickets(fullPredictionText);
assert.equal(tickets.length, 10, "ticket parser should only parse 10 bet rows");
assert.deepEqual(tickets.map((ticket) => ticket.combination), [
	"1-3-4",
	"1-3-2",
	"3-1-4",
	"1-4-3",
	"3-1-2",
	"1-2-3",
	"3-4-1",
	"1-4-2",
	"3-4",
	"2-1",
]);

const exhibitionOnly = `
展示ST：
1 .16
2 .13
3 .15
展示タイム：
1 36.38
2 37.50
`;
const noSection = parseBoatBets(exhibitionOnly);
assert.equal(noSection.totalBets, 0, "should not parse numbers without a bet section");
assert.ok(noSection.warnings?.some((warning) => warning.includes("買い目セクション")), "should warn when bet section is missing");

const duplicateAndInvalid = `
【買い目】
3連単
01 1-3-4
02 1-3-4
03 1-1-3
04 7-1-2
05 .16
`;
const filtered = parseBoatBets(duplicateAndInvalid);
assert.equal(filtered.totalBets, 1, "should dedupe and reject invalid combinations");
assert.equal(filtered.bets[0]?.normalized, "1-3-4");
assert.equal(parseBoatPredictionTickets(exhibitionOnly).length, 0, "ticket parser should not parse exhibition numbers");

console.log("[check:boat-bet-parser] passed");
