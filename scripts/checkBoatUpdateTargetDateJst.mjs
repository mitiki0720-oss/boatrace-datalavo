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
assert.match(workflow, /EX_DATE="\$\{\{ inputs\.boatrace_ex_date \}\}"/);
assert.match(workflow, /EX_DATE="\$\{EX_DATE:-auto\}"/);
assert.match(workflow, /\[\[ -z "\$\{EX_DATE\/\/\[\[:space:\]\]\/\}" \]\]/);
assert.match(workflow, /git add -- \\\s*\n\s+public\/data\/boatrace\/today-race-details\.generated\.json/);
assert.doesNotMatch(workflow, /git add(?:\s+--)?\s+public\/data(?:\s|$)/);
assert.doesNotMatch(workflow, /git add(?:\s+--)?\s+public\/data\/boatrace(?:\s|$)/);
assert.doesNotMatch(workflow, /^\s*git add \.\s*$/m);
assert.doesNotMatch(workflow, /git add -A(?:\s|$)/);

const generatedCommitStart = workflow.indexOf("echo \"=== restore non-generated / protected workflow side-effect changes ===\"");
const generatedCommitStage = workflow.indexOf("git add --", generatedCommitStart);
const generatedCommitGuard = workflow.indexOf("if git diff --cached", generatedCommitStage);
assert.ok(generatedCommitStart >= 0, "generated commit restore section is missing");
assert.ok(generatedCommitStage > generatedCommitStart, "generated commit allowlist is missing");
assert.ok(generatedCommitGuard > generatedCommitStage, "generated commit protected-stage guard is missing");

const restoreBlock = workflow.slice(generatedCommitStart, generatedCommitStage);
const allowlistBlock = workflow.slice(generatedCommitStage, generatedCommitGuard);
assert.match(restoreBlock, /git restore package-lock\.json \|\| true/);
assert.match(restoreBlock, /git restore public\/data\/boatrace\/johnson-predictions\.generated\.json \|\| true/);
assert.doesNotMatch(allowlistBlock, /johnson-predictions\.generated\.json/);
assert.doesNotMatch(allowlistBlock, /registered-racer-identity-registry-\d{4}-\d{2}-\d{2}\.md/);
assert.match(allowlistBlock, /shopt -s nullglob/);
assert.match(allowlistBlock, /docs\/boat-ex\/registered-racer-identity-registry-\*\.md/);
assert.match(allowlistBlock, /docs\/boat-ex\/racer-evidence-registry-linkage-\*\.md/);
assert.match(allowlistBlock, /docs\/boat-ex\/registration-coverage-audit-\*\.md/);
assert.match(allowlistBlock, /docs\/boat-ex\/reviews-dog-history-backfill-\*\.md/);
assert.match(allowlistBlock, /git add -- "\$\{generated_boat_ex_docs\[@\]\}"/);
assert.match(workflow, /Protected files were staged by the generated data commit step/);
assert.ok(workflow.includes("public/data/boatrace/johnson-predictions\\.generated\\.json"));
assert.ok(workflow.includes("public/data/boatrace/reviews/index\\.json"));
assert.ok(workflow.includes("public/data/reviews/"));
assert.ok(workflow.includes("public/dog/"));
assert.match(updateBoatData, /resolveJstTargetDate\(cliArgs\.targetDate \?\? env\.BOAT_RACE_TARGET_DATE\)/);
assert.match(
	updateBoatData,
	/if \(mode === "results"\) \{\s*args\.push\("--fetch-sections", "raceTitles,resultList,detailedResults,odds,beforeInfo,venueWeather"\);\s*\}/u,
);
assert.match(updateTodayDetails, /targetDate: resolveJstTargetDate\(rawOptions\.targetDate\)/);

const dateArgScripts = await Promise.all([
	"generateBoatExDaily.mjs",
	"checkBoatExDaily.mjs",
	"generateBoatExRaceAnalysis.mjs",
	"checkBoatExRaceAnalysis.mjs",
].map(async (file) => ({ file, source: await readFile(path.join(projectRoot, "scripts", file), "utf8") })));
for (const { file, source } of dateArgScripts) {
	assert.match(source, /if \(!normalized\) return "auto";/, `${file} must treat blank dates as auto`);
	assert.match(source, /\["auto", "latest"\]/, `${file} must accept auto and latest`);
	assert.match(source, /--date requires YYYY-MM-DD, latest, or auto/, `${file} must reject invalid date text`);
}

console.log(JSON.stringify({
	ok: true,
	fixtures: fixtures.map(({ now, expected }) => ({ now, targetDate: expected })),
	workflowTargetDate: "JST input with script-side default",
	workflowBoatExDate: "blank or whitespace input falls back to auto",
	boatExDateArgScripts: dateArgScripts.map(({ file }) => file),
	workflowStageGuard: true,
	resultsModeBeforeInfoRefresh: true,
	resultsModeVenueWeatherRefresh: true,
	generatedBoatExDocsAllowlist: [
		"registered-racer-identity-registry-*.md",
		"racer-evidence-registry-linkage-*.md",
		"registration-coverage-audit-*.md",
		"reviews-dog-history-backfill-*.md",
	],
	hardcodedRegistryDocDate: false,
	johnsonJsonRestoredBeforeGeneratedCommit: true,
	johnsonJsonExcludedFromGeneratedAllowlist: true,
}, null, 2));
