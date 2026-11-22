import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { addDays, monthKeysBetween, main, parseMonthlySchedule } from "./updateBoatUpcomingSchedule.mjs";

const VENUE_NAMES = ["桐　生", "戸田", "江戸川", "平和島", "多摩川", "浜名湖", "蒲郡", "常滑", "津", "三国", "びわこ", "住之江", "尼崎", "鳴門", "丸亀", "児島", "宮島", "徳山", "下関", "若松", "芦屋", "福岡", "唐津", "大村"];
const urlFor = (month) => `https://www.boatrace.jp/owsp/sp/race/monthlyschedule?ym=${month}`;
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const event = (range, title, href = "/owsp/sp/race/assen?jcd=01") => `<li><dl><dt>${range}</dt><dd>${href ? `<a href="${href}">${title}</a>` : title}</dd></dl></li>`;

function page(month, eventsByVenue = {}) {
	const year = month.slice(0, 4);
	const number = Number(month.slice(4, 6));
	return `<!doctype html><html><head><title>月間スケジュール｜BOAT RACE オフィシャルウェブサイト</title></head><body>
	<select><option selected="selected" value="ALL">ALL</option></select>
	<select><option selected="selected" value="${year}">${year}</option></select>
	<select><option selected="selected" value="${number}">${number}</option></select>
	<h3 class="contHead__title">${number}月のスケジュール</h3>
	${VENUE_NAMES.map((name, index) => `<h4 class="balTable__head">${name}</h4><div class="scheduleTable"><ul>${eventsByVenue[index] ?? ""}</ul></div>`).join("")}
	</body></html>`;
}

function fixture(t, initial = "existing verified schedule\n") {
	const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "boat-schedule-test-"));
	t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));
	const output = path.join(outputDir, "upcoming-schedule.generated.json");
	fs.writeFileSync(output, initial);
	return { outputDir, output, before: hash(output) };
}

function mockFetch(t, callback) {
	const original = globalThis.fetch;
	globalThis.fetch = callback;
	t.after(() => { globalThis.fetch = original; });
}

const novEvent = event("11/20 - 11/25", "公式大会A");
const decEvent = event("12/01 - 12/05", "公式大会B");

test("UTC date arithmetic selects exact month boundaries and leap day", () => {
	assert.equal(addDays("2026-11-20", 31), "2026-12-21");
	assert.equal(addDays("2026-01-31", 1), "2026-02-01");
	assert.equal(addDays("2028-02-28", 1), "2028-02-29");
	assert.equal(addDays("2028-02-29", 1), "2028-03-01");
	assert.deepEqual(monthKeysBetween("2026-11-20", "2026-12-21"), ["202611", "202612"]);
	assert.deepEqual(monthKeysBetween("2026-12-31", "2027-01-01"), ["202612", "202701"]);
	assert.deepEqual(monthKeysBetween("2028-02-01", "2028-02-29"), ["202802"]);
	assert.deepEqual(monthKeysBetween("2026-11-01", "2026-11-30"), ["202611"]);
	const long = monthKeysBetween("2026-01-31", "2028-12-01");
	assert.equal(long.length, 36);
	assert.equal(new Set(long).size, long.length);
	assert.equal(long[0], "202601");
	assert.equal(long.at(-1), "202812");
});

test("UTC and Asia/Tokyo processes produce identical dates and month keys", () => {
	const code = 'import { addDays, monthKeysBetween } from "./updateBoatUpcomingSchedule.mjs"; console.log(JSON.stringify({end:addDays("2026-11-20",31),months:monthKeysBetween("2026-11-20","2026-12-21")}))';
	const outputs = ["UTC", "Asia/Tokyo"].map((zone) => {
		const result = spawnSync(process.execPath, ["--input-type=module", "-e", code], { cwd: path.dirname(fileURLToPath(import.meta.url)), encoding: "utf8", env: { ...process.env, TZ: zone } });
		assert.equal(result.status, 0, result.stderr);
		return result.stdout.trim();
	});
	assert.equal(outputs[0], outputs[1]);
	assert.deepEqual(JSON.parse(outputs[0]), { end: "2026-12-21", months: ["202611", "202612"] });
});

test("verified official-shaped HTML yields venue, period, title and source URL", () => {
	const html = page("202611", { 0: novEvent });
	const items = parseMonthlySchedule({ monthKey: "202611", url: urlFor("202611"), html }, { startDate: "2026-11-20", endDate: "2026-12-21" });
	assert.equal(items.length, 1);
	assert.deepEqual([items[0].venueCode, items[0].startDate, items[0].endDate, items[0].seriesName], ["01", "2026-11-20", "2026-11-25", "公式大会A"]);
	assert.equal(items[0].sourceMonthUrl, urlFor("202611"));
});

test("missing link in an otherwise valid official event keeps month-page provenance", () => {
	const html = page("202612", { 0: event("12/01 - 12/05", "リンク未公開の大会", "") });
	const items = parseMonthlySchedule({ monthKey: "202612", url: urlFor("202612"), html }, { startDate: "2026-12-01", endDate: "2026-12-21" });
	assert.equal(items[0].seriesName, "リンク未公開の大会");
	assert.equal(items[0].sourceUrl, urlFor("202612"));
});

test("changed HTML structure and HTTP 200 error page are rejected", () => {
	const range = { startDate: "2026-11-20", endDate: "2026-12-21" };
	for (const html of ["<html><title>エラー</title><body>アクセスできません</body></html>", page("202611", { 0: novEvent }).replace('class="scheduleTable"', 'class="changedTable"')]) {
		assert.throws(() => parseMonthlySchedule({ monthKey: "202611", url: urlFor("202611"), html }, range), /Invalid official monthly schedule page/);
	}
});

test("HTTP 200 error page and changed structure preserve the previous JSON SHA", async (t) => {
	const originalFetch = globalThis.fetch;
	t.after(() => { globalThis.fetch = originalFetch; });
	for (const html of ["<html><title>エラー</title><body>アクセスできません</body></html>", page("202611", { 0: novEvent }).replace('class="scheduleTable"', 'class="changedTable"')]) {
		const f = fixture(t);
		globalThis.fetch = async (url) => ({ ok: true, status: 200, url, text: async () => html });
		await assert.rejects(main({ targetDate: "2026-11-20", days: 0, outputDir: f.outputDir }), /Invalid official monthly schedule page/);
		assert.equal(hash(f.output), f.before);
	}
});

test("wrong selected month, response URL and malformed event are rejected", () => {
	const range = { startDate: "2026-11-20", endDate: "2026-12-21" };
	const html = page("202611", { 0: novEvent });
	assert.throws(() => parseMonthlySchedule({ monthKey: "202611", url: urlFor("202612"), html }, range), /URL\/month mismatch/);
	assert.throws(() => parseMonthlySchedule({ monthKey: "202611", url: urlFor("202611"), html: html.replace('value="2026"', 'value="2025"') }, range), /Invalid official monthly schedule page/);
	assert.throws(() => parseMonthlySchedule({ monthKey: "202611", url: urlFor("202611"), html: page("202611", { 0: event("11/31 - 12/02", "不正な日付") }) }, range), /Invalid schedule event/);
	assert.throws(() => parseMonthlySchedule({ monthKey: "202611", url: urlFor("202611"), html: page("202611", { 0: "<li><dt>11/20 - 11/25</dt><dd></dd></li>" }) }, range), /Invalid schedule event/);
});

test("HTTP 403 and 404 include month and URL and preserve previous JSON", async (t) => {
	const originalFetch = globalThis.fetch;
	t.after(() => { globalThis.fetch = originalFetch; });
	for (const status of [403, 404]) {
		const f = fixture(t);
		globalThis.fetch = async (url) => ({ ok: false, status, url });
		await assert.rejects(main({ targetDate: "2026-11-20", days: 31, outputDir: f.outputDir }), new RegExp(`HTTP ${status} month=202611 url=.*ym=202611`));
		assert.equal(hash(f.output), f.before);
	}
});

test("failure in the second month cannot publish a partial feed", async (t) => {
	const f = fixture(t);
	const requested = [];
	mockFetch(t, async (url) => {
		const month = new URL(url).searchParams.get("ym");
		requested.push(month);
		return month === "202611" ? { ok: true, status: 200, url, text: async () => page(month, { 0: novEvent }) } : { ok: false, status: 403, url };
	});
	await assert.rejects(main({ targetDate: "2026-11-20", days: 31, outputDir: f.outputDir }), /HTTP 403 month=202612/);
	assert.deepEqual(requested, ["202611", "202612"]);
	assert.equal(hash(f.output), f.before);
});

test("HTTP 200 with no events or no events in range cannot publish no-schedule", async (t) => {
	const originalFetch = globalThis.fetch;
	t.after(() => { globalThis.fetch = originalFetch; });
	for (const html of [page("202611"), page("202611", { 0: event("11/01 - 11/05", "期間外大会") })]) {
		const f = fixture(t);
		globalThis.fetch = async (url) => ({ ok: true, status: 200, url, text: async () => html });
		await assert.rejects(main({ targetDate: "2026-11-20", days: 0, outputDir: f.outputDir }), /No verified schedule/);
		assert.equal(hash(f.output), f.before);
	}
});

test("same input can run twice and a cross-month duplicate is kept once", async (t) => {
	const f = fixture(t);
	const repeated = event("11/28 - 12/02", "月またぎ大会");
	mockFetch(t, async (url) => {
		const month = new URL(url).searchParams.get("ym");
		return { ok: true, status: 200, url, text: async () => page(month, { 0: repeated, 1: month === "202612" ? decEvent : novEvent }) };
	});
	const first = await main({ targetDate: "2026-11-20", days: 31, outputDir: f.outputDir });
	const second = await main({ targetDate: "2026-11-20", days: 31, outputDir: f.outputDir });
	assert.equal(first.sourceStatus, "ok");
	assert.equal(first.items.length, 3);
	assert.deepEqual(first.items.map(({ date, venueCode, seriesName }) => [date, venueCode, seriesName]), second.items.map(({ date, venueCode, seriesName }) => [date, venueCode, seriesName]));
	assert.equal(JSON.parse(fs.readFileSync(f.output, "utf8")).items.length, 3);
});

test("conflicting duplicate dates hold the previous feed", async (t) => {
	const f = fixture(t);
	mockFetch(t, async (url) => {
		const month = new URL(url).searchParams.get("ym");
		const title = month === "202611" ? "大会A" : "大会B";
		return { ok: true, status: 200, url, text: async () => page(month, { 0: event("11/28 - 12/02", title) }) };
	});
	await assert.rejects(main({ targetDate: "2026-11-20", days: 31, outputDir: f.outputDir }), /Conflicting schedule event/);
	assert.equal(hash(f.output), f.before);
});
