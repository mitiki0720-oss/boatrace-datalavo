import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LATEST_OUTPUT_PATH = "public/data/boatrace-ex/derived/race-analysis/latest.json";
const MANIFEST_PATH = "public/data/boatrace-ex/derived/manifest.generated.json";
const INDEX_PATH = "public/data/boatrace-ex/index.generated.json";

function parseArgs(argv) {
	const args = { date: undefined, dryRun: false };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--dry-run") {
			args.dryRun = true;
			continue;
		}
		if (arg === "--date") {
			const next = argv[index + 1];
			if (!next || next.startsWith("--")) throw new Error("--date requires YYYY-MM-DD or latest");
			args.date = next;
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	if (args.date && args.date !== "latest" && !/^\d{4}-\d{2}-\d{2}$/.test(args.date)) {
		throw new Error(`Invalid --date value: ${args.date}`);
	}
	return args;
}

const absolute = (relativePath) => path.join(repoRoot, ...relativePath.split("/"));
const readJson = (relativePath) => JSON.parse(fs.readFileSync(absolute(relativePath), "utf8"));
const readJsonIfExists = (relativePath) => fs.existsSync(absolute(relativePath)) ? readJson(relativePath) : null;

function writeJson(relativePath, value, dryRun) {
	if (dryRun) return;
	const filePath = absolute(relativePath);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const text = (value) => String(value ?? "").trim();
const array = (value) => Array.isArray(value) ? value : [];
const validFrame = (value) => {
	const frame = Number(value);
	return Number.isInteger(frame) && frame >= 1 && frame <= 6 ? frame : null;
};

function parseYen(value) {
	if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : null;
	const normalized = text(value).normalize("NFKC").replace(/[\s,円¥￥]/g, "");
	return /^\d+$/.test(normalized) ? Number(normalized) : null;
}

function parseStartTiming(value) {
	const normalized = text(value).normalize("NFKC").replace(/^F/iu, "-").replace(/^L/iu, "");
	if (!normalized) return null;
	const number = Number(normalized.startsWith(".") || normalized.startsWith("-.") ? normalized.replace(/^(-?)\./u, "$10.") : normalized);
	return Number.isFinite(number) ? number : null;
}

function trifectaPayout(officialResult) {
	const payout = array(officialResult?.payout).find((item) => /3連単|三連単|trifecta/iu.test(text(item?.betType ?? item?.type ?? item?.name)));
	if (!payout) return null;
	for (const value of [payout.payoutYen, payout.amount, payout.payoutAmount, payout.payout, payout.yen]) {
		const payoutYen = parseYen(value);
		if (payoutYen !== null) {
			return {
				combination: text(payout.combination ?? officialResult?.trifecta) || null,
				payoutYen,
				popularity: Number.isFinite(Number(payout.popularity)) ? Number(payout.popularity) : null,
			};
		}
	}
	return null;
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
	};
}

function sourceMetadata(record) {
	const sources = [
		...array(record.sources),
		...array(record.officialRace?.sources),
		...array(record.officialResult?.sources),
		...array(record.officialExhibition?.sources),
	].filter((source) => source && typeof source === "object");
	const names = [...new Set(sources.map((source) => text(source.sourceName)).filter(Boolean))];
	const acquiredAt = sources
		.flatMap((source) => [source.sourceFetchedAt, source.generatedAt])
		.map(text)
		.filter(Boolean)
		.sort()
		.at(-1) ?? null;
	return {
		source: names.join("+") || null,
		sourceAcquiredAt: acquiredAt,
		available: sources.some((source) => text(source.sourceStatus) === "available" && (text(source.sourceName) || text(source.sourcePath))),
	};
}

function buildRacerRows(record) {
	return array(record.racer ?? record.officialRace?.racers).map((racer) => {
		const lane = validFrame(racer.lane);
		const officialRegistrationNo = /^\d{4,6}$/.test(text(racer.registrationNumber)) ? text(racer.registrationNumber) : null;
		return {
			lane,
			racerName: text(racer.racerName),
			officialRegistrationNo,
			resolvedRegistrationNo: null,
			linkageStatus: officialRegistrationNo ? "official-registration" : "unresolved",
			branch: racer.branch ?? null,
			className: racer.className ?? null,
			motorNo: racer.motorNo ?? null,
			boatNo: racer.boatNo ?? null,
			sourceStatus: racer.sourceStatus ?? "missing",
		};
	}).filter((racer) => racer.lane !== null).sort((left, right) => left.lane - right.lane);
}

function buildStartFacts(officialResult, top3) {
	const startRows = Object.entries(officialResult?.startTiming ?? {})
		.map(([frame, st]) => ({ frame: validFrame(frame), st: text(st), numeric: parseStartTiming(st) }))
		.filter((row) => row.frame !== null && row.numeric !== null)
		.sort((left, right) => left.numeric - right.numeric || left.frame - right.frame);
	const fastest = startRows[0]?.numeric;
	const fastestStartFrames = fastest === undefined
		? []
		: startRows.filter((row) => row.numeric === fastest).map((row) => row.frame);
	return {
		availability: startRows.length > 0 ? "available" : "unavailable",
		startOrder: startRows.map(({ frame, st }) => ({ frame, st })),
		fastestStartFrames,
		fastestStartInTop3Frames: fastestStartFrames.filter((frame) => top3.includes(frame)),
	};
}

function buildExhibitionFacts(record, top3) {
	const displayTimes = array(record.officialExhibition?.entries)
		.map((entry) => ({ frame: validFrame(entry.lane), time: text(entry.exhibitionTime), numeric: Number(entry.exhibitionTime) }))
		.filter((row) => row.frame !== null && row.time && Number.isFinite(row.numeric) && row.numeric > 0)
		.sort((left, right) => left.numeric - right.numeric || left.frame - right.frame);
	const entryCourses = array(record.officialExhibition?.entries)
		.map((entry) => ({ frame: validFrame(entry.lane), course: text(entry.course) }))
		.filter((row) => row.frame !== null && row.course);
	const topExhibitionFrames = displayTimes.slice(0, Math.min(3, displayTimes.length)).map((row) => row.frame);
	return {
		availability: displayTimes.length >= 6 ? "available" : displayTimes.length > 0 ? "partial" : "unavailable",
		timeAvailableCount: displayTimes.length,
		displayTimes: displayTimes.map(({ frame, time }) => ({ frame, time })),
		entryCourses,
		fastestExhibitionFrame: displayTimes[0]?.frame ?? null,
		topExhibitionFrames,
		topExhibitionInTop3Frames: topExhibitionFrames.filter((frame) => top3.includes(frame)),
	};
}

function buildWeatherFacts(record) {
	const weather = record.weather ?? null;
	const values = weather ? [weather.weather, weather.windDirection, weather.windSpeedMps, weather.waveHeightCm] : [];
	return {
		availability: values.some((value) => text(value)) ? "available" : "unavailable",
		weather: weather?.weather ?? null,
		windDirection: weather?.windDirection ?? null,
		windSpeed: weather?.windSpeedMps ?? null,
		waveHeight: weather?.waveHeightCm ?? null,
		waterTemperature: weather?.waterTemperatureC ?? null,
	};
}

function notReadyReasons(record, finishOrder, payout, racers, source) {
	const reasons = [];
	if (!text(record.date) || !text(record.venueCode) || !text(record.venueName) || !Number.isInteger(Number(record.raceNo))) reasons.push("race-identity-missing");
	if (!source.available) reasons.push("source-missing");
	if (racers.length !== 6 || record.coverage?.officialRace !== "complete") reasons.push("entries-incomplete");
	if (finishOrder.length < 3 || record.coverage?.officialResult !== "complete") reasons.push("result-unavailable");
	if (!payout) reasons.push("payout-unavailable");
	return reasons;
}

function buildRace(record, paths) {
	const officialResult = record.officialResult ?? null;
	const finishOrder = array(officialResult?.finishOrder).map(validFrame).filter((frame) => frame !== null).slice(0, 3);
	const payout = trifectaPayout(officialResult);
	const racers = buildRacerRows(record);
	const source = sourceMetadata(record);
	const reasons = notReadyReasons(record, finishOrder, payout, racers, source);
	const status = reasons.length === 0 ? "ready" : "not-ready";
	const top3 = status === "ready" ? finishOrder : [];
	const winnerFrame = top3[0] ?? null;
	const winningMethod = status === "ready" ? text(officialResult?.winningTechnique) || null : null;
	const outsidePodiumFrames = top3.filter((frame) => frame >= 5);
	const startFacts = status === "ready" ? buildStartFacts(officialResult, top3) : null;
	const exhibitionFacts = status === "ready" ? buildExhibitionFacts(record, top3) : null;
	const weatherFacts = status === "ready" ? buildWeatherFacts(record) : null;
	const racerLinkageSummary = {
		racerCount: racers.length,
		officialRegistrationLinkedCount: racers.filter((racer) => racer.linkageStatus === "official-registration").length,
		nameLinkedCount: 0,
		unresolvedCount: racers.filter((racer) => racer.linkageStatus === "unresolved").length,
		ambiguousCount: 0,
		collisionCount: 0,
	};
	const inputs = {
		result: finishOrder.length >= 3 ? "available" : "unavailable",
		payout: payout ? "available" : "unavailable",
		entries: racers.length === 6 ? "available" : racers.length > 0 ? "partial" : "unavailable",
		registrationNumbers: racerLinkageSummary.officialRegistrationLinkedCount === 6 ? "available" : racerLinkageSummary.officialRegistrationLinkedCount > 0 ? "partial" : "unavailable",
		exhibition: array(record.officialExhibition?.entries).length >= 6 ? "available" : array(record.officialExhibition?.entries).length > 0 ? "partial" : "unavailable",
		weather: buildWeatherFacts(record).availability,
	};
	const resultFacts = status === "ready" ? { top3, winningMethod, trifecta: payout } : null;
	const raceFlowFacts = status === "ready" ? {
		winnerFrame,
		inWin: winnerFrame === 1,
		inWinFailed: winnerFrame !== 1,
		sashiObserved: winningMethod === "差し",
		centerAttackObserved: [3, 4].includes(winnerFrame) && ["まくり", "まくり差し"].includes(winningMethod),
		outsideAttackObserved: [5, 6].includes(winnerFrame) && ["まくり", "まくり差し"].includes(winningMethod),
		makuriObserved: winningMethod === "まくり",
		makuriSashiObserved: winningMethod === "まくり差し",
		outsidePodium: outsidePodiumFrames.length > 0,
		outsidePodiumFrames,
	} : null;
	const payoutProfile = status === "ready" ? {
		trifectaPayoutYen: payout.payoutYen,
		trifectaOver10000: payout.payoutYen >= 10000,
		roughnessLabel: payout.payoutYen >= 10000 ? "high" : "standard",
		thresholdYen: 10000,
	} : null;
	const preRaceReviewHints = status === "ready" ? [
		winnerFrame === 1 ? "1号艇の逃げ成功を確認" : `1号艇の逃げ不成立、${winnerFrame}号艇1着を確認`,
		winningMethod ? `決まり手 ${winningMethod}を確認` : "決まり手はsource未取得",
		outsidePodiumFrames.length > 0 ? `外枠${outsidePodiumFrames.join("・")}号艇の3着内浮上を確認` : "5・6号艇の3着内浮上なし",
		exhibitionFacts?.topExhibitionInTop3Frames.length ? `展示上位${exhibitionFacts.topExhibitionInTop3Frames.join("・")}号艇が3着内` : "展示上位艇の3着内該当なし、または展示未取得",
		startFacts?.fastestStartInTop3Frames.length ? `最速ST${startFacts.fastestStartInTop3Frames.join("・")}号艇が3着内` : "最速ST艇の3着内該当なし、またはST未取得",
	] : [];

	return {
		date: record.date,
		venueCode: record.venueCode,
		venueName: record.venueName,
		raceNo: Number(record.raceNo),
		raceKey: record.raceKey,
		analysisKey: record.raceKey,
		status,
		reason: reasons[0] ?? null,
		notReadyReasons: reasons,
		source: source.source,
		sourceAcquiredAt: source.sourceAcquiredAt,
		sourceStatus: record.coverage?.officialRace ?? "missing",
		raceTitle: record.officialRace?.title ?? null,
		closingTime: record.officialRace?.deadlineAt ?? null,
		dayPart: record.sessionType ?? null,
		inputs,
		resultStatus: inputs.result,
		payoutStatus: inputs.payout,
		exhibitionStatus: inputs.exhibition,
		weatherStatus: inputs.weather,
		waterStatus: record.coverage?.waterSurface === "complete" ? "available" : record.coverage?.waterSurface === "not-supported" ? "not-supported" : "missing",
		predictionStructureStatus: record.coverage?.prediction ?? "not-supported",
		racerEvidenceStatus: racers.length > 0 ? "available" : "missing",
		resultFacts,
		raceFlowFacts,
		startFacts,
		exhibitionFacts,
		weatherFacts,
		payoutProfile,
		preRaceReviewHints,
		officialResult: { finishOrder, trifecta: payout?.combination ?? officialResult?.trifecta ?? null, trifectaPayoutYen: payout?.payoutYen ?? null, winningTechnique: winningMethod },
		exhibition: array(record.officialExhibition?.entries).map((entry) => ({ lane: validFrame(entry.lane), exhibitionTime: entry.exhibitionTime ?? null, startTiming: entry.startTiming ?? null, course: entry.course ?? null })),
		weather: record.weather ? { weather: record.weather.weather ?? null, windDirection: record.weather.windDirection ?? null, windSpeed: record.weather.windSpeedMps ?? null, waveHeight: record.weather.waveHeightCm ?? null, waterTemperature: record.weather.waterTemperatureC ?? null } : null,
		waterCondition: record.waterCondition ?? null,
		racers,
		racerLinkageSummary,
		sourcePaths: paths,
		analysisNotes: status === "ready" ? [
			"結果・3連単払戻・出走表をsource-backedで確認済み。",
			`展示 ${inputs.exhibition} / 天候・風・波 ${inputs.weather}。`,
			"結果確定後の事実分析であり、予想・買い目ではありません。",
		] : [`race-analysis未生成: ${reasons.join(", ")}`],
		cautions: ["source-backed facts only", "not a prediction", "not betting advice"],
	};
}

function markDuplicateSourceRace(race, occurrence) {
	return {
		...race,
		analysisKey: `${race.raceKey}#source-${occurrence}`,
		status: "not-ready",
		reason: "duplicate-source-record",
		notReadyReasons: ["duplicate-source-record"],
		resultFacts: null,
		raceFlowFacts: null,
		startFacts: null,
		exhibitionFacts: null,
		weatherFacts: null,
		payoutProfile: null,
		preRaceReviewHints: [],
		analysisNotes: ["race-analysis未生成: duplicate-source-record"],
	};
}

function buildSummary({ races, index, roughIndex, generatedAt, targetDate }) {
	const ready = races.filter((race) => race.status === "ready");
	const reasonCounts = {};
	for (const race of races.filter((item) => item.status === "not-ready")) {
		for (const reason of race.notReadyReasons) reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
	}
	return {
		generatedAt,
		targetDate,
		latestDate: index.latestDate,
		dateCount: index.availableDates.length,
		historyRaceCount: roughIndex.summary.raceCount,
		latestRaceCount: races.length,
		raceCount: races.length,
		analyzedRaceCount: ready.length,
		notReadyRaceCount: races.length - ready.length,
		notReadyReasonCounts: reasonCounts,
		venueCount: new Set(races.map((race) => race.venueCode)).size,
		resultAvailableRaceCount: races.filter((race) => race.resultStatus === "available").length,
		payoutAvailableRaceCount: races.filter((race) => race.payoutStatus === "available").length,
		exhibitionAvailableRaceCount: races.filter((race) => race.exhibitionStatus === "available").length,
		weatherAvailableRaceCount: races.filter((race) => race.weatherStatus === "available").length,
		waterConditionAvailableRaceCount: races.filter((race) => race.waterStatus === "available").length,
		racerEvidenceAvailableRaceCount: races.filter((race) => race.racerEvidenceStatus === "available").length,
		officialRegistrationLinkedCount: races.reduce((count, race) => count + race.racerLinkageSummary.officialRegistrationLinkedCount, 0),
		nameLinkedCount: 0,
		unresolvedRacerCount: races.reduce((count, race) => count + race.racerLinkageSummary.unresolvedCount, 0),
		readiness: ready.length > 0
			? { status: ready.length === races.length ? "ready" : "available", reason: `${ready.length}/${races.length} races have complete source-backed result, trifecta payout, entries, and source identity.` }
			: { status: "not-ready", reason: "No race satisfies the source-backed race-analysis generation contract." },
	};
}

function mergeManifest(entries, generatedAt) {
	const existing = readJsonIfExists(MANIFEST_PATH);
	const entryPaths = new Set(entries.map((entry) => entry.path));
	const files = array(existing?.files).filter((file) => !entryPaths.has(file?.path));
	files.push(...entries);
	return { schemaVersion: 1, kind: "boatrace-ex-derived-manifest", generatedAt, sourceFiles: array(existing?.sourceFiles), files };
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	const index = readJson(INDEX_PATH);
	const targetDate = !args.date || args.date === "latest" ? index.latestDate : args.date;
	if (!index.availableDates?.includes(targetDate)) throw new Error(`${targetDate} must be included in index availableDates before race-analysis generation`);
	const paths = sourcePathsFor(targetDate);
	for (const sourcePath of Object.values(paths)) {
		if (!fs.existsSync(absolute(sourcePath))) throw new Error(`Required source is missing: ${sourcePath}`);
	}
	const history = readJson(paths.history);
	const roughIndex = readJson(paths.roughIndex);
	const generatedAt = new Date().toISOString();
	const raceKeyOccurrences = new Map();
	const races = array(history.records).map((record) => {
		const race = buildRace(record, paths);
		const occurrence = (raceKeyOccurrences.get(race.raceKey) ?? 0) + 1;
		raceKeyOccurrences.set(race.raceKey, occurrence);
		return occurrence === 1 ? race : markDuplicateSourceRace(race, occurrence);
	}).sort((left, right) => left.venueCode.localeCompare(right.venueCode) || left.raceNo - right.raceNo || left.analysisKey.localeCompare(right.analysisKey));
	const summary = buildSummary({ races, index, roughIndex, generatedAt, targetDate });
	const auditPath = `public/data/boatrace-ex/audit/race-analysis-coverage-${targetDate}.generated.json`;
	const dateShardPath = `public/data/boatrace-ex/derived/race-analysis/dates/${targetDate}.json`;
	const sourceFiles = [...Object.values(paths), auditPath];
	const output = { schemaVersion: "boat-ex-race-analysis-v1", kind: "boatrace-ex-race-analysis", generatedAt, targetDate, summary, sourceFiles, races };
	const dateShard = { schemaVersion: "boat-ex-historical-race-analysis-v1", kind: "boatrace-ex-historical-race-analysis-date", generatedAt, date: targetDate, summary, sourceFiles, races };
	const audit = {
		schemaVersion: 1,
		kind: "boatrace-ex-race-analysis-coverage-audit",
		auditDate: targetDate,
		generatedAt,
		summary,
		expectedRaceCount: array(history.records).length,
		actualRaceCount: races.length,
		analyzedRaceCount: summary.analyzedRaceCount,
		notReadyRaces: races.filter((race) => race.status === "not-ready").map((race) => ({ raceKey: race.raceKey, reasons: race.notReadyReasons })),
		duplicateRaceKeys: races.filter((race, indexValue, all) => all.findIndex((candidate) => candidate.raceKey === race.raceKey) !== indexValue).map((race) => race.raceKey),
		policy: "Result-confirmed post-race facts only. No prediction, ticket, expected value, hit rate, AI score, rank, fuzzy match, or name-only registration linkage is generated.",
		sourcePaths: paths,
	};
	const entries = [{ path: dateShardPath, kind: dateShard.kind, date: targetDate, sourceStatus: "available", coverageStatus: summary.readiness.status, recordCount: races.length, racerCount: summary.officialRegistrationLinkedCount }];
	if (targetDate === index.latestDate) {
		entries.push({ path: LATEST_OUTPUT_PATH, kind: output.kind, date: targetDate, sourceStatus: "available", coverageStatus: summary.readiness.status, recordCount: races.length, racerCount: summary.officialRegistrationLinkedCount });
		writeJson(LATEST_OUTPUT_PATH, output, args.dryRun);
	}
	writeJson(dateShardPath, dateShard, args.dryRun);
	writeJson(auditPath, audit, args.dryRun);
	writeJson(MANIFEST_PATH, mergeManifest(entries, generatedAt), args.dryRun);
	console.log(JSON.stringify({
		ok: true,
		dryRun: args.dryRun,
		targetDate,
		raceCount: summary.raceCount,
		analyzedRaceCount: summary.analyzedRaceCount,
		notReadyRaceCount: summary.notReadyRaceCount,
		notReadyReasonCounts: summary.notReadyReasonCounts,
		venueCount: summary.venueCount,
		outputPath: targetDate === index.latestDate ? LATEST_OUTPUT_PATH : dateShardPath,
		dateShardPath,
		auditPath,
	}, null, 2));
}

main();
