import fs from "node:fs";
import ts from "typescript";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const copyModule = { exports: {} };
new Function("exports", "module", compile(read("src/lib/boatPredictionGptCopy.ts")))(copyModule.exports, copyModule);
const materialModule = { exports: {} };
new Function("exports", "module", "require", compile(read("src/lib/boatPredictionMaterial.ts")))(materialModule.exports, materialModule, (id) => {
	if (id === "./boatExhibitionParticipation") return { formatBoatExhibitionParticipationAlertLabel: () => "", resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }) };
	if (id === "./boatVenueFeatures") return { buildBoatVenueFeatureFullMaterial: () => "", buildBoatVenueUserInsightMaterial: () => "" };
	throw new Error(`Unexpected material dependency: ${id}`);
});
const contextModule = { exports: {} };
new Function("exports", "module", "require", compile(read("src/lib/boatPredictionGptCopyExContext.ts")))(contextModule.exports, contextModule, (id) => {
	if (id === "./boatPredictionGptCopy") return copyModule.exports;
	if (id === "./boatPredictionMaterial") return materialModule.exports;
	if (id === "./assetPath") return { withBasePath: (value) => value };
	throw new Error(`Unexpected context dependency: ${id}`);
});

const warning = "race-analysis-not-ready-for-current-result-state";
const venue = { venueCode: "01", venueName: "桐生", date: "2026-09-03", source: "official:owpc-html", races: [] };
const race = { raceNo: 1, racers: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, name: `選手${index + 1}`, registrationNo: `500${index + 1}` })), exhibitions: [] };
const baseContext = {
	requestedDate: "2026-09-03",
	generatedAt: null,
	auditPath: null,
	raceAnalysis: [],
	registeredIdentities: [],
	racerFeatures: [],
	venueBias: null,
	roughIndex: null,
	todayFlow: null,
	venueEvidence: null,
	venueEvidencePath: "",
	venueEvidenceDate: "",
	weatherWaterHistory: null,
	weatherWaterHistoryPath: "",
	venueRaceBandHistory: null,
	decisionMethodHistory: null,
	entryShiftHistory: null,
	motorBoatHistory: null,
};

const buildFixture = ({ status, hasResult, hasPayout, hasRaceAnalysis }) => contextModule.exports.buildBoatPredictionGptCopyRaceContext({
	feed: { date: "2026-09-03", source: "official:owpc-html", venues: [] },
	venue,
	race,
	venueTimeKind: "day",
	exContext: {
		...baseContext,
		currentDayPredictionCoverage: {
			targetDate: "2026-09-03",
			resultStatus: hasResult ? "completed" : "pre-race",
			venues: [{ venueCode: "01", weatherAvailableRaceCount: 0, windAvailableRaceCount: 0, waveAvailableRaceCount: 0 }],
			races: [{ venueCode: "01", raceNo: 1, status, displayTimeCount: 0, hasResult, hasPayout, hasRaceAnalysis, warnings: [warning] }],
		},
	},
});

const preRace = buildFixture({ status: "pre-race", hasResult: false, hasPayout: false, hasRaceAnalysis: false });
const settledMissingAnalysis = buildFixture({ status: "result-and-payout", hasResult: true, hasPayout: true, hasRaceAnalysis: false });
const ready = buildFixture({ status: "race-analysis-ready", hasResult: true, hasPayout: true, hasRaceAnalysis: true });
const pageSource = read("src/pages/PredictionPage.tsx");
const generatorSource = read("scripts/generateBoatExCurrentDayPredictionCoverage.mjs");
const bettingInstruction = copyModule.exports.buildBoatPredictionGptBettingInstruction();

const checks = {
	preRaceWarningAbsent: !preRace.includes(`lifecycle warning: ${warning}`),
	preRaceLifecycleLabels: preRace.includes("当日status: pre-race")
		&& preRace.includes("結果/払戻: pre-race")
		&& preRace.includes("race-analysis: 未取得（結果・払戻の確定後に生成）"),
	settledMissingAnalysisWarningPresent: settledMissingAnalysis.includes(`lifecycle warning: ${warning}`)
		&& settledMissingAnalysis.includes("race-analysis: 未取得（結果・払戻はavailableだがrace-analysis未生成）"),
	readyWarningAbsent: !ready.includes(`lifecycle warning: ${warning}`)
		&& ready.includes("race-analysis: available"),
	generatorRequiresSettledResultAndPayout: generatorSource.includes("analysis && hasResult && hasPayout && !hasRaceAnalysis"),
	monthlyBlockUnchanged: (pageSource.match(/buildPredictionMonthlyReviewMaterial\(\{/gu) ?? []).length === 3
		&& (pageSource.match(/buildBoatPredictionMonthlyReviewContext\(\{/gu) ?? []).length === 1,
	trifectaContractUnchanged: bettingInstruction.includes("3連単10点")
		&& bettingInstruction.includes("厚め2点")
		&& bettingInstruction.includes("本線3点")
		&& bettingInstruction.includes("中穴3点")
		&& bettingInstruction.includes("大穴2点")
		&& bettingInstruction.includes("2連単は使わない"),
	currentDayCoveragePreserved: preRace.includes("【KURARI BOAT EX 当日予想coverage】")
		&& settledMissingAnalysis.includes("【KURARI BOAT EX 当日予想coverage】")
		&& ready.includes("【KURARI BOAT EX 当日予想coverage】"),
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
	ok,
	checks,
	fixtures: {
		preRace: preRace.split("\n").filter((line) => /^(当日status|結果\/払戻|race-analysis|lifecycle warning):/u.test(line)),
		settledMissingAnalysis: settledMissingAnalysis.split("\n").filter((line) => /^(当日status|結果\/払戻|race-analysis|lifecycle warning):/u.test(line)),
		ready: ready.split("\n").filter((line) => /^(当日status|結果\/払戻|race-analysis|lifecycle warning):/u.test(line)),
	},
}, null, 2));

if (!ok) process.exitCode = 1;
