import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const args = process.argv.slice(2);
const dateIndex = args.indexOf("--date");
const requestedDate = dateIndex >= 0 ? args[dateIndex + 1] : null;
if (dateIndex >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? "")) throw new Error("--date requires YYYY-MM-DD");

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8").replace(/^\uFEFF/, ""));
const indexPath = "public/data/boatrace-ex/source/official-details/index.generated.json";
const index = readJson(indexPath);
const date = requestedDate ?? index.latestDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) throw new Error("No official detail snapshot date is available");
const snapshotPath = `public/data/boatrace-ex/source/official-details/${date}.json`;
const snapshot = readJson(snapshotPath);
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };
const allRaces = (snapshot.venues ?? []).flatMap((venue) => venue.races ?? []);
const allEntries = allRaces.flatMap((race) => race.entries ?? []);
const actualRegistrationCount = allEntries.filter((entry) => typeof entry.registrationNo === "string" && entry.registrationNo.trim()).length;
const actualResultCount = allRaces.filter((race) => race.result && race.result.status && race.result.status !== "pending").length;
const actualPayoutCount = allRaces.filter((race) => race.payout !== null && race.payout !== undefined).length;
const encoded = JSON.stringify(snapshot);

assert(snapshot.kind === "boatrace-ex-official-detail-source", "unexpected snapshot kind");
assert(snapshot.schemaVersion === 1, "snapshot schemaVersion must be 1");
assert(snapshot.date === date, "snapshot date mismatch");
assert(Array.isArray(snapshot.venues) && snapshot.venues.length > 0, "venue count must be positive");
assert(allRaces.length > 0, "race count must be positive");
assert(allEntries.length > 0, "entry count must be positive");
assert(typeof snapshot.sourceFetchedAt === "string" && snapshot.sourceFetchedAt.length > 0, "sourceFetchedAt is required");
assert(snapshot.provenance?.sourceFiles?.length > 0, "source provenance is required");
assert(snapshot.provenance.sourceFiles.every((file) => file.startsWith("public/data/boatrace/") && !file.includes("reviews") && !file.includes("dog")), "only official generated source files are allowed");
assert(snapshot.sourceType === "generated-from-official" || snapshot.sourceType === "official-derived", "sourceType must be official-derived");
assert(snapshot.identityPolicy === "explicit-official-registrationNo-only", "registration identity policy must be explicit official only");
assert(!/\b(fake|fuzzy|guessed|inferred)\b/i.test(encoded), "snapshot contains a prohibited identity or fake marker");
assert(snapshot.summary?.venueCount === snapshot.venues.length, "summary venue count mismatch");
assert(snapshot.summary?.raceCount === allRaces.length, "summary race count mismatch");
assert(snapshot.summary?.entryCount === allEntries.length, "summary entry count mismatch");
assert(snapshot.summary?.registrationNoCount === actualRegistrationCount, "summary registration count mismatch");
assert(snapshot.summary?.registrationNoMissingCount === allEntries.length - actualRegistrationCount, "summary missing registration count mismatch");
assert(snapshot.summary?.resultAvailableCount === actualResultCount, "summary result availability mismatch");
assert(snapshot.summary?.payoutAvailableCount === actualPayoutCount, "summary payout availability mismatch");
assert(index.kind === "boatrace-ex-official-detail-source-index", "unexpected index kind");
assert(index.availableDates?.includes(date), "index does not include snapshot date");

if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}

console.log(JSON.stringify({
	ok: true,
	date,
	snapshotPath,
	summary: snapshot.summary,
	availableDates: index.availableDates,
}, null, 2));
