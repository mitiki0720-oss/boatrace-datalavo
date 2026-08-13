import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const copySource = read("src/lib/boatPredictionGptCopy.ts");
const exContextSource = read("src/lib/boatPredictionGptCopyExContext.ts");
const pageSource = read("src/pages/PredictionPage.tsx");
const panelSource = read("src/components/boatrace/BoatGptBulkMaterialPanel.tsx");
const today = JSON.parse(read("public/data/boatrace/today.generated.json"));
const latestRaceAnalysis = JSON.parse(read("public/data/boatrace-ex/derived/race-analysis/latest.json"));

const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const copyModule = { exports: {} };
new Function("exports", "module", compile(copySource))(copyModule.exports, copyModule);
const exContextModule = { exports: {} };
const requireForExContext = (id) => {
	if (id === "./boatPredictionGptCopy") return copyModule.exports;
	if (id === "./assetPath") return { withBasePath: (value) => value };
	throw new Error(`Unexpected module: ${id}`);
};
new Function("exports", "module", "require", compile(exContextSource))(exContextModule.exports, exContextModule, requireForExContext);

const {
	buildBoatPredictionGptCopyExReferenceBlock,
	buildBoatPredictionGptCopyRaceContext,
	getBoatPredictionGptCopyExReference,
} = exContextModule.exports;
const feed = { date: "2026-08-13", generatedAt: "2026-08-13T12:00:00+09:00", source: "official:owpc-html" };
const venue = {
	venueCode: "01",
	venueName: "桐生",
	date: "2026-08-13",
	races: [],
	weatherActual: { weather: "晴", windDirection: "北", windSpeed: "4m", waveHeight: "2cm", source: "official:owpc-html+venue-weather" },
};
const race = {
	raceNo: 7,
	deadlineTime: "18:15",
	racers: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, name: `選手${index + 1}`, registrationNo: String(5000 + index) })),
};
const exRace = ({ official = 0, exact = 0, unresolved = 0, sourceStatus = "complete", racerEvidenceStatus = "available", exhibitionStatus = "available", weatherStatus = "available" } = {}) => ({
	date: "2026-08-13",
	venueCode: "01",
	venueName: "桐生",
	raceNo: 7,
	sourceStatus,
	racerEvidenceStatus,
	exhibitionStatus,
	weatherStatus,
	racers: [],
	racerLinkageSummary: {
		racerCount: 6,
		officialRegistrationLinkedCount: official,
		nameLinkedCount: exact,
		unresolvedCount: unresolved,
		ambiguousCount: 0,
		collisionCount: 0,
	},
	analysisNotes: [],
});
const contextFor = (raceAnalysis) => ({
	requestedDate: "2026-08-13",
	generatedAt: "2026-08-13T12:00:00+09:00",
	auditPath: "public/data/boatrace-ex/audit/example.json",
	raceAnalysis,
	registeredIdentities: [],
	venueBias: { readiness: { status: "ready" } },
	roughIndex: { readiness: { status: "ready" } },
	todayFlow: { readiness: { status: "available" } },
});
const level = (context) => getBoatPredictionGptCopyExReference({ venue, race, exContext: context }).level;
const references = {
	A: getBoatPredictionGptCopyExReference({ venue, race, exContext: contextFor([exRace({ official: 5, exact: 1 })]) }),
	B: getBoatPredictionGptCopyExReference({ venue, race, exContext: contextFor([exRace({ official: 3, unresolved: 3, weatherStatus: "missing" })]) }),
	C: getBoatPredictionGptCopyExReference({ venue, race, exContext: contextFor([exRace({ official: 1, unresolved: 5, exhibitionStatus: "missing", weatherStatus: "missing" })]) }),
	D: getBoatPredictionGptCopyExReference({ venue, race, exContext: contextFor([exRace({ official: 0, unresolved: 6, sourceStatus: "partial" })]) }),
	unknown: getBoatPredictionGptCopyExReference({ venue, race, exContext: null }),
};
const activeVenue = today.venues?.[0];
const activeRace = activeVenue?.races?.[0];
const activeContext = contextFor(latestRaceAnalysis.races ?? []);
const activeBlock = activeVenue && activeRace
	? buildBoatPredictionGptCopyRaceContext({ feed: today, venue: activeVenue, race: activeRace, venueTimeKind: "day", exContext: activeContext })
	: "";
const activeBlockOrder = ["時間帯:", "【出走表】", "【KURARI BOAT EX 参照情報】", "【展示情報】", "【EXレース分析】", "【EX選手情報】", "【source-backed / cautions】"];
const forbidden = ["fake", "score", "rank", "generatedPrediction", "generatedTicket"];
const requiredSourceFragments = [
	"getBoatPredictionGptCopyExReference",
	"buildBoatPredictionGptCopyExReferenceBlock",
	"KURARI BOAT EX 参照情報",
	"EX参照レベル:",
	"登録番号/選手EXリンク:",
	"当日天候・風・波:",
	"EX使用上の注意:",
];
const checks = {
	levels: level(contextFor([exRace({ official: 5, exact: 1 })])) === "A" && level(contextFor([exRace({ official: 3, unresolved: 3, weatherStatus: "missing" })])) === "B" && level(contextFor([exRace({ official: 1, unresolved: 5 })])) === "C" && level(contextFor([exRace({ sourceStatus: "partial" })])) === "D" && level(null) === "unknown",
	levelBlocks: Object.entries(references).every(([expected, reference]) => buildBoatPredictionGptCopyExReferenceBlock(reference).includes(`EX参照レベル: ${expected}`)),
	linkageAndAvailability: buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("登録番号/選手EXリンク: 6/6") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("会場EX: ready") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("当日フロー: available"),
	lowSampleCaution: buildBoatPredictionGptCopyExReferenceBlock(references.C).includes("LOW SAMPLE: 1名") && buildBoatPredictionGptCopyExReferenceBlock(references.C).includes("未リンク: 5名"),
	activePerRaceBlock: activeBlock.includes("【KURARI BOAT EX 参照情報】") && activeBlock.includes("当日EXレース分析: 未取得"),
	raceBlockOrder: activeBlockOrder.every((label) => activeBlock.includes(label)) && activeBlockOrder.every((label, index) => index === 0 || activeBlock.indexOf(activeBlockOrder[index - 1]) < activeBlock.indexOf(label)),
	sourceAndPanelWiring: requiredSourceFragments.every((fragment) => exContextSource.includes(fragment)) && pageSource.includes("exReferenceLevelCounts") && panelSource.includes("レースごとEX参照情報を含む") && panelSource.includes("EX参照情報 source-backed"),
	noForbiddenOutput: forbidden.every((fragment) => !Object.values(references).some((reference) => buildBoatPredictionGptCopyExReferenceBlock(reference).includes(fragment))),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	date: today.date,
	activeVenueCount: today.venues?.length ?? 0,
	checks,
}, null, 2));

if (!ok) process.exitCode = 1;
