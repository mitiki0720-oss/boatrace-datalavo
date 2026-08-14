import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = path.join(root, "public", "data", "boatrace-ex");
const requiredRelativePath = "public/data/boatrace-ex/audit/name-identity-bridge-2026-08-02.generated.json";

function collectJsonFiles(directory) {
	const files = [];
	const directories = [directory];
	while (directories.length > 0) {
		const current = directories.pop();
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const entryPath = path.join(current, entry.name);
			if (entry.isDirectory()) directories.push(entryPath);
			else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
		}
	}
	return files.sort((left, right) => left.localeCompare(right));
}

const files = collectJsonFiles(dataRoot);
const failures = [];
let requiredIncluded = false;
let requiredParsed = false;
let totalBytes = 0;

for (const filePath of files) {
	const relativePath = path.relative(root, filePath).replaceAll(path.sep, "/");
	const bytes = fs.readFileSync(filePath);
	totalBytes += bytes.length;
	const isRequired = relativePath === requiredRelativePath;
	if (isRequired) requiredIncluded = true;

	try {
		const jsonText = bytes.toString("utf8").replace(/^\uFEFF/u, "");
		JSON.parse(jsonText);
		if (isRequired) requiredParsed = true;
	} catch (error) {
		failures.push({
			path: relativePath,
			byteSize: bytes.length,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

const ok = failures.length === 0 && requiredIncluded && requiredParsed;
console.log(JSON.stringify({
	ok,
	root: "public/data/boatrace-ex",
	fileCount: files.length,
	totalBytes,
	requiredFile: {
		path: requiredRelativePath,
		included: requiredIncluded,
		parsed: requiredParsed,
	},
	failures,
}, null, 2));

if (!ok) process.exitCode = 1;
