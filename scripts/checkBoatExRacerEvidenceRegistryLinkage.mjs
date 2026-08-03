import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const auditDate = index.latestDate;
const registry = readJson("public/data/boatrace-ex/identity/registered-racers.generated.json");
const auditPath = `public/data/boatrace-ex/audit/racer-evidence-registry-linkage-${auditDate}.generated.json`;
const markdownPath = `docs/boat-ex/racer-evidence-registry-linkage-${auditDate}.md`;
const audit = readJson(auditPath);
const registryByNo = new Map((registry.identities ?? []).map((identity) => [String(identity.registrationNo), identity]));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const valid = (value) => /^\d{4,6}$/.test(String(value ?? "")) && value !== "0000";
const counts = { linked: 0, unlinkedRegistered: 0, unresolvedExcluded: 0, registryMissing: 0, collision: 0 };
for (const date of audit.coverage?.dates ?? []) {
	const evidence = readJson(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`);
	for (const racer of evidence.racers ?? []) {
		if (!valid(racer.registrationNumber)) { counts.unresolvedExcluded += 1; continue; }
		const identity = registryByNo.get(String(racer.registrationNumber));
		if (!identity) { counts.registryMissing += 1; continue; }
		if (racer.identityRegistryMatched !== true || racer.identityRegistryKey !== identity.registrationNo) { counts.unlinkedRegistered += 1; continue; }
		assert(racer.identityRegistrySource === "registered-racers.generated.json", `registry source missing for ${date}/${racer.registrationNumber}`);
		assert(racer.canonicalRacerName === identity.canonicalRacerName && racer.normalizedRacerName === identity.normalizedRacerName, `registry identity mismatch for ${date}/${racer.registrationNumber}`);
		counts.linked += 1;
	}
}
assert(audit.kind === "boatrace-ex-racer-evidence-registry-linkage-audit", "audit kind mismatch");
assert(audit.registryIdentityCount === registry.identities.length, "registry identity count mismatch");
assert(audit.coverage?.historyModified === false, "linkage must not modify history");
for (const key of Object.keys(counts)) assert(audit.counts?.[key] === counts[key], `audit ${key} count mismatch`);
assert(fs.existsSync(path.join(root, markdownPath)), "linkage markdown must exist");
if (errors.length > 0) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ ok: true, auditPath, markdownPath, registryIdentityCount: registry.identities.length, ...counts }, null, 2));
