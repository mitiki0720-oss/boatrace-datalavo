import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
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
	const totalStake = sortedRecords.reduce((sum, record) => sum + Number(record.totalStakeYen || record.betSummary?.totalStakeYen || 0), 0);
	const totalPayout = sortedRecords.reduce((sum, record) => sum + Number(record.payoutYen || 0), 0);
	const hitCount = sortedRecords.filter((record) => String(record.resultStatus || "").includes("hit") || Number(record.payoutYen || 0) > 0).length;
	const profit = totalPayout - totalStake;

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
		summary: [
			`date: ${date}`,
			`venue: ${group.venueName}`,
			"kind: summary",
			"",
			`races=${sortedRecords.length}`,
			`hits=${hitCount}`,
			`stake=${totalStake}`,
			`payout=${totalPayout}`,
			`profit=${profit}`,
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

	const kinds = new Set();
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
		kinds.add(match[2]);
	}

	for (const kind of ["predictions", "results", "summary"]) {
		if (!kinds.has(kind)) {
			return { ok: false, reason: `archive ${kind} file missing for ${date}` };
		}
	}

	return { ok: true, reason: "archive verified" };
}

async function generateReviewIndex(root, options, changedFiles) {
	const archiveRoot = path.join(root, "public", "data", "reviews");
	const items = [];
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
			items.push({
				date,
				venueName: slug,
				venueSlug: slug,
				predictionFile: files.includes(predictionFile) ? `${date}/${predictionFile}` : null,
				resultFile: files.includes(resultFile) ? `${date}/${resultFile}` : null,
				summaryFile: files.includes(summaryFile) ? `${date}/${summaryFile}` : null,
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
			throw new Error(`archive verification failed before pruning: ${archiveCheck.reason}`);
		}
	} else {
		console.log(`[boat-rollover] archive verification: ${archiveCheck.reason}`);
	}

	if (!options.dryRun) {
		await generateReviewIndex(options.root, options, changedFiles);
	} else {
		changedFiles.add(path.relative(options.root, resolveDataPath(options.root, "reviewIndex")).replaceAll("\\", "/"));
	}

	for (const key of ["today", "raceDetails", "venueExtras"]) {
		const filePath = resolveDataPath(options.root, key);
		const payload = await readJsonIfExists(filePath, null);
		if (payload) {
			await writeJson(filePath, pruneDatedFeed(payload, currentDate, options.now), options, changedFiles);
		}
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

	console.log("[boat-rollover] changed candidates:");
	for (const file of Array.from(changedFiles).sort()) {
		console.log(`  ${file}`);
	}
}

main().catch((error) => {
	console.error(`[boat-rollover] ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
