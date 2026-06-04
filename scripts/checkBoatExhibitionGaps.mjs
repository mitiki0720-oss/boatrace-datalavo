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

async function main() {
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
	if (gaps.length > 0) {
		console.error(`[check-exhibition-gaps] gapCount=${gaps.length}`);
		for (const gap of gaps) {
			console.error(
				[
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

	console.log(`[check-exhibition-gaps] gapCount=0 date=${detailsFeed.date} venues=${detailsFeed.venues?.length ?? 0}`);
}

main().catch((error) => {
	console.error("[check-exhibition-gaps] failed");
	console.error(error);
	process.exitCode = 1;
});
