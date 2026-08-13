# Boat EX GPT Copy Label Polish - 2026-08-14

## Scope

This change clarifies the source-backed labels in PredictionPage GPT copy. It does not add predictions, tickets, scores, ranks, name matching, or inferred registration numbers.

## Source Labels

- Target-date race analysis is shown separately from historical EX derived data.
- Historical EX data is labeled `available` only when a loaded derived source exists, with its history period and `source-backed derived` type.
- Today flow is `available` only when `todayFlow.targetDate` equals the prediction venue date. Otherwise it is `対象日不一致`.
- Weather keeps the normal material [C] value. When the weather observation is older than the venue source acquisition time, the copy states that the weather value is not refreshed or is under confirmation.

## Registration Identity

The GPT copy uses registration-number exact links only. It reports exact-link and unresolved counts, and explicitly states that name-based inference is prohibited.

## Entry History

`officialExhibition.entries.course` is required for frame-nari, lane-1-inside, and entry-shift aggregation. A race without all six valid lane/course values is counted as `source field insufficient`, not as a frame-nari race. Venues with no usable course data display `未判定（source field insufficient）` rather than a misleading zero count.
