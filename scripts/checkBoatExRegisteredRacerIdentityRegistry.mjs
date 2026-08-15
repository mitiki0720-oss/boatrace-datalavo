import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dateIndex = args.indexOf("--date");
const requestedDate = dateIndex >= 0 ? args[dateIndex + 1] : undefined;
if (dateIndex >= 0 && (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))) throw new Error("--date requires YYYY-MM-DD");
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const asText = (value) => typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
const normalizeName = (value) => asText(value).normalize("NFKC").replace(/\s+/gu, " ");
const validRegistration = (value) => /^\d{4,6}$/.test(asText(value)) && asText(value) !== "0000";
const completeProvenance = (sources) => (Array.isArray(sources) ? sources : []).some((source) => asText(source?.sourceName) && asText(source?.sourceType) && asText(source?.sourceFetchedAt) && source?.provenance);
const index = readJson("public/data/boatrace-ex/index.generated.json");
const date = requestedDate ?? index.latestDate;
const registryPath = "public/data/boatrace-ex/identity/registered-racers.generated.json";
const auditPath = `public/data/boatrace-ex/audit/registered-racer-identity-registry-${date}.generated.json`;
const markdownPath = `docs/boat-ex/registered-racer-identity-registry-${date}.md`;
const registry = readJson(registryPath);
const audit = readJson(auditPath);
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
let sourceAppearanceCount = 0;
let unresolvedExcludedCount = 0;
const expected = new Map();
for (const historyDate of audit.coverage?.dates ?? []) {
	const history = readJson(`public/data/boatrace-ex/history/races/${historyDate}.json`);
	for (const record of history.records ?? []) for (const racer of record.racer ?? []) {
		if (!validRegistration(racer?.registrationNumber)) { unresolvedExcludedCount += 1; continue; }
		if (!completeProvenance(racer.sources)) continue;
		sourceAppearanceCount += 1;
		const registrationNo = asText(racer.registrationNumber);
		const entry = expected.get(registrationNo) ?? { names: new Set(), appearances: 0 };
		entry.names.add(normalizeName(racer.racerName));
		entry.appearances += 1;
		expected.set(registrationNo, entry);
	}
}
const safe = [...expected.entries()].filter(([, entry]) => entry.names.size === 1 && [...entry.names][0]);
const historicalNames = new Set(safe.map(([, entry]) => [...entry.names][0]));
const current = readJson("public/data/boatrace/today-race-details.generated.json");
const currentCandidates = new Map();
for (const venue of current.venues ?? []) {
	const sourceName = asText(venue?.source ?? current.source);
	const sourceFetchedAt = asText(venue?.generatedAt ?? current.generatedAt);
	for (const race of venue.races ?? []) for (const racer of race.racers ?? []) {
		const registrationNo = asText(racer?.registrationNo);
		if (!validRegistration(registrationNo) || expected.has(registrationNo)) continue;
		const racerName = asText(racer?.name);
		const branch = asText(racer?.branch);
		const age = asText(racer?.age);
		const className = asText(racer?.className ?? racer?.class);
		if (!sourceName.startsWith("official:") || !sourceFetchedAt || !racerName || !branch || !age || !className) continue;
		const entry = currentCandidates.get(registrationNo) ?? { names: new Set(), appearances: 0, sourceName, sourceFetchedAt };
		entry.names.add(normalizeName(racerName));
		entry.appearances += 1;
		currentCandidates.set(registrationNo, entry);
	}
}
const currentDaySafe = [...currentCandidates.entries()].filter(([, entry]) => entry.names.size === 1 && [...entry.names][0] && !historicalNames.has([...entry.names][0]));
const currentDaySlotCount = currentDaySafe.reduce((total, [, entry]) => total + entry.appearances, 0);
assert(registry.schemaVersion === 1, "registry schemaVersion must be 1");
assert(registry.kind === "boatrace-ex-registered-racer-identity-registry", "registry kind mismatch");
assert(registry.identityPolicy === "registrationNo-primary-key; provenance-complete-only; no name-based merge", "identity policy mismatch");
assert(Array.isArray(registry.sourceFiles) && registry.sourceFiles.every((item) => !item.startsWith("public/data/reviews/") && !item.startsWith("public/dog/")), "registry must not use protected review/dog sources");
assert(registry.summary?.sourceAppearanceCount === sourceAppearanceCount, "source appearance count does not match history");
assert(registry.summary?.unresolvedExcludedCount === unresolvedExcludedCount, "unresolved excluded count does not match history");
assert(registry.summary?.identityCount === safe.length + currentDaySafe.length, "safe identity count does not match history and current official supplement");
assert(registry.identities?.length === safe.length + currentDaySafe.length, "identity array length does not match safe identity sources");
assert(registry.summary?.currentDaySupplementIdentityCount === currentDaySafe.length, "current-day supplement identity count does not match official source");
assert(registry.summary?.currentDaySupplementSlotCount === currentDaySlotCount, "current-day supplement slot count does not match official source");
assert(audit.summary?.identityCount === registry.summary?.identityCount, "audit identity count does not match registry");
assert(audit.coverage?.historyModified === false, "registry generation must not modify history");
assert(fs.existsSync(path.join(root, markdownPath)), "registry runbook must exist");
for (const [registrationNo, entry] of currentDaySafe) {
	const identity = registry.identities?.find((item) => item.registrationNo === registrationNo);
	assert(identity?.currentDayProvenance?.sourcePath === "public/data/boatrace/today-race-details.generated.json", `current-day provenance path mismatch: ${registrationNo}`);
	assert(identity?.currentDayProvenance?.sourceName === entry.sourceName && asText(identity?.currentDayProvenance?.sourceFetchedAt), `current-day provenance mismatch: ${registrationNo}`);
}
const seen = new Set();
for (const identity of registry.identities ?? []) {
	assert(validRegistration(identity.registrationNo), `invalid registrationNo in registry: ${identity.registrationNo}`);
	assert(!seen.has(identity.registrationNo), `duplicate registry registrationNo: ${identity.registrationNo}`);
	seen.add(identity.registrationNo);
	assert(Array.isArray(identity.nameVariants) && identity.nameVariants.length > 0, `nameVariants required: ${identity.registrationNo}`);
	assert(new Set(identity.nameVariants.map(normalizeName)).size === 1, `unsafe multiple normalized names: ${identity.registrationNo}`);
	assert(identity.provenanceCount === identity.appearanceCount, `provenance count mismatch: ${identity.registrationNo}`);
	assert(Array.isArray(identity.raceContexts) && identity.raceContexts.length > 0, `race contexts required: ${identity.registrationNo}`);
}
if (errors.length > 0) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ ok: true, registryPath, auditPath, markdownPath, ...registry.summary, collisionCount: audit.classification?.collision?.count, aliasCandidateCount: audit.classification?.aliasCandidate?.count }, null, 2));
