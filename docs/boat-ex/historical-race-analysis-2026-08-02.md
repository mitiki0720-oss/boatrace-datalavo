# Boat EX Historical Race Analysis (2026-08-02)

## Scope

`scripts/generateBoatExHistoricalRaceAnalysis.mjs` expands the existing latest-date race-analysis layer to every date in `public/data/boatrace-ex/index.generated.json`.

The generated output is split into one date shard per history date. The page fetches `history-summary.json` and `history-index.json` first, then fetches only the user-selected date shard. It never renders the full history in one DOM list.

## Outputs

- `public/data/boatrace-ex/derived/race-analysis/history-summary.json`
- `public/data/boatrace-ex/derived/race-analysis/history-index.json`
- `public/data/boatrace-ex/derived/race-analysis/dates/YYYY-MM-DD.json`
- `public/data/boatrace-ex/audit/historical-race-analysis-2026-08-02.generated.json`

Each shard is built only from the matching history, coverage, racer evidence, and venue evidence files. It exposes official result, trifecta payout, exhibition, weather, water status, and racer linkage availability.

## Identity Contract

`officialRegistrationNo` is copied only from the race source. `resolvedRegistrationNo` is present only when the existing racer evidence declares `exact-normalized-name-unique`. These fields remain separate; unresolved racers remain unresolved.

No prediction, recommendation, score, rank, ticket, guessed value, inferred value, fuzzy match, or partial-name match is generated.

## Verification

Run:

```powershell
node scripts/generateBoatExHistoricalRaceAnalysis.mjs
node scripts/checkBoatExHistoricalRaceAnalysis.mjs
node scripts/checkBoatExRaceAnalysis.mjs
node scripts/checkBoatExTabCompleteness.mjs
```
