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
const resultAvailable = (race) => (race.result?.finishOrder ?? []).length > 0;
const payoutAvailable = (race) => isAvailable(race.result?.payout3tan ?? race.payout?.trifecta);

const current = read("public/data/boatrace/today-race-details.generated.json");
const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const knownRegistrationNos = new Set((registry.identities ?? []).map((identity) => text(identity.registrationNo)));
const sourceKinds = new Set([text(current.source)]);
const summarizeVenue = (venue) => {
	const races = venue.races ?? [];
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
		resultAvailableRaceCount: count(resultAvailable),
		payoutAvailableRaceCount: count(payoutAvailable),
	};
};
const venues = (current.venues ?? []).map(summarizeVenue);
const sum = (key) => venues.reduce((total, venue) => total + Number(venue[key] ?? 0), 0);
const raceCount = sum("raceCount");
const resultAvailableRaceCount = sum("resultAvailableRaceCount");
const payoutAvailableRaceCount = sum("payoutAvailableRaceCount");
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
	resultStatus,
	sourceKinds: [...sourceKinds].filter(Boolean).sort(),
	venues,
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
	resultStatus: coverage.resultStatus,
	sourcePath,
};
write("public/data/boatrace-ex/derived/current-day-prediction-coverage/latest.json", coverage);
write("public/data/boatrace-ex/derived/current-day-prediction-coverage/history-summary.json", summary);
console.log(JSON.stringify({ ok: true, ...coverage }, null, 2));
