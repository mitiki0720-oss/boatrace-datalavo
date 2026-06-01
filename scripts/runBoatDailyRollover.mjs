import { execFile, spawn } from "node:child_process";
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
	formatJstDateKey,
	getBoatOperationalDateKey,
	getJstIsoString,
	getPreviousBoatOperationalDateKey,
	shiftBoatOperationalDateKey,
} from "./lib/boatOperationalDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultProjectRoot = path.resolve(__dirname, "..");

const FILE_PATTERN = /^(.+)-(predictions|results|summary)\.txt$/;
const DATE_DIR_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const BOATRACE_DATA_FILES = {
	today: ["public", "data", "boatrace", "today.generated.json"],
	raceDetails: ["public", "data", "boatrace", "today-race-details.generated.json"],
	venueExtras: ["public", "data", "boatrace", "venue-extras.generated.json"],
	johnson: ["public", "data", "boatrace", "johnson-predictions.generated.json"],
	schedule: ["public", "data", "boatrace", "upcoming-schedule.generated.json"],
	reviewIndex: ["public", "data", "reviews", "index.json"],
};
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
	const options = {
		dryRun: false,
		root: defaultProjectRoot,
		now: new Date(),
		simulateArchiveFailure: false,
	};

	for (const arg of argv) {
		if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (arg === "--simulate-archive-failure") {
			options.simulateArchiveFailure = true;
		} else if (arg.startsWith("--now=")) {
			options.now = new Date(arg.slice("--now=".length));
		} else if (arg.startsWith("--root=")) {
			options.root = path.resolve(arg.slice("--root=".length));
		}
	}

	if (Number.isNaN(options.now.getTime())) {
		throw new Error("--now must be a valid date string");
	}

	return options;
}

function resolveDataPath(root, key) {
	return path.join(root, ...BOATRACE_DATA_FILES[key]);
}

async function readJsonIfExists(filePath, fallback) {
	try {
		return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
	} catch (error) {
		if (error && error.code === "ENOENT") {
			return fallback;
		}
		throw error;
	}
}

async function writeJson(filePath, payload, options, changedFiles) {
	changedFiles.add(path.relative(options.root, filePath).replaceAll("\\", "/"));
	if (options.dryRun) {
		return;
	}
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	JSON.parse(await readFile(filePath, "utf8"));
}

function toArray(value) {
	return Array.isArray(value) ? value : [];
}

function getVenueLabel(record) {
	return String(record?.venueName || record?.venue || record?.venueCode || "unknown").trim() || "unknown";
}

function getVenueSlug(record) {
	const code = String(record?.venueCode || record?.venueId || "").trim();
	if (code) {
		return `venue-${code.toLowerCase().replace(/[^a-z0-9_-]+/gi, "-")}`;
	}
	return getVenueLabel(record).normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "unknown";
}

function groupRecordsByVenue(records) {
	return records.reduce((groups, record) => {
		const slug = getVenueSlug(record);
		const group = groups.get(slug) ?? { slug, venueName: getVenueLabel(record), records: [] };
		group.records.push(record);
		groups.set(slug, group);
		return groups;
	}, new Map());
}

function formatRaceLine(record) {
	const raceNo = Number(record.raceNo || 0);
	const title = raceNo > 0 ? `${raceNo}R` : "race";
	const text = String(record.johnsonText || record.predictionText || "").trim() || "prediction not saved";
	const stake = Number(record.totalStakeYen || record.betSummary?.totalStakeYen || 0);
	return [`${title}`, text, stake > 0 ? `stake=${stake}` : ""].filter(Boolean).join(" | ");
}

function buildArchiveTexts(date, group) {
	const sortedRecords = [...group.records].sort((left, right) => Number(left.raceNo || 0) - Number(right.raceNo || 0));

	return {
		predictions: [
			`date: ${date}`,
			`venue: ${group.venueName}`,
			"kind: predictions",
			"",
			...sortedRecords.map(formatRaceLine),
			"",
		].join("\n"),
		results: [
			`date: ${date}`,
			`venue: ${group.venueName}`,
			"kind: results",
			"",
			...sortedRecords.map((record) => {
				const raceNo = Number(record.raceNo || 0);
				const title = raceNo > 0 ? `${raceNo}R` : "race";
				return `${title} | finish=${String(record.finishOrder || "").trim() || "-"} | payout=${Number(record.payoutYen || 0)} | profit=${Number(record.profitYen ?? Number(record.payoutYen || 0) - Number(record.totalStakeYen || 0))}`;
			}),
			"",
		].join("\n"),
	};
}

async function createArchiveFromJohnsonRecords(root, date, johnsonPayload, options, changedFiles) {
	const previousRecords = toArray(johnsonPayload.records).filter((record) => record?.date === date);
	const groups = groupRecordsByVenue(previousRecords);

	if (groups.size <= 0) {
		return { createdGroups: 0, message: `no johnson records for ${date}` };
	}

	const dateRoot = path.join(root, "public", "data", "reviews", date);
	for (const group of groups.values()) {
		const texts = buildArchiveTexts(date, group);
		for (const [kind, text] of Object.entries(texts)) {
			const filePath = path.join(dateRoot, `${group.slug}-${kind}.txt`);
			changedFiles.add(path.relative(root, filePath).replaceAll("\\", "/"));
			if (!options.dryRun) {
				await mkdir(path.dirname(filePath), { recursive: true });
				await writeFile(filePath, text, "utf8");
			}
		}
	}

	return { createdGroups: groups.size, message: `created ${groups.size} archive venue groups` };
}

async function verifyArchive(root, date, options) {
	if (options.simulateArchiveFailure) {
		return { ok: false, reason: "simulated archive verification failure" };
	}

	const dateRoot = path.join(root, "public", "data", "reviews", date);
	let files;
	try {
		files = await readdir(dateRoot);
	} catch {
		return { ok: false, reason: `archive directory missing: public/data/reviews/${date}` };
	}

	const venueKinds = new Map();
	for (const file of files) {
		const match = file.match(FILE_PATTERN);
		if (!match) {
			continue;
		}
		const filePath = path.join(dateRoot, file);
		const info = await stat(filePath);
		if (info.size <= 0) {
			return { ok: false, reason: `archive file is empty: ${date}/${file}` };
		}
		const slug = match[1];
		const kinds = venueKinds.get(slug) ?? new Set();
		kinds.add(match[2]);
		venueKinds.set(slug, kinds);
	}

	if (venueKinds.size <= 0) {
		return { ok: false, reason: `archive files missing for ${date}` };
	}

	let hasMissingSummary = false;
	for (const [slug, kinds] of venueKinds) {
		for (const kind of ["predictions", "results"]) {
			if (!kinds.has(kind)) {
				return { ok: false, reason: `archive ${kind} file missing for ${date}/${slug}` };
			}
		}
		if (!kinds.has("summary")) {
			hasMissingSummary = true;
		}
	}

	const summaryStatus = hasMissingSummary ? "missing" : "ready";
	return {
		ok: true,
		reason: summaryStatus === "ready"
			? "archive verified"
			: "summary not found: optional, continue",
		summaryStatus,
	};
}

async function generateReviewIndex(root, options, changedFiles) {
	const archiveRoot = path.join(root, "public", "data", "reviews");
	const items = [];
	let archiveFiles = null;

	try {
		const { stdout } = await execFileAsync("git", ["-C", root, "ls-files", "public/data/reviews"], { encoding: "utf8" });
		archiveFiles = stdout
			.split(/\r?\n/)
			.map((line) => line.trim().replaceAll("\\", "/"))
			.filter((line) => /^public\/data\/reviews\/\d{4}-\d{2}-\d{2}\/.+\.txt$/.test(line))
			.map((line) => line.replace(/^public\/data\/reviews\//, ""));
	} catch {
		archiveFiles = null;
	}

	if (!archiveFiles) {
		archiveFiles = [];
		let dateDirs = [];
		try {
			dateDirs = (await readdir(archiveRoot, { withFileTypes: true }))
				.filter((entry) => entry.isDirectory() && DATE_DIR_PATTERN.test(entry.name))
				.map((entry) => entry.name)
				.sort();
		} catch {
			dateDirs = [];
		}

		for (const date of dateDirs) {
			const datePath = path.join(archiveRoot, date);
			const files = (await readdir(datePath, { withFileTypes: true })).filter((entry) => entry.isFile()).map((entry) => entry.name);
			archiveFiles.push(...files.map((file) => `${date}/${file}`));
		}
	}

	for (const changedFile of changedFiles) {
		const normalized = changedFile.replaceAll("\\", "/");
		if (/^public\/data\/reviews\/\d{4}-\d{2}-\d{2}\/.+\.txt$/.test(normalized)) {
			archiveFiles.push(normalized.replace(/^public\/data\/reviews\//, ""));
		}
	}

	const filesByDate = new Map();
	for (const archiveFile of Array.from(new Set(archiveFiles)).sort()) {
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
			if (match) {
				slugs.add(match[1]);
			}
		}

		for (const slug of Array.from(slugs).sort()) {
			const predictionFile = `${slug}-predictions.txt`;
			const resultFile = `${slug}-results.txt`;
			const summaryFile = `${slug}-summary.txt`;
			const hasPrediction = files.includes(predictionFile);
			const hasResult = files.includes(resultFile);
			const hasSummary = files.includes(summaryFile);
			items.push({
				date,
				venueName: slug,
				venueSlug: slug,
				predictionFile: hasPrediction ? `${date}/${predictionFile}` : null,
				resultFile: hasResult ? `${date}/${resultFile}` : null,
				summaryFile: hasSummary ? `${date}/${summaryFile}` : null,
				predictionStatus: hasPrediction ? "ready" : "missing",
				resultStatus: hasResult ? "ready" : "missing",
				summaryStatus: hasSummary ? "ready" : "missing",
			});
		}
	}

	await writeJson(resolveDataPath(root, "reviewIndex"), {
		generatedAt: getJstIsoString(options.now),
		source: "public/data/reviews",
		items,
	}, options, changedFiles);
}

function extractDateFromSlackKey(key) {
	const text = String(key || "");
	const dashed = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
	if (dashed) {
		return dashed;
	}
	const compact = text.match(/\d{8}/)?.[0];
	if (!compact) {
		return null;
	}
	return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function pruneSlackKeys(keys, currentDate) {
	const oldestDate = shiftBoatOperationalDateKey(currentDate, -13);
	return toArray(keys).filter((key) => {
		const date = extractDateFromSlackKey(key);
		return !date || date >= oldestDate;
	});
}

function pruneDatedFeed(payload, currentDate, now) {
	if (!payload || typeof payload !== "object") {
		return payload;
	}
	if (payload.date === currentDate) {
		return payload;
	}
	return {
		...payload,
		date: currentDate,
		generatedAt: getJstIsoString(now),
		venues: [],
		source: `${String(payload.source || "unknown")} | pruned-by-daily-rollover`,
	};
}

function countRaces(payload) {
	return toArray(payload?.venues).reduce((total, venue) => total + toArray(venue?.races).length, 0);
}

function hasValidGeneratedAt(payload) {
	return typeof payload?.generatedAt === "string" && !Number.isNaN(Date.parse(payload.generatedAt));
}

function isNoRacingPayload(payload) {
	const status = String(payload?.sourceStatus || payload?.status || "").toLowerCase();
	return ["no-races", "no-racing", "closed", "not-held"].includes(status);
}

function validateActiveFeed(name, payload, currentDate) {
	if (!payload || typeof payload !== "object") {
		throw new Error(`${name} is not a JSON object`);
	}
	if (payload.date !== currentDate) {
		throw new Error(`${name} date mismatch: expected ${currentDate}, got ${payload.date || "missing"}`);
	}
	if (!hasValidGeneratedAt(payload)) {
		throw new Error(`${name} generatedAt is missing or invalid`);
	}

	const venues = toArray(payload.venues);
	const races = countRaces(payload);
	if (!isNoRacingPayload(payload) && (venues.length <= 0 || races <= 0)) {
		throw new Error(`${name} has empty active data without no-racing status`);
	}
	return { venues: venues.length, races };
}

async function runCommand(command, args, cwd) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd,
			stdio: "inherit",
			env: process.env,
		});

		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}`));
		});
	});
}

async function atomicReplaceJson(sourcePath, destinationPath) {
	const payload = JSON.parse((await readFile(sourcePath, "utf8")).replace(/^\uFEFF/, ""));
	await mkdir(path.dirname(destinationPath), { recursive: true });
	const replacePath = `${destinationPath}.next`;
	await writeFile(replacePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
	JSON.parse(await readFile(replacePath, "utf8"));
	await rename(replacePath, destinationPath);
}

async function refreshActiveFeeds(root, currentDate, options, changedFiles) {
	const tempDir = path.join(root, ".tmp", "boat-daily-rollover", currentDate);
	const todayPath = path.join(tempDir, "today.generated.json");
	const detailsPath = path.join(tempDir, "today-race-details.generated.json");
	const extrasPath = path.join(tempDir, "venue-extras.generated.json");

	if (options.dryRun) {
		console.log("[boat-daily-rollover] active refresh planned");
		console.log(`[boat-daily-rollover] temp output: ${path.relative(root, tempDir).replaceAll("\\", "/")}`);
		for (const key of ["today", "raceDetails", "venueExtras"]) {
			changedFiles.add(path.relative(root, resolveDataPath(root, key)).replaceAll("\\", "/"));
		}
		return;
	}

	console.log("[boat-daily-rollover] active refresh started");
	try {
		await mkdir(tempDir, { recursive: true });
		await runCommand(process.execPath, [
			path.join("scripts", "updateBoatData.mjs"),
			"--mode",
			"initial",
			"--target-session",
			"auto",
			"--target-date",
			currentDate,
			"--output-dir",
			tempDir,
		], root);

		const todayPayload = await readJsonIfExists(todayPath, null);
		const detailsPayload = await readJsonIfExists(detailsPath, null);
		const extrasPayload = await readJsonIfExists(extrasPath, null);
		const todayStats = validateActiveFeed("today.generated.json", todayPayload, currentDate);
		const detailsStats = validateActiveFeed("today-race-details.generated.json", detailsPayload, currentDate);
		const extrasStats = validateActiveFeed("venue-extras.generated.json", extrasPayload, currentDate);

		if (todayStats.venues !== detailsStats.venues || todayStats.races !== detailsStats.races) {
			throw new Error(`today/details count mismatch: today=${todayStats.venues}/${todayStats.races}, details=${detailsStats.venues}/${detailsStats.races}`);
		}

		console.log(`[boat-daily-rollover] today venues: ${todayStats.venues}`);
		console.log(`[boat-daily-rollover] today races: ${todayStats.races}`);
		console.log(`[boat-daily-rollover] extras venues: ${extrasStats.venues}`);
		console.log("[boat-daily-rollover] active refresh verified");

		await atomicReplaceJson(todayPath, resolveDataPath(root, "today"));
		await atomicReplaceJson(detailsPath, resolveDataPath(root, "raceDetails"));
		await atomicReplaceJson(extrasPath, resolveDataPath(root, "venueExtras"));

		for (const key of ["today", "raceDetails", "venueExtras"]) {
			changedFiles.add(path.relative(root, resolveDataPath(root, key)).replaceAll("\\", "/"));
		}
		console.log("[boat-daily-rollover] atomic replace completed");
	} catch (error) {
		console.error("[boat-daily-rollover] active refresh validation failed");
		console.error(`[boat-daily-rollover] ${error instanceof Error ? error.message : String(error)}`);
		console.error("[boat-daily-rollover] keep existing active JSON");
		console.error("[boat-daily-rollover] skip commit/push to prevent publishing empty active data");
		throw error;
	}
}

function pruneScheduleItems(payload, now) {
	if (!payload || typeof payload !== "object") {
		return payload;
	}
	const today = formatJstDateKey(now);
	const limit = shiftBoatOperationalDateKey(today, 31);
	return {
		...payload,
		generatedAt: payload.generatedAt ?? getJstIsoString(now),
		items: toArray(payload.items).filter((item) => {
			const startDate = String(item?.startDate || "").trim();
			const endDate = String(item?.endDate || item?.startDate || "").trim();
			const effectiveStartDate = startDate || endDate;
			const effectiveEndDate = endDate || startDate;
			return Boolean(effectiveStartDate || effectiveEndDate) && effectiveEndDate >= today && effectiveStartDate <= limit;
		}),
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const currentDate = getBoatOperationalDateKey(options.now);
	const previousDate = getPreviousBoatOperationalDateKey(options.now);
	const changedFiles = new Set();

	console.log(`[boat-rollover] root=${options.root}`);
	console.log(`[boat-rollover] now=${options.now.toISOString()} current=${currentDate} previous=${previousDate} dryRun=${options.dryRun}`);

	const johnsonPath = resolveDataPath(options.root, "johnson");
	const johnsonPayload = await readJsonIfExists(johnsonPath, { records: [], notifiedSlackResultKeys: [], notifiedSlackHitKeys: [] });

	const archiveResult = await createArchiveFromJohnsonRecords(options.root, previousDate, johnsonPayload, options, changedFiles);
	console.log(`[boat-rollover] archive: ${archiveResult.message}`);

	const archiveCheck = options.dryRun && archiveResult.createdGroups > 0
		? { ok: true, reason: "dry-run archive creation planned" }
		: await verifyArchive(options.root, previousDate, options);

	if (!archiveCheck.ok) {
		if (options.dryRun) {
			console.warn(`[boat-rollover] dry-run warning: archive verification would fail before pruning: ${archiveCheck.reason}`);
		} else {
			console.error("[boat-rollover] archive verification failed");
			console.error("[boat-rollover] skip prune to protect review data");
			throw new Error(`archive verification failed before pruning: ${archiveCheck.reason}`);
		}
	} else {
		if (archiveCheck.summaryStatus === "ready") {
			console.log("[boat-rollover] summary found");
		} else if (archiveCheck.summaryStatus === "missing") {
			console.log("[boat-rollover] summary not found: optional, continue");
		}
		console.log("[boat-rollover] prediction archive verified");
		console.log("[boat-rollover] result archive verified");
		console.log("[boat-rollover] archive verified");
	}

	await refreshActiveFeeds(options.root, currentDate, options, changedFiles);

	if (!options.dryRun) {
		await generateReviewIndex(options.root, options, changedFiles);
	} else {
		changedFiles.add(path.relative(options.root, resolveDataPath(options.root, "reviewIndex")).replaceAll("\\", "/"));
	}

	await writeJson(johnsonPath, {
		...johnsonPayload,
		generatedAt: johnsonPayload.generatedAt ?? getJstIsoString(options.now),
		updatedAt: getJstIsoString(options.now),
		records: toArray(johnsonPayload.records).filter((record) => record?.date === currentDate),
		notifiedSlackResultKeys: pruneSlackKeys(johnsonPayload.notifiedSlackResultKeys, currentDate),
		notifiedSlackHitKeys: pruneSlackKeys(johnsonPayload.notifiedSlackHitKeys, currentDate),
	}, options, changedFiles);

	const schedulePath = resolveDataPath(options.root, "schedule");
	const schedulePayload = await readJsonIfExists(schedulePath, null);
	if (schedulePayload) {
		await writeJson(schedulePath, pruneScheduleItems(schedulePayload, options.now), options, changedFiles);
	}

	console.log("[boat-rollover] active prune completed");
	console.log("[boat-rollover] changed candidates:");
	for (const file of Array.from(changedFiles).sort()) {
		console.log(`  ${file}`);
	}
	console.log("[boat-rollover] completed");
}

main().catch((error) => {
	console.error(`[boat-rollover] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
