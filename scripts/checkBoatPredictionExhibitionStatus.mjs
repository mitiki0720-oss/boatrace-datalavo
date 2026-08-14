import fs from "node:fs";
import ts from "typescript";

const readJson = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const compile = (source) => ts.transpileModule(source, {
	compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const source = fs.readFileSync("src/lib/boatPredictionMaterial.ts", "utf8");
const materialModule = { exports: {} };
new Function("exports", "module", "require", compile(source))(
	materialModule.exports,
	materialModule,
	(id) => {
		if (id === "./boatExhibitionParticipation") return { formatBoatExhibitionParticipationAlertLabel: () => "", resolveBoatExhibitionParticipationSummary: () => ({ alerts: [] }) };
		if (id === "./boatVenueFeatures") return { buildBoatVenueFeatureFullMaterial: () => "", buildBoatVenueUserInsightMaterial: () => "" };
		throw new Error(`Unexpected material dependency: ${id}`);
	},
);

const {
	getBoatPredictionExhibitionAvailability,
	getBoatPredictionExhibitionCardLabel,
	isBoatPredictionExhibitionTime,
} = materialModule.exports;
const today = readJson("public/data/boatrace/today-race-details.generated.json");
const errors = [];
const summary = { complete: 0, partial: 0, missing: 0, validTimeRaceCount: 0 };

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
		summary[availability.status] += 1;
		if (validFrames.size > 0) summary.validTimeRaceCount += 1;

		if (validFrames.size === 6) {
			if (availability.status !== "complete" || label !== "展示タイムOK") {
				errors.push({ category: "complete-time-label", key, validTimeFrames: validFrames.size, availability, label });
			}
			if (!isOfficialSource(race)) {
				errors.push({ category: "complete-time-source", key, reason: "All six times exist but an official source is not recorded." });
			}
		} else if (validFrames.size > 0) {
			if (availability.status !== "partial" || label === "展示タイムOK") {
				errors.push({ category: "partial-time-label", key, validTimeFrames: validFrames.size, availability, label });
			}
		} else if (label === "展示タイムOK" || availability.status === "complete") {
			errors.push({ category: "missing-time-label", key, validTimeFrames: validFrames.size, availability, label });
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
const partialFixture = { exhibitions: [{ frameNo: 1, exhibitionTime: "6.72" }, { frameNo: 2, exhibitionTime: "6.81" }] };
const completeFixture = {
	exhibitionCoverage: { source: "official:owpc-html+beforeinfo" },
	exhibitions: Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, exhibitionTime: `6.${70 + index}`, source: "boatrace.jp" })),
};
for (const [name, race, expectedStatus, expectedLabel] of [
	["placeholder", placeholderFixture, "missing", "展示タイム未取得"],
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

const result = { ok: errors.length === 0, date: today.date ?? null, venueCount: (today.venues ?? []).length, raceCount: (today.venues ?? []).reduce((count, venue) => count + (venue.races?.length ?? 0), 0), summary, errors };
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 1;
