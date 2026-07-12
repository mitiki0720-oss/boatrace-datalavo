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

Phase 3 should add `scripts/generateBoatExHistory.mjs`. That script should read existing generated official data and write normalized history later, using the Phase 2 types as the contract.

Proposed Phase 3 flow:

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
