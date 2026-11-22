import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { getTodayIsoJst } from "./boatRaceDate.mjs";
import { main as updateBoatData, parseUpdateBoatDataOptions } from "./updateBoatData.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/update-boat-data.yml"), "utf8");
const morningCron = "0 23 * * *";
const hash = (text) => createHash("sha256").update(text).digest("hex");

test("08:00 JST cron is added once and earlier schedules remain", () => {
	const cronLines = [...workflow.matchAll(/^\s+- cron: "([^"]+)"$/gm)].map((match) => match[1]);
	assert.deepEqual(cronLines, ["5 15 * * *", "5 21 * * *", morningCron, "43 0,3,6,9,12 * * *", "30 14 * * *"]);
	assert.match(workflow, /group: update-boat-data-main\s+cancel-in-progress: false/);
});

test("23:00 UTC maps to the next JST morning across day and year boundaries", () => {
	assert.equal(getTodayIsoJst(new Date("2026-11-21T23:00:00Z")), "2026-11-22");
	assert.equal(getTodayIsoJst(new Date("2026-12-31T23:00:00Z")), "2027-01-01");
	assert.equal(getTodayIsoJst(new Date("2028-02-28T23:00:00Z")), "2028-02-29");
	assert.equal(getTodayIsoJst(new Date("2026-11-21T21:05:00Z")), "2026-11-22");
});

test("only the new cron forces initial mode and skips both legacy EX paths", () => {
	assert.match(workflow, /if \[ "\$EVENT_SCHEDULE" = "0 23 \* \* \*" \]; then\s+MODE="initial"\s+fi/);
	assert.match(workflow, /if \[ "\$EVENT_SCHEDULE" = "0 23 \* \* \*" \]; then\s+ARGS\+=\(--skip-boatrace-ex\)\s+fi/);
	assert.match(workflow, /if: \$\{\{ \(github\.event_name == 'schedule' && github\.event\.schedule != '0 23 \* \* \*'\) \|\| \(github\.event_name == 'workflow_dispatch' && inputs\.run_boatrace_ex == 'true'\) \}\}/);
	assert.match(workflow, /if \[ "\$EVENT_SCHEDULE" = "43 0,3,6,9,12 \* \* \*" \]; then\s+MODE="results"/);
	assert.match(workflow, /if \[ "\$EVENT_SCHEDULE" = "30 14 \* \* \*" \]; then\s+MODE="final"/);
	assert.match(workflow, /if \[\[ "\$EVENT_SCHEDULE" != "0 23 \* \* \*" \]\]; then\s+git add -- public\/data\/boatrace-ex/);
	assert.match(workflow, /if \[\[ "\$EVENT_SCHEDULE" != "0 23 \* \* \*" \]\] && \(\( \$\{#generated_boat_ex_docs\[@\]\} > 0 \)\); then/);
	assert.match(workflow, /Unexpected BOATRACE EX changes during the 08:00 JST update/);
});

test("morning CLI flag is opt-in", () => {
	const base = ["--mode", "initial", "--target-date", "2026-11-22"];
	assert.equal(parseUpdateBoatDataOptions(base, {}).skipBoatraceEx, false);
	assert.equal(parseUpdateBoatDataOptions([...base, "--skip-boatrace-ex"], {}).skipBoatraceEx, true);
});

test("morning initial run keeps ordinary data and exhibition checks despite schedule 403", async (t) => {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boat-morning-check-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	const scheduleFile = path.join(dir, "upcoming-schedule.generated.json");
	fs.writeFileSync(scheduleFile, "previous schedule\n");
	const calls = [];
	const runner = async (args) => {
		calls.push(args);
		if (args[0] === "scripts/updateBoatTodayRaceDetails.mjs") {
			for (const name of ["today.generated.json", "today-race-details.generated.json"]) {
				fs.writeFileSync(path.join(dir, name), JSON.stringify({ date: "2026-11-22", mode: "initial" }));
			}
		}
		if (args[0] === "scripts/updateBoatUpcomingSchedule.mjs") {
			throw Object.assign(new Error("HTTP 403 month=202611"), { exitCode: 2 });
		}
	};
	const options = { mode: "initial", targetDate: "2026-11-22", outputDir: dir, skipBoatraceEx: true };
	await updateBoatData(options, runner);
	const firstRun = calls.map((args) => args[0]);
	assert.deepEqual(firstRun, [
		"scripts/updateBoatTodayRaceDetails.mjs",
		"scripts/updateBoatVenueExtras.mjs",
		"scripts/updateBoatUpcomingSchedule.mjs",
		"scripts/checkBoatExhibitionGaps.mjs",
		"scripts/checkBoatExhibitionCoverage.mjs",
	]);
	assert.deepEqual(calls[0].slice(1, 5), ["--mode", "initial", "--target-session", "auto"]);
	assert.ok(calls[0].includes("2026-11-22"));
	assert.equal(fs.readFileSync(scheduleFile, "utf8"), "previous schedule\n");
	const before = hash(fs.readFileSync(path.join(dir, "today.generated.json")));
	await updateBoatData(options, runner);
	assert.deepEqual(calls.slice(firstRun.length).map((args) => args[0]), firstRun);
	assert.equal(hash(fs.readFileSync(path.join(dir, "today.generated.json"))), before);
});

test("existing schedule without the flag retains its current EX behavior", async () => {
	const calls = [];
	await updateBoatData({ mode: "initial", targetDate: "2026-11-22" }, async (args) => { calls.push(args[0]); });
	assert.ok(calls.includes("scripts/generateBoatExHistoricalSourceIndex.mjs"));
	assert.ok(calls.includes("scripts/checkBoatExCurrentDayPredictionCoverage.mjs"));
});
