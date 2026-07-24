import fs from "node:fs";
import path from "node:path";

const [, , inputPath, ...args] = process.argv;
const expectedDateIndex = args.indexOf("--expected-date");
const expectedDateArgument = expectedDateIndex >= 0 ? args[expectedDateIndex + 1] : null;
const mojibakePattern = /[\u95c3\u87bb\u6fc2\u7e72\uf8f0\u90b1\u9036\u9aad\u8b5b\u83a8\u8b01\u7e3a\u7e67\u8373\u873f\u86ef\u87f7\u83a0]/u;
const disallowedControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

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

function findInvalidText(value, location = "payload") {
	if (typeof value === "string") {
		const controlCharacter = value.match(disallowedControlPattern)?.[0];
		if (controlCharacter) {
			return `${location} contains a disallowed control character U+${controlCharacter.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
		}

		const mojibakeCharacter = value.match(mojibakePattern)?.[0];
		if (mojibakeCharacter) {
			return `${location} contains possible mojibake character: ${mojibakeCharacter}`;
		}

		return null;
	}

	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index += 1) {
			const issue = findInvalidText(value[index], `${location}[${index}]`);
			if (issue) return issue;
		}
		return null;
	}

	if (value && typeof value === "object") {
		for (const [key, nestedValue] of Object.entries(value)) {
			const issue = findInvalidText(nestedValue, `${location}.${key}`);
			if (issue) return issue;
		}
	}

	return null;
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

let payload;
try {
	payload = JSON.parse(raw);
} catch (error) {
	fail(`Invalid JSON: ${error.message}`);
}

if (!Array.isArray(payload?.records) || payload.records.length <= 0) {
	fail("records must be a non-empty array");
}

const firstRecord = payload.records[0];
const firstPredictionText = String(firstRecord?.predictionText ?? firstRecord?.johnsonText ?? "").trim();
const textIssue = findInvalidText(payload);
if (textIssue) {
	console.error(`[check:boat-johnson-predictions-json] firstPredictionText: ${firstPredictionText.slice(0, 160).replace(/\r?\n/g, "\\n")}`);
	fail(textIssue);
}

const expectedDate = expectedDateArgument ?? getJstDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate)) {
	fail(`Invalid expected date: ${expectedDate}`);
}

const dates = [...new Set(payload.records.map((record) => String(record?.date ?? "")))].sort();
if (dates.length !== 1 || dates[0] !== expectedDate) {
	fail(`records must contain only ${expectedDate}; found ${dates.join(", ") || "no date"}`);
}

if (!firstPredictionText) {
	fail("first record is missing predictionText");
}

const readabilitySignals = [
	/\u65e5\u4ed8|\d{4}-\d{2}-\d{2}/u,
	/\u4f1a\u5834|\u7af6\u8247\u5834/u,
	/\b\d{1,2}R\b|R\s*:/u,
	/\u51fa\u8d70\u8868/u,
	/\u53f7\u8247/u,
	/\u767b\u9332\u756a\u53f7/u,
	/\bsource\b/iu,
	/\u8cb7\u3044\u76ee/u,
];
const readabilitySignalCount = readabilitySignals.filter((pattern) => pattern.test(firstPredictionText)).length;
if (readabilitySignalCount < 2) {
	fail(`first predictionText is not readable enough; expected at least two boat prediction labels, found ${readabilitySignalCount}`);
}

console.log(JSON.stringify({
	ok: true,
	path: filePath,
	recordCount: payload.records.length,
	dates,
	readabilitySignalCount,
	firstPredictionText: firstPredictionText.slice(0, 160).replace(/\r?\n/g, "\\n"),
}, null, 2));
