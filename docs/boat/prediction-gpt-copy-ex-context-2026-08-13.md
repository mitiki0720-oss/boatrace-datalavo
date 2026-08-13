# Prediction GPT Copy EX Context

## Scope

The Prediction page keeps its existing `7R〜12Rまとめコピー` action and adds source-backed BOATRACE EX context to that copied text. This work does not change prediction output, ticket creation, result evaluation, payouts, or saved prediction data.

## Copy Contents

The header identifies the normal live source with date, venue, event label when available, operation date, and the races that actually exist in the selected 7R to 12R range. It also prints source name, acquisition time, and source status. Missing values remain `未取得` or `unknown`.

One `EX会場共有情報` block is included for the selected venue. Each existing selected race has a current roster, exhibition availability, EX race availability, EX racer registration linkage, and source-backed cautions. The page only loads the race-analysis shard matching the requested date. When no matching EX source exists, the copied material explicitly states that the EX item is unavailable.

## Per-Race EX Reference

Each existing selected race includes a `KURARI BOAT EX 参照情報` block. It reports the EX reference level, registration-number or exact-name linkage count, venue EX readiness, venue feature readiness, today-flow readiness, current-date EX race-analysis availability, and the recorded weather, wind, and wave source when available.

Levels A through D and `unknown` describe only source availability. A has a complete race source with near-complete racer linkage plus available exhibition and weather. B and C retain partial source-backed linkage, including LOW SAMPLE cautions. D means the current-date EX race source is missing or incomplete. `unknown` means no EX context is loaded. These levels do not rank racers, score a race, or create a prediction.

The bulk material panel exposes that each race includes EX reference information and reports how many selected races have source-backed A, B, or C references. Missing EX, unresolved links, incomplete exhibition data, and missing weather remain explicit cautions; no values are inferred.

## Source Safety

EX context is limited to source-backed availability, source paths, and recorded racer identity linkage. It does not add prediction suggestions, ticket content, result facts, payout facts, scoring, ranking, inferred identities, or fabricated values. Registration numbers remain the values recorded by the linked EX analysis; unresolved entries are shown as unavailable.
