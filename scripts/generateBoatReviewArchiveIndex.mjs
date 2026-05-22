import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const archiveRoot = path.join(projectRoot, "public", "data", "boatrace", "reviews");
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
const FILE_PATTERN = /^(.+)-(predictions|results|summary)\.(txt|md)$/;

async function fileExists(filePath) {
	try {
		const info = await stat(filePath);
		return info.isFile();
	} catch {
		return false;
	}
}

async function main() {
	await stat(archiveRoot).catch(async () => {
		throw new Error(`archive directory not found: ${archiveRoot}`);
	});

	const dateDirs = (await readdir(archiveRoot, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory() && DATE_DIR_PATTERN.test(entry.name))
		.map((entry) => entry.name)
		.sort();

	const items = [];
	const warnings = [];

	for (const date of dateDirs) {
		const datePath = path.join(archiveRoot, date);
		const files = (await readdir(datePath, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);
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
			const summaryMdFile = `${slug}-summary.md`;
			const summaryTxtFile = `${slug}-summary.txt`;
			const hasPrediction = await fileExists(path.join(datePath, predictionFile));
			const hasResult = await fileExists(path.join(datePath, resultFile));
			const hasSummaryMd = await fileExists(path.join(datePath, summaryMdFile));
			const hasSummaryTxt = await fileExists(path.join(datePath, summaryTxtFile));

			if (!hasPrediction) warnings.push(`[warn] missing prediction file: ${date}/${predictionFile}`);
			if (!hasResult) warnings.push(`[warn] missing result file: ${date}/${resultFile}`);
			if (!hasSummaryMd && !hasSummaryTxt) warnings.push(`[warn] missing summary file: ${date}/${summaryMdFile}`);

			items.push({
				date,
				venueName: VENUE_SLUG_TO_NAME[slug] ?? slug,
				venueSlug: slug,
				predictionFile: hasPrediction ? `${date}/${predictionFile}` : null,
				resultFile: hasResult ? `${date}/${resultFile}` : null,
				summaryFile: hasSummaryMd ? `${date}/${summaryMdFile}` : hasSummaryTxt ? `${date}/${summaryTxtFile}` : null,
			});
		}
	}

	const payload = {
		generatedAt: new Date().toISOString(),
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
