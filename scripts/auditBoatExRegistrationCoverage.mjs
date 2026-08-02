import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const args = process.argv.slice(2);
const dateIndex = args.indexOf("--date");
const requestedDate = dateIndex >= 0 ? args[dateIndex + 1] : null;
const dryRun = args.includes("--dry-run");

if (dateIndex >= 0 && (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))) {
	throw new Error("--date requires YYYY-MM-DD");
}

const relative = (...parts) => path.join(...parts);
const readJson = (filePath) => JSON.parse(fs.readFileSync(path.join(rootDir, filePath), "utf8"));
const writeJson = (filePath, value) => fs.writeFileSync(path.join(rootDir, filePath), `${JSON.stringify(value, null, 2)}\n`, "utf8");
const writeText = (filePath, value) => fs.writeFileSync(path.join(rootDir, filePath), value, "utf8");
const readString = (value) => typeof value === "string" ? value.trim() : "";
const isRegistrationNumber = (value) => /^\d{4,6}$/.test(value) && value !== "0000";
const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const index = readJson(relative("public", "data", "boatrace-ex", "index.generated.json"));
const auditDate = requestedDate ?? index.latestDate;
if (!/^\d{4}-\d{2}-\d{2}$/.test(auditDate) || !index.availableDates?.includes(auditDate)) {
	throw new Error(`Audit date is not an available EX history date: ${auditDate}`);
}

const sourcePaths = [
	"public/data/boatrace/today.generated.json",
	"public/data/boatrace/today-race-details.generated.json",
	"public/data/boatrace/upcoming-schedule.generated.json",
	"public/data/boatrace/venue-extras.generated.json",
];

const collectRegistrationPairs = (value, pairs = new Set()) => {
	if (Array.isArray(value)) {
		value.forEach((item) => collectRegistrationPairs(item, pairs));
		return pairs;
	}
	if (!isObject(value)) return pairs;

	const registrationNumber = readString(value.registrationNo ?? value.registrationNumber);
	const racerName = readString(value.racerName ?? value.boatRacerName ?? value.playerName ?? value.name);
	if (isRegistrationNumber(registrationNumber) && racerName) {
		pairs.add(`${registrationNumber}\u0000${racerName}`);
	}
	Object.values(value).forEach((item) => collectRegistrationPairs(item, pairs));
	return pairs;
};

const officialFeeds = sourcePaths.map((sourcePath) => {
	const absolutePath = path.join(rootDir, sourcePath);
	if (!fs.existsSync(absolutePath)) {
		return { sourcePath, exists: false, parsed: false, registrationPairCount: 0 };
	}
	try {
		const pairs = collectRegistrationPairs(JSON.parse(fs.readFileSync(absolutePath, "utf8")));
		return { sourcePath, exists: true, parsed: true, registrationPairCount: pairs.size, pairs };
	} catch (error) {
		return { sourcePath, exists: true, parsed: false, registrationPairCount: 0, error: error.message };
	}
});

const currentOfficialPairs = new Set(officialFeeds.flatMap((feed) => feed.pairs ? [...feed.pairs] : []));
const dateSummaries = [];
const identities = new Map();
const unresolvedIdentities = new Map();
let totalRaceCount = 0;
let totalAppearanceCount = 0;
let registrationAppearanceCount = 0;
let withoutRegistrationAppearanceCount = 0;
const venueKeys = new Set();
const currentDatePairs = new Set();

for (const date of index.availableDates) {
	const historyPath = `public/data/boatrace-ex/history/races/${date}.json`;
	const evidencePath = `public/data/boatrace-ex/derived/racer-evidence/${date}.json`;
	const history = readJson(historyPath);
	const evidence = readJson(evidencePath);
	const participants = [];

	for (const record of history.records ?? []) {
		totalRaceCount += 1;
		venueKeys.add(`${readString(record.venueCode)}\u0000${readString(record.venueName)}`);
		for (const racer of Array.isArray(record.racer) ? record.racer : []) {
			const racerName = readString(racer.racerName);
			const registrationNumber = readString(racer.registrationNumber);
			const lane = Number(racer.lane);
			const racerSources = [...(Array.isArray(racer.sources) ? racer.sources : []), ...(Array.isArray(record.sources) ? record.sources : [])];
			const officialSourceBacked = racerSources.some((source) => source?.sourceType === "official" && source?.sourceStatus === "available");
			const validRegistration = isRegistrationNumber(registrationNumber);
			const fallbackKey = `${date}\u0000${record.venueCode}\u0000${record.raceNo}\u0000${lane}\u0000${racerName || "missing-name"}`;
			const identityKey = validRegistration ? `registrationNumber:${registrationNumber}` : `unresolved:${fallbackKey}`;
			const identity = validRegistration
				? identities.get(identityKey) ?? { identityKey, registrationNumber, names: new Set(), dates: new Set(), appearanceCount: 0, officialSourceBackedAppearanceCount: 0 }
				: unresolvedIdentities.get(identityKey) ?? { identityKey, registrationNumber: null, names: new Set(), dates: new Set(), appearanceCount: 0, officialSourceBackedAppearanceCount: 0 };

			identity.names.add(racerName || "(missing)");
			identity.dates.add(date);
			identity.appearanceCount += 1;
			if (officialSourceBacked) identity.officialSourceBackedAppearanceCount += 1;
			if (validRegistration) identities.set(identityKey, identity);
			else unresolvedIdentities.set(identityKey, identity);

			totalAppearanceCount += 1;
			if (validRegistration) registrationAppearanceCount += 1;
			else withoutRegistrationAppearanceCount += 1;
			participants.push({ racerName, registrationNumber: validRegistration ? registrationNumber : null, officialSourceBacked });
			if (date === auditDate && validRegistration && racerName) currentDatePairs.add(`${registrationNumber}\u0000${racerName}`);
		}
	}

	dateSummaries.push({
		date,
		raceCount: history.records?.length ?? 0,
		venueCount: new Set((history.records ?? []).map((record) => `${readString(record.venueCode)}\u0000${readString(record.venueName)}`)).size,
		racerEvidenceRacerCount: Number(evidence.summary?.racerCount ?? 0),
		racerEvidenceAppearanceCount: Number(evidence.summary?.appearanceCount ?? 0),
		participantAppearanceCount: participants.length,
		registrationAppearanceCount: participants.filter((participant) => participant.registrationNumber).length,
		withoutRegistrationAppearanceCount: participants.filter((participant) => !participant.registrationNumber).length,
	});
}

const safeBridge = [...identities.values()].filter((identity) => identity.officialSourceBackedAppearanceCount > 0);
const candidateBridge = [...identities.values()].filter((identity) => identity.officialSourceBackedAppearanceCount === 0);
const unresolved = [...unresolvedIdentities.values()];
const currentOfficialExactBridgeCount = [...currentDatePairs].filter((pair) => currentOfficialPairs.has(pair)).length;
const historyCoverage = readJson("public/data/boatrace-ex/derived/history-coverage/latest.json");
const derivedReadiness = Object.fromEntries([
	["venueBias", readJson("public/data/boatrace-ex/derived/venue-bias/latest.json")],
	["roughIndex", readJson("public/data/boatrace-ex/derived/rough-index/latest.json")],
	["todayFlow", readJson("public/data/boatrace-ex/derived/today-flow/latest.json")],
	["predictionStructure", readJson("public/data/boatrace-ex/derived/prediction-structure/latest.json")],
].map(([key, value]) => [key, value.readiness?.status ?? value.readiness ?? "unknown"]));

const audit = {
	schemaVersion: 1,
	kind: "boatrace-ex-registration-coverage-audit",
	auditDate,
	generatedAt: new Date().toISOString(),
	sourceFiles: [
		"public/data/boatrace-ex/index.generated.json",
		"public/data/boatrace-ex/manifest.generated.json",
		"public/data/boatrace-ex/derived/history-coverage/latest.json",
		...index.availableDates.flatMap((date) => [
			`public/data/boatrace-ex/history/races/${date}.json`,
			`public/data/boatrace-ex/derived/racer-evidence/${date}.json`,
		]),
		...sourcePaths,
	],
	coverage: {
		latestDate: index.latestDate,
		availableDates: index.availableDates,
		availableDateCount: index.availableDates.length,
		perDate: dateSummaries,
		totalRaceCount,
		totalVenueCount: venueKeys.size,
		totalAppearanceCount,
		derivedReadiness,
		sourceUnresolvedCount: Number(historyCoverage.unresolvedSourceCount ?? 0),
	},
	identityCoverage: {
		racerIdentityCount: identities.size + unresolvedIdentities.size,
		registrationRacerCount: identities.size,
		withoutRegistrationRacerCount: unresolvedIdentities.size,
		registrationAppearanceCount,
		withoutRegistrationAppearanceCount,
		currentOfficialExactBridgeCount,
		currentOfficialUnmatchedBridgeCount: Math.max(currentDatePairs.size - currentOfficialExactBridgeCount, 0),
	},
	bridgeClassification: {
		safeBridge: { count: safeBridge.length, rule: "Explicit registrationNumber with available official source provenance in EX history." },
		candidateBridge: { count: candidateBridge.length, rule: "Explicit registrationNumber exists but official source provenance is absent; do not write automatically." },
		unresolved: { count: unresolved.length, rule: "No valid registrationNumber exists; preserve unresolved without inference." },
	},
	officialGeneratedFeeds: officialFeeds.map(({ pairs, ...feed }) => feed),
	warnings: [
		...(Number(historyCoverage.unresolvedSourceCount ?? 0) > 0 ? [`Historical source index has ${historyCoverage.unresolvedSourceCount} unresolved source materials; they are not racer registration guesses.`] : []),
		...(unresolved.length > 0 ? [`${unresolved.length} racer identities lack an explicit registrationNumber and remain unresolved.`] : []),
	],
	nextBridgePlan: [
		"Add an official-source reader that carries only explicit registrationNo/registrationNumber values into the EX input contract.",
		"Match by the exact source-backed race participant tuple; do not use fuzzy name matching or inferred registration numbers.",
		"Write only safeBridge records after a checker confirms source provenance and registrationNumber format.",
		"Keep candidateBridge and unresolved records as audit output for review; do not backfill them automatically.",
	],
};

const auditRelativePath = `public/data/boatrace-ex/audit/registration-coverage-${auditDate}.generated.json`;
const markdownRelativePath = `docs/boat-ex/registration-coverage-audit-${auditDate}.md`;
const markdown = `# Boat EX Registration Coverage Audit (${auditDate})\n\n` +
	`## Actual Coverage\n\n` +
	`- latestDate: ${audit.coverage.latestDate}\n` +
	`- availableDates: ${audit.coverage.availableDates.join(", ")}\n` +
	`- total races: ${audit.coverage.totalRaceCount}\n` +
	`- total venues: ${audit.coverage.totalVenueCount}\n` +
	`- total participant appearances: ${audit.coverage.totalAppearanceCount}\n` +
	`- registration-backed racer identities: ${audit.identityCoverage.registrationRacerCount}\n` +
	`- racer identities without registration number: ${audit.identityCoverage.withoutRegistrationRacerCount}\n\n` +
	`### Per Date\n\n` +
	`| Date | Races | Venues | Racers | Appearances | Missing registration appearances |\n` +
	`| --- | ---: | ---: | ---: | ---: | ---: |\n` +
	audit.coverage.perDate.map((item) => `| ${item.date} | ${item.raceCount} | ${item.venueCount} | ${item.racerEvidenceRacerCount} | ${item.racerEvidenceAppearanceCount} | ${item.withoutRegistrationAppearanceCount} |`).join("\n") +
	`\n\n` +
	`## Bridge Classification\n\n` +
	`- safeBridge: ${audit.bridgeClassification.safeBridge.count}\n` +
	`- candidateBridge: ${audit.bridgeClassification.candidateBridge.count}\n` +
	`- unresolved: ${audit.bridgeClassification.unresolved.count}\n` +
	`- latest-date exact official registrationNumber and racerName pairs: ${audit.identityCoverage.currentOfficialExactBridgeCount}\n` +
	`- latest-date unmatched explicit pairs: ${audit.identityCoverage.currentOfficialUnmatchedBridgeCount}\n` +
	`- unresolved historical source materials: ${audit.coverage.sourceUnresolvedCount}\n\n` +
	`safeBridge means the EX history already contains an explicit registration number with official source provenance. It is the only class eligible for a future automatic bridge. candidateBridge and unresolved records must not be written automatically.\n\n` +
	`## Readiness\n\n` +
	Object.entries(audit.coverage.derivedReadiness).map(([key, value]) => `- ${key}: ${value}`).join("\n") +
	`\n\n## Next Bridge Plan\n\n` +
	audit.nextBridgePlan.map((step, index) => `${index + 1}. ${step}`).join("\n") +
	`\n\n## Safety\n\n` +
	`This audit reads only official/generated BOATRACE and Boat EX data. It does not read reviews, perform fuzzy matching, infer registration numbers, or backfill racer identities.\n`;

if (!dryRun) {
	fs.mkdirSync(path.dirname(path.join(rootDir, auditRelativePath)), { recursive: true });
	fs.mkdirSync(path.dirname(path.join(rootDir, markdownRelativePath)), { recursive: true });
	writeJson(auditRelativePath, audit);
	writeText(markdownRelativePath, markdown);
}

console.log(JSON.stringify({
	ok: true,
	dryRun,
	auditPath: auditRelativePath,
	markdownPath: markdownRelativePath,
	latestDate: audit.coverage.latestDate,
	availableDateCount: audit.coverage.availableDateCount,
	totalRaceCount: audit.coverage.totalRaceCount,
	totalVenueCount: audit.coverage.totalVenueCount,
	racerIdentityCount: audit.identityCoverage.racerIdentityCount,
	registrationRacerCount: audit.identityCoverage.registrationRacerCount,
	withoutRegistrationRacerCount: audit.identityCoverage.withoutRegistrationRacerCount,
	safeBridgeCount: audit.bridgeClassification.safeBridge.count,
	candidateBridgeCount: audit.bridgeClassification.candidateBridge.count,
	unresolvedCount: audit.bridgeClassification.unresolved.count,
}, null, 2));
