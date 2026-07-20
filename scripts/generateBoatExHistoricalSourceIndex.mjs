import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const INDEX_PATH = "public/data/boatrace-ex/source/historical-sources.generated.json";
const COVERAGE_PATH = "public/data/boatrace-ex/derived/history-coverage/latest.json";
const DATE_PATTERN = /\b(20\d{2}-\d{2}-\d{2})\b/;
const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const VENUES = [
	["01", "桐生"], ["02", "戸田"], ["03", "江戸川"], ["04", "平和島"], ["05", "多摩川"], ["06", "浜名湖"],
	["07", "蒲郡"], ["08", "常滑"], ["09", "津"], ["10", "三国"], ["11", "びわこ"], ["12", "住之江"],
	["13", "尼崎"], ["14", "鳴門"], ["15", "丸亀"], ["16", "児島"], ["17", "宮島"], ["18", "徳山"],
	["19", "下関"], ["20", "若松"], ["21", "芦屋"], ["22", "福岡"], ["23", "唐津"], ["24", "大村"],
];
const venueByName = new Map(VENUES.map(([code, name]) => [name, { code, name }]));
const venueByCode = new Map(VENUES.map(([code, name]) => [code, { code, name }]));
const VENUE_FILE_ALIASES = new Map([
	["kiryu", "桐生"], ["toda", "戸田"], ["edogawa", "江戸川"], ["heiwajima", "平和島"], ["tamagawa", "多摩川"], ["hamanako", "浜名湖"],
	["gamagori", "蒲郡"], ["tokoname", "常滑"], ["tsu", "津"], ["mikuni", "三国"], ["biwako", "びわこ"], ["suminoe", "住之江"],
	["amagasaki", "尼崎"], ["naruto", "鳴門"], ["marugame", "丸亀"], ["kojima", "児島"], ["miyajima", "宮島"], ["tokuyama", "徳山"],
	["shimonoseki", "下関"], ["wakamatsu", "若松"], ["ashiya", "芦屋"], ["fukuoka", "福岡"], ["karatsu", "唐津"], ["omura", "大村"],
]);

function toPosix(relativePath) {
	return relativePath.split(path.sep).join("/");
}

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function isDate(value) {
	return typeof value === "string" && /^20\d{2}-\d{2}-\d{2}$/.test(value);
}

function collectMetadata(value, depth = 0, output = { dates: [], venueNames: [], venueCodes: [] }) {
	if (depth > 3 || !value || typeof value !== "object") return output;
	if (Array.isArray(value)) {
		for (const item of value.slice(0, 48)) collectMetadata(item, depth + 1, output);
		return output;
	}
	for (const [key, item] of Object.entries(value)) {
		if (["date", "targetDate", "latestDate", "sessionDate", "generatedFor"].includes(key) && isDate(item)) output.dates.push(item);
		if (["venueName", "venue", "stadiumName"].includes(key) && typeof item === "string") output.venueNames.push(item.trim());
		if (["venueCode", "venueId", "jcd"].includes(key) && typeof item === "string") output.venueCodes.push(item.trim().padStart(2, "0"));
		collectMetadata(item, depth + 1, output);
	}
	return output;
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}

function resolveSourceRoot() {
	if (process.env.BOAT_EX_HISTORICAL_SOURCE_ROOT) return path.resolve(process.env.BOAT_EX_HISTORICAL_SOURCE_ROOT);
	const candidates = [
		repoRoot,
		path.resolve(repoRoot, "..", "boatrace-datalavo"),
	];
	return candidates
		.map((candidate) => ({
			candidate,
			score: walkFiles(path.join(candidate, "public", "data", "reviews")).length + walkFiles(path.join(candidate, "public", "dog")).length,
		}))
		.sort((left, right) => right.score - left.score)[0]?.candidate ?? repoRoot;
}

function walkFiles(directory) {
	if (!fs.existsSync(directory)) return [];
	const files = [];
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const filePath = path.join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walkFiles(filePath));
		else if (entry.isFile()) files.push(filePath);
	}
	return files;
}

function sourceInfo(relativePath) {
	if (relativePath.startsWith("public/data/reviews/")) {
		return {
			sourceType: path.extname(relativePath).toLowerCase() === ".json" ? "review-json" : "review-text",
			sourceKind: "prediction-review",
		};
	}
	if (relativePath.startsWith("public/dog/")) return { sourceType: "dog-image", sourceKind: "venue-image" };
	if (relativePath.startsWith("public/data/boatrace/")) return { sourceType: "boatrace-generated-json", sourceKind: "daily-generated" };
	if (relativePath.startsWith("public/data/boatrace-ex/")) return { sourceType: "boatrace-ex-derived-json", sourceKind: "derived-ex" };
	return { sourceType: "unknown", sourceKind: "unknown" };
}

function readJsonMetadata(filePath) {
	try {
		return { parsedStatus: "parsed", metadata: collectMetadata(JSON.parse(fs.readFileSync(filePath, "utf8"))), warnings: [] };
	} catch {
		return { parsedStatus: "invalid-json", metadata: { dates: [], venueNames: [], venueCodes: [] }, warnings: ["JSONを解析できませんでした。"] };
	}
}

function resolveVenueFromFileName(fileName) {
	const lowerName = fileName.toLowerCase();
	const matches = [...VENUE_FILE_ALIASES.entries()]
		.filter(([alias]) => lowerName.includes(alias))
		.map(([, venueName]) => venueByName.get(venueName));
	return matches.length === 1 ? matches[0] : null;
}

function buildEntry(sourceRoot, filePath) {
	const relativePath = toPosix(path.relative(sourceRoot, filePath));
	const extension = path.extname(filePath).toLowerCase();
	const pathParts = relativePath.split("/");
	const info = sourceInfo(relativePath);
	const warnings = [];
	const isJson = extension === ".json";
	const parsed = isJson ? readJsonMetadata(filePath) : { parsedStatus: "not-applicable", metadata: { dates: [], venueNames: [], venueCodes: [] }, warnings: [] };
	warnings.push(...parsed.warnings);
	const pathDate = relativePath.match(DATE_PATTERN)?.[1] ?? (relativePath.startsWith("public/data/reviews/") ? pathParts[3] : null);
	const jsonDates = unique(parsed.metadata.dates.filter(isDate));
	const dates = unique([pathDate, ...jsonDates].filter(isDate));
	const date = pathDate && isDate(pathDate) ? pathDate : jsonDates.length === 1 ? jsonDates[0] : null;
	if (!pathDate && jsonDates.length > 1) warnings.push("日付候補が複数あるため未解決です。");
	if (!date) warnings.push("日付を特定できません。");

	const dogVenueName = relativePath.startsWith("public/dog/") ? pathParts[2] : null;
	const venueNames = dogVenueName ? [dogVenueName] : unique(parsed.metadata.venueNames);
	const venueCodes = unique(parsed.metadata.venueCodes);
	const namedVenue = venueNames.length === 1 ? venueByName.get(venueNames[0]) ?? null : null;
	const codedVenue = venueCodes.length === 1 ? venueByCode.get(venueCodes[0]) ?? null : null;
	const fileNameVenue = resolveVenueFromFileName(path.basename(filePath));
	const venue = namedVenue && codedVenue && namedVenue.code !== codedVenue.code
		? null
		: namedVenue ?? codedVenue ?? fileNameVenue;
	if (namedVenue && codedVenue && namedVenue.code !== codedVenue.code) warnings.push("会場名と会場コードが一致しません。");
	if (!venue) warnings.push("会場を特定できません。");

	const stats = fs.statSync(filePath);
	return {
		sourceId: `${info.sourceType}:${relativePath}`,
		sourceType: info.sourceType,
		sourceKind: info.sourceKind,
		date,
		venueName: venue?.name ?? null,
		venueCode: venue?.code ?? null,
		relativePath,
		fileName: path.basename(filePath),
		extension,
		sizeBytes: stats.size,
		mtime: stats.mtime.toISOString(),
		parsedStatus: parsed.parsedStatus,
		warnings,
	};
}

function summarize(sources, generatedAt) {
	const dates = unique(sources.map((source) => source.date)).sort();
	const venueNames = unique(sources.map((source) => source.venueName)).sort((left, right) => left.localeCompare(right, "ja"));
	const unresolvedSourceCount = sources.filter((source) => source.parsedStatus === "invalid-json" || !source.date || !source.venueCode).length;
	const count = (type) => sources.filter((source) => source.sourceType === type).length;
	const warnings = [];
	if (unresolvedSourceCount > 0) warnings.push(`日付または会場が未解決の素材が ${unresolvedSourceCount} 件あります。`);
	return {
		schemaVersion: "boat-ex-history-coverage-v1",
		kind: "boatrace-ex-history-coverage",
		ok: true,
		generatedAt,
		sourceIndexPath: INDEX_PATH,
		dateFrom: dates.at(0) ?? null,
		dateTo: dates.at(-1) ?? null,
		dateCount: dates.length,
		venueCount: venueNames.length,
		venueNames,
		sourceCount: sources.length,
		reviewFileCount: count("review-text") + count("review-json"),
		dogImageCount: count("dog-image"),
		boatraceGeneratedJsonCount: count("boatrace-generated-json"),
		boatraceExDerivedJsonCount: count("boatrace-ex-derived-json"),
		unresolvedSourceCount,
		warnings,
	};
}

function writeJson(relativePath, value) {
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJsonIfPresent(relativePath) {
	const filePath = absolute(relativePath);
	if (!fs.existsSync(filePath)) return null;
	try {
		return JSON.parse(fs.readFileSync(filePath, "utf8"));
	} catch {
		return null;
	}
}

function shouldPreserveExistingCoverage(existingCoverage, scannedCoverage, force) {
	if (force || !existingCoverage || typeof existingCoverage.sourceCount !== "number" || typeof existingCoverage.dateCount !== "number") return false;
	return scannedCoverage.sourceCount < existingCoverage.sourceCount
		|| scannedCoverage.dateCount < existingCoverage.dateCount;
}

function main() {
	const force = process.argv.includes("--force");
	const existingCoverage = readJsonIfPresent(COVERAGE_PATH);
	const sourceRoot = resolveSourceRoot();
	const roots = [
		"public/data/reviews",
		"public/dog",
		"public/data/boatrace",
		"public/data/boatrace-ex",
	];
	const files = roots.flatMap((relativeRoot) => walkFiles(path.join(sourceRoot, ...relativeRoot.split("/"))))
		.filter((filePath) => {
			const relativePath = toPosix(path.relative(sourceRoot, filePath));
			return ![INDEX_PATH, COVERAGE_PATH].includes(relativePath)
				&& (!relativePath.startsWith("public/dog/") || IMAGE_EXTENSIONS.has(path.extname(relativePath).toLowerCase()))
				&& (!relativePath.startsWith("public/data/boatrace/") || relativePath.endsWith(".generated.json"))
				&& (!relativePath.startsWith("public/data/boatrace-ex/") || relativePath.endsWith(".json"));
		});
	const sources = files.map((filePath) => buildEntry(sourceRoot, filePath)).sort((left, right) => left.relativePath.localeCompare(right.relativePath));
	const generatedAt = new Date().toISOString();
	const index = {
		schemaVersion: "boat-ex-historical-source-index-v1",
		kind: "boatrace-ex-historical-source-index",
		generatedAt,
		sources,
	};
	const coverage = summarize(sources, generatedAt);
	if (shouldPreserveExistingCoverage(existingCoverage, coverage, force)) {
		console.log("[historical-source-index] preserved existing index because scanned source coverage is smaller than committed coverage.");
		console.log(`existing: ${existingCoverage.sourceCount} sources / ${existingCoverage.dateCount} dates`);
		console.log(`scanned: ${coverage.sourceCount} sources / ${coverage.dateCount} dates`);
		console.log(JSON.stringify({ ok: true, preserved: true, indexPath: INDEX_PATH, coveragePath: COVERAGE_PATH, ...existingCoverage }, null, 2));
		return;
	}
	writeJson(INDEX_PATH, index);
	writeJson(COVERAGE_PATH, coverage);
	console.log(JSON.stringify({ ok: true, preserved: false, indexPath: INDEX_PATH, coveragePath: COVERAGE_PATH, ...coverage }, null, 2));
}

main();
