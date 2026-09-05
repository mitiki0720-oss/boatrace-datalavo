import fs from "node:fs";
import ts from "typescript";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const source = fs.readFileSync("src/lib/boatPredictionMaterial.ts", "utf8");
const copyModule = { exports: {} };
new Function("exports", "module", compile(fs.readFileSync("src/lib/boatPredictionGptCopy.ts", "utf8")))(copyModule.exports, copyModule);
const materialModule = { exports: {} };
new Function("exports", "module", "require", compile(source))(
	materialModule.exports,
	materialModule,
	(id) => {
		if (id === "./boatPredictionGptCopy") return copyModule.exports;
		if (id === "./boatExhibitionParticipation") return { formatBoatExhibitionParticipationAlertLabel: () => "", resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }) };
		if (id === "./boatVenueFeatures") return { buildBoatVenueFeatureFullMaterial: () => "", buildBoatVenueUserInsightMaterial: () => "" };
		throw new Error(`Unexpected material dependency: ${id}`);
	},
);

const {
	buildBoatPredictionMaterial,
	getBoatPredictionExhibitionAvailability,
	getBoatPredictionExhibitionCardLabel,
	isBoatPredictionExhibitionTime,
} = materialModule.exports;
const today = readJson("public/data/boatrace/today-race-details.generated.json");
const errors = [];
const summary = { displayTimeCount6: 0, displayTimeCount1To5: 0, displayTimeCount0: 0, zeroCountPartialWording: 0 };
const regressions = [];
const forbiddenZeroCountWording = ["展示情報一部取得（タイム未取得", "展示一部取得です", "展示情報は一部取得です", "展示取得済み", "展示タイムOK"];

const isOfficialSource = (race) => {
	const coverageSource = String(race?.exhibitionCoverage?.source ?? "");
	const rowSources = (Array.isArray(race?.exhibitions) ? race.exhibitions : [])
		.map((row) => String(row?.source ?? ""))
		.filter(Boolean);
	const sources = [coverageSource, ...rowSources];
	return sources.length > 0 && sources.some((value) => /official|boatrace\.jp/iu.test(value));
};

for (const venue of today.venues ?? []) {
	for (const race of venue.races ?? []) {
		const availability = getBoatPredictionExhibitionAvailability({ race });
		const label = getBoatPredictionExhibitionCardLabel(availability);
		const validTimeRows = (Array.isArray(race.exhibitions) ? race.exhibitions : [])
			.filter((row) => isBoatPredictionExhibitionTime(row?.exhibitionTime ?? row?.displayTime ?? row?.time));
		const validFrames = new Set(validTimeRows.map((row) => Number(row.frameNo)).filter((frameNo) => frameNo >= 1 && frameNo <= 6));
		const key = `${venue.venueName ?? venue.name ?? venue.id ?? "unknown"} ${race.raceNo}R`;
		const coverage = race.exhibitionCoverage ?? {};
		if (validFrames.size === 6) summary.displayTimeCount6 += 1;
		else if (validFrames.size > 0) summary.displayTimeCount1To5 += 1;
		else summary.displayTimeCount0 += 1;

		if (validFrames.size === 6) {
			if (availability.status !== "complete" || label !== "展示タイムOK") {
				errors.push({ category: "complete-time-label", key, validTimeFrames: validFrames.size, availability, label });
			}
			if (!isOfficialSource(race)) {
				errors.push({ category: "complete-time-source", key, reason: "All six times exist but an official source is not recorded." });
			}
		} else if (validFrames.size > 0) {
			if (availability.status !== "partial" || label !== `展示タイム一部取得 ${validFrames.size}/6`) {
				errors.push({ category: "partial-time-label", key, validTimeFrames: validFrames.size, availability, label });
			}
		} else {
			const zeroCountHasPartialWording = [label, availability.label].some((value) => forbiddenZeroCountWording.some((fragment) => value.includes(fragment)));
			if (availability.status !== "missing" || label !== "展示タイム未取得" || zeroCountHasPartialWording) {
				errors.push({ category: "missing-time-label", key, validTimeFrames: validFrames.size, availability, label });
			}
			if (zeroCountHasPartialWording) {
				summary.zeroCountPartialWording += 1;
			}
		}
		if ((venue.venueName === "桐生" && [1, 7].includes(Number(race.raceNo))) || (venue.venueName === "戸田" && Number(race.raceNo) === 7) || (venue.venueName === "平和島" && Number(race.raceNo) === 1)) {
			regressions.push({ key, displayTimeCount: validFrames.size, cardLabel: label, materialLabel: availability.label });
		}
		if (Number(coverage.timeAvailableCount ?? 0) !== validFrames.size) {
			errors.push({ category: "coverage-count-mismatch", key, coverage, validTimeFrames: validFrames.size });
		}
		if (validFrames.size === 0 && coverage.status === "available") {
			errors.push({ category: "coverage-availability-mismatch", key, coverage, reason: "Placeholder or absent times must not be marked available." });
		}
	}
}

const placeholderFixture = { exhibitions: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, exhibitionTime: "-.--", tilt: "-.-" })) };
const nonTimeFixture = { exhibitions: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, exhibitionTime: "未取得", course: String(index + 1), tilt: "0.0", weight: "52.0" })) };
const partialFixture = { exhibitions: [{ frameNo: 1, exhibitionTime: "6.72" }, { frameNo: 2, exhibitionTime: "6.81" }] };
const completeFixture = {
	exhibitionCoverage: { source: "official:owpc-html+beforeinfo" },
	exhibitions: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, exhibitionTime: `6.${70 + index}`, source: "boatrace.jp" })),
};
for (const [name, race, expectedStatus, expectedLabel] of [
	["placeholder", placeholderFixture, "missing", "展示タイム未取得"],
	["non-time", nonTimeFixture, "missing", "展示タイム未取得"],
	["partial", partialFixture, "partial", "展示タイム一部取得 2/6"],
	["complete", completeFixture, "complete", "展示タイムOK"],
]) {
	const availability = getBoatPredictionExhibitionAvailability({ race });
	const label = getBoatPredictionExhibitionCardLabel(availability);
	if (availability.status !== expectedStatus || label !== expectedLabel) {
		errors.push({ category: "status-fixture", name, expectedStatus, expectedLabel, availability, label });
	}
}
if (!isOfficialSource(completeFixture)) {
	errors.push({ category: "official-source-fixture", reason: "A complete official exhibition fixture was not recognized as official." });
}
const nonTimeAvailability = getBoatPredictionExhibitionAvailability({ race: nonTimeFixture });
const nonTimeMaterial = buildBoatPredictionMaterial({ venue: { venueName: "桐生", races: [] }, race: nonTimeFixture, includeVenueContext: false });
if (
	nonTimeAvailability.status !== "missing" ||
	nonTimeMaterial.includes("展示情報一部取得（タイム未取得") ||
	forbiddenZeroCountWording.slice(1).some((fragment) => nonTimeMaterial.includes(fragment)) ||
	!nonTimeMaterial.includes("展示タイム未取得 / 事前予想")
) {
	errors.push({ category: "non-time-material-wording", availability: nonTimeAvailability, material: nonTimeMaterial });
}

const result = { ok: errors.length === 0, date: today.date ?? null, venueCount: (today.venues ?? []).length, raceCount: (today.venues ?? []).reduce((count, venue) => count + (venue.races?.length ?? 0), 0), summary, regressions, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
