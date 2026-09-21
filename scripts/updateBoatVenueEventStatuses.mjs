import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveJstTargetDate } from "./boatRaceDate.mjs";
import { fetchOfficialVenueEventStatuses } from "./boatVenueEventStatus.mjs";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const FEED_FILES = ["today.generated.json", "today-race-details.generated.json"];

function parseArgs(argv = process.argv.slice(2)) {
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === "--target-date") options.targetDate = argv[++index];
		if (token === "--output-dir") options.outputDir = argv[++index];
	}
	return options;
}

export function applyVenueEventStatusUpdates(feed, officialStatuses, { targetDate } = {}) {
	if (!feed || !Array.isArray(feed.venues)) throw new Error("feed.venues must be an array");
	if (feed.date !== targetDate) {
		throw new Error(`feed date mismatch: expected ${targetDate}, received ${feed.date ?? "(missing)"}`);
	}

	const statusByVenueCode = new Map(officialStatuses.map((item) => [String(item.venueCode), item]));
	const changedVenues = [];
	const nextFeed = {
		...feed,
		venues: feed.venues.map((venue) => {
			const official = statusByVenueCode.get(String(venue.venueCode ?? ""));
			if (!official) return venue;

			const eventStatus = official.eventStatus;
			const currentStatus = venue.eventStatus ?? "normal";
			if (eventStatus === "normal" && currentStatus === "normal") return venue;

			const eventStatusText = eventStatus === "normal" ? "" : official.eventStatusText;
			if (venue.eventStatus === eventStatus && (venue.eventStatusText ?? "") === eventStatusText) {
				return venue;
			}

			changedVenues.push({
				venueCode: venue.venueCode,
				venueName: venue.venueName,
				before: currentStatus,
				after: eventStatus,
				eventStatusText,
			});
			return { ...venue, eventStatus, eventStatusText };
		}),
	};

	return { feed: nextFeed, changedVenues };
}

export async function main(rawOptions = {}) {
	const targetDate = resolveJstTargetDate(rawOptions.targetDate);
	const outputDir = path.resolve(projectRoot, rawOptions.outputDir ?? "public/data/boatrace");
	const official = await fetchOfficialVenueEventStatuses({ targetDate });
	const results = [];

	for (const fileName of FEED_FILES) {
		const filePath = path.join(outputDir, fileName);
		const current = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/u, ""));
		const result = applyVenueEventStatusUpdates(current, official.statuses, { targetDate });
		if (result.changedVenues.length) {
			await writeFile(filePath, `${JSON.stringify(result.feed, null, 2)}\n`, "utf8");
		}
		results.push({ fileName, changedVenues: result.changedVenues });
	}

	console.log(JSON.stringify({
		ok: true,
		targetDate,
		officialUrl: official.url,
		officialVenueCount: official.statuses.length,
		statusVenues: official.statuses.filter((item) => item.eventStatus !== "normal"),
		files: results,
	}, null, 2));
	return results;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
	main(parseArgs()).catch((error) => {
		console.error("failed to refresh BOATRACE venue event statuses");
		console.error(error);
		process.exitCode = 1;
	});
}
