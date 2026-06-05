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

const buyHeading = "\u3010\u8cb7\u3044\u76ee\ud83d\udcdd\u3011";
const buyCountHeading = "\u8cb7\u3044\u76ee\uff0810\u70b9\uff09";
const trifectaHeading = "3\u9023\u5358";
const mikuni2Tickets = [
	"1-3-2",
	"1-3-6",
	"1-3-4",
	"1-2-3",
	"1-2-6",
	"1-6-3",
	"3-1-2",
	"3-1-6",
	"3-2-1",
	"3-6-1",
];
const mikuni5Tickets = [
	"2-1-5",
	"2-5-1",
	"2-5-4",
	"2-5-3",
	"2-4-5",
	"5-2-4",
	"5-2-3",
	"5-4-2",
	"4-5-2",
	"3-2-5",
];
const mikuni3Tickets = [
	"1-2-4",
	"2-1-4",
	"1-4-2",
	"1-2-3",
	"2-1-3",
	"2-4-1",
	"4-1-2",
	"4-2-1",
	"1-2-6",
	"2-1-6",
];
const buildJapaneseBetSection = (tickets, heading = trifectaHeading) => [
	buyHeading,
	buyCountHeading,
	heading,
	...tickets.map((ticket, index) => `${String(index + 1).padStart(2, "0")}\u3000${ticket}`),
].join("\n");
const assertTenJapaneseTrifectaTickets = (name, text, expectedTickets) => {
	const result = parseBoatBets(text);
	assert.equal(result.totalBets, 10, `${name} should parse 10 tickets`);
	assert.equal(result.trifectaCount, 10, `${name} should keep 10 trifecta rows`);
	assert.equal(result.exactaCount, 0, `${name} should not invent exacta rows`);
	assert.deepEqual(result.bets.map((bet) => bet.normalized), expectedTickets, `${name} should preserve ticket order`);
	assert.equal(parseBoatPredictionTickets(text).length, 10, `${name} ticket parser should match parsed bets`);
};

const mikuni2Section = buildJapaneseBetSection(mikuni2Tickets, `${trifectaHeading}\uff08\u539a\u30812\u70b9\uff09\uff1a1/02`);
const mikuni5Section = buildJapaneseBetSection(mikuni5Tickets);
const mikuni3Section = [
	buyHeading,
	buyCountHeading,
	`${trifectaHeading}\uff08\u539a\u30812\u70b9\uff09\uff1a1/02`,
	"01\u30001-2-4",
	"02\u30002-1-4",
	"",
	`${trifectaHeading}\uff08\u672c\u7dda3\u70b9\uff09\uff1a03-05`,
	"03\u30001-4-2",
	"04\u30001-2-3",
	"05\u30002-1-3",
	"",
	`${trifectaHeading}\uff08\u4e2d\u7a743\u70b9\uff09\uff1a06-08`,
	"06\u30002-4-1",
	"07\u30004-1-2",
	"08\u30004-2-1",
	"",
	`${trifectaHeading}\uff08\u5927\u7a742\u70b9\uff09\uff1a09/10`,
	"09\u30001-2-6",
	"10\u30002-1-6",
].join("\n");
assertTenJapaneseTrifectaTickets("Mikuni 2R section", mikuni2Section, mikuni2Tickets);
assertTenJapaneseTrifectaTickets("Mikuni 5R section", mikuni5Section, mikuni5Tickets);
assertTenJapaneseTrifectaTickets("Mikuni 3R grouped section", mikuni3Section, mikuni3Tickets);
assertTenJapaneseTrifectaTickets(
	"Mikuni 2R full text with exhibition stats",
	[
		"\u5c55\u793aST",
		"1 .16",
		"2 .13",
		"3 .15",
		"\u5468\u56de\u30bf\u30a4\u30e0",
		"1 36.38",
		"2 37.50",
		mikuni2Section,
		"\u3010\u30bf\u30b0\u3011",
		"#\u4e09\u56fd #\u5c55\u793a\u91cd\u8996",
	].join("\r\n"),
	mikuni2Tickets,
);
assertTenJapaneseTrifectaTickets(
	"Mikuni 5R full text with exhibition stats",
	[
		"\u5c55\u793a\u30bf\u30a4\u30e0",
		"1 6.75",
		"2 6.89",
		"3 6.81",
		mikuni5Section,
		"\u30e1\u30e2",
		"\u7d50\u679c\u78ba\u8a8d\u5f85\u3061",
	].join("\n"),
	mikuni5Tickets,
);
assertTenJapaneseTrifectaTickets(
	"Mikuni 3R long text with earlier bet prose",
	[
		"\u4eca\u56de\u306f\u8cb7\u3044\u76ee\u3088\u308a\u524d\u306b\u5c55\u958b\u8aac\u660e\u304c\u5165\u308b\u9577\u6587\u3067\u3059\u3002",
		"\u3010\u5371\u967a\u306a\u4eba\u6c17 / \u7a74\u5019\u88dc\u3011",
		"\u539a\u3081\u306f1\u53f7\u8247\u30682\u53f7\u8247\u306e\u6298\u308a\u5408\u3044\u3002",
		"",
		mikuni3Section,
		"\u3010\u6700\u7d42\u30e1\u30e2\u3011",
		"1\u30682\u3092\u8ef8\u306b\u4e0d\u8981\u306a\u5c55\u793a\u884c\u306f\u89e3\u6790\u3057\u306a\u3044\u3002",
	].join("\n"),
	mikuni3Tickets,
);

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
