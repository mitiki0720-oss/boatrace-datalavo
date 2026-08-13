# Prediction GPT Copy EX Context

## Scope

The Prediction page keeps its existing `7R〜12Rまとめコピー` action and adds source-backed BOATRACE EX context to that copied text. This work does not change prediction output, ticket creation, result evaluation, payouts, or saved prediction data.

## Copy Contents

The header identifies the normal live source with date, venue, event label when available, operation date, and the races that actually exist in the selected 7R to 12R range. It also prints source name, acquisition time, and source status. Missing values remain `未取得` or `unknown`.

One `EX会場共有情報` block is included for the selected venue. Each existing selected race has a current roster, exhibition availability, EX race availability, EX racer registration linkage, and source-backed cautions. The page only loads the race-analysis shard matching the requested date. When no matching EX source exists, the copied material explicitly states that the EX item is unavailable.

## Source Safety

EX context is limited to source-backed availability, source paths, and recorded racer identity linkage. It does not add prediction suggestions, ticket content, result facts, payout facts, scoring, ranking, inferred identities, or fabricated values. Registration numbers remain the values recorded by the linked EX analysis; unresolved entries are shown as unavailable.
