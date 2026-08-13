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
	buildBoatPredictionGptCopyExWeatherWaterBlock,
	getBoatPredictionGptCopyExReference,
	getBoatPredictionGptCopyExWeatherWaterReference,
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
const weatherWaterFixture = ({ coverage = "available", weatherCount = 12, wind = 4.2, wave = 3.1 } = {}) => ({
	date: "2026-08-13",
	generatedAt: "2026-08-13T12:00:00+09:00",
	sourceFiles: [{ sourceName: "boatrace-ex-history-races" }],
	venues: [{
		date: "2026-08-13",
		venueCode: "01",
		venueName: "桐生",
		raceCount: 12,
		coverage: { weather: coverage },
		availability: { weatherCount },
		weatherEvidence: {
			windSpeedAverageMps: wind,
			windSpeedMaxMps: wind === null ? null : wind + 1,
			waveHeightAverageCm: wave,
			waveHeightMaxCm: wave === null ? null : wave + 1,
		},
	}],
});
const contextFor = (raceAnalysis, venueEvidence = weatherWaterFixture()) => ({
	requestedDate: "2026-08-13",
	generatedAt: "2026-08-13T12:00:00+09:00",
	auditPath: "public/data/boatrace-ex/audit/example.json",
	raceAnalysis,
	registeredIdentities: [],
	venueBias: { readiness: { status: "ready" } },
	roughIndex: { readiness: { status: "ready" } },
	todayFlow: { readiness: { status: "available" } },
	venueEvidence,
	venueEvidencePath: "public/data/boatrace-ex/derived/venue-evidence/2026-08-13.json",
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
	C: getReference(contextFor([exRace({ official: 1, unresolved: 5, exhibitionStatus: "missing", weatherStatus: "missing" })], weatherWaterFixture({ coverage: "partial", weatherCount: 4, wave: null }))),
	D: getReference(contextFor([exRace({ official: 0, unresolved: 6, sourceStatus: "partial" })], weatherWaterFixture({ coverage: "missing", weatherCount: 0, wind: null, wave: null }))),
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
const availableWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, exContext: contextFor([]) });
const partialWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, exContext: contextFor([], weatherWaterFixture({ coverage: "partial", weatherCount: 2, wave: null })) });
const missingWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, exContext: contextFor([], null) });
const weatherWaterBlock = buildBoatPredictionGptCopyExWeatherWaterBlock(availableWeatherWater);
const fullRaceContext = buildBoatPredictionGptCopyRaceContext({ feed, venue, race, raceExtra, venueTimeKind: "day", exContext: contextFor([exRace({ official: 5, exact: 1 })]) });
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
	levels: level(contextFor([exRace({ official: 5, exact: 1 })])) === "A" && level(contextFor([exRace({ official: 3, unresolved: 3, weatherStatus: "missing" })])) === "B" && level(contextFor([exRace({ official: 1, unresolved: 5 })], weatherWaterFixture({ coverage: "partial", weatherCount: 4, wave: null }))) === "C" && level(contextFor([exRace({ sourceStatus: "partial" })], weatherWaterFixture({ coverage: "missing", weatherCount: 0, wind: null, wave: null }))) === "D" && level(contextFor([])) === "D" && level(null) === "unknown",
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
	exWeatherWater: weatherWaterBlock.includes("【KURARI BOAT EX 天候・水面】") && weatherWaterBlock.includes("EX天候・水面: available") && weatherWaterBlock.includes("EX風・波データ: available") && weatherWaterBlock.includes("平均風速: 4.2m/s") && weatherWaterBlock.includes("平均波高: 3.1cm") && weatherWaterBlock.includes("条件一致: 条件一致不足") && weatherWaterBlock.includes("参照source: public/data/boatrace-ex/derived/venue-evidence/2026-08-13.json") && partialWeatherWater.availability === "partial" && partialWeatherWater.sampleStatus.includes("LOW SAMPLE") && missingWeatherWater.availability === "missing" && missingWeatherWater.sampleStatus === "未取得",
	availabilityAndCautions: fullRaceContext.includes("EX race-analysis shard: source-backed") && fullRaceContext.includes("通常素材 展示availability: 展示取得済み") && fullRaceContext.includes("展示取得済みのため、展示反映済み素材として扱ってください。") && !fullRaceContext.includes("展示未取得は事前予想として扱ってください。") && fullRaceContext.includes("オッズ情報は含まれていますが") && !fullRaceContext.includes("オッズはこのコピー素材に含めない。"),
	bettingRules: normalWeatherMaterial.includes("買い目は3連単10点。") && normalWeatherMaterial.includes("厚め2点、本線3点、中穴3点、大穴2点。") && normalWeatherMaterial.includes("2連単は使わない。") && !["3連単は厚め2点、本線6点", "2連単は穴狙い2点", "本線6点"].some((fragment) => normalWeatherMaterial.includes(fragment)),
	activePerRaceBlock: activeBlock.includes("【KURARI BOAT EX 参照情報】") && activeBlock.includes("当日EXレース分析: 未取得"),
	raceBlockOrder: activeBlockOrder.every((label) => activeBlock.includes(label)) && activeBlockOrder.every((label, index) => index === 0 || activeBlock.indexOf(activeBlockOrder[index - 1]) < activeBlock.indexOf(label)),
	sourceAndPanelWiring: requiredSourceFragments.every((fragment) => exContextSource.includes(fragment)) && exContextSource.includes("derived/venue-evidence/${date}.json") && exContextSource.includes("KURARI BOAT EX 天候・水面") && exContextSource.includes("通常素材[C]と共通") && exContextSource.includes("level = \"D\"") && pageSource.includes("getBoatPredictionExhibitionAvailability") && pageSource.includes("exReferenceLevelCounts") && panelSource.includes("レースごとEX参照情報を含む") && panelSource.includes("EX参照情報 source-backed"),
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
