import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const allowEmpty = args.has("--allow-empty");

const outputPath = "public/data/boatrace-ex/index.generated.json";
const scanTargets = {
	history: "public/data/boatrace-ex/history/races",
	coverage: "public/data/boatrace-ex/coverage",
	venueEvidence: "public/data/boatrace-ex/derived/venue-evidence",
	racerEvidence: "public/data/boatrace-ex/derived/racer-evidence",
};

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function listDates(relativeDir) {
	const dir = absolute(relativeDir);
	if (!fs.existsSync(dir)) return [];
	return fs
		.readdirSync(dir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
		.map((entry) => entry.name.slice(0, -5));
}

function hasFile(relativePath) {
	return fs.existsSync(absolute(relativePath));
}

function availableFile(relativePath) {
	return hasFile(relativePath) ? { path: relativePath, status: "available" } : { path: relativePath, status: "missing" };
}

function historyInfo(date) {
	const relativePath = `${scanTargets.history}/${date}.json`;
	if (!hasFile(relativePath)) return availableFile(relativePath);
	const file = readJson(relativePath);
	const records = Array.isArray(file.records) ? file.records : [];
	const venueCodes = new Set(records.map((record) => record?.venueCode).filter(Boolean));
	return {
		path: relativePath,
		status: "available",
		recordCount: records.length,
		venueCount: venueCodes.size,
	};
}

function venueEvidenceInfo(date) {
	const relativePath = `${scanTargets.venueEvidence}/${date}.json`;
	if (!hasFile(relativePath)) return availableFile(relativePath);
	const file = readJson(relativePath);
	return {
		path: relativePath,
		status: "available",
		venueCount: file.summary?.venueCount ?? null,
		recordCount: file.summary?.recordCount ?? null,
	};
}

function racerEvidenceInfo(date) {
	const relativePath = `${scanTargets.racerEvidence}/${date}.json`;
	if (!hasFile(relativePath)) return availableFile(relativePath);
	const file = readJson(relativePath);
	return {
		path: relativePath,
		status: "available",
		racerCount: file.summary?.racerCount ?? null,
		appearanceCount: file.summary?.appearanceCount ?? null,
	};
}

function makeWarnings(dateEntry) {
	const warnings = [];
	if (dateEntry.coverage.status !== "available") warnings.push("coverage missing");
	if (dateEntry.venueEvidence.status !== "available") warnings.push("venue evidence missing");
	if (dateEntry.racerEvidence.status !== "available") warnings.push("racer evidence missing");
	return warnings;
}

function countAvailable(dates, key) {
	return dates.filter((dateEntry) => dateEntry[key]?.status === "available").length;
}

const historyDates = listDates(scanTargets.history);
const coverageDates = listDates(scanTargets.coverage);
const venueEvidenceDates = listDates(scanTargets.venueEvidence);
const racerEvidenceDates = listDates(scanTargets.racerEvidence);

const availableDates = [...new Set(historyDates)].sort();

if (availableDates.length === 0 && !allowEmpty) {
	console.error("No BOATRACE EX history dates found. Refusing to generate an empty date index without --allow-empty.");
	process.exit(1);
}

const allDates = [...new Set([...historyDates, ...coverageDates, ...venueEvidenceDates, ...racerEvidenceDates])].sort();
const dates = allDates.map((date) => {
	const entry = {
		date,
		history: historyInfo(date),
		coverage: availableFile(`${scanTargets.coverage}/${date}.json`),
		venueEvidence: venueEvidenceInfo(date),
		racerEvidence: racerEvidenceInfo(date),
		readiness: {
			multiDayAnalysis: "insufficient-history",
			venueBias: "insufficient-history",
			roughIndex: "insufficient-history",
			racerProfile: "insufficient-history",
			todayFlow: "pending",
			predictionSignals: "pending",
		},
		warnings: [],
	};
	entry.warnings = makeWarnings(entry);
	return entry;
});

const index = {
	schemaVersion: 1,
	kind: "boatrace-ex-date-index",
	generatedAt: new Date().toISOString(),
	latestDate: availableDates.at(-1) ?? null,
	availableDates,
	summary: {
		dateCount: availableDates.length,
		historyDateCount: countAvailable(dates, "history"),
		coverageDateCount: countAvailable(dates, "coverage"),
		venueEvidenceDateCount: countAvailable(dates, "venueEvidence"),
		racerEvidenceDateCount: countAvailable(dates, "racerEvidence"),
	},
	dates,
};

if (dryRun) {
	console.log(JSON.stringify(index, null, 2));
	if (availableDates.length === 0 && !allowEmpty) process.exit(1);
} else {
	fs.mkdirSync(path.dirname(absolute(outputPath)), { recursive: true });
	fs.writeFileSync(absolute(outputPath), `${JSON.stringify(index, null, 2)}\n`);
	console.log(`Wrote ${outputPath} (${availableDates.length} dates).`);
}
