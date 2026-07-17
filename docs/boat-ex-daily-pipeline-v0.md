# BOATRACE EX Daily Pipeline Runner v0

Phase 6B adds a manual runner for the BOATRACE EX daily pipeline. It is a local orchestration script only; it is not wired into GitHub Actions yet.

## Commands

```text
node scripts/generateBoatExDaily.mjs --date 2026-07-13 --dry-run
node scripts/generateBoatExDaily.mjs --date 2026-07-13
node scripts/generateBoatExDaily.mjs --date latest --dry-run
node scripts/generateBoatExDaily.mjs --date latest
node scripts/checkBoatExDaily.mjs --date 2026-07-13
node scripts/checkBoatExDaily.mjs --date latest
```

`--date latest` reads `public/data/boatrace-ex/index.generated.json` and uses `latestDate`.

## Runner Order

The runner resolves the target date, then executes the existing EX scripts in order:

1. Check existing Phase 3 history.
2. Generate Phase 3 history only when it is missing, or when `--refresh-history` is explicitly passed.
3. Generate and check venue evidence.
4. Generate and check racer evidence.
5. Generate and check the date index.
6. Print a JSON summary.

For an existing history date, the default behavior is to avoid regenerating Phase 3 history, coverage, and the Phase 3 manifest.

## Options

- `--dry-run`: passes dry-run mode to generators and does not write generated output.
- `--skip-write`: alias for `--dry-run`.
- `--refresh-history`: regenerates Phase 3 history even when history already exists.
- `--allow-empty`: passes through to lower-level scripts for explicit empty-output testing. It is not recommended for normal daily runs.

## Guards

The runner and checker must not read `public/data/reviews/**`.

The runner must not invent missing dates, counts, venue-bias scores, rough-index scores, today-flow scores, prediction signals, rankings, or racer profile labels.

Empty outputs remain guarded by the existing lower-level generators and checkers. A normal daily run should fail instead of overwriting useful EX files with empty output.

## Scope

Phase 6B does not add or modify GitHub Actions workflows. Workflow integration is planned for Phase 6C.

Later phases:

- Phase 6C: safe integration into the update-boat-data workflow
- Phase 7: multi-day venue bias
- Phase 8: rough index
- Phase 9: today flow
- Phase 10: prediction signals
