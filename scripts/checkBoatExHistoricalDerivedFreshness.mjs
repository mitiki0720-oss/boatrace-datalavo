import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { compareHistoricalRaceAnalysisFreshness } from "./boatExHistoricalDerivedFreshness.mjs";

const root = process.cwd();
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const base = {
	index: { latestDate: "2026-09-22", summary: { dateCount: 116 } },
	roughIndex: { summary: { raceCount: 16524, resultAvailableRaceCount: 12748, payoutAvailableRaceCount: 12712 } },
	historyCoverage: { summary: { exhibitionAvailableRaceCount: 1067, weatherAvailableRaceCount: 16512 } },
	historicalSummary: {
		dateRange: { latestDate: "2026-09-22", dateCount: 116 },
		summary: {
			raceCount: 16524,
			resultAvailableRaceCount: 12748,
			payoutAvailableRaceCount: 12712,
			exhibitionAvailableRaceCount: 1067,
			weatherAvailableRaceCount: 16512,
		},
	},
};

const fixture = (changes = {}) => compareHistoricalRaceAnalysisFreshness({
	...base,
	...changes,
	historicalSummary: {
		...base.historicalSummary,
		...(changes.historicalSummary ?? {}),
		summary: {
			...base.historicalSummary.summary,
			...(changes.historicalSummary?.summary ?? {}),
		},
	},
});

const resultGrowth = fixture({ historicalSummary: { summary: { resultAvailableRaceCount: 12742 } } });
const payoutGrowth = fixture({ historicalSummary: { summary: { payoutAvailableRaceCount: 12709 } } });
const currentFixture = fixture();
const raceGrowth = fixture({
	index: { latestDate: "2026-09-23", summary: { dateCount: 117 } },
	roughIndex: { summary: { ...base.roughIndex.summary, raceCount: 16668 } },
});
assert.equal(resultGrowth.current, false);
assert.deepEqual(resultGrowth.reasons, ["resultAvailableRaceCount"]);
assert.equal(payoutGrowth.current, false);
assert.deepEqual(payoutGrowth.reasons, ["payoutAvailableRaceCount"]);
assert.equal(currentFixture.current, true);
assert.equal(raceGrowth.current, false);
assert.ok(raceGrowth.reasons.includes("latestDate"));
assert.ok(raceGrowth.reasons.includes("dateCount"));
assert.ok(raceGrowth.reasons.includes("raceCount"));

const live = compareHistoricalRaceAnalysisFreshness({
	index: readJson("public/data/boatrace-ex/index.generated.json"),
	roughIndex: readJson("public/data/boatrace-ex/derived/rough-index/latest.json"),
	historyCoverage: readJson("public/data/boatrace-ex/derived/history-coverage/latest.json"),
	historicalSummary: readJson("public/data/boatrace-ex/derived/race-analysis/history-summary.json"),
});

console.log(JSON.stringify({
	ok: true,
	fixtures: {
		resultAvailabilityGrowthIsStale: !resultGrowth.current,
		payoutAvailabilityGrowthIsStale: !payoutGrowth.current,
		identicalAvailabilityIsCurrent: currentFixture.current,
		dateAndRaceProgressIsStale: !raceGrowth.current,
	},
	live,
}, null, 2));
