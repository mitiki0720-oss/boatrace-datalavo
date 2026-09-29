import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const dateIndex = argv.indexOf("--date");
const explicitDate = dateIndex >= 0 ? argv[dateIndex + 1] : null;
const all = argv.includes("--all");
if (!all && !/^\d{4}-\d{2}-\d{2}$/u.test(explicitDate ?? "")) throw new Error("Use --date YYYY-MM-DD or --all");
const fields = ["officialRace", "officialResult", "officialExhibition", "weather", "waterSurface", "motor", "boat", "racer", "prediction", "summary", "review", "derivedSignals"];
const statuses = ["complete", "partial", "missing", "pending", "not-supported", "unknown"];
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
function write(relativePath, value) {
	const outputPath = path.join(root, relativePath);
	const content = `${JSON.stringify(value, null, 2)}\n`;
	let lastError;
	for (let attempt = 1; attempt <= 4; attempt += 1) {
		try {
			fs.writeFileSync(outputPath, content, "utf8");
			return;
		} catch (error) {
			lastError = error;
			if (!["EPERM", "EBUSY", "UNKNOWN"].includes(error?.code) || attempt === 4) throw error;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 150 * attempt);
		}
	}
	throw lastError;
}
const dates = all ? read("public/data/boatrace-ex/index.generated.json").availableDates : [explicitDate];

for (const date of dates) {
	const history = read(`public/data/boatrace-ex/history/races/${date}.json`);
	const records = history.records ?? [];
	const existing = read(`public/data/boatrace-ex/coverage/${date}.json`);
	const fieldTotals = Object.fromEntries(fields.map((field) => [field, Object.fromEntries(statuses.map((status) => [status === "not-supported" ? "notSupported" : status, records.filter((record) => (record.coverage?.[field] ?? "unknown") === status).length]))]));
	const venueMap = new Map();
	for (const record of records) {
		const venue = venueMap.get(record.venueCode) ?? { venueCode: record.venueCode, venueName: record.venueName, raceCount: 0, completeOfficialRaceCount: 0, completeResultCount: 0, completeExhibitionCount: 0, warnings: [] };
		venue.raceCount += 1;
		venue.completeOfficialRaceCount += record.coverage?.officialRace === "complete" ? 1 : 0;
		venue.completeResultCount += record.coverage?.officialResult === "complete" ? 1 : 0;
		venue.completeExhibitionCount += record.coverage?.officialExhibition === "complete" ? 1 : 0;
		venueMap.set(record.venueCode, venue);
	}
	write(`public/data/boatrace-ex/coverage/${date}.json`, { ...existing, generatedAt: history.generatedAt, sourceFiles: history.sourceFiles, totals: { venues: venueMap.size, races: records.length }, fieldTotals, venues: [...venueMap.values()].sort((a, b) => String(a.venueCode).localeCompare(String(b.venueCode))) });
}

console.log(JSON.stringify({ ok: true, dateCount: dates.length, dates }, null, 2));
