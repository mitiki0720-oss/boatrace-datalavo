import fs from "node:fs";
import path from "node:path";

const [, , ...args] = process.argv;
const dateIndex = args.indexOf("--date");
const date = dateIndex >= 0 ? args[dateIndex + 1] : "2026-08-02";

if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
	throw new Error("--date requires YYYY-MM-DD");
}

const rootDir = process.cwd();
const auditPath = path.join(rootDir, "public", "data", "boatrace-ex", "audit", `registration-coverage-${date}.generated.json`);
const markdownPath = path.join(rootDir, "docs", "boat-ex", `registration-coverage-audit-${date}.md`);
const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

assert(audit.kind === "boatrace-ex-registration-coverage-audit", "kind must be boatrace-ex-registration-coverage-audit");
assert(audit.schemaVersion === 1, "schemaVersion must be 1");
assert(audit.auditDate === date, "auditDate must match --date");
assert(Array.isArray(audit.coverage?.availableDates) && audit.coverage.availableDates.includes(date), "availableDates must include audit date");
assert(audit.coverage?.latestDate >= date, "latestDate must be at least the audit date");
assert(Number.isInteger(audit.coverage?.totalRaceCount) && audit.coverage.totalRaceCount > 0, "totalRaceCount must be positive");
assert(Number.isInteger(audit.identityCoverage?.racerIdentityCount) && audit.identityCoverage.racerIdentityCount > 0, "racerIdentityCount must be positive");
assert(audit.identityCoverage.racerIdentityCount === audit.bridgeClassification.safeBridge.count + audit.bridgeClassification.candidateBridge.count + audit.bridgeClassification.unresolved.count, "bridge classification counts must equal racerIdentityCount");
assert(audit.identityCoverage.withoutRegistrationAppearanceCount >= 0, "withoutRegistrationAppearanceCount must be non-negative");
assert(Array.isArray(audit.sourceFiles) && audit.sourceFiles.every((sourcePath) => !sourcePath.startsWith("public/data/reviews/") && !sourcePath.startsWith("public/dog/")), "audit must not read reviews or dog sources");
assert(Array.isArray(audit.nextBridgePlan) && audit.nextBridgePlan.length >= 3, "nextBridgePlan must contain at least three steps");
assert(fs.existsSync(markdownPath), "audit markdown must exist");

if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log(JSON.stringify({
	ok: true,
	auditPath: path.relative(rootDir, auditPath),
	markdownPath: path.relative(rootDir, markdownPath),
	latestDate: audit.coverage.latestDate,
	availableDateCount: audit.coverage.availableDateCount,
	safeBridgeCount: audit.bridgeClassification.safeBridge.count,
	candidateBridgeCount: audit.bridgeClassification.candidateBridge.count,
	unresolvedCount: audit.bridgeClassification.unresolved.count,
}, null, 2));
