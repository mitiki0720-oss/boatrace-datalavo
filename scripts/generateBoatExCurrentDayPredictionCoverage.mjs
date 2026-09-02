import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const write = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const text = (value) => String(value ?? "").trim();
const isAvailable = (value) => !new Set(["", "-", "未取得", "確認中", "null", "undefined"]).has(text(value));
const registration = (value) => /^\d{4,6}$/.test(text(value));
const raceWeather = (venue, race, key) => race.weatherActual?.[key] ?? race.weather?.[key] ?? venue.weatherActual?.[key] ?? venue.weather?.[key];
const displayTimeCount = (race) => (race.exhibitions ?? []).filter((entry) => isAvailable(entry.exhibitionTime ?? entry.displayTime)).length;
const hasCompleteResult = (race) => (race.result?.finishOrder ?? []).length >= 3;
const hasPartialResult = (race) => {
	const count = (race.result?.finishOrder ?? []).length;
	return count > 0 && count < 3;
};
const hasRawPayout = (race) => isAvailable(race.result?.payout3tan?.payout ?? race.payout?.trifecta?.payout);

const current = read("public/data/boatrace/today-race-details.generated.json");
const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const latestRaceAnalysis = read("public/data/boatrace-ex/derived/race-analysis/latest.json");
const knownRegistrationNos = new Set((registry.identities ?? []).map((identity) => text(identity.registrationNo)));
const sourceKinds = new Set([text(current.source)]);
const raceAnalysisByKey = new Map();
if (latestRaceAnalysis.targetDate === current.date) {
	for (const race of latestRaceAnalysis.races ?? []) {
		const key = `${text(race.venueCode)}:${Number(race.raceNo)}`;
		const existing = raceAnalysisByKey.get(key);
		if (!existing || existing.status !== "ready") raceAnalysisByKey.set(key, race);
	}
}
const lifecycleForRace = (venue, race) => {
	const timeCount = displayTimeCount(race);
	const hasResult = hasCompleteResult(race);
	const rawPayout = hasRawPayout(race);
	const hasPayout = hasResult && rawPayout;
	const analysis = raceAnalysisByKey.get(`${text(venue.venueCode)}:${Number(race.raceNo)}`);
	const analysisReady = analysis?.status ? analysis.status === "ready" : analysis?.resultStatus === "available" && analysis?.payoutStatus === "available";
	const hasRaceAnalysis = Boolean(analysis && analysisReady && analysis.resultStatus === "available" && analysis.payoutStatus === "available" && hasResult && hasPayout);
	const warnings = [];
	if (rawPayout && !hasResult) warnings.push("raw-payout-without-complete-result-suppressed");
	if (analysis && hasResult && hasPayout && !hasRaceAnalysis) warnings.push("race-analysis-not-ready-for-current-result-state");
	const status = hasPartialResult(race)
		? "partial-result"
		: hasRaceAnalysis
			? "race-analysis-ready"
			: hasResult && hasPayout
				? "result-and-payout"
				: hasResult
					? "result-only"
					: timeCount === 6
						? "exhibition-ready"
						: timeCount > 0
							? "exhibition-partial"
							: "pre-race";
	return {
		venueCode: text(venue.venueCode),
		venueName: text(venue.venueName),
		raceNo: Number(race.raceNo),
		status,
		displayTimeCount: timeCount,
		hasResult,
		hasPayout,
		hasRaceAnalysis,
		sourceName: text(race.exhibitionCoverage?.source ?? race.result?.weatherActual?.source ?? venue.source ?? current.source),
		sourceAcquiredAt: text(race.exhibitionCoverage?.updatedAt ?? race.result?.finalizedAt ?? venue.generatedAt ?? current.generatedAt),
		warnings,
	};
};
const summarizeVenue = (venue) => {
	const races = venue.races ?? [];
	const lifecycle = races.map((race) => lifecycleForRace(venue, race));
	const slots = races.flatMap((race) => race.racers ?? []);
	const count = (predicate) => races.filter(predicate).length;
	const registrations = slots.filter((racer) => registration(racer.registrationNo));
	sourceKinds.add(text(venue.source));
	sourceKinds.add(text(venue.weatherActual?.source));
	for (const race of races) sourceKinds.add(text(race.exhibitionCoverage?.source));
	return {
		venueCode: text(venue.venueCode),
		venueName: text(venue.venueName),
		raceCount: races.length,
		slotCount: slots.length,
		entriesCompleteRaceCount: count((race) => (race.racers ?? []).length === 6),
		registrationPresentCount: registrations.length,
		registrationMissingCount: slots.length - registrations.length,
		exactRegistryLinkedCount: registrations.filter((racer) => knownRegistrationNos.has(text(racer.registrationNo))).length,
		weatherAvailableRaceCount: count((race) => isAvailable(raceWeather(venue, race, "weather"))),
		windAvailableRaceCount: count((race) => isAvailable(raceWeather(venue, race, "windSpeed"))),
		waveAvailableRaceCount: count((race) => isAvailable(raceWeather(venue, race, "waveHeight"))),
		exhibitionDisplayTimeCompleteRaceCount: count((race) => displayTimeCount(race) === 6),
		exhibitionDisplayTimePartialRaceCount: count((race) => {
			const count = displayTimeCount(race);
			return count > 0 && count < 6;
		}),
		exhibitionDisplayTimeMissingRaceCount: count((race) => displayTimeCount(race) === 0),
		motorAvailableSlotCount: slots.filter((racer) => isAvailable(racer.motorNo ?? racer.motorNumber)).length,
		boatAvailableSlotCount: slots.filter((racer) => isAvailable(racer.boatNo ?? racer.boatMotorNo)).length,
		resultAvailableRaceCount: lifecycle.filter((race) => race.hasResult).length,
		payoutAvailableRaceCount: lifecycle.filter((race) => race.hasPayout).length,
		raceAnalysisAvailableRaceCount: lifecycle.filter((race) => race.hasRaceAnalysis).length,
		preRaceCount: lifecycle.filter((race) => race.status === "pre-race").length,
		exhibitionReadyCount: lifecycle.filter((race) => race.status === "exhibition-ready").length,
		exhibitionPartialCount: lifecycle.filter((race) => race.status === "exhibition-partial").length,
		partialResultCount: lifecycle.filter((race) => race.status === "partial-result").length,
		resultOnlyCount: lifecycle.filter((race) => race.status === "result-only").length,
		resultAndPayoutCount: lifecycle.filter((race) => race.status === "result-and-payout").length,
		inconsistentStatusCount: lifecycle.filter((race) => (race.hasPayout && !race.hasResult) || (race.hasRaceAnalysis && (!race.hasResult || !race.hasPayout))).length,
		rawPayoutWithoutCompleteResultCount: lifecycle.filter((race) => race.warnings.includes("raw-payout-without-complete-result-suppressed")).length,
		lifecycle,
	};
};
const venues = (current.venues ?? []).map(summarizeVenue);
const sum = (key) => venues.reduce((total, venue) => total + Number(venue[key] ?? 0), 0);
const raceCount = sum("raceCount");
const resultAvailableRaceCount = sum("resultAvailableRaceCount");
const payoutAvailableRaceCount = sum("payoutAvailableRaceCount");
const races = venues.flatMap((venue) => venue.lifecycle);
const resultStatus = resultAvailableRaceCount === 0
	? "pre-race"
	: resultAvailableRaceCount === raceCount && payoutAvailableRaceCount === raceCount
		? "completed"
		: "partial-result";
const generatedAt = new Date().toISOString();
const sourcePath = "public/data/boatrace/today-race-details.generated.json";
const coverage = {
	schemaVersion: 1,
	kind: "boatrace-ex-current-day-prediction-coverage",
	targetDate: current.date,
	generatedAt,
	sourcePath,
	identityPolicy: "registrationNo exact registry lookup only; no name-only linkage",
	venueCount: venues.length,
	raceCount,
	slotCount: sum("slotCount"),
	entriesCompleteRaceCount: sum("entriesCompleteRaceCount"),
	registrationPresentCount: sum("registrationPresentCount"),
	registrationMissingCount: sum("registrationMissingCount"),
	exactRegistryLinkedCount: sum("exactRegistryLinkedCount"),
	weatherAvailableRaceCount: sum("weatherAvailableRaceCount"),
	windAvailableRaceCount: sum("windAvailableRaceCount"),
	waveAvailableRaceCount: sum("waveAvailableRaceCount"),
	exhibitionDisplayTimeCompleteRaceCount: sum("exhibitionDisplayTimeCompleteRaceCount"),
	exhibitionDisplayTimePartialRaceCount: sum("exhibitionDisplayTimePartialRaceCount"),
	exhibitionDisplayTimeMissingRaceCount: sum("exhibitionDisplayTimeMissingRaceCount"),
	motorAvailableSlotCount: sum("motorAvailableSlotCount"),
	boatAvailableSlotCount: sum("boatAvailableSlotCount"),
	resultAvailableRaceCount,
	payoutAvailableRaceCount,
	raceAnalysisAvailableRaceCount: sum("raceAnalysisAvailableRaceCount"),
	raceAnalysisMissingRaceCount: raceCount - sum("raceAnalysisAvailableRaceCount"),
	preRaceCount: sum("preRaceCount"),
	exhibitionReadyCount: sum("exhibitionReadyCount"),
	exhibitionPartialCount: sum("exhibitionPartialCount"),
	partialResultCount: sum("partialResultCount"),
	resultOnlyCount: sum("resultOnlyCount"),
	resultAndPayoutCount: sum("resultAndPayoutCount"),
	inconsistentStatusCount: sum("inconsistentStatusCount"),
	rawPayoutWithoutCompleteResultCount: sum("rawPayoutWithoutCompleteResultCount"),
	resultStatus,
	sourceKinds: [...sourceKinds].filter(Boolean).sort(),
	venues,
	races,
};
const summary = {
	schemaVersion: 1,
	kind: "boatrace-ex-current-day-prediction-coverage-history-summary",
	generatedAt,
	currentCoveragePath: "public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json",
	targetDate: coverage.targetDate,
	venueCount: coverage.venueCount,
	raceCount: coverage.raceCount,
	slotCount: coverage.slotCount,
	exactRegistryLinkedCount: coverage.exactRegistryLinkedCount,
	exhibitionDisplayTimeCompleteRaceCount: coverage.exhibitionDisplayTimeCompleteRaceCount,
	exhibitionDisplayTimePartialRaceCount: coverage.exhibitionDisplayTimePartialRaceCount,
	exhibitionDisplayTimeMissingRaceCount: coverage.exhibitionDisplayTimeMissingRaceCount,
	weatherAvailableRaceCount: coverage.weatherAvailableRaceCount,
	windAvailableRaceCount: coverage.windAvailableRaceCount,
	waveAvailableRaceCount: coverage.waveAvailableRaceCount,
	resultAvailableRaceCount: coverage.resultAvailableRaceCount,
	payoutAvailableRaceCount: coverage.payoutAvailableRaceCount,
	lifecycle: {
		preRaceCount: coverage.preRaceCount,
		exhibitionReadyCount: coverage.exhibitionReadyCount,
		exhibitionPartialCount: coverage.exhibitionPartialCount,
		partialResultCount: coverage.partialResultCount,
		resultOnlyCount: coverage.resultOnlyCount,
		resultAndPayoutCount: coverage.resultAndPayoutCount,
		raceAnalysisAvailableRaceCount: coverage.raceAnalysisAvailableRaceCount,
		raceAnalysisMissingRaceCount: coverage.raceAnalysisMissingRaceCount,
		inconsistentStatusCount: coverage.inconsistentStatusCount,
	},
	rawPayoutWithoutCompleteResultCount: coverage.rawPayoutWithoutCompleteResultCount,
	resultStatus: coverage.resultStatus,
	sourcePath,
};
write("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json", coverage);
write("public/data/boatrace-ex/derived/current-day-prediction-coverage/history-summary.json", summary);
console.log(JSON.stringify({
	ok: true,
	targetDate: coverage.targetDate,
	raceCount: coverage.raceCount,
	exactRegistryLinkedCount: coverage.exactRegistryLinkedCount,
	lifecycle: summary.lifecycle,
	rawPayoutWithoutCompleteResultCount: coverage.rawPayoutWithoutCompleteResultCount,
}, null, 2));
