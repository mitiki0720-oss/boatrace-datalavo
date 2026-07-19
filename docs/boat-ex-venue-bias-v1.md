# BOATRACE EX Venue Bias v1

Phase 7 adds a source-backed venue-bias fact table. It aggregates only the
available Phase 3 history dates and does not produce a score, ranking,
recommendation, prediction, or venue-play interpretation.

## Output

```text
public/data/boatrace-ex/derived/venue-bias/latest.json
```

The file contains:

- the included date range and date count
- total race and distinct venue counts
- result and exhibition availability counts
- per-venue race counts and date counts
- first-place and top-three boat-number counts and rates
- readiness based on the minimum seven-date history threshold

Counts and rates are derived directly from
`public/data/boatrace-ex/history/races/YYYY-MM-DD.json`. A rate is `null` when
the corresponding result sample is unavailable; otherwise it is a number from
zero to one. The `sourceFiles` list contains only the EX date index and the
history files used for the aggregation.

## Commands

```text
node scripts/generateBoatExVenueBias.mjs --dry-run
node scripts/generateBoatExVenueBias.mjs
node scripts/checkBoatExVenueBias.mjs
```

The generator reads `index.generated.json` and all of its `availableDates`.
It refuses an empty date list or a missing/invalid history file. A normal run
writes `latest.json` and updates the venue-bias entry in the derived manifest.
`--dry-run` writes neither file.

The checker recomputes all summary and venue values from history, verifies the
derived manifest entry, and rejects `public/data/reviews/**`, direct
`public/data/boatrace/*.generated.json` sources, and score/ranking/
recommendation/prediction fields.

## Readiness

The fact table is available even when interpretation is not. With fewer than
seven available history dates, the output keeps:

```text
readiness.status: insufficient-history
readiness.reason: dateCount <n> is below minDateCount 7
```

At seven or more dates, readiness becomes `ready`, but the output remains a
factual count/rate table. Phase 8 Rough Index, Phase 9 Today Flow, and Phase
10 Prediction Signals are separate future phases.

## UI

The EX page fetches `venue-bias/latest.json` in the Venue Bias section. It
shows the date range, counts, readiness, and a desktop-scrollable venue table.
It does not show any score, ranking, recommendation, or claim that a venue
has a confirmed bias.
