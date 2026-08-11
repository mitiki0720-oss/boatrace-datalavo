# Midnight Boat Venue Update

`scripts/updateBoatMidnightVenues.mjs` refreshes exhibition, result, and weather data only for races that are active after the regular daytime update window.

## Detection

The script reads `public/data/boatrace/today.generated.json` and selects venues in this order:

1. A source-backed venue label such as `title`, category, day part, or tag contains `ミッドナイト` or `midnight`.
2. For a venue without that label, its source-backed latest race closing time is `21:00` JST or later.

The second rule is recorded as `late-closing-fallback` in the audit. It does not use a fixed venue name, so a venue is not selected merely because it is normally associated with midnight racing. Venues ending before 21:00 JST remain untouched.

## Data Flow

For detected venue codes only, the script reuses the existing official update paths:

- `scripts/updateBoatTodayRaceDetails.mjs --mode final --target-venues <codes>` updates official before info, exhibitions, settled results, and weather in `today.generated.json` and `today-race-details.generated.json`.
- `scripts/updateBoatVenueExtras.mjs --target-venues <codes>` refreshes dedicated official venue extras while preserving non-target venue entries.

The browser already reads these same files on the Prediction and Races pages. No separate page-specific data route is introduced.

## Audit and No-op

Each date records `public/data/boatrace/audit/midnight-venue-update-YYYY-MM-DD.generated.json`, including detected/skipped venues, reason, source reference, latest closing time, updated file paths, and exhibition/result/weather coverage before and after the run.

When no venue is detected, the run succeeds without updating race data. A prior same-day no-op audit is retained so repeated scheduled runs do not create empty commits.

Use `node scripts/updateBoatMidnightVenues.mjs --dry-run` to inspect detection without writing generated data or an audit. `node scripts/checkBoatMidnightVenueUpdate.mjs` validates the detector fixtures and the current-day audit when present.

## Schedule

`.github/workflows/update-boat-midnight-venues.yml` runs every 15 minutes from 17:05 to 23:50 JST (`5,20,35,50 8-14 * * *` UTC). It has its own `boat-midnight-update-${{ github.ref }}` concurrency group and does not change the regular `Update boat race data` schedule.
