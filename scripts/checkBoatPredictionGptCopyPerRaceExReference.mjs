import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const copySource = read("src/lib/boatPredictionGptCopy.ts");
const materialSource = read("src/lib/boatPredictionMaterial.ts");
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
const materialModule = { exports: {} };
const requireForMaterial = (id) => {
	if (id === "./boatExhibitionParticipation") {
		return {
			formatBoatExhibitionParticipationAlertLabel: () => "",
			resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }),
		};
	}
	if (id === "./boatVenueFeatures") {
		return {
			buildBoatVenueFeatureFullMaterial: () => "",
			buildBoatVenueUserInsightMaterial: () => "",
		};
	}
	throw new Error(`Unexpected material module: ${id}`);
};
new Function("exports", "module", "require", compile(materialSource))(materialModule.exports, materialModule, requireForMaterial);
const exContextModule = { exports: {} };
const requireForExContext = (id) => {
	if (id === "./boatPredictionGptCopy") return copyModule.exports;
	if (id === "./boatPredictionMaterial") return materialModule.exports;
	if (id === "./assetPath") return { withBasePath: (value) => value };
	throw new Error(`Unexpected module: ${id}`);
};
new Function("exports", "module", "require", compile(exContextSource))(exContextModule.exports, exContextModule, requireForExContext);

const {
	buildBoatPredictionGptCopyExReferenceBlock,
	buildBoatPredictionGptCopyRaceContext,
	getBoatPredictionGptCopyExReference,
} = exContextModule.exports;
const {
	buildBoatPredictionMaterial,
	getBoatPredictionExhibitionAvailability,
	resolveBoatPredictionWeatherReference,
} = materialModule.exports;
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
	weatherActual: { weather: "曇", windDirection: "東北東", windSpeed: "3m", waveHeight: "3cm", source: "stale-race-weather" },
	exhibitions: Array.from({ length: 6 }, (_, index) => ({
		frameNo: index + 1,
		exhibitionTime: `6.${70 + index}`,
		startTiming: ".12",
		course: String(index + 1),
		tilt: "0.0",
	})),
	racers: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, name: `選手${index + 1}`, registrationNo: String(5000 + index) })),
};
const raceExtra = {
	weatherCondition: {
		weather: "晴",
		windDirection: "北",
		windSpeed: "4",
		waveHeight: "4",
		source: "official:owpc-html+before-info",
		displayTime: "2026-08-13T12:00:00+09:00",
	},
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
const getReference = (context, inputRace = race, inputRaceExtra = raceExtra) => getBoatPredictionGptCopyExReference({
	venue,
	race: inputRace,
	raceExtra: inputRaceExtra,
	exContext: context,
});
const level = (context) => getReference(context).level;
const references = {
	A: getReference(contextFor([exRace({ official: 5, exact: 1 })])),
	B: getReference(contextFor([exRace({ official: 3, unresolved: 3, weatherStatus: "missing" })])),
	C: getReference(contextFor([exRace({ official: 1, unresolved: 5, exhibitionStatus: "missing", weatherStatus: "missing" })])),
	D: getReference(contextFor([exRace({ official: 0, unresolved: 6, sourceStatus: "partial" })])),
	unknown: getReference(null),
};
const activeVenue = today.venues?.[0];
const activeRace = activeVenue?.races?.[0];
const activeContext = contextFor(latestRaceAnalysis.races ?? []);
const activeBlock = activeVenue && activeRace
	? buildBoatPredictionGptCopyRaceContext({ feed: today, venue: activeVenue, race: activeRace, venueTimeKind: "day", exContext: activeContext })
	: "";
const partialRace = {
	...race,
	exhibitions: [],
};
const partialRaceExtra = {
	beforeInfo: [
		{ frameNo: 1, startTiming: ".12" },
		{ frameNo: 2, course: "2" },
		{ frameNo: 3, tilt: "-0.5" },
	],
};
const missingRace = { ...race, exhibitions: [] };
const completeExhibition = getBoatPredictionExhibitionAvailability({ race, raceExtra });
const partialExhibition = getBoatPredictionExhibitionAvailability({ race: partialRace, raceExtra: partialRaceExtra });
const missingExhibition = getBoatPredictionExhibitionAvailability({ race: missingRace, raceExtra: null });
const partialReferenceBlock = buildBoatPredictionGptCopyExReferenceBlock(getReference(contextFor([]), partialRace, partialRaceExtra));
const normalWeatherMaterial = buildBoatPredictionMaterial({ venue, race, raceExtra, includeVenueContext: false });
const weatherReference = resolveBoatPredictionWeatherReference({ venue, race, raceExtra });
const referenceWeatherBlock = buildBoatPredictionGptCopyExReferenceBlock(references.A);
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
	levels: level(contextFor([exRace({ official: 5, exact: 1 })])) === "A" && level(contextFor([exRace({ official: 3, unresolved: 3, weatherStatus: "missing" })])) === "B" && level(contextFor([exRace({ official: 1, unresolved: 5 })])) === "C" && level(contextFor([exRace({ sourceStatus: "partial" })])) === "D" && level(contextFor([])) === "D" && level(null) === "unknown",
	levelBlocks: Object.entries(references).every(([expected, reference]) => buildBoatPredictionGptCopyExReferenceBlock(reference).includes(`EX参照レベル: ${expected}`)),
	linkageAndAvailability: buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("登録番号/選手EXリンク: 6/6") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("会場EX: ready") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("当日フロー: available"),
	lowSampleCaution: buildBoatPredictionGptCopyExReferenceBlock(references.C).includes("LOW SAMPLE: 1名") && buildBoatPredictionGptCopyExReferenceBlock(references.C).includes("未リンク: 5名"),
	exhibitionAvailability: completeExhibition.status === "complete" && completeExhibition.label.includes("展示取得済み") && partialExhibition.status === "partial" && partialExhibition.hasStartTiming && partialExhibition.hasCourse && partialReferenceBlock.includes("展示一部取得") && !partialReferenceBlock.includes("展示未取得 / 事前予想") && missingExhibition.status === "missing" && missingExhibition.label === "展示未取得 / 事前予想",
	weatherMatchesNormalMaterial: [
		`天候: ${weatherReference.weather}`,
		`風向: ${weatherReference.windDirection}`,
		`風速: ${weatherReference.windSpeed}`,
		`波高: ${weatherReference.waveHeight}`,
		`データソース: ${weatherReference.source}`,
		`表示時点: ${weatherReference.observedAt}`,
	].every((line) => normalWeatherMaterial.includes(line)) && [
		`当日天候・風・波: ${weatherReference.weather} / 風 ${weatherReference.windDirection} ${weatherReference.windSpeed} / 波 ${weatherReference.waveHeight}`,
		`通常素材 weather source: ${weatherReference.source}`,
		`通常素材 weather 表示時点: ${weatherReference.observedAt}`,
		`EX参照 weather source: 通常素材[C]と共通 (${weatherReference.source})`,
		`EX参照 weather 表示時点: ${weatherReference.observedAt}`,
	].every((line) => referenceWeatherBlock.includes(line)) && !referenceWeatherBlock.includes("東北東 3m"),
	activePerRaceBlock: activeBlock.includes("【KURARI BOAT EX 参照情報】") && activeBlock.includes("当日EXレース分析: 未取得"),
	raceBlockOrder: activeBlockOrder.every((label) => activeBlock.includes(label)) && activeBlockOrder.every((label, index) => index === 0 || activeBlock.indexOf(activeBlockOrder[index - 1]) < activeBlock.indexOf(label)),
	sourceAndPanelWiring: requiredSourceFragments.every((fragment) => exContextSource.includes(fragment)) && exContextSource.includes("通常素材[C]と共通") && exContextSource.includes("level = \"D\"") && pageSource.includes("getBoatPredictionExhibitionAvailability") && pageSource.includes("exReferenceLevelCounts") && panelSource.includes("レースごとEX参照情報を含む") && panelSource.includes("EX参照情報 source-backed"),
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
