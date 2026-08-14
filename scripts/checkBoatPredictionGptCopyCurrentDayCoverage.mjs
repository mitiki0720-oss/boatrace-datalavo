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
	venueBias: null, roughIndex: null, todayFlow: null,
	venueEvidence: { venues: [{ venueCode: "01", venueName: "桐生", raceCount: 12, weatherEvidence: { availableCount: 12 } }] },
	venueEvidencePath: "public/data/boatrace-ex/derived/venue-evidence/2026-08-02.json",
	venueEvidenceDate: "2026-08-02",
	weatherWaterHistory: null, weatherWaterHistoryPath: "", venueRaceBandHistory: null, decisionMethodHistory: null, entryShiftHistory: null, motorBoatHistory: null,
};
const venue = { venueCode: "01", venueName: "桐生", date: "2026-08-15", source: "official:owpc-html", races: [] };
const race = { raceNo: 1, racers: [{ frameNo: 1, name: "選手 一郎", registrationNo: "5001" }, { frameNo: 2, name: "選手 二郎", registrationNo: "5999" }], exhibitions: [] };
const output = contextModule.exports.buildBoatPredictionGptCopyRaceContext({ feed: { date: "2026-08-15", source: "official:owpc-html", venues: [] }, venue, race, venueTimeKind: "day", exContext: context });
const today = JSON.parse(read("public/data/boatrace/today.generated.json"));
const currentDayPredictionCoverage = JSON.parse(read("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json"));
const registeredRacers = JSON.parse(read("public/data/boatrace-ex/identity/registered-racers.generated.json"));
const dateIndex = JSON.parse(read("public/data/boatrace-ex/index.generated.json"));
const sampleEvidenceDate = dateIndex.latestDate;
const sampleContext = {
	requestedDate: today.date,
	generatedAt: null,
	auditPath: null,
	raceAnalysis: [],
	registeredIdentities: registeredRacers.identities,
	racerFeatures: [],
	currentDayPredictionCoverage,
	venueBias: null,
	roughIndex: null,
	todayFlow: null,
	venueEvidence: JSON.parse(read(`public/data/boatrace-ex/derived/venue-evidence/${sampleEvidenceDate}.json`)),
	venueEvidencePath: `public/data/boatrace-ex/derived/venue-evidence/${sampleEvidenceDate}.json`,
	venueEvidenceDate: sampleEvidenceDate,
	weatherWaterHistory: null,
	weatherWaterHistoryPath: "",
	venueRaceBandHistory: null,
	decisionMethodHistory: null,
	entryShiftHistory: null,
	motorBoatHistory: null,
};
const sampleOutput = (venueName, raceNo) => {
	const sampleVenue = today.venues.find((item) => item.venueName === venueName);
	const sampleRace = sampleVenue?.races?.find((item) => Number(item.raceNo) === raceNo);
	return sampleVenue && sampleRace
		? contextModule.exports.buildBoatPredictionGptCopyRaceContext({ feed: today, venue: sampleVenue, race: sampleRace, venueTimeKind: "day", exContext: sampleContext })
		: "";
};
const mikuni1R = sampleOutput("三国", 1);
const tamagawa7R = sampleOutput("多摩川", 7);
const suminoe1R = sampleOutput("住之江", 1);
const checks = {
	currentCoverageBlock: output.includes("【KURARI BOAT EX 当日予想coverage】"),
	targetDate: output.includes("対象日: 2026-08-15"),
	entryAndRegistrationCoverage: output.includes("出走表coverage: 未取得 (2/6)") && output.includes("登録番号coverage: 2/2") && output.includes("選手特徴 exactリンク: 1/2"),
	preRaceResult: output.includes("結果/払戻: pre-race") && output.includes("race-analysis: 未取得（結果・払戻の確定後に生成）"),
	historicalLatestDayVenueEvidence: output.includes("【KURARI BOAT EX 履歴latest-day venue-evidence】") && output.includes("EX履歴latest日: 2026-08-02") && output.includes("予想対象日: 2026-08-15") && output.includes("対象日一致: no") && output.includes("用途: 履歴EXのlatest-day確認用。予想当日の通常素材coverageではありません。") && output.includes("source: public/data/boatrace-ex/derived/venue-evidence/2026-08-02.json") && output.includes("EX履歴latest-day天候・水面 availability: target-date-mismatch"),
	noLegacyDailyCoverage: !output.includes("【KURARI BOAT EX 当日coverage】") && !output.includes("当日coverage: 対象日不一致のため予想当日データとしては使わない") && !output.includes("データ期間: daily 2026-08-02") && !output.includes("EX当日フロー: 対象日不一致"),
	venueSamples: mikuni1R.includes("【KURARI BOAT EX 当日予想coverage】") && mikuni1R.includes("【KURARI BOAT EX 履歴latest-day venue-evidence】") && mikuni1R.includes("未リンク: 1名") && !mikuni1R.includes("【KURARI BOAT EX 当日coverage】") && tamagawa7R.includes("【KURARI BOAT EX 当日予想coverage】") && tamagawa7R.includes("選手特徴 exactリンク: 6/6") && !tamagawa7R.includes("【KURARI BOAT EX 当日coverage】") && suminoe1R.includes("【KURARI BOAT EX 当日予想coverage】") && suminoe1R.includes("結果/払戻: pre-race") && !suminoe1R.includes("【KURARI BOAT EX 当日coverage】"),
	notWholeExMissing: output.includes("履歴EXとは別に、当日通常素材の完全性を示すcoverageです。"),
	noForbiddenOutput: !/(?:fake|score|rank|generatedPrediction|generatedTicket)/i.test(output),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	checks,
	samples: {
		mikuni1R: { currentDayCoverage: mikuni1R.includes("【KURARI BOAT EX 当日予想coverage】"), historicalLatestDayEvidence: mikuni1R.includes("【KURARI BOAT EX 履歴latest-day venue-evidence】"), unlinked: mikuni1R.match(/未リンク: \d+名/)?.[0] ?? "" },
		tamagawa7R: { currentDayCoverage: tamagawa7R.includes("【KURARI BOAT EX 当日予想coverage】"), exactLink: tamagawa7R.match(/選手特徴 exactリンク: \d+\/\d+/)?.[0] ?? "" },
		suminoe1R: { currentDayCoverage: suminoe1R.includes("【KURARI BOAT EX 当日予想coverage】"), resultStatus: suminoe1R.match(/結果\/払戻: \S+/)?.[0] ?? "" },
	},
}, null, 2));
if (!ok) process.exitCode = 1;
