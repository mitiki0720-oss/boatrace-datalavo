# Boat EX current-day prediction coverage

## Separation of roles

Historical EX covers 2026-05-24 through 2026-08-02. It is the source-backed result and payout layer for venue tendencies, roughness, winning methods, and historical racer features.

Current-day prediction coverage is a separate source-backed completeness layer built from `public/data/boatrace/today-race-details.generated.json`. It does not promote result-dependent EX outputs before results and payouts are confirmed.

The separately displayed latest historical venue evidence uses the explicit `【KURARI BOAT EX 履歴latest-day venue-evidence】` label. See [the wording audit](current-day-prediction-coverage-wording-audit-2026-08-15.md) for the distinction from prediction-day coverage.

## Current coverage

- target date: 2026-08-15
- venues: 18
- races: 216
- entry-complete races: 216/216
- registration numbers: 1,296/1,296 slots
- exact registered-identity links: 1,098/1,296 slots
- motor and boat values: 1,296/1,296 slots
- exhibition display times: 0 complete, 0 partial, 216 missing
- weather, wind, and wave values: 0/216 because official values are still marked as pending confirmation
- results and payouts: 0/216, `pre-race`

`pre-race` is valid. It means current entry material is available while result-based `today-flow` and `race-analysis` remain ungenerated until outcomes are confirmed.

## Regeneration and validation

Run:

```powershell
node scripts/generateBoatExCurrentDayPredictionCoverage.mjs
node scripts/checkBoatExCurrentDayPredictionCoverage.mjs
```

The daily update entry point runs both commands after it refreshes current race details. The coverage only reports observed source availability and never creates results, payouts, rankings, or betting output.
