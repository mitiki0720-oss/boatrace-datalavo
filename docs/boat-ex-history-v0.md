# BOATRACE EX DATA LABO history v0

Phase 3 history v0 is a normalized, source-backed snapshot generated from existing official generated JSON only.

This phase does not create React UI, prediction signals, user summaries, review diffs, localStorage exports, or derived venue bias metrics.

## Inputs

The generator reads only these official generated feeds:

- `public/data/boatrace/today-race-details.generated.json`
- `public/data/boatrace/today.generated.json`
- `public/data/boatrace/venue-extras.generated.json`

It must not read or touch `public/data/reviews/**`.

## Outputs

For each target date:

```text
public/data/boatrace-ex/history/races/YYYY-MM-DD.json
public/data/boatrace-ex/coverage/YYYY-MM-DD.json
public/data/boatrace-ex/manifest.generated.json
```

## Commands

```bash
node scripts/generateBoatExHistory.mjs
node scripts/generateBoatExHistory.mjs --date 2026-07-13
node scripts/generateBoatExHistory.mjs --dry-run
node scripts/generateBoatExHistory.mjs --date 2026-07-13 --dry-run
node scripts/generateBoatExHistory.mjs --date 2026-07-13 --allow-empty
node scripts/checkBoatExHistory.mjs --date 2026-07-13
node scripts/checkBoatExHistory.mjs --date 2026-07-13 --allow-empty
```

## Empty output safety guard

The generator refuses to write empty history output by default.

If a requested date produces `records: 0` or `venues: 0`, `generateBoatExHistory.mjs` exits with code `1` before writing `history`, `coverage`, or `manifest`.

This guard also applies to `--dry-run`. A dry-run with empty output writes no files and exits with code `1` so the dangerous state is visible in CI or local checks.

Use `--allow-empty` only when an empty output is intentional:

```bash
node scripts/generateBoatExHistory.mjs --date 2099-01-01 --allow-empty
node scripts/generateBoatExHistory.mjs --date 2099-01-01 --dry-run --allow-empty
```

When `--allow-empty` is used, the script prints a warning. Without `--allow-empty`, an existing non-empty EX history file must not be overwritten by an empty output.

`checkBoatExHistory.mjs` also fails on `records: 0` by default. `--allow-empty` only permits a structurally valid empty file when that is explicitly intended.

This is required because Phase 4+ may regenerate older history dates while the current official generated feeds no longer contain that date. The generator must protect previously generated EX history from accidental empty overwrites.

## history JSON

```json
{
  "schemaVersion": 1,
  "kind": "boatrace-ex-history-races",
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO8601",
  "sourceFiles": [],
  "records": []
}
```

Each record is keyed by:

- `date`
- `venueCode`
- `venueName`
- `raceNo`
- `raceKey`

Phase 3 v0 may include:

- `officialRace`
- `officialResult`
- `officialExhibition`
- `weather`
- `waterSurface`
- `motor`
- `boat`
- `racer`
- `sources`
- `coverage`

Phase 3 v0 intentionally leaves these unsupported:

- `prediction`
- `summary`
- `review`
- `derivedSignals`

Those fields are user/derived work and are not generated from official feeds in this phase.

## coverage JSON

Coverage is date-scoped:

```json
{
  "schemaVersion": 1,
  "kind": "boatrace-ex-coverage-date",
  "date": "YYYY-MM-DD",
  "generatedAt": "ISO8601",
  "sourceFiles": [],
  "totals": {
    "venues": 0,
    "races": 0
  },
  "fieldTotals": {},
  "venues": [],
  "sourceCoverage": {}
}
```

Coverage statuses:

- `complete`
- `partial`
- `pending`
- `missing`
- `not-supported`
- `unknown`

`pending` is used when official data is expected but not yet present, for example result or exhibition data before publication.

## manifest JSON

`manifest.generated.json` lists generated EX files and their source/coverage status.

```json
{
  "schemaVersion": 1,
  "kind": "boatrace-ex-manifest",
  "generatedAt": "ISO8601",
  "sourceFiles": [],
  "files": []
}
```

## Source-backed rules

- Do not infer registration numbers, branches, classes, exhibition values, weather, result, motor, or boat values.
- Do not fill missing values with `0`, empty strings, or guessed placeholders.
- Preserve unknown/missing/pending/not-supported status through coverage.
- Keep official data separate from user and derived data.
- Do not read, move, edit, delete, or regenerate `public/data/reviews/**`.
- Do not overwrite `public/data/boatrace/*.generated.json`.

## v0 limitations

history v0 is a normalized official-source foundation. It is not a prediction model and does not rank racers, grade motors, score exhibitions, infer water tendencies, or analyze venue bias.
