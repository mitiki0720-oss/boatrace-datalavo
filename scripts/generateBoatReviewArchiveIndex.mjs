// Task Scheduler memo:
//   Working directory: C:\Users\mitik\Desktop\ボートレースウェブ作成用\boatrace-datalavo
//   Command: npm.cmd run generate:boat-review-index
//   Schedule: every day 23:00 and 09:00

import { execFile } from "node:child_process";
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const archiveRoot = path.join(projectRoot, "public", "data", "reviews");
const indexPath = path.join(archiveRoot, "index.json");

const VENUE_SLUG_TO_NAME = {
	kiryu: "桐生",
	toda: "戸田",
	edogawa: "江戸川",
	heiwajima: "平和島",
	tamagawa: "多摩川",
	hamanako: "浜名湖",
	gamagori: "蒲郡",
	tokoname: "常滑",
	tsu: "津",
	mikuni: "三国",
	biwako: "びわこ",
	suminoe: "住之江",
	amagasaki: "尼崎",
	naruto: "鳴門",
	marugame: "丸亀",
	kojima: "児島",
	miyajima: "宮島",
	tokuyama: "徳山",
	shimonoseki: "下関",
	wakamatsu: "若松",
	ashiya: "芦屋",
	fukuoka: "福岡",
	karatsu: "唐津",
	omura: "大村",
};

const DATE_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FILE_PATTERN = /^(.+)-(predictions|results|summary)\.txt$/;
const execFileAsync = promisify(execFile);

function getJstIsoString(date = new Date()) {
	const formatter = new Intl.DateTimeFormat("sv-SE", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	const parts = Object.fromEntries(formatter.formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
	return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}.000+09:00`;
}

async function fileExists(filePath) {
	try {
		const info = await stat(filePath);
		return info.isFile();
	} catch {
		return false;
	}
}

async function getFileSize(filePath) {
	try {
		const info = await stat(filePath);
		return info.isFile() ? info.size : null;
	} catch {
		return null;
	}
}

async function listGitTrackedReviewArchiveFiles() {
	try {
		const { stdout } = await execFileAsync("git", ["-C", projectRoot, "ls-files", "public/data/reviews"], { encoding: "utf8" });
		return stdout
			.split(/\r?\n/)
			.map((line) => line.trim().replaceAll("\\", "/"))
			.filter((line) => /^public\/data\/reviews\/\d{4}-\d{2}-\d{2}\/.+\.txt$/.test(line));
	} catch {
		return null;
	}
}

async function collectReviewArchiveFiles() {
	const trackedFiles = await listGitTrackedReviewArchiveFiles();
	if (trackedFiles) {
		return trackedFiles
			.map((file) => file.replace(/^public\/data\/reviews\//, ""))
			.sort();
	}

	const files = [];
	const dateDirs = (await readdir(archiveRoot, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory() && DATE_DIR_PATTERN.test(entry.name))
		.map((entry) => entry.name)
		.sort();

	for (const date of dateDirs) {
		const datePath = path.join(archiveRoot, date);
		const dateFiles = (await readdir(datePath, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);
		for (const file of dateFiles) {
			files.push(`${date}/${file}`);
		}
	}

	return files.sort();
}

async function main() {
	await stat(archiveRoot).catch(async () => {
		throw new Error(`archive directory not found: ${archiveRoot}`);
	});

	const items = [];
	const warnings = [];
	const archiveFiles = await collectReviewArchiveFiles();
	const filesByDate = new Map();

	for (const archiveFile of archiveFiles) {
		const [date, file] = archiveFile.split("/");
		if (!DATE_DIR_PATTERN.test(date) || !file) {
			continue;
		}
		const files = filesByDate.get(date) ?? [];
		files.push(file);
		filesByDate.set(date, files);
	}

	for (const [date, files] of Array.from(filesByDate.entries()).sort(([left], [right]) => left.localeCompare(right))) {
		const datePath = path.join(archiveRoot, date);
		const slugs = new Set();

		for (const file of files) {
			const match = file.match(FILE_PATTERN);
			if (!match) {
				warnings.push(`[skip] unexpected file name: ${date}/${file}`);
				continue;
			}
			slugs.add(match[1]);
		}

		for (const slug of Array.from(slugs).sort()) {
			if (!VENUE_SLUG_TO_NAME[slug]) {
				warnings.push(`[warn] unknown venue slug: ${date}/${slug}`);
			}

			const predictionFile = `${slug}-predictions.txt`;
			const resultFile = `${slug}-results.txt`;
			const summaryTxtFile = `${slug}-summary.txt`;
			const hasPrediction = await fileExists(path.join(datePath, predictionFile));
			const hasResult = await fileExists(path.join(datePath, resultFile));
			const hasSummaryTxt = await fileExists(path.join(datePath, summaryTxtFile));
			const predictionSizeBytes = hasPrediction ? await getFileSize(path.join(datePath, predictionFile)) : null;
			const resultSizeBytes = hasResult ? await getFileSize(path.join(datePath, resultFile)) : null;
			const summarySizeBytes = hasSummaryTxt ? await getFileSize(path.join(datePath, summaryTxtFile)) : null;

			if (!hasPrediction) warnings.push(`[warn] missing prediction file: ${date}/${predictionFile}`);
			if (!hasResult) warnings.push(`[warn] missing result file: ${date}/${resultFile}`);
			if (!hasSummaryTxt) warnings.push(`[info] missing optional summary file: ${date}/${summaryTxtFile}`);

			items.push({
				date,
				venueName: VENUE_SLUG_TO_NAME[slug] ?? slug,
				venueSlug: slug,
				predictionFile: hasPrediction ? `${date}/${predictionFile}` : null,
				resultFile: hasResult ? `${date}/${resultFile}` : null,
				summaryFile: hasSummaryTxt ? `${date}/${summaryTxtFile}` : null,
				predictionStatus: hasPrediction ? "ready" : "missing",
				resultStatus: hasResult ? "ready" : "missing",
				summaryStatus: hasSummaryTxt ? "ready" : "missing",
				predictionSizeBytes,
				resultSizeBytes,
				summarySizeBytes,
			});
		}
	}

	const payload = {
		generatedAt: getJstIsoString(),
		source: "public/data/reviews",
		items,
	};

	await writeFile(indexPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

	for (const warning of warnings) {
		console.warn(warning);
	}
	console.log(`generated ${items.length} archive entries -> ${path.relative(projectRoot, indexPath)}`);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});
