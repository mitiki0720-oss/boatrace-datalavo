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
const resultAvailableRaceCount = races.filter((race) => (race.result?.finishOrder ?? []).length > 0).length;
const expectedResultStatus = resultAvailableRaceCount === 0 ? "pre-race" : resultAvailableRaceCount === races.length && coverage.payoutAvailableRaceCount === races.length ? "completed" : "partial-result";
const forbidden = JSON.stringify(coverage).match(/(?:fake|score|rank|generatedPrediction|generatedTicket)/gi) ?? [];
const checks = {
	kind: coverage.kind === "boatrace-ex-current-day-prediction-coverage" && summary.kind === "boatrace-ex-current-day-prediction-coverage-history-summary",
	targetDate: coverage.targetDate === current.date && summary.targetDate === current.date,
	counts: coverage.venueCount === (current.venues ?? []).length && coverage.raceCount === races.length && coverage.slotCount === slots.length,
	entries: coverage.entriesCompleteRaceCount === races.filter((race) => (race.racers ?? []).length === 6).length,
	registrations: coverage.registrationPresentCount === registrationPresentCount && coverage.registrationMissingCount === slots.length - registrationPresentCount && coverage.exactRegistryLinkedCount === exactRegistryLinkedCount,
	resultStatus: coverage.resultAvailableRaceCount === resultAvailableRaceCount && coverage.resultStatus === expectedResultStatus,
	venueBreakdown: Array.isArray(coverage.venues) && coverage.venues.length === coverage.venueCount,
	noForbiddenOutput: forbidden.length === 0,
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, targetDate: coverage.targetDate, summary: { venueCount: coverage.venueCount, raceCount: coverage.raceCount, slotCount: coverage.slotCount, registrationPresentCount: coverage.registrationPresentCount, exactRegistryLinkedCount: coverage.exactRegistryLinkedCount, weatherAvailableRaceCount: coverage.weatherAvailableRaceCount, windAvailableRaceCount: coverage.windAvailableRaceCount, waveAvailableRaceCount: coverage.waveAvailableRaceCount, exhibitionDisplayTimeCompleteRaceCount: coverage.exhibitionDisplayTimeCompleteRaceCount, exhibitionDisplayTimePartialRaceCount: coverage.exhibitionDisplayTimePartialRaceCount, exhibitionDisplayTimeMissingRaceCount: coverage.exhibitionDisplayTimeMissingRaceCount, resultStatus: coverage.resultStatus }, forbidden }, null, 2));
if (!ok) process.exitCode = 1;
