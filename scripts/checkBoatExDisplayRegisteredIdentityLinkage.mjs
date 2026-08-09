import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const fail = (message) => {
	throw new Error(message);
};

const registryPath = "public/data/boatrace-ex/identity/registered-racers.generated.json";
const registry = readJson(registryPath);
const auditDate = registry.summary?.lastSeenDate;
if (!auditDate) fail("registry summary.lastSeenDate is required");

const quality = readJson(`public/data/boatrace-ex/audit/registered-registration-quality-${auditDate}.generated.json`);
const linkage = readJson(`public/data/boatrace-ex/audit/racer-evidence-registry-linkage-${auditDate}.generated.json`);
const provenance = readJson(`public/data/boatrace-ex/audit/registration-provenance-${auditDate}.generated.json`);
const nameBridge = readJson(`public/data/boatrace-ex/audit/name-identity-bridge-${auditDate}.generated.json`);

if (!Number.isInteger(registry.summary.identityCount) || registry.summary.identityCount <= 0) {
	fail("registry identityCount must be a positive integer");
}
if (quality.summary.safeRegisteredIdentityCount !== registry.summary.identityCount) {
	fail("quality audit safeRegisteredIdentityCount must match registry identityCount");
}
if (quality.summary.registeredAppearanceCount !== registry.summary.sourceAppearanceCount) {
	fail("quality audit registeredAppearanceCount must match registry sourceAppearanceCount");
}
if (linkage.registryIdentityCount !== registry.summary.identityCount) {
	fail("linkage audit registryIdentityCount must match registry identityCount");
}
if (linkage.counts.unlinkedRegistered !== 0 || linkage.counts.registryMissing !== 0 || linkage.counts.collision !== 0) {
	fail("safe registry linkage must not contain unlinked, missing, or collision records");
}
if (provenance.after.provenanceCompleteCount !== quality.summary.provenanceCompleteCount) {
	fail("provenance complete count must match the registration quality audit");
}
if (provenance.after.provenanceMissingCount !== quality.summary.provenanceMissingCount) {
	fail("provenance missing count must match the registration quality audit");
}

const evidenceDirectory = path.join(root, "public/data/boatrace-ex/derived/racer-evidence");
const evidenceFiles = fs.readdirSync(evidenceDirectory).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/u.test(file));
let matchedRacerCount = 0;
for (const file of evidenceFiles) {
	const evidence = JSON.parse(fs.readFileSync(path.join(evidenceDirectory, file), "utf8"));
	for (const racer of evidence.racers ?? []) {
		if (!racer.identityRegistryMatched) continue;
		matchedRacerCount += 1;
		const requiredFields = [
			"identityRegistryKey",
			"identityRegistrySource",
			"canonicalRacerName",
			"registryAppearanceCount",
			"registryFirstSeenDate",
			"registryLastSeenDate",
			"registryVenueCount",
			"registryProvenanceCount",
		];
		if (!racer.resolvedRegistrationNo) requiredFields.push("registrationNumber");
		for (const field of requiredFields) {
			if (racer[field] === null || racer[field] === undefined || racer[field] === "") {
				fail(`${file}: matched racer is missing ${field}`);
			}
		}
		const expectedKey = racer.registrationNumber ?? racer.resolvedRegistrationNo;
		if (racer.identityRegistryKey !== expectedKey) {
			fail(`${file}: registry linkage must use the exact registration number key`);
		}
		if (racer.resolvedRegistrationNo) {
			if (racer.registrationNumber !== null) fail(`${file}: name-linked racer must not overwrite official registrationNumber`);
			if (racer.identityLinkMethod !== "exact-normalized-name-unique") fail(`${file}: name-linked racer method mismatch`);
			if (racer.registrationNoSourceStatus !== "name-linked-from-registry") fail(`${file}: name-linked racer source status mismatch`);
		}
	}
}
if (matchedRacerCount !== linkage.counts.linked + (linkage.counts.nameLinked ?? 0)) {
	fail("matched racer evidence count must match linkage audit linked count");
}
if (nameBridge.counts.exactUniqueNameLinked !== (linkage.counts.nameLinked ?? 0)) {
	fail("name bridge count must match racer evidence linkage audit");
}

const pageSource = fs.readFileSync(path.join(root, "src/pages/BoatExPage.tsx"), "utf8");
for (const requiredText of [
	"RegisteredIdentityRegistrySection",
	"RegistryLinkageDetails",
	"registered-racers.generated.json",
	"racer-evidence-registry-linkage-",
	"registered-registration-quality-",
	"registration-provenance-",
	"name-identity-bridge-",
	"exact-normalized-name-unique",
	"resolvedRegistrationNo",
	"名前だけでは紐づけません",
]) {
	if (!pageSource.includes(requiredText)) fail(`BoatExPage.tsx is missing ${requiredText}`);
}

console.log(JSON.stringify({
	ok: true,
	auditDate,
	identityCount: registry.summary.identityCount,
	registeredAppearanceCount: quality.summary.registeredAppearanceCount,
	linkedRacerEvidenceCount: linkage.counts.linked,
	nameLinkedRacerEvidenceCount: linkage.counts.nameLinked,
	unresolvedExcludedCount: linkage.counts.unresolvedExcluded,
	provenance: provenance.after,
	checkedEvidenceFiles: evidenceFiles.length,
}, null, 2));
