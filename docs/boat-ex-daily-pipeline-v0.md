# BOATRACE EX Daily Pipeline Runner v0

Phase 6B adds a manual runner for the BOATRACE EX daily pipeline. Phase 6C wires that runner into `update-boat-data` as an optional `workflow_dispatch` step.

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

## Workflow Dispatch

Phase 6C adds optional inputs to `.github/workflows/update-boat-data.yml`:

- `run_boatrace_ex`: default `false`. When false, the EX pipeline is not executed.
- `boatrace_ex_date`: default `latest`. Accepts `latest` or `YYYY-MM-DD`.
- `boatrace_ex_refresh_history`: default `false`. Set true only when existing EX history should be regenerated.

The workflow step runs only with:

```text
github.event_name == 'workflow_dispatch' && inputs.run_boatrace_ex == true
```

Scheduled workflow runs do not execute the EX pipeline by default. The normal BOATRACE generated-data update path remains unchanged unless the dispatch input explicitly enables EX.

Workflow integration does not permit fake completion. Empty history is still refused by the existing lower-level guards, and the workflow checker must pass before generated data is committed.

## Scope

Phase 6C adds optional workflow integration only. It does not make EX a fully automatic daily production pipeline.

Later phases:

- Phase 6D: harden workflow operation after manual dispatch runs
- Phase 7: multi-day venue bias
- Phase 8: rough index
- Phase 9: today flow
- Phase 10: prediction signals
