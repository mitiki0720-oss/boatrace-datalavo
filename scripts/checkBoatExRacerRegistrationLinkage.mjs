import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const args = process.argv.slice(2);
const write = args.includes("--write");
const registry = read("public/data/boatrace-ex/identity/registered-racers.generated.json");
const current = read("public/data/boatrace/today-race-details.generated.json");
const date = args.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg)) ?? current.date;
const known = new Set((registry.identities ?? []).map((item) => String(item.registrationNo)));
const racers = (current.venues ?? []).flatMap((venue) => (venue.races ?? []).flatMap((race) => race.racers ?? []));
const registrationNumbers = racers.map((racer) => String(racer.registrationNo ?? "").trim()).filter((value) => /^\d{4,6}$/.test(value));
const exactLinkedCount = registrationNumbers.filter((number) => known.has(number)).length;
const output = {
	schemaVersion: 1,
	kind: "boat-ex-racer-registration-linkage-audit-v1",
	generatedAt: new Date().toISOString(),
	targetDate: date,
	sourcePaths: ["public/data/boatrace/today-race-details.generated.json", "public/data/boatrace-ex/identity/registered-racers.generated.json"],
	summary: {
		currentRacerCount: racers.length,
		currentRegistrationNumberCount: registrationNumbers.length,
		exactRegistryLinkedCount: exactLinkedCount,
		unmatchedRegistrationNumberCount: registrationNumbers.length - exactLinkedCount,
	},
	rule: "registrationNo exact match only; no name matching or inference",
};
const outputPath = `public/data/boatrace-ex/audit/racer-registration-linkage-audit-${date}.generated.json`;
if (write) fs.writeFileSync(path.join(root, outputPath), `${JSON.stringify(output, null, 2)}\n`, "utf8");
const audited = write ? output : read(outputPath);
const ok = audited.kind === output.kind
	&& audited.targetDate === date
	&& audited.rule === output.rule
	&& audited.summary.currentRacerCount === output.summary.currentRacerCount
	&& audited.summary.currentRegistrationNumberCount === output.summary.currentRegistrationNumberCount
	&& audited.summary.exactRegistryLinkedCount === output.summary.exactRegistryLinkedCount
	&& audited.summary.unmatchedRegistrationNumberCount === output.summary.unmatchedRegistrationNumberCount;
console.log(JSON.stringify({ ok, outputPath, summary: audited.summary, wrote: write }, null, 2));
if (!ok) process.exitCode = 1;
