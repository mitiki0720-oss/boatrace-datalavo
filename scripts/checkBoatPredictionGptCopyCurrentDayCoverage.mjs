import fs from "node:fs";
import ts from "typescript";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const compile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
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

const context = {
	requestedDate: "2026-08-15", generatedAt: null, auditPath: null, raceAnalysis: [], registeredIdentities: [{ registrationNo: "5001", appearanceCount: 12, firstSeenDate: "2026-07-13", lastSeenDate: "2026-08-02" }], racerFeatures: [],
	currentDayPredictionCoverage: { targetDate: "2026-08-15", resultStatus: "pre-race", venues: [{ venueCode: "01", weatherAvailableRaceCount: 0, windAvailableRaceCount: 0, waveAvailableRaceCount: 0 }] },
	venueBias: null, roughIndex: null, todayFlow: null, venueEvidence: null, venueEvidencePath: "", venueEvidenceDate: null, weatherWaterHistory: null, weatherWaterHistoryPath: "", venueRaceBandHistory: null, decisionMethodHistory: null, entryShiftHistory: null, motorBoatHistory: null,
};
const venue = { venueCode: "01", venueName: "桐生", date: "2026-08-15", source: "official:owpc-html", races: [] };
const race = { raceNo: 1, racers: [{ frameNo: 1, name: "選手 一郎", registrationNo: "5001" }, { frameNo: 2, name: "選手 二郎", registrationNo: "5999" }], exhibitions: [] };
const output = contextModule.exports.buildBoatPredictionGptCopyRaceContext({ feed: { date: "2026-08-15", source: "official:owpc-html", venues: [] }, venue, race, venueTimeKind: "day", exContext: context });
const checks = {
	currentCoverageBlock: output.includes("【KURARI BOAT EX 当日予想coverage】"),
	targetDate: output.includes("対象日: 2026-08-15"),
	entryAndRegistrationCoverage: output.includes("出走表coverage: 未取得 (2/6)") && output.includes("登録番号coverage: 2/2") && output.includes("選手特徴 exactリンク: 1/2"),
	preRaceResult: output.includes("結果/払戻: pre-race") && output.includes("race-analysis: 未取得（結果・払戻の確定後に生成）"),
	notWholeExMissing: output.includes("履歴EXとは別に、当日通常素材の完全性を示すcoverageです。"),
	noForbiddenOutput: !/(?:fake|score|rank|generatedPrediction|generatedTicket)/i.test(output),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, output }, null, 2));
if (!ok) process.exitCode = 1;
