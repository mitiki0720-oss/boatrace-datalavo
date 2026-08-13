import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";
const ROUGH_INDEX_PATH = "public/data/boatrace-ex/derived/rough-index/latest.json";
const LATEST_ANALYSIS_PATH = "public/data/boatrace-ex/derived/race-analysis/latest.json";
const SUMMARY_PATH = "public/data/boatrace-ex/derived/race-analysis/history-summary.json";
const HISTORY_INDEX_PATH = "public/data/boatrace-ex/derived/race-analysis/history-index.json";
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";

function parseArgs(argv) {
	const args = { dryRun: false };
	for (const arg of argv) {
		if (arg === "--dry-run") args.dryRun = true;
		else throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function absolute(relativePath) {
	return path.join(repoRoot, ...relativePath.split("/"));
}

function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const target = absolute(relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function availability(value, required = false) {
	return value ? "available" : required ? "missing" : "not-supported";
}

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const digits = value.normalize("NFKC").replace(/[^0-9]/g, "");
	return digits ? Number(digits) : null;
}

function trifectaPayout(result) {
	const payout = (result?.payout ?? []).find((item) => String(item?.betType ?? item?.type ?? "").includes("3連単"))
		?? (result?.payout ?? []).find((item) => item?.combination === result?.trifecta);
	const payoutYen = parseYen(payout?.payoutYen ?? payout?.amount ?? payout?.payout);
	return payoutYen === null ? null : { combination: result?.trifecta ?? null, payoutYen };
}

function hasWeather(record) {
	return [record?.weather?.weather, record?.weather?.windDirection, record?.weather?.windSpeedMps, record?.weather?.waveHeightCm, record?.weather?.waterTemperatureC].some((value) => value !== null && value !== undefined && value !== "");
}

function sourcePathsFor(date) {
	return {
		history: `public/data/boatrace-ex/history/races/${date}.json`,
		coverage: `public/data/boatrace-ex/coverage/${date}.json`,
		racerEvidence: `public/data/boatrace-ex/derived/racer-evidence/${date}.json`,
		venueEvidence: `public/data/boatrace-ex/derived/venue-evidence/${date}.json`,
		dateIndex: INDEX_PATH,
		roughIndex: ROUGH_INDEX_PATH,
		latestAnalysis: LATEST_ANALYSIS_PATH,
	};
}

function buildRacerLookup(racerEvidence) {
	const lookup = new Map();
	for (const racer of racerEvidence.racers ?? []) {
		for (const race of racer.raceEvidence ?? []) lookup.set(`${race.raceKey}:${race.frameNo}`, racer);
	}
	return lookup;
}

function buildRacers(record, racerLookup) {
	return (record.racer ?? record.officialRace?.racers ?? []).map((racer) => {
		const lane = Number(racer.lane);
		const evidence = racerLookup.get(`${record.raceKey}:${lane}`) ?? null;
		const officialRegistrationNo = racer.registrationNumber ? String(racer.registrationNumber) : null;
		const exactNameLinked = !officialRegistrationNo && evidence?.identityLinkMethod === "exact-normalized-name-unique";
		const resolvedRegistrationNo = exactNameLinked && evidence?.resolvedRegistrationNo ? String(evidence.resolvedRegistrationNo) : null;
		return {
			lane: Number.isInteger(lane) ? lane : null,
			racerName: racer.racerName ?? "",
			officialRegistrationNo,
			resolvedRegistrationNo,
			linkageStatus: officialRegistrationNo ? "official-registration" : resolvedRegistrationNo ? "exact-name-linked" : "unresolved",
			identityLinkMethod: evidence?.identityLinkMethod ?? null,
			registrationNoSourceStatus: evidence?.registrationNoSourceStatus ?? null,
			officialRegistrationNoAvailable: Boolean(officialRegistrationNo),
			branch: racer.branch ?? null,
			className: racer.className ?? null,
			motorNo: racer.motorNo ?? null,
			boatNo: racer.boatNo ?? null,
			sourceStatus: racer.sourceStatus ?? "missing",
		};
	}).sort((left, right) => (left.lane ?? 99) - (right.lane ?? 99));
}

function buildRace(record, racerLookup, sourcePaths) {
	const result = record.officialResult ?? null;
	const finishOrder = Array.isArray(result?.finishOrder) ? result.finishOrder : [];
	const payout = trifectaPayout(result);
	const exhibitionEntries = record.officialExhibition?.entries ?? [];
	const racers = buildRacers(record, racerLookup);
	const linkage = {
		racerCount: racers.length,
		officialRegistrationLinkedCount: racers.filter((racer) => racer.linkageStatus === "official-registration").length,
		nameLinkedCount: racers.filter((racer) => racer.linkageStatus === "exact-name-linked").length,
		unresolvedCount: racers.filter((racer) => racer.linkageStatus === "unresolved").length,
		ambiguousCount: 0,
		collisionCount: 0,
	};
	const resultStatus = availability(finishOrder.length > 0, true);
	const payoutStatus = availability(Boolean(payout), true);
	const exhibitionStatus = availability(exhibitionEntries.length > 0, true);
	const weatherStatus = availability(hasWeather(record), true);
	const waterStatus = record.coverage?.waterSurface === "complete" ? "available" : record.coverage?.waterSurface === "not-supported" ? "not-supported" : "missing";
	return {
		date: record.date,
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceNo: record.raceNo,
		raceKey: record.raceKey,
		raceTitle: record.officialRace?.title ?? null,
		closingTime: record.officialRace?.deadlineAt ?? null,
		dayPart: record.sessionType ?? null,
		sourceStatus: record.coverage?.officialRace ?? "missing",
		resultStatus,
		payoutStatus,
		exhibitionStatus,
		weatherStatus,
		waterStatus,
		racerEvidenceStatus: availability(racers.length > 0, true),
		officialResult: {
			finishOrder,
			trifecta: result?.trifecta ?? null,
			trifectaPayoutYen: payout?.payoutYen ?? null,
			winningTechnique: result?.winningTechnique ?? null,
		},
		exhibition: exhibitionEntries.map((entry) => ({ lane: entry.lane ?? null, exhibitionTime: entry.exhibitionTime ?? null, startTiming: entry.startTiming ?? null, course: entry.course ?? null })),
		weather: record.weather ? {
			weather: record.weather.weather ?? null,
			windDirection: record.weather.windDirection ?? null,
			windSpeed: record.weather.windSpeedMps ?? null,
			waveHeight: record.weather.waveHeightCm ?? null,
			waterTemperature: record.weather.waterTemperatureC ?? null,
		} : null,
		waterCondition: record.waterCondition ?? null,
		racers,
		racerLinkageSummary: linkage,
		sourcePaths,
		analysisNotes: [
			`result:${resultStatus}`,
			`payout:${payoutStatus}`,
			`exhibition:${exhibitionStatus}`,
			`weather:${weatherStatus}`,
			`water:${waterStatus}`,
			`racer-linkage:official=${linkage.officialRegistrationLinkedCount},exact-name=${linkage.nameLinkedCount},unresolved=${linkage.unresolvedCount}`,
		],
	};
}

function summarize(races) {
	return {
		raceCount: races.length,
		venueCount: new Set(races.map((race) => race.venueCode)).size,
		resultAvailableRaceCount: races.filter((race) => race.resultStatus === "available").length,
		payoutAvailableRaceCount: races.filter((race) => race.payoutStatus === "available").length,
		exhibitionAvailableRaceCount: races.filter((race) => race.exhibitionStatus === "available").length,
		weatherAvailableRaceCount: races.filter((race) => race.weatherStatus === "available").length,
		waterConditionAvailableRaceCount: races.filter((race) => race.waterStatus === "available").length,
		racerEvidenceAvailableRaceCount: races.filter((race) => race.racerEvidenceStatus === "available").length,
		officialRegistrationLinkedCount: races.reduce((total, race) => total + race.racerLinkageSummary.officialRegistrationLinkedCount, 0),
		nameLinkedCount: races.reduce((total, race) => total + race.racerLinkageSummary.nameLinkedCount, 0),
		unresolvedRacerCount: races.reduce((total, race) => total + race.racerLinkageSummary.unresolvedCount, 0),
	};
}

function mergeManifest(entries, generatedAt) {
	const existing = readJson(MANIFEST_PATH);
	const replaced = new Set(entries.map((entry) => entry.path));
	const files = (existing.files ?? []).filter((entry) => !replaced.has(entry?.path));
	files.push(...entries);
	return { ...existing, generatedAt, files };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const generatedAt = new Date().toISOString();
	const index = readJson(INDEX_PATH);
	const roughIndex = readJson(ROUGH_INDEX_PATH);
	const latestAnalysis = readJson(LATEST_ANALYSIS_PATH);
	const dateSummaries = [];
	const allRaces = [];

	for (const date of index.availableDates ?? []) {
		const sourcePaths = sourcePathsFor(date);
		for (const sourcePath of [sourcePaths.history, sourcePaths.coverage, sourcePaths.racerEvidence, sourcePaths.venueEvidence]) {
			if (!fs.existsSync(absolute(sourcePath))) throw new Error(`Required source is missing: ${sourcePath}`);
		}
		const history = readJson(sourcePaths.history);
		const racerEvidence = readJson(sourcePaths.racerEvidence);
		const races = (history.records ?? []).map((record) => buildRace(record, buildRacerLookup(racerEvidence), sourcePaths))
			.sort((left, right) => left.venueCode.localeCompare(right.venueCode) || left.raceNo - right.raceNo);
		const summary = summarize(races);
		const shardPath = `public/data/boatrace-ex/derived/race-analysis/dates/${date}.json`;
		const shard = {
			schemaVersion: "boat-ex-historical-race-analysis-v1",
			kind: "boatrace-ex-historical-race-analysis-date",
			generatedAt,
			date,
			summary: { ...summary, readiness: { status: races.length === (history.records ?? []).length && races.length > 0 ? "ready" : "available", reason: "Every history record for this date is represented with source-backed availability." } },
			sourceFiles: Object.values(sourcePaths),
			races,
		};
		writeJson(shardPath, shard, args.dryRun);
		dateSummaries.push({ date, path: shardPath, ...summary, readiness: shard.summary.readiness });
		allRaces.push(...races);
	}

	const totals = summarize(allRaces);
	const firstDate = dateSummaries[0]?.date ?? null;
	const latestDate = index.latestDate;
	const latestDateSummary = dateSummaries.find((entry) => entry.date === latestDate) ?? null;
	const summary = {
		schemaVersion: "boat-ex-historical-race-analysis-v1",
		kind: "boatrace-ex-historical-race-analysis-summary",
		generatedAt,
		dateRange: { firstDate, latestDate, dateCount: dateSummaries.length },
		summary: {
			...totals,
			readiness: { status: allRaces.length === roughIndex.summary.raceCount ? "ready" : "available", reason: "All indexed history dates are represented as separately fetched source-backed race-analysis shards." },
		},
		sourceFiles: [INDEX_PATH, ROUGH_INDEX_PATH, LATEST_ANALYSIS_PATH],
	};
	const historyIndex = {
		schemaVersion: "boat-ex-historical-race-analysis-v1",
		kind: "boatrace-ex-historical-race-analysis-index",
		generatedAt,
		latestDate,
		dateCount: dateSummaries.length,
		summary: summary.summary,
		dates: dateSummaries,
		sourceFiles: [INDEX_PATH, SUMMARY_PATH],
	};
	const auditPath = `public/data/boatrace-ex/audit/historical-race-analysis-coverage-${latestDate}.generated.json`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-historical-race-analysis-coverage-audit",
		auditDate: latestDate,
		generatedAt,
		expected: {
			dateCount: index.availableDates.length,
			raceCount: roughIndex.summary.raceCount,
			resultAvailableRaceCount: roughIndex.summary.resultAvailableRaceCount,
			payoutAvailableRaceCount: roughIndex.summary.payoutAvailableRaceCount,
			latestRaceCount: latestAnalysis.summary.latestRaceCount,
		},
		actual: { dateCount: dateSummaries.length, ...totals, latestRaceCount: latestDateSummary?.raceCount ?? 0 },
		duplicateRaceKeys: allRaces.filter((race, position) => allRaces.findIndex((candidate) => candidate.raceKey === race.raceKey) !== position).map((race) => race.raceKey),
		policy: "Historical race analysis exposes only source-backed availability and official facts. It does not generate predictions, scores, ranks, tickets, guessed identities, inferred values, fuzzy matches, or partial name matches.",
		sourceFiles: [INDEX_PATH, ROUGH_INDEX_PATH, LATEST_ANALYSIS_PATH, SUMMARY_PATH, HISTORY_INDEX_PATH],
	};
	const manifest = mergeManifest([
		{ path: SUMMARY_PATH, kind: summary.kind, date: latestDate, sourceStatus: "available", coverageStatus: summary.summary.readiness.status, recordCount: totals.raceCount },
		{ path: HISTORY_INDEX_PATH, kind: historyIndex.kind, date: latestDate, sourceStatus: "available", coverageStatus: summary.summary.readiness.status, recordCount: dateSummaries.length },
	], generatedAt);

	writeJson(SUMMARY_PATH, summary, args.dryRun);
	writeJson(HISTORY_INDEX_PATH, historyIndex, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, dateCount: dateSummaries.length, historyRaceCount: totals.raceCount, latestDate, latestRaceCount: latestDateSummary?.raceCount ?? 0, resultAvailableRaceCount: totals.resultAvailableRaceCount, payoutAvailableRaceCount: totals.payoutAvailableRaceCount, summaryPath: SUMMARY_PATH, historyIndexPath: HISTORY_INDEX_PATH, auditPath }, null, 2));
}

main();
