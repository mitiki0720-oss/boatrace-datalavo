import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadModule = (path, dependencies = {}) => {
	const loaded = { exports: {} };
	new Function("exports", "module", "require", compile(read(path)))(loaded.exports, loaded, (id) => {
		if (id in dependencies) return dependencies[id];
		throw new Error(`Unexpected dependency in ${path}: ${id}`);
	});
	return loaded.exports;
};

const monthlyModule = loadModule("src/lib/boatMonthlyReview.ts", {
	"./assetPath": { withBasePath: (value) => value },
});
const contextModule = loadModule("src/lib/boatPredictionMonthlyReviewContext.ts", {
	"./boatMonthlyReview": monthlyModule,
});
const copyModule = loadModule("src/lib/boatPredictionGptCopy.ts");
const monthlyData = JSON.parse(read("public/data/monthly-review/boat/monthly-review-data.json"));
const pageSource = read("src/pages/PredictionPage.tsx");

const {
	buildBoatPredictionMonthlyReviewContext,
	findBoatPredictionMonthlyVenue,
	resolveBoatPredictionMonthlyFocus,
	resolveBoatPredictionMonthlyReferenceMonth,
} = contextModule;

const referenceFor = (predictionDate, data = monthlyData) =>
	resolveBoatPredictionMonthlyReferenceMonth({ predictionDate, monthlyData: data });
const fixtureReferences = {
	sept03: referenceFor("2026-09-03").referenceMonth,
	aug15: referenceFor("2026-08-15").referenceMonth,
	jul10: referenceFor("2026-07-10").referenceMonth,
	jun10: referenceFor("2026-06-10").referenceMonth,
	octPartial: referenceFor("2026-10-01").referenceMonth,
};
const septemberCompleteData = {
	...monthlyData,
	period: { ...monthlyData.period, end: "2026-09-30" },
};
const octoberCompleteReference = referenceFor("2026-10-01", septemberCompleteData).referenceMonth;
const augustOomura = findBoatPredictionMonthlyVenue({
	monthlyData,
	referenceMonth: "2026-08",
	venueName: "大村",
});
const missingVenue = findBoatPredictionMonthlyVenue({
	monthlyData,
	referenceMonth: "2026-08",
	venueName: "大村競艇場（別名代用禁止）",
});
const currentMaterial = buildBoatPredictionMonthlyReviewContext({
	monthlyData,
	loadState: "ready",
	predictionDate: "2026-09-03",
	venueName: "大村",
	windSpeed: "3m",
	predictionMode: "pre-race",
});
const missingVenueMaterial = buildBoatPredictionMonthlyReviewContext({
	monthlyData,
	loadState: "ready",
	predictionDate: "2026-09-03",
	venueName: "大村競艇場（別名代用禁止）",
});
const unavailableMaterial = buildBoatPredictionMonthlyReviewContext({
	monthlyData: null,
	loadState: "unavailable",
	predictionDate: "2026-09-03",
	venueName: "大村",
});
const frontRangeSource = pageSource.slice(
	pageSource.indexOf("const bulkGptMaterialSummary1R6RWithTimeLabels"),
	pageSource.indexOf("const bulkGptMaterialSummary7R12R"),
);
const lateRangeSource = pageSource.slice(
	pageSource.indexOf("const bulkGptMaterialSummary7R12RWithEx"),
	pageSource.indexOf("const bulkGptMaterialRangePresets"),
);
const countCalls = (source) => (source.match(/buildPredictionMonthlyReviewMaterial\(\{/gu) ?? []).length;
const bettingInstruction = copyModule.buildBoatPredictionGptBettingInstruction();
const exactaLines = bettingInstruction.split(/\r?\n/u).filter((line) => line.includes("2連単"));
const noExactaRequired = exactaLines.length > 0
	&& exactaLines.every((line) => /2連単(?:は|を)?(?:使わない|なし|不要)/u.test(line))
	&& !exactaLines.some((line) => /2連単.*(?:点|穴狙い|本線|厚め|買い目)/u.test(line));
const focusFixtures = {
	structure: resolveBoatPredictionMonthlyFocus(40, 30),
	read: resolveBoatPredictionMonthlyFocus(25, 35),
	equal: resolveBoatPredictionMonthlyFocus(30, 30),
};

const checks = {
	dataLoaderPreserved: pageSource.includes("loadBoatMonthlyReviewData()")
		&& pageSource.includes("setMonthlyReviewLoadState(\"unavailable\")"),
	contextBuilderDelegation: (pageSource.match(/buildBoatPredictionMonthlyReviewContext\(\{/gu) ?? []).length === 1,
	referenceMonthDynamic: fixtureReferences.sept03 === "2026-08"
		&& fixtureReferences.aug15 === "2026-07"
		&& fixtureReferences.jul10 === "2026-06",
	partialExcluded: fixtureReferences.jun10 === null
		&& fixtureReferences.octPartial === "2026-08"
		&& octoberCompleteReference === "2026-09",
	futureLeakageBlocked: fixtureReferences.aug15 === "2026-07"
		&& fixtureReferences.jul10 === "2026-06"
		&& !currentMaterial.includes("対象: 2026-09"),
	selectedVenueExact: augustOomura?.venue === "大村" && augustOomura?.month === "2026-08",
	venueMissingSafe: missingVenue === null
		&& missingVenueMaterial.includes("会場別月次: 未取得")
		&& !missingVenueMaterial.includes("会場: 大村\n"),
	structureMissPresent: currentMaterial.includes("STRUCTURE_MISS: 1,617 / 32.90%"),
	readMissPresent: currentMaterial.includes("READ_MISS: 1,715 / 34.89%"),
	dataHoldPresent: currentMaterial.includes("DATA_HOLD: 53"),
	actualOneBoatRatePresent: currentMaterial.includes("1号艇1着率: 53.75%")
		&& currentMaterial.includes("1号艇1着:"),
	nextKpiPresent: currentMaterial.includes("【次月KPI】")
		&& currentMaterial.includes("3連単10点的中率"),
	classificationMethodAndCaution: currentMaterial.includes("classification method:")
		&& currentMaterial.includes("summary_v2相当: 3,022"),
	autoProxyCaution: currentMaterial.includes("auto_proxy: 6,276（AUTO / 参考分類。人手監査済み扱い禁止）"),
	currentOfficialPrecedence: currentMaterial.includes("1. 今回レースのofficial source")
		&& currentMaterial.includes("6. Monthly retrospective")
		&& currentMaterial.includes("当日sourceと矛盾する場合は当日sourceを優先"),
	postResultCaution: currentMaterial.includes("【POST-RESULT AUDIT】")
		&& currentMaterial.includes("配当帯と実勝ち艇motor帯は確定結果の事後分類"),
	windReference: currentMaterial.includes("当日風速 3m → Monthly 3〜4m"),
	displayAudit: currentMaterial.includes("【展示ST / 進入監査】")
		&& currentMaterial.includes("艇番と実進入を混同しない"),
	focusLabels: focusFixtures.structure === "10点構成監査を優先"
		&& focusFixtures.read === "展開読み監査を優先"
		&& focusFixtures.equal === "構成・展開の両方を監査",
	noAutoTicketGeneration: !/\d-[1-6]-[1-6]/u.test(currentMaterial)
		&& currentMaterial.includes("Monthlyだけで艇番・買い目・展開を決めない"),
	trifectaContractUnchanged: bettingInstruction.includes("3連単10点")
		&& bettingInstruction.includes("厚め2点")
		&& bettingInstruction.includes("本線3点")
		&& bettingInstruction.includes("中穴3点")
		&& bettingInstruction.includes("大穴2点"),
	noExactaRequired,
	singleRaceWiring: countCalls(pageSource.slice(pageSource.indexOf("const materialText"), pageSource.indexOf("const raceLabel"))) === 1,
	frontBulkWiring: countCalls(frontRangeSource) === 1,
	lateBulkWiring: countCalls(lateRangeSource) === 1,
	bulkMonthlyBlockOnlyOnce: countCalls(frontRangeSource) === 1 && countCalls(lateRangeSource) === 1,
	monthlyLoadFailureSafe: unavailableMaterial.includes("月次振り返り: 未取得")
		&& unavailableMaterial.includes("通常素材")
		&& pageSource.includes("<BoatGptMaterialPanel materialText={materialText}"),
	existingMaterialPreserved: pageSource.includes("buildBoatPreRacePredictionSupportBlock")
		&& pageSource.includes("【通常会場素材】")
		&& pageSource.includes("buildBoatPredictionGptCopyRaceContext")
		&& pageSource.includes("buildBoatPredictionMaterial"),
	statusChip: pageSource.includes("data-boat-monthly-status=\"true\"")
		&& pageSource.includes("monthlyReferenceStatusText"),
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
	ok,
	fixtureReferences: { ...fixtureReferences, octComplete: octoberCompleteReference },
	focusFixtures,
	selectedVenue: augustOomura ? { venue: augustOomura.venue, races: augustOomura.races } : null,
	monthlyBlockCounts: {
		singleRace: countCalls(pageSource.slice(pageSource.indexOf("const materialText"), pageSource.indexOf("const raceLabel"))),
		frontBulk: countCalls(frontRangeSource),
		lateBulk: countCalls(lateRangeSource),
	},
	checks,
}, null, 2));

if (!ok) process.exitCode = 1;
