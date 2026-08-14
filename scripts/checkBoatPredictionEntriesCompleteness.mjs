import fs from "node:fs";
import ts from "typescript";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

const materialModule = { exports: {} };
const materialSource = fs.readFileSync("src/lib/boatPredictionMaterial.ts", "utf8");
new Function("exports", "module", "require", compile(materialSource))(
	materialModule.exports,
	materialModule,
	(id) => {
		if (id === "./boatExhibitionParticipation") {
			return {
				formatBoatExhibitionParticipationAlertLabel: () => "",
				resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }),
			};
		}
		if (id === "./boatVenueFeatures") {
			return { buildBoatVenueFeatureFullMaterial: () => "", buildBoatVenueUserInsightMaterial: () => "" };
		}
		throw new Error(`Unexpected material dependency: ${id}`);
	},
);

const dataFeedModule = { exports: {} };
const dataFeedSource = fs.readFileSync("src/lib/boatDataFeed.ts", "utf8");
new Function("exports", "module", "require", compile(dataFeedSource))(
	dataFeedModule.exports,
	dataFeedModule,
	(id) => {
		if (id === "./assetPath") return { withBasePath: (value) => value };
		if (id === "./boatOperationDate") return { getBoatOperationDate: () => "2026-08-14" };
		throw new Error(`Unexpected feed dependency: ${id}`);
	},
);

const { buildBoatPredictionMaterial } = materialModule.exports;
const { normalizeBoatRaceNo } = dataFeedModule.exports;
const today = readJson("public/data/boatrace/today-race-details.generated.json");
const errors = [];
const sourceRaces = [];
let sourceCompleteRaceCount = 0;
let materialCompleteRaceCount = 0;

const materialRacerCount = (material) => {
	const match = material.match(/\[D\. 出走表 基本データ\]\n([\s\S]*?)(?:\n\n\[[A-Z][^\n]*\]|$)/u);
	return (match?.[1].match(/^### [1-6]号艇 /gmu) ?? []).length;
};

for (const venue of today.venues ?? []) {
	for (const race of venue.races ?? []) {
		const raceNo = normalizeBoatRaceNo(race.raceNo);
		const label = `${venue.venueName ?? venue.name ?? venue.id ?? "unknown"} ${race.raceNo}R`;
		const racers = Array.isArray(race.racers) ? race.racers : [];
		const sourceCount = racers.length;
		sourceRaces.push({ label, raceNo, sourceCount });
		if (raceNo === null) {
			errors.push({ category: "race-number-normalization", label, reason: "Race number is not within 1R-12R after normalization." });
			continue;
		}
		if (sourceCount !== 6) {
			errors.push({ category: "official-source-missing", label, sourceCount, reason: "Official race source does not contain exactly six entries." });
			continue;
		}

		sourceCompleteRaceCount += 1;
		const material = buildBoatPredictionMaterial({ venue, race, includeVenueContext: false });
		const renderedCount = materialRacerCount(material);
		if (renderedCount !== 6) {
			errors.push({ category: "gpt-material-missing", label, sourceCount, renderedCount, reason: "Source has six entries but GPT material did not render six boats." });
			continue;
		}
		materialCompleteRaceCount += 1;
	}
}

const normalizationCases = [
	{ value: 4, expected: 4 },
	{ value: "04", expected: 4 },
	{ value: "4R", expected: 4 },
	{ value: "12R", expected: 12 },
];
for (const testCase of normalizationCases) {
	if (normalizeBoatRaceNo(testCase.value) !== testCase.expected) {
		errors.push({ category: "race-number-normalization", value: testCase.value, reason: "Expected canonical race number was not retained." });
	}
}

for (const raceNo of [4, 7]) {
	const mikuni = sourceRaces.find((item) => item.label === `三国 ${raceNo}R`);
	if (!mikuni || mikuni.sourceCount !== 6) {
		errors.push({ category: "mikuni-regression", raceNo, reason: "Mikuni regression race is not complete in the official source." });
	}
}

const result = {
	ok: errors.length === 0,
	date: today.date ?? null,
	venueCount: (today.venues ?? []).length,
	raceCount: sourceRaces.length,
	sourceCompleteRaceCount,
	materialCompleteRaceCount,
	mikuni: sourceRaces.filter((item) => item.label === "三国 4R" || item.label === "三国 7R"),
	errors,
};
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
