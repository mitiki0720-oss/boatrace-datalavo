import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedIndex = process.argv.indexOf("--expected-latest-date");
const expectedLatestDate = expectedIndex >= 0 ? process.argv[expectedIndex + 1] : null;
if (expectedLatestDate && !/^\d{4}-\d{2}-\d{2}$/.test(expectedLatestDate)) throw new Error("--expected-latest-date requires YYYY-MM-DD");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));
const index = read("public/data/boatrace-ex/index.generated.json");
const errors = [];
if (expectedLatestDate && index.latestDate !== expectedLatestDate) errors.push(`latestDate expected ${expectedLatestDate}, got ${index.latestDate}`);
for (const date of index.availableDates ?? []) {
	for (const base of ["history/races", "coverage", "derived/venue-evidence", "derived/racer-evidence"]) {
		const relativePath = `public/data/boatrace-ex/${base}/${date}.json`;
		if (!exists(relativePath)) errors.push(`missing ${relativePath}`);
		else read(relativePath);
	}
	const history = read(`public/data/boatrace-ex/history/races/${date}.json`);
	for (const record of history.records ?? []) {
		const result = record.officialResult;
		const completeResult = Array.isArray(result?.finishOrder) && result.finishOrder.length >= 3;
		if (!completeResult && record.coverage?.officialResult === "complete") errors.push(`${date} ${record.raceKey}: complete result without finish order`);
		if (record.score !== undefined || record.rank !== undefined) errors.push(`${date} ${record.raceKey}: generated score/rank is prohibited`);
	}
}
if (errors.length) {
	console.error(errors.join("\n"));
	process.exit(1);
}
console.log(JSON.stringify({ ok: true, latestDate: index.latestDate, dateCount: index.availableDates.length, expectedLatestDate }, null, 2));
