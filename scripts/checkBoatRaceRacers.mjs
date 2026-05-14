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

function isMeaningfulValue(value) {
	if (value === undefined || value === null) {
		return false;
	}

	const normalizedValue = String(value).replace(/\s+/g, "").trim();
	return normalizedValue !== "" && normalizedValue !== "-" && normalizedValue !== "--";
}

function isPlaceholderName(value, frameNo) {
	if (!isMeaningfulValue(value)) {
		return true;
	}

	const normalizedValue = String(value).replace(/\s+/g, "").trim();
	return normalizedValue === `枠${frameNo}` || normalizedValue === `${frameNo}号艇`;
}

function countValidRacerFields(racers) {
	return (racers ?? []).reduce((accumulator, racer, index) => {
		const frameNo = racer?.frameNo ?? index + 1;
		const name = racer?.name ?? racer?.playerName ?? racer?.racerName;
		const registrationNo = racer?.registrationNo ?? racer?.registerNo ?? racer?.racerNo;
		const className = racer?.className ?? racer?.class ?? racer?.grade;
		const branch = racer?.branch;
		const averageStart = racer?.averageStart ?? racer?.currentAverageStart;
		const winRate = racer?.winRate;
		const secondRate = racer?.secondRate;
		const motorNo = racer?.motorNo;
		const motorSecondRate = racer?.motorSecondRate;
		const boatNo = racer?.boatNo ?? racer?.boatMotorNo;
		const boatSecondRate = racer?.boatSecondRate;

		if (!isPlaceholderName(name, frameNo)) {
			accumulator.name += 1;
		}

		if (isMeaningfulValue(registrationNo)) {
			accumulator.registrationNo += 1;
		}

		if (isMeaningfulValue(className)) {
			accumulator.className += 1;
		}

		if (isMeaningfulValue(branch)) {
			accumulator.branch += 1;
		}

		if (isMeaningfulValue(averageStart)) {
			accumulator.averageStart += 1;
		}

		if (isMeaningfulValue(winRate) || isMeaningfulValue(secondRate)) {
			accumulator.rate += 1;
		}

		if (isMeaningfulValue(motorNo) || isMeaningfulValue(motorSecondRate)) {
			accumulator.motor += 1;
		}

		if (isMeaningfulValue(boatNo) || isMeaningfulValue(boatSecondRate)) {
			accumulator.boat += 1;
		}

		if (isPlaceholderName(name, frameNo)) {
			accumulator.placeholderName += 1;
		}

		return accumulator;
	}, {
		name: 0,
		registrationNo: 0,
		className: 0,
		branch: 0,
		averageStart: 0,
		rate: 0,
		motor: 0,
		boat: 0,
		placeholderName: 0,
	});
}

function formatThinFields(label, stats, totalCount) {
	const fields = [];

	if (stats.name < 3) {
		fields.push(`name ${stats.name}/${totalCount}`);
	}

	if (stats.registrationNo < 3) {
		fields.push(`registerNo ${stats.registrationNo}/${totalCount}`);
	}

	if (stats.className < 3) {
		fields.push(`className ${stats.className}/${totalCount}`);
	}

	if (stats.averageStart < 3) {
		fields.push(`averageStart ${stats.averageStart}/${totalCount}`);
	}

	if (stats.motor < 3) {
		fields.push(`motorNo ${stats.motor}/${totalCount}`);
	}

	if (stats.placeholderName >= 4) {
		fields.push(`placeholderName ${stats.placeholderName}/${totalCount}`);
	}

	return fields.length > 0 ? `[thin-racers] ${label}: ${fields.join(", ")}` : null;
}

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
	const thinWarnings = [];

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

			if (row.todayRacersLen >= 6) {
				const thinMessage = formatThinFields(`${venue.venueName} ${race.raceNo}R today`, countValidRacerFields(race.racers), row.todayRacersLen);
				if (thinMessage) {
					thinWarnings.push(thinMessage);
				}
			}

			if (row.detailRacersLen >= 6) {
				const thinMessage = formatThinFields(`${venue.venueName} ${race.raceNo}R details`, countValidRacerFields(detailRace?.racers), row.detailRacersLen);
				if (thinMessage) {
					thinWarnings.push(thinMessage);
				}
			}
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

	if (thinWarnings.length > 0) {
		console.warn(`[check:boatrace-racers] thin-racers warnings: ${thinWarnings.length}件`);
		for (const warning of thinWarnings) {
			console.warn(warning);
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