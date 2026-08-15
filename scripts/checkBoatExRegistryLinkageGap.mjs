import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const write = (relativePath, value) => fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
const text = (value) => String(value ?? "").trim();
const registration = (value) => /^\d{4,6}$/.test(text(value)) && text(value) !== "0000" ? text(value) : null;
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");

const current = read("public/data/boatrace/today-race-details.generated.json");
const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const features = read("public/data/boatrace-ex/derived/racer-features/latest.json");
const registryByNo = new Map((registry.identities ?? []).map((identity) => [text(identity.registrationNo), identity]));
const featureByNo = new Map((features.racers ?? []).map((feature) => [text(feature.registrationNo), feature]));
const historicalRegistryNos = new Set((registry.identities ?? []).filter((identity) => !identity.currentDayProvenance).map((identity) => text(identity.registrationNo)));
const slots = (current.venues ?? []).flatMap((venue) => (venue.races ?? []).flatMap((race) => (race.racers ?? []).map((racer) => ({
	venueCode: text(venue.venueCode), venueName: text(venue.venueName), raceNo: Number(race.raceNo), frameNo: Number(racer.frameNo ?? racer.lane), racerName: text(racer.name), registrationNo: registration(racer.registrationNo), branch: text(racer.branch), age: text(racer.age), className: text(racer.className ?? racer.class), sourceName: text(venue.source ?? current.source), sourceAcquiredAt: text(venue.generatedAt ?? current.generatedAt),
}))));
const present = slots.filter((slot) => slot.registrationNo);
const beforeExact = present.filter((slot) => historicalRegistryNos.has(slot.registrationNo));
const exact = present.filter((slot) => registryByNo.has(slot.registrationNo));
const unmatched = slots.filter((slot) => !slot.registrationNo || !registryByNo.has(slot.registrationNo));
const baselineUnmatched = present.filter((slot) => !historicalRegistryNos.has(slot.registrationNo));
const byReason = {};
const reasonFor = (slot) => {
	if (!slot.registrationNo) return "currentEntryMissingRegistrationNo";
	const identity = registryByNo.get(slot.registrationNo);
	if (!identity) return "notInRegisteredIdentityRegistry";
	if (!featureByNo.has(slot.registrationNo)) return "registryIdentityExistsButFeatureMissing";
	return "unknown";
};
for (const slot of unmatched) {
	const reason = reasonFor(slot);
	byReason[reason] = (byReason[reason] ?? 0) + 1;
}
const baselineReasonCounts = { notInRegisteredIdentityRegistry: baselineUnmatched.length };
const duplicateRegistrationNumbers = (items) => [...new Map(items.map((slot) => [slot.registrationNo, 0]).filter(([number]) => number).map(([number]) => [number, items.filter((slot) => slot.registrationNo === number).length])).entries()].filter(([, count]) => count > 1).map(([registrationNo, count]) => ({ registrationNo, slotCount: count }));
const serialize = (slot, reason) => ({
	venueCode: slot.venueCode, venueName: slot.venueName, raceNo: slot.raceNo, frameNo: slot.frameNo, racerName: slot.racerName, registrationNo: slot.registrationNo, branch: slot.branch, age: slot.age, className: slot.className, sourceName: slot.sourceName, sourceAcquiredAt: slot.sourceAcquiredAt, reason,
	registryLookupResult: slot.registrationNo && registryByNo.has(slot.registrationNo) ? (registryByNo.get(slot.registrationNo).currentDayProvenance ? "current-day-official-supplement" : "historical-registry") : "not-found",
	featureLookupResult: slot.registrationNo && featureByNo.has(slot.registrationNo) ? featureByNo.get(slot.registrationNo).sampleLevel : "not-found",
});
const venueSummary = (current.venues ?? []).map((venue) => {
	const venueSlots = slots.filter((slot) => slot.venueCode === text(venue.venueCode));
	const venuePresent = venueSlots.filter((slot) => slot.registrationNo);
	return {
		venueCode: text(venue.venueCode), venueName: text(venue.venueName), slotCount: venueSlots.length,
		exactLinkedCount: venuePresent.filter((slot) => registryByNo.has(slot.registrationNo)).length,
		unmatchedSlotCount: venueSlots.filter((slot) => !slot.registrationNo || !registryByNo.has(slot.registrationNo)).length,
		unmatchedRegistrationNos: [...new Set(venuePresent.filter((slot) => !registryByNo.has(slot.registrationNo)).map((slot) => slot.registrationNo))].sort(),
	};
});
const outputPath = `public/data/boatrace-ex/audit/current-day-registry-linkage-gap-${current.date}.generated.json`;
const output = {
	schemaVersion: 1,
	kind: "boatrace-ex-current-day-registry-linkage-gap-audit",
	generatedAt: new Date().toISOString(),
	targetDate: current.date,
	policy: "registrationNo exact only; current-day supplement requires official source metadata and does not use name-only or fuzzy linkage",
	sourceFiles: ["public/data/boatrace/today-race-details.generated.json", "public/data/boatrace-ex/identity/registered-racers.generated.json", "public/data/boatrace-ex/derived/racer-features/latest.json"],
	summary: {
		targetDate: current.date, venueCount: venueSummary.length, raceCount: (current.venues ?? []).reduce((total, venue) => total + (venue.races?.length ?? 0), 0), slotCount: slots.length, registrationPresentCount: present.length,
		beforeExactRegistryLinkedCount: beforeExact.length, exactRegistryLinkedCount: exact.length, supplementedIdentityCount: (registry.identities ?? []).filter((identity) => identity.currentDayProvenance).length, supplementedSlotCount: baselineUnmatched.length,
		unmatchedSlotCount: unmatched.length, unmatchedRegistrationNumberCount: new Set(unmatched.map((slot) => slot.registrationNo).filter(Boolean)).size, duplicateUnmatchedRegistrationNumbers: duplicateRegistrationNumbers(unmatched), duplicateBaselineUnmatchedRegistrationNumbers: duplicateRegistrationNumbers(baselineUnmatched), reasonCounts: byReason, baselineReasonCounts,
	},
	baselineUnmatchedExamples: baselineUnmatched.slice(0, 50).map((slot) => serialize(slot, "notInRegisteredIdentityRegistry")),
	unmatchedExamples: unmatched.slice(0, 50).map((slot) => serialize(slot, reasonFor(slot))),
	venueSummary,
};
if (shouldWrite) write(outputPath, output);
const audited = shouldWrite ? output : read(outputPath);
const checks = {
	targetDate: audited.targetDate === current.date,
	registrationCoverage: audited.summary.registrationPresentCount === audited.summary.slotCount,
	exactAccounting: audited.summary.exactRegistryLinkedCount + audited.summary.unmatchedSlotCount === audited.summary.slotCount,
	baselineAccounting: audited.summary.beforeExactRegistryLinkedCount + audited.summary.supplementedSlotCount === audited.summary.slotCount,
	noUnknownReasons: (audited.summary.reasonCounts?.unknown ?? 0) === 0,
	noCurrentDayConflicts: registry.summary?.currentDayConflictCount === 0,
	noNameOnlyPolicy: audited.policy.includes("registrationNo exact only") && audited.policy.includes("does not use name-only or fuzzy linkage"),
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, outputPath, checks, summary: audited.summary, wrote: shouldWrite }, null, 2));
if (!ok) process.exitCode = 1;
