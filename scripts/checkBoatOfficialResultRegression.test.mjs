import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { getJstTimestampParts } from "./boatRaceDate.mjs";
import { preserveTodayRaceDetailsFeed } from "./boatExhibitionSnapshotPreservation.mjs";
import { evaluateBoatExCurrentDayHistoryRefresh } from "./boatExCurrentDayHistoryLifecycle.mjs";
process.env.BOAT_RACE_ENABLE_REMOTE_FETCH = "0";
const { main, mergeRaceResult, sanitizeRaceResultByTimeline } = await import("./updateBoatTodayRaceDetails.mjs");

const date = "2026-11-11";
const confirmed = () => ({
	status: "confirmed",
	finishOrder: ["1", "2", "3"],
	kimarite: "逃げ",
	startInfo: [{ frameNo: 1, stDisplay: ".12" }],
	payout3tan: { betType: "3連単", combination: "1-2-3", payout: "1,230円" },
	payouts: [{ betType: "3連単", combination: "1-2-3", payout: "1,230円" }],
	finalizedAt: "2026-11-11T20:00:00+09:00",
	source: "official:owpc-html+raceresult",
	sourceUrl: "https://www.boatrace.jp/owpc/pc/race/raceresult?hd=20261111&jcd=01&rno=1",
	fetchedAt: "2026-11-11T20:00:00+09:00",
});
const pending = () => ({ status: "pending", finishOrder: [], payouts: [], notes: "結果未取得" });
const race = (result, raceNo = 1, exhibitions = []) => ({ raceNo, deadlineTime: "19:00", result, exhibitions });
const feed = (result, feedDate = date, raceNo = 1, exhibitions = []) => ({
	date: feedDate,
	generatedAt: `${feedDate}T21:00:00+09:00`,
	venues: [{ venueCode: "01", date: feedDate, races: [race(result, raceNo, exhibitions)] }],
});
const outcome = (candidate, previous) => preserveTodayRaceDetailsFeed(candidate, previous, { generatedAt: "2026-11-12T06:30:00+09:00" });

test("前日finalの朝時刻で確定結果をpendingにしない", () => {
	const timestamps = getJstTimestampParts(date, new Date("2026-11-11T21:30:00Z"));
	assert.equal(timestamps.date, date);
	assert.equal(timestamps.hour, 6);
	assert.deepEqual(sanitizeRaceResultByTimeline(confirmed(), "19:00", timestamps), confirmed());
});

test("同一日・同一会場・同一Rの確定結果はpending取得から保持", () => {
	const previous = feed(confirmed());
	const candidate = feed(pending());
	outcome(candidate, previous);
	assert.deepEqual(candidate.venues[0].races[0].result.finishOrder, ["1", "2", "3"]);
	assert.equal(candidate.venues[0].races[0].result.kimarite, "逃げ");
	assert.deepEqual(candidate.venues[0].races[0].result.startInfo, confirmed().startInfo);
});

test("通信失敗で新結果が欠落しても確定結果を保持", () => {
	const previous = feed(confirmed());
	const candidate = feed(null);
	outcome(candidate, previous);
	assert.deepEqual(candidate.venues[0].races[0].result, confirmed());
});

test("同じ確定着順の再取得で払戻だけ欠けた場合は旧払戻を保持", () => {
	const previous = feed(confirmed());
	const candidate = feed({ ...confirmed(), payout3tan: null, payouts: [] });
	outcome(candidate, previous);
	assert.deepEqual(candidate.venues[0].races[0].result.payout3tan, confirmed().payout3tan);
	assert.deepEqual(candidate.venues[0].races[0].result.payouts, confirmed().payouts);
});

test("pendingの結果表と詳細表を結合しても確定着順・状態・払戻を保持", () => {
	const result = mergeRaceResult(confirmed(), { ...pending(), startInfo: [{ frameNo: 2, stDisplay: ".13" }] });
	assert.equal(result.status, "confirmed");
	assert.deepEqual(result.finishOrder, confirmed().finishOrder);
	assert.deepEqual(result.payout3tan, confirmed().payout3tan);
	assert.deepEqual(result.startInfo, [{ frameNo: 2, stDisplay: ".13" }]);
	assert.equal(result.fetchedAt, confirmed().fetchedAt);
});

test("未確定から新しい公式結果に更新", () => {
	const previous = feed(pending());
	const candidate = feed(confirmed());
	outcome(candidate, previous);
	assert.deepEqual(candidate.venues[0].races[0].result, confirmed());
});

test("公式訂正で着順が変わった場合は新結果・新払戻を採用", () => {
	const corrected = { ...confirmed(), finishOrder: ["2", "1", "3"],
		payout3tan: { betType: "3連単", combination: "2-1-3", payout: "2,400円" },
		payouts: [{ betType: "3連単", combination: "2-1-3", payout: "2,400円" }],
		finalizedAt: "2026-11-12T09:00:00+09:00" };
	const candidate = feed(corrected);
	outcome(candidate, feed(confirmed()));
	assert.deepEqual(candidate.venues[0].races[0].result, corrected);
});

test("訂正された着順に古い払戻を流用しない", () => {
	const corrected = mergeRaceResult(confirmed(), { status: "confirmed", finishOrder: ["2", "1", "3"] });
	assert.deepEqual(corrected.finishOrder, ["2", "1", "3"]);
	assert.equal(corrected.payout3tan, null);
	assert.deepEqual(corrected.payouts, []);
});

const cancelled = (sourceUrl = "https://www.boatrace.jp/owpc/pc/race/raceresult?hd=20261111&jcd=01&rno=1") => ({
	status: "cancelled", finishOrder: [], notes: "レース中止", source: "official:owpc-html+raceresult",
	sourceUrl, fetchedAt: "2026-11-12T09:00:00+09:00", payouts: [],
});

test("同一Rの後日公式中止は明示的なURL・取得時刻がある場合に反映", () => {
	const candidate = feed(cancelled());
	const result = outcome(candidate, feed(confirmed()));
	assert.equal(result.preservedResultCount, 0);
	assert.deepEqual(candidate.venues[0].races[0].result, cancelled());
	const decision = evaluateBoatExCurrentDayHistoryRefresh({
		targetDate: date,
		existingHistory: { date, records: [history(1).records[0]] },
		currentOfficialSource: candidate,
	});
	assert.equal(decision.shouldRefresh, true);
	assert.equal(decision.reason, "explicit-official-result-correction");
});

test("日付が違う公式URLを訂正根拠にせず旧確定結果を保持", () => {
	const candidate = feed(cancelled("https://www.boatrace.jp/owpc/pc/race/raceresult?hd=20261112&jcd=01&rno=1"));
	const result = outcome(candidate, feed(confirmed()));
	assert.equal(result.preservedResultCount, 1);
	assert.deepEqual(candidate.venues[0].races[0].result, confirmed());
});

test("同一着順でも明示的に変わった払戻額を旧値で埋めない", () => {
	const updated = { ...confirmed(), payout3tan: { betType: "3連単", combination: "1-2-3", payout: "1,500円" }, payouts: [] };
	const candidate = feed(updated);
	outcome(candidate, feed(confirmed()));
	assert.equal(candidate.venues[0].races[0].result.payout3tan.payout, "1,500円");
	assert.deepEqual(candidate.venues[0].races[0].result.payouts, []);
});

test("日付と会場とレース番号が違う旧結果を流用しない", () => {
	for (const candidate of [feed(pending(), "2026-11-12"),
		{ ...feed(pending()), venues: [{ venueCode: "02", date, races: [race(pending())] }] },
		feed(pending(), date, 2)]) {
		outcome(candidate, feed(confirmed()));
		assert.deepEqual(candidate.venues[0].races[0].result, pending());
	}
});

const history = (count, withPayout = true) => ({ date, records: Array.from({ length: count }, (_, index) => ({
	date, venueCode: String(1 + Math.floor(index / 12)).padStart(2, "0"), raceNo: index % 12 + 1,
	coverage: { officialResult: "complete", officialExhibition: "pending" },
	officialResult: { finishOrder: ["1", "2", "3"], payout: withPayout ? [{ betType: "3連単", payoutYen: "1,230円" }] : [] },
})) });
const official = (count, settled, withExhibition) => ({ date, venues: Array.from({ length: 12 }, (_, venueIndex) => ({
	venueCode: String(venueIndex + 1).padStart(2, "0"),
	races: Array.from({ length: count / 12 }, (_, raceIndex) => ({
		raceNo: raceIndex + 1,
		result: settled ? confirmed() : pending(),
		exhibitions: withExhibition ? Array.from({ length: 6 }, (_, index) => ({ frameNo: index + 1, exhibitionTime: "6.80" })) : [],
	})),
})) });

test("EX履歴144R結果・払戻から0Rへの後退を拒否", () => {
	const decision = evaluateBoatExCurrentDayHistoryRefresh({ targetDate: date, existingHistory: history(144), currentOfficialSource: official(144, false, true) });
	assert.equal(decision.official.resultAvailableRaceCount, 0);
	assert.equal(decision.history.resultAvailableRaceCount, 144);
	assert.equal(decision.shouldRefresh, false);
});

test("公式today feedも144Rの確定結果・払戻をpending再取得から保持", () => {
	const old = official(144, true, false);
	const candidate = official(144, false, true);
	for (const venue of old.venues) venue.date = date;
	for (const venue of candidate.venues) venue.date = date;
	const preservation = outcome(candidate, old);
	assert.equal(preservation.preservedResultCount, 144);
	assert.equal(candidate.venues.flatMap((venue) => venue.races).filter((entry) => entry.result.finishOrder.length === 3).length, 144);
	assert.equal(candidate.venues.flatMap((venue) => venue.races).filter((entry) => entry.result.payout3tan?.payout).length, 144);
	assert.equal(candidate.venues.flatMap((venue) => venue.races).filter((entry) => entry.exhibitions.length === 6).length, 144);
});

test("展示増加と結果減少が同時でもEX履歴を後退させない", () => {
	const old = history(144);
	old.records.forEach((record) => { record.coverage.officialExhibition = "pending"; });
	const decision = evaluateBoatExCurrentDayHistoryRefresh({ targetDate: date, existingHistory: old, currentOfficialSource: official(144, false, true) });
	assert.equal(decision.official.exhibitionCompleteRaceCount, 144);
	assert.equal(decision.shouldRefresh, false);
});

test("4更新モードで確定結果を保護し、2つのtoday JSONを同一内容で保存", async () => {
	for (const mode of ["initial", "active", "results", "final"]) {
		const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), `boat-result-regression-${mode}-`));
		const prior = feed(confirmed());
		prior.venues[0].races[0].result.startInfos = [];
		prior.venues[0].id = "kiryu";
		prior.venues[0].venueName = "桐生";
		prior.venues[0].races[0].raceId = "20261111-01-01";
		fs.writeFileSync(path.join(outputDir, "today-race-details.generated.json"), JSON.stringify(prior));
		fs.writeFileSync(path.join(outputDir, "today.generated.json"), JSON.stringify(prior));
		await main({ targetDate: date, mode, outputDir });
		const details = JSON.parse(fs.readFileSync(path.join(outputDir, "today-race-details.generated.json"), "utf8"));
		const today = JSON.parse(fs.readFileSync(path.join(outputDir, "today.generated.json"), "utf8"));
		assert.deepEqual(today, details, `${mode}: two generated feeds must agree`);
		assert.deepEqual(details.venues[0].races.find((entry) => entry.raceNo === 1).result.finishOrder, ["1", "2", "3"], mode);
		assert.deepEqual(details.venues[0].races.find((entry) => entry.raceNo === 1).result.payout3tan, confirmed().payout3tan, mode);
		assert.deepEqual(details.venues[0].races.find((entry) => entry.raceNo === 1).result.startInfo, confirmed().startInfo, mode);
	}
});

test("公式3連単払戻だけがある場合もEX向け払戻配列を保持", async () => {
	const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "boat-result-payout-only-"));
	const prior = feed({ ...confirmed(), payouts: [], payoutsFull: [] });
	prior.venues[0].id = "kiryu";
	prior.venues[0].venueName = "桐生";
	fs.writeFileSync(path.join(outputDir, "today-race-details.generated.json"), JSON.stringify(prior));
	await main({ targetDate: date, mode: "initial", outputDir });
	const details = JSON.parse(fs.readFileSync(path.join(outputDir, "today-race-details.generated.json"), "utf8"));
	const result = details.venues[0].races.find((entry) => entry.raceNo === 1).result;
	assert.deepEqual(result.payoutsFull[0], confirmed().payout3tan);
	assert.deepEqual(result.payouts[0], confirmed().payout3tan);
});

test("EX履歴は払戻だけ後退した場合も保留", () => {
	const source = official(144, true, true);
	source.venues[0].races[0].result.payout3tan = null;
	source.venues[0].races[0].result.payouts = [];
	const decision = evaluateBoatExCurrentDayHistoryRefresh({ targetDate: date, existingHistory: history(144), currentOfficialSource: source });
	assert.equal(decision.shouldRefresh, false);
	assert.ok(decision.reasons.includes("payout-coverage-regressed"));
});

test("件数が同じ公式の訂正着順・払戻もEX履歴更新の対象", () => {
	const corrected = feed({ ...confirmed(), finishOrder: ["2", "1", "3"],
		payout3tan: { betType: "3連単", combination: "2-1-3", payout: "2,400円" },
		sourceUrl: "https://www.boatrace.jp/owpc/pc/race/raceresult?hd=20261111&jcd=01&rno=1",
		fetchedAt: "2026-11-12T09:00:00+09:00" });
	const decision = evaluateBoatExCurrentDayHistoryRefresh({
		targetDate: date,
		existingHistory: { date, records: [history(1).records[0]] },
		currentOfficialSource: corrected,
	});
	assert.equal(decision.shouldRefresh, true);
	assert.equal(decision.reason, "explicit-official-result-correction");
});

test("EX履歴は総件数が同じでも別Rの結果消失を保留", () => {
	const source = official(144, true, true);
	source.venues[0].races[0].result = pending();
	const old = history(144);
	old.records[1].coverage.officialResult = "pending";
	const decision = evaluateBoatExCurrentDayHistoryRefresh({ targetDate: date, existingHistory: old, currentOfficialSource: source });
	assert.equal(decision.shouldRefresh, false);
	assert.ok(decision.regressionDetails.lostResults.includes("01:1"));
});

test("手動のEX履歴再生成も後退判定を迂回できない", () => {
	const source = fs.readFileSync(new URL("./generateBoatExDaily.mjs", import.meta.url), "utf8");
	assert.match(source, /!lifecycleRefresh\.blocked && \(args\.refreshHistory \|\| lifecycleRefresh\.shouldRefresh\)/);
});
