# Boat EX Current-Day Lifecycle Status Audit - 2026-08-15

## Purpose

Current-day prediction coverage distinguishes source-backed lifecycle states without creating results, payouts, analyses, scores, predictions, or tickets.

## Lifecycle Contract

- `pre-race`: no display time and no complete result.
- `exhibition-partial`: one to five display times and no complete result.
- `exhibition-ready`: six display times and no complete result.
- `partial-result`: a result fragment exists but does not establish a complete result.
- `result-only`: a complete result exists without a usable payout.
- `result-and-payout`: a complete result and usable payout exist.
- `race-analysis-ready`: a target-date, source-backed race-analysis record exists in addition to a complete result and payout.

Payout fields without a complete result are suppressed from availability. They remain source warnings and are not inferred into a result or payout state.

## 2026-08-15 Summary

The generated coverage is the source of the counts. It records 216 races, 1,296 registration-present slots, and 1,296 registrationNo exact registry links. The current source has five exhibition-ready races, eight result-and-payout races, no current-day race-analysis records, and no lifecycle inconsistency.

Two raw payout fields lacked complete result data during the official refresh. They are retained only as `raw-payout-without-complete-result-suppressed` warnings and are not shown as payout available.

## GPT And UI Policy

The per-race GPT block uses the matching `venueCode` and `raceNo`, not the coverage-wide result status. It shows `当日status`, a display-time label derived from the race, `結果/払戻`, and `race-analysis` separately. The Boat EX overview exposes lifecycle counts only.

## Prohibited

No name-only linkage, fuzzy matching, registration number inference, result or payout inference, fake race-analysis, score/rank generation, prediction generation, ticket generation, or 2連単 additions are permitted.

## Verification

Run `node scripts/checkBoatExCurrentDayLifecycleStatus.mjs` together with the current-day coverage, registry linkage, GPT copy, and exhibition checkers.
