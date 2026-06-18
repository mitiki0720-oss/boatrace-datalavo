import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findUnexplainedExhibitionGaps, readJsonIfExists } from "./boatExhibitionSnapshotPreservation.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function parseCliArgs(argv = process.argv.slice(2)) {
	const parsed = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (!token.startsWith("--")) {
			continue;
		}
		const trimmed = token.slice(2);
		const separatorIndex = trimmed.indexOf("=");
		const key = separatorIndex >= 0 ? trimmed.slice(0, separatorIndex) : trimmed;
		const value = separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : argv[index + 1];
		if (key === "output-dir" || key === "outputDir") {
			parsed.outputDir = value;
			if (separatorIndex < 0) {
				index += 1;
			}
		}
	}
	return parsed;
}

function resolveOutputDirectory(value) {
	return value ? path.resolve(projectRoot, value) : path.join(projectRoot, "public", "data", "boatrace");
}

function buildGapFixture({
	status = "available",
	sourceStatus = {},
	preserved = false,
} = {}) {
	return {
		detailsFeed: {
			date: "2026-06-18",
			venues: [{
				venueCode: "02",
				venueName: "戸田",
				races: [
					{
						raceNo: 9,
						status,
						exhibitions: [],
						...(preserved ? { exhibitionSnapshotPreservation: { preservedFromPreviousSnapshot: true } } : {}),
					},
					{ raceNo: 10, status: "available", exhibitions: [{ frameNo: 1 }] },
				],
			}],
		},
		venueExtrasFeed: {
			date: "2026-06-18",
			venues: [{
				venueCode: "02",
				venueName: "戸田",
				races: [
					{ raceNo: 9, sourceStatus },
					{ raceNo: 10 },
				],
			}],
		},
	};
}

function verifyGapClassificationFixtures() {
	const scheduled = buildGapFixture({ status: "scheduled" });
	const scheduledGaps = findUnexplainedExhibitionGaps(scheduled.detailsFeed, scheduled.venueExtrasFeed);
	assert.equal(scheduledGaps.length, 1, "scheduled unpublished race should remain visible to the audit");
	assert.equal(scheduledGaps[0].severity, "warning", "scheduled unpublished race should be warning");

	const pending = buildGapFixture({ sourceStatus: { officialBeforeInfo: "pending" } });
	assert.equal(
		findUnexplainedExhibitionGaps(pending.detailsFeed, pending.venueExtrasFeed)[0]?.severity,
		"warning",
		"pending official beforeinfo should be warning",
	);

	const waiting = buildGapFixture({ sourceStatus: { startExhibition: "waiting-beforeinfo" } });
	assert.equal(
		findUnexplainedExhibitionGaps(waiting.detailsFeed, waiting.venueExtrasFeed)[0]?.severity,
		"warning",
		"waiting official beforeinfo should be warning",
	);

	const notPublished = buildGapFixture({ sourceStatus: { originalExhibition: "not-published" } });
	assert.equal(
		findUnexplainedExhibitionGaps(notPublished.detailsFeed, notPublished.venueExtrasFeed)[0]?.severity,
		"warning",
		"not-published official beforeinfo should be warning",
	);

	const unexplained = buildGapFixture();
	assert.equal(
		findUnexplainedExhibitionGaps(unexplained.detailsFeed, unexplained.venueExtrasFeed)[0]?.severity,
		"error",
		"unexplained published-race gap should remain error",
	);

	const preserved = buildGapFixture({ preserved: true });
	assert.equal(
		findUnexplainedExhibitionGaps(preserved.detailsFeed, preserved.venueExtrasFeed).length,
		0,
		"previously captured exhibition rows should remain handled by snapshot preservation",
	);
}

async function main() {
	verifyGapClassificationFixtures();
	const cliArgs = parseCliArgs();
	const outputDirectory = resolveOutputDirectory(cliArgs.outputDir ?? process.env.BOAT_RACE_OUTPUT_DIR);
	const detailsPath = path.join(outputDirectory, "today-race-details.generated.json");
	const venueExtrasPath = path.join(outputDirectory, "venue-extras.generated.json");
	const detailsFeed = await readJsonIfExists(detailsPath);
	const venueExtrasFeed = await readJsonIfExists(venueExtrasPath);

	if (!detailsFeed) {
		throw new Error(`missing today race details feed: ${detailsPath}`);
	}
	if (!venueExtrasFeed) {
		throw new Error(`missing venue extras feed: ${venueExtrasPath}`);
	}

	const gaps = findUnexplainedExhibitionGaps(detailsFeed, venueExtrasFeed);
	const errors = gaps.filter((gap) => gap.severity === "error");
	const warnings = gaps.filter((gap) => gap.severity === "warning");

	for (const gap of warnings) {
		console.warn(
			[
				"[check-exhibition-gaps] warning",
				`${gap.venueName || gap.venueCode} ${gap.raceNo}R`,
				`later=${gap.laterPublishedRaceNo}R`,
				`status=${gap.status || "unknown"}`,
				`counts=${JSON.stringify(gap.raceCounts)}`,
			].join(" "),
		);
	}

	if (errors.length > 0) {
		console.error(`[check-exhibition-gaps] errorCount=${errors.length} warningCount=${warnings.length}`);
		for (const gap of errors) {
			console.error(
				[
					"[check-exhibition-gaps] error",
					`${gap.venueName || gap.venueCode} ${gap.raceNo}R`,
					`later=${gap.laterPublishedRaceNo}R`,
					`status=${gap.status || "unknown"}`,
					`counts=${JSON.stringify(gap.raceCounts)}`,
				].join(" "),
			);
		}
		process.exitCode = 1;
		return;
	}

	console.log(`[check-exhibition-gaps] errorCount=0 warningCount=${warnings.length} date=${detailsFeed.date} venues=${detailsFeed.venues?.length ?? 0}`);
}

main().catch((error) => {
	console.error("[check-exhibition-gaps] failed");
	console.error(error);
	process.exitCode = 1;
});
