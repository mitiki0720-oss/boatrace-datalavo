import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dedupeOfficialVenueRows, parseIndexVenueRows } from "./updateBoatTodayRaceDetails.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const feedPaths = [
	"public/data/boatrace/today.generated.json",
	"public/data/boatrace/today-race-details.generated.json",
];
const normalizeVenueCode = (value) => {
	const text = String(value ?? "").trim();
	return /^\d{1,2}$/.test(text) ? text.padStart(2, "0") : text;
};

function inspectFeed(relativePath) {
	const feed = JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
	const venueCounts = new Map();
	const raceCounts = new Map();
	const raceKeys = new Set();
	const duplicateRaceKeys = [];

	for (const venue of feed.venues ?? []) {
		const venueCode = normalizeVenueCode(venue.venueCode);
		venueCounts.set(venueCode, (venueCounts.get(venueCode) ?? 0) + 1);
		const venueRaceNumbers = new Set();
		for (const race of venue.races ?? []) {
			const raceNo = Number(race.raceNo);
			if (venueRaceNumbers.has(raceNo)) duplicateRaceKeys.push(`${venueCode}:${raceNo}`);
			venueRaceNumbers.add(raceNo);
			const raceKey = `${venueCode}:${raceNo}`;
			if (raceKeys.has(raceKey)) duplicateRaceKeys.push(raceKey);
			raceKeys.add(raceKey);
		}
		raceCounts.set(venueCode, venueRaceNumbers.size);
	}

	const duplicateVenueCodes = [...venueCounts].filter(([, count]) => count > 1).map(([venueCode]) => venueCode);
	const result = {
		path: relativePath,
		date: feed.date,
		venueCount: (feed.venues ?? []).length,
		raceCount: (feed.venues ?? []).reduce((total, venue) => total + (venue.races ?? []).length, 0),
		duplicateVenueCodes,
		duplicateRaceKeys: [...new Set(duplicateRaceKeys)],
		wakamatsuVenueCount: venueCounts.get("20") ?? 0,
		wakamatsuRaceCount: raceCounts.get("20") ?? 0,
	};

	if (duplicateVenueCodes.length) throw new Error(`${relativePath}: duplicate venueCode: ${duplicateVenueCodes.join(", ")}`);
	if (result.duplicateRaceKeys.length) throw new Error(`${relativePath}: duplicate race key: ${result.duplicateRaceKeys.join(", ")}`);
	if (feed.date === "2026-09-22") {
		const expectedVenueCodes = ["01", "02", "03", "06", "08", "09", "10", "11", "12", "16", "17", "18", "20", "22"];
		const actualVenueCodes = [...venueCounts.keys()].sort();
		if (JSON.stringify(actualVenueCodes) !== JSON.stringify(expectedVenueCodes)) {
			throw new Error(`${relativePath}: 2026-09-22 venue codes mismatch: ${JSON.stringify(actualVenueCodes)}`);
		}
		if (result.venueCount !== 14 || result.raceCount !== 168 || result.wakamatsuVenueCount !== 1 || result.wakamatsuRaceCount !== 12) {
			throw new Error(`${relativePath}: 2026-09-22 expected 14 venues / 168 races / Wakamatsu 1 venue and 12 races`);
		}
	}

	return result;
}

const fixtureHtml = `
<table>
	<tr><td></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=20&hd=20260922">同日開催</a></td><td>初日</td><td></td><td><img alt="若松"></td><td>発売中</td></tr>
	<tr><td></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=20&hd=20260922">同日開催</a></td><td>初日</td><td></td><td><img alt="若松"></td><td>発売中</td></tr>
	<tr><td></td><td></td><td><a href="/owpc/pc/race/raceindex?jcd=20&hd=20260923">翌日開催</a></td><td>2日目</td><td></td><td><img alt="若松"></td><td>前日発売中</td></tr>
</table>`;
const fixtureRows = parseIndexVenueRows(fixtureHtml, {
	date: "2026-09-22",
	dateKey: "20260922",
	fallbackVenueByCode: new Map(),
});
if (fixtureRows.length !== 1 || fixtureRows[0].venueCode !== "20" || fixtureRows[0].title !== "同日開催") {
	throw new Error(`official index date filter/dedupe fixture failed: ${JSON.stringify(fixtureRows)}`);
}
let conflictRejected = false;
try {
	dedupeOfficialVenueRows([
		{ date: "2026-09-22", venueCode: "20", venueName: "若松", title: "開催A" },
		{ date: "2026-09-22", venueCode: "20", venueName: "若松", title: "開催B" },
	], "2026-09-22");
} catch {
	conflictRejected = true;
}
if (!conflictRejected) throw new Error("conflicting duplicate venue fixture must be rejected");

const feeds = feedPaths.map(inspectFeed);
console.log(JSON.stringify({
	ok: true,
	fixture: {
		targetDate: "2026-09-22",
		parsedVenueCount: fixtureRows.length,
		nextDayAdvanceSaleExcluded: true,
		conflictingDuplicateRejected: conflictRejected,
	},
	feeds,
}, null, 2));
