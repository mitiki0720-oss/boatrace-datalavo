import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const index = args.indexOf("--date");
const requestedDate = index >= 0 ? args[index + 1] : undefined;
if (index >= 0 && (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))) throw new Error("--date requires YYYY-MM-DD");
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const dateIndex = readJson("public/data/boatrace-ex/index.generated.json");
const date = requestedDate ?? dateIndex.latestDate;
const auditPath = `public/data/boatrace-ex/audit/registration-bridge-${date}.generated.json`;
const markdownPath = `docs/boat-ex/registration-bridge-${date}.md`;
const audit = readJson(auditPath);
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const isRegistrationNumber = (value) => /^\d{4,6}$/.test(String(value ?? "")) && value !== "0000";

assert(audit.schemaVersion === 1, "schemaVersion must be 1");
assert(audit.kind === "boatrace-ex-registration-bridge-audit", "kind mismatch");
assert(audit.auditDate === date, "auditDate mismatch");
assert(["dry-run", "write"].includes(audit.mode), "mode must be dry-run or write");
assert(audit.readOnlyInputs?.reviewSourceRoot?.usedForRegistrationBridge === false, "reviews must not be used for registration inference");
assert(audit.readOnlyInputs?.dogSourceRoot?.usedForRegistrationBridge === false, "dog summaries must not be used for registration inference");
assert(Array.isArray(audit.officialSource?.sourceFiles) && audit.officialSource.sourceFiles.every((item) => item.startsWith("public/data/boatrace-ex/source/official-details/")), "official sources must be dated official-detail archives");
const safe = audit.classification?.safeBridge;
const candidate = audit.classification?.candidateBridge;
const unresolved = audit.classification?.unresolved;
assert(Number.isInteger(safe?.count) && safe.count >= 0, "safeBridge count must be non-negative");
assert(Number.isInteger(candidate?.count) && candidate.count >= 0, "candidateBridge count must be non-negative");
assert(Number.isInteger(unresolved?.count) && unresolved.count >= 0, "unresolved count must be non-negative");
assert(audit.coverage?.after?.registrationAppearanceCount === audit.coverage?.before?.registrationAppearanceCount + safe?.count, "after registration count must equal before plus safeBridge count");
assert(audit.coverage?.after?.missingRegistrationAppearanceCount === audit.coverage?.before?.missingRegistrationAppearanceCount - safe?.count, "after missing count must equal before minus safeBridge count");
assert(fs.existsSync(path.join(root, markdownPath)), "bridge markdown must exist");

for (const item of safe?.appearances ?? []) {
	assert(isRegistrationNumber(item.registrationNumber), `safe bridge has invalid registration number for ${item.date}/${item.raceNo}`);
	assert(item.source?.sourceType === "official" && item.source?.sourceFetchedAt && item.source?.provenance, `safe bridge lacks official provenance for ${item.date}/${item.raceNo}`);
	const history = readJson(`public/data/boatrace-ex/history/races/${item.date}.json`);
	const record = (history.records ?? []).find((entry) => entry.venueCode === item.venueCode && Number(entry.raceNo) === Number(item.raceNo));
	const racer = record?.racer?.find((entry) => Number(entry.lane) === Number(item.boatNo));
	assert(racer?.registrationNumber === item.registrationNumber, `history registration was not written for ${item.date}/${item.raceNo}/${item.boatNo}`);
	assert((racer?.sources ?? []).some((source) => source?.sourcePath === item.source.sourcePath && source?.sourceFetchedAt === item.source.sourceFetchedAt), `history racer source provenance missing for ${item.date}/${item.raceNo}/${item.boatNo}`);
}

if (errors.length > 0) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ ok: true, auditPath, markdownPath, safeBridgeCount: safe.count, candidateBridgeCount: candidate.count, unresolvedCount: unresolved.count, before: audit.coverage.before, after: audit.coverage.after, changedDates: audit.coverage.changedDates }, null, 2));
