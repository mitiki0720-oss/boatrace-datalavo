import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const johnsonPath = path.join(repoRoot, "public", "data", "boatrace", "johnson-predictions.generated.json");
const todayPath = path.join(repoRoot, "public", "data", "boatrace", "today-race-details.generated.json");

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));
const readSource = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

const todayFeed = readJson(todayPath);
const johnsonPayload = readJson(johnsonPath);
const activeDate = String(todayFeed.date ?? "").trim();

assert.match(activeDate, /^\d{4}-\d{2}-\d{2}$/, "today-race-details must provide an active date");
assert.ok(Array.isArray(johnsonPayload.records), "Johnson payload records must be an array");
assert.ok(johnsonPayload.records.every((record) => record?.date === activeDate), "Johnson payload must contain active-date records only");

for (const key of [...(johnsonPayload.notifiedSlackResultKeys ?? []), ...(johnsonPayload.notifiedSlackHitKeys ?? [])]) {
	assert.ok(String(key).includes(`:${activeDate}:`), `notification key is not for active date: ${key}`);
}

const johnsonStorageSource = readSource(path.join("src", "lib", "boatJohnsonPredictionStorage.ts"));
const operationalPruneSource = readSource(path.join("src", "lib", "boatOperationalStoragePrune.ts"));
const localMaintenanceSource = readSource(path.join("src", "lib", "boatLocalStorageMaintenance.ts"));
const predictionPageSource = readSource(path.join("src", "pages", "PredictionPage.tsx"));
const notifySource = readSource(path.join("scripts", "notifyBoatSlackHits.mjs"));

assert.match(johnsonStorageSource, /const BOAT_JOHNSON_FALLBACK_KEEP_DAYS = 1;/);
assert.match(operationalPruneSource, /const keepDates = \[activeDate\]\.filter\(Boolean\);/);
assert.match(operationalPruneSource, /return params\.date === params\.activeDate;/);
assert.match(localMaintenanceSource, /const keepDates = activeDate \? \[activeDate\] : \[\];/);
assert.match(predictionPageSource, /const todayOnlyJohnsonRecords = pruneBoatJohnsonPredictionRecordsByDate\(/);
assert.match(predictionPageSource, /saveBoatJohnsonPredictionRecords\(todayOnlyJohnsonRecords\)/);
assert.match(notifySource, /function filterNotificationKeysByActiveDate\(/);
assert.match(notifySource, /record\.date === activeDate/);

console.log(JSON.stringify({
	ok: true,
	activeDate,
	recordCount: johnsonPayload.records.length,
	notifiedSlackResultKeyCount: johnsonPayload.notifiedSlackResultKeys?.length ?? 0,
	notifiedSlackHitKeyCount: johnsonPayload.notifiedSlackHitKeys?.length ?? 0,
}, null, 2));
