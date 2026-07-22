import fs from "node:fs";
import path from "node:path";

const [, , inputPath, ...args] = process.argv;
const expectedDateIndex = args.indexOf("--expected-date");
const expectedDateArgument = expectedDateIndex >= 0 ? args[expectedDateIndex + 1] : null;
const mojibakeMarkers = ["荳", "縺", "譁", "莠"];

function getJstDate() {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

function fail(message) {
	console.error(`[check:boat-johnson-predictions-json] ${message}`);
	process.exit(1);
}

if (!inputPath) {
	fail("Usage: node scripts/checkBoatJohnsonPredictionsJson.mjs <path> [--expected-date YYYY-MM-DD]");
}

const filePath = path.resolve(inputPath);
if (!fs.existsSync(filePath)) {
	fail(`File not found: ${filePath}`);
}

const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
if (/<<<<<<<|=======|>>>>>>>/.test(raw)) {
	fail("Git conflict marker found");
}

const mojibakeMarker = mojibakeMarkers.find((marker) => raw.includes(marker));
if (mojibakeMarker) {
	fail(`Possible mojibake marker found: ${mojibakeMarker}`);
}

let payload;
try {
	payload = JSON.parse(raw);
} catch (error) {
	fail(`Invalid JSON: ${error.message}`);
}

if (!Array.isArray(payload?.records) || payload.records.length <= 0) {
	fail("records must be a non-empty array");
}

const expectedDate = expectedDateArgument ?? getJstDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) {
	fail(`Invalid expected date: ${expectedDate}`);
}

const dates = [...new Set(payload.records.map((record) => String(record?.date ?? "")))].sort();
if (dates.length !== 1 || dates[0] !== expectedDate) {
	fail(`records must contain only ${expectedDate}; found ${dates.join(", ") || "no date"}`);
}

const firstRecord = payload.records[0];
const firstPredictionText = String(firstRecord?.predictionText ?? firstRecord?.johnsonText ?? "").trim();
if (!firstPredictionText) {
	fail("first record is missing predictionText");
}

console.log(JSON.stringify({
	ok: true,
	path: filePath,
	recordCount: payload.records.length,
	dates,
	firstPredictionText: firstPredictionText.slice(0, 160).replace(/\r?\n/g, "\\n"),
}, null, 2));
