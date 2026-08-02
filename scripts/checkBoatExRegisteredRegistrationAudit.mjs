import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dateIndex = args.indexOf("--date");
const requestedDate = dateIndex >= 0 ? args[dateIndex + 1] : undefined;
if (dateIndex >= 0 && (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))) throw new Error("--date requires YYYY-MM-DD");
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const index = readJson("public/data/boatrace-ex/index.generated.json");
const date = requestedDate ?? index.latestDate;
const auditPath = `public/data/boatrace-ex/audit/registered-registration-quality-${date}.generated.json`;
const markdownPath = `docs/boat-ex/registered-registration-quality-${date}.md`;
const audit = readJson(auditPath);
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const asText = (value) => typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
const valid = (value) => /^\d{4,6}$/.test(asText(value)) && asText(value) !== "0000";
let registeredAppearanceCount = 0;
let validRegistrationNoCount = 0;
let invalidRegistrationNoCount = 0;
for (const historyDate of audit.coverage?.dates ?? []) {
	const history = readJson(`public/data/boatrace-ex/history/races/${historyDate}.json`);
	for (const record of history.records ?? []) for (const racer of record.racer ?? []) {
		const registration = asText(racer?.registrationNumber);
		if (!registration) continue;
		registeredAppearanceCount += 1;
		if (valid(registration)) validRegistrationNoCount += 1;
		else invalidRegistrationNoCount += 1;
	}
}
assert(audit.schemaVersion === 1, "schemaVersion must be 1");
assert(audit.kind === "boatrace-ex-registered-registration-quality-audit", "kind mismatch");
assert(audit.auditDate === date, "auditDate mismatch");
assert(["dry-run", "write"].includes(audit.mode), "mode must be dry-run or write");
assert(audit.coverage?.historyModified === false, "quality audit must not modify EX history");
assert(Array.isArray(audit.sourceFiles) && audit.sourceFiles.every((item) => !item.startsWith("public/data/reviews/") && !item.startsWith("public/dog/")), "audit must not read protected review/dog files");
assert(audit.summary?.registeredAppearanceCount === registeredAppearanceCount, "registered appearance count does not match history");
assert(audit.summary?.validRegistrationNoCount === validRegistrationNoCount, "valid registration count does not match history");
assert(audit.summary?.invalidRegistrationNoCount === invalidRegistrationNoCount, "invalid registration count does not match history");
assert(audit.summary?.registeredAppearanceCount === audit.summary?.validRegistrationNoCount + audit.summary?.invalidRegistrationNoCount, "registered count must equal valid plus invalid");
assert(audit.summary?.collisionCount === audit.classification?.collision?.count, "collision summary must match classification");
assert(audit.summary?.aliasCandidateCount === audit.classification?.aliasCandidate?.count, "alias summary must match classification");
assert(audit.summary?.safeRegisteredIdentityCount === audit.classification?.safeSameRacer?.count, "safe identity summary must match classification");
assert(fs.existsSync(path.join(root, markdownPath)), "audit markdown must exist");
if (errors.length > 0) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ ok: true, auditPath, markdownPath, ...audit.summary, sourceClassification: audit.sourceClassification }, null, 2));
