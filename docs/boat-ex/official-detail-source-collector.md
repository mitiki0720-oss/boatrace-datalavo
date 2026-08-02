# Boat EX Official Detail Source Collector

## Purpose

The collector preserves the current official/generated Boat Race detail feed as a source-backed snapshot before a later phase converts it into EX history. It does not create EX history, rankings, scores, predictions, or inferred racer identities.

## Safe Input Rule

`scripts/collectBoatExOfficialDetailSource.mjs` reads only these current official/generated files:

- `public/data/boatrace/today-race-details.generated.json`
- `public/data/boatrace/venue-extras.generated.json`

The requested `--date` must exactly match the date in `today-race-details.generated.json`. A schedule-only date is rejected. Race extras are joined only by the exact `venueCode` and `raceNo` pair. Registration numbers are copied only when explicitly present in the official detail input; missing values remain `null`.

## Commands

Inspect the current feed without writing:

```powershell
node scripts/collectBoatExOfficialDetailSource.mjs --date 2026-08-03 --from-current-generated --dry-run
```

Save the current official detail snapshot:

```powershell
node scripts/collectBoatExOfficialDetailSource.mjs --date 2026-08-03 --from-current-generated --write
node scripts/checkBoatExOfficialDetailSource.mjs --date 2026-08-03
```

The collector writes:

- `public/data/boatrace-ex/source/official-details/YYYY-MM-DD.json`
- `public/data/boatrace-ex/source/official-details/index.generated.json`

## Later History Conversion

A later phase may consume a saved official detail snapshot and create `history/races/YYYY-MM-DD.json` only after a dedicated source-backed conversion checker is added. It must preserve `sourceFetchedAt`, `sourceType`, and provenance; it must not use review files, dog files, schedule-only data, fuzzy matching, guessed registration numbers, placeholder identities, or fake analytical values.
