import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const readArg = (name) => {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
};
const from = readArg("--from");
const to = readArg("--to");
const dryRun = args.includes("--dry-run");
const write = args.includes("--write");
if (dryRun === write) throw new Error("Provide exactly one of --dry-run or --write");
for (const value of [from, to]) {
	if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("--from/--to require YYYY-MM-DD");
}

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
const normalizeName = (value) => String(value ?? "").trim().normalize("NFKC").replace(/\s+/gu, " ");
const sample = (target, value) => {
	if (target.length < 50) target.push(value);
};

const index = readJson("public/data/boatrace-ex/index.generated.json");
const dates = index.availableDates.filter((date) => (!from || date >= from) && (!to || date <= to));
const registryPath = "public/data/boatrace-ex/identity/registered-racers.generated.json";
const registry = readJson(registryPath);
const registryByNo = new Map((registry.identities ?? []).map((identity) => [String(identity.registrationNo), identity]));
const counts = {
	linked: 0,
	nameLinked: 0,
	nameLinkedAppearances: 0,
	unlinkedRegistered: 0,
	unresolvedExcluded: 0,
	registryNameMissing: 0,
	ambiguousNameSkipped: 0,
	registryMissing: 0,
	collision: 0,
};
const linkedSamples = [];
const nameLinkedSamples = [];
const unlinkedSamples = [];

for (const date of dates) {
	const evidence = readJson(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`);
	for (const racer of evidence.racers ?? []) {
		if (!valid(racer.registrationNumber)) {
			if (valid(racer.resolvedRegistrationNo) && racer.identityLinkMethod === "exact-normalized-name-unique") {
				const identity = registryByNo.get(String(racer.resolvedRegistrationNo));
				if (!identity) {
					counts.registryMissing += 1;
					sample(unlinkedSamples, { date, racerName: racer.racerName, reason: "name-linked-registry-missing" });
					continue;
				}
				if (identity.normalizedRacerName !== normalizeName(racer.normalizedRacerName)) {
					counts.collision += 1;
					sample(unlinkedSamples, { date, racerName: racer.racerName, reason: "name-linked-registry-name-mismatch" });
					continue;
				}
				counts.nameLinked += 1;
				counts.nameLinkedAppearances += Number(racer.appearanceCount ?? 0);
				sample(nameLinkedSamples, {
					date,
					resolvedRegistrationNo: racer.resolvedRegistrationNo,
					racerName: racer.racerName,
					method: racer.identityLinkMethod,
					appearanceCount: racer.appearanceCount,
				});
				continue;
			}

			counts.unresolvedExcluded += 1;
			if (racer.identityLinkMethod === "ambiguous") counts.ambiguousNameSkipped += 1;
			else counts.registryNameMissing += 1;
			continue;
		}

		const identity = registryByNo.get(String(racer.registrationNumber));
		if (!identity) {
			counts.registryMissing += 1;
			sample(unlinkedSamples, { date, registrationNo: racer.registrationNumber, racerName: racer.racerName, reason: "registry-missing" });
			continue;
		}
		if (identity.normalizedRacerName !== normalizeName(racer.normalizedRacerName)) {
			counts.collision += 1;
			sample(unlinkedSamples, { date, registrationNo: racer.registrationNumber, racerName: racer.racerName, reason: "registry-name-mismatch" });
			continue;
		}
		if (racer.identityRegistryMatched === true && racer.identityRegistryKey === identity.registrationNo) {
			counts.linked += 1;
			sample(linkedSamples, { date, registrationNo: racer.registrationNumber, racerName: racer.racerName, identityRegistryKey: racer.identityRegistryKey });
		} else {
			counts.unlinkedRegistered += 1;
			sample(unlinkedSamples, { date, registrationNo: racer.registrationNumber, racerName: racer.racerName, reason: "linkage-metadata-missing" });
		}
	}
}

const auditDate = index.latestDate;
const auditPath = `public/data/boatrace-ex/audit/racer-evidence-registry-linkage-${auditDate}.generated.json`;
const markdownPath = `docs/boat-ex/racer-evidence-registry-linkage-${auditDate}.md`;
const audit = {
	schemaVersion: 1,
	kind: "boatrace-ex-racer-evidence-registry-linkage-audit",
	auditDate,
	generatedAt: new Date().toISOString(),
	mode: dryRun ? "dry-run" : "write",
	policy: "Exact official registrationNo lookup first. Missing official registrationNo may be linked only by a unique exact normalized registry name. No fuzzy, partial, guessed, history, or official registrationNo mutation.",
	sourceFiles: [registryPath, ...dates.map((date) => `public/data/boatrace-ex/derived/racer-evidence/${date}.json`)],
	coverage: {
		from: dates[0],
		to: dates.at(-1),
		dateCount: dates.length,
		dates,
		historyModified: false,
		officialRegistrationNoModified: false,
	},
	registryIdentityCount: registry.identities?.length ?? 0,
	counts,
	linkedSamples,
	nameLinkedSamples,
	unlinkedSamples,
};
const markdown = `# Boat EX Racer Evidence Registry Linkage (${auditDate})\n\n- registry identities: ${audit.registryIdentityCount}\n- official registrationNo linked: ${counts.linked}\n- exact unique name-linked: ${counts.nameLinked}\n- exact unique name-linked appearances: ${counts.nameLinkedAppearances}\n- unlinkedRegistered: ${counts.unlinkedRegistered}\n- unresolvedExcluded: ${counts.unresolvedExcluded}\n- registryNameMissing: ${counts.registryNameMissing}\n- ambiguousNameSkipped: ${counts.ambiguousNameSkipped}\n- registryMissing: ${counts.registryMissing}\n- collision: ${counts.collision}\n\nOfficial registrationNo fields are not changed. Missing official registrationNo values are linked only when a normalized racer name maps to exactly one registry registrationNo. Fuzzy, partial, and guessed matching are prohibited.\n`;

if (write) {
	writeJson(auditPath, audit);
	writeText(markdownPath, markdown);
}
console.log(JSON.stringify({ ok: true, dryRun, auditPath, markdownPath, registryIdentityCount: audit.registryIdentityCount, ...counts, dates }, null, 2));
