import fs from "node:fs";
import ts from "typescript";

const read = (filePath) => fs.readFileSync(filePath, "utf8");
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const loadModule = (filePath, dependencies = {}) => {
	const loaded = { exports: {} };
	new Function("exports", "module", "require", compile(read(filePath)))(loaded.exports, loaded, (id) => {
		if (id in dependencies) return dependencies[id];
		throw new Error(`Unexpected dependency in ${filePath}: ${id}`);
	});
	return loaded.exports;
};

const copyModule = loadModule("src/lib/boatPredictionGptCopy.ts");
const materialModule = loadModule("src/lib/boatPredictionMaterial.ts", {
	"./boatPredictionGptCopy": copyModule,
	"./boatExhibitionParticipation": {
		formatBoatExhibitionParticipationAlertLabel: () => "",
		resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }),
	},
	"./boatVenueFeatures": {
		buildBoatVenueFeatureFullMaterial: () => "",
		buildBoatVenueUserInsightMaterial: () => "",
	},
});
const supportModule = loadModule("src/lib/boatPreRacePredictionSupport.ts", {
	"./boatPredictionMaterial": materialModule,
});

const racers = Array.from({ length: 6 }, (_, index) => ({
	frameNo: index + 1,
	boatNo: String(index + 1),
	name: `選手${index + 1}`,
	registrationNo: index === 5 ? undefined : `50${index + 1}0`,
	branch: index === 5 ? undefined : "福岡",
	age: index === 5 ? undefined : 30 + index,
	registrationPeriod: index === 5 ? undefined : `${120 + index}期`,
	class: index === 5 ? undefined : "A1",
	averageStart: index === 5 ? undefined : `0.1${index}`,
	fCount: index === 5 ? undefined : 0,
	lCount: index === 5 ? undefined : 0,
	winRate: index === 5 ? undefined : `6.${index}`,
	secondRate: index === 5 ? undefined : `${40 + index}.0%`,
	thirdRate: index === 5 ? undefined : `${60 + index}.0%`,
	localWinRate: index === 5 ? undefined : `5.${index}`,
	localSecondRate: index === 5 ? undefined : `${35 + index}.0%`,
	motorNo: index === 5 ? undefined : String(10 + index),
	motorSecondRate: index === 5 ? undefined : `${30 + index}.0%`,
	motorThirdRate: index === 5 ? undefined : `${50 + index}.0%`,
	boatMotorNo: index === 5 ? undefined : String(20 + index),
	boatSecondRate: index === 5 ? undefined : `${25 + index}.0%`,
	boatThirdRate: index === 5 ? undefined : `${45 + index}.0%`,
}));

const buildRace = (exhibitionTimeCount) => ({
	raceNo: 1,
	racers,
	exhibitions: Array.from({ length: exhibitionTimeCount }, (_, index) => ({
		frameNo: index + 1,
		exhibitionTime: `6.${70 + index}`,
		startTiming: `0.0${index + 1}`,
		course: String(index + 1),
		tilt: "0.0",
	})),
});

const preRaceMaterial = supportModule.buildBoatPreRacePredictionSupportBlock({ race: buildRace(0) });
const partialMaterial = supportModule.buildBoatPreRacePredictionSupportBlock({ race: buildRace(3) });
const completeMaterial = supportModule.buildBoatPreRacePredictionSupportBlock({ race: buildRace(6) });
const bridgedRace = buildRace(0);
bridgedRace.racers[0] = { ...bridgedRace.racers[0], registrationPeriod: undefined };
const exactBridgeMaterial = supportModule.buildBoatPreRacePredictionSupportBlock({
	race: bridgedRace,
	venueExtra: {
		races: [{
			entryTable: [{ registrationNo: "5010", racerName: "別名でも使用しない", term: "120", source: "official-fixture" }],
		}],
	},
});
const collisionBridgeMaterial = supportModule.buildBoatPreRacePredictionSupportBlock({
	race: bridgedRace,
	venueExtra: {
		races: [{ entryTable: [{ registrationNo: "5010", term: "120", source: "official-fixture" }, { registrationNo: "5010", term: "121", source: "official-fixture" }] }],
	},
});
const bettingInstruction = copyModule.buildBoatPredictionGptBettingInstruction();
const pageSource = read("src/pages/PredictionPage.tsx");
const supportCallCount = (pageSource.match(/buildBoatPreRacePredictionSupportBlock\(\{/gu) ?? []).length;
const materialCallCount = (pageSource.match(/buildBoatPredictionMaterial\(\{/gu) ?? []).length;
const exContextCallCount = (pageSource.match(/buildBoatPredictionGptCopyRaceContext\(\{/gu) ?? []).length;
const normalMaterialLabelCount = (pageSource.match(/【通常素材】/gu) ?? []).length;
const frontRangeSource = pageSource.slice(
	pageSource.indexOf("const bulkGptMaterialSummary1R6R"),
	pageSource.indexOf("const bulkGptMaterialSummary7R12R"),
);
const lateRangeSource = pageSource.slice(
	pageSource.indexOf("const bulkGptMaterialSummary7R12R"),
	pageSource.indexOf("const activeBulkGptMaterialSummary"),
);
const exactaLines = bettingInstruction.split(/\r?\n/u).filter((line) => line.includes("2連単"));
const noExactaRequired = exactaLines.length > 0
	&& exactaLines.every((line) => /2連単(?:は|を)?(?:使わない|なし|不要)/u.test(line))
	&& !exactaLines.some((line) => /2連単.*(?:点|穴狙い|本線|厚め|買い目)/u.test(line));

const checks = {
	supportHeader: preRaceMaterial.includes("【事前予想サポート】"),
	preRaceMode: preRaceMaterial.includes("事前予想モード")
		&& preRaceMaterial.includes("展示タイム: 0/6艇")
		&& preRaceMaterial.includes("展示未取得のため、展示タイム・展示ST・進入は直前補正用"),
	partialMode: partialMaterial.includes("展示一部取得モード")
		&& partialMaterial.includes("展示タイム: 3/6艇"),
	completeMode: completeMaterial.includes("展示取得済みモード")
		&& completeMaterial.includes("展示タイム: 6/6艇"),
	sixBoatRows: [1, 2, 3, 4, 5, 6].every((frameNo) => preRaceMaterial.includes(`${frameNo}号艇`)),
	registeredProfileMaterials: preRaceMaterial.includes("登録番号 5010")
		&& preRaceMaterial.includes("支部 福岡")
		&& preRaceMaterial.includes("年齢 30")
		&& preRaceMaterial.includes("登録期 120期")
		&& preRaceMaterial.includes("級別 A1"),
	exactRegistrationPeriodBridge: exactBridgeMaterial.includes("登録番号 5010")
		&& exactBridgeMaterial.includes("登録期 120期"),
	registrationPeriodCollisionRejected: collisionBridgeMaterial.includes("登録番号 5010")
		&& collisionBridgeMaterial.includes("登録期 未取得"),
	performanceMaterials: preRaceMaterial.includes("全国勝率 6.0")
		&& preRaceMaterial.includes("全国2連率 40.0%")
		&& preRaceMaterial.includes("当地勝率 5.0")
		&& preRaceMaterial.includes("当地2連率 35.0%")
		&& preRaceMaterial.includes("平均ST 0.10")
		&& preRaceMaterial.includes("F/L 0/0"),
	motorBoatMaterials: preRaceMaterial.includes("モーター 10")
		&& preRaceMaterial.includes("モーター2連率 30.0%")
		&& preRaceMaterial.includes("ボート 20")
		&& preRaceMaterial.includes("ボート2連率 25.0%"),
	missingValuesExplicit: preRaceMaterial.includes("6号艇 選手6")
		&& preRaceMaterial.includes("登録番号 未取得")
		&& preRaceMaterial.includes("成績・ST・F/L: 全国勝率 未取得"),
	preRaceAxes: ["イン信頼", "差し警戒", "センター攻め", "外3着保護", "波乱度"]
		.every((label) => preRaceMaterial.includes(label)),
	betDesignIsGuidanceOnly: preRaceMaterial.includes("【買い目設計補助】")
		&& preRaceMaterial.includes("この欄では買い目を生成しない"),
	ticketContract: /3連単\s*(?:\/\s*)?10点/u.test(bettingInstruction)
		&& /厚め\s*2(?:点)?/u.test(bettingInstruction)
		&& /本線\s*3(?:点)?/u.test(bettingInstruction)
		&& /中穴\s*3(?:点)?/u.test(bettingInstruction)
		&& /大穴\s*2(?:点)?/u.test(bettingInstruction),
	noExactaRequired,
	noFabricatedMetrics: !/(?:的中率|期待値|信頼度\s*[:：]?\s*\d|予測スコア|自動ランキング)/u.test(preRaceMaterial),
	singleRaceWiring: supportCallCount >= 5 && pageSource.indexOf("buildBoatPreRacePredictionSupportBlock") > 0,
	frontRangeWiring: (frontRangeSource.match(/buildBoatPreRacePredictionSupportBlock\(\{/gu) ?? []).length >= 2,
	lateRangeWiring: (lateRangeSource.match(/buildBoatPreRacePredictionSupportBlock\(\{/gu) ?? []).length >= 2,
	existingAnalysisPreserved: materialCallCount >= 5 && exContextCallCount >= 2 && normalMaterialLabelCount >= 3,
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	checks,
	modes: {
		missing: supportModule.resolveBoatPredictionMode({ race: buildRace(0) }).mode,
		partial: supportModule.resolveBoatPredictionMode({ race: buildRace(3) }).mode,
		complete: supportModule.resolveBoatPredictionMode({ race: buildRace(6) }).mode,
	},
	supportCallCount,
	materialCallCount,
	exContextCallCount,
}, null, 2));

if (!ok) process.exitCode = 1;
