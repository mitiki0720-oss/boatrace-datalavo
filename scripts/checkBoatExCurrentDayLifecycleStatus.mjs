import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const coverage = read("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json");
const statuses = ["pre-race", "exhibition-ready", "exhibition-partial", "partial-result", "result-only", "result-and-payout", "race-analysis-ready"];
const countKeys = {
	"pre-race": "preRaceCount",
	"exhibition-ready": "exhibitionReadyCount",
	"exhibition-partial": "exhibitionPartialCount",
	"partial-result": "partialResultCount",
	"result-only": "resultOnlyCount",
	"result-and-payout": "resultAndPayoutCount",
	"race-analysis-ready": "raceAnalysisAvailableRaceCount",
};

function classify({ displayTimeCount, hasResult, hasPayout, hasRaceAnalysis, partialResult = false }) {
	if (hasPayout && !hasResult) return "invalid";
	if (hasRaceAnalysis && (!hasResult || !hasPayout)) return "invalid";
	if (partialResult) return "partial-result";
	if (hasRaceAnalysis) return "race-analysis-ready";
	if (hasResult && hasPayout) return "result-and-payout";
	if (hasResult) return "result-only";
	if (displayTimeCount === 6) return "exhibition-ready";
	if (displayTimeCount > 0 && displayTimeCount < 6) return "exhibition-partial";
	return "pre-race";
}

const fixtureCases = [
	["pre-race", { displayTimeCount: 0, hasResult: false, hasPayout: false, hasRaceAnalysis: false }, "pre-race"],
	["exhibition-partial", { displayTimeCount: 2, hasResult: false, hasPayout: false, hasRaceAnalysis: false }, "exhibition-partial"],
	["exhibition-ready", { displayTimeCount: 6, hasResult: false, hasPayout: false, hasRaceAnalysis: false }, "exhibition-ready"],
	["partial-result", { displayTimeCount: 0, hasResult: false, hasPayout: false, hasRaceAnalysis: false, partialResult: true }, "partial-result"],
	["result-only", { displayTimeCount: 6, hasResult: true, hasPayout: false, hasRaceAnalysis: false }, "result-only"],
	["result-and-payout", { displayTimeCount: 6, hasResult: true, hasPayout: true, hasRaceAnalysis: false }, "result-and-payout"],
	["race-analysis-ready", { displayTimeCount: 6, hasResult: true, hasPayout: true, hasRaceAnalysis: true }, "race-analysis-ready"],
	["payout-without-result", { displayTimeCount: 0, hasResult: false, hasPayout: true, hasRaceAnalysis: false }, "invalid"],
	["analysis-without-result", { displayTimeCount: 0, hasResult: false, hasPayout: false, hasRaceAnalysis: true }, "invalid"],
];
const fixtureErrors = fixtureCases.filter(([, input, expected]) => classify(input) !== expected).map(([name]) => name);
const races = Array.isArray(coverage.races) ? coverage.races : [];
const lifecycleErrors = [];
for (const race of races) {
	if (!statuses.includes(race.status)) lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: unknown status`);
	if (!Number.isInteger(race.raceNo) || race.raceNo < 1 || race.raceNo > 12) lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: invalid race number`);
	if (!Number.isInteger(race.displayTimeCount) || race.displayTimeCount < 0 || race.displayTimeCount > 6) lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: invalid display count`);
	if (race.hasPayout && !race.hasResult) lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: payout without result`);
	if (race.hasRaceAnalysis && (!race.hasResult || !race.hasPayout)) lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: analysis without result and payout`);
	if (race.displayTimeCount === 0 && ["exhibition-ready", "exhibition-partial"].includes(race.status)) lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: exhibition status without display time`);
	if (race.displayTimeCount > 0 && race.displayTimeCount < 6 && race.status === "exhibition-ready") lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: complete exhibition with partial display time`);
	if (race.displayTimeCount === 6 && race.status === "exhibition-partial") lifecycleErrors.push(`${race.venueCode}:${race.raceNo}: partial exhibition with complete display time`);
}
const statusCounts = Object.fromEntries(statuses.map((status) => [status, races.filter((race) => race.status === status).length]));
const summaryMatches = statuses.every((status) => Number(coverage[countKeys[status]] ?? 0) === statusCounts[status]);
const checks = {
	coverageShape: Boolean(coverage.kind === "boatrace-ex-current-day-prediction-coverage" && coverage.targetDate && coverage.generatedAt && coverage.sourcePath),
	lifecycleCount: races.length === coverage.raceCount && Object.values(statusCounts).reduce((total, count) => total + count, 0) === coverage.raceCount,
	summaryMatches,
	inconsistentStatus: coverage.inconsistentStatusCount === 0 && lifecycleErrors.length === 0,
	raceAnalysis: coverage.raceAnalysisMissingRaceCount === coverage.raceCount - coverage.raceAnalysisAvailableRaceCount,
	exactRegistry: coverage.exactRegistryLinkedCount === coverage.slotCount,
	fixtures: fixtureErrors.length === 0,
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, targetDate: coverage.targetDate, summary: { raceCount: coverage.raceCount, slotCount: coverage.slotCount, exactRegistryLinkedCount: coverage.exactRegistryLinkedCount, ...statusCounts, inconsistentStatusCount: coverage.inconsistentStatusCount, rawPayoutWithoutCompleteResultCount: coverage.rawPayoutWithoutCompleteResultCount }, lifecycleErrors, fixtureErrors }, null, 2));
if (!ok) process.exitCode = 1;
