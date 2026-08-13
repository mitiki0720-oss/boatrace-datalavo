import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
export const writeJson = (relativePath, value) => {
	const target = path.join(repoRoot, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
export const asArray = (value) => Array.isArray(value) ? value : [];
export const asText = (value) => value === null || value === undefined ? "" : String(value).trim();
export const numberValue = (value) => {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	const match = asText(value).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/u)?.[0];
	const number = match ? Number(match) : NaN;
	return Number.isFinite(number) ? number : null;
};
export const percent = (part, total) => total > 0 ? Math.round((part / total) * 10000) / 10000 : null;
export const increment = (record, key, amount = 1) => { record[key] = (record[key] ?? 0) + amount; };
export const emptyCourseCounts = () => ({ "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 });
export const courseRates = (counts, total) => Object.fromEntries(Object.entries(counts).map(([key, count]) => [key, percent(count, total)]));
export const raceBand = (raceNo) => {
	const value = Number(raceNo);
	if (value >= 1 && value <= 4) return "1R-4R";
	if (value >= 5 && value <= 8) return "5R-8R";
	if (value >= 9 && value <= 12) return "9R-12R";
	return "unknown";
};
export const halfBand = (raceNo) => Number(raceNo) <= 6 ? "1R-6R" : "7R-12R";
export const parseTrifectaPayout = (result) => {
	const row = asArray(result?.payout).find((item) => /3連単|三連単/u.test(asText(item?.betType)));
	return numberValue(row?.payoutYen);
};
export const firstCourse = (record) => {
	const value = Number(asArray(record?.officialResult?.finishOrder)[0]);
	return value >= 1 && value <= 6 ? String(value) : null;
};
export function loadHistory() {
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const dates = asArray(index.availableDates).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
	const records = dates.flatMap((date) => asArray(readJson(`public/data/boatrace-ex/history/races/${date}.json`).records));
	return { index, dates, records, dateRange: { from: dates[0], to: dates.at(-1), dateCount: dates.length } };
}
export function updateManifest(entries, generatedAt) {
	const manifestPath = "public/data/boatrace-ex/derived/manifest.generated.json";
	const existing = readJson(manifestPath);
	const targets = new Set(entries.map((entry) => entry.path));
	const files = asArray(existing.files).filter((file) => !targets.has(file?.path));
	files.push(...entries);
	writeJson(manifestPath, { ...existing, generatedAt, files });
}
export const readiness = (raceCount, min = 30) => raceCount >= min
	? { status: "ready", minRaceCount: min }
	: raceCount > 0 ? { status: "low-sample", minRaceCount: min }
	: { status: "missing", minRaceCount: min };
