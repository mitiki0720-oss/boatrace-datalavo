import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dateIndex = args.indexOf("--date");
const requestedDate = dateIndex >= 0 ? args[dateIndex + 1] : undefined;
if (dateIndex >= 0 && (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))) throw new Error("--date requires YYYY-MM-DD");
const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const asText = (value) => typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
const validRegistration = (value) => /^\d{4,6}$/.test(asText(value)) && asText(value) !== "0000";
const hash = (values) => crypto.createHash("sha256").update(values.sort().join("\n"), "utf8").digest("hex");
const index = readJson("public/data/boatrace-ex/index.generated.json");
const date = requestedDate ?? index.latestDate;
const auditPath = `public/data/boatrace-ex/audit/registration-provenance-${date}.generated.json`;
const markdownPath = `docs/boat-ex/registration-provenance-${date}.md`;
const audit = readJson(auditPath);
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
let complete = 0;
let missing = 0;
const tuples = [];
for (const historyDate of audit.coverage?.dates ?? []) {
	const history = readJson(`public/data/boatrace-ex/history/races/${historyDate}.json`);
	for (const record of history.records ?? []) for (const racer of record.racer ?? []) {
		if (!validRegistration(racer?.registrationNumber)) continue;
		tuples.push([record.date, record.venueCode, record.raceNo, racer.lane, racer.registrationNumber, racer.racerName].map(asText).join("\u0000"));
		if ((racer.sources ?? []).some((source) => asText(source?.sourceName) && asText(source?.sourceType) && asText(source?.sourceFetchedAt) && source?.provenance)) complete += 1;
		else missing += 1;
	}
}
assert(audit.schemaVersion === 1, "schemaVersion must be 1");
assert(audit.kind === "boatrace-ex-registration-provenance-audit", "kind mismatch");
assert(audit.auditDate === date, "auditDate mismatch");
assert(audit.before?.registrationValueHash === audit.after?.registrationValueHash, "registration values changed during provenance propagation");
assert(audit.after?.registrationValueHash === hash(tuples), "current registration values do not match audit hash");
assert(audit.after?.provenanceCompleteCount === complete, "after provenance complete count does not match history");
assert(audit.after?.provenanceMissingCount === missing, "after provenance missing count does not match history");
assert(audit.classification?.propagated?.count >= 0 && audit.classification?.sourceMissing?.count >= 0 && audit.classification?.sourceConflict?.count >= 0, "classification counts must be non-negative");
assert(Array.isArray(audit.sourceFiles) && audit.sourceFiles.every((item) => !item.startsWith("public/data/reviews/") && !item.startsWith("public/dog/")), "audit must not use protected review/dog files");
assert(fs.existsSync(path.join(root, markdownPath)), "provenance markdown must exist");
if (errors.length > 0) { console.error(errors.join("\n")); process.exitCode = 1; }
else console.log(JSON.stringify({ ok: true, auditPath, markdownPath, before: audit.before, propagatedCount: audit.classification.propagated.count, alreadyCompleteCount: audit.classification.alreadyComplete.count, sourceMissingCount: audit.classification.sourceMissing.count, sourceConflictCount: audit.classification.sourceConflict.count, contextMismatchCount: audit.classification.contextMismatch.count, after: audit.after, changedDates: audit.coverage.changedDates }, null, 2));
