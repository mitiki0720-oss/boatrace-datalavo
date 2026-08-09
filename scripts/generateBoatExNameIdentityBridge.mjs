import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const write = args.includes("--write");
if (dryRun === write) throw new Error("Provide exactly one of --dry-run or --write");

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const writeText = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, value, "utf8");
};
const valid = (value) => /^\d{4,6}$/.test(String(value ?? "")) && value !== "0000";
const sample = (target, value) => {
	if (target.length < 25) target.push(value);
};

const dateIndex = readJson("public/data/boatrace-ex/index.generated.json");
const auditDate = dateIndex.latestDate;
const registryPath = "public/data/boatrace-ex/identity/registered-racers.generated.json";
const linkagePath = `public/data/boatrace-ex/audit/racer-evidence-registry-linkage-${auditDate}.generated.json`;
const dates = dateIndex.availableDates;
const counts = {
	sourceUnresolvedAppearances: 0,
	exactUniqueNameLinked: 0,
	exactUniqueNameLinkedAppearances: 0,
	ambiguousSkipped: 0,
	registryNameMissing: 0,
	registryMissing: 0,
	collision: 0,
	officialRegistrationNoLinkedRacerEvidence: 0,
};
const nameLinkedSamples = [];
const ambiguousSamples = [];

for (const date of dates) {
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	for (const record of history.records ?? []) {
		for (const racer of record.racer ?? []) {
			if (!valid(racer?.registrationNumber)) counts.sourceUnresolvedAppearances += 1;
		}
	}

	const evidence = readJson(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`);
	for (const racer of evidence.racers ?? []) {
		if (valid(racer.registrationNumber)) continue;
		if (valid(racer.resolvedRegistrationNo) && racer.identityLinkMethod === "exact-normalized-name-unique") {
			counts.exactUniqueNameLinked += 1;
			counts.exactUniqueNameLinkedAppearances += Number(racer.appearanceCount ?? 0);
			sample(nameLinkedSamples, {
				date,
				racerName: racer.racerName,
				resolvedRegistrationNo: racer.resolvedRegistrationNo,
				appearanceCount: racer.appearanceCount,
			});
			continue;
		}
		if (racer.identityLinkMethod === "ambiguous") {
			counts.ambiguousSkipped += 1;
			sample(ambiguousSamples, { date, racerName: racer.racerName, appearanceCount: racer.appearanceCount });
		} else {
			counts.registryNameMissing += 1;
		}
	}
}

const linkage = readJson(linkagePath);
counts.registryMissing = Number(linkage.counts?.registryMissing ?? 0);
counts.collision = Number(linkage.counts?.collision ?? 0);
counts.officialRegistrationNoLinkedRacerEvidence = Number(linkage.counts?.linked ?? 0);

const auditPath = `public/data/boatrace-ex/audit/name-identity-bridge-${auditDate}.generated.json`;
const markdownPath = `docs/boat-ex/name-identity-bridge-${auditDate}.md`;
const audit = {
	schemaVersion: 1,
	kind: "boatrace-ex-name-identity-bridge-audit",
	auditDate,
	generatedAt: new Date().toISOString(),
	mode: dryRun ? "dry-run" : "write",
	policy: "Only exact normalized racerName matches that map to one registered identity may add supplemental linkage fields. Official registrationNo fields, history, and racerName values are never mutated. Fuzzy, partial, guessed, and inferred matching are prohibited.",
	sourceFiles: [
		"public/data/boatrace-ex/index.generated.json",
		registryPath,
		linkagePath,
		...dates.flatMap((date) => [
			`public/data/boatrace-ex/history/races/${date}.json`,
			`public/data/boatrace-ex/derived/racer-evidence/${date}.json`,
		]),
	],
	coverage: {
		from: dates[0],
		to: dates.at(-1),
		dateCount: dates.length,
		dates,
		historyModified: false,
		officialRegistrationNoModified: false,
	},
	counts,
	nameLinkedSamples,
	ambiguousSamples,
};
const markdown = `# Boat EX Name Identity Bridge (${auditDate})\n\n- source unresolved appearances: ${counts.sourceUnresolvedAppearances}\n- exact unique name linked racer evidence: ${counts.exactUniqueNameLinked}\n- exact unique name linked appearances: ${counts.exactUniqueNameLinkedAppearances}\n- ambiguous skipped: ${counts.ambiguousSkipped}\n- registry name missing: ${counts.registryNameMissing}\n- registry missing: ${counts.registryMissing}\n- collision: ${counts.collision}\n- official registrationNo linked racer evidence: ${counts.officialRegistrationNoLinkedRacerEvidence}\n\nOnly exact normalized names with one registry registrationNo are linked. The official registrationNo and racerName source fields remain unchanged.\n`;

if (write) {
	writeJson(auditPath, audit);
	writeText(markdownPath, markdown);
}
console.log(JSON.stringify({ ok: true, dryRun, auditPath, markdownPath, ...counts }, null, 2));
