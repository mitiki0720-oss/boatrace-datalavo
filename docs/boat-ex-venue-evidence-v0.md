# BOATRACE EX Venue Evidence v0

## Purpose

Phase 4 adds source-backed venue evidence for the EX page. It summarizes the
Phase 3 history and coverage outputs by venue without producing prediction
scores, venue-bias scores, rough-index scores, or today-flow conclusions.

## Inputs

- `public/data/boatrace-ex/history/races/YYYY-MM-DD.json`
- `public/data/boatrace-ex/coverage/YYYY-MM-DD.json`

The generator does not read `public/data/reviews/**` or
`public/data/boatrace/*.generated.json` directly. Phase 4 uses the Phase 3
history and coverage files as its source boundary.

## Outputs

- `public/data/boatrace-ex/derived/venue-evidence/YYYY-MM-DD.json`
- `public/data/boatrace-ex/derived/manifest.generated.json`

## Venue Evidence Shape

Each venue item contains:

- `date`, `venueCode`, `venueName`, and `raceCount`
- `coverage` for race, result, exhibition, weather, motor, boat, and racer
- `availability` counts for official race, result, exhibition, and weather
- `resultEvidence` with only parsed result and payout facts
- `exhibitionEvidence` with available/missing counts and parsed time summaries
- `weatherEvidence` with parsed wind and wave summaries
- `derivedReadiness` for future derived analysis
- `warnings` copied from the Phase 3 coverage summary

Unknown or unparseable values stay `null`, empty, `pending`, `missing`, or
`insufficient-history`. They are not filled with placeholders.

## derivedReadiness

`venueBias`, `roughIndex`, and `todayFlow` are marked
`insufficient-history` because only one history day is available. This is an
explicit safety state, not a score.

`predictionSignals` is marked `pending` because signal generation belongs to a
later phase.

## Fake Completion Ban

Phase 4 v0 must not output:

- `score`
- `venueBiasScore`
- `roughIndexScore`
- high confidence claims
- prediction accuracy conclusions
- inferred venue bias
- inferred roughness
- inferred same-day flow

The page may display source-backed counts and parsed values only.

## Phase 5 Targets

Later phases can add multi-day venue bias, rough index, same-day flow, and
prediction signals after enough validated history has accumulated.
