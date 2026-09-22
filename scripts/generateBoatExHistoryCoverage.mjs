import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const OUTPUT_PATH = "public/data/boatrace-ex/derived/history-coverage/latest.json";

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function hasResult(record) {
	return Array.isArray(record?.officialResult?.finishOrder) && record.officialResult.finishOrder.length > 0;
}

function parseYen(value) {
if (typeof value === "number") {
return Number.isFinite(value) && value >= 0 ? Math.round(value) : null;
}

if (typeof value !== "string") return null;

const normalized = value
.normalize("NFKC")
.replace(/[,\s\u5186\u00A5\uFFE5]/g, "");

if (!/^\d+$/.test(normalized)) return null;

const amount = Number(normalized);
return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

function payoutTypeText(item) {
if (!item || typeof item !== "object" || Array.isArray(item)) return "";

return [item.betType, item.type, item.name]
.filter((value) => typeof value === "string")
.join(" ")
.normalize("NFKC")
.toLowerCase();
}

function isTrifectaPayout(item) {
const typeText = payoutTypeText(item);

return (
typeText.includes("3\u9023\u5358") ||
typeText.includes("\u4E09\u9023\u5358") ||
typeText.includes("trifecta")
);
}

function payoutAmount(item) {
if (!item || typeof item !== "object" || Array.isArray(item)) return null;

for (const candidate of [
item.payoutYen,
item.amount,
item.payoutAmount,
item.payout,
item.yen,
]) {
const amount = parseYen(candidate);
if (amount !== null) return amount;
}

return null;
}

function hasPayout(record) {
const payouts = Array.isArray(record?.officialResult?.payout)
? record.officialResult.payout
: [];

return payouts.some(
(item) => isTrifectaPayout(item) && payoutAmount(item) !== null,
);
}

function hasExhibition(record) {
	return Array.isArray(record?.officialExhibition?.entries) && record.officialExhibition.entries.length > 0;
}

function hasWeather(record) {
	return [record?.weather?.weather, record?.weather?.windDirection, record?.weather?.windSpeedMps, record?.weather?.waveHeightCm]
		.some((value) => value !== null && value !== undefined && value !== "");
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson(INDEX_PATH);
	const dates = index.availableDates ?? [];
	const venueMap = new Map();
	let raceCount = 0;
	let resultAvailableRaceCount = 0;
	let payoutAvailableRaceCount = 0;
	let exhibitionAvailableRaceCount = 0;
	let weatherAvailableRaceCount = 0;

	for (const date of dates) {
		const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyPath);
		for (const record of history.records ?? []) {
			raceCount += 1;
			if (hasResult(record)) resultAvailableRaceCount += 1;
			if (hasPayout(record)) payoutAvailableRaceCount += 1;
			if (hasExhibition(record)) exhibitionAvailableRaceCount += 1;
			if (hasWeather(record)) weatherAvailableRaceCount += 1;
			const venueCode = String(record.venueCode ?? "");
			if (!venueCode) continue;
			const venue = venueMap.get(venueCode) ?? {
				venueCode,
				venueName: record.venueName ?? venueCode,
				dates: new Set(),
				raceCount: 0,
			};
			venue.dates.add(date);
			venue.raceCount += 1;
			venueMap.set(venueCode, venue);
		}
	}

	const generatedAt = new Date().toISOString();
	const output = {
		schemaVersion: "boat-ex-history-coverage-v2",
		kind: "boatrace-ex-history-coverage",
		generatedAt,
		sourceIndexPath: INDEX_PATH,
		dateRange: {
			from: dates.at(0) ?? null,
			to: dates.at(-1) ?? null,
			dateCount: dates.length,
		},
		summary: {
			raceCount,
			venueCount: venueMap.size,
			resultAvailableRaceCount,
			payoutAvailableRaceCount,
			exhibitionAvailableRaceCount,
			weatherAvailableRaceCount,
		},
		venues: [...venueMap.values()]
			.map((venue) => ({
				venueCode: venue.venueCode,
				venueName: venue.venueName,
				dateCount: venue.dates.size,
				raceCount: venue.raceCount,
			}))
			.sort((left, right) => left.venueCode.localeCompare(right.venueCode)),
		readiness: {
			status: dates.length > 0 && raceCount > 0 ? "ready" : "unavailable",
			reason: dates.length > 0 && raceCount > 0
				? "All indexed BOATRACE EX history dates are represented in the coverage summary."
				: "No indexed BOATRACE EX history records are available.",
		},
		sourceFiles: [INDEX_PATH, ...dates.map((date) => `public/data/boatrace-ex/history/races/${date}.json`)],
		warnings: [],
	};

	if (!args.dryRun) {
		fs.mkdirSync(path.dirname(absolute(OUTPUT_PATH)), { recursive: true });
		fs.writeFileSync(absolute(OUTPUT_PATH), `${JSON.stringify(output, null, 2)}\n`, "utf8");
	}

	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		outputPath: OUTPUT_PATH,
		dateRange: output.dateRange,
		summary: output.summary,
		readiness: output.readiness,
	}, null, 2));
}

main();
