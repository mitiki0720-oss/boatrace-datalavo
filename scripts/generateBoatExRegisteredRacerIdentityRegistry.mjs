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
const completeProvenance = (sources) => (Array.isArray(sources) ? sources : []).some((source) => asText(source?.sourceName) && asText(source?.sourceType) && asText(source?.sourceFetchedAt) && source?.provenance);
const sourceTypes = (sources) => [...new Set((Array.isArray(sources) ? sources : []).filter((source) => asText(source?.sourceName) && asText(source?.sourceType) && asText(source?.sourceFetchedAt) && source?.provenance).map((source) => source.sourceType))].sort();
const pushSample = (samples, value) => { if (samples.length < SAMPLE_LIMIT) samples.push(value); };

function registryIdentity(entry) {
	const first = entry.appearances[0];
	const venues = new Map();
	const raceContexts = new Map();
	for (const appearance of entry.appearances) {
		const venueKey = `${appearance.venueCode}\u0000${appearance.venueName}`;
		const venue = venues.get(venueKey) ?? { venueCode: appearance.venueCode, venueName: appearance.venueName, appearanceCount: 0 };
		venue.appearanceCount += 1;
		venues.set(venueKey, venue);
		const raceKey = `${appearance.date}\u0000${appearance.venueCode}\u0000${appearance.raceNo}\u0000${appearance.boatNo}`;
		raceContexts.set(raceKey, { date: appearance.date, venueCode: appearance.venueCode, venueName: appearance.venueName, raceNo: appearance.raceNo, boatNo: appearance.boatNo });
	}
	return {
		registrationNo: entry.registrationNo,
		canonicalRacerName: first.racerName,
		normalizedRacerName: first.normalizedRacerName,
		nameVariants: [...entry.nameVariants].sort(),
		appearanceCount: entry.appearances.length,
		firstSeenDate: [...entry.dates].sort()[0],
		lastSeenDate: [...entry.dates].sort().at(-1),
		venues: [...venues.values()].sort((left, right) => left.venueCode.localeCompare(right.venueCode)),
		sourceTypes: [...entry.sourceTypes].sort(),
		provenanceCount: entry.appearances.length,
		evidenceDates: [...entry.dates].sort(),
		raceContexts: [...raceContexts.values()].sort((left, right) => `${left.date}:${left.venueCode}:${left.raceNo}:${left.boatNo}`.localeCompare(`${right.date}:${right.venueCode}:${right.raceNo}:${right.boatNo}`)),
	};
}

function currentDayRegistryIdentity(entry) {
	const appearances = [...entry.appearances].sort((left, right) => `${left.venueCode}:${left.raceNo}:${left.boatNo}`.localeCompare(`${right.venueCode}:${right.raceNo}:${right.boatNo}`));
	const first = appearances[0];
	const venues = new Map();
	for (const appearance of appearances) {
		const key = `${appearance.venueCode}\u0000${appearance.venueName}`;
		const venue = venues.get(key) ?? { venueCode: appearance.venueCode, venueName: appearance.venueName, appearanceCount: 0 };
		venue.appearanceCount += 1;
		venues.set(key, venue);
	}
	return {
		registrationNo: entry.registrationNo,
		canonicalRacerName: first.racerName,
		normalizedRacerName: first.normalizedRacerName,
		nameVariants: [...entry.nameVariants].sort(),
		appearanceCount: appearances.length,
		firstSeenDate: entry.date,
		lastSeenDate: entry.date,
		venues: [...venues.values()].sort((left, right) => left.venueCode.localeCompare(right.venueCode)),
		sourceTypes: ["official-current-day"],
		provenanceCount: appearances.length,
		evidenceDates: [entry.date],
		raceContexts: appearances.map((appearance) => ({ date: appearance.date, venueCode: appearance.venueCode, venueName: appearance.venueName, raceNo: appearance.raceNo, boatNo: appearance.boatNo })),
		currentDayProvenance: {
			sourcePath: "public/data/boatrace/today-race-details.generated.json",
			sourceName: entry.sourceName,
			sourceType: "official-current-day",
			sourceFetchedAt: entry.sourceFetchedAt,
			branch: first.branch,
			age: first.age,
			className: first.className,
		},
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson("public/data/boatrace-ex/index.generated.json");
	const dates = (Array.isArray(index.availableDates) ? index.availableDates : []).filter((date) => (!args.from || date >= args.from) && (!args.to || date <= args.to));
	if (dates.length === 0) throw new Error("No Boat EX history dates match the requested range.");
	const entries = new Map();
	const normalizedNames = new Map();
	let unresolvedExcludedCount = 0;
	let provenanceIncompleteRegisteredCount = 0;
	let sourceAppearanceCount = 0;

	for (const date of dates) {
		const history = readJson(`public/data/boatrace-ex/history/races/${date}.json`);
		for (const record of Array.isArray(history.records) ? history.records : []) {
			for (const racer of Array.isArray(record.racer) ? record.racer : []) {
				const registrationNo = asText(racer?.registrationNumber);
				if (!isRegistrationNumber(registrationNo)) { unresolvedExcludedCount += 1; continue; }
				if (!completeProvenance(racer.sources)) { provenanceIncompleteRegisteredCount += 1; continue; }
				sourceAppearanceCount += 1;
				const appearance = {
					date,
					venueCode: asText(record.venueCode),
					venueName: asText(record.venueName),
					raceNo: Number(record.raceNo),
					boatNo: Number(racer.lane),
					racerName: asText(racer.racerName),
					normalizedRacerName: normalizeName(racer.racerName),
				};
				const entry = entries.get(registrationNo) ?? { registrationNo, appearances: [], nameVariants: new Set(), normalizedNames: new Set(), dates: new Set(), sourceTypes: new Set() };
				entry.appearances.push(appearance);
				entry.nameVariants.add(appearance.racerName);
				entry.normalizedNames.add(appearance.normalizedRacerName);
				entry.dates.add(date);
				sourceTypes(racer.sources).forEach((sourceType) => entry.sourceTypes.add(sourceType));
				entries.set(registrationNo, entry);
				const name = normalizedNames.get(appearance.normalizedRacerName) ?? { normalizedRacerName: appearance.normalizedRacerName, registrationNos: new Set(), appearances: [] };
				name.registrationNos.add(registrationNo);
				name.appearances.push(appearance);
				normalizedNames.set(appearance.normalizedRacerName, name);
			}
		}
	}

	const current = readJson("public/data/boatrace/today-race-details.generated.json");
	const currentCandidates = new Map();
	const currentDayInvalidRegistration = [];
	const currentDayIncompleteSource = [];
	for (const venue of Array.isArray(current.venues) ? current.venues : []) {
		const venueSource = asText(venue?.source ?? current.source);
		const sourceFetchedAt = asText(venue?.generatedAt ?? current.generatedAt);
		for (const race of Array.isArray(venue?.races) ? venue.races : []) {
			for (const racer of Array.isArray(race?.racers) ? race.racers : []) {
				const registrationNo = asText(racer?.registrationNo);
				if (!isRegistrationNumber(registrationNo)) { pushSample(currentDayInvalidRegistration, { venueName: asText(venue?.venueName), raceNo: Number(race?.raceNo), racerName: asText(racer?.name), registrationNo }); continue; }
				if (entries.has(registrationNo)) continue;
				const racerName = asText(racer?.name);
				const branch = asText(racer?.branch);
				const age = asText(racer?.age);
				const className = asText(racer?.className ?? racer?.class);
				if (!venueSource.startsWith("official:") || !sourceFetchedAt || !racerName || !branch || !age || !className) {
					pushSample(currentDayIncompleteSource, { venueName: asText(venue?.venueName), raceNo: Number(race?.raceNo), racerName, registrationNo, venueSource, sourceFetchedAt, branch, age, className });
					continue;
				}
				const candidate = currentCandidates.get(registrationNo) ?? { registrationNo, date: asText(current.date), appearances: [], nameVariants: new Set(), normalizedNames: new Set(), sourceName: venueSource, sourceFetchedAt };
				const appearance = { date: asText(current.date), venueCode: asText(venue?.venueCode), venueName: asText(venue?.venueName), raceNo: Number(race?.raceNo), boatNo: Number(racer?.frameNo ?? racer?.lane), racerName, normalizedRacerName: normalizeName(racerName), branch, age, className };
				candidate.appearances.push(appearance);
				candidate.nameVariants.add(racerName);
				candidate.normalizedNames.add(appearance.normalizedRacerName);
				currentCandidates.set(registrationNo, candidate);
			}
		}
	}

	const collisions = [...entries.values()].filter((entry) => entry.normalizedNames.size !== 1 || ![...entry.normalizedNames][0]);
	const safeEntries = [...entries.values()].filter((entry) => entry.normalizedNames.size === 1 && Boolean([...entry.normalizedNames][0]));
	const aliasCandidates = [...normalizedNames.values()].filter((entry) => entry.registrationNos.size > 1);
	const historicalIdentities = safeEntries.map(registryIdentity);
	const historicalNames = new Set(historicalIdentities.map((identity) => identity.normalizedRacerName));
	const currentDayConflicts = [...currentCandidates.values()].filter((entry) => entry.normalizedNames.size !== 1 || historicalNames.has([...entry.normalizedNames][0]));
	const currentDayIdentities = [...currentCandidates.values()]
		.filter((entry) => entry.normalizedNames.size === 1 && !historicalNames.has([...entry.normalizedNames][0]))
		.map(currentDayRegistryIdentity);
	const identities = [...historicalIdentities, ...currentDayIdentities].sort((left, right) => left.registrationNo.localeCompare(right.registrationNo));
	const identityDates = identities.flatMap((identity) => [identity.firstSeenDate, identity.lastSeenDate]).filter(Boolean).sort();
	const auditDate = index.latestDate;
	const registryRelativePath = "public/data/boatrace-ex/identity/registered-racers.generated.json";
	const auditRelativePath = `public/data/boatrace-ex/audit/registered-racer-identity-registry-${auditDate}.generated.json`;
	const markdownRelativePath = `docs/boat-ex/registered-racer-identity-registry-${auditDate}.md`;
	const sourceFiles = [
		"public/data/boatrace-ex/index.generated.json",
		"public/data/boatrace-ex/manifest.generated.json",
		`public/data/boatrace-ex/audit/registered-registration-quality-${auditDate}.generated.json`,
		`public/data/boatrace-ex/audit/registration-provenance-${auditDate}.generated.json`,
		"public/data/boatrace/today-race-details.generated.json",
		...dates.flatMap((date) => [`public/data/boatrace-ex/history/races/${date}.json`, `public/data/boatrace-ex/derived/racer-evidence/${date}.json`]),
	];
	const registry = {
		schemaVersion: 1,
		kind: "boatrace-ex-registered-racer-identity-registry",
		generatedAt: new Date().toISOString(),
		identityPolicy: "registrationNo-primary-key; provenance-complete-only; no name-based merge",
		sourceFiles,
		summary: { identityCount: identities.length, sourceAppearanceCount, firstSeenDate: identityDates[0] ?? null, lastSeenDate: identityDates.at(-1) ?? null, collisionCount: collisions.length, aliasCandidateCount: aliasCandidates.length, unresolvedExcludedCount, provenanceIncompleteRegisteredCount, currentDaySupplementIdentityCount: currentDayIdentities.length, currentDaySupplementSlotCount: currentDayIdentities.reduce((total, identity) => total + identity.appearanceCount, 0), currentDayConflictCount: currentDayConflicts.length, currentDayInvalidRegistrationCount: currentDayInvalidRegistration.length, currentDayIncompleteSourceCount: currentDayIncompleteSource.length },
		identities,
	};
	const serializeCollision = (entry) => ({ registrationNo: entry.registrationNo, normalizedRacerNames: [...entry.normalizedNames].sort(), nameVariants: [...entry.nameVariants].sort(), appearanceCount: entry.appearances.length });
	const serializeAlias = (entry) => ({ normalizedRacerName: entry.normalizedRacerName, registrationNos: [...entry.registrationNos].sort(), appearanceCount: entry.appearances.length });
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-registered-racer-identity-registry-audit",
		auditDate,
		generatedAt: registry.generatedAt,
		mode: args.dryRun ? "dry-run" : "write",
		policy: registry.identityPolicy,
		sourceFiles,
		coverage: { from: dates[0], to: dates.at(-1), dateCount: dates.length, dates, historyModified: false },
		summary: registry.summary,
		classification: {
			collision: { count: collisions.length, examples: collisions.slice(0, SAMPLE_LIMIT).map(serializeCollision) },
			aliasCandidate: { count: aliasCandidates.length, examples: aliasCandidates.slice(0, SAMPLE_LIMIT).map(serializeAlias) },
			safeRegisteredIdentity: { count: identities.length },
			currentDaySupplement: { count: currentDayIdentities.length, slotCount: currentDayIdentities.reduce((total, identity) => total + identity.appearanceCount, 0), rule: "Current-day official registrationNo plus explicit source, timestamp, name, branch, age, and className; no name-based merge." },
			currentDayConflict: { count: currentDayConflicts.length, examples: currentDayConflicts.slice(0, SAMPLE_LIMIT).map((entry) => ({ registrationNo: entry.registrationNo, nameVariants: [...entry.nameVariants].sort() })) },
			currentDayIncompleteSource: { count: currentDayIncompleteSource.length, examples: currentDayIncompleteSource },
		},
		nextSteps: [
			"Racer evidence can resolve an identity by registrationNo against public/data/boatrace-ex/identity/registered-racers.generated.json.",
			"Do not resolve by racerName alone; names that map to multiple registrationNo values remain audit candidates.",
			"Continue to exclude registrationNo-unresolved appearances until an exact official bridge is available.",
		],
	};
	const markdown = `# Boat EX Registered Racer Identity Registry (${auditDate})\n\n` +
		`## Scope\n\n- period: ${dates[0]} to ${dates.at(-1)}\n- source appearances: ${sourceAppearanceCount}\n- registry identities: ${identities.length}\n- first/last seen: ${dates[0]} / ${dates.at(-1)}\n\n` +
		`## Safety\n\n- collision: ${collisions.length}\n- aliasCandidate: ${aliasCandidates.length}\n- unresolved appearances excluded: ${unresolvedExcludedCount}\n- provenance-incomplete registered appearances excluded: ${provenanceIncompleteRegisteredCount}\n\n` +
		`The registry uses registrationNo as its only primary key. It does not modify history and does not merge identities by name.\n\n` +
		`## Racer Evidence Lookup\n\nUse racer evidence's registrationNumber to look up an identity by exact registrationNo. Missing registrationNumber values and names alone must not be used as registry keys.\n`;
	if (!args.dryRun) { writeJson(registryRelativePath, registry); writeJson(auditRelativePath, audit); writeText(markdownRelativePath, markdown); }
	console.log(JSON.stringify({ ok: true, dryRun: args.dryRun, registryPath: registryRelativePath, auditPath: auditRelativePath, markdownPath: markdownRelativePath, ...registry.summary }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; }
