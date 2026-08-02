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
const normalizeName = (value) => asText(value).normalize("NFKC").replace(/\s+/gu, " ");
const isRegistrationNumber = (value) => REGISTRATION_PATTERN.test(asText(value)) && asText(value) !== "0000";
const addCount = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const pushSample = (samples, value) => { if (samples.length < SAMPLE_LIMIT) samples.push(value); };
const sourceClassification = (source) => {
	if (source?.sourceType === "official") return "official-derived";
	if (source?.sourceType === "user") return "user-entered-from-official";
	if (source?.sourceType === "generated-from-official" || String(source?.sourceName ?? "").includes("official-detail")) return "generated-from-official";
	return "unknown";
};

function sourceCompleteness(sources) {
	const candidates = Array.isArray(sources) ? sources : [];
	for (const source of candidates) {
		if (asText(source?.sourceName) && asText(source?.sourceType) && asText(source?.sourceFetchedAt) && source?.provenance) {
			return { complete: true, classification: sourceClassification(source), missing: [] };
		}
	}
	const source = candidates[0] ?? {};
	const missing = [
		...(!asText(source.sourceName) ? ["sourceName"] : []),
		...(!asText(source.sourceType) ? ["sourceType"] : []),
		...(!asText(source.sourceFetchedAt) ? ["sourceFetchedAt"] : []),
		...(!source.provenance ? ["provenance"] : []),
	];
	return { complete: false, classification: sourceClassification(source), missing };
}

function contextFor(date, record, racer, sourceInfo) {
	return {
		date,
		venueCode: record.venueCode ?? null,
		venueName: record.venueName ?? null,
		raceNo: record.raceNo ?? null,
		boatNo: racer.lane ?? null,
		racerName: racer.racerName ?? null,
		registrationNumber: racer.registrationNumber ?? null,
		branch: racer.branch ?? null,
		className: racer.className ?? null,
		sourceClassification: sourceInfo.classification,
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const dates = (Array.isArray(index.availableDates) ? index.availableDates : []).filter((date) => (!args.from || date >= args.from) && (!args.to || date <= args.to));
	if (dates.length === 0) throw new Error("No Boat EX history dates match the requested range.");

	const registrations = new Map();
	const names = new Map();
	const invalid = [];
	const provenanceMissing = [];
	const contextMissing = [];
	const raceDuplicateRegistration = [];
	const raceDuplicateBoat = [];
	const evidenceMismatches = [];
	const sourceTypeCounts = new Map();
	let registeredAppearanceCount = 0;
	let validRegistrationNoCount = 0;
	let invalidRegistrationNoCount = 0;
	let provenanceCompleteCount = 0;
	let provenanceMissingCount = 0;
	let racerEvidenceMatchedRegistrationCount = 0;

	for (const date of dates) {
		const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
		const evidence = readJson(`public/data/boatrace-ex/derived/racer-evidence/${date}.json`);
		const expectedEvidenceCounts = new Map();
		for (const record of Array.isArray(history.records) ? history.records : []) {
			const seenRegistrations = new Map();
			const seenBoatNumbers = new Map();
			for (const racer of Array.isArray(record.racer) ? record.racer : []) {
				const registrationNumber = asText(racer?.registrationNumber);
				if (!registrationNumber) continue;
				registeredAppearanceCount += 1;
				const sourceInfo = sourceCompleteness(racer.sources);
				addCount(sourceTypeCounts, sourceInfo.classification);
				const item = contextFor(date, record, racer, sourceInfo);
				const required = [item.date, item.venueCode, item.venueName, item.raceNo, item.racerName, item.registrationNumber];
				if (required.some((value) => value === null || value === undefined || asText(value) === "")) pushSample(contextMissing, { ...item, reason: "missing-date-venue-race-racer-or-registration" });
				if (!isRegistrationNumber(registrationNumber)) {
					invalidRegistrationNoCount += 1;
					pushSample(invalid, { ...item, reason: "invalid-registration-format" });
					continue;
				}
				validRegistrationNoCount += 1;
				if (sourceInfo.complete) provenanceCompleteCount += 1;
				else {
					provenanceMissingCount += 1;
					pushSample(provenanceMissing, { ...item, missing: sourceInfo.missing });
				}
				const registration = registrations.get(registrationNumber) ?? { registrationNumber, appearances: [], rawNames: new Set(), normalizedNames: new Set(), branches: new Set(), classes: new Set(), dates: new Set(), venues: new Set(), races: new Set(), provenanceCompleteAppearanceCount: 0 };
				registration.appearances.push(item);
				registration.rawNames.add(asText(racer.racerName));
				registration.normalizedNames.add(normalizeName(racer.racerName));
				if (asText(racer.branch)) registration.branches.add(asText(racer.branch));
				if (asText(racer.className)) registration.classes.add(asText(racer.className));
				registration.dates.add(date);
				registration.venues.add(`${record.venueCode}\u0000${record.venueName}`);
				registration.races.add(`${date}\u0000${record.venueCode}\u0000${record.raceNo}`);
				if (sourceInfo.complete) registration.provenanceCompleteAppearanceCount += 1;
				registrations.set(registrationNumber, registration);
				const name = normalizeName(racer.racerName);
				const nameEntry = names.get(name) ?? { normalizedName: name, rawNames: new Set(), registrations: new Set(), appearances: [] };
				nameEntry.rawNames.add(asText(racer.racerName));
				nameEntry.registrations.add(registrationNumber);
				nameEntry.appearances.push(item);
				names.set(name, nameEntry);
				addCount(seenRegistrations, registrationNumber);
				const boatNo = Number(record.officialRace?.racers?.find((entry) => Number(entry?.lane) === Number(racer?.lane))?.boatNo);
				if (Number.isInteger(boatNo) && boatNo >= 1 && boatNo <= 6) addCount(seenBoatNumbers, boatNo);
				addCount(expectedEvidenceCounts, registrationNumber);
			}
			for (const [registrationNumber, count] of seenRegistrations) if (count > 1) pushSample(raceDuplicateRegistration, { date, venueCode: record.venueCode, raceNo: record.raceNo, registrationNumber, count });
			for (const [boatNo, count] of seenBoatNumbers) if (count > 1) pushSample(raceDuplicateBoat, { date, venueCode: record.venueCode, raceNo: record.raceNo, boatNo, count });
		}
		const actualEvidenceCounts = new Map((Array.isArray(evidence.racers) ? evidence.racers : [])
			.filter((racer) => isRegistrationNumber(racer?.registrationNumber))
			.map((racer) => [asText(racer.registrationNumber), Number(racer.appearanceCount ?? 0)]));
		for (const [registrationNumber, count] of expectedEvidenceCounts) {
			if (actualEvidenceCounts.get(registrationNumber) === count) racerEvidenceMatchedRegistrationCount += 1;
			else pushSample(evidenceMismatches, { date, registrationNumber, historyAppearanceCount: count, racerEvidenceAppearanceCount: actualEvidenceCounts.get(registrationNumber) ?? null });
		}
	}

	const collisions = [];
	const aliasCandidates = [];
	const safeRegistered = [];
	const duplicateRegistrations = [];
	for (const registration of registrations.values()) {
		if (registration.appearances.length > 1) duplicateRegistrations.push(registration);
		if (registration.normalizedNames.size > 1) collisions.push(registration);
		else if (registration.rawNames.size > 1) aliasCandidates.push(registration);
		else if (registration.provenanceCompleteAppearanceCount === registration.appearances.length) safeRegistered.push(registration);
	}
	const sameNameMultipleRegistration = [...names.values()].filter((entry) => entry.registrations.size > 1);
	const serializeRegistration = (entry) => ({
		registrationNumber: entry.registrationNumber,
		appearanceCount: entry.appearances.length,
		rawNames: [...entry.rawNames].sort(),
		normalizedNames: [...entry.normalizedNames].sort(),
		branches: [...entry.branches].sort(),
		classes: [...entry.classes].sort(),
		dateCount: entry.dates.size,
		venueCount: entry.venues.size,
		raceCount: entry.races.size,
		provenanceCompleteAppearanceCount: entry.provenanceCompleteAppearanceCount,
	});
	const serializeName = (entry) => ({ normalizedName: entry.normalizedName, rawNames: [...entry.rawNames].sort(), registrationNumbers: [...entry.registrations].sort(), appearanceCount: entry.appearances.length });
	const auditDate = index.latestDate;
	const auditRelativePath = `public/data/boatrace-ex/audit/registered-registration-quality-${auditDate}.generated.json`;
	const markdownRelativePath = `docs/boat-ex/registered-registration-quality-${auditDate}.md`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-registered-registration-quality-audit",
		auditDate,
		generatedAt: new Date().toISOString(),
		mode: args.dryRun ? "dry-run" : "write",
		policy: "Audit only. Registration numbers, EX history, and evidence are not changed. Name normalization is used only to classify existing values; it never merges identities or infers registration numbers.",
		sourceFiles: [
			"public/data/boatrace-ex/index.generated.json",
			"public/data/boatrace-ex/manifest.generated.json",
			"public/data/boatrace-ex/audit/registration-coverage-2026-08-02.generated.json",
			"public/data/boatrace-ex/audit/registration-bridge-2026-08-02.generated.json",
			...dates.flatMap((date) => [`public/data/boatrace-ex/history/races/${date}.json`, `public/data/boatrace-ex/derived/racer-evidence/${date}.json`, `public/data/boatrace-ex/derived/venue-evidence/${date}.json`]),
		],
		coverage: { from: dates[0], to: dates.at(-1), dateCount: dates.length, dates, historyModified: false },
		summary: {
			registeredAppearanceCount,
			uniqueRegistrationNoCount: registrations.size,
			uniqueNormalizedRacerNameCount: names.size,
			validRegistrationNoCount,
			invalidRegistrationNoCount,
			duplicateRegistrationNoCount: duplicateRegistrations.length,
			sameRegistrationNoMultipleNameCount: collisions.length,
			sameNameMultipleRegistrationNoCount: sameNameMultipleRegistration.length,
			raceLevelDuplicateRegistrationNoCount: raceDuplicateRegistration.length,
			raceLevelDuplicateBoatNoCount: raceDuplicateBoat.length,
			provenanceCompleteCount,
			provenanceMissingCount,
			collisionCount: collisions.length,
			aliasCandidateCount: aliasCandidates.length,
			safeRegisteredIdentityCount: safeRegistered.length,
			racerEvidenceMatchedRegistrationCount,
			racerEvidenceMismatchCount: evidenceMismatches.length,
		},
		sourceClassification: Object.fromEntries(sourceTypeCounts),
		classification: {
			collision: { count: collisions.length, rule: "One registrationNo maps to multiple normalized racer names; do not merge or rewrite.", examples: collisions.slice(0, SAMPLE_LIMIT).map(serializeRegistration) },
			aliasCandidate: { count: aliasCandidates.length, rule: "One registrationNo has multiple raw spellings but one normalized name; retain existing values and review before any registry normalization.", examples: aliasCandidates.slice(0, SAMPLE_LIMIT).map(serializeRegistration) },
			safeSameRacer: { count: safeRegistered.length, rule: "One normalized name and complete registration provenance for every registered appearance.", examples: safeRegistered.slice(0, SAMPLE_LIMIT).map(serializeRegistration) },
			sameNameMultipleRegistrationNo: { count: sameNameMultipleRegistration.length, rule: "One normalized name maps to multiple registration numbers. Treat as a candidate only; do not merge by name.", examples: sameNameMultipleRegistration.slice(0, SAMPLE_LIMIT).map(serializeName) },
		},
		issues: {
			invalidRegistrationNo: invalid,
			provenanceMissing,
			contextMissing,
			raceDuplicateRegistrationNo: raceDuplicateRegistration,
			raceDuplicateBoatNo: raceDuplicateBoat,
			racerEvidenceMismatch: evidenceMismatches,
		},
		nextSteps: [
			"Preserve all current registrationNo values; this audit does not authorize correction or identity merging.",
			"Carry sourceFetchedAt and provenance from official detail collection into racer-level registration sources.",
			"Review collision and same-name-multiple-registration candidates against dated official records before any registry change.",
			"Keep racer-evidence aggregation keyed by registrationNo only after provenance is complete.",
		],
	};
	const markdown = `# Boat EX Registered Registration Number Quality Audit (${auditDate})\n\n` +
		`## Scope\n\n- period: ${audit.coverage.from} to ${audit.coverage.to}\n- dates: ${audit.coverage.dateCount}\n- EX history modified: no\n\n` +
		`## Summary\n\n` + Object.entries(audit.summary).map(([key, value]) => `- ${key}: ${value}`).join("\n") +
		`\n\n## Classification\n\n- collision: ${audit.classification.collision.count}\n- aliasCandidate: ${audit.classification.aliasCandidate.count}\n- safeSameRacer: ${audit.classification.safeSameRacer.count}\n- sameNameMultipleRegistrationNo: ${audit.classification.sameNameMultipleRegistrationNo.count}\n\n` +
		`## Provenance\n\n` + Object.entries(audit.sourceClassification).map(([key, value]) => `- ${key}: ${value}`).join("\n") +
		`\n\n## Safety\n\nThis is an audit artifact only. It uses no fuzzy matching, does not infer registration numbers, and does not merge same-name candidates.\n`;
	if (!args.dryRun) { writeJson(auditRelativePath, audit); writeText(markdownRelativePath, markdown); }
	console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, auditPath: auditRelativePath, markdownPath: markdownRelativePath, ...audit.summary, sourceClassification: audit.sourceClassification }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; }
