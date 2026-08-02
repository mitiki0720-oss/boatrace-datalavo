import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRATION_PATTERN = /^\d{4,6}$/;
const SAMPLE_LIMIT = 50;

function parseArgs(argv) {
	const args = { from: undefined, to: undefined, dryRun: true };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") { args.dryRun = true; continue; }
		if (arg === "--write") { args.dryRun = false; continue; }
		if (arg === "--from" || arg === "--to") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--") || !DATE_PATTERN.test(value)) throw new Error(`${arg} requires YYYY-MM-DD`);
			if (arg === "--from") args.from = value;
			else args.to = value;
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

const absolute = (relativePath) => path.join(repoRoot, ...relativePath.split("/"));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const writeJson = (relativePath, value) => {
	const target = absolute(relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const writeText = (relativePath, value) => {
	const target = absolute(relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, value, "utf8");
};
const asText = (value) => typeof value === "string" ? value.trim() : value === undefined || value === null ? "" : String(value).trim();
const isRegistrationNumber = (value) => REGISTRATION_PATTERN.test(asText(value)) && asText(value) !== "0000";
const hash = (values) => crypto.createHash("sha256").update(values.join("\n"), "utf8").digest("hex");
const sourceKey = (source) => [source.sourceName, source.sourceType, source.sourcePath, source.sourceFetchedAt ?? source.generatedAt].map(asText).join("\u0000");
const pushSample = (samples, value) => { if (samples.length < SAMPLE_LIMIT) samples.push(value); };

function valueTuples(history, tuples) {
	for (const record of Array.isArray(history.records) ? history.records : []) {
		for (const racer of Array.isArray(record.racer) ? record.racer : []) {
			if (!isRegistrationNumber(racer?.registrationNumber)) continue;
			tuples.push([record.date, record.venueCode, record.raceNo, racer.lane, racer.registrationNumber, racer.racerName].map(asText).join("\u0000"));
		}
	}
}

function sourceCandidate(record, source) {
	if (source?.sourceType !== "official") return null;
	const sourceName = asText(source.sourceName);
	const sourcePath = asText(source.sourcePath);
	const timestamp = asText(source.sourceFetchedAt ?? source.generatedAt);
	if (!sourceName || !sourcePath || !timestamp) return null;
	return {
		sourceName,
		sourceType: "official",
		sourcePath,
		generatedAt: asText(source.generatedAt) || undefined,
		sourceFetchedAt: timestamp,
		sourceStatus: asText(source.sourceStatus) || "available",
		coverageStatus: asText(source.coverageStatus) || "partial",
		provenance: {
			kind: "boatrace-ex-same-race-source-metadata",
			sourcePath,
			sourceName,
			sourceType: "official",
			timestampField: source.sourceFetchedAt ? "sourceFetchedAt" : "generatedAt",
			raceContext: { date: record.date, venueCode: record.venueCode, raceNo: record.raceNo },
		},
	};
}

function sample(record, racer, reason, source) {
	return {
		date: record.date,
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceNo: record.raceNo,
		boatNo: racer?.lane ?? null,
		registrationNumber: racer?.registrationNumber ?? null,
		racerName: racer?.racerName ?? null,
		reason,
		...(source ? { sourcePath: source.sourcePath, sourceFetchedAt: source.sourceFetchedAt } : {}),
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const dates = (Array.isArray(index.availableDates) ? index.availableDates : []).filter((date) => (!args.from || date >= args.from) && (!args.to || date <= args.to));
	if (dates.length === 0) throw new Error("No Boat EX history dates match the requested range.");
	const beforeTuples = [];
	const afterTuples = [];
	const writes = new Map();
	const changedDates = new Set();
	const classified = { propagated: [], alreadyComplete: [], sourceMissing: [], sourceConflict: [], contextMismatch: [], unresolved: [] };
	const counts = Object.fromEntries(Object.keys(classified).map((key) => [key, 0]));
	let beforeComplete = 0;
	let beforeMissing = 0;
	let afterComplete = 0;
	let afterMissing = 0;

	for (const date of dates) {
		const relativePath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(relativePath);
		valueTuples(history, beforeTuples);
		let changed = false;
		for (const record of Array.isArray(history.records) ? history.records : []) {
			for (const racer of Array.isArray(record.racer) ? record.racer : []) {
				if (!isRegistrationNumber(racer?.registrationNumber)) continue;
				const racerSources = Array.isArray(racer.sources) ? racer.sources : [];
				if (racerSources.some((source) => asText(source?.sourceFetchedAt) && source?.provenance)) {
					beforeComplete += 1;
					afterComplete += 1;
					counts.alreadyComplete += 1;
					pushSample(classified.alreadyComplete, sample(record, racer, "already-complete"));
					continue;
				}
				beforeMissing += 1;
				const candidates = (Array.isArray(record.sources) ? record.sources : [])
					.map((source) => sourceCandidate(record, source))
					.filter(Boolean);
				const uniqueCandidates = [...new Map(candidates.map((candidate) => [sourceKey(candidate), candidate])).values()];
				if (uniqueCandidates.length === 0) {
					const hasOfficialSource = (Array.isArray(record.sources) ? record.sources : []).some((source) => source?.sourceType === "official");
					counts[hasOfficialSource ? "sourceMissing" : "unresolved"] += 1;
					pushSample(classified[hasOfficialSource ? "sourceMissing" : "unresolved"], sample(record, racer, hasOfficialSource ? "official-source-metadata-missing" : "official-source-missing"));
					afterMissing += 1;
					continue;
				}
				const matchingCandidates = uniqueCandidates.filter((candidate) => racerSources.some((source) => sourceKey(source) === sourceKey(candidate)));
				if (matchingCandidates.length === 0) {
					counts.contextMismatch += 1;
					pushSample(classified.contextMismatch, sample(record, racer, "racer-source-does-not-match-race-source"));
					afterMissing += 1;
					continue;
				}
				if (matchingCandidates.length !== 1) {
					counts.sourceConflict += 1;
					pushSample(classified.sourceConflict, sample(record, racer, "multiple-matching-official-source-candidates"));
					afterMissing += 1;
					continue;
				}
				const candidate = matchingCandidates[0];
				const matchingSources = racerSources.filter((source) => sourceKey(source) === sourceKey(candidate));
				if (matchingSources.length !== 1) {
					counts.contextMismatch += 1;
					pushSample(classified.contextMismatch, sample(record, racer, "racer-source-does-not-match-race-source", candidate));
					afterMissing += 1;
					continue;
				}
				Object.assign(matchingSources[0], candidate);
				counts.propagated += 1;
				pushSample(classified.propagated, sample(record, racer, "propagated-from-same-race-official-source", candidate));
				afterComplete += 1;
				changed = true;
			}
		}
		valueTuples(history, afterTuples);
		if (changed) {
			history.generatedAt = new Date().toISOString();
			writes.set(relativePath, history);
			changedDates.add(date);
		}
	}
	const auditDate = index.latestDate;
	const auditRelativePath = `public/data/boatrace-ex/audit/registration-provenance-${auditDate}.generated.json`;
	const markdownRelativePath = `docs/boat-ex/registration-provenance-${auditDate}.md`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-registration-provenance-audit",
		auditDate,
		generatedAt: new Date().toISOString(),
		mode: args.dryRun ? "dry-run" : "write",
		policy: "Only metadata from the same history race record is copied. sourceFetchedAt uses the original explicit sourceFetchedAt, or that source's generatedAt with timestampField=generatedAt. No registrationNo or racerName is changed.",
		sourceFiles: ["public/data/boatrace-ex/index.generated.json", ...dates.map((date) => `public/data/boatrace-ex/history/races/${date}.json`)],
		coverage: { from: dates[0], to: dates.at(-1), dateCount: dates.length, dates, changedDates: [...changedDates].sort() },
		before: { provenanceCompleteCount: beforeComplete, provenanceMissingCount: beforeMissing, registrationValueHash: hash(beforeTuples.sort()) },
		classification: Object.fromEntries(Object.entries(classified).map(([key, samples]) => [key, { count: counts[key], samples }])),
		after: { provenanceCompleteCount: afterComplete, provenanceMissingCount: afterMissing, registrationValueHash: hash(afterTuples.sort()) },
		warnings: [
			...(counts.sourceMissing > 0 ? [`${counts.sourceMissing} registered appearances have an official source without an explicit timestamp.`] : []),
			...(counts.sourceConflict > 0 ? [`${counts.sourceConflict} registered appearances have conflicting official source candidates and were not updated.`] : []),
			...(counts.contextMismatch > 0 ? [`${counts.contextMismatch} registered appearances have racer source context that does not exactly match the record source.`] : []),
		],
	};
	const markdown = `# Boat EX Registration Provenance Propagation (${auditDate})\n\n` +
		`## Policy\n\n${audit.policy}\n\n` +
		`## Result\n\n- before complete/missing: ${beforeComplete}/${beforeMissing}\n- propagated: ${counts.propagated}\n- alreadyComplete: ${counts.alreadyComplete}\n- sourceMissing: ${counts.sourceMissing}\n- sourceConflict: ${counts.sourceConflict}\n- contextMismatch: ${counts.contextMismatch}\n- unresolved: ${counts.unresolved}\n- after complete/missing: ${afterComplete}/${afterMissing}\n- changed dates: ${audit.coverage.changedDates.join(", ") || "none"}\n\n` +
		`## Safety\n\nregistrationNo and racerName hashes are identical before and after propagation. Unresolved registration rows are not inspected or changed.\n`;
	if (!args.dryRun) {
		for (const [relativePath, history] of writes) writeJson(relativePath, history);
		writeJson(auditRelativePath, audit);
		writeText(markdownRelativePath, markdown);
	}
	console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, auditPath: auditRelativePath, markdownPath: markdownRelativePath, before: audit.before, ...Object.fromEntries(Object.entries(audit.classification).map(([key, value]) => [`${key}Count`, value.count])), after: audit.after, changedDates: audit.coverage.changedDates }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; }
