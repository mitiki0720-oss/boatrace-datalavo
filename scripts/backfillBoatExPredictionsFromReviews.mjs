import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const valueAfter = (flag, fallback = null) => {
	const index = argv.indexOf(flag);
	return index >= 0 ? argv[index + 1] : fallback;
};
const sourceRoot = valueAfter("--review-source-root");
const fromDate = valueAfter("--from", "0000-00-00");
const toDate = valueAfter("--to", "9999-99-99");
const dryRun = argv.includes("--dry-run");
if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error("--review-source-root must be an existing directory");

const venueCodes = {
	amagasaki: "13", ashiya: "21", biwako: "11", edogawa: "03", fukuoka: "22", gamagori: "07", hamanako: "06", hamamatsu: "06",
	heiwajima: "04", karatsu: "23", kiryu: "01", kojima: "16", marugame: "15", miyajima: "17", mikuni: "10", naruto: "14", omura: "24",
	shiga: "11", shimonoseki: "19", suminoe: "12", tamagawa: "05", tokoname: "08", toda: "02", tokuyama: "18", tsu: "09", wakamatsu: "20",
};
const normalize = (value) => String(value ?? "").trim();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const target = path.join(root, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const sourceIdentity = (source) => `${source?.sourcePath ?? ""}:${source?.generatedAt ?? ""}`;

function splitRaceBlocks(text) {
	const matches = [...text.matchAll(/^■\s*([^\n]+?)\s+(\d{1,2})R\s*$/gmu)];
	return matches.map((match, index) => ({
		raceNo: Number(match[2]),
		text: text.slice(match.index, matches[index + 1]?.index ?? text.length),
	}));
}

function predictionText(block) {
	const marker = "【保存済みGPT予想】";
	const start = block.indexOf(marker);
	if (start < 0) return null;
	const value = block.slice(start + marker.length).replace(/\n----\s*$/u, "").trim();
	return value.includes("【買い目】") ? value : null;
}

const changedDates = [];
let linkedRaceCount = 0;
for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
	if (!entry.isDirectory() || entry.name < fromDate || entry.name > toDate || !/^\d{4}-\d{2}-\d{2}$/u.test(entry.name)) continue;
	const date = entry.name;
	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	if (!fs.existsSync(path.join(root, historyPath))) continue;
	const history = readJson(historyPath);
	const byRaceKey = new Map((history.records ?? []).map((record) => [`${String(record.venueCode).padStart(2, "0")}:${Number(record.raceNo)}`, record]));
	let changed = false;
	for (const fileName of fs.readdirSync(path.join(sourceRoot, date)).filter((name) => name.endsWith("-predictions.txt"))) {
		const slug = fileName.replace(/^\d{4}-\d{2}-\d{2}-/u, "").replace(/-predictions\.txt$/u, "");
		const venueCode = venueCodes[slug];
		if (!venueCode) continue;
		const absolutePath = path.join(sourceRoot, date, fileName);
		const sourceFetchedAt = fs.statSync(absolutePath).mtime.toISOString();
		const source = {
			sourceName: "local review prediction",
			sourceType: "user",
			sourcePath: `local-readonly/reviews/${date}/${fileName}`,
			generatedAt: sourceFetchedAt,
			sourceFetchedAt,
			sourceStatus: "available",
			coverageStatus: "partial",
			provenance: "read-only local source",
		};
		const blocks = splitRaceBlocks(fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/u, "").replace(/\r\n/gu, "\n"));
		for (const block of blocks) {
			const record = byRaceKey.get(`${venueCode}:${block.raceNo}`);
			const textExcerpt = predictionText(block.text);
			if (!record || !textExcerpt) continue;
			const currentText = normalize(record.prediction?.textExcerpt);
			if (currentText === textExcerpt) continue;
			record.prediction = { sourceStatus: "available", textExcerpt, sources: [source] };
			record.coverage = { ...record.coverage, prediction: "complete" };
			history.sourceFiles = [...new Map([...(history.sourceFiles ?? []), source].map((item) => [sourceIdentity(item), item])).values()];
			changed = true;
			linkedRaceCount += 1;
		}
	}
	if (changed) {
		changedDates.push(date);
		history.generatedAt = new Date().toISOString();
		if (!dryRun) writeJson(historyPath, history);
	}
}

console.log(JSON.stringify({ ok: true, dryRun, fromDate, toDate, changedDateCount: changedDates.length, linkedRaceCount, changedDates }, null, 2));
