import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTodayIsoJst, resolveJstTargetDate } from "./boatRaceDate.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const fixtures = [
	{ now: "2026-08-15T23:38:00.000Z", expected: "2026-08-16" },
	{ now: "2026-08-15T15:05:00.000Z", expected: "2026-08-16" },
	{ now: "2026-08-15T14:55:00.000Z", expected: "2026-08-15" },
];

for (const fixture of fixtures) {
	const now = new Date(fixture.now);
	assert.equal(getTodayIsoJst(now), fixture.expected, `JST resolver mismatch for ${fixture.now}`);
	assert.equal(resolveJstTargetDate(undefined, now), fixture.expected, `default target date mismatch for ${fixture.now}`);
}

assert.throws(() => resolveJstTargetDate("2026-02-30"), /valid JST calendar date/);
assert.equal(resolveJstTargetDate("2026-08-16"), "2026-08-16");

const [workflow, updateBoatData, updateTodayDetails] = await Promise.all([
	readFile(path.join(projectRoot, ".github", "workflows", "update-boat-data.yml"), "utf8"),
	readFile(path.join(projectRoot, "scripts", "updateBoatData.mjs"), "utf8"),
	readFile(path.join(projectRoot, "scripts", "updateBoatTodayRaceDetails.mjs"), "utf8"),
]);

assert.match(workflow, /target_date:\s*\n\s+description: "Target date in JST YYYY-MM-DD\. Empty = JST today"/);
assert.match(workflow, /TARGET_DATE: \$\{\{ inputs\.target_date \|\| '' \}\}/);
assert.match(workflow, /ARGS\+=\(--target-date "\$TARGET_DATE"\)/);
assert.match(workflow, /git add -- \\\s*\n\s+public\/data\/boatrace\/today-race-details\.generated\.json/);
assert.doesNotMatch(workflow, /git add public\/data(?:\s|$)/);
assert.match(workflow, /Protected files were staged by the generated data commit step/);
assert.ok(workflow.includes("public/data/boatrace/johnson-predictions\\.generated\\.json"));
assert.ok(workflow.includes("public/data/boatrace/reviews/index\\.json"));
assert.match(updateBoatData, /resolveJstTargetDate\(cliArgs\.targetDate \?\? env\.BOAT_RACE_TARGET_DATE\)/);
assert.match(updateTodayDetails, /targetDate: resolveJstTargetDate\(rawOptions\.targetDate\)/);

console.log(JSON.stringify({
	ok: true,
	fixtures: fixtures.map(({ now, expected }) => ({ now, targetDate: expected })),
	workflowTargetDate: "JST input with script-side default",
	workflowStageGuard: true,
}, null, 2));
