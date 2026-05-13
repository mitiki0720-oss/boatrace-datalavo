import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src", "scripts"];
const TARGET_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".json"]);
const EXCLUDED_SEGMENTS = new Set(["node_modules", "dist", "build"]);
const EXCLUDED_RELATIVE_PATHS = new Set(["public/data"]);
const MOJIBAKE_CODE_POINTS = [
	0x7E67,
	0x7E3A,
	0x7E5D,
	0x8B6B,
	0x90B1,
	0x8C85,
	0x8708,
	0x879F,
	0x8711,
	0x8815,
	0x9036,
	0x96B1,
	0xF8F0,
	0xE05E,
	0xFFFD,
];
const MOJIBAKE_PATTERN = new RegExp(MOJIBAKE_CODE_POINTS.map((codePoint) => String.fromCodePoint(codePoint)).join("|"));

async function collectFiles(directoryPath) {
	const entries = await readdir(directoryPath, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const absolutePath = path.join(directoryPath, entry.name);
		const relativePath = path.relative(ROOT, absolutePath).replace(/\\/g, "/");

		if (EXCLUDED_RELATIVE_PATHS.has(relativePath)) {
			continue;
		}

		const pathSegments = relativePath.split("/");
		if (pathSegments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) {
			continue;
		}

		if (entry.isDirectory()) {
			files.push(...await collectFiles(absolutePath));
			continue;
		}

		if (!entry.isFile()) {
			continue;
		}

		if (!TARGET_EXTENSIONS.has(path.extname(entry.name))) {
			continue;
		}

		files.push({ absolutePath, relativePath });
	}

	return files;
}

function collectMatches(filePath, content) {
	const matches = [];
	const lines = content.split(/\r?\n/);

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index];
		if (!MOJIBAKE_PATTERN.test(line)) {
			continue;
		}

		matches.push({
			filePath,
			lineNumber: index + 1,
			line,
		});
	}

	return matches;
}

async function main() {
	const targetFiles = [];

	for (const targetDir of TARGET_DIRS) {
		const absoluteTargetDir = path.join(ROOT, targetDir);
		targetFiles.push(...await collectFiles(absoluteTargetDir));
	}

	const findings = [];

	for (const file of targetFiles) {
		const content = await readFile(file.absolutePath, "utf8");
		findings.push(...collectMatches(file.relativePath, content));
	}

	if (findings.length === 0) {
		console.log("mojibake check passed");
		return;
	}

	for (const finding of findings) {
		console.log(`${finding.filePath}:${finding.lineNumber}`);
		console.log(`  ${finding.line}`);
	}

	process.exit(1);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
});