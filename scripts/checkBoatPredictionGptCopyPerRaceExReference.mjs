import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const copySource = read("src/lib/boatPredictionGptCopy.ts");
const materialSource = read("src/lib/boatPredictionMaterial.ts");
const exContextSource = read("src/lib/boatPredictionGptCopyExContext.ts");
const pageSource = read("src/pages/PredictionPage.tsx");
const boatExPageSource = read("src/pages/BoatExPage.tsx");
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
	buildBoatPredictionGptCopyHeader,
	buildBoatPredictionGptCopyVenueContext,
	buildBoatPredictionGptCopyRaceContext,
	buildBoatPredictionGptCopyExWeatherWaterBlock,
	buildBoatPredictionGptCopyExVenueSignalsBlock,
	buildBoatPredictionGptCopyExUsefulSignalsBlocks,
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
	generatedAt: "2026-08-13T13:00:00+09:00",
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
	dateRange: { from: "2026-05-24", to: "2026-08-02", dateCount: 68 },
	generatedAt: "2026-08-13T12:00:00+09:00",
	sourceFiles: [{ sourceName: "boatrace-ex-date-index" }, { sourceName: "boatrace-ex-history-races" }],
	venues: [{
		venueCode: "01",
		venueName: "桐生",
		raceCount: 12,
		weatherAvailableRaceCount: weatherCount,
		windSpeedAverageMps: wind,
		windSpeedMaxMps: wind === null ? null : wind + 1,
		waveHeightAverageCm: wave,
		waveHeightMaxCm: wave === null ? null : wave + 1,
		weatherConditionCounts: coverage === "missing" ? {} : { "晴": weatherCount },
		windDirectionCounts: coverage === "missing" ? {} : { "南": weatherCount },
		windSpeedBandCounts: coverage === "missing" ? {} : { "3-5m": weatherCount },
		waveHeightBandCounts: coverage === "missing" ? {} : { "3-5cm": weatherCount },
		conditionProfiles: { exact: [{ key: JSON.stringify({ weather: "晴", windDirection: "北", windSpeedBand: "3-5m", waveHeightBand: "3-5cm" }), raceCount: 4, readiness: "low-sample" }] },
		readiness: { status: coverage === "available" ? "ready" : "insufficient-history" },
	}],
});
const contextFor = (raceAnalysis, venueEvidence = weatherWaterFixture()) => ({
	requestedDate: "2026-08-13",
	generatedAt: "2026-08-13T12:00:00+09:00",
	auditPath: "public/data/boatrace-ex/audit/example.json",
	raceAnalysis,
	registeredIdentities: [],
	venueBias: {
		readiness: { status: "ready" },
		dateRange: { from: "2026-05-24", to: "2026-08-02" },
		summary: { raceCount: 8784, exhibitionAvailableRaceCount: 433 },
		venues: [{
			venueId: "01",
			venueName: "桐生",
			readiness: { status: "ready" },
			firstPlaceBoatNumberCounts: { 1: 50, 2: 12, 3: 10, 4: 8, 5: 6, 6: 4 },
			firstPlaceBoatNumberRates: { 1: 0.5, 2: 0.12, 3: 0.1, 4: 0.08, 5: 0.06, 6: 0.04 },
		}],
	},
	roughIndex: {
		readiness: { status: "ready" },
		dateRange: { from: "2026-05-24", to: "2026-08-02" },
		venues: [{ venueId: "01", venueName: "桐生", readiness: { status: "ready" }, raceCount: 100, trifectaOver10000RaceCount: 20 }],
	},
	todayFlow: {
		readiness: { status: "available" },
		targetDate: "2026-08-13",
		venues: [{
			venueCode: "01",
			venueName: "桐生",
			firstPlaceBoatSequence: [{ raceNo: 1, firstPlaceBoat: "1" }, { raceNo: 2, firstPlaceBoat: "3" }, { raceNo: 7, firstPlaceBoat: "2" }, { raceNo: 8, firstPlaceBoat: "1" }],
			insideWinCount: 2,
			outsideWinCount: 2,
		}],
	},
	venueEvidence,
	venueEvidencePath: "public/data/boatrace-ex/derived/venue-evidence/2026-08-13.json",
	venueEvidenceDate: "2026-08-13",
	weatherWaterHistory: venueEvidence,
	weatherWaterHistoryPath: "public/data/boatrace-ex/derived/weather-water-history/latest.json",
	venueRaceBandHistory: { dateRange: { from: "2026-05-24", to: "2026-08-02" }, venues: [{ venueCode: "01", venueName: "桐生", bands: [{ raceBand: "7R-12R", raceCount: 50, lane1FirstRate: 0.5, centerOuterFirstRate: 0.5, trifectaOver10000Count: 8, trifectaPayoutAvailableRaceCount: 50, trifectaOver10000Rate: 0.16, readiness: { status: "ready" } }] }] },
	decisionMethodHistory: { venues: [{ venueCode: "01", venueName: "桐生", winningDecisionCounts: { "逃げ": 30, "差し": 8 } }] },
	entryShiftHistory: { venues: [{ venueCode: "01", venueName: "桐生", raceCount: 30, frameNariRate: 0.8, lane1InsideCount: 28, entryShiftRaceCount: 6 }] },
	motorBoatHistory: { venues: [{ venueCode: "01", venueName: "桐生", motors: [{ number: "21", raceCount: 6, firstCount: 2, top2Count: 3, top3Count: 4 }] }] },
});
const getReference = (context, inputRace = race, inputRaceExtra = raceExtra) => getBoatPredictionGptCopyExReference({
	venue,
	race: inputRace,
	raceExtra: inputRaceExtra,
	exContext: context,
});
const level = (context) => getReference(context).level;
const references = {
	A: getReference(contextFor([exRace({ official: 6, exact: 0 })])),
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
	exhibitions: [
		{ frameNo: 1, exhibitionTime: "6.72" },
		{ frameNo: 2, exhibitionTime: "6.81" },
	],
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
const nonTimeExhibition = getBoatPredictionExhibitionAvailability({ race: missingRace, raceExtra: partialRaceExtra });
const nonTimeReferenceBlock = buildBoatPredictionGptCopyExReferenceBlock(getReference(contextFor([]), missingRace, partialRaceExtra));
const normalWeatherMaterial = buildBoatPredictionMaterial({ venue, race, raceExtra, includeVenueContext: false });
const weatherReference = resolveBoatPredictionWeatherReference({ venue, race, raceExtra });
const referenceWeatherBlock = buildBoatPredictionGptCopyExReferenceBlock(references.A);
const availableWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, race, raceExtra, exContext: contextFor([]) });
const partialWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, race, raceExtra, exContext: contextFor([], weatherWaterFixture({ coverage: "partial", weatherCount: 2, wave: null })) });
const missingWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, race, raceExtra, exContext: contextFor([], null) });
const weatherWaterBlock = buildBoatPredictionGptCopyExWeatherWaterBlock(availableWeatherWater);
const venueSignalsBlock = buildBoatPredictionGptCopyExVenueSignalsBlock({ venue, exContext: contextFor([]) });
const usefulSignalsBlocks = buildBoatPredictionGptCopyExUsefulSignalsBlocks({ venue, race, weatherReference: availableWeatherWater, exContext: contextFor([]) }).join("\n");
const insufficientEntryContext = contextFor([]);
insufficientEntryContext.entryShiftHistory.venues[0] = {
	...insufficientEntryContext.entryShiftHistory.venues[0],
	courseAvailableRaceCount: 0,
	frameNariRate: null,
	lane1InsideCount: 0,
};
const insufficientEntrySignals = buildBoatPredictionGptCopyExUsefulSignalsBlocks({ venue, race, weatherReference: availableWeatherWater, exContext: insufficientEntryContext }).join("\n");
const lowBandRaceExtra = { weatherCondition: { ...raceExtra.weatherCondition, windSpeed: "2m", waveHeight: "1cm" } };
const lowBandWeatherWater = getBoatPredictionGptCopyExWeatherWaterReference({ venue, race, raceExtra: lowBandRaceExtra, exContext: contextFor([]) });
const fullRaceContext = buildBoatPredictionGptCopyRaceContext({ feed, venue, race, raceExtra, venueTimeKind: "day", exContext: contextFor([exRace({ official: 6, exact: 0 })]) });
const mismatchContext = { ...contextFor([]), todayFlow: { ...contextFor([]).todayFlow, targetDate: "2026-08-02" } };
const mismatchVenueContext = buildBoatPredictionGptCopyVenueContext({ venue, exContext: mismatchContext });
const header = buildBoatPredictionGptCopyHeader({ feed, venue, races: [race], raceRangeLabel: "7R-12R", rangePurposeLabel: "fixture", venueTimeKind: "day", rangeTimeKind: "day", exContext: contextFor([]) });
const activeBlockOrder = ["時間帯:", "【出走表】", "【KURARI BOAT EX 参照情報】", "【KURARI BOAT EX 天候・水面 履歴】", "【KURARI BOAT EX 当日coverage】", "【KURARI BOAT EX レース帯履歴】", "【展示情報】", "【EXレース分析】", "【EX選手情報】", "【KURARI BOAT EX 選手特徴】", "【source-backed / cautions】"];
const forbidden = ["fake", "score", "rank", "generatedPrediction", "generatedTicket"];
const requiredSourceFragments = [
	"getBoatPredictionGptCopyExReference",
	"buildBoatPredictionGptCopyExReferenceBlock",
	"KURARI BOAT EX 参照情報",
	"EX参照レベル:",
	"登録番号/選手EXリンク:",
	"当日天候・風・波:",
	"EX使用上の注意:",
	"racerFeatures",
	"formatRacerFeatureLines",
	"KURARI BOAT EX 選手特徴",
];
const checks = {
	levels: level(contextFor([exRace({ official: 5, exact: 1 })])) === "A" && level(contextFor([exRace({ official: 3, unresolved: 3, weatherStatus: "missing" })])) === "B" && level(contextFor([exRace({ official: 1, unresolved: 5 })], weatherWaterFixture({ coverage: "partial", weatherCount: 4, wave: null }))) === "C" && level(contextFor([exRace({ sourceStatus: "partial" })], weatherWaterFixture({ coverage: "missing", weatherCount: 0, wind: null, wave: null }))) === "D" && level(contextFor([])) === "D" && level(null) === "unknown",
	levelBlocks: Object.entries(references).every(([expected, reference]) => buildBoatPredictionGptCopyExReferenceBlock(reference).includes(`EX参照レベル: ${expected}`)),
	linkageAndAvailability: buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("登録番号exactリンク: 6/6") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("未リンク: 0名") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("氏名推測リンク: 使用禁止") && !buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("完全一致リンク:") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("会場EX: ready") && buildBoatPredictionGptCopyExReferenceBlock(references.A).includes("当日フロー: available"),
	targetDateAndHistoricalSourceLabels: mismatchVenueContext.includes("EX当日フロー: 対象日不一致") && !mismatchVenueContext.includes("EX当日フロー: available") && header.includes("対象日EX race-analysis source: 未取得") && header.includes("EX履歴source: available") && header.includes("EX履歴データ期間: 2026-05-24 ～ 2026-08-02") && header.includes("EX履歴source種別: source-backed derived") && !header.includes("- EX source: 未取得"),
	lowSampleCaution: buildBoatPredictionGptCopyExReferenceBlock(references.C).includes("LOW SAMPLE: 1名") && buildBoatPredictionGptCopyExReferenceBlock(references.C).includes("未リンク: 5名"),
	exhibitionAvailability: completeExhibition.status === "complete" && completeExhibition.label.includes("展示取得済み") && partialExhibition.status === "partial" && partialExhibition.label === "展示タイム一部取得 2/6" && partialReferenceBlock.includes("展示タイム一部取得です") && !partialReferenceBlock.includes("展示タイム未取得") && missingExhibition.status === "missing" && missingExhibition.label === "展示タイム未取得 / 事前予想" && nonTimeExhibition.status === "missing" && nonTimeExhibition.label === "展示タイム未取得 / 事前予想" && nonTimeReferenceBlock.includes("展示タイム未取得です") && !["展示情報一部取得（タイム未取得", "展示一部取得です", "展示情報は一部取得です"].some((fragment) => nonTimeReferenceBlock.includes(fragment)),
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
		"通常素材 source acquired at: 2026-08-13T13:00:00+09:00",
		"通常素材 weather 注意: weather値は未更新/確認中。出走表source取得時刻とは異なる。",
	].every((line) => referenceWeatherBlock.includes(line)) && !referenceWeatherBlock.includes("東北東 3m"),
	exWeatherWater: weatherWaterBlock.includes("【KURARI BOAT EX 天候・水面 履歴】") && weatherWaterBlock.includes("EX天候・水面履歴: available") && weatherWaterBlock.includes("EX風・波データ: available") && weatherWaterBlock.includes("平均風速: 4.2m/s") && weatherWaterBlock.includes("平均波高: 3.1cm") && weatherWaterBlock.includes("条件一致: partial") && weatherWaterBlock.includes("当日条件: 天候") && weatherWaterBlock.includes("(3-5m)") && weatherWaterBlock.includes("(3-5cm)") && weatherWaterBlock.includes("参照source: public/data/boatrace-ex/derived/weather-water-history/latest.json") && weatherWaterBlock.includes("データ期間: 履歴 2026-05-24〜2026-08-02") && weatherWaterBlock.includes("参照source名: boatrace-ex-date-index / boatrace-ex-history-races ×68日") && weatherWaterBlock.includes("LOW SAMPLE (0R)") && partialWeatherWater.availability === "partial" && partialWeatherWater.sampleStatus.includes("LOW SAMPLE") && missingWeatherWater.availability === "missing" && missingWeatherWater.sampleStatus === "未取得",
	exVenueRoughFlow: venueSignalsBlock.includes("会場傾向 データ期間: 履歴") && venueSignalsBlock.includes("イン/中外傾向: イン寄り") && venueSignalsBlock.includes("コース別1着率: 1号艇 50.0%") && venueSignalsBlock.includes("EX履歴 展示coverage: 433/8784R") && venueSignalsBlock.includes("荒れ指数 データ期間: 履歴") && venueSignalsBlock.includes("荒れやすさ: 3連単 10,000円超 20/100R (20.0%)") && venueSignalsBlock.includes("EX当日フロー: available") && venueSignalsBlock.includes("1R～6R フロー: 1号艇:1 / 3号艇:1") && venueSignalsBlock.includes("7R～12R フロー: 1号艇:1 / 2号艇:1") && venueSignalsBlock.includes("当日風・波・イン変化: 未取得"),
	usefulSignals: ["【KURARI BOAT EX レース帯履歴】", "【KURARI BOAT EX 条件別履歴】", "完全一致サンプル: 4R", "【KURARI BOAT EX 決まり手履歴】", "【KURARI BOAT EX 進入履歴】", "【KURARI BOAT EX モーター履歴】"].every((fragment) => usefulSignalsBlocks.includes(fragment)) && !usefulSignalsBlocks.includes("未取得R") && !buildBoatPredictionGptCopyExVenueSignalsBlock({ venue, exContext: contextFor([]) }).includes("決まり手履歴傾向: 未取得"),
	entrySourceAvailability: insufficientEntrySignals.includes("枠なり傾向: 未判定（source field insufficient）") && insufficientEntrySignals.includes("1号艇イン取得: 未判定（source field insufficient）") && !insufficientEntrySignals.includes("枠なり傾向: 100.0%\n1号艇イン取得: 0/"),
	numericWeatherBands: lowBandWeatherWater.currentConditions.windSpeedBand === "0-2m" && lowBandWeatherWater.currentConditions.waveHeightBand === "0-2cm",
	availabilityAndCautions: fullRaceContext.includes("EX race-analysis shard: source-backed") && fullRaceContext.includes("通常素材 展示availability: 展示取得済み") && fullRaceContext.includes("展示取得済みのため、展示反映済み素材として扱ってください。") && !fullRaceContext.includes("展示未取得は事前予想として扱ってください。") && fullRaceContext.includes("オッズ情報は含まれていますが") && !fullRaceContext.includes("オッズはこのコピー素材に含めない。"),
	bettingRules: normalWeatherMaterial.includes("買い目は3連単10点。") && normalWeatherMaterial.includes("厚め2点、本線3点、中穴3点、大穴2点。") && normalWeatherMaterial.includes("2連単は使わない。") && !["3連単は厚め2点、本線6点", "2連単は穴狙い2点", "本線6点"].some((fragment) => normalWeatherMaterial.includes(fragment)),
	activePerRaceBlock: activeBlock.includes("【KURARI BOAT EX 参照情報】") && activeBlock.includes("当日EXレース分析: 未取得"),
	raceBlockOrder: activeBlockOrder.every((label) => activeBlock.includes(label)) && activeBlockOrder.every((label, index) => index === 0 || activeBlock.indexOf(activeBlockOrder[index - 1]) < activeBlock.indexOf(label)),
	sourceAndPanelWiring: exContextSource.includes("weatherWaterHistoryPath") && exContextSource.includes("venueEvidenceDate") && exContextSource.includes("buildBoatPredictionGptCopyExDailyCoverageBlock") && exContextSource.includes("buildBoatPredictionGptCopyExUsefulSignalsBlocks") && exContextSource.includes("derived/weather-water-history/latest.json") && exContextSource.includes("derived/venue-evidence/") && exContextSource.includes("venue-race-band-history") && exContextSource.includes("courseAvailableRaceCount") && exContextSource.includes("level = \"D\"") && pageSource.includes("getBoatPredictionExhibitionAvailability") && pageSource.includes("exReferenceLevelCounts") && boatExPageSource.includes("WeatherHistorySection"),
	noForbiddenOutput: forbidden.every((fragment) => !Object.values(references).some((reference) => buildBoatPredictionGptCopyExReferenceBlock(reference).includes(fragment))),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	date: today.date,
	activeVenueCount: today.venues?.length ?? 0,
	exhibition: {
		complete: completeExhibition,
		partial: partialExhibition,
		missing: missingExhibition,
		nonTime: nonTimeExhibition,
		partialReferenceHasPartialLabel: partialReferenceBlock.includes("展示タイム一部取得です"),
	},
	checks,
}, null, 2));

if (!ok) process.exitCode = 1;
