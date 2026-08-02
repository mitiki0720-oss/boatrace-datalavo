import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REGISTRATION_PATTERN = /^\d{4,6}$/;
const MAX_AUDIT_SAMPLES = 200;

function parseArgs(argv) {
	const args = { reviewSourceRoot: undefined, dogSourceRoot: undefined, from: undefined, to: undefined, dryRun: true };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") { args.dryRun = true; continue; }
		if (arg === "--write") { args.dryRun = false; continue; }
		if (["--review-source-root", "--dog-source-root", "--from", "--to"].includes(arg)) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
			if (arg === "--review-source-root") args.reviewSourceRoot = value;
			if (arg === "--dog-source-root") args.dogSourceRoot = value;
			if (arg === "--from") args.from = value;
			if (arg === "--to") args.to = value;
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	for (const value of [args.from, args.to]) if (value && !DATE_PATTERN.test(value)) throw new Error("--from/--to require YYYY-MM-DD");
	for (const [label, sourceRoot] of [["--review-source-root", args.reviewSourceRoot], ["--dog-source-root", args.dogSourceRoot]]) {
		if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`${label} must point to an existing read-only source directory`);
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
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const asText = (value) => typeof value === "string" ? value.trim() : "";
const isRegistrationNumber = (value) => REGISTRATION_PATTERN.test(asText(value)) && asText(value) !== "0000";
const normalizeName = (value) => asText(value).normalize("NFKC").replace(/\s+/gu, " ");
const countFiles = (sourceRoot) => {
	let count = 0;
	const visit = (directory) => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const target = path.join(directory, entry.name);
			if (entry.isDirectory()) visit(target);
			else if (entry.isFile()) count += 1;
		}
	};
	visit(sourceRoot);
	return count;
};
const tupleKey = (date, venueCode, raceNo, boatNo) => [date, String(venueCode).padStart(2, "0"), Number(raceNo), Number(boatNo)].join("\u0000");
const relativePathFor = (target) => path.relative(repoRoot, target).split(path.sep).join("/");

function listOfficialCandidates() {
	const sourceRoot = absolute("public/data/boatrace-ex/source/official-details");
	if (!fs.existsSync(sourceRoot)) return { candidates: [], sourceFiles: [], rejectedFiles: [] };
	const candidates = [];
	const sourceFiles = [];
	const rejectedFiles = [];
	for (const fileName of fs.readdirSync(sourceRoot).filter((name) => DATE_PATTERN.test(name.slice(0, -5)) && name.endsWith(".json")).sort()) {
		const relativePath = `public/data/boatrace-ex/source/official-details/${fileName}`;
		const source = readJson(relativePath);
		const date = asText(source.date);
		const sourceFetchedAt = asText(source.sourceFetchedAt);
		if (!DATE_PATTERN.test(date) || !sourceFetchedAt || !isObject(source.provenance)) {
			rejectedFiles.push({ relativePath, reason: "missing date, sourceFetchedAt, or provenance" });
			continue;
		}
		sourceFiles.push(relativePath);
		for (const venue of Array.isArray(source.venues) ? source.venues : []) {
			for (const race of Array.isArray(venue?.races) ? venue.races : []) {
				for (const entry of Array.isArray(race?.entries) ? race.entries : []) {
					const registrationNumber = asText(entry?.registrationNo ?? entry?.registrationNumber);
					const racerName = asText(entry?.racerName);
					const boatNo = Number(entry?.boatNo);
					if (!isRegistrationNumber(registrationNumber) || !racerName || !Number.isInteger(boatNo) || boatNo < 1 || boatNo > 6) continue;
					candidates.push({
						date,
						venueCode: asText(venue?.venueCode).padStart(2, "0"),
						raceNo: Number(race?.raceNo),
						boatNo,
						racerName,
						normalizedRacerName: normalizeName(racerName),
						registrationNumber,
						source: {
							sourceName: "boatrace-ex-official-detail-source",
							sourceType: "official",
							sourcePath: relativePath,
							generatedAt: asText(source.generatedAt) || undefined,
							sourceFetchedAt,
							sourceStatus: "available",
							coverageStatus: "partial",
							provenance: source.provenance,
						},
					});
				}
			}
		}
	}
	return { candidates, sourceFiles, rejectedFiles };
}

function appendUniqueSource(sources, source) {
	const list = Array.isArray(sources) ? [...sources] : [];
	if (!list.some((item) => item?.sourcePath === source.sourcePath && item?.sourceFetchedAt === source.sourceFetchedAt)) list.push(source);
	return list;
}

function sampleAppearance({ date, record, racer, reason, candidate }) {
	return {
		date,
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceNo: record.raceNo,
		boatNo: racer?.lane ?? null,
		racerName: racer?.racerName ?? null,
		reason,
		...(candidate ? { candidateRegistrationNumber: candidate.registrationNumber, candidateRacerName: candidate.racerName, sourcePath: candidate.source.sourcePath } : {}),
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const dates = (Array.isArray(index.availableDates) ? index.availableDates : []).filter((date) => (!args.from || date >= args.from) && (!args.to || date <= args.to));
	if (dates.length === 0) throw new Error("No Boat EX history dates match the requested range.");
	const before = { registrationAppearanceCount: 0, missingRegistrationAppearanceCount: 0 };
	const bridge = listOfficialCandidates();
	const candidatesByTuple = new Map();
	for (const candidate of bridge.candidates) {
		const key = tupleKey(candidate.date, candidate.venueCode, candidate.raceNo, candidate.boatNo);
		const bucket = candidatesByTuple.get(key) ?? [];
		bucket.push(candidate);
		candidatesByTuple.set(key, bucket);
	}

	const safeBridges = [];
	const candidateReasons = new Map();
	const unresolvedReasons = new Map();
	const candidateSamples = [];
	const unresolvedSamples = [];
	const changedDates = new Set();
	const historyWrites = new Map();
	const addReason = (map, reason) => map.set(reason, (map.get(reason) ?? 0) + 1);
	const addSample = (samples, value) => { if (samples.length < MAX_AUDIT_SAMPLES) samples.push(value); };

	for (const date of dates) {
		const historyRelativePath = `public/data/boatrace-ex/history/races/${date}.json`;
		const history = readJson(historyRelativePath);
		let changed = false;
		for (const record of Array.isArray(history.records) ? history.records : []) {
			const officialRacers = Array.isArray(record.officialRace?.racers) ? record.officialRace.racers : [];
			for (const racer of Array.isArray(record.racer) ? record.racer : []) {
				if (isRegistrationNumber(racer?.registrationNumber)) { before.registrationAppearanceCount += 1; continue; }
				before.missingRegistrationAppearanceCount += 1;
				const officialRacer = officialRacers.find((entry) => Number(entry?.lane) === Number(racer?.lane));
				const boatNo = Number(officialRacer?.boatNo);
				if (!Number.isInteger(boatNo) || boatNo < 1 || boatNo > 6) {
					addReason(unresolvedReasons, "history-official-boatNo-missing");
					addSample(unresolvedSamples, sampleAppearance({ date, record, racer, reason: "history-official-boatNo-missing" }));
					continue;
				}
				const tupleCandidates = candidatesByTuple.get(tupleKey(date, record.venueCode, record.raceNo, boatNo)) ?? [];
				if (tupleCandidates.length === 0) {
					addReason(unresolvedReasons, "official-race-context-unavailable");
					addSample(unresolvedSamples, sampleAppearance({ date, record, racer, reason: "official-race-context-unavailable" }));
					continue;
				}
				const exact = tupleCandidates.filter((entry) => entry.normalizedRacerName === normalizeName(racer?.racerName));
				if (exact.length !== 1 || new Set(exact.map((entry) => entry.registrationNumber)).size !== 1) {
					const reason = exact.length === 0 ? "official-racer-name-mismatch" : "ambiguous-official-registration";
					addReason(candidateReasons, reason);
					addSample(candidateSamples, sampleAppearance({ date, record, racer, reason, candidate: tupleCandidates[0] }));
					continue;
				}
				const match = exact[0];
				racer.registrationNumber = match.registrationNumber;
				racer.sources = appendUniqueSource(racer.sources, match.source);
				if (officialRacer) {
					officialRacer.registrationNumber = match.registrationNumber;
					officialRacer.sources = appendUniqueSource(officialRacer.sources, match.source);
				}
				record.sources = appendUniqueSource(record.sources, match.source);
				history.sourceFiles = appendUniqueSource(history.sourceFiles, match.source);
				changed = true;
				safeBridges.push({
					date,
					venueCode: record.venueCode,
					venueName: record.venueName,
					raceNo: record.raceNo,
					boatNo,
					racerName: racer.racerName,
					registrationNumber: match.registrationNumber,
					source: match.source,
				});
			}
		}
		if (changed) {
			history.generatedAt = new Date().toISOString();
			historyWrites.set(historyRelativePath, history);
			changedDates.add(date);
		}
	}

	const after = {
		registrationAppearanceCount: before.registrationAppearanceCount + safeBridges.length,
		missingRegistrationAppearanceCount: before.missingRegistrationAppearanceCount - safeBridges.length,
	};
	const auditDate = index.latestDate;
	const auditRelativePath = `public/data/boatrace-ex/audit/registration-bridge-${auditDate}.generated.json`;
	const markdownRelativePath = `docs/boat-ex/registration-bridge-${auditDate}.md`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-registration-bridge-audit",
		auditDate,
		generatedAt: new Date().toISOString(),
		mode: args.dryRun ? "dry-run" : "write",
		policy: "Only an exact date + venueCode + raceNo + official boatNo tuple with one normalized exact racerName match and explicit official registrationNumber is written. No fuzzy matching, inferred identity, or dog/review registration number is allowed.",
		readOnlyInputs: {
			reviewSourceRoot: { path: args.reviewSourceRoot, fileCount: countFiles(args.reviewSourceRoot), usedForRegistrationBridge: false },
			dogSourceRoot: { path: args.dogSourceRoot, fileCount: countFiles(args.dogSourceRoot), usedForRegistrationBridge: false },
		},
		officialSource: { sourceFiles: bridge.sourceFiles, rejectedFiles: bridge.rejectedFiles, candidateEntryCount: bridge.candidates.length },
		coverage: { dates, dateCount: dates.length, before, after, changedDates: [...changedDates].sort() },
		classification: {
			safeBridge: { count: safeBridges.length, rule: "Exact official tuple and normalized racerName match with explicit registrationNumber and provenance.", appearances: safeBridges },
			candidateBridge: { count: [...candidateReasons.values()].reduce((sum, value) => sum + value, 0), reasons: Object.fromEntries(candidateReasons), samples: candidateSamples },
			unresolved: { count: [...unresolvedReasons.values()].reduce((sum, value) => sum + value, 0), reasons: Object.fromEntries(unresolvedReasons), samples: unresolvedSamples },
		},
		warnings: [
			...(bridge.sourceFiles.length === 0 ? ["No dated official-detail source archives were available for exact historical registration bridging."] : []),
			...(safeBridges.length === 0 ? ["No source-backed safeBridge appearance met every required exact-match condition; history registration values were not changed."] : []),
		],
	};
	const markdown = `# Boat EX Registration Bridge (${auditDate})\n\n` +
		`## Policy\n\n${audit.policy}\n\n` +
		`## Sources\n\n- official detail archives: ${bridge.sourceFiles.length}\n- official candidate entries: ${bridge.candidates.length}\n- review source files (read-only, not used for registration inference): ${audit.readOnlyInputs.reviewSourceRoot.fileCount}\n- dog source files (read-only, not used for registration inference): ${audit.readOnlyInputs.dogSourceRoot.fileCount}\n\n` +
		`## Result\n\n- before registration appearances: ${before.registrationAppearanceCount}\n- before missing registration appearances: ${before.missingRegistrationAppearanceCount}\n- safeBridge: ${audit.classification.safeBridge.count}\n- candidateBridge: ${audit.classification.candidateBridge.count}\n- unresolved: ${audit.classification.unresolved.count}\n- after registration appearances: ${after.registrationAppearanceCount}\n- after missing registration appearances: ${after.missingRegistrationAppearanceCount}\n- changed dates: ${audit.coverage.changedDates.join(", ") || "none"}\n\n` +
		`## Safety\n\nCandidate and unresolved appearances remain unmodified. No review or dog file is written, and neither source is used to infer a registration number.\n`;

	if (!args.dryRun) {
		for (const [relativePath, history] of historyWrites) writeJson(relativePath, history);
		writeJson(auditRelativePath, audit);
		writeText(markdownRelativePath, markdown);
	}
	console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, auditPath: auditRelativePath, markdownPath: markdownRelativePath, before, safeBridgeCount: safeBridges.length, candidateBridgeCount: audit.classification.candidateBridge.count, unresolvedCount: audit.classification.unresolved.count, after, changedDates: audit.coverage.changedDates, officialCandidateEntryCount: bridge.candidates.length }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; }
