import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const OUTPUT_ROOT = "public/data/boatrace-ex/derived";
const KIND = "boatrace-ex-racer-evidence";
const MANIFEST_KIND = "boatrace-ex-derived-manifest";
const IDENTITY_REGISTRY_PATH = "public/data/boatrace-ex/identity/registered-racers.generated.json";

function parseArgs(argv) {
	const args = {
		date: undefined,
		dryRun: false,
		allowEmpty: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--date") {
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD");
			args.date = next;
			index += 1;
			continue;
		}
		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}
		if (arg === "--allow-empty") {
			args.allowEmpty = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
		throw new Error(`Invalid --date value: ${args.date}`);
	}

	return args;
}

function readJson(relativePath) {
	const absolutePath = path.join(repoRoot, relativePath);
	return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readJsonIfExists(relativePath) {
	const absolutePath = path.join(repoRoot, relativePath);
	if (!fs.existsSync(absolutePath)) return null;
	return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function readRequiredInputs({ date, allowEmpty }) {
	try {
		return {
			history: readJson(`public/data/boatrace-ex/history/races/${date}.json`),
			coverage: readJson(`public/data/boatrace-ex/coverage/${date}.json`),
		};
	} catch (error) {
		if (!allowEmpty) throw error;
		const generatedAt = new Date().toISOString();
		return {
			history: {
				schemaVersion: 1,
				kind: "boatrace-ex-history-races",
				date,
				generatedAt,
				sourceFiles: [],
				records: [],
			},
			coverage: {
				schemaVersion: 1,
				kind: "boatrace-ex-coverage-date",
				date,
				generatedAt,
				sourceFiles: [],
				totals: { venues: 0, races: 0 },
				venues: [],
			},
		};
	}
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const absolutePath = path.join(repoRoot, relativePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toArray(value) {
	return Array.isArray(value) ? value : [];
}

function toRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function parseNumber(value) {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	const normalized = trimmed.startsWith(".") ? `0${trimmed}` : trimmed;
	const match = normalized.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/u)?.[0];
	if (!match) return undefined;
	const parsed = Number(match);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function average(values) {
	const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value));
	if (numbers.length === 0) return null;
	return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 1000) / 1000;
}

function min(values) {
	const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value));
	return numbers.length > 0 ? Math.min(...numbers) : null;
}

function max(values) {
	const numbers = values.filter((value) => typeof value === "number" && Number.isFinite(value));
	return numbers.length > 0 ? Math.max(...numbers) : null;
}

function sourceFilesFor(date, history, coverage, venueEvidence) {
	const sourceFiles = [
		{
			sourceName: "boatrace-ex-history-races",
			sourceType: "derived",
			sourcePath: `public/data/boatrace-ex/history/races/${date}.json`,
			generatedAt: history.generatedAt,
			sourceStatus: toArray(history.records).length > 0 ? "available" : "parse-empty",
			coverageStatus: toArray(history.records).length > 0 ? "partial" : "missing",
		},
		{
			sourceName: "boatrace-ex-coverage",
			sourceType: "derived",
			sourcePath: `public/data/boatrace-ex/coverage/${date}.json`,
			generatedAt: coverage.generatedAt,
			sourceStatus: coverage?.totals?.races > 0 ? "available" : "parse-empty",
			coverageStatus: coverage?.totals?.races > 0 ? "partial" : "missing",
		},
	];

	if (venueEvidence) {
		sourceFiles.push({
			sourceName: "boatrace-ex-venue-evidence",
			sourceType: "derived",
			sourcePath: `public/data/boatrace-ex/derived/venue-evidence/${date}.json`,
			generatedAt: venueEvidence.generatedAt,
			sourceStatus: "available",
			coverageStatus: "partial",
			note: "Optional venue context source for racer evidence v0.",
		});
	}

	return sourceFiles;
}

function readiness() {
	return {
		racerProfile: {
			status: "insufficient-history",
			reason: "Only 1 history day is available. Racer profile requires accumulated evidence.",
		},
		courseChangePattern: {
			status: "insufficient-history",
			reason: "Course-change pattern requires repeated source-backed approach/exhibition evidence.",
		},
		exhibitionReliability: {
			status: "insufficient-history",
			reason: "Exhibition reliability requires multi-race comparison of exhibition and race results.",
		},
		startTimingPattern: {
			status: "insufficient-history",
			reason: "Start timing pattern requires accumulated ST evidence.",
		},
		predictionSignals: {
			status: "pending",
			reason: "Prediction signal generation is scheduled for a later phase.",
		},
	};
}

function normalizeName(value) {
	return String(value ?? "").trim().normalize("NFKC").replace(/\s+/gu, " ");
}

function isRegistrationNumber(value) {
	const normalized = String(value ?? "").trim();
	return /^\d{4,6}$/u.test(normalized) && normalized !== "0000";
}

function buildIdentityNameIndex(identities) {
	const names = new Map();
	for (const identity of identities) {
		if (!isRegistrationNumber(identity?.registrationNo)) continue;
		for (const value of [
			identity.normalizedRacerName,
			identity.canonicalRacerName,
			...toArray(identity.nameVariants),
		]) {
			const normalizedName = normalizeName(value);
			if (!normalizedName) continue;
			const entry = names.get(normalizedName) ?? { identities: new Map() };
			entry.identities.set(String(identity.registrationNo), identity);
			names.set(normalizedName, entry);
		}
	}
	return names;
}

function resolveNameLinkedIdentity(racer, identityNameIndex) {
	if (isRegistrationNumber(racer?.registrationNumber)) return { status: "official-registration-number-present" };
	const normalizedName = normalizeName(racer?.racerName);
	if (!normalizedName) return { status: "missing-name" };
	const entry = identityNameIndex.get(normalizedName);
	if (!entry) return { status: "registry-missing", normalizedName };
	if (entry.identities.size !== 1) {
		return {
			status: "ambiguous",
			normalizedName,
			candidateRegistrationNos: [...entry.identities.keys()].sort(),
		};
	}
	return {
		status: "exact-normalized-name-unique",
		normalizedName,
		identity: [...entry.identities.values()][0],
	};
}

function racerKeyFor(racer, record) {
	const registrationNumber = racer?.registrationNumber;
	if (isRegistrationNumber(registrationNumber)) return `registrationNumber:${registrationNumber}`;
	return [
		"unverified",
		String(racer?.racerName ?? "unknown").trim() || "unknown",
		String(racer?.branch ?? "unknown").trim() || "unknown",
		record.venueCode,
		record.raceNo,
		racer?.lane,
	].join(":");
}

function findByLane(items, lane) {
	return toArray(items).find((item) => Number(item?.lane) === Number(lane));
}

function finishOrderForLane(finishOrder, lane) {
	const index = toArray(finishOrder).findIndex((value) => Number(value) === Number(lane));
	return index >= 0 ? index + 1 : null;
}

function courseForLane(startExhibition, lane) {
	const entry = findByLane(startExhibition, lane);
	const course = parseNumber(entry?.course);
	return course === undefined ? null : course;
}

function finalCourseForLane(approachOrder, lane) {
	const index = toArray(approachOrder).findIndex((value) => Number(value) === Number(lane));
	return index >= 0 ? index + 1 : null;
}

function sourceStatusFromCount(count) {
	return count > 0 ? "partial" : "missing";
}

function addCount(record, key) {
	record[key] = (record[key] ?? 0) + 1;
}

function createAppearance(record, racer, officialRacer) {
	const lane = Number(racer.lane);
	const result = toRecord(record.officialResult);
	const exhibitionEntry = findByLane(record.officialExhibition?.entries, lane);
	const startExhibitionCourse = courseForLane(record.officialExhibition?.startExhibition, lane);
	const finalCourse = finalCourseForLane(result.approachOrder, lane);
	const startTiming = parseNumber(toRecord(result.startTiming)[String(lane)]);
	const exhibitionTime = parseNumber(exhibitionEntry?.exhibitionTime);
	const motor = findByLane(record.motor, lane);
	const boat = findByLane(record.boat, lane);

	return {
		date: record.date,
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceNo: record.raceNo,
		raceKey: record.raceKey,
		frameNo: lane,
		finalCourse,
		exhibitionCourse: startExhibitionCourse ?? courseForLane([exhibitionEntry], lane),
		finishOrder: finishOrderForLane(result.finishOrder, lane),
		startTiming: startTiming ?? null,
		exhibitionTime: exhibitionTime ?? null,
		motorNo: motor?.motorNo ?? officialRacer?.motorNo ?? null,
		boatNo: boat?.boatNo ?? officialRacer?.boatNo ?? null,
		sourceStatus: "available",
	};
}

function buildRacerEvidence(racerKey, appearances, identityRegistry) {
	const first = appearances[0];
	const registrationNumber = isRegistrationNumber(first.registrationNumber) ? String(first.registrationNumber) : null;
	const resolvedRegistrationNo = first.resolvedRegistrationNo ?? null;
	const identityLinkMethod = first.identityLinkMethod ?? null;
	const registrationNoSourceStatus = first.registrationNoSourceStatus ?? null;
	const warnings = [];
	const identityStatus = registrationNumber ? "verified" : resolvedRegistrationNo ? "name-linked" : "unverified";
	if (!registrationNumber && resolvedRegistrationNo) {
		warnings.push("official registrationNumber is missing; identity is name-linked from the registry by exact unique normalized name.");
	} else if (!registrationNumber) {
		warnings.push("registrationNumber is missing; racer identity is unverified.");
	}

	const venues = new Map();
	const frames = {};
	const raceEvidence = [];
	const startValues = [];
	const exhibitionValues = [];
	const finishCounts = {};
	const motorNos = new Set();
	const boatNos = new Set();
	const courseExamples = [];
	let top3Count = 0;
	let winCount = 0;
	let resultAvailableCount = 0;
	let frameToFinalCourseChangedCount = 0;
	let exhibitionToFinalCourseChangedCount = 0;
	let frameFinalComparableCount = 0;
	let exhibitionFinalComparableCount = 0;

	for (const appearance of appearances) {
		const venue = venues.get(appearance.venueCode) ?? {
			venueCode: appearance.venueCode,
			venueName: appearance.venueName,
			raceCount: 0,
		};
		venue.raceCount += 1;
		venues.set(appearance.venueCode, venue);

		const frameKey = String(appearance.frameNo);
		frames[frameKey] = frames[frameKey] ?? {
			count: 0,
			resultAvailableCount: 0,
			exhibitionAvailableCount: 0,
		};
		frames[frameKey].count += 1;

		if (appearance.finishOrder !== null) {
			frames[frameKey].resultAvailableCount += 1;
			resultAvailableCount += 1;
			addCount(finishCounts, String(appearance.finishOrder));
			if (appearance.finishOrder <= 3) top3Count += 1;
			if (appearance.finishOrder === 1) winCount += 1;
		}

		if (appearance.exhibitionTime !== null) {
			frames[frameKey].exhibitionAvailableCount += 1;
			exhibitionValues.push(appearance.exhibitionTime);
		}
		if (appearance.startTiming !== null) startValues.push(appearance.startTiming);
		if (appearance.motorNo) motorNos.add(appearance.motorNo);
		if (appearance.boatNo) boatNos.add(appearance.boatNo);

		if (appearance.finalCourse !== null) {
			frameFinalComparableCount += 1;
			if (Number(appearance.frameNo) !== Number(appearance.finalCourse)) {
				frameToFinalCourseChangedCount += 1;
				courseExamples.push({
					raceKey: appearance.raceKey,
					frameNo: appearance.frameNo,
					finalCourse: appearance.finalCourse,
				});
			}
		}
		if (appearance.exhibitionCourse !== null && appearance.finalCourse !== null) {
			exhibitionFinalComparableCount += 1;
			if (Number(appearance.exhibitionCourse) !== Number(appearance.finalCourse)) {
				exhibitionToFinalCourseChangedCount += 1;
				courseExamples.push({
					raceKey: appearance.raceKey,
					frameNo: appearance.frameNo,
					exhibitionCourse: appearance.exhibitionCourse,
					finalCourse: appearance.finalCourse,
				});
			}
		}

		raceEvidence.push({
			date: appearance.date,
			venueCode: appearance.venueCode,
			venueName: appearance.venueName,
			raceNo: appearance.raceNo,
			raceKey: appearance.raceKey,
			frameNo: appearance.frameNo,
			finishOrder: appearance.finishOrder,
			startTiming: appearance.startTiming,
			exhibitionTime: appearance.exhibitionTime,
			motorNo: appearance.motorNo,
			boatNo: appearance.boatNo,
			sourceStatus: appearance.sourceStatus,
		});
	}

	const registryLookupKey = registrationNumber ?? resolvedRegistrationNo;
	const registryIdentity = registryLookupKey ? identityRegistry.get(String(registryLookupKey)) : null;
	return {
		racerKey,
		identityStatus,
		registrationNumber,
		resolvedRegistrationNo,
		identityLinkMethod,
		registrationNoSourceStatus,
		officialRegistrationNoAvailable: Boolean(registrationNumber),
		racerName: first.racerName,
		branch: first.branch ?? null,
		className: first.className ?? null,
		age: first.age ?? null,
		appearanceCount: appearances.length,
		venues: [...venues.values()].sort((left, right) => String(left.venueCode).localeCompare(String(right.venueCode), "ja")),
		frames,
		raceEvidence: raceEvidence.sort((left, right) => (
			String(left.date).localeCompare(String(right.date)) ||
			String(left.venueCode).localeCompare(String(right.venueCode), "ja") ||
			Number(left.raceNo) - Number(right.raceNo)
		)),
		startEvidence: {
			availableCount: startValues.length,
			averageST: average(startValues),
			minST: min(startValues),
			maxST: max(startValues),
			lateStartCount: null,
			flyingOrLateCount: null,
			sourceStatus: sourceStatusFromCount(startValues.length),
		},
		exhibitionEvidence: {
			availableCount: exhibitionValues.length,
			averageExhibitionTime: average(exhibitionValues),
			bestExhibitionTime: min(exhibitionValues),
			sourceStatus: sourceStatusFromCount(exhibitionValues.length),
		},
		courseChangeEvidence: {
			availableCount: frameFinalComparableCount + exhibitionFinalComparableCount,
			frameToFinalCourseChangedCount: frameFinalComparableCount > 0 ? frameToFinalCourseChangedCount : null,
			exhibitionToFinalCourseChangedCount: exhibitionFinalComparableCount > 0 ? exhibitionToFinalCourseChangedCount : null,
			examples: courseExamples.slice(0, 10),
			sourceStatus: frameFinalComparableCount + exhibitionFinalComparableCount > 0 ? "partial" : "missing",
			note: "Final course / exhibition course comparison is only populated when source-backed course data exists.",
		},
		resultEvidence: {
			availableCount: resultAvailableCount,
			finishCounts,
			top3Count,
			winCount,
			sourceStatus: sourceStatusFromCount(resultAvailableCount),
		},
		motorBoatEvidence: {
			motorNos: [...motorNos].sort(),
			boatNos: [...boatNos].sort(),
			sourceStatus: motorNos.size > 0 || boatNos.size > 0 ? "partial" : "missing",
		},
		...(registryIdentity ? {
			identityRegistryKey: registryIdentity.registrationNo,
			identityRegistryMatched: true,
			identityRegistrySource: registrationNumber ? "registered-racers.generated.json" : "registered-racers.generated.json:name-index",
			canonicalRacerName: registryIdentity.canonicalRacerName,
			normalizedRacerName: registryIdentity.normalizedRacerName,
			nameVariants: registryIdentity.nameVariants,
			registryAppearanceCount: registryIdentity.appearanceCount,
			registryFirstSeenDate: registryIdentity.firstSeenDate,
			registryLastSeenDate: registryIdentity.lastSeenDate,
			registryVenueCount: registryIdentity.venues.length,
			registryProvenanceCount: registryIdentity.provenanceCount,
		} : {}),
		derivedReadiness: readiness(),
		warnings,
	};
}

function createRacerEvidence(date, records, identityRegistry, identityNameIndex) {
	const appearancesByRacer = new Map();

	for (const record of records) {
		const racers = toArray(record.racer);
		for (const racer of racers) {
			if (!racer?.racerName || !Number.isFinite(Number(racer.lane))) continue;
			const officialRacer = findByLane(record.officialRace?.racers, racer.lane);
			const racerKey = racerKeyFor(racer, record);
			const appearance = {
				...createAppearance(record, racer, officialRacer),
				registrationNumber: isRegistrationNumber(racer.registrationNumber) ? String(racer.registrationNumber) : null,
				resolvedRegistrationNo: null,
				identityLinkMethod: null,
				registrationNoSourceStatus: null,
				racerName: racer.racerName,
				branch: racer.branch ?? null,
				className: racer.className ?? null,
				age: racer.age ?? null,
			};
			if (!appearancesByRacer.has(racerKey)) appearancesByRacer.set(racerKey, []);
			appearancesByRacer.get(racerKey).push(appearance);
		}
	}

	return [...appearancesByRacer.entries()]
		.map(([racerKey, appearances]) => buildRacerEvidence(racerKey, appearances, identityRegistry))
		.sort((left, right) => (
			Number(right.appearanceCount) - Number(left.appearanceCount) ||
			String(left.racerName).localeCompare(String(right.racerName), "ja")
		));
}

function createEmptyOutputMessage({ date, records, racers, allowed }) {
	return [
		allowed
			? "Allowing empty BOATRACE EX racer evidence output because --allow-empty was provided."
			: "Refusing to write empty BOATRACE EX racer evidence output.",
		`date: ${date}`,
		`records: ${records}`,
		`racers: ${racers}`,
		"Use --allow-empty only when intentionally creating an empty output.",
	].join("\n");
}

function buildManifestEntry({ outputPath, date, generatedAt, recordCount, racerCount }) {
	return {
		path: outputPath,
		kind: KIND,
		date,
		recordCount,
		racerCount,
		generatedAt,
		sourceStatus: racerCount > 0 ? "available" : "parse-empty",
		coverageStatus: racerCount > 0 ? "partial" : "missing",
	};
}

function mergeManifest({ date, generatedAt, sourceFiles, racerEntry }) {
	const manifestPath = `${OUTPUT_ROOT}/manifest.generated.json`;
	const existing = readJsonIfExists(manifestPath);
	const files = toArray(existing?.files).filter((file) => file?.path !== racerEntry.path);

	files.push(racerEntry);

	return {
		schemaVersion: 1,
		kind: MANIFEST_KIND,
		generatedAt,
		sourceFiles,
		files: files.sort((left, right) => {
			const order = (file) => String(file.path ?? "").includes("/venue-evidence/") ? 0 :
				String(file.path ?? "").includes("/racer-evidence/") ? 1 : 2;
			return order(left) - order(right) || String(left.path ?? "").localeCompare(String(right.path ?? ""));
		}),
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const date = args.date;
	if (!date) throw new Error("--date is required");

	const outputPath = `${OUTPUT_ROOT}/racer-evidence/${date}.json`;
	const manifestPath = `${OUTPUT_ROOT}/manifest.generated.json`;
	const { history, coverage } = readRequiredInputs({ date, allowEmpty: args.allowEmpty });
	const venueEvidence = readJsonIfExists(`${OUTPUT_ROOT}/venue-evidence/${date}.json`);
	const registry = readJsonIfExists(IDENTITY_REGISTRY_PATH);
	const registryIdentities = toArray(registry?.identities);
	const identityRegistry = new Map(registryIdentities.map((identity) => [String(identity.registrationNo), identity]));
	const identityNameIndex = buildIdentityNameIndex(registryIdentities);
	const records = toArray(history.records);
	const racers = createRacerEvidence(date, records, identityRegistry, identityNameIndex);
	const generatedAt = new Date().toISOString();
	const sourceFiles = [
		...sourceFilesFor(date, history, coverage, venueEvidence),
		...(registry ? [{ sourceName: "registered-racers.generated.json", sourceType: "derived", sourcePath: IDENTITY_REGISTRY_PATH, generatedAt: registry.generatedAt, sourceStatus: "available", coverageStatus: "partial" }] : []),
	];
	const appearanceCount = racers.reduce((sum, racer) => sum + racer.appearanceCount, 0);
	const isEmptyOutput = records.length === 0 || racers.length === 0 || appearanceCount === 0;

	if (isEmptyOutput) {
		const message = createEmptyOutputMessage({
			date,
			records: records.length,
			racers: racers.length,
			allowed: args.allowEmpty,
		});
		if (!args.allowEmpty) {
			console.error(message);
			console.log(JSON.stringify({
				dryRun: args.dryRun,
				date,
				records: records.length,
				racers: racers.length,
				outputs: [outputPath, manifestPath],
				refusedEmptyOutput: true,
			}, null, 2));
			process.exitCode = 1;
			return;
		}
		console.warn(message);
	}

	const evidenceJson = {
		schemaVersion: 1,
		kind: KIND,
		date,
		generatedAt,
		sourceFiles,
		summary: {
			racerCount: racers.length,
			appearanceCount,
			officialRegistrationNumberRacerCount: racers.filter((racer) => racer.registrationNumber).length,
			nameLinkedRacerCount: racers.filter((racer) => !racer.registrationNumber && racer.resolvedRegistrationNo).length,
			unresolvedRacerCount: racers.filter((racer) => !racer.registrationNumber && !racer.resolvedRegistrationNo).length,
			historyDays: records.length > 0 ? 1 : 0,
			analysisStatus: records.length > 0 ? "insufficient-history" : "missing",
		},
		racers,
	};
	const manifestJson = mergeManifest({
		date,
		generatedAt,
		sourceFiles,
		racerEntry: buildManifestEntry({
			outputPath,
			date,
			generatedAt,
			recordCount: records.length,
			racerCount: racers.length,
		}),
	});

	writeJson(outputPath, evidenceJson, args.dryRun);
	writeJson(manifestPath, manifestJson, args.dryRun);

	console.log(JSON.stringify({
		dryRun: args.dryRun,
		date,
		records: records.length,
		racers: racers.length,
		appearanceCount,
		outputs: [outputPath, manifestPath],
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
