import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const valid = (value) => /^\d{4,6}$/.test(String(value ?? "")) && value !== "0000";
const dateIndex = readJson("public/data/boatrace-ex/index.generated.json");
const auditDate = dateIndex.latestDate;
const auditPath = `public/data/boatrace-ex/audit/name-identity-bridge-${auditDate}.generated.json`;
const markdownPath = `docs/boat-ex/name-identity-bridge-${auditDate}.md`;
const audit = readJson(auditPath);
const errors = [];
const assert = (condition, message) => {
	if (!condition) errors.push(message);
};
const counts = {
	sourceUnresolvedAppearances: 0,
	exactUniqueNameLinked: 0,
	exactUniqueNameLinkedAppearances: 0,
	ambiguousSkipped: 0,
	registryNameMissing: 0,
};

for (const date of audit.coverage?.dates ?? dateIndex.availableDates) {
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	for (const record of history.records ?? []) {
		for (const racer of record.racer ?? []) {
			if (!valid(racer?.registrationNumber)) counts.sourceUnresolvedAppearances += 1;
		}
	}
	const evidence = readJson(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`);
	for (const racer of evidence.racers ?? []) {
		if (valid(racer.registrationNumber)) continue;
		if (valid(racer.resolvedRegistrationNo)) {
			assert(racer.identityLinkMethod === "exact-normalized-name-unique", `${date}/${racer.racerName}: non-exact name link is forbidden`);
			assert(racer.registrationNoSourceStatus === "name-linked-from-registry", `${date}/${racer.racerName}: name link source status mismatch`);
			assert(racer.officialRegistrationNoAvailable === false, `${date}/${racer.racerName}: official registration number was changed`);
			counts.exactUniqueNameLinked += 1;
			counts.exactUniqueNameLinkedAppearances += Number(racer.appearanceCount ?? 0);
			continue;
		}
		if (racer.identityLinkMethod === "ambiguous") counts.ambiguousSkipped += 1;
		else counts.registryNameMissing += 1;
	}
}

assert(audit.kind === "boatrace-ex-name-identity-bridge-audit", "audit kind mismatch");
assert(audit.coverage?.historyModified === false, "history must not be modified");
assert(audit.coverage?.officialRegistrationNoModified === false, "official registrationNo must not be modified");
for (const [key, value] of Object.entries(counts)) assert(audit.counts?.[key] === value, `audit ${key} count mismatch`);
assert(fs.existsSync(path.join(root, markdownPath)), "name identity bridge markdown is missing");
if (errors.length > 0) {
	console.error(errors.join("\n"));
	process.exitCode = 1;
} else {
	console.log(JSON.stringify({ ok: true, auditPath, markdownPath, ...audit.counts }, null, 2));
}
