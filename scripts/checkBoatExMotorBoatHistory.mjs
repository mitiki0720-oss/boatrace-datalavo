import fs from "node:fs";
const path = "public/data/boatrace-ex/derived/motor-boat-history/latest.json";
try { const data = JSON.parse(fs.readFileSync(path, "utf8")); if (data.kind !== "boat-ex-motor-boat-history-v1" || !(data.summary?.sourceRaceCount > 0) || !(data.venues?.length > 0) || !data.venues.some((venue) => venue.motors?.length > 0)) throw new Error("source field unavailable: officialRace.racers.motorNo"); console.log(JSON.stringify({ ok: true, dateRange: data.dateRange, summary: data.summary }, null, 2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
