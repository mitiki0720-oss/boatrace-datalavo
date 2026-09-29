import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const write = process.argv.includes("--write");
const read = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const available = (value) => value !== null && value !== undefined && value !== "" && value !== "未取得" && value !== "確認中" && value !== "unknown";
const count = (records, predicate) => records.filter(predicate).length;

const index = read("public/data/boatrace-ex/index.generated.json");
const dates = (index.availableDates ?? []).map((date) => {
	const records = read(`public/data/boatrace-ex/history/races/${date}.json`).records ?? [];
	const metrics = {
		date,
		raceCount: records.length,
		officialResultComplete: count(records, (record) => (record.officialResult?.finishOrder ?? []).length >= 3),
		payoutComplete: count(records, (record) => (record.officialResult?.payout ?? []).some((item) => String(item?.betType ?? "").includes("3連単") && /\d/u.test(String(item?.payoutYen ?? "")))),
		trifectaAvailable: count(records, (record) => available(record.officialResult?.trifecta) || (record.officialResult?.payout ?? []).some((item) => String(item?.betType ?? "").includes("3連単") && available(item?.combination))),
		exhibitionComplete: count(records, (record) => record.coverage?.officialExhibition === "complete"),
		weatherAvailable: count(records, (record) => available(record.weather?.weather)),
		windAvailable: count(records, (record) => available(record.weather?.windSpeedMps)),
		waveAvailable: count(records, (record) => available(record.weather?.waveHeightCm)),
		racerComplete: count(records, (record) => (record.racer ?? []).length >= 6),
		motorComplete: count(records, (record) => record.coverage?.motor === "complete"),
		boatComplete: count(records, (record) => record.coverage?.boat === "complete"),
	};
	return { ...metrics, finalization: metrics.officialResultComplete === metrics.raceCount && metrics.payoutComplete === metrics.raceCount ? "complete" : metrics.officialResultComplete > 0 ? "partial" : "missing" };
});
const totals = Object.fromEntries(["raceCount", "officialResultComplete", "payoutComplete", "trifectaAvailable", "exhibitionComplete", "weatherAvailable", "windAvailable", "waveAvailable", "racerComplete", "motorComplete", "boatComplete"].map((key) => [key, dates.reduce((sum, item) => sum + item[key], 0)]));
const latestCompleteDate = (key) => dates.filter((item) => item.raceCount > 0 && item[key] === item.raceCount).at(-1)?.date ?? null;
const audit = {
	schemaVersion: 1,
	kind: "boat-ex-finalized-history-coverage-audit",
	generatedAt: new Date().toISOString(),
	auditDate: index.latestDate,
	dateCount: dates.length,
	dateRange: { from: dates[0]?.date ?? null, to: dates.at(-1)?.date ?? null },
	completeThrough: { result: latestCompleteDate("officialResultComplete"), payout: latestCompleteDate("payoutComplete"), weather: latestCompleteDate("weatherAvailable") },
	totals,
	dates,
	policy: "Counts only source-backed fields in committed BOATRACE EX history. Missing results, payouts, exhibition, wind, or wave values remain missing; no inference is used.",
};
const auditPath = `public/data/boatrace-ex/audit/finalized-history-coverage-${index.latestDate}.generated.json`;
if (write) writeJson(auditPath, audit);
else {
	const existing = read(auditPath);
	assert.equal(existing.kind, audit.kind);
	assert.equal(existing.auditDate, audit.auditDate);
	assert.deepEqual(existing.dateRange, audit.dateRange);
	assert.deepEqual(existing.completeThrough, audit.completeThrough);
	assert.deepEqual(existing.totals, audit.totals);
	assert.deepEqual(existing.dates, audit.dates);
}
console.log(JSON.stringify({ ok: true, auditPath, dateCount: audit.dateCount, completeThrough: audit.completeThrough, totals: audit.totals, incompleteDates: dates.filter((item) => item.finalization !== "complete") }, null, 2));
