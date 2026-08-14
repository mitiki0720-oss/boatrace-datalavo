# Boat EX racer identity features

## Scope

This derived dataset is limited to the registered racer identity registry. A racer is included only when its `registrationNo` exactly matches a safe, provenance-complete registry identity. The process never resolves an identity by name, fuzzy matching, alias guessing, or inferred registration numbers.

## Current output

- feature racers: 1,287
- source-backed history starts: 2,952
- history coverage: 2026-05-24 through 2026-08-02 (68 dates)
- current operational feed: 2026-08-15, 1,296 slots, 0 missing registration numbers, 1,098 exact registry links
- excluded unresolved historical appearances: 49,752

The current operational feed may contain racers outside the historical registry coverage. They remain explicitly unlinked; no feature is created for them.

## Feature fields

For each safe identity, `derived/racer-features/latest.json` contains only observed historical descriptive values:

- all-history starts and first/last observed dates
- venue and frame starts, finishes, and sample labels
- observed start-timing summaries
- observed winning-method counts
- observed weather, wind, wave, and session samples
- last 5, last 10, and last 30-day observed summaries

These are source-backed reference values, not a decision result or betting instruction. Low samples remain labelled `low-sample` and are not promoted to a stronger state.

## Audit and GPT use

`audit/racer-identity-unresolved-audit-latest.generated.json` records unresolved categories without adding them to the safe feature set. The Prediction GPT copy looks up a racer feature only by exact `registrationNo`; an unmatched entry is labelled as unavailable.

## Regeneration

Run `node scripts/generateBoatExRacerFeatures.mjs`. The daily update entry point also runs the generator and the identity-completeness checker after the historical source index check.
