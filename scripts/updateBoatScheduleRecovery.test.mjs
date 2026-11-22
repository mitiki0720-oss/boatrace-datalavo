import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { main as updateBoatData } from "./updateBoatData.mjs";
import { main as updateSchedule, monthKeysBetween, ScheduleUnavailableError } from "./updateBoatUpcomingSchedule.mjs";

const date = "2026-11-22";
const scheduleName = "updateBoatUpcomingSchedule.mjs";
const detailsName = "updateBoatTodayRaceDetails.mjs";

function tempDir(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boat-schedule-recovery-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

test("requested month boundaries do not use process local time", () => {
	assert.deepEqual(monthKeysBetween("2026-11-22", "2026-12-23"), ["202611", "202612"]);
	assert.deepEqual(monthKeysBetween("2026-12-20", "2027-01-20"), ["202612", "202701"]);
});

test("schedule fetch timeout is a hold and leaves the previous file unchanged", async (t) => {
	const dir = tempDir(t);
	const file = path.join(dir, "upcoming-schedule.generated.json");
	fs.writeFileSync(file, "previous verified schedule\n");
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => { throw new Error("request timed out"); };
	t.after(() => { globalThis.fetch = originalFetch; });
	await assert.rejects(updateSchedule({ targetDate: date, days: 31, outputDir: dir }),
		(error) => error instanceof ScheduleUnavailableError && /month=202611.*request timed out/.test(error.message));
	assert.equal(fs.readFileSync(file, "utf8"), "previous verified schedule\n");
});

test("schedule CLI gives unavailable a distinct exit code and logs its URL", (t) => {
	const dir = tempDir(t);
	const file = path.join(dir, "upcoming-schedule.generated.json");
	fs.writeFileSync(file, "previous verified schedule\n");
	const mock = "globalThis.fetch=async(url)=>({ok:false,status:403,url})";
	const result = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(mock)}`,
		"scripts/updateBoatUpcomingSchedule.mjs", "--target-date", date, "--output-dir", dir],
		{ encoding: "utf8", cwd: path.resolve(".") });
	assert.equal(result.status, 2, result.stderr);
	assert.match(result.stderr, /SCHEDULE_HOLD/);
	assert.match(result.stderr, /HTTP 403 month=202611 url=https:\/\/www\.boatrace\.jp\/owsp\/sp\/race\/monthlyschedule\?ym=202611/);
	assert.equal(fs.readFileSync(file, "utf8"), "previous verified schedule\n");
});

test("a corrupt or wrong-date today feed remains a hard error", async (t) => {
	const dir = tempDir(t);
	const file = path.join(dir, "today.generated.json");
	for (const content of ["{bad-json", JSON.stringify({ date: "2026-11-21", venues: [] })]) {
		fs.writeFileSync(file, content);
		await assert.rejects(updateSchedule({ targetDate: date, days: 31, outputDir: dir }),
			(error) => !(error instanceof ScheduleUnavailableError));
	}
});

test("schedule hold permits ordinary updates in all four modes", async (t) => {
	for (const mode of ["initial", "active", "results", "final"]) {
		const dir = tempDir(t);
		const calls = [];
		const runner = async (args) => {
			calls.push(args[0]);
			if (args[0].endsWith(detailsName)) {
				fs.writeFileSync(path.join(dir, "today-race-details.generated.json"), JSON.stringify({ date, mode }));
				fs.writeFileSync(path.join(dir, "today.generated.json"), JSON.stringify({ date, mode }));
			}
			if (args[0].endsWith(scheduleName)) {
				throw Object.assign(new Error("HTTP 403 month=202611 url=https://www.boatrace.jp/owsp/sp/race/monthlyschedule?ym=202611"), { exitCode: 2 });
			}
		};
		await updateBoatData({ mode, targetDate: date, outputDir: dir }, runner);
		assert.equal(calls[0], `scripts/${detailsName}`);
		assert.ok(calls.includes(`scripts/${scheduleName}`));
		assert.ok(calls.some((script) => script.includes("checkBoatExhibitionGaps") || script.includes("generateBoatExHistoricalSourceIndex")));
		assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "today-race-details.generated.json"), "utf8")), { date, mode });
		assert.equal(fs.existsSync(path.join(dir, "upcoming-schedule.generated.json")), false);
	}
});

test("schedule integrity error and ordinary detail failure still stop the update", async () => {
	for (const failedScript of [scheduleName, detailsName]) {
		const calls = [];
		await assert.rejects(updateBoatData({ mode: "results", targetDate: date }, async (args) => {
			calls.push(args[0]);
			if (args[0].endsWith(failedScript)) throw Object.assign(new Error("integrity failure"), { exitCode: 1 });
		}), /integrity failure/);
		assert.equal(calls.includes("scripts/generateBoatExHistoricalSourceIndex.mjs"), false);
		if (failedScript === detailsName) assert.equal(calls.includes(`scripts/${scheduleName}`), false);
	}
});
