import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = process.cwd();
const args = process.argv.slice(2);
const valueFor = (name, fallback = null) => {
	const index = args.indexOf(name);
	if (index < 0) return fallback;
	const value = args[index + 1];
	if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
	return value;
};
const fromDate = valueFor("--from", "2026-05-24");
const toDate = valueFor("--to", "2026-08-02");
const reviewRoot = valueFor("--review-source-root");
const dogRoot = valueFor("--dog-source-root");
const maxFiles = Number(valueFor("--max-files", "0"));
const dryRun = args.includes("--dry-run") || !args.includes("--write");

if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
	throw new Error("--from and --to must be an ordered YYYY-MM-DD range");
}
if (!reviewRoot || !dogRoot) throw new Error("--review-source-root and --dog-source-root are required");
if (!fs.existsSync(reviewRoot) || !fs.statSync(reviewRoot).isDirectory()) throw new Error("review source root is not a directory");
if (!fs.existsSync(dogRoot) || !fs.statSync(dogRoot).isDirectory()) throw new Error("dog source root is not a directory");
if (!Number.isInteger(maxFiles) || maxFiles < 0) throw new Error("--max-files must be a non-negative integer");

const venueMap = {
	amagasaki: ["13", "尼崎"], ashiya: ["21", "芦屋"], biwako: ["11", "びわこ"], edogawa: ["03", "江戸川"], fukuoka: ["22", "福岡"],
	gamagori: ["07", "蒲郡"], hamanako: ["06", "浜名湖"], hamamatsu: ["06", "浜名湖"], heiwajima: ["04", "平和島"], karatsu: ["23", "唐津"], kiryu: ["01", "桐生"],
	kojima: ["16", "児島"], marugame: ["15", "丸亀"], miyajima: ["17", "宮島"], mikuni: ["10", "三国"],
	naruto: ["14", "鳴門"], omura: ["24", "大村"], shiga: ["11", "びわこ"], shimonoseki: ["19", "下関"],
	suminoe: ["12", "住之江"], tamagawa: ["05", "多摩川"], tokoname: ["08", "常滑"], toda: ["02", "戸田"],
	tokuyama: ["18", "徳山"], tsu: ["09", "津"], wakamatsu: ["20", "若松"],
};
const coverageFields = ["officialRace", "officialResult", "officialExhibition", "weather", "waterSurface", "motor", "boat", "racer", "prediction", "summary", "review", "derivedSignals"];
const ignoredText = new Set(["未取得", "未保存", "未登録", "なし", "-", "—", ""]);

const normalize = (value) => String(value ?? "").trim();
const nullable = (value) => {
	const text = normalize(value);
	return ignoredText.has(text) ? null : text;
};
const readText = (filePath) => fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
const writeJson = (relativePath, value) => {
	const absolutePath = path.join(rootDir, relativePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const listFiles = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
	const absolutePath = path.join(directory, entry.name);
	return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
});
const relativeLocator = (kind, absolutePath, basePath) => `local-readonly/${kind}/${path.relative(basePath, absolutePath).replaceAll("\\", "/")}`;
const sourceMeta = (kind, absolutePath, basePath) => {
	const sourceFetchedAt = fs.statSync(absolutePath).mtime.toISOString();
	return {
	sourceName: kind === "review-prediction" ? "local review prediction" : kind === "review-result" ? "local review result" : "local dog summary",
	sourceType: "user",
	sourcePath: relativeLocator(kind === "dog-summary" ? "dog" : "reviews", absolutePath, basePath),
	generatedAt: sourceFetchedAt,
	sourceFetchedAt,
	sourceStatus: "available",
	coverageStatus: "partial",
	provenance: "read-only local source",
};
};
const splitRaceBlocks = (text) => {
	const markers = [...text.matchAll(/^■\s*([^\n]+?)\s+(\d{1,2})R\s*$/gm)];
	return markers.map((match, index) => ({
		rawVenueName: normalize(match[1]),
		raceNo: Number(match[2]),
		text: text.slice(match.index, markers[index + 1]?.index ?? text.length),
	}));
};
const mapVenue = (slug, fallbackName) => {
	const mapped = venueMap[slug];
	if (!mapped) return { venueCode: `local-${slug}`, venueName: fallbackName || slug };
	return { venueCode: mapped[0], venueName: fallbackName || mapped[1] };
};
const parseEntries = (block) => {
	const entries = new Map();
	for (const match of block.matchAll(/^([1-6])[\t \u3000]+([^\n]+)$/gm)) {
		const lane = Number(match[1]);
		if (!entries.has(lane)) entries.set(lane, { lane, racerName: normalize(match[2]), registrationNumber: null, sourceStatus: "available" });
	}
	return [...entries.values()].filter((entry) => entry.racerName);
};
const firstMatch = (text, expression) => normalize(text.match(expression)?.[1]);
const parsePredictionBlock = (block) => ({
	entries: parseEntries(block.text),
	title: nullable(firstMatch(block.text, /(?:^|\n)[^\n]*?\d{1,2}R[\t \u3000]+締切[^\n]*/m)),
	weather: {
		weather: nullable(firstMatch(block.text, /(?:^|\n)天候[:：]\s*([^\n]+)/m)),
		windDirection: nullable(firstMatch(block.text, /(?:^|\n)風[:：]\s*([^/\n]+)/m)),
		windSpeedMps: nullable(firstMatch(block.text, /風速\s*([^\s\n]+)/m)),
		waveHeightCm: nullable(firstMatch(block.text, /波[:：]\s*([^\n]+)/m)),
	},
	hasOfficialExtrasClaim: /Venue Official Extras[:：]読み込み済み/.test(block.text),
	predictionExcerpt: normalize(block.text.match(/【保存済みGPT予想】\n([\s\S]*?)(?=\n【|$)/)?.[1]).slice(0, 1200) || null,
});
const parsePayouts = (text) => [...text.matchAll(/^([^\n:：]+)[:：]\s*([1-6=-]+)\s*\/\s*([^\/\n]+?)(?:\s*\/\s*人気\s*(\d+))?\s*$/gm)]
	.map((match) => ({ betType: normalize(match[1]), combination: normalize(match[2]), payoutYen: nullable(match[3]), popularity: match[4] ? Number(match[4]) : null, sourceStatus: "available" }))
	.filter((item) => item.betType.includes("連") || item.betType.includes("単勝") || item.betType.includes("複勝"));
const parseResultBlock = (block) => {
	const finishOrder = firstMatch(block.text, /(?:^|\n)着順[:：]\s*([1-6](?:-[1-6]){1,5})/m).split("-").map(Number).filter(Boolean);
	const startTiming = Object.fromEntries([...block.text.matchAll(/([1-6]):\1\s*ST\.?([0-9.]+)/g)].map((match) => [match[1], `.${match[2].replace(/^\./, "")}`]));
	return {
		finishOrder,
		trifecta: firstMatch(block.text, /3連単照合キー[:：]\s*([1-6]-[1-6]-[1-6])/m) || null,
		winningTechnique: nullable(firstMatch(block.text, /決まり手[:：]\s*([^\n]+)/m)),
		payout: parsePayouts(block.text),
		startTiming: Object.keys(startTiming).length > 0 ? startTiming : null,
		weather: {
			weather: nullable(firstMatch(block.text, /天候[:：]\s*([^\n]+)/m)),
			windDirection: nullable(firstMatch(block.text, /風向[:：]\s*([^\n]+)/m)),
			windSpeedMps: nullable(firstMatch(block.text, /風速[:：]\s*([^\n]+)/m)),
			waveHeightCm: nullable(firstMatch(block.text, /波高[:：]\s*([^\n]+)/m)),
			airTemperatureC: nullable(firstMatch(block.text, /気温[:：]\s*([^\n]+)/m)),
			waterTemperatureC: nullable(firstMatch(block.text, /水温[:：]\s*([^\n]+)/m)),
		},
		confirmed: /結果確定[:：]\s*confirmed/.test(block.text) || /(?:^|\n)結果[:：]\s*確定\s*$/m.test(block.text),
	};
};
const coverageStatus = (count, total) => count >= total && total > 0 ? "complete" : count > 0 ? "partial" : "missing";
const sourceList = (items) => [...new Map(items.map((source) => [`${source.sourcePath}:${source.generatedAt}`, source])).values()];
const runNode = (script, scriptArgs) => {
	const result = spawnSync(process.execPath, [script, ...scriptArgs], { cwd: rootDir, encoding: "utf8" });
	if (result.status !== 0) throw new Error(`${script} failed\n${result.stderr || result.stdout}`);
	return result.stdout.trim();
};

const reviewDates = fs.readdirSync(reviewRoot, { withFileTypes: true })
	.filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name) && entry.name >= fromDate && entry.name <= toDate)
	.map((entry) => entry.name).sort();
const existingIndex = JSON.parse(fs.readFileSync(path.join(rootDir, "public/data/boatrace-ex/index.generated.json"), "utf8"));
const isPriorReviewsDogBackfill = (date) => {
	const historyPath = path.join(rootDir, `public/data/boatrace-ex/history/races/${date}.json`);
	if (!fs.existsSync(historyPath)) return false;
	try {
		const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
		return (history.sourceFiles ?? []).some((source) => String(source.sourcePath ?? "").startsWith("local-readonly/reviews/"));
	} catch {
		return false;
	}
};
const existingDates = new Set((existingIndex.availableDates ?? []).filter((date) => !isPriorReviewsDogBackfill(date)));
const dogFiles = listFiles(dogRoot).filter((file) => /_summary_\d{4}-\d{2}-\d{2}\.txt$/i.test(file));
const dogByDate = new Map();
for (const file of dogFiles) {
	const date = path.basename(file).match(/(\d{4}-\d{2}-\d{2})/)?.[1];
	if (!date) continue;
	dogByDate.set(date, [...(dogByDate.get(date) ?? []), file]);
}

const auditDates = [];
const writes = [];
let filesSeen = 0;
for (const date of reviewDates) {
	const dateDirectory = path.join(reviewRoot, date);
	const files = fs.readdirSync(dateDirectory).filter((name) => name.endsWith(".txt")).sort();
	const predictions = new Map();
	const results = new Map();
	for (const fileName of files) {
		if (maxFiles > 0 && filesSeen >= maxFiles) break;
		const match = fileName.match(/^(.+)-(predictions|results)\.txt$/);
		if (!match) continue;
		filesSeen += 1;
		const absolutePath = path.join(dateDirectory, fileName);
		const target = match[2] === "predictions" ? predictions : results;
		target.set(match[1], { absolutePath, blocks: splitRaceBlocks(readText(absolutePath)) });
	}
	const sharedVenues = [...predictions.keys()].filter((slug) => results.has(slug)).sort();
	const dateAudit = {
		date,
		reviewFileCount: files.length,
		dogSummaryFileCount: (dogByDate.get(date) ?? []).length,
		predictionFileCount: predictions.size,
		resultFileCount: results.size,
		historyReadyVenueCount: 0,
		predictionOnlyVenueCount: [...predictions.keys()].filter((slug) => !results.has(slug)).length,
		resultSummaryOnlyVenueCount: [...results.keys()].filter((slug) => !predictions.has(slug)).length + ((dogByDate.get(date) ?? []).length > 0 && sharedVenues.length === 0 ? 1 : 0),
		missingRegistrationNoCount: 0,
		unresolved: [],
		created: false,
	};
	const records = [];
	const dateSources = [];
	for (const slug of sharedVenues) {
		const predictionFile = predictions.get(slug);
		const resultFile = results.get(slug);
		const predictionByRace = new Map(predictionFile.blocks.map((block) => [block.raceNo, { block, parsed: parsePredictionBlock(block) }]));
		const resultByRace = new Map(resultFile.blocks.map((block) => [block.raceNo, { block, parsed: parseResultBlock(block) }]));
		const predictionRaceNos = [...predictionByRace.keys()].sort((a, b) => a - b);
		const resultRaceNos = [...resultByRace.keys()].sort((a, b) => a - b);
		if (predictionRaceNos.length === 0 || predictionRaceNos.join(",") !== resultRaceNos.join(",")) {
			dateAudit.unresolved.push({ venue: slug, reason: "prediction/result race number sets do not match" });
			continue;
		}
		const predictionSource = sourceMeta("review-prediction", predictionFile.absolutePath, reviewRoot);
		const resultSource = sourceMeta("review-result", resultFile.absolutePath, reviewRoot);
		const venue = mapVenue(slug.replace(/^\d{4}-\d{2}-\d{2}-/, ""), predictionFile.blocks[0]?.rawVenueName ?? resultFile.blocks[0]?.rawVenueName);
		const venueRecords = [];
		for (const raceNo of predictionRaceNos) {
			const prediction = predictionByRace.get(raceNo).parsed;
			const result = resultByRace.get(raceNo).parsed;
			if (prediction.entries.length === 0 || result.finishOrder.length < 3 || !result.confirmed || !prediction.hasOfficialExtrasClaim) {
				dateAudit.unresolved.push({ venue: slug, raceNo, reason: "missing complete entries, confirmed result, or review official-extras provenance" });
				continue;
			}
			const sources = [predictionSource, resultSource];
			const racers = prediction.entries.map((entry) => ({ ...entry, sources: [predictionSource] }));
			const record = {
				date, venueCode: venue.venueCode, venueName: venue.venueName, raceNo,
				raceKey: `${date}:${String(venue.venueCode).padStart(2, "0")}:${String(raceNo).padStart(2, "0")}`,
				raceStage: "unknown", sessionType: "unknown", sources,
				officialRace: { date, venueCode: venue.venueCode, venueName: venue.venueName, raceNo, title: prediction.title, deadlineAt: null, racers, sources: [predictionSource] },
				officialResult: { date, venueCode: venue.venueCode, raceNo, finishOrder: result.finishOrder, trifecta: result.trifecta, payout: result.payout.map((payout) => ({ ...payout, sources: [resultSource] })), winningTechnique: result.winningTechnique, approachOrder: [], startTiming: result.startTiming, refunds: [], sources: [resultSource] },
				weather: { date, venueCode: venue.venueCode, raceNo, ...(Object.values(result.weather).some(Boolean) ? result.weather : prediction.weather), sources: [resultSource] },
				racer: racers,
				prediction: { sourceStatus: "available", textExcerpt: prediction.predictionExcerpt, sources: [predictionSource] },
				coverage: { officialRace: "partial", officialResult: "partial", officialExhibition: "missing", weather: Object.values(result.weather).some(Boolean) ? "partial" : "missing", waterSurface: "missing", motor: "missing", boat: "missing", racer: "partial", prediction: "partial", summary: "missing", review: "missing", derivedSignals: "missing" },
			};
			venueRecords.push(record);
			dateAudit.missingRegistrationNoCount += racers.length;
		}
		if (venueRecords.length === predictionRaceNos.length) {
			records.push(...venueRecords);
			dateSources.push(predictionSource, resultSource);
			dateAudit.historyReadyVenueCount += 1;
		} else if (venueRecords.length > 0) {
			dateAudit.unresolved.push({ venue: slug, reason: "partial venue is not eligible for historyReady" });
		}
	}
	const historyReady = records.length > 0 && dateAudit.historyReadyVenueCount > 0;
	if (historyReady && !existingDates.has(date)) {
		const venues = [...new Map(records.map((record) => [record.venueCode, record.venueName])).entries()].map(([venueCode, venueName]) => ({ venueCode, venueName }));
		const sourceFiles = sourceList(dateSources);
		const fieldTotals = Object.fromEntries(coverageFields.map((field) => {
			const counts = records.filter((record) => record.coverage[field] === "available" || record.coverage[field] === "complete" || record.coverage[field] === "partial").length;
			return [field, { complete: 0, partial: counts, missing: records.length - counts, pending: 0, notSupported: 0, unknown: 0 }];
		}));
		const history = { schemaVersion: 1, kind: "boatrace-ex-history-races", date, generatedAt: new Date().toISOString(), sourceFiles, records };
		const coverage = { schemaVersion: 1, kind: "boatrace-ex-coverage-date", date, generatedAt: history.generatedAt, sourceFiles, totals: { venues: venues.length, races: records.length }, fieldTotals, venues: venues.map((venue) => ({ ...venue, raceCount: records.filter((record) => record.venueCode === venue.venueCode).length })), sourceCoverage: { kind: "local-reviews-and-dog-read-only", reviewFileCount: sourceFiles.length, dogSummaryFileCount: dateAudit.dogSummaryFileCount, registrationNoMissingCount: dateAudit.missingRegistrationNoCount } };
		writes.push({ date, history, coverage });
		dateAudit.created = true;
	} else if (historyReady && existingDates.has(date)) {
		dateAudit.unresolved.push({ reason: "existing EX history date preserved without overwrite" });
	}
	auditDates.push(dateAudit);
}

const report = {
	schemaVersion: 1,
	kind: "boatrace-ex-reviews-dog-history-backfill",
	generatedAt: new Date().toISOString(),
	range: { fromDate, toDate },
	readOnlySourceRoots: { reviewSourceRoot: reviewRoot, dogSourceRoot: dogRoot },
	summary: {
		reviewDateCount: reviewDates.length,
		reviewFileCount: auditDates.reduce((sum, item) => sum + item.reviewFileCount, 0),
		dogSummaryFileCount: auditDates.reduce((sum, item) => sum + item.dogSummaryFileCount, 0),
		historyReadyDateCount: writes.length,
		predictionOnlyDateCount: auditDates.filter((item) => item.predictionOnlyVenueCount > 0).length,
		resultSummaryOnlyDateCount: auditDates.filter((item) => item.resultSummaryOnlyVenueCount > 0).length,
		missingRegistrationNoCount: auditDates.reduce((sum, item) => sum + item.missingRegistrationNoCount, 0),
		unresolvedCount: auditDates.reduce((sum, item) => sum + item.unresolved.length, 0),
	},
	dates: auditDates,
	createdDates: writes.map((item) => item.date),
	skippedExistingDates: reviewDates.filter((date) => existingDates.has(date)),
	policy: "Reviews and dog summaries are read-only local sources. No registration number is inferred, no fuzzy matching is used, dog summaries never override review race facts, and only complete prediction/result race sets are written as historyReady.",
};

if (!dryRun) {
	for (const item of writes) {
		writeJson(`public/data/boatrace-ex/history/races/${item.date}.json`, item.history);
		writeJson(`public/data/boatrace-ex/coverage/${item.date}.json`, item.coverage);
	}
	const manifestFiles = [...new Set([...existingDates, ...writes.map((item) => item.date)])].sort().flatMap((date) => [
		{ path: `public/data/boatrace-ex/history/races/${date}.json`, kind: "history", date, generatedAt: fs.existsSync(path.join(rootDir, `public/data/boatrace-ex/history/races/${date}.json`)) ? JSON.parse(fs.readFileSync(path.join(rootDir, `public/data/boatrace-ex/history/races/${date}.json`), "utf8")).generatedAt : null, sourceStatus: "available", coverageStatus: "partial" },
		{ path: `public/data/boatrace-ex/coverage/${date}.json`, kind: "coverage", date, generatedAt: fs.existsSync(path.join(rootDir, `public/data/boatrace-ex/coverage/${date}.json`)) ? JSON.parse(fs.readFileSync(path.join(rootDir, `public/data/boatrace-ex/coverage/${date}.json`), "utf8")).generatedAt : null, sourceStatus: "available", coverageStatus: "partial" },
	]);
	writeJson("public/data/boatrace-ex/manifest.generated.json", { schemaVersion: 1, kind: "boatrace-ex-manifest", generatedAt: new Date().toISOString(), sourceFiles: [{ sourceName: "boatrace-ex-history", sourceType: "derived", sourcePath: "public/data/boatrace-ex/history/races", sourceStatus: "available", coverageStatus: "partial" }], files: manifestFiles });
	for (const item of writes) {
		runNode("scripts/generateBoatExVenueEvidence.mjs", ["--date", item.date]);
		runNode("scripts/generateBoatExRacerEvidence.mjs", ["--date", item.date]);
	}
	runNode("scripts/generateBoatExDateIndex.mjs", []);
	runNode("scripts/generateBoatExVenueBias.mjs", []);
	runNode("scripts/generateBoatExRoughIndex.mjs", []);
	runNode("scripts/generateBoatExTodayFlow.mjs", []);
	runNode("scripts/generateBoatExStructuredTickets.mjs", []);
	runNode("scripts/generateBoatExPredictionStructure.mjs", []);
	runNode("scripts/auditBoatExRegistrationCoverage.mjs", []);
	writeJson(`public/data/boatrace-ex/audit/reviews-dog-history-backfill-${toDate}.generated.json`, report);
	const markdown = `# Boat EX Reviews and Dog History Backfill\n\n## Source Rules\n\nThe review and dog roots are read-only local inputs. The collector records a portable local-readonly source locator, the source file mtime as sourceFetchedAt, and source provenance. It never writes to, stages, or commits either source root.\n\nA date is historyReady only when a same-venue prediction file and result file have identical non-empty race-number sets, every race has a parsed entry table and confirmed result, and the prediction includes its official-extras provenance marker. Dog summaries are supplemental audit inputs only; they never override review race facts.\n\n## Current Result\n\n- read-only review files: ${report.summary.reviewFileCount}\n- read-only dog summaries: ${report.summary.dogSummaryFileCount}\n- historyReady dates created: ${report.summary.historyReadyDateCount}\n- missing registration appearances: ${report.summary.missingRegistrationNoCount}\n- unresolved source conditions: ${report.summary.unresolvedCount}\n\n## Re-run\n\n\`\`\`powershell\nnode scripts/backfillBoatExHistoryFromReviewsDog.mjs --review-source-root \"<reviews root>\" --dog-source-root \"<dog root>\" --from 2026-05-24 --to 2026-08-02 --dry-run\nnode scripts/backfillBoatExHistoryFromReviewsDog.mjs --review-source-root \"<reviews root>\" --dog-source-root \"<dog root>\" --from 2026-05-24 --to 2026-08-02 --write\nnode scripts/checkBoatExReviewsDogBackfill.mjs\n\`\`\`\n\nNo registration number is inferred or fuzzy matched. Records without an explicit registration number remain unverified and are not bridge candidates.\n`;
	fs.writeFileSync(path.join(rootDir, `docs/boat-ex/reviews-dog-history-backfill-${toDate}.md`), markdown, "utf8");
}

console.log(JSON.stringify({ ok: true, dryRun, fromDate, toDate, createdDates: report.createdDates, summary: report.summary, skippedExistingDates: report.skippedExistingDates }, null, 2));
