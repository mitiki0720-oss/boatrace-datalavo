import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const current = read("public/data/boatrace/today-race-details.generated.json");
const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const coverage = read("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json");
const summary = read("public/data/boatrace-ex/derived/current-day-prediction-coverage/history-summary.json");
const registration = (value) => /^\d{4,6}$/.test(String(value ?? "").trim());
const races = (current.venues ?? []).flatMap((venue) => venue.races ?? []);
const slots = races.flatMap((race) => race.racers ?? []);
const known = new Set((registry.identities ?? []).map((identity) => String(identity.registrationNo)));
const registrationPresentCount = slots.filter((racer) => registration(racer.registrationNo)).length;
const exactRegistryLinkedCount = slots.filter((racer) => known.has(String(racer.registrationNo))).length;
const resultAvailableRaceCount = races.filter((race) => (race.result?.finishOrder ?? []).length >= 3).length;
const payoutAvailableRaceCount = races.filter((race) => (race.result?.finishOrder ?? []).length >= 3 && Boolean(race.result?.payout3tan?.payout ?? race.payout?.trifecta?.payout)).length;
const expectedResultStatus = resultAvailableRaceCount === 0 ? "pre-race" : resultAvailableRaceCount === races.length && payoutAvailableRaceCount === races.length ? "completed" : "partial-result";
const lifecycleCount = Object.values(coverage.races ?? []).length;
const lifecycleStatuses = new Set(["pre-race", "exhibition-ready", "exhibition-partial", "partial-result", "result-only", "result-and-payout", "race-analysis-ready"]);
const lifecycleTotal = ["preRaceCount", "exhibitionReadyCount", "exhibitionPartialCount", "partialResultCount", "resultOnlyCount", "resultAndPayoutCount", "raceAnalysisAvailableRaceCount"].reduce((total, key) => total + Number(coverage[key] ?? 0), 0);
const lifecycleErrors = (coverage.races ?? []).flatMap((race) => {
	const errors = [];
	if (!lifecycleStatuses.has(race.status)) errors.push("unknown-status");
	if (race.hasPayout && !race.hasResult) errors.push("payout-without-result");
	if (race.hasRaceAnalysis && (!race.hasResult || !race.hasPayout)) errors.push("analysis-without-result-and-payout");
	if (race.displayTimeCount === 0 && ["exhibition-ready", "exhibition-partial"].includes(race.status)) errors.push("exhibition-status-without-display-time");
	if (race.displayTimeCount > 0 && race.displayTimeCount < 6 && race.status === "exhibition-ready") errors.push("complete-exhibition-with-partial-display-time");
	if (race.displayTimeCount === 6 && race.status === "exhibition-partial") errors.push("partial-exhibition-with-complete-display-time");
	return errors;
});
const forbidden = JSON.stringify(coverage).match(/(?:fake|score|rank|generatedPrediction|generatedTicket)/gi) ?? [];
const checks = {
	kind: coverage.kind === "boatrace-ex-current-day-prediction-coverage" && summary.kind === "boatrace-ex-current-day-prediction-coverage-history-summary",
	targetDate: coverage.targetDate === current.date && summary.targetDate === current.date,
	summary: summary.exactRegistryLinkedCount === coverage.exactRegistryLinkedCount && summary.resultAvailableRaceCount === coverage.resultAvailableRaceCount && summary.payoutAvailableRaceCount === coverage.payoutAvailableRaceCount && summary.lifecycle?.inconsistentStatusCount === coverage.inconsistentStatusCount,
	counts: coverage.venueCount === (current.venues ?? []).length && coverage.raceCount === races.length && coverage.slotCount === slots.length,
	entries: coverage.entriesCompleteRaceCount === races.filter((race) => (race.racers ?? []).length === 6).length,
	registrations: coverage.registrationPresentCount === registrationPresentCount && coverage.registrationMissingCount === slots.length - registrationPresentCount && coverage.exactRegistryLinkedCount === exactRegistryLinkedCount,
	resultStatus: coverage.resultAvailableRaceCount === resultAvailableRaceCount && coverage.payoutAvailableRaceCount === payoutAvailableRaceCount && coverage.resultStatus === expectedResultStatus,
	lifecycle: lifecycleCount === races.length && lifecycleTotal === races.length && coverage.raceAnalysisMissingRaceCount === races.length - coverage.raceAnalysisAvailableRaceCount && coverage.inconsistentStatusCount === 0 && lifecycleErrors.length === 0,
	venueBreakdown: Array.isArray(coverage.venues) && coverage.venues.length === coverage.venueCount,
	noForbiddenOutput: forbidden.length === 0,
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, targetDate: coverage.targetDate, summary: { venueCount: coverage.venueCount, raceCount: coverage.raceCount, slotCount: coverage.slotCount, registrationPresentCount: coverage.registrationPresentCount, exactRegistryLinkedCount: coverage.exactRegistryLinkedCount, weatherAvailableRaceCount: coverage.weatherAvailableRaceCount, windAvailableRaceCount: coverage.windAvailableRaceCount, waveAvailableRaceCount: coverage.waveAvailableRaceCount, exhibitionDisplayTimeCompleteRaceCount: coverage.exhibitionDisplayTimeCompleteRaceCount, exhibitionDisplayTimePartialRaceCount: coverage.exhibitionDisplayTimePartialRaceCount, exhibitionDisplayTimeMissingRaceCount: coverage.exhibitionDisplayTimeMissingRaceCount, resultAvailableRaceCount: coverage.resultAvailableRaceCount, payoutAvailableRaceCount: coverage.payoutAvailableRaceCount, raceAnalysisAvailableRaceCount: coverage.raceAnalysisAvailableRaceCount, preRaceCount: coverage.preRaceCount, exhibitionReadyCount: coverage.exhibitionReadyCount, exhibitionPartialCount: coverage.exhibitionPartialCount, partialResultCount: coverage.partialResultCount, resultOnlyCount: coverage.resultOnlyCount, resultAndPayoutCount: coverage.resultAndPayoutCount, inconsistentStatusCount: coverage.inconsistentStatusCount, rawPayoutWithoutCompleteResultCount: coverage.rawPayoutWithoutCompleteResultCount, resultStatus: coverage.resultStatus }, lifecycleErrors, forbidden }, null, 2));
if (!ok) process.exitCode = 1;
