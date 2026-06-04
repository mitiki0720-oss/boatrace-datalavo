import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const tempDir = path.join(repoRoot, "node_modules", ".cache", `boat-parser-check-${process.pid}`);

function transpileTsModule(relativePath) {
	const sourcePath = path.join(repoRoot, relativePath);
	const outputPath = path.join(tempDir, path.basename(relativePath).replace(/\.ts$/, ".mjs"));
	const source = fs.readFileSync(sourcePath, "utf8");
	const transpiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
			jsx: ts.JsxEmit.ReactJSX,
		},
	}).outputText.replace(/from "(\.\/[^"]+)"/g, 'from "$1.mjs"');

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, transpiled);
	return outputPath;
}

async function importTsModules(relativePaths, entryPath) {
	for (const relativePath of relativePaths) {
		transpileTsModule(relativePath);
	}
	return import(`file://${transpileTsModule(entryPath).replace(/\\/g, "/")}`);
}

const { parseBoatBets } = await importTsModules([
	path.join("src", "lib", "boatBetParser.ts"),
], path.join("src", "lib", "boatBetParser.ts"));
const { parseBoatPredictionTickets } = await importTsModules([
	path.join("src", "lib", "boatBetParser.ts"),
	path.join("src", "lib", "boatPredictionParser.ts"),
], path.join("src", "lib", "boatPredictionParser.ts"));

const fullPredictionText = `
【購入 / 展示】
スタート展示
1 .16
2 .13
3 .15
4 .17
5 .14
6 .41

展示タイム
1 6.75
2 6.89
3 6.81
4 6.85
5 6.93
6 6.79

周回タイム
1 36.38
2 37.50
3 37.36
4 37.55
5 37.56
6 38.76

【買い目📝】
3連単（穴狙い2点）：1/02
01 1-3-4
02 1-3-2

3連単（本線6点）：3-08
03 3-1-4
04 1-4-3
05 3-1-2
06 1-2-3
07 3-4-1
08 1-4-2

3連単（穴狙い2点）：9/10
09 4-3-1
10 2-1-3

【タグ】
#芦屋 #展示重視
`;

const parsed = parseBoatBets(fullPredictionText);
assert.equal(parsed.totalBets, 10, "should only parse 10 bet rows");
assert.equal(parsed.trifectaCount, 10, "should keep 10 trifecta rows");
assert.equal(parsed.exactaCount, 0, "should not invent exacta rows from exhibition stats");
assert.deepEqual(parsed.bets.map((bet) => bet.normalized), [
	"1-3-4",
	"1-3-2",
	"3-1-4",
	"1-4-3",
	"3-1-2",
	"1-2-3",
	"3-4-1",
	"1-4-2",
	"4-3-1",
	"2-1-3",
]);
assert.equal(parsed.parseStatus, "ready");
assert.ok(!parsed.betSectionText.includes("36.38"), "bet section should not include exhibition stats before buy heading");

const tickets = parseBoatPredictionTickets(fullPredictionText);
assert.equal(tickets.length, 10, "ticket parser should derive the same 10 rows");
assert.deepEqual(tickets.map((ticket) => ticket.combination), parsed.bets.map((bet) => bet.normalized));

for (const [name, body] of Object.entries({
	"colon variants": "【買い目】\n3連単\n01：1-3-4\n02: 1-3-2",
	"arrow variants": "【買い目】\n3連単\n01 1→3→4\n02 1⇒3⇒2",
	"space variants": "【買い目】\n3連単\n01 1　3　4\n02 1 3 2",
	"fullwidth variants": "【買い目】\n3連単\n０１　１－３－４\n０２　１－３－２",
	"code block row": "【買い目】\n3連単\n`01  1-3-4`",
	"heading with count": "買い目 10点\n3連単\n01 1-3-4",
	"heading with parens": "買い目（10点）\n3連単\n01 1-3-4",
	"emoji heading": "【買い目 ✅】\n3連単\n01 1-3-4",
})) {
	const result = parseBoatBets(body);
	assert.ok(result.totalBets >= 1, `${name} should parse at least one ticket`);
	assert.equal(result.bets[0].normalized, "1-3-4", `${name} should normalize first row`);
}

const crlf = fullPredictionText.replace(/\n/g, "\r\n");
assert.deepEqual(
	parseBoatBets(crlf).bets.map((bet) => bet.normalized),
	parsed.bets.map((bet) => bet.normalized),
	"CRLF and LF should parse the same",
);

const exactaMixed = parseBoatBets("【買い目】\n2連単\n09 3-4\n10 2-1");
assert.equal(exactaMixed.totalBets, 2, "exacta rows should be preserved");
assert.deepEqual(exactaMixed.bets.map((bet) => bet.type), ["exacta", "exacta"], "exacta should not be converted to trifecta");
assert.ok(exactaMixed.warnings.some((warning) => warning.includes("exacta")), "exacta rows should warn");

const duplicate = parseBoatBets("【買い目】\n3連単\n01 1-3-4\n02 1-3-4");
assert.equal(duplicate.totalBets, 2, "duplicate purchase rows should preserve purchase count");
assert.equal(duplicate.duplicateRows.length, 1, "duplicate rows should be warned");

const invalid = parseBoatBets("【買い目】\n3連単\n01 1-1-3\n02 0-1-2\n03 7-1-2\n04 1-2\n05 1-2-3-4");
assert.equal(invalid.totalBets, 0, "invalid tickets should not be treated as normal bets");
assert.equal(invalid.parseStatus, "invalid");
assert.ok(invalid.invalidRows.length >= 5, "invalid rows should be retained for review");

const exhibitionOnly = "展示ST\n1 .16\n2 .13\n3 .15\n展示タイム\n1 36.38\n2 37.50";
const noSection = parseBoatBets(exhibitionOnly);
assert.equal(noSection.totalBets, 0, "should not parse numbers without a bet section");
assert.equal(noSection.parseStatus, "missing-section");
assert.equal(parseBoatPredictionTickets(exhibitionOnly).length, 0, "ticket parser should not parse exhibition-only text");

console.log("[check:boat-bet-parser] passed");
