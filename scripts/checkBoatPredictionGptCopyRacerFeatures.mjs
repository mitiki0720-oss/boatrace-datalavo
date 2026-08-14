import fs from "node:fs";
import ts from "typescript";

const source = fs.readFileSync("src/lib/boatPredictionGptCopyExContext.ts", "utf8");
const materialSource = fs.readFileSync("src/lib/boatPredictionMaterial.ts", "utf8");
const copySource = fs.readFileSync("src/lib/boatPredictionGptCopy.ts", "utf8");
const compile = (value) => ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const copyModule = { exports: {} };
new Function("exports", "module", compile(copySource))(copyModule.exports, copyModule);
const materialModule = { exports: {} };
new Function("exports", "module", "require", compile(materialSource))(materialModule.exports, materialModule, (id) => {
	if (id === "./boatExhibitionParticipation") return { formatBoatExhibitionParticipationAlertLabel: () => "", resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }) };
	if (id === "./boatVenueFeatures") return { buildBoatVenueFeatureFullMaterial: () => "", buildBoatVenueUserInsightMaterial: () => "" };
	throw new Error(`Unexpected material dependency: ${id}`);
});
const contextModule = { exports: {} };
new Function("exports", "module", "require", compile(source))(contextModule.exports, contextModule, (id) => {
	if (id === "./boatPredictionGptCopy") return copyModule.exports;
	if (id === "./boatPredictionMaterial") return materialModule.exports;
	if (id === "./assetPath") return { withBasePath: (value) => value };
	throw new Error(`Unexpected context dependency: ${id}`);
});

const context = {
	requestedDate: "2026-08-15", generatedAt: null, auditPath: null, raceAnalysis: [], registeredIdentities: [],
	racerFeatures: [{ registrationNo: "5001", name: "選手 一郎", historyStarts: 12, sampleLevel: "sufficient", venues: [{ venueCode: "01", starts: 3, sampleLevel: "low-sample" }], frames: [{ frameNo: 1, starts: 4, sampleLevel: "low-sample" }], startTiming: { sampleCount: 10, average: 0.132, sampleLevel: "sufficient" }, winMethodCounts: { 逃げ: 2 }, recent: { last5: { starts: 5, averageST: 0.12 }, last10: { starts: 10, averageST: 0.13 } } }],
	venueBias: null, roughIndex: null, todayFlow: null, venueEvidence: null, venueEvidencePath: "", venueEvidenceDate: null,
	weatherWaterHistory: null, weatherWaterHistoryPath: "", venueRaceBandHistory: null, decisionMethodHistory: null, entryShiftHistory: null, motorBoatHistory: null,
};
const venue = { venueCode: "01", venueName: "桐生", date: "2026-08-15", source: "official", races: [] };
const race = { raceNo: 1, racers: [{ frameNo: 1, name: "選手 一郎", registrationNo: "5001" }, { frameNo: 2, name: "未接続 選手", registrationNo: "5999" }], exhibitions: [] };
const output = contextModule.exports.buildBoatPredictionGptCopyRaceContext({ feed: { date: "2026-08-15", source: "official", venues: [] }, venue, race, venueTimeKind: "day", exContext: context });
const checks = {
	featureBlock: output.includes("【KURARI BOAT EX 選手特徴】"),
	exactFeature: output.includes("登録番号 5001 / EX履歴 12走"),
	unlinkedIsExplicit: output.includes("登録番号完全一致のEX履歴特徴は未取得"),
	noForbiddenOutput: !/(?:fake|guessed|inferred|score|rank|prediction)/i.test(output),
	sourceMarker: output.includes("登録番号の完全一致と履歴ソースに基づく記述統計"),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, output }, null, 2));
if (!ok) process.exitCode = 1;
