import fs from "node:fs";
const path = "public/data/boatrace-ex/derived/entry-shift-history/latest.json";
try { const data = JSON.parse(fs.readFileSync(path, "utf8")); if (data.kind !== "boat-ex-entry-shift-history-v1" || !(data.summary?.exhibitionRaceCount > 0) || !(data.venues?.length > 0)) throw new Error("source field unavailable: officialExhibition.entries.course"); console.log(JSON.stringify({ ok: true, dateRange: data.dateRange, summary: data.summary }, null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
