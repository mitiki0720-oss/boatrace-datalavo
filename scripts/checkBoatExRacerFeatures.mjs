import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const features = read("public/data/boatrace-ex/derived/racer-features/latest.json");
const summary = read("public/data/boatrace-ex/derived/racer-features/history-summary.json");
const audit = read("public/data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json");
const racerList = features.racers ?? [];
const allowedSampleLevels = new Set(["low-sample", "limited", "sufficient"]);
const invalid = racerList.filter((racer) => (
	!/^\d{4,6}$/.test(String(racer.registrationNo ?? ""))
	|| !racer.name
	|| racer.historyStarts <= 0
	|| !allowedSampleLevels.has(racer.sampleLevel)
	|| !Array.isArray(racer.venues)
	|| !Array.isArray(racer.frames)
	|| !racer.startTiming
	|| !racer.recent
));
const duplicateRegistrationNos = racerList
	.map((racer) => racer.registrationNo)
	.filter((registrationNo, index, values) => values.indexOf(registrationNo) !== index);
const forbidden = JSON.stringify(features).match(/(?:fake|guessed|inferred|score|rank|prediction)/gi) ?? [];
const checks = {
	kind: features.kind === "boatrace-ex-racer-features" && summary.kind === "boatrace-ex-racer-features-history-summary",
	featureSummaryMatches: features.summary?.racerCount === racerList.length && summary.racerCount === racerList.length,
	dateCoverageMatches: summary.dateRange?.dateCount === features.summary?.dateRange?.dateCount && features.summary?.dateRange?.dateCount > 0,
	featureShape: invalid.length === 0 && duplicateRegistrationNos.length === 0,
	auditIsLinked: summary.unresolvedAuditPath === "public/data/boatrace-ex/audit/racer-identity-unresolved-audit-latest.generated.json" && audit.kind === "boatrace-ex-racer-identity-unresolved-audit",
	noForbiddenOutput: forbidden.length === 0,
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, racerCount: racerList.length, invalidCount: invalid.length, duplicateRegistrationNos, unresolved: audit.unresolved, forbidden }, null, 2));
if (!ok) process.exitCode = 1;
