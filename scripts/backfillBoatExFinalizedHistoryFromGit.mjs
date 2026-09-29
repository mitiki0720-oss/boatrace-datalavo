import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DETAIL_PATH = "public/data/boatrace/today-race-details.generated.json";
const SOURCE_PATHS = [
	DETAIL_PATH,
	"public/data/boatrace/today.generated.json",
	"public/data/boatrace/venue-extras.generated.json",
];

function valueAfter(flag, fallback = null) {
	const index = process.argv.indexOf(flag);
	return index >= 0 ? process.argv[index + 1] : fallback;
}

const fromDate = valueAfter("--from", "0000-00-00");
const toDate = valueAfter("--to", "9999-99-99");
const dryRun = process.argv.includes("--dry-run");
const maxDates = Number(valueAfter("--max-dates", "0"));

function addUtcDays(date, amount) {
	const value = new Date(`${date}T00:00:00Z`);
	value.setUTCDate(value.getUTCDate() + amount);
	return value.toISOString().slice(0, 10);
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function resultCoverage(feed) {
	const races = (feed.venues ?? []).flatMap((venue) => venue.races ?? []);
	const resultCount = races.filter((race) => Array.isArray(race.result?.finishOrder) && race.result.finishOrder.length >= 3).length;
	const payoutCount = races.filter((race) => {
		const payouts = race.result?.payoutsFull ?? race.result?.payouts ?? [];
		return payouts.some((item) => String(item?.betType ?? item?.type ?? "").includes("3連単") && /\d/u.test(String(item?.payoutYen ?? item?.payout ?? item?.amount ?? "")));
	}).length;
	return { raceCount: races.length, resultCount, payoutCount };
}

function historyCoverage(date) {
	const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
	const records = history.records ?? [];
	return {
		raceCount: records.length,
		resultCount: records.filter((record) => (record.officialResult?.finishOrder ?? []).length >= 3).length,
		payoutCount: records.filter((record) => (record.officialResult?.payout ?? []).some((item) => String(item?.betType ?? "").includes("3連単") && /\d/u.test(String(item?.payoutYen ?? "")))).length,
	};
}

function gitText(revision, relativePath) {
	try {
		return execFileSync("git", ["show", `${revision}:${relativePath}`], { cwd: root, encoding: "utf8", maxBuffer: 40 * 1024 * 1024 });
	} catch {
		return null;
	}
}

function better(left, right) {
	if (!left) return right;
	if (right.coverage.resultCount !== left.coverage.resultCount) return right.coverage.resultCount > left.coverage.resultCount ? right : left;
	if (right.coverage.payoutCount !== left.coverage.payoutCount) return right.coverage.payoutCount > left.coverage.payoutCount ? right : left;
	return right.coverage.raceCount > left.coverage.raceCount ? right : left;
}

function run(script, args) {
	let lastResult;
	for (let attempt = 1; attempt <= 3; attempt += 1) {
		const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
		if (result.status === 0) return result.stdout.trim();
		lastResult = result;
		if (attempt < 3) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * attempt);
	}
	throw new Error(`${script} failed\n${lastResult?.stderr || lastResult?.stdout}`);
}

const index = readJson("public/data/boatrace-ex/index.generated.json");
const targetDates = (index.availableDates ?? []).filter((date) => date >= fromDate && date <= toDate);
const targetSet = new Set(targetDates);
if (!dryRun) {
	for (const date of targetDates) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const baselineRaw = gitText("HEAD", historyPath);
		if (!baselineRaw) continue;
		const baseline = JSON.parse(baselineRaw);
		const current = readJson(historyPath);
		const merged = new Map((baseline.records ?? []).map((record) => [record.raceKey, record]));
		for (const record of current.records ?? []) merged.set(record.raceKey, record);
		if (merged.size === (current.records ?? []).length) continue;
		current.records = [...merged.values()].sort((left, right) => String(left.venueCode).localeCompare(String(right.venueCode)) || Number(left.raceNo) - Number(right.raceNo));
		current.sourceFiles = [...new Map([...(baseline.sourceFiles ?? []), ...(current.sourceFiles ?? [])].map((source) => [`${source.sourcePath}:${source.generatedAt ?? ""}`, source])).values()];
		fs.writeFileSync(path.join(root, historyPath), `${JSON.stringify(current, null, 2)}\n`, "utf8");
		run("scripts/regenerateBoatExDateCoverage.mjs", ["--date", date]);
	}
}
const revisions = execFileSync("git", [
	"log",
	"--format=%H",
	`--since=${fromDate}T00:00:00+09:00`,
	`--until=${addUtcDays(toDate, 2)}T23:59:59+09:00`,
	"--",
	DETAIL_PATH,
], { cwd: root, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
	.trim().split(/\s+/u).filter(Boolean);
const bestByDate = new Map();

for (const revision of revisions) {
	const raw = gitText(revision, DETAIL_PATH);
	if (!raw) continue;
	let feed;
	try { feed = JSON.parse(raw); } catch { continue; }
	if (!targetSet.has(feed.date)) continue;
	const candidate = { revision, feed, coverage: resultCoverage(feed) };
	bestByDate.set(feed.date, better(bestByDate.get(feed.date), candidate));
}

const candidates = targetDates.flatMap((date) => {
	const current = historyCoverage(date);
	const best = bestByDate.get(date);
	if (!best || best.coverage.resultCount <= current.resultCount) return [];
	return [{ date, current, best }];
});
const selected = maxDates > 0 ? candidates.slice(0, maxDates) : candidates;
const changedDates = [];

for (const candidate of selected) {
	if (dryRun) continue;
	const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `boat-ex-backfill-${candidate.date}-`));
	try {
		for (const sourcePath of SOURCE_PATHS) {
			const raw = gitText(candidate.best.revision, sourcePath);
			if (raw) fs.writeFileSync(path.join(tempDir, path.basename(sourcePath)), raw, "utf8");
		}
		if (!fs.existsSync(path.join(tempDir, "today.generated.json"))) {
			fs.copyFileSync(path.join(tempDir, "today-race-details.generated.json"), path.join(tempDir, "today.generated.json"));
		}
		if (!fs.existsSync(path.join(tempDir, "venue-extras.generated.json"))) {
			fs.writeFileSync(path.join(tempDir, "venue-extras.generated.json"), `${JSON.stringify({ date: candidate.date, generatedAt: candidate.best.feed.generatedAt, venues: [] }, null, 2)}\n`, "utf8");
		}
		run("scripts/generateBoatExHistory.mjs", ["--date", candidate.date, "--input-dir", tempDir, "--source-revision", candidate.best.revision, "--merge-existing"]);
		run("scripts/regenerateBoatExDateCoverage.mjs", ["--date", candidate.date]);
		run("scripts/generateBoatExVenueEvidence.mjs", ["--date", candidate.date]);
		run("scripts/generateBoatExRacerEvidence.mjs", ["--date", candidate.date]);
		changedDates.push(candidate.date);
	} finally {
		fs.rmSync(tempDir, { recursive: true, force: true });
	}
}

console.log(JSON.stringify({
	ok: true,
	dryRun,
	fromDate,
	toDate,
	scannedRevisionCount: revisions.length,
	eligibleDateCount: candidates.length,
	changedDates,
	candidates: candidates.map(({ date, current, best }) => ({ date, current, selected: best.coverage, revision: best.revision })),
}, null, 2));
