import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const args = process.argv.slice(2);
const dateOptionIndex = args.indexOf("--date");
const requestedDate = dateOptionIndex >= 0 ? args[dateOptionIndex + 1] : null;
const dryRun = args.includes("--dry-run") || !args.includes("--write");
const fromCurrentGenerated = args.includes("--from-current-generated") || true;

if (dateOptionIndex >= 0 && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate ?? "")) {
	throw new Error("--date requires YYYY-MM-DD");
}
if (args.includes("--dry-run") && args.includes("--write")) {
	throw new Error("Use either --dry-run or --write, not both");
}

const detailsPath = "public/data/boatrace/today-race-details.generated.json";
const extrasPath = "public/data/boatrace/venue-extras.generated.json";
const detailsIndexPath = "public/data/boatrace-ex/source/official-details/index.generated.json";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8").replace(/^\uFEFF/, ""));
const writeJson = (relativePath, value) => {
	const absolutePath = path.join(rootDir, relativePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};
const asNullableString = (value) => {
	if (typeof value !== "string" && typeof value !== "number") return null;
	const text = String(value).trim();
	return text || null;
};
const isAvailableResult = (result) => result && typeof result === "object" && result.status && result.status !== "pending";
const payoutFromResult = (result) => {
	if (!result || typeof result !== "object") return null;
	const keys = ["payout3tan", "payout2tan", "payout3fuku", "payout2fuku", "payoutWide", "payoutWin", "payoutPlace", "payouts", "payoutsFull", "refunds"];
	const payout = Object.fromEntries(keys.map((key) => [key, result[key] ?? null]));
	return Object.values(payout).some((value) => Array.isArray(value) ? value.length > 0 : value !== null) ? payout : null;
};

const details = readJson(detailsPath);
const extras = readJson(extrasPath);
const sourceDate = asNullableString(details.date);
if (!datePattern.test(sourceDate ?? "")) throw new Error(`${detailsPath} does not expose a YYYY-MM-DD date`);
const date = requestedDate ?? sourceDate;
if (date !== sourceDate) {
	throw new Error(`Requested ${date}, but current official detail data is for ${sourceDate}. Historical dates require a saved official snapshot.`);
}
if (!fromCurrentGenerated) throw new Error("Only --from-current-generated is supported by this collector");
if (!String(details.source ?? "").startsWith("official:")) throw new Error(`${detailsPath} is not marked as an official source`);

const extrasByRace = new Map();
for (const venue of extras.venues ?? []) {
	for (const race of venue.races ?? []) {
		extrasByRace.set(`${venue.venueCode}:${race.raceNo}`, race);
	}
}

const venues = (details.venues ?? []).map((venue) => {
	const venueCode = asNullableString(venue.venueCode);
	const races = (venue.races ?? []).map((race) => {
		const extra = extrasByRace.get(`${venueCode}:${race.raceNo}`) ?? null;
		const result = race.result && typeof race.result === "object" ? race.result : null;
		return {
			raceNo: Number(race.raceNo),
			raceId: asNullableString(race.raceId),
			title: asNullableString(race.title),
			deadlineTime: asNullableString(race.deadlineTime),
			startTime: asNullableString(race.startTime),
			status: asNullableString(race.status),
			entries: (race.racers ?? []).map((racer) => ({
				boatNo: racer.boatNumber ?? racer.boatNo ?? null,
				frameNo: racer.frameNo ?? racer.frame ?? null,
				registrationNo: asNullableString(racer.registrationNo ?? racer.registrationNumber),
				racerName: asNullableString(racer.name ?? racer.playerName ?? racer.boatRacerName),
				branch: asNullableString(racer.branch),
				area: asNullableString(racer.hometown),
				age: racer.age ?? null,
				class: asNullableString(racer.class ?? racer.grade ?? racer.rank),
			})),
			exhibition: race.exhibitions ?? [],
			practice: extra?.startExhibition ?? extra?.beforeInfo ?? null,
			weather: extra?.weatherCondition ?? venue.weatherActual ?? null,
			result,
			payout: payoutFromResult(result),
			provenance: {
				detailSource: details.source,
				detailGeneratedAt: details.generatedAt ?? null,
				extraSource: extra?.source ?? null,
				extraSourceType: extra?.sourceType ?? null,
			},
		};
	});
	return {
		venueCode,
		venueName: asNullableString(venue.venueName),
		date: asNullableString(venue.date) ?? date,
		session: asNullableString(venue.session),
		status: asNullableString(venue.status),
		weather: venue.weatherActual ?? null,
		races,
	};
});

const allRaces = venues.flatMap((venue) => venue.races);
const allEntries = allRaces.flatMap((race) => race.entries);
const registrationNoCount = allEntries.filter((entry) => entry.registrationNo !== null).length;
const resultAvailableCount = allRaces.filter((race) => isAvailableResult(race.result)).length;
const payoutAvailableCount = allRaces.filter((race) => race.payout !== null).length;
const snapshot = {
	schemaVersion: 1,
	kind: "boatrace-ex-official-detail-source",
	date,
	generatedAt: new Date().toISOString(),
	sourceName: "BOAT RACE Official Website",
	sourceType: "generated-from-official",
	sourceFetchedAt: details.generatedAt ?? null,
	identityPolicy: "explicit-official-registrationNo-only",
	provenance: {
		sourceFiles: [detailsPath, extrasPath],
		detailSource: details.source,
		detailGeneratedAt: details.generatedAt ?? null,
		extrasSource: extras.source ?? null,
		extrasGeneratedAt: extras.generatedAt ?? null,
		collectionMode: "from-current-generated",
	},
	summary: {
		venueCount: venues.length,
		raceCount: allRaces.length,
		entryCount: allEntries.length,
		registrationNoCount,
		registrationNoMissingCount: allEntries.length - registrationNoCount,
		resultAvailableCount,
		payoutAvailableCount,
		missingFields: {
			registrationNo: allEntries.length - registrationNoCount,
			result: allRaces.length - resultAvailableCount,
			payout: allRaces.length - payoutAvailableCount,
		},
	},
	venues,
};

const snapshotPath = `public/data/boatrace-ex/source/official-details/${date}.json`;
const buildIndex = () => {
	const directory = path.join(rootDir, "public/data/boatrace-ex/source/official-details");
	const snapshots = fs.existsSync(directory)
		? fs.readdirSync(directory, { withFileTypes: true })
			.filter((entry) => entry.isFile() && /^\d{4}-\d{2}-\d{2}\.json$/.test(entry.name))
			.map((entry) => JSON.parse(fs.readFileSync(path.join(directory, entry.name), "utf8").replace(/^\uFEFF/, "")))
			.filter((entry) => entry.kind === "boatrace-ex-official-detail-source")
		: [];
	const current = snapshots.filter((entry) => entry.date !== date);
	current.push(snapshot);
	current.sort((left, right) => left.date.localeCompare(right.date));
	return {
		schemaVersion: 1,
		kind: "boatrace-ex-official-detail-source-index",
		generatedAt: new Date().toISOString(),
		sourceType: "generated-from-official",
		availableDates: current.map((entry) => entry.date),
		latestDate: current.at(-1)?.date ?? null,
		summary: {
			dateCount: current.length,
			venueCount: current.reduce((sum, entry) => sum + Number(entry.summary?.venueCount ?? 0), 0),
			raceCount: current.reduce((sum, entry) => sum + Number(entry.summary?.raceCount ?? 0), 0),
			entryCount: current.reduce((sum, entry) => sum + Number(entry.summary?.entryCount ?? 0), 0),
			registrationNoCount: current.reduce((sum, entry) => sum + Number(entry.summary?.registrationNoCount ?? 0), 0),
		},
		dates: current.map((entry) => ({
			date: entry.date,
			path: `public/data/boatrace-ex/source/official-details/${entry.date}.json`,
			generatedAt: entry.generatedAt,
			sourceFetchedAt: entry.sourceFetchedAt,
			summary: entry.summary,
		})),
	};
};

const index = buildIndex();
if (!dryRun) {
	writeJson(snapshotPath, snapshot);
	writeJson(detailsIndexPath, index);
}

console.log(JSON.stringify({
	ok: true,
	dryRun,
	date,
	snapshotPath,
	indexPath: detailsIndexPath,
	summary: snapshot.summary,
	availableDates: index.availableDates,
}, null, 2));
