import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const repoRoot = process.cwd();
const tempDir = path.join(repoRoot, "node_modules", ".cache", `boat-operational-prune-check-${process.pid}`);
const originalConsoleInfo = console.info;
const originalConsoleWarn = console.warn;

console.info = () => {};
console.warn = () => {};

function transpileTsModule(relativePath) {
	const sourcePath = path.join(repoRoot, relativePath);
	const outputPath = path.join(tempDir, path.basename(relativePath).replace(/\.ts$/, ".mjs"));
	const source = fs.readFileSync(sourcePath, "utf8");
	const transpiled = ts.transpileModule(source, {
		compilerOptions: {
			module: ts.ModuleKind.ESNext,
			target: ts.ScriptTarget.ES2022,
			jsx: ts.JsxEmit.ReactJSX,
		},
	}).outputText.replace(/from "(\.\/[^"]+)"/g, 'from "$1.mjs"');

	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, transpiled);
	return outputPath;
}

async function importTsModules(relativePaths, entryPath) {
	for (const relativePath of relativePaths) {
		transpileTsModule(relativePath);
	}
	return import(`file://${transpileTsModule(entryPath).replace(/\\/g, "/")}`);
}

const modules = [
	path.join("src", "lib", "boatBetParser.ts"),
	path.join("src", "lib", "boatPredictionParser.ts"),
	path.join("src", "lib", "boatOperationDate.ts"),
	path.join("src", "lib", "boatPredictionStorage.ts"),
	path.join("src", "lib", "boatPracticeResultStorage.ts"),
	path.join("src", "lib", "boatJohnsonPredictionStorage.ts"),
	path.join("src", "lib", "boatOperationalStoragePrune.ts"),
];
const operationDate = await importTsModules(modules, path.join("src", "lib", "boatOperationDate.ts"));
const pruneModule = await importTsModules(modules, path.join("src", "lib", "boatOperationalStoragePrune.ts"));
const predictionStorage = await importTsModules(modules, path.join("src", "lib", "boatPredictionStorage.ts"));
const practiceStorage = await importTsModules(modules, path.join("src", "lib", "boatPracticeResultStorage.ts"));
const johnsonStorage = await importTsModules(modules, path.join("src", "lib", "boatJohnsonPredictionStorage.ts"));

const {
	BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY,
	pruneBoatOperationalLocalStorage,
	pruneBoatOperationalStorageOnce,
	pruneBoatRecordMapByOperationalDate,
	shouldRunBoatOperationalPrune,
} = pruneModule;
const { getBoatOperationDate } = operationDate;
const { BOAT_PREDICTION_STORAGE_KEY } = predictionStorage;
const { BOAT_PRACTICE_RESULT_STORAGE_KEY } = practiceStorage;
const { BOAT_JOHNSON_PREDICTION_STORAGE_KEY } = johnsonStorage;

class MockLocalStorage {
	constructor() {
		this.map = new Map();
		this.failKeys = new Set();
	}

	get length() {
		return this.map.size;
	}

	key(index) {
		return Array.from(this.map.keys())[index] ?? null;
	}

	getItem(key) {
		return this.map.has(String(key)) ? this.map.get(String(key)) : null;
	}

	setItem(key, value) {
		if (this.failKeys.has(String(key))) {
			throw new DOMException("quota", "QuotaExceededError");
		}
		this.map.set(String(key), String(value));
	}

	removeItem(key) {
		this.map.delete(String(key));
	}

	clear() {
		this.map.clear();
	}
}

const storage = new MockLocalStorage();
globalThis.window = { localStorage: storage };

const setJson = (key, value) => storage.setItem(key, JSON.stringify(value));
const getJson = (key) => JSON.parse(storage.getItem(key) || "{}");

const mikuni2Text = [
	"\u3010\u8cb7\u3044\u76ee\ud83d\udcdd\u3011",
	"\u8cb7\u3044\u76ee\uff0810\u70b9\uff09",
	"3\u9023\u5358\uff08\u539a\u30812\u70b9\uff09\uff1a1/02",
	"01\u30001-3-2",
	"02\u30001-3-6",
	"03\u30001-3-4",
	"04\u30001-2-3",
	"05\u30001-2-6",
	"06\u30001-6-3",
	"07\u30003-1-2",
	"08\u30003-1-6",
	"09\u30003-2-1",
	"10\u30003-6-1",
].join("\n");
const mikuni5Text = [
	"\u3010\u8cb7\u3044\u76ee\ud83d\udcdd\u3011",
	"\u8cb7\u3044\u76ee\uff0810\u70b9\uff09",
	"3\u9023\u5358",
	"01\u30002-1-5",
	"02\u30002-5-1",
	"03\u30002-5-4",
	"04\u30002-5-3",
	"05\u30002-4-5",
	"06\u30005-2-4",
	"07\u30005-2-3",
	"08\u30005-4-2",
	"09\u30004-5-2",
	"10\u30003-2-5",
].join("\n");

const predictionRecord = (key, date, text = mikuni2Text) => ({
	raceKey: key,
	raceId: key,
	venueName: "\u4e09\u56fd",
	date,
	raceNo: key.includes("05") ? 5 : 2,
	predictionText: text,
	rawPredictionText: text,
	tickets: [],
	parsedBets: [],
	savedAt: `${date || "2026-06-05"}T00:00:00.000Z`,
});
const practiceRecord = (key, date) => ({
	raceKey: key,
	venueName: "\u4e09\u56fd",
	date,
	raceNo: 2,
	actualFinishOrderText: "1-2-3",
	investmentAmount: 1000,
	payoutAmount: 0,
	profitLoss: -1000,
	roi: 0,
	practiceMemo: "",
	savedAt: `${date || "2026-06-05"}T00:00:00.000Z`,
});
const johnsonRecord = (key, date) => ({
	raceKey: key,
	venueName: "\u4e09\u56fd",
	date,
	raceNo: 2,
	predictionText: "johnson",
	savedAt: `${date || "2026-06-05"}T00:00:00.000Z`,
});

assert.equal(getBoatOperationDate(new Date("2026-06-04T20:59:00.000Z")), "2026-06-04", "05:59 JST should still be previous operational date");
assert.equal(getBoatOperationDate(new Date("2026-06-04T21:00:00.000Z")), "2026-06-05", "06:00 JST should roll to current operational date");

const pureWarnings = [];
const purePruned = pruneBoatRecordMapByOperationalDate({
	old: { date: "2026-06-03" },
	previous: { date: "2026-06-04" },
	current: { date: "2026-06-05" },
	future: { date: "2026-06-06" },
	invalid: { date: "" },
}, {
	activeDate: "2026-06-05",
	previousDate: "2026-06-04",
	label: "fixture",
	warnings: pureWarnings,
});
assert.deepEqual(Object.keys(purePruned.records).sort(), ["current", "future", "invalid", "previous"], "pure prune should delete only dates older than previous operational date");
assert.equal(purePruned.removedCount, 1, "pure prune should count removed older records");
assert.equal(pureWarnings.length, 2, "future and invalid dates should warn but be kept");

function seedOperationalStorage() {
	storage.clear();
	setJson(BOAT_PREDICTION_STORAGE_KEY, {
		old: predictionRecord("old", "2026-06-03"),
		previous2: predictionRecord("previous2", "2026-06-04", mikuni2Text),
		current5: predictionRecord("current5", "2026-06-05", mikuni5Text),
		future: predictionRecord("future", "2026-06-06"),
		invalid: predictionRecord("invalid", ""),
	});
	setJson(BOAT_PRACTICE_RESULT_STORAGE_KEY, {
		old: practiceRecord("old-practice", "2026-06-03"),
		previous: practiceRecord("previous-practice", "2026-06-04"),
		current: practiceRecord("current-practice", "2026-06-05"),
		future: practiceRecord("future-practice", "2026-06-06"),
		invalid: practiceRecord("invalid-practice", ""),
	});
	setJson(BOAT_JOHNSON_PREDICTION_STORAGE_KEY, {
		old: johnsonRecord("old-johnson", "2026-06-03"),
		previous: johnsonRecord("previous-johnson", "2026-06-04"),
		current: johnsonRecord("current-johnson", "2026-06-05"),
		future: johnsonRecord("future-johnson", "2026-06-06"),
		invalid: johnsonRecord("invalid-johnson", ""),
	});
	storage.setItem("kurari-boat-data-labo-hit-notifications", JSON.stringify({ unknown: true }));
	storage.setItem("kurari-boat-data-labo-hit-notified-keys", JSON.stringify(["2026-06-03:hit"]));
}

seedOperationalStorage();
storage.setItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY, "2026-06-04");
assert.equal(shouldRunBoatOperationalPrune("2026-06-05"), true, "new operational date should need prune");
const first = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "first-fixture" });
assert.equal(first.skipped, false, "first prune should run");
assert.deepEqual(first.result.removed, { prediction: 1, practice: 1, johnson: 1 }, "first prune should delete only records older than previous operational date");
assert.equal(storage.getItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY), "2026-06-05", "successful prune should update marker");
assert.deepEqual(Object.keys(getJson(BOAT_PREDICTION_STORAGE_KEY)).sort(), ["current5", "future", "invalid", "previous2"], "prediction storage should keep previous, current, future, and invalid records");
assert.equal(getJson(BOAT_PREDICTION_STORAGE_KEY).previous2.tickets.length, 10, "Mikuni 2R previous-day prediction should keep 10 tickets after prune");
assert.equal(getJson(BOAT_PREDICTION_STORAGE_KEY).current5.tickets.length, 10, "Mikuni 5R current-day prediction should keep 10 tickets after prune");
assert.equal(getJson(BOAT_PREDICTION_STORAGE_KEY).previous2.betSummary.totalBets, 10, "previous-day bet summary should keep 10 tickets");
assert.equal(getJson("kurari-boat-data-labo-hit-notifications").unknown, true, "unknown hit notification storage should be preserved");
assert.deepEqual(getJson("kurari-boat-data-labo-hit-notified-keys"), ["2026-06-03:hit"], "hit notified keys should be preserved");

const reload = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "reload" });
assert.equal(reload.skipped, true, "same operational date reload should skip");
assert.equal(reload.reason, "already-pruned", "same operational date should skip by marker");
const focus = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "focus" });
assert.equal(focus.skipped, true, "same operational date focus should skip");
const visibility = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "visibilitychange" });
assert.equal(visibility.skipped, true, "same operational date visibility return should skip");
assert.equal(getJson(BOAT_PREDICTION_STORAGE_KEY).previous2.tickets.length, 10, "same-day events should not delete 10-ticket predictions");

seedOperationalStorage();
storage.setItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY, "2026-06-04");
const crossedDay = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "open-tab-crossed-0600" });
assert.equal(crossedDay.skipped, false, "open tab crossing 06:00 should prune once after focus/visible event");
const crossedDayDuplicate = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "duplicate-event" });
assert.equal(crossedDayDuplicate.skipped, true, "duplicate event after 06:00 should skip");

seedOperationalStorage();
storage.setItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY, "2026-06-04");
const concurrentFirst = pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "concurrent-first" });
const concurrentSecond = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "concurrent-second" });
assert.equal(concurrentSecond.skipped, true, "concurrent event should be blocked while prune is in-flight");
assert.equal(concurrentSecond.reason, "in-flight", "concurrent event should report in-flight");
await concurrentFirst;

seedOperationalStorage();
storage.setItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY, "2026-06-04");
storage.failKeys.add(BOAT_PREDICTION_STORAGE_KEY);
const originalConsoleError = console.error;
console.error = () => {};
const failed = await pruneBoatOperationalStorageOnce({ activeDate: "2026-06-05", previousDate: "2026-06-04", reason: "failure" });
console.error = originalConsoleError;
assert.equal(failed.skipped, false, "failed storage save still attempted prune");
assert.equal(failed.result.prediction.ok, false, "prediction save failure should be reported");
assert.equal(storage.getItem(BOAT_OPERATIONAL_STORAGE_PRUNE_MARKER_KEY), "2026-06-04", "failed prune should not update marker");
storage.failKeys.clear();

originalConsoleInfo("[check:boat-operational-storage-prune] passed");
console.info = originalConsoleInfo;
console.warn = originalConsoleWarn;
