import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const range = { startDate: "2026-11-22", endDate: "2026-12-23" };
const acquiredAt = "2026-11-22T08:20:00+09:00";
const monthUrl = (month) => `https://www.boatrace.jp/owsp/sp/race/monthlyschedule?ym=${month}`;
const item = (code, name) => ({
	id: `${name}-20261122`, date: "2026-11-22", venueCode: code, venueName: name,
	seriesName: `${name}大会`, title: `${name}大会`, grade: "一般", startDate: "2026-11-20",
	endDate: "2026-11-25", dateRange: "11.20 - 11.25", session: "Day",
	sourceUrl: `https://www.boatrace.jp/owsp/sp/race/assen?jcd=${code}`,
	sourceMonthUrl: monthUrl("202611"), updatedAt: acquiredAt,
});
const feed = (items) => ({
	version: 1, generatedAt: acquiredAt, source: "boatrace-official-monthly-schedule",
	sourceStatus: "ok", range, items,
});

test("Dashboard accepts only verified current schedule data", async (t) => {
	const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), "boat-schedule-display-"));
	const server = await createServer({ root, cacheDir, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } });
	t.after(async () => { await server.close(); fs.rmSync(cacheDir, { recursive: true, force: true }); });
	const { classifyBoatUpcomingSchedule, getBoatUpcomingScheduleDisplay, loadBoatUpcomingSchedule, loadBoatTodayFeed } =
		await server.ssrLoadModule("/src/lib/boatDataFeed.ts");
	const { DashboardPage } = await server.ssrLoadModule("/src/pages/DashboardPage.tsx");

	await t.test("one and several verified meets retain every card and correct counts", () => {
		for (const items of [[item("01", "桐生")], [item("01", "桐生"), item("02", "戸田"), item("10", "三国")]]) {
			const state = classifyBoatUpcomingSchedule(feed(items), range);
			assert.equal(state.status, "available");
			const view = getBoatUpcomingScheduleDisplay(state);
			assert.equal(view.countLabel, `${items.length}開催`);
			assert.equal(view.metricValue, `${items.length} meets`);
			assert.deepEqual(view.items.map(({ id }) => id), items.map(({ id }) => id));
			assert.equal(view.message, null);
		}
	});

	await t.test("the currently published no-schedule zero feed is unverified", () => {
		const current = JSON.parse(fs.readFileSync(path.join(root, "public/data/boatrace/upcoming-schedule.generated.json"), "utf8"));
		assert.equal(current.sourceStatus, "no-schedule");
		assert.deepEqual(current.items, []);
		const state = classifyBoatUpcomingSchedule(current, range);
		assert.equal(state.status, "unavailable");
		const view = getBoatUpcomingScheduleDisplay(state);
		assert.equal(view.countLabel, "確認中");
		assert.equal(view.metricValue, "確認中");
		assert.match(view.message, /開催日程を確認できません/);
	});

	await t.test("HTTP 403, broken JSON and network failure never become zero meets", async () => {
		const original = globalThis.fetch;
		try {
			for (const response of [
				async () => ({ ok: false, status: 403 }),
				async () => ({ ok: true, json: async () => { throw new SyntaxError("bad JSON"); } }),
				async () => { throw new Error("network unavailable"); },
			]) {
				globalThis.fetch = response;
				const state = await loadBoatUpcomingSchedule(range);
				assert.equal(state.status, "unavailable");
				assert.equal(getBoatUpcomingScheduleDisplay(state).countLabel, "確認中");
			}
		} finally { globalThis.fetch = original; }
	});

	await t.test("missing items, wrong source, stale range and malformed rows are held", () => {
		for (const invalid of [
			{ ...feed([]), items: undefined },
			{ ...feed([item("01", "桐生")]), source: "unknown" },
			{ ...feed([item("01", "桐生")]), range: { startDate: "2026-11-21", endDate: "2026-12-22" } },
			{ ...feed([item("01", "桐生")]), generatedAt: "2026-11-21T08:20:00+09:00" },
			feed([{ ...item("01", "桐生"), sourceUrl: "https://example.com/race" }]),
			feed([{ ...item("01", "桐生"), sourceMonthUrl: monthUrl("202610") }]),
			feed([item("01", "桐生"), item("01", "桐生")]),
		]) assert.equal(classifyBoatUpcomingSchedule(invalid, range).status, "unavailable");
	});

	await t.test("zero requires explicit mock official evidence for every requested month", () => {
		const empty = { ...feed([]), sourceStatus: "no-schedule" };
		assert.equal(classifyBoatUpcomingSchedule(empty, range).status, "unavailable");
		const pages = ["202611", "202612"].map((monthKey) => ({
			monthKey, url: monthUrl(monthKey), retrievedAt: acquiredAt, sha256: "a".repeat(64), finding: "no-events-in-range",
		}));
		const evidenced = { ...empty, noScheduleEvidence: { kind: "official-monthly-pages-verified-empty", range, pages } };
		assert.equal(classifyBoatUpcomingSchedule({ ...evidenced, noScheduleEvidence: { ...evidenced.noScheduleEvidence, pages: pages.slice(0, 1) } }, range).status, "unavailable");
		assert.equal(classifyBoatUpcomingSchedule({ ...evidenced, noScheduleEvidence: { ...evidenced.noScheduleEvidence, pages: [{ ...pages[0], sha256: "unverified" }, pages[1]] } }, range).status, "unavailable");
		const state = classifyBoatUpcomingSchedule(evidenced, range);
		assert.equal(state.status, "verified-none");
		assert.equal(getBoatUpcomingScheduleDisplay(state).countLabel, "0開催");
	});

	await t.test("first render shows no expired fixed samples or false zero", () => {
		const html = renderToStaticMarkup(React.createElement(DashboardPage));
		assert.match(html, /開催日程を確認できません/);
		assert.doesNotMatch(html, /0開催|2026-05-05|2026-05-07/);
	});

	await t.test("today race feed remains independent of schedule failure", async () => {
		const original = globalThis.fetch;
		const today = { version: 1, date: range.startDate, generatedAt: acquiredAt, source: "official", venues: [{ id: "kiryu", venueCode: "01", venueName: "桐生", races: [] }] };
		try {
			globalThis.fetch = async (url) => String(url).includes("today.generated.json")
				? { ok: true, json: async () => today } : { ok: false, status: 403 };
			assert.deepEqual(await loadBoatTodayFeed({ activeDate: range.startDate }), today);
			assert.equal((await loadBoatUpcomingSchedule(range)).status, "unavailable");
		} finally { globalThis.fetch = original; }
	});
});
