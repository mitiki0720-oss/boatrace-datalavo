# BOATRACE EX Daily Pipeline Runner v0

Phase 6B adds a manual runner for the BOATRACE EX daily pipeline. Phase 6C wires that runner into `update-boat-data` as an optional `workflow_dispatch` step.
Phase 6D adds `--date auto` and writes a compact workflow summary after a
successful manual EX run.

## Commands

```text
node scripts/generateBoatExDaily.mjs --date 2026-07-13 --dry-run
node scripts/generateBoatExDaily.mjs --date 2026-07-13
node scripts/generateBoatExDaily.mjs --date latest --dry-run
node scripts/generateBoatExDaily.mjs --date latest
node scripts/generateBoatExDaily.mjs --date auto --dry-run
node scripts/generateBoatExDaily.mjs --date auto
node scripts/checkBoatExDaily.mjs --date 2026-07-13
node scripts/checkBoatExDaily.mjs --date latest
node scripts/checkBoatExDaily.mjs --date auto
```

`--date latest` reads `public/data/boatrace-ex/index.generated.json` and uses `latestDate`.
`--date auto` resolves the target date from source-backed BOATRACE generated
JSON, then falls back to the EX index `latestDate` only when no generated-date
candidate can be found.

## Runner Order

The runner resolves the target date, then executes the existing EX scripts in order:

1. Check existing Phase 3 history.
2. Generate Phase 3 history only when it is missing, or when `--refresh-history` is explicitly passed.
3. Generate and check venue evidence.
4. Generate and check racer evidence.
5. Generate and check the date index.
6. Generate and check Venue Bias v1 from all date-index history files.
7. Print a JSON summary.

For an existing history date, the default behavior is to avoid regenerating Phase 3 history, coverage, and the Phase 3 manifest.

Venue and racer evidence checks derive record, venue, racer, and appearance
counts from the selected date's Phase 3 history. They validate that derived
evidence and provenance match that source-backed history, rather than applying
the initial sample date's counts to later daily runs.

Venue Bias v1 runs after the date index so it can aggregate every available EX
history date. Its output remains factual counts and rates with readiness; it
does not add a score, ranking, or venue recommendation.

For an auto-resolved date whose history is not generated yet, `--dry-run` calls
the history generator in dry-run mode and prints a summary without writing files.
The follow-on venue evidence, racer evidence, and date-index steps are skipped
because dry-run history is not persisted.

## Options

- `--dry-run`: passes dry-run mode to generators and does not write generated output.
- `--skip-write`: alias for `--dry-run`.
- `--refresh-history`: regenerates Phase 3 history even when history already exists.
- `--allow-empty`: passes through to lower-level scripts for explicit empty-output testing. It is not recommended for normal daily runs.

## Date Resolution

- `--date YYYY-MM-DD`: uses the explicit date from the command line.
- `--date latest`: uses only `public/data/boatrace-ex/index.generated.json` `latestDate`. This is useful for checking already generated EX data, but it does not discover a newly updated BOATRACE feed date.
- `--date auto`: reads BOATRACE generated JSON such as `today.generated.json`, `today-race-details.generated.json`, `upcoming-schedule.generated.json`, and `venue-extras.generated.json`; extracts source-backed `date`, `sessionDate`, `generatedFor`, and range start dates; and chooses the maximum candidate.

If `auto` cannot find any source-backed date, it falls back to the EX index
`latestDate` and records that fallback in `dateResolution.fallbackUsed` and
`warnings`. The resolver must not invent dates.

## Guards

The runner and checker must not read `public/data/reviews/**`.

The runner must not invent missing dates, counts, venue-bias scores, rough-index scores, today-flow scores, prediction signals, rankings, or racer profile labels.

Empty outputs remain guarded by the existing lower-level generators and checkers. A normal daily run should fail instead of overwriting useful EX files with empty output.

## Workflow Dispatch

Phase 6C adds optional inputs to `.github/workflows/update-boat-data.yml`:

- `run_boatrace_ex`: default `false`. When false, the EX pipeline is not executed.
- `boatrace_ex_date`: default `auto`. Accepts `auto`, `latest`, or `YYYY-MM-DD`.
- `boatrace_ex_refresh_history`: default `false`. Set true only when existing EX history should be regenerated.

The workflow step runs only with:

```text
github.event_name == 'workflow_dispatch' && inputs.run_boatrace_ex == 'true'
```

Scheduled workflow runs do not execute the EX pipeline by default. The normal BOATRACE generated-data update path remains unchanged unless the dispatch input explicitly enables EX.

Workflow integration does not permit fake completion. Empty history is still refused by the existing lower-level guards, and the workflow checker must pass before generated data is committed.

The workflow appends a simple Step Summary with the requested date,
refresh-history flag, and completion status. Generator and checker JSON remains
available in the job log. The summary path intentionally avoids heredoc parsing
so it cannot break the YAML structure or hide generator or checker failures.

## Scope

Phase 6C adds optional workflow integration only. It does not make EX a fully automatic daily production pipeline.

Phase 6D keeps scheduled EX execution disabled by default. It also does not
commit local generated JSON as part of this repository change.

Later phases:

- Phase 6D: harden workflow operation after manual dispatch runs
- Phase 7: multi-day venue bias
- Phase 8: rough index
- Phase 9: today flow
- Phase 10: prediction signals
