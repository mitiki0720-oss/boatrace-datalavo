import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const todayPath = path.join(projectRoot, "public", "data", "boatrace", "today.generated.json");
const detailsPath = path.join(projectRoot, "public", "data", "boatrace", "today-race-details.generated.json");
const extrasPath = path.join(projectRoot, "public", "data", "boatrace", "venue-extras.generated.json");

const strictMode = process.env.BOAT_RACER_CHECK_STRICT === "1";

function getArrayLength(value) {
	return Array.isArray(value) ? value.length : 0;
}

function buildRaceKey(venueName, raceNo) {
	return `${venueName}-${raceNo}`;
}

function classifyRace(row) {
	if (row.detailRacersLen > 0 || row.detailEntryRowsLen > 0) {
		return "A";
	}

	if (row.scoreQuickLookLen > 0) {
		return "B";
	}

	if (row.originalExhibitionLen > 0 || row.startExhibitionLen > 0 || row.motorSummaryLen > 0 || row.racerCommentsLen > 0) {
		return "C";
	}

	return "D";
}

function classifyStatus(row) {
	if (row.todayRacersLen > 0) {
		return "available";
	}

	return classifyRace(row) === "D" ? "empty" : "waiting";
}

async function readJson(filePath) {
	return JSON.parse(await readFile(filePath, "utf8"));
}

function formatRow(row) {
	return [
		`${row.venueName} ${row.raceNo}R`,
		`today=${row.todayRacersLen}`,
		`details=${row.detailRacersLen}`,
		`detailEntry=${row.detailEntryRowsLen}`,
		`score=${row.scoreQuickLookLen}`,
		`original=${row.originalExhibitionLen}`,
		`start=${row.startExhibitionLen}`,
		`motor=${row.motorSummaryLen}`,
		`comments=${row.racerCommentsLen}`,
		`status=${row.status}`,
		`cause=${row.cause}`,
	].join(" | ");
}

async function main() {
	const [today, details, extras] = await Promise.all([
		readJson(todayPath),
		readJson(detailsPath),
		readJson(extrasPath),
	]);

	const detailMap = new Map(
		(details.venues ?? []).flatMap((venue) =>
			(venue.races ?? []).map((race) => [buildRaceKey(venue.venueName, race.raceNo), race]),
		),
	);

	const extraMap = new Map(
		(extras.venues ?? []).flatMap((venue) =>
			(venue.races ?? []).map((race) => [buildRaceKey(venue.venueName, race.raceNo), race]),
		),
	);

	const allRows = [];

	for (const venue of today.venues ?? []) {
		for (const race of venue.races ?? []) {
			const detailRace = detailMap.get(buildRaceKey(venue.venueName, race.raceNo));
			const extraRace = extraMap.get(buildRaceKey(venue.venueName, race.raceNo));

			const row = {
				venueName: venue.venueName,
				raceNo: race.raceNo,
				todayRacersLen: getArrayLength(race.racers),
				detailRacersLen: getArrayLength(detailRace?.racers),
				detailEntryRowsLen: Math.max(getArrayLength(detailRace?.entryRows), getArrayLength(detailRace?.entryTable)),
				scoreQuickLookLen: getArrayLength(extraRace?.officialBeforeInfo?.scoreQuickLook),
				originalExhibitionLen: getArrayLength(extraRace?.originalExhibition),
				startExhibitionLen: getArrayLength(extraRace?.startExhibition),
				motorSummaryLen: getArrayLength(extraRace?.motorSummary),
				racerCommentsLen: getArrayLength(extraRace?.racerComments),
			};

			const cause = classifyRace(row);
			const status = classifyStatus({ ...row, cause });
			allRows.push({ ...row, cause, status });
		}
	}

	const emptyTodayRows = allRows.filter((row) => row.todayRacersLen === 0);
	const unresolvedRows = emptyTodayRows.filter((row) => row.cause === "D");

	console.log(`[check:boatrace-racers] today.generated で racers=0 のレース: ${emptyTodayRows.length}件`);
	for (const row of emptyTodayRows) {
		console.log(formatRow(row));
	}

	const summary = emptyTodayRows.reduce((accumulator, row) => {
		accumulator[row.cause] = (accumulator[row.cause] ?? 0) + 1;
		return accumulator;
	}, {});

	console.log(`[check:boatrace-racers] cause summary: ${JSON.stringify(summary)}`);

	if (unresolvedRows.length > 0) {
		console.warn(`[check:boatrace-racers] 補完素材なしの unresolved レース: ${unresolvedRows.length}件`);
		for (const row of unresolvedRows) {
			console.warn(`WARN ${formatRow(row)}`);
		}
	}

	if (strictMode && unresolvedRows.length > 0) {
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error("[check:boatrace-racers] failed", error);
	process.exitCode = 1;
});