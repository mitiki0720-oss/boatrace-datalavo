import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getJstTimestamp } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const featureRoot = path.join(projectRoot, "public", "data", "boatrace", "venue-features");
const notesDir = path.join(featureRoot, "notes");
const indexPath = path.join(featureRoot, "index.json");

const venueMappings = [
	["桐生", "kiryu"],
	["戸田", "toda"],
	["江戸川", "edogawa"],
	["平和島", "heiwajima"],
	["多摩川", "tamagawa"],
	["浜名湖", "hamanako"],
	["蒲郡", "gamagori"],
	["常滑", "tokoname"],
	["津", "tsu"],
	["三国", "mikuni"],
	["びわこ", "biwako"],
	["住之江", "suminoe"],
	["尼崎", "amagasaki"],
	["鳴門", "naruto"],
	["丸亀", "marugame"],
	["児島", "kojima"],
	["宮島", "miyajima"],
	["徳山", "tokuyama"],
	["下関", "shimonoseki"],
	["若松", "wakamatsu"],
	["芦屋", "ashiya"],
	["福岡", "fukuoka"],
	["唐津", "karatsu"],
	["大村", "omura"],
];

const venueMappingsByLength = [...venueMappings].sort((left, right) => right[0].length - left[0].length);

const normalize = (value) => String(value ?? "").replace(/\s+/g, "").toLowerCase();

function stripFrontMatter(markdown) {
	return markdown.replace(/^---[\s\S]*?---\s*/, "");
}

function readFirstHeading(markdown) {
	const line = stripFrontMatter(markdown).split(/\r?\n/).find((item) => /^#\s+/.test(item.trim()));
	return line ? line.replace(/^#\s+/, "").trim() : "";
}

function readFrontMatterValue(markdown, key) {
	const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(markdown);
	if (!match) {
		return "";
	}

	const line = match[1].split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`${key.toLowerCase()}:`));
	return line ? line.slice(line.indexOf(":") + 1).trim().replace(/^["']|["']$/g, "") : "";
}

function readTags(markdown) {
	const raw = readFrontMatterValue(markdown, "tags");
	if (!raw) {
		return [];
	}

	return raw
		.replace(/^\[|\]$/g, "")
		.split(",")
		.map((item) => item.trim().replace(/^["']|["']$/g, ""))
		.filter(Boolean);
}

function stripMarkdown(markdown) {
	return stripFrontMatter(markdown)
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/[#>*_\-|]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

function inferVenue(markdown, fileName) {
	const explicitVenue = readFrontMatterValue(markdown, "venueName");
	const explicitSlug = readFrontMatterValue(markdown, "slug");
	const title = readFirstHeading(markdown);
	const fileBase = path.basename(fileName, path.extname(fileName));
	const exactSlug = venueMappings.find(([, slug]) => normalize(explicitSlug) === normalize(slug) || normalize(fileBase) === normalize(slug));
	if (exactSlug) {
		return { venueName: exactSlug[0], slug: exactSlug[1], recognized: true };
	}

	const target = normalize(`${explicitVenue} ${title} ${fileName}`);
	const exactVenue = venueMappings.find(([venueName]) => normalize(explicitVenue) === normalize(venueName));
	const match = exactVenue ?? venueMappingsByLength.find(([venueName, slug]) => target.includes(normalize(venueName)) || target.includes(normalize(slug)));
	if (match) {
		return { venueName: match[0], slug: match[1], recognized: true };
	}

	const fallbackSlug = fileBase.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").toLowerCase() || "unknown";
	return { venueName: explicitVenue || title || path.basename(fileName, path.extname(fileName)), slug: explicitSlug || `unknown-${fallbackSlug}`, recognized: false };
}

async function readExistingIndex() {
	try {
		return JSON.parse(await readFile(indexPath, "utf8"));
	} catch {
		return { items: [] };
	}
}

async function main() {
	await mkdir(notesDir, { recursive: true });
	const existing = await readExistingIndex();
	const existingByFile = new Map((Array.isArray(existing.items) ? existing.items : []).map((item) => [item.file, item]));
	const files = (await readdir(notesDir, { withFileTypes: true }))
		.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right, "ja"));
	const warnings = [];
	const items = [];

	for (const fileName of files) {
		const markdown = await readFile(path.join(notesDir, fileName), "utf8");
		const relativeFile = `notes/${fileName}`;
		const inferred = inferVenue(markdown, fileName);
		const existingItem = existingByFile.get(relativeFile) ?? {};
		const tags = readTags(markdown);
		const title = readFrontMatterValue(markdown, "title") || readFirstHeading(markdown) || existingItem.title || `${inferred.venueName}競艇場｜予想用会場特徴ノート`;

		if (!inferred.recognized) {
			warnings.push(`venue not recognized: ${fileName}`);
		}

		items.push({
			...existingItem,
			venueName: inferred.venueName,
			slug: inferred.slug,
			title,
			file: relativeFile,
			status: existingItem.status || "ready",
			sourceType: existingItem.sourceType || "manual-note",
			updatedAt: existingItem.updatedAt || getJstTimestamp(),
			tags: tags.length ? tags : existingItem.tags || [],
			waterType: readFrontMatterValue(markdown, "waterType") || existingItem.waterType || "",
			excerpt: stripMarkdown(markdown).slice(0, 180),
		});
	}

	const output = {
		generatedAt: getJstTimestamp(),
		items,
		warnings,
	};

	await mkdir(featureRoot, { recursive: true });
	await writeFile(indexPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
	console.log(`updated: ${indexPath}`);
	console.log(`items: ${items.length}`);
	if (warnings.length) {
		console.warn(`warnings: ${warnings.join("; ")}`);
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
