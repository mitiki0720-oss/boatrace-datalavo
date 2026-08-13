import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const OUTPUT_PATH = "public/data/boatrace-ex/derived/race-analysis/latest.json";
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";

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

function readJsonIfExists(relativePath) {
	const filePath = absolute(relativePath);
	return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, "utf8")) : null;
}

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function statusFor(value, required = false) {
	return value ? "available" : required ? "missing" : "not-supported";
}

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	if (typeof value !== "string") return null;
	const normalized = value.normalize("NFKC").replace(/[\s,円¥￥]/g, "");
	return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function trifectaPayout(officialResult) {
	const payout = (officialResult?.payout ?? []).find((item) => /3連単|三連単|trifecta/i.test(String(item?.betType ?? item?.type ?? item?.name ?? "")));
	if (!payout) return null;
	for (const value of [payout.payoutYen, payout.amount, payout.payoutAmount, payout.payout, payout.yen]) {
		const parsed = parseYen(value);
		if (parsed !== null) return { combination: payout.combination ?? officialResult?.trifecta ?? null, payoutYen: parsed };
	}
	return null;
}

function hasWeather(record) {
	return [record?.weather?.weather, record?.weather?.windDirection, record?.weather?.windSpeedMps, record?.weather?.waveHeightCm, record?.weather?.waterTemperatureC].some(Boolean);
}

function sourcePathsFor(targetDate) {
	return {
		history: `public/data/boatrace-ex/history/races/${targetDate}.json`,
		coverage: `public/data/boatrace-ex/coverage/${targetDate}.json`,
		racerEvidence: `public/data/boatrace-ex/derived/racer-evidence/${targetDate}.json`,
		venueEvidence: `public/data/boatrace-ex/derived/venue-evidence/${targetDate}.json`,
		todayFlow: "public/data/boatrace-ex/derived/today-flow/latest.json",
		roughIndex: "public/data/boatrace-ex/derived/rough-index/latest.json",
		predictionStructure: "public/data/boatrace-ex/derived/prediction-structure/latest.json",
		nameIdentityAudit: `public/data/boatrace-ex/audit/name-identity-bridge-${targetDate}.generated.json`,
		registryLinkageAudit: `public/data/boatrace-ex/audit/racer-evidence-registry-linkage-${targetDate}.generated.json`,
	};
}

function buildRacerLookup(racerEvidence) {
	const lookup = new Map();
	for (const racer of racerEvidence.racers ?? []) {
		for (const race of racer.raceEvidence ?? []) {
			const key = `${race.raceKey}:${race.frameNo}`;
			lookup.set(key, racer);
		}
	}
	return lookup;
}

function buildRacerRows(record, racerLookup) {
	const rows = [];
	for (const racer of record.racer ?? record.officialRace?.racers ?? []) {
		const lane = Number(racer.lane);
		const evidence = racerLookup.get(`${record.raceKey}:${lane}`) ?? null;
		const officialRegistrationNo = racer.registrationNumber ?? null;
		const resolvedRegistrationNo = !officialRegistrationNo && evidence?.identityLinkMethod === "exact-normalized-name-unique"
			? evidence.resolvedRegistrationNo ?? null
			: null;
		const linkageStatus = officialRegistrationNo
			? "official-registration"
			: resolvedRegistrationNo
				? "exact-name-linked"
				: "unresolved";
		rows.push({
			lane: Number.isInteger(lane) ? lane : null,
			racerName: racer.racerName ?? "",
			officialRegistrationNo,
			resolvedRegistrationNo,
			linkageStatus,
			branch: racer.branch ?? null,
			className: racer.className ?? null,
			motorNo: racer.motorNo ?? null,
			boatNo: racer.boatNo ?? null,
			sourceStatus: racer.sourceStatus ?? "missing",
		});
	}
	return rows.sort((left, right) => (left.lane ?? 99) - (right.lane ?? 99));
}

function createAnalysisNotes({ resultStatus, payoutStatus, exhibitionStatus, weatherStatus, waterStatus, linkage }) {
	const notes = [];
	notes.push(resultStatus === "available" ? "結果は取得済み。" : "結果は未取得。");
	notes.push(payoutStatus === "available" ? "3連単払戻は取得済み。" : "3連単払戻は未取得。");
	notes.push(exhibitionStatus === "available" ? "展示情報は取得済み。" : "展示情報は未取得。");
	if (weatherStatus === "available") notes.push("天候・風・波の情報は取得済み。");
	if (waterStatus === "available") notes.push("水面情報は取得済み。");
	if (linkage.unresolvedCount > 0) notes.push(`選手${linkage.racerCount}名中${linkage.unresolvedCount}名は未解決のまま保持。`);
	else notes.push(`選手${linkage.racerCount}名の登録番号または完全一致リンクを確認。`);
	return notes;
}

function buildRace(record, racerLookup, paths) {
	const officialResult = record.officialResult ?? null;
	const finishOrder = Array.isArray(officialResult?.finishOrder) && officialResult.finishOrder.length ? officialResult.finishOrder : [];
	const payout = trifectaPayout(officialResult);
	const exhibitionEntries = record.officialExhibition?.entries ?? [];
	const racerRows = buildRacerRows(record, racerLookup);
	const linkage = {
		racerCount: racerRows.length,
		officialRegistrationLinkedCount: racerRows.filter((racer) => racer.linkageStatus === "official-registration").length,
		nameLinkedCount: racerRows.filter((racer) => racer.linkageStatus === "exact-name-linked").length,
		unresolvedCount: racerRows.filter((racer) => racer.linkageStatus === "unresolved").length,
		ambiguousCount: 0,
		collisionCount: 0,
	};
	const resultStatus = statusFor(finishOrder.length > 0, true);
	const payoutStatus = statusFor(Boolean(payout), true);
	const exhibitionStatus = statusFor(exhibitionEntries.length > 0, true);
	const weatherStatus = statusFor(hasWeather(record), true);
	const waterStatus = record.coverage?.waterSurface === "complete" ? "available" : record.coverage?.waterSurface === "not-supported" ? "not-supported" : "missing";
	const racerEvidenceStatus = statusFor(linkage.racerCount > 0, true);
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
		predictionStructureStatus: record.coverage?.prediction ?? "not-supported",
		racerEvidenceStatus,
		officialResult: {
			finishOrder,
			trifecta: officialResult?.trifecta ?? null,
			trifectaPayoutYen: payout?.payoutYen ?? null,
			winningTechnique: officialResult?.winningTechnique ?? null,
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
		racers: racerRows,
		racerLinkageSummary: linkage,
		sourcePaths: paths,
		analysisNotes: createAnalysisNotes({ resultStatus, payoutStatus, exhibitionStatus, weatherStatus, waterStatus, linkage }),
	};
}

function mergeManifest(entry, generatedAt) {
	const existing = readJsonIfExists(MANIFEST_PATH);
	const files = Array.isArray(existing?.files) ? existing.files.filter((file) => file?.path !== entry.path) : [];
	files.push(entry);
	return { schemaVersion: 1, kind: "boatrace-ex-derived-manifest", generatedAt, sourceFiles: Array.isArray(existing?.sourceFiles) ? existing.sourceFiles : [], files };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson(INDEX_PATH);
	const targetDate = index.latestDate;
	if (!index.availableDates?.includes(targetDate)) throw new Error("latestDate must be included in availableDates");
	const paths = sourcePathsFor(targetDate);
	for (const sourcePath of Object.values(paths)) {
		if (!fs.existsSync(absolute(sourcePath))) throw new Error(`Required source is missing: ${sourcePath}`);
	}
	const history = readJson(paths.history);
	const venueEvidence = readJson(paths.venueEvidence);
	const racerEvidence = readJson(paths.racerEvidence);
	const todayFlow = readJson(paths.todayFlow);
	const roughIndex = readJson(paths.roughIndex);
	const historyRecords = history.records ?? [];
	const racerLookup = buildRacerLookup(racerEvidence);
	const races = historyRecords.map((record) => buildRace(record, racerLookup, paths)).sort((left, right) => left.venueCode.localeCompare(right.venueCode) || left.raceNo - right.raceNo);
	const summary = {
		generatedAt: new Date().toISOString(),
		targetDate,
		latestDate: targetDate,
		dateCount: index.availableDates.length,
		historyRaceCount: roughIndex.summary.raceCount,
		latestRaceCount: races.length,
		venueCount: new Set(races.map((race) => race.venueCode)).size,
		resultAvailableRaceCount: races.filter((race) => race.resultStatus === "available").length,
		payoutAvailableRaceCount: races.filter((race) => race.payoutStatus === "available").length,
		exhibitionAvailableRaceCount: races.filter((race) => race.exhibitionStatus === "available").length,
		weatherAvailableRaceCount: races.filter((race) => race.weatherStatus === "available").length,
		waterConditionAvailableRaceCount: races.filter((race) => race.waterStatus === "available").length,
		racerEvidenceAvailableRaceCount: races.filter((race) => race.racerEvidenceStatus === "available").length,
		officialRegistrationLinkedCount: races.reduce((count, race) => count + race.racerLinkageSummary.officialRegistrationLinkedCount, 0),
		nameLinkedCount: races.reduce((count, race) => count + race.racerLinkageSummary.nameLinkedCount, 0),
		unresolvedRacerCount: races.reduce((count, race) => count + race.racerLinkageSummary.unresolvedCount, 0),
		readiness: races.length === historyRecords.length && races.length > 0
			? { status: "ready", reason: "Every latest-date history record is represented with source-backed status and paths." }
			: { status: "available", reason: "Some latest-date history records are unavailable in the all-race analysis output." },
	};
	const output = {
		schemaVersion: "boat-ex-race-analysis-v1",
		kind: "boatrace-ex-race-analysis",
		generatedAt: summary.generatedAt,
		targetDate,
		summary,
		sourceFiles: Object.values(paths),
		races,
	};
	const auditPath = `public/data/boatrace-ex/audit/race-analysis-coverage-${targetDate}.generated.json`;
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-race-analysis-coverage-audit",
		auditDate: targetDate,
		generatedAt: summary.generatedAt,
		summary,
		expectedRaceCount: historyRecords.length,
		actualRaceCount: races.length,
		venueEvidenceRaceCount: venueEvidence.summary?.recordCount ?? null,
		todayFlowRaceCount: todayFlow.summary?.raceCount ?? null,
		todayFlowResultAvailableRaceCount: todayFlow.summary?.resultAvailableRaceCount ?? null,
		duplicateRaceKeys: races.filter((race, index, all) => all.findIndex((candidate) => candidate.raceKey === race.raceKey) !== index).map((race) => race.raceKey),
		policy: "All records expose source-backed availability only. No prediction, inferred result, fake exhibition, fake payout, score, rank, fuzzy match, or partial name match is generated.",
		sourcePaths: paths,
	};
	const manifest = mergeManifest({ path: OUTPUT_PATH, kind: output.kind, date: targetDate, sourceStatus: "available", coverageStatus: summary.readiness.status, recordCount: races.length, racerCount: summary.officialRegistrationLinkedCount + summary.nameLinkedCount }, summary.generatedAt);
	writeJson(OUTPUT_PATH, output, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, manifest, args.dryRun);
	console.log(JSON.stringify({ ok: true, targetDate, latestRaceCount: summary.latestRaceCount, venueCount: summary.venueCount, resultAvailableRaceCount: summary.resultAvailableRaceCount, payoutAvailableRaceCount: summary.payoutAvailableRaceCount, outputPath: OUTPUT_PATH, auditPath }, null, 2));
}

main();
