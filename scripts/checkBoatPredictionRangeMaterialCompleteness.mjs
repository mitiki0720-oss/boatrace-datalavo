import fs from "node:fs";
import ts from "typescript";

const read = (path) => fs.readFileSync(path, "utf8");
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const normalizeRaceNo = (value) => {
	if (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 12) return value;
	const match = String(value ?? "").trim().match(/^0*([1-9]|1[0-2])\s*(?:R)?$/iu);
	return match ? Number(match[1]) : null;
};
const loadModule = (path, dependencies = {}) => {
	const module = { exports: {} };
	new Function("exports", "module", "require", compile(read(path)))(module.exports, module, (id) => {
		if (id in dependencies) return dependencies[id];
		throw new Error(`Unexpected dependency in ${path}: ${id}`);
	});
	return module.exports;
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
const rangeModule = loadModule("src/lib/boatPredictionRangeMaterial.ts", {
	"./boatDataFeed": { normalizeBoatRaceNo: normalizeRaceNo },
});
const {
	BOAT_PREDICTION_EARLY_RACE_NUMBERS: earlyRaceNumbers,
	BOAT_PREDICTION_LATE_RACE_NUMBERS: lateRaceNumbers,
	buildBoatPredictionRaceMaterialSection,
	buildBoatPredictionRangeMaterial,
} = rangeModule;

const feed = JSON.parse(read("public/data/boatrace/today-race-details.generated.json"));
const pageSource = read("src/pages/PredictionPage.tsx");
const panelSource = read("src/components/boatrace/BoatGptBulkMaterialPanel.tsx");

const buildMissingSection = (venue, raceNo) => [
	"[A. レース基本情報]",
	`会場名: ${venue.venueName}`,
	`日付: ${venue.date ?? feed.date}`,
	`レース番号: ${raceNo}R`,
	"race_id: 未取得",
	"ステータス: Rデータ取得待ち",
].join("\n");

const buildRange = (venue, expectedRaceNumbers, _selectedRaceNo = null) => buildBoatPredictionRangeMaterial({
	races: venue.races ?? [],
	expectedRaceNumbers,
	buildMissingSection: (raceNo) => buildMissingSection(venue, raceNo),
	buildRaceSection: (race) => buildBoatPredictionRaceMaterialSection({
		raceNo: normalizeRaceNo(race.raceNo),
		normalMaterial: materialModule.buildBoatPredictionMaterial({ venue, race, includeVenueContext: false }),
		preRaceSupport: "【事前予想サポート】\nsource-backed",
		exMaterial: [
			"【KURARI BOAT EX 当日予想coverage】",
			"【BOAT EX 天候・水面参照】",
			"【KURARI BOAT EX 履歴latest-day venue-evidence】",
			"【KURARI BOAT EX レース帯履歴】",
			"【EXレース分析】",
			"【EX選手情報】",
			"【KURARI BOAT EX 選手特徴】",
			"【source-backed / cautions】",
		].join("\n"),
	}),
});

const requiredPerRaceExLabels = [
	"【KURARI BOAT EX 当日予想coverage】",
	"【BOAT EX 天候・水面参照】",
	"【KURARI BOAT EX 履歴latest-day venue-evidence】",
	"【KURARI BOAT EX レース帯履歴】",
	"【EXレース分析】",
	"【EX選手情報】",
	"【KURARI BOAT EX 選手特徴】",
	"【source-backed / cautions】",
];

const hasPerRaceStructure = (materialText, expectedRaceNumbers) => expectedRaceNumbers.every((raceNo) => {
	const start = materialText.indexOf(`====================\n${raceNo}R\n====================`);
	const nextRaceNo = raceNo + 1;
	const end = expectedRaceNumbers.includes(nextRaceNo)
		? materialText.indexOf(`====================\n${nextRaceNo}R\n====================`, start + 1)
		: materialText.length;
	if (start < 0 || end < 0) return false;
	const block = materialText.slice(start, end);
	const normalIndex = block.indexOf("【通常のレース素材】");
	const exIndex = block.indexOf("【EX参照情報】");
	return normalIndex >= 0
		&& exIndex > normalIndex
		&& requiredPerRaceExLabels.every((label) => block.includes(label));
});

const extractRaceNumbers = (materialText) => [...materialText.matchAll(/^レース番号:\s*(\d+)R\s*$/gmu)].map((match) => Number(match[1]));
const duplicateValues = (values) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
const difference = (left, right) => left.filter((value) => !right.includes(value));

const auditRange = (venue, expectedRaceNumbers, selectedRaceNo = null) => {
	const result = buildRange(venue, expectedRaceNumbers, selectedRaceNo);
	const materialRaceNumbers = extractRaceNumbers(result.materialText);
	const uniqueRaceNumbers = [...new Set(materialRaceNumbers)];
	const sourceByRaceNo = new Map((venue.races ?? []).map((race) => [normalizeRaceNo(race.raceNo), race]));
	const identityErrors = [];
	for (const raceNo of expectedRaceNumbers) {
		const race = sourceByRaceNo.get(raceNo);
		if (!race) {
			const placeholder = buildMissingSection(venue, raceNo);
			if (!result.materialText.includes(placeholder)) {
				identityErrors.push(`${raceNo}R:placeholder-invalid`);
			}
			continue;
		}
		const raceMaterial = materialModule.buildBoatPredictionMaterial({ venue, race, includeVenueContext: false });
		for (const expectedText of [
			`会場名: ${venue.venueName}`,
			`日付: ${venue.date ?? feed.date}`,
			`レース番号: ${raceNo}R`,
			`race_id: ${race.raceId || "-"}`,
		]) {
			if (!raceMaterial.includes(expectedText)) identityErrors.push(`${raceNo}R:${expectedText}`);
		}
		const racers = Array.isArray(race.racers) ? race.racers : [];
		if (racers.length !== 6) identityErrors.push(`${raceNo}R:source-racers-${racers.length}`);
		const roster = raceMaterial.match(/\[D\. 出走表 基本データ\]([\s\S]*?)(?=\n\[E\.)/u)?.[1] ?? "";
		const frameHeadings = [...roster.matchAll(/^###\s+(\d+)号艇\s+(.+)$/gmu)];
		if (frameHeadings.length !== 6) identityErrors.push(`${raceNo}R:material-racers-${frameHeadings.length}`);
		for (const racer of racers) {
			const nameLine = `### ${racer.frameNo}号艇 ${racer.name}`;
			const registrationLine = `- 登録番号: ${racer.registrationNo || "-"}`;
			if (!roster.includes(nameLine)) identityErrors.push(`${raceNo}R:name-${racer.frameNo}`);
			if (!roster.includes(registrationLine)) identityErrors.push(`${raceNo}R:registration-${racer.frameNo}`);
		}
	}
	return {
		buttonLabel: expectedRaceNumbers[0] === 1 ? "1R〜6Rをコピー" : "7R〜12Rをコピー",
		materialRaceNumbers,
		uniqueRaceNumbers,
		expectedRaceNumbers: [...expectedRaceNumbers],
		generatedRaceCount: result.generatedRaceCount,
		expectedRaceCount: result.expectedRaceCount,
		missing: difference(expectedRaceNumbers, uniqueRaceNumbers),
		unexpected: difference(uniqueRaceNumbers, expectedRaceNumbers),
		duplicate: duplicateValues(materialRaceNumbers),
		missingSourceRaceNumbers: result.missingRaceNumbers,
		identityErrors,
		materialText: result.materialText,
	};
};

const auditOk = (audit) =>
	JSON.stringify(audit.materialRaceNumbers) === JSON.stringify(audit.expectedRaceNumbers)
	&& audit.uniqueRaceNumbers.length === audit.expectedRaceNumbers.length
	&& audit.expectedRaceCount === 6
	&& audit.missing.length === 0
	&& audit.unexpected.length === 0
	&& audit.duplicate.length === 0
	&& audit.identityErrors.length === 0;

const activeVenueAudits = (feed.venues ?? []).map((venue) => {
	const early = auditRange(venue, earlyRaceNumbers);
	const late = auditRange(venue, lateRaceNumbers);
	return {
		venue: venue.venueName,
		totalRaceCount: venue.races?.length ?? 0,
		early: { ...early, materialText: undefined },
		late: { ...late, materialText: undefined },
		ok: auditOk(early) && auditOk(late)
			&& hasPerRaceStructure(early.materialText, earlyRaceNumbers)
			&& hasPerRaceStructure(late.materialText, lateRaceNumbers),
	};
});

const mikuni = (feed.venues ?? []).find((venue) => venue.venueName === "三国");
const selectedRaceNumbers = [1, 6, 7, 8, 12];
const selectedRaceIndependence = mikuni ? selectedRaceNumbers.map((selectedRaceNo) => ({
	selectedRaceNo,
	early: extractRaceNumbers(buildRange(mikuni, earlyRaceNumbers, selectedRaceNo).materialText),
	late: extractRaceNumbers(buildRange(mikuni, lateRaceNumbers, selectedRaceNo).materialText),
})) : [];
const selectedRaceIndependent = selectedRaceIndependence.every((audit) =>
	JSON.stringify(audit.early) === JSON.stringify(earlyRaceNumbers)
	&& JSON.stringify(audit.late) === JSON.stringify(lateRaceNumbers),
);

const placeholderVenue = mikuni ? { ...mikuni, races: mikuni.races.filter((race) => Number(race.raceNo) !== 3) } : null;
const placeholderAudit = placeholderVenue ? auditRange(placeholderVenue, earlyRaceNumbers) : null;
const placeholderContract = Boolean(
	placeholderAudit
	&& JSON.stringify(placeholderAudit.materialRaceNumbers) === JSON.stringify(earlyRaceNumbers)
	&& placeholderAudit.generatedRaceCount === 5
	&& placeholderAudit.expectedRaceCount === 6
	&& placeholderAudit.missingSourceRaceNumbers.length === 1
	&& placeholderAudit.missingSourceRaceNumbers[0] === 3
	&& placeholderAudit.materialText.includes("ステータス: Rデータ取得待ち"),
);

const fixtureRacers = Array.from({ length: 6 }, (_, index) => ({
	frameNo: index + 1,
	name: `fixture-${index + 1}`,
	registrationNo: String(5000 + index + 1),
}));
const fixtureVenues = Array.from({ length: 24 }, (_, venueIndex) => ({
	id: `fixture-${venueIndex + 1}`,
	venueCode: String(venueIndex + 1).padStart(2, "0"),
	venueName: `fixture-${venueIndex + 1}`,
	date: "2026-09-06",
	races: Array.from({ length: 12 }, (_, raceIndex) => ({
		raceNo: raceIndex + 1,
		raceId: `fixture-${venueIndex + 1}-${raceIndex + 1}`,
		racers: fixtureRacers,
	})),
}));
const all24Fixture = fixtureVenues.every((venue) =>
	auditOk(auditRange(venue, earlyRaceNumbers)) && auditOk(auditRange(venue, lateRaceNumbers)),
);

const checks = {
	activeVenueCount: activeVenueAudits.length > 0,
	activeVenueRanges: activeVenueAudits.every((audit) => audit.ok),
	mikuniPresent: Boolean(mikuni),
	selectedRaceIndependent,
	placeholderContract,
	all24Fixture,
	directPresetCopy: panelSource.includes("void copyMaterial(preset.materialText")
		&& panelSource.includes("onSelectRange(preset.key)"),
	partialMaterialStatusIsExplicit: panelSource.includes("一部取得")
		&& panelSource.includes("取得待ち")
		&& panelSource.includes("完全 ${generatedRaceCount}/${expectedRaceCount}R"),
	fixedPresetMapping: pageSource.includes('key: "1r6r"')
		&& pageSource.includes('label: "1R〜6R"')
		&& pageSource.includes("materialText: bulkGptMaterialSummary1R6RWithTimeLabels.materialText")
		&& pageSource.includes('key: "7r12r"')
		&& pageSource.includes('label: "7R〜12R"')
		&& pageSource.includes("materialText: bulkGptMaterialSummary7R12RWithEx.materialText"),
	sharedHeaderStructure: (pageSource.match(/"【GPT素材ヘッダー】"/gu) ?? []).length === 2
		&& pageSource.includes("buildBoatPredictionGptCopyVenueContext"),
	singleRaceCopySeparate: panelSource.includes("singleRaceMaterialText")
		&& panelSource.includes("選択中Rをコピー"),
	resultLeakGuard: read("src/lib/boatPredictionMaterial.ts").includes("この素材は予想用のため、着順・払戻・決まり手などの結果情報は含めません。"),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
	ok,
	date: feed.date,
	checks,
	venueCount: activeVenueAudits.length,
	activeVenueAudits,
	mikuni: mikuni ? {
		earlyRaceNumbers: extractRaceNumbers(buildRange(mikuni, earlyRaceNumbers).materialText),
		lateRaceNumbers: extractRaceNumbers(buildRange(mikuni, lateRaceNumbers).materialText),
	} : null,
	selectedRaceIndependence,
	placeholder: placeholderAudit ? {
		materialRaceNumbers: placeholderAudit.materialRaceNumbers,
		generatedRaceCount: placeholderAudit.generatedRaceCount,
		expectedRaceCount: placeholderAudit.expectedRaceCount,
		missingSourceRaceNumbers: placeholderAudit.missingSourceRaceNumbers,
	} : null,
}, null, 2));
if (!ok) process.exitCode = 1;
