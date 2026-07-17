# BOATRACE EX DATA LABO Phase 2 Schema

## Purpose

Phase 2 defines the TypeScript schema foundation for BOATRACE EX DATA LABO. It does not generate EX data, create `public/data/boatrace-ex/**`, build React UI, touch review archives, or rewrite existing generated JSON.

The implementation file is `src/lib/boatExTypes.ts`. It is a pure type-definition module with no React, browser API, localStorage, or script runtime dependency.

## Type List

Common source and coverage types:

- `BoatExSourceType`
- `BoatExSourceStatus`
- `BoatExCoverageStatus`
- `BoatExSourceMeta`

Identity and race key types:

- `BoatExVenueCode`
- `BoatExRaceKey`
- `BoatExDateKey`
- `BoatExSessionType`
- `BoatExRaceStage`
- `BoatExForecastTiming`
- `BoatExLane`
- `BoatExHitStatus`

Raw official source types:

- `BoatExRawOfficialRace`
- `BoatExRawOfficialRacer`
- `BoatExRawOfficialResult`
- `BoatExRawOfficialExhibition`
- `BoatExRawOfficialExhibitionEntry`
- `BoatExStartExhibitionEntry`
- `BoatExRawOfficialWeather`
- `BoatExRawOfficialBundle`

Raw user source types:

- `BoatExRawUserPrediction`
- `BoatExRawUserSummary`
- `BoatExRawUserReview`
- `BoatExRawUserBundle`

Normalized race types:

- `BoatExRaceRecord`
- `BoatExRaceCoverage`
- `BoatExRacer`
- `BoatExCourseStats`
- `BoatExMotor`
- `BoatExBoat`
- `BoatExWaterSurface`
- `BoatExReview`

Derived v1 types:

- `BoatExVenueBias`
- `BoatExRoughIndex`
- `BoatExRoughIndexScope`
- `BoatExWeatherTrend`
- `BoatExTodayFlow`
- `BoatExDerivedBundle`

Signal and review-diff types:

- `BoatExPredictionSignalCategory`
- `BoatExPredictionSignal`
- `BoatExSignalEvidence`
- `BoatExSignalSeverity`
- `BoatExSignalConfidence`
- `BoatExReviewDiff`

Coverage and manifest types:

- `BoatExCoverage`
- `BoatExCoverageScope`
- `BoatExFileKind`
- `BoatExFileManifestEntry`

## Data Relationship

```text
existing official feeds
  public/data/boatrace/today.generated.json
  public/data/boatrace/today-race-details.generated.json
  public/data/boatrace/venue-extras.generated.json
        |
        v
raw official types
  BoatExRawOfficialRace
  BoatExRawOfficialResult
  BoatExRawOfficialExhibition
  BoatExRawOfficialWeather

existing user sources
  PredictionPage localStorage records
  practice result localStorage records
  Johnson prediction export
  public/data/reviews/index.json and archive txt files
        |
        v
raw user types
  BoatExRawUserPrediction
  BoatExRawUserSummary
  BoatExRawUserReview

raw official + raw user
        |
        v
normalized history
  BoatExRaceRecord
        |
        v
derived metrics
  BoatExVenueBias
  BoatExRoughIndex
  BoatExWeatherTrend
  BoatExTodayFlow
  BoatExReviewDiff
        |
        v
signals / audit
  BoatExPredictionSignal
  BoatExCoverage
  BoatExFileManifestEntry
```

Raw official, raw user, normalized, derived, signals, and coverage must stay separate. Derived objects may point back to source metadata, but they must not overwrite raw source records.

## Planned JSON Paths

These are design targets only. Phase 2 does not create these directories or files.

```text
public/data/boatrace-ex/
  raw/
    official/YYYY-MM-DD/{venueCode}.json
    user/YYYY-MM-DD/{venueSlug}.json
  history/
    races/YYYY-MM-DD.json
    venues/{venueCode}.json
  derived/
    venue-bias/{venueCode}.json
    rough-index/YYYY-MM-DD.json
    weather-trend/{venueCode}.json
    today-flow/YYYY-MM-DD.json
    review-diff/YYYY-MM-DD.json
  signals/
    YYYY-MM-DD/{venueCode}.json
  coverage/
    YYYY-MM-DD.json
    venues/{venueCode}.json
    sources.json
  manifest.json
```

Expected file kinds are represented by `BoatExFileKind`:

- `raw-official`
- `raw-user`
- `history`
- `derived`
- `signals`
- `coverage`
- `ui`

## sourceStatus

`BoatExSourceStatus` describes source availability and parse state.

- `available`: The source exists and the field was parsed.
- `pending`: The source is expected later.
- `not-published`: The official source has not published the data yet.
- `not-supported`: The official or venue source does not provide this field.
- `parse-empty`: The request succeeded but parsed content is empty.
- `http-error`: The request failed.
- `unknown`: The system cannot determine the state.
- `user-only`: Only a user source exists.
- `derived-ready`: Required inputs exist and derived output can be produced.
- `insufficient-sample`: The source exists but the sample size is too small for a reliable metric.

## coverageStatus

`BoatExCoverageStatus` describes completeness at field, race, source, or output level.

- `complete`: Required source-backed fields are present.
- `partial`: Some source-backed fields are present.
- `pending`: The official source is expected later but is not available in the current generated feed.
- `missing`: Expected fields are absent.
- `not-supported`: The field is not offered by the source.
- `unknown`: The system cannot classify the coverage.

Coverage gaps should be surfaced with `BoatExCoverage.warnings` and, when relevant to prediction, `BoatExPredictionSignal` records with category `SAMPLE_WARNING`.

## Unknown and Sample Handling

Unknown values must remain unknown. Phase 3+ generators should use:

- `undefined` for absent optional fields.
- `null` when a value was explicitly checked and is unavailable.
- `"unknown"` when the state itself is unknown.
- `sourceStatus: "not-supported"` when the source does not provide the field.
- `sourceStatus: "insufficient-sample"` when derived metrics do not have enough history.

Do not coerce unknown registration numbers, branches, class names, exhibition values, weather values, motor ratings, or review conclusions into placeholder facts.

## Fake Completion Rules

`src/lib/boatExTypes.ts` has a file-level comment stating the fake completion rule. The rule for Phase 2+ is:

- Source-backed data only.
- Official source takes priority over user source.
- User source must stay separated from official source.
- Raw data and derived data must not be mixed.
- Missing data remains missing, unknown, not-supported, or insufficient-sample.
- Prediction signals require evidence and source metadata.
- Review diff extraction must keep the original summary/review source path.
- `public/data/reviews/**` must not be deleted, moved, edited, or regenerated for EX schema work.
- `public/data/boatrace/*.generated.json` must not be edited for EX schema work.
- `public/data/boatrace-ex/**` is not created in Phase 2.

## Phase 3 Connection

Phase 3 adds `scripts/generateBoatExHistory.mjs` and `scripts/checkBoatExHistory.mjs`. These scripts read existing generated official data and write normalized history v0, date coverage, and a generated manifest using the Phase 2 types as the contract.

Phase 3 flow:

```text
1. Read public/data/boatrace/today-race-details.generated.json.
2. Read public/data/boatrace/venue-extras.generated.json when available.
3. Convert race entries to BoatExRawOfficialRace.
4. Convert confirmed result entries to BoatExRawOfficialResult.
5. Convert exhibitions and weather into BoatExRawOfficialExhibition and BoatExRawOfficialWeather.
6. Build BoatExRaceRecord with coverage fields.
7. Write planned history JSON only after Phase 3 explicitly implements generation.
```

Phase 3 should not infer unavailable official data. If official result, ST, exhibition, weather, motor, or racer fields are missing, it should mark `sourceStatus` and `coverageStatus` instead of filling fake values.

Phase 3 output paths:

```text
public/data/boatrace-ex/history/races/YYYY-MM-DD.json
public/data/boatrace-ex/coverage/YYYY-MM-DD.json
public/data/boatrace-ex/manifest.generated.json
```

Phase 3 does not read or touch `public/data/reviews/**`, localStorage, prediction signals, derived venue bias, review diff analysis, React pages, GitHub Actions workflows, or the existing `public/data/boatrace/*.generated.json` files.

### Phase 3.1 empty output guard

`scripts/generateBoatExHistory.mjs` must not overwrite an existing EX history, coverage, or manifest with empty output by default.

If the target date produces `records: 0` or `venues: 0`, the generator exits with code `1` before writing files. This also applies to `--dry-run`, which reports the empty state and exits with code `1` without writing.

`--allow-empty` is the only override. It is intended for deliberate empty fixture creation and prints a warning when used. Without this flag, empty history generation is considered unsafe because the active official generated feeds may no longer contain an older requested date.

`scripts/checkBoatExHistory.mjs` also treats `records: 0` as a failure unless `--allow-empty` is passed.

## Phase 4 Venue Evidence v0

Phase 4 adds a derived venue evidence layer for the EX page. It reads only:

```text
public/data/boatrace-ex/history/races/YYYY-MM-DD.json
public/data/boatrace-ex/coverage/YYYY-MM-DD.json
```

It writes:

```text
public/data/boatrace-ex/derived/venue-evidence/YYYY-MM-DD.json
public/data/boatrace-ex/derived/manifest.generated.json
```

The TypeScript contract is represented by:

- `BoatExVenueEvidenceFile`
- `BoatExVenueEvidenceItem`
- `BoatExDerivedReadiness`
- `BoatExDerivedReadinessStatus`

Venue evidence contains source-backed counts and parsed facts only: race counts,
result availability, exhibition availability, weather availability, parsed
trifecta payouts, exhibition-time summaries, weather summaries, and coverage
warnings.

Because the current history contains one day, `venueBias`, `roughIndex`, and
`todayFlow` must remain `insufficient-history` or `pending`. Phase 4 must not
emit prediction scores, confidence claims, fake venue-bias scores, fake
rough-index scores, or same-day-flow conclusions.

Phase 4 does not read or touch `public/data/reviews/**`,
`public/data/boatrace/*.generated.json`, Phase 3 history, Phase 3 coverage, or
the Phase 3 manifest.

## Phase 5 Racer Evidence v0

Phase 5 adds a source-backed racer evidence layer for the EX page. It reads:

```text
public/data/boatrace-ex/history/races/YYYY-MM-DD.json
public/data/boatrace-ex/coverage/YYYY-MM-DD.json
public/data/boatrace-ex/derived/venue-evidence/YYYY-MM-DD.json
```

It writes:

```text
public/data/boatrace-ex/derived/racer-evidence/YYYY-MM-DD.json
public/data/boatrace-ex/derived/manifest.generated.json
```

The TypeScript contract is represented by:

- `BoatExRacerEvidenceFile`
- `BoatExRacerEvidenceItem`
- `BoatExRacerRaceEvidence`
- `BoatExRacerCourseChangeEvidence`
- `BoatExRacerDerivedReadiness`

`registrationNumber` is the primary key when it exists. If it is missing, the
temporary key is marked `identityStatus: "unverified"` and receives a warning;
the generator must not invent registration numbers, branches, classes, ages, or
profile facts.

Racer evidence contains source-backed appearances, frame counts, race evidence,
ST summaries, exhibition-time summaries, result counts, motor/boat numbers, and
course-change evidence only when final course data exists. If final course is
not available, course-change counts remain `null` and the source status is
`missing`.

Because the current history contains one day, `racerProfile`,
`courseChangePattern`, `exhibitionReliability`, and `startTimingPattern` must
remain `insufficient-history` or `pending`. Phase 5 must not emit fixed racer
pattern labels, high-confidence claims, prediction signals, or scores.

Phase 5 does not read or touch `public/data/reviews/**`,
`public/data/boatrace/*.generated.json`, Phase 3 history, Phase 3 coverage,
Phase 3 manifest, or the Phase 4 venue evidence body.

## Phase 6A Date Index v0

Phase 6A adds a generated date index so the EX page can discover available EX
dates and use `latestDate` without assuming there is only one history day.

The generator reads only existing EX files:

```text
public/data/boatrace-ex/history/races/*.json
public/data/boatrace-ex/coverage/*.json
public/data/boatrace-ex/derived/venue-evidence/*.json
public/data/boatrace-ex/derived/racer-evidence/*.json
public/data/boatrace-ex/manifest.generated.json
public/data/boatrace-ex/derived/manifest.generated.json
```

It writes:

```text
public/data/boatrace-ex/index.generated.json
```

The TypeScript contract is represented by:

- `BoatExDateIndexFile`
- `BoatExDateIndexEntry`
- `BoatExDateIndexSourceState`
- `BoatExDateIndexReadiness`

`availableDates` contains only dates with source-backed EX history files.
`latestDate` is the maximum available date. Counts in each date entry are copied
from existing EX history, venue evidence, and racer evidence files. Missing
sources are marked `missing`; the generator must not invent dates, counts,
scores, rankings, or prediction signals.

Because the current EX history contains one day, `multiDayAnalysis`,
`venueBias`, `roughIndex`, and `racerProfile` remain `insufficient-history`;
`todayFlow` and `predictionSignals` remain `pending`.

Phase 6A does not read or touch `public/data/reviews/**`,
`public/data/boatrace/*.generated.json`, existing Phase 3 history/coverage,
existing Phase 4 venue evidence, or existing Phase 5 racer evidence.
