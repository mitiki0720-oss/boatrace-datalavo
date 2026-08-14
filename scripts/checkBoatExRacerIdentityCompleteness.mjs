import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const registration = (value) => /^\d{4,6}$/.test(String(value ?? "").trim());

const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const features = read("public/data/boatrace-ex/derived/racer-features/latest.json");
const audit = read("public/data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json");
const current = read("public/data/boatrace/today-race-details.generated.json");
const registryNumbers = new Set((registry.identities ?? []).map((item) => String(item.registrationNo)));
const currentSlots = (current.venues ?? []).flatMap((venue) => (venue.races ?? []).flatMap((race) => race.racers ?? []));
const currentNumbers = currentSlots.map((racer) => String(racer.registrationNo ?? "").trim()).filter(registration);
const exactLinked = currentNumbers.filter((number) => registryNumbers.has(number)).length;
const invalidFeatures = (features.racers ?? []).filter((feature) => !registration(feature.registrationNo) || !registryNumbers.has(feature.registrationNo));
const missingFeatureIdentity = (features.racers ?? []).filter((feature) => !feature.name || feature.historyStarts <= 0);
const forbiddenKeys = JSON.stringify(features).match(/(?:fake|guessed|inferred|score|rank|prediction)/gi) ?? [];

const checks = {
	registryHasIdentities: registryNumbers.size > 0,
	featureCountMatchesRegistry: features.summary?.racerCount === registry.summary?.identityCount && features.racers?.length === registryNumbers.size,
	featuresUseExactRegistryOnly: invalidFeatures.length === 0 && missingFeatureIdentity.length === 0,
	currentAuditMatchesFeed: audit.currentDay?.date === current.date
		&& audit.currentDay?.slotCount === currentSlots.length
		&& audit.currentDay?.registrationPresentCount === currentNumbers.length
		&& audit.currentDay?.exactRegistryLinkedCount === exactLinked,
	unresolvedExcluded: audit.unresolved?.appearanceCount > 0 && audit.unresolved?.historicalSourceNameOnly >= 0,
	noForbiddenOutput: forbiddenKeys.length === 0,
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
	ok,
	checks,
	registryIdentityCount: registryNumbers.size,
	featureCount: features.racers?.length ?? 0,
	currentDay: audit.currentDay,
	unresolved: audit.unresolved,
	invalidFeatureCount: invalidFeatures.length,
	missingFeatureIdentityCount: missingFeatureIdentity.length,
	forbiddenKeys,
}, null, 2));

if (!ok) process.exitCode = 1;
