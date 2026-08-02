# Boat EX Registration Coverage Audit (2026-08-02)

## Actual Coverage

- latestDate: 2026-08-02
- availableDates: 2026-07-13, 2026-07-19, 2026-08-02
- total races: 492
- total venues: 23
- total participant appearances: 2952
- registration-backed racer identities: 1287
- racer identities without registration number: 0

### Per Date

| Date | Races | Venues | Racers | Appearances | Missing registration appearances |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2026-07-13 | 156 | 13 | 581 | 936 | 0 |
| 2026-07-19 | 192 | 16 | 714 | 1152 | 0 |
| 2026-08-02 | 144 | 12 | 527 | 864 | 0 |

## Bridge Classification

- safeBridge: 1287
- candidateBridge: 0
- unresolved: 0
- latest-date exact official registrationNumber and racerName pairs: 527
- latest-date unmatched explicit pairs: 0
- unresolved historical source materials: 151

safeBridge means the EX history already contains an explicit registration number with official source provenance. It is the only class eligible for a future automatic bridge. candidateBridge and unresolved records must not be written automatically.

## Readiness

- venueBias: insufficient-history
- roughIndex: insufficient-history
- todayFlow: available
- predictionStructure: insufficient-history

## Next Bridge Plan

1. Add an official-source reader that carries only explicit registrationNo/registrationNumber values into the EX input contract.
2. Match by the exact source-backed race participant tuple; do not use fuzzy name matching or inferred registration numbers.
3. Write only safeBridge records after a checker confirms source provenance and registrationNumber format.
4. Keep candidateBridge and unresolved records as audit output for review; do not backfill them automatically.

## Safety

This audit reads only official/generated BOATRACE and Boat EX data. It does not read reviews, perform fuzzy matching, infer registration numbers, or backfill racer identities.
