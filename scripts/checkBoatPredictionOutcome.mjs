import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const tempDir = path.join(repoRoot, "node_modules", ".cache", `boat-outcome-check-${process.pid}`);

function transpileTsModule(relativePath) {
	const sourcePath = path.join(repoRoot, relativePath);
	const outputPath = path.join(tempDir, path.basename(relativePath).replace(/\.ts$/, ".mjs"));
	const source = fs.readFileSync(sourcePath, "utf8");
	const transpiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
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
const { resolveBoatPredictionOutcome } = await importTsModules([
	path.join("src", "lib", "boatBetParser.ts"),
	path.join("src", "lib", "boatResultSettlement.ts"),
], path.join("src", "lib", "boatResultSettlement.ts"));
const { repairBoatPredictionParseIfNeeded } = await importTsModules([
	path.join("src", "lib", "boatBetParser.ts"),
	path.join("src", "lib", "boatPredictionParser.ts"),
	path.join("src", "lib", "boatPredictionStorage.ts"),
], path.join("src", "lib", "boatPredictionStorage.ts"));

const prediction = parseBoatBets("【買い目】\n3連単\n01 1-3-4\n02 1-3-2");
const exactaPrediction = parseBoatBets("【買い目】\n2連単\n01 1-3");

function raceWithResult({
	order = ["1", "3", "4"],
	status = "confirmed",
	raceStatus = "finished",
	payout3tan = "2,450円",
	payout2tan = "¥1,120",
	refunds,
} = {}) {
	return {
		raceNo: 1,
		status: raceStatus,
		result: status
			? {
				status,
				finishOrder: order,
				payout3tan: { betType: "3連単", combination: order.slice(0, 3).join("-"), payout: payout3tan },
				payout2tan: { betType: "2連単", combination: order.slice(0, 2).join("-"), payout: payout2tan },
				refunds,
			}
			: undefined,
	};
}

const hit = resolveBoatPredictionOutcome({
	race: raceWithResult(),
	bets: prediction.bets,
	investmentAmount: prediction.totalStakeYen,
	parseStatus: prediction.parseStatus,
	parseWarnings: prediction.warnings,
});
assert.equal(hit.status, "hit", "trifecta should hit matching top3");
assert.equal(hit.settlement.payoutYen, 2450, "payout should parse comma yen format");
assert.equal(hit.settlement.profitYen, 2250, "profit should be payout minus stake");

const miss = resolveBoatPredictionOutcome({
	race: raceWithResult({ order: ["1", "4", "3"], payout3tan: "2450" }),
	bets: prediction.bets,
	investmentAmount: prediction.totalStakeYen,
	parseStatus: prediction.parseStatus,
});
assert.equal(miss.status, "miss", "confirmed result without matching tickets should be miss");
assert.equal(miss.settlement.payoutYen, 0, "miss payout should be zero");

const exactaHit = resolveBoatPredictionOutcome({
	race: raceWithResult({ payout2tan: "¥2,450" }),
	bets: exactaPrediction.bets,
	investmentAmount: exactaPrediction.totalStakeYen,
	parseStatus: exactaPrediction.parseStatus,
});
assert.equal(exactaHit.status, "hit", "exacta should match only top2");
assert.equal(exactaHit.settlement.payoutYen, 2450, "exacta payout should parse yen prefix");

const exactaNotTrifecta = resolveBoatPredictionOutcome({
	race: raceWithResult({ order: ["1", "3", "2"] }),
	bets: prediction.bets.filter((bet) => bet.normalized === "1-3-4"),
	investmentAmount: 100,
	parseStatus: "ready",
});
assert.equal(exactaNotTrifecta.status, "miss", "trifecta should not be paid by exacta top2 match");

const pending = resolveBoatPredictionOutcome({
	race: raceWithResult({ status: "pending" }),
	bets: prediction.bets,
	investmentAmount: prediction.totalStakeYen,
	parseStatus: prediction.parseStatus,
});
assert.equal(pending.status, "pending", "unconfirmed official result should remain pending");

const noTickets = resolveBoatPredictionOutcome({
	race: raceWithResult(),
	bets: [],
	investmentAmount: 0,
	parseStatus: "missing-section",
});
assert.equal(noTickets.status, "parse-warning", "zero parsed tickets should not become miss");

const cancelled = resolveBoatPredictionOutcome({
	race: raceWithResult({ raceStatus: "canceled", status: undefined }),
	bets: prediction.bets,
	investmentAmount: prediction.totalStakeYen,
	parseStatus: prediction.parseStatus,
});
assert.equal(cancelled.status, "cancelled", "cancelled races should be separate from pending/miss");

const refund = resolveBoatPredictionOutcome({
	race: raceWithResult({ refunds: ["返還 5号艇"] }),
	bets: prediction.bets,
	investmentAmount: prediction.totalStakeYen,
	parseStatus: prediction.parseStatus,
});
assert.equal(refund.status, "refund", "refund races should be separate status");

const fullWidthResult = resolveBoatPredictionOutcome({
	race: raceWithResult({ order: ["１", "３", "４"], payout3tan: "2450" }),
	bets: prediction.bets,
	investmentAmount: prediction.totalStakeYen,
	parseStatus: prediction.parseStatus,
});
assert.equal(fullWidthResult.status, "hit", "full-width official result should normalize");

const repaired = repairBoatPredictionParseIfNeeded({
	raceKey: "boat-prediction:test",
	venueName: "test",
	date: "2026-06-04",
	raceNo: 1,
	predictionText: "【買い目】\n3連単\n01 1-3-4",
	tickets: [],
	parsedBets: [],
	savedAt: "2026-06-04T00:00:00.000Z",
});
assert.equal(repaired.parsedBets?.length, 1, "old saved data should repair parsed bets from raw text");
assert.equal(repaired.parserVersion, "2026-06-04.bet-result-consistency", "repair should stamp parser version");
assert.equal(repaired.rawPredictionText, repaired.predictionText, "repair should preserve raw prediction text");

console.log("[check:boat-prediction-outcome] passed");
