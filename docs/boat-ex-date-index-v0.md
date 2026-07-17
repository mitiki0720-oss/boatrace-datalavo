# BOATRACE EX Date Index v0

Phase 6A adds a generated date index for the EX page. The index lets the UI discover which EX dates exist without reading review archives or inventing missing days.

## Inputs

The generator scans only these EX paths:

```text
public/data/boatrace-ex/history/races/*.json
public/data/boatrace-ex/coverage/*.json
public/data/boatrace-ex/derived/venue-evidence/*.json
public/data/boatrace-ex/derived/racer-evidence/*.json
public/data/boatrace-ex/manifest.generated.json
public/data/boatrace-ex/derived/manifest.generated.json
```

It must not read `public/data/reviews/**` or `public/data/boatrace/*.generated.json`.

## Output

The generator writes:

```text
public/data/boatrace-ex/index.generated.json
```

The file has `kind: "boatrace-ex-date-index"` and `schemaVersion: 1`.
`availableDates` is the sorted list of dates with source-backed EX history files.
`latestDate` is the maximum value in `availableDates`, or `null` only when `--allow-empty` is used.

Each `dates[]` entry contains source availability for history, coverage, venue evidence, and racer evidence. Counts are copied from existing source-backed EX files:

- `history.recordCount`
- `history.venueCount`
- `venueEvidence.venueCount`
- `venueEvidence.recordCount`
- `racerEvidence.racerCount`
- `racerEvidence.appearanceCount`

## Readiness

The current dataset has one history day. Phase 6A therefore keeps multi-day features as status labels, not scores:

- `multiDayAnalysis: "insufficient-history"`
- `venueBias: "insufficient-history"`
- `roughIndex: "insufficient-history"`
- `racerProfile: "insufficient-history"`
- `todayFlow: "pending"`
- `predictionSignals: "pending"`

The generator must not emit venue-bias scores, rough-index scores, today-flow scores, prediction signals, rankings, or high-confidence racer profile labels.

## CLI

```text
node scripts/generateBoatExDateIndex.mjs --dry-run
node scripts/generateBoatExDateIndex.mjs
node scripts/checkBoatExDateIndex.mjs
```

By default, no history dates is a failure and the generator refuses to write an empty index. `--allow-empty` permits an empty index for explicit testing only.

## Later Phases

- Phase 6B: daily EX generation integration
- Phase 7: multi-day venue bias
- Phase 8: rough index
- Phase 9: today flow
- Phase 10: prediction signals
