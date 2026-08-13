# Boat EX All-race Analysis Layer (2026-08-02)

`public/data/boatrace-ex/derived/race-analysis/latest.json` exposes every latest-date history record as a source-backed analysis unit. It is an availability layer, not a prediction layer.

## Sources

Each race keeps paths to its history record, coverage, racer evidence, venue evidence, today flow, rough index, prediction structure, and identity audits. The displayed facts are limited to the official race card, result, trifecta payout, exhibition, weather, water status, and racer linkage state already present in those sources.

## Racer Identity

`officialRegistrationNo` is retained only when the race source supplied it. `resolvedRegistrationNo` is separate and is populated only for the existing `exact-normalized-name-unique` bridge. Unresolved racers remain unresolved. No fuzzy, partial, guessed, or inferred name matching is used.

## Availability

The latest date has 144 race records across 12 venues. Every card states the availability of result, payout, exhibition, weather, water condition, and racer evidence. Missing data is presented as a source-backed reason; the layer does not generate a score, rank, race outlook, ticket, fake exhibition, result, payout, weather, or water condition.

## UI

The Boat EX `全レース分析` tab lists every latest-date race by venue and race number. Selecting a card exposes six-boat identity linkage, official finish/payout facts, exhibition, weather, concise availability notes, and source/audit paths.
