# Boat EX Strict Structured Tickets Evaluation (2026-08-02)

## Scope

This layer reads only `prediction.textExcerpt` values that are already source-backed in BOATRACE EX history. It does not modify PredictionPage or any save contract.

## Strict Parser

The parser accepts an ordered three-boat ticket only when all of these conditions hold:

- The text section begins after a buy-ticket marker.
- The same section has a 3-trifecta heading and one allowed group: 厚め, 本線, 中穴, or 大穴.
- The line contains one exact `1-2-3` style triple with distinct boats from 1 through 6.

Formation notation, entrance assumptions, prose, repeated boats, and all non-ticket number strings are skipped. Source text without an allowed group is retained as `unclassified-source-text` only when it otherwise satisfies the strict ticket section contract.

## Evaluation

Evaluation compares an ordered ticket only with `officialResult.finishOrder[0..2]` on the same history record. A match is an exact ordered triple; there is no partial match, score, rank, recommendation, inferred result, inferred payout, or ticket expansion. Payout is linked only for a hit with an existing official 3-trifecta payout.

## Generated Files

- `derived/prediction-structure/history-summary.json`
- `derived/prediction-structure/history-index.json`
- `derived/prediction-structure/dates/YYYY-MM-DD.json`
- `audit/structured-tickets-evaluation-2026-08-02.generated.json`

The current historical source contains one strict structured-ticket race with ten tickets. Its availability is below the 30-race readiness threshold and therefore remains `insufficient-history`.
