import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const INPUT_FILES = [
	{
		sourceName: "today-race-details.generated.json",
		sourcePath: "public/data/boatrace/today-race-details.generated.json",
	},
	{
		sourceName: "today.generated.json",
		sourcePath: "public/data/boatrace/today.generated.json",
	},
	{
		sourceName: "venue-extras.generated.json",
		sourcePath: "public/data/boatrace/venue-extras.generated.json",
	},
];

const OUTPUT_ROOT = "public/data/boatrace-ex";
const HISTORY_KIND = "boatrace-ex-history-races";
const COVERAGE_KIND = "boatrace-ex-coverage-date";
const MANIFEST_KIND = "boatrace-ex-manifest";

const COVERAGE_FIELDS = [
	"officialRace",
	"officialResult",
	"officialExhibition",
	"weather",
	"waterSurface",
	"motor",
	"boat",
	"racer",
	"prediction",
	"summary",
	"review",
	"derivedSignals",
];

function parseArgs(argv) {
	const args = {
		date: undefined,
		dryRun: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}

		if (arg === "--date") {
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) {
				throw new Error("--date requires YYYY-MM-DD");
			}
			args.date = next;
			index += 1;
			continue;
		}

		throw new Error(`Unknown argument: ${arg}`);
	}

	if (args.date && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
		throw new Error(`Invalid --date value: ${args.date}`);
	}

	return args;
}

function readJsonSource(source) {
	const absolutePath = path.join(repoRoot, source.sourcePath);

	try {
		const raw = fs.readFileSync(absolutePath, "utf8");
		const data = JSON.parse(raw);
		const venueCount = Array.isArray(data.venues) ? data.venues.length : 0;

		return {
			...source,
			data,
			meta: {
				sourceName: source.sourceName,
				sourceType: "official",
				sourcePath: source.sourcePath,
				generatedAt: typeof data.generatedAt === "string" ? data.generatedAt : undefined,
				sourceStatus: venueCount > 0 ? "available" : "parse-empty",
				coverageStatus: venueCount > 0 ? "partial" : "missing",
			},
		};
	} catch (error) {
		return {
			...source,
			data: null,
			meta: {
				sourceName: source.sourceName,
				sourceType: "official",
				sourcePath: source.sourcePath,
				sourceStatus: "unknown",
				coverageStatus: "missing",
				note: error instanceof Error ? error.message : String(error),
			},
		};
	}
}

function toArray(value) {
	if (Array.isArray(value)) return value;
	if (value && typeof value === "object") return Object.values(value);
	return [];
}

function toRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function firstPresent(...values) {
	for (const value of values) {
		if (value !== undefined && value !== null && value !== "") return value;
	}
	return undefined;
}

function compact(value) {
	if (Array.isArray(value)) {
		return value
			.map((item) => compact(item))
			.filter((item) => item !== undefined);
	}

	if (value && typeof value === "object") {
		const next = {};
		for (const [key, child] of Object.entries(value)) {
			const compacted = compact(child);
			if (compacted !== undefined) next[key] = compacted;
		}
		return Object.keys(next).length > 0 ? next : undefined;
	}

	return value === undefined ? undefined : value;
}

function writeJson(filePath, value, dryRun) {
	if (dryRun) return;

	const absolutePath = path.join(repoRoot, filePath);
	fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
	fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function makeSource(meta, overrides = {}) {
	return compact({
		...meta,
		...overrides,
	});
}

function sourceList(...sources) {
	const seen = new Set();
	const result = [];

	for (const source of sources.flat().filter(Boolean)) {
		const key = `${source.sourceName}:${source.sourcePath ?? ""}:${source.sourceStatus}:${source.coverageStatus}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(source);
	}

	return result;
}

function makeRaceKey(date, venueCode, raceNo) {
	return `${date}:${String(venueCode || "unknown").padStart(2, "0")}:${String(raceNo).padStart(2, "0")}`;
}

function normalizeLane(value) {
	const lane = Number(value);
	return Number.isInteger(lane) && lane >= 1 && lane <= 6 ? lane : undefined;
}

function normalizeSessionType(value) {
	const text = String(value ?? "").toLowerCase();
	if (text.includes("morning") || text.includes("モーニング")) return "morning";
	if (text.includes("night") || text.includes("ナイター")) return "night";
	if (text) return "day";
	return "unknown";
}

function normalizeRaceStage(value) {
	const text = String(value ?? "");
	if (text.includes("優勝")) return "final";
	if (text.includes("準優")) return "semi-final";
	if (text.includes("選抜")) return "selection";
	if (text.includes("一般")) return "general";
	if (text.includes("予選")) return "qualifying";
	return "unknown";
}

function findVenue(venues, venue) {
	const code = String(venue?.venueCode ?? "");
	const name = String(venue?.venueName ?? "");

	return venues.find((candidate) => {
		return (
			(code && String(candidate.venueCode ?? "") === code) ||
			(name && String(candidate.venueName ?? "") === name)
		);
	});
}

function findRace(venue, raceNo) {
	return toArray(venue?.races).find((race) => Number(race?.raceNo) === Number(raceNo));
}

function hasAnyField(record, fieldNames) {
	return fieldNames.some((fieldName) => firstPresent(record?.[fieldName]) !== undefined);
}

function statusFromCount(count, expected = 1) {
	if (count >= expected) return "complete";
	if (count > 0) return "partial";
	return "missing";
}

function buildRawOfficialRacers(race, source) {
	return toArray(race?.racers)
		.map((racer) => {
			const lane = normalizeLane(firstPresent(racer.frameNo, racer.lane, racer.frame, racer.boatNumber));
			if (!lane) return undefined;

			return compact({
				lane,
				racerName: firstPresent(racer.name, racer.playerName, racer.boatRacerName),
				registrationNumber: firstPresent(racer.registrationNo, racer.racerId),
				branch: firstPresent(racer.branch, racer.hometown),
				className: firstPresent(racer.grade, racer.class, racer.rank),
				motorNo: firstPresent(racer.motorNo, racer.motorNumber),
				boatNo: firstPresent(racer.boatNo, racer.boatMotorNo, racer.boatEquipmentNo),
				sourceStatus: "available",
				sources: [source],
			});
		})
		.filter(Boolean);
}

function buildRacer(racer, source) {
	const lane = normalizeLane(firstPresent(racer.frameNo, racer.lane, racer.frame, racer.boatNumber));
	if (!lane) return undefined;

	return compact({
		lane,
		racerName: firstPresent(racer.name, racer.playerName, racer.boatRacerName),
		registrationNumber: firstPresent(racer.registrationNo, racer.racerId),
		branch: firstPresent(racer.branch, racer.hometown),
		className: firstPresent(racer.grade, racer.class, racer.rank),
		age: firstPresent(racer.age),
		averageStartTiming: firstPresent(racer.st, racer.avgSt, racer.averageSt, racer.averageStart),
		sourceStatus: "available",
		sources: [source],
	});
}

function buildMotor(racer, extraRow, source) {
	const lane = normalizeLane(firstPresent(racer?.frameNo, racer?.lane, racer?.frame, extraRow?.frameNo));
	if (!lane) return undefined;

	const motorNo = firstPresent(racer?.motorNo, racer?.motorNumber, extraRow?.motorNo);
	const secondRate = firstPresent(racer?.motorSecondRate, racer?.motorTwoRate, racer?.motorQuinellaRate, extraRow?.motorSecondRate);
	const thirdRate = firstPresent(racer?.motorThirdRate);

	if (motorNo === undefined && secondRate === undefined && thirdRate === undefined) return undefined;

	return compact({
		lane,
		motorNo,
		secondRate,
		thirdRate,
		sourceStatus: "available",
		sources: [source],
	});
}

function buildBoat(racer, extraRow, source) {
	const lane = normalizeLane(firstPresent(racer?.frameNo, racer?.lane, racer?.frame, extraRow?.frameNo));
	if (!lane) return undefined;

	const boatNo = firstPresent(racer?.boatNo, racer?.boatMotorNo, racer?.boatEquipmentNo, extraRow?.boatNo);
	const secondRate = firstPresent(racer?.boatSecondRate, racer?.boatTwoRate, racer?.boatQuinellaRate, extraRow?.boatSecondRate);
	const thirdRate = firstPresent(racer?.boatThirdRate);

	if (boatNo === undefined && secondRate === undefined && thirdRate === undefined) return undefined;

	return compact({
		lane,
		boatNo,
		secondRate,
		thirdRate,
		sourceStatus: "available",
		sources: [source],
	});
}

function buildOfficialRace({ date, venue, race, source }) {
	const raceNo = Number(race.raceNo);
	const racers = buildRawOfficialRacers(race, source);

	return compact({
		date,
		venueCode: String(venue.venueCode ?? ""),
		venueName: venue.venueName,
		raceNo,
		title: firstPresent(race.title),
		deadlineAt: firstPresent(race.deadlineTime, race.deadline),
		startAt: firstPresent(race.startTime, race.time),
		racers,
		sources: [source],
	});
}

function buildPayouts(result, source) {
	return toArray(firstPresent(result?.payoutsFull, result?.payouts))
		.map((payout) => compact({
			betType: firstPresent(payout.betType, payout.type, payout.label),
			combination: firstPresent(payout.combination, payout.numbers),
			payoutYen: firstPresent(payout.payoutYen, payout.payout, payout.amount),
			popularity: firstPresent(payout.popularity),
			sourceStatus: "available",
			sources: [source],
		}))
		.filter((payout) => payout?.betType || payout?.combination || payout?.payoutYen !== undefined);
}

function buildOfficialResult({ date, venue, race, source }) {
	const result = toRecord(race.result);
	const finishOrder = toArray(result.finishOrder)
		.map((value) => normalizeLane(value))
		.filter(Boolean);
	const hasResult = finishOrder.length > 0 || hasAnyField(result, ["kimarite", "winningMethod", "winningMove", "payout3tan", "payouts", "payoutsFull"]);
	if (!hasResult) return undefined;

	const startTiming = {};
	for (const row of toArray(firstPresent(result.startInfos, result.startInfo))) {
		const lane = normalizeLane(firstPresent(row.frameNo, row.lane, row.boatNumber));
		if (lane) startTiming[lane] = firstPresent(row.startTiming, row.st);
	}

	return compact({
		date,
		venueCode: String(venue.venueCode ?? ""),
		raceNo: Number(race.raceNo),
		finishOrder,
		trifecta: firstPresent(result.payout3tan?.combination, result.payout3tan?.numbers),
		payout: buildPayouts(result, source),
		winningTechnique: firstPresent(result.kimarite, result.winningMethod, result.winningMove),
		approachOrder: toArray(firstPresent(result.approachOrder, result.entryOrder)).map((value) => normalizeLane(value)).filter(Boolean),
		startTiming: Object.keys(startTiming).length > 0 ? startTiming : undefined,
		refunds: toArray(result.refunds).map(String),
		sources: [source],
	});
}

function mapExhibitionEntry(row, source) {
	const lane = normalizeLane(firstPresent(row.frameNo, row.lane, row.frame, row.boatNumber));
	if (!lane) return undefined;

	return compact({
		lane,
		racerName: firstPresent(row.racerName, row.name, row.playerName),
		exhibitionTime: firstPresent(row.exhibitionTime, row.exhibition, row.displayTime, row.tenjiTime, row.showTime),
		oneLapTime: firstPresent(row.oneLapTime, row.lapTime),
		turnTime: firstPresent(row.turnTime),
		straightTime: firstPresent(row.straightTime),
		startTiming: firstPresent(row.startTiming, row.st),
		course: firstPresent(row.course),
		weight: firstPresent(row.weight),
		sourceStatus: "available",
		sources: [source],
	});
}

function mapStartExhibitionEntry(row, source) {
	const lane = normalizeLane(firstPresent(row.frameNo, row.lane, row.frame, row.boatNumber));
	const course = firstPresent(row.course);
	if (!lane || course === undefined) return undefined;

	return compact({
		course,
		lane,
		startTiming: firstPresent(row.startTiming, row.st),
		sourceStatus: "available",
		sources: [source],
	});
}

function buildOfficialExhibition({ date, venue, race, raceExtra, detailSource, extraSource }) {
	const beforeInfo = toRecord(raceExtra?.officialBeforeInfo);
	const detailEntries = toArray(race.exhibitions).map((row) => mapExhibitionEntry(row, detailSource)).filter(Boolean);
	const extraEntries = toArray(firstPresent(beforeInfo.exhibitionRows, beforeInfo.beforeInfo)).map((row) => mapExhibitionEntry(row, extraSource)).filter(Boolean);
	const entries = detailEntries.length > 0 ? detailEntries : extraEntries;
	const startExhibition = [
		...toArray(beforeInfo.startExhibition),
		...toArray(race.startExhibition),
		...toArray(race.startExhibitions),
	].map((row) => mapStartExhibitionEntry(row, row?.source ? extraSource : detailSource)).filter(Boolean);

	if (entries.length === 0 && startExhibition.length === 0) return undefined;

	return compact({
		date,
		venueCode: String(venue.venueCode ?? ""),
		raceNo: Number(race.raceNo),
		entries,
		startExhibition,
		sources: entries.length > 0 && extraEntries.length > 0 ? sourceList(detailSource, extraSource) : sourceList(detailSource, extraSource),
	});
}

function buildWeather({ date, venue, race, raceExtra, detailSource, extraSource }) {
	const beforeInfo = toRecord(raceExtra?.officialBeforeInfo);
	const candidates = [
		{ data: toRecord(race.weatherActual), source: detailSource },
		{ data: toRecord(race.result?.weatherActual), source: detailSource },
		{ data: toRecord(beforeInfo.weatherActual), source: extraSource },
		{ data: toRecord(beforeInfo.weatherCondition), source: extraSource },
		{ data: toRecord(raceExtra?.weatherCondition), source: extraSource },
		{ data: toRecord(venue.weatherActual), source: detailSource },
	];

	const selected = candidates.find(({ data }) => hasAnyField(data, [
		"weather",
		"weatherText",
		"windDirection",
		"windDirectionText",
		"windSpeed",
		"waveHeight",
		"temperature",
		"airTemperature",
		"waterTemperature",
		"observedAt",
		"updatedAt",
		"fetchedAt",
	]));

	if (!selected) return undefined;

	const data = selected.data;
	return compact({
		date,
		venueCode: String(venue.venueCode ?? ""),
		raceNo: Number(race.raceNo),
		weather: firstPresent(data.weather, data.weatherText),
		windDirection: firstPresent(data.windDirectionText, data.windDirection),
		windSpeedMps: firstPresent(data.windSpeed),
		waveHeightCm: firstPresent(data.waveHeight),
		airTemperatureC: firstPresent(data.airTemperature, data.temperature),
		waterTemperatureC: firstPresent(data.waterTemperature),
		observedAt: firstPresent(data.observedAt, data.updatedAt, data.fetchedAt),
		sources: [selected.source],
	});
}

function buildWaterSurface({ raceExtra, source }) {
	const strategy = toRecord(raceExtra?.edogawaWaterStrategy);
	const waterSurface = toRecord(raceExtra?.waterSurface);
	const memo = firstPresent(strategy.memo, strategy.comment, waterSurface.memo, waterSurface.comment);
	const tide = firstPresent(waterSurface.tide, raceExtra?.tide);
	const waterType = firstPresent(waterSurface.waterType);
	const stableBoard = firstPresent(waterSurface.stableBoard);

	if (memo === undefined && tide === undefined && waterType === undefined && stableBoard === undefined) return undefined;

	return compact({
		waterType,
		tide,
		stableBoard,
		memo,
		sourceStatus: "available",
		sources: [source],
	});
}

function buildRecord(params) {
	const { date, venue, race, raceExtra, sources } = params;
	const detailSource = sources.details;
	const extraSource = sources.extras;
	const venueCode = String(venue.venueCode ?? "");
	const raceNo = Number(race.raceNo);
	const sourceMeta = sourceList(detailSource, sources.today, extraSource);
	const racers = toArray(race.racers);
	const extraMotorRows = toArray(raceExtra?.motorSummary);
	const officialRace = buildOfficialRace({ date, venue, race, source: detailSource });
	const officialResult = buildOfficialResult({ date, venue, race, source: detailSource });
	const officialExhibition = buildOfficialExhibition({ date, venue, race, raceExtra, detailSource, extraSource });
	const weather = buildWeather({ date, venue, race, raceExtra, detailSource, extraSource });
	const waterSurface = buildWaterSurface({ raceExtra, source: extraSource });
	const racer = racers.map((row) => buildRacer(row, detailSource)).filter(Boolean);
	const motor = racers.map((row) => {
		const lane = normalizeLane(firstPresent(row.frameNo, row.lane, row.frame));
		const extraRow = extraMotorRows.find((candidate) => normalizeLane(candidate.frameNo) === lane);
		return buildMotor(row, extraRow, extraRow ? extraSource : detailSource);
	}).filter(Boolean);
	const boat = racers.map((row) => {
		const lane = normalizeLane(firstPresent(row.frameNo, row.lane, row.frame));
		const extraRow = extraMotorRows.find((candidate) => normalizeLane(candidate.frameNo) === lane);
		return buildBoat(row, extraRow, extraRow ? extraSource : detailSource);
	}).filter(Boolean);

	const coverage = {
		officialRace: officialRace ? statusFromCount(officialRace.racers?.length ?? 0, 6) : "missing",
		officialResult: officialResult ? statusFromCount(officialResult.finishOrder?.length ?? 0, 3) : "pending",
		officialExhibition: officialExhibition ? statusFromCount(officialExhibition.entries?.length ?? 0, 6) : "pending",
		weather: weather ? "complete" : "missing",
		waterSurface: waterSurface ? "partial" : "not-supported",
		motor: statusFromCount(motor.length, 6),
		boat: statusFromCount(boat.length, 6),
		racer: statusFromCount(racer.length, 6),
		prediction: "not-supported",
		summary: "not-supported",
		review: "not-supported",
		derivedSignals: "not-supported",
	};

	return compact({
		date,
		venueCode,
		venueName: venue.venueName,
		raceNo,
		raceKey: makeRaceKey(date, venueCode, raceNo),
		raceStage: normalizeRaceStage(race.title),
		sessionType: normalizeSessionType(venue.session),
		officialRace,
		officialResult,
		officialExhibition,
		weather,
		waterSurface,
		motor,
		boat,
		racer,
		sources: sourceMeta,
		coverage,
	});
}

function summarizeCoverage(records, generatedAt, sourceFiles) {
	const fieldTotals = {};
	for (const field of COVERAGE_FIELDS) {
		fieldTotals[field] = { complete: 0, partial: 0, missing: 0, pending: 0, notSupported: 0, unknown: 0 };
	}

	for (const record of records) {
		for (const field of COVERAGE_FIELDS) {
			const status = record.coverage[field];
			const key =
				status === "not-supported" ? "notSupported" :
				status === "complete" ? "complete" :
				status === "partial" ? "partial" :
				status === "missing" ? "missing" :
				status === "pending" ? "pending" :
				"unknown";
			fieldTotals[field][key] += 1;
		}
	}

	const venueMap = new Map();
	for (const record of records) {
		const key = record.venueCode;
		const venue = venueMap.get(key) ?? {
			venueCode: record.venueCode,
			venueName: record.venueName,
			raceCount: 0,
			completeOfficialRaceCount: 0,
			completeResultCount: 0,
			completeExhibitionCount: 0,
			warnings: [],
		};
		venue.raceCount += 1;
		if (record.coverage.officialRace === "complete") venue.completeOfficialRaceCount += 1;
		if (record.coverage.officialResult === "complete") venue.completeResultCount += 1;
		if (record.coverage.officialExhibition === "complete") venue.completeExhibitionCount += 1;
		venueMap.set(key, venue);
	}

	for (const venue of venueMap.values()) {
		if (venue.completeExhibitionCount < venue.raceCount) {
			venue.warnings.push("officialExhibition is not complete for all races");
		}
		if (venue.completeResultCount < venue.raceCount) {
			venue.warnings.push("officialResult is not complete for all races");
		}
	}

	const sourceCoverage = {};
	for (const sourceFile of sourceFiles) {
		sourceCoverage[sourceFile.sourceName] = {
			sourceStatus: sourceFile.sourceStatus,
			coverageStatus: sourceFile.coverageStatus,
			sourcePath: sourceFile.sourcePath,
		};
	}

	return {
		fieldTotals,
		venues: [...venueMap.values()],
		sourceCoverage,
		generatedAt,
	};
}

function computeCoverageStatus(records) {
	if (records.length === 0) return "missing";
	const totalSlots = records.length * COVERAGE_FIELDS.length;
	const completeSlots = records.reduce((sum, record) => (
		sum + COVERAGE_FIELDS.filter((field) => record.coverage[field] === "complete").length
	), 0);
	if (completeSlots === totalSlots) return "complete";
	return completeSlots > 0 ? "partial" : "missing";
}

function buildManifest({ date, generatedAt, historyPath, coveragePath, records, sourceFiles }) {
	return {
		schemaVersion: 1,
		kind: MANIFEST_KIND,
		generatedAt,
		sourceFiles,
		files: [
			{
				path: historyPath,
				kind: "history",
				date,
				generatedAt,
				sourceStatus: records.length > 0 ? "available" : "parse-empty",
				coverageStatus: computeCoverageStatus(records),
			},
			{
				path: coveragePath,
				kind: "coverage",
				date,
				generatedAt,
				sourceStatus: records.length > 0 ? "available" : "parse-empty",
				coverageStatus: "partial",
			},
		],
	};
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const sources = Object.fromEntries(
		INPUT_FILES.map((source) => {
			const loaded = readJsonSource(source);
			return [source.sourceName, loaded];
		}),
	);
	const details = sources["today-race-details.generated.json"];
	const today = sources["today.generated.json"];
	const extras = sources["venue-extras.generated.json"];
	const date = args.date ?? details.data?.date ?? today.data?.date ?? extras.data?.date;

	if (!date) {
		throw new Error("Could not resolve target date from --date or generated feeds.");
	}

	const detailVenues = toArray(details.data?.venues).filter((venue) => !args.date || venue.date === date || details.data?.date === date);
	const todayVenues = toArray(today.data?.venues);
	const extraVenues = toArray(extras.data?.venues);
	const detailSource = makeSource(details.meta, { coverageStatus: detailVenues.length > 0 ? "partial" : "missing" });
	const todaySource = makeSource(today.meta);
	const extraSource = makeSource(extras.meta);
	const records = [];

	for (const venue of detailVenues) {
		const venueDate = venue.date ?? details.data?.date;
		if (venueDate !== date) continue;
		const todayVenue = findVenue(todayVenues, venue);
		const extraVenue = findVenue(extraVenues, venue);

		for (const race of toArray(venue.races)) {
			if (!Number.isFinite(Number(race.raceNo))) continue;
			const raceExtra = findRace(extraVenue, race.raceNo);
			const record = buildRecord({
				date,
				venue,
				race: todayVenue ? { ...findRace(todayVenue, race.raceNo), ...race } : race,
				raceExtra,
				sources: {
					details: detailSource,
					today: todaySource,
					extras: extraSource,
				},
			});
			records.push(record);
		}
	}

	records.sort((left, right) => (
		String(left.venueCode).localeCompare(String(right.venueCode), "ja") ||
		Number(left.raceNo) - Number(right.raceNo)
	));

	const sourceFiles = sourceList(detailSource, todaySource, extraSource);
	const historyPath = `${OUTPUT_ROOT}/history/races/${date}.json`;
	const coveragePath = `${OUTPUT_ROOT}/coverage/${date}.json`;
	const manifestPath = `${OUTPUT_ROOT}/manifest.generated.json`;
	const coverageSummary = summarizeCoverage(records, generatedAt, sourceFiles);
	const historyJson = {
		schemaVersion: 1,
		kind: HISTORY_KIND,
		date,
		generatedAt,
		sourceFiles,
		records,
	};
	const coverageJson = {
		schemaVersion: 1,
		kind: COVERAGE_KIND,
		date,
		generatedAt,
		sourceFiles,
		totals: {
			venues: new Set(records.map((record) => record.venueCode)).size,
			races: records.length,
		},
		fieldTotals: coverageSummary.fieldTotals,
		venues: coverageSummary.venues,
		sourceCoverage: coverageSummary.sourceCoverage,
	};
	const manifestJson = buildManifest({
		date,
		generatedAt,
		historyPath,
		coveragePath,
		records,
		sourceFiles,
	});

	writeJson(historyPath, historyJson, args.dryRun);
	writeJson(coveragePath, coverageJson, args.dryRun);
	writeJson(manifestPath, manifestJson, args.dryRun);

	console.log(JSON.stringify({
		dryRun: args.dryRun,
		date,
		records: records.length,
		venues: coverageJson.totals.venues,
		outputs: [historyPath, coveragePath, manifestPath],
		fieldTotals: coverageJson.fieldTotals,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
}
