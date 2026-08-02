import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const args = process.argv.slice(2);
const readOption = (name, fallback) => {
	const index = args.indexOf(name);
	if (index < 0) return fallback;
	const value = args[index + 1];
	if (!value || value.startsWith("--")) throw new Error(`${name} requires YYYY-MM-DD`);
	return value;
};
const fromDate = readOption("--from", "2026-07-20");
const throughDate = readOption("--through", "2026-08-02");
const dryRun = args.includes("--dry-run");

if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(throughDate) || fromDate > throughDate) {
	throw new Error("--from and --through must be an ordered YYYY-MM-DD range");
}

const historySourcePaths = [
	"public/data/boatrace/today.generated.json",
	"public/data/boatrace/today-race-details.generated.json",
	"public/data/boatrace/venue-extras.generated.json",
];
const schedulePath = "public/data/boatrace/upcoming-schedule.generated.json";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
const writeJson = (relativePath, value) => fs.writeFileSync(path.join(rootDir, relativePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
const writeText = (relativePath, value) => fs.writeFileSync(path.join(rootDir, relativePath), value, "utf8");

const collectExplicitDates = (value, dates = new Set()) => {
	if (Array.isArray(value)) {
		value.forEach((item) => collectExplicitDates(item, dates));
		return dates;
	}
	if (!value || typeof value !== "object") return dates;
	for (const [key, item] of Object.entries(value)) {
		if (/^(date|sessionDate|generatedFor|startDate)$/i.test(key) && typeof item === "string" && datePattern.test(item.slice(0, 10))) {
			dates.add(item.slice(0, 10));
		}
		collectExplicitDates(item, dates);
	}
	return dates;
};

const readDates = (relativePath) => {
	const absolutePath = path.join(rootDir, relativePath);
	if (!fs.existsSync(absolutePath)) return { sourcePath: relativePath, exists: false, dates: [] };
	return { sourcePath: relativePath, exists: true, dates: [...collectExplicitDates(readJson(relativePath))].sort() };
};

const runNode = (script, scriptArgs) => {
	const result = spawnSync(process.execPath, [script, ...scriptArgs], { cwd: rootDir, encoding: "utf8" });
	const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
	let parsed = null;
	try { parsed = JSON.parse(result.stdout); } catch {}
	return { ok: result.status === 0, status: result.status ?? 1, output, parsed };
};

const index = readJson("public/data/boatrace-ex/index.generated.json");
const historySourceCoverage = historySourcePaths.map(readDates);
const scheduleCoverage = readDates(schedulePath);
const historyCandidateDates = [...new Set(historySourceCoverage.flatMap((source) => source.dates))].sort();
const scheduleOnlyDates = scheduleCoverage.dates.filter((date) => !historyCandidateDates.includes(date));
const existingDates = Array.isArray(index.availableDates) ? index.availableDates : [];
const candidates = historyCandidateDates.filter((date) => date >= fromDate && date <= throughDate);
const skippedExistingDates = candidates.filter((date) => existingDates.includes(date));
const pendingDates = candidates.filter((date) => !existingDates.includes(date));
const rejectedDates = [];
const eligibleDates = [];

for (const date of pendingDates) {
	const check = runNode("scripts/generateBoatExDaily.mjs", ["--date", date, "--dry-run"]);
	const history = check.parsed?.history;
	if (!check.ok || !(Number(history?.records) > 0) || !(Number(history?.venues) > 0)) {
		rejectedDates.push({ date, reason: "history dry-run did not produce non-empty source-backed history", status: check.status, output: check.output });
		continue;
	}
	eligibleDates.push({ date, records: Number(history.records), venues: Number(history.venues) });
}

const generatedDates = [];
if (!dryRun) {
	for (const candidate of eligibleDates) {
		const generated = runNode("scripts/generateBoatExDaily.mjs", ["--date", candidate.date]);
		if (!generated.ok) {
			throw new Error(`Backfill failed for ${candidate.date}: ${generated.output}`);
		}
		const check = runNode("scripts/checkBoatExDaily.mjs", ["--date", candidate.date]);
		if (!check.ok) {
			throw new Error(`Backfill checker failed for ${candidate.date}: ${check.output}`);
		}
		generatedDates.push(candidate.date);
	}
}

const report = {
	schemaVersion: 1,
	kind: "boatrace-ex-history-backfill-coverage",
	generatedAt: new Date().toISOString(),
	range: { fromDate, throughDate },
	sourceFiles: ["public/data/boatrace-ex/index.generated.json", ...historySourcePaths, schedulePath],
	historySourceCoverage,
	scheduleOnlyDates,
	existingDates,
	candidates,
	skippedExistingDates,
	eligibleDates,
	generatedDates,
	rejectedDates,
	warnings: [
		...(scheduleOnlyDates.filter((date) => date >= fromDate && date <= throughDate).length > 0 ? ["Schedule-only dates are not history backfill candidates because official race detail input is absent."] : []),
		...(candidates.length === 0 ? ["No ungenerated date in the requested range has explicit official history-source coverage."] : []),
	],
	registrationSafety: {
		policy: "The daily generator preserves only explicit official registrationNumber values. Missing values remain unverified; this runner never infers or fuzzy-matches identities.",
		generatedDateCount: generatedDates.length,
	},
};

const reportPath = `public/data/boatrace-ex/audit/history-backfill-${throughDate}.generated.json`;
const markdownPath = `docs/boat-ex/history-backfill-${throughDate}.md`;
const markdown = `# Boat EX Safe History Backfill (${fromDate} to ${throughDate})\n\n` +
	`## Source Rule\n\n` +
	`A date is eligible only when an official history input file explicitly contains that date and the existing daily generator dry-run returns non-empty history. Schedule-only dates are not eligible. Existing EX history dates are never regenerated.\n\n` +
	`## Result\n\n` +
	`- existing dates: ${existingDates.join(", ") || "none"}\n` +
	`- official history-source candidates in range: ${candidates.join(", ") || "none"}\n` +
	`- generated dates: ${generatedDates.join(", ") || "none"}\n` +
	`- skipped existing dates: ${skippedExistingDates.join(", ") || "none"}\n` +
	`- rejected dates: ${rejectedDates.map((item) => item.date).join(", ") || "none"}\n\n` +
	`## Registration Identity Safety\n\n` +
	`Only explicit official registrationNumber values are retained. No name-only matching, fuzzy matching, guessed registration number, or placeholder identity is allowed. Missing values remain unresolved and are reported by the registration coverage audit.\n`;

if (!dryRun) {
	fs.mkdirSync(path.dirname(path.join(rootDir, reportPath)), { recursive: true });
	fs.mkdirSync(path.dirname(path.join(rootDir, markdownPath)), { recursive: true });
	writeJson(reportPath, report);
	writeText(markdownPath, markdown);
}

console.log(JSON.stringify({ ok: true, dryRun, reportPath, markdownPath, ...report.range, candidates, eligibleDates, generatedDates, skippedExistingDates, rejectedDates, warnings: report.warnings }, null, 2));
