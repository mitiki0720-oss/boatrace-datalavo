# BOAT EX GPT Copy Useful Signals (2026-08-13)

All signals are derived only from `public/data/boatrace-ex/history/races/<date>.json` and the EX date index. They are historical evidence, not predictions, scores, rankings, tickets, or payout estimates.

| Signal | Source-backed fields | Coverage rule |
| --- | --- | --- |
| Venue race-band history | `officialResult.finishOrder`, 3連単 payout | Uses 1R-4R, 5R-8R, 9R-12R, 1R-6R, and 7R-12R. |
| Conditional weather/water history | `weather`, finish order, payout | Shows separate weather, wind direction, wind band, wave band, and exact-condition samples. Exact conditions below 30R are `LOW SAMPLE`. |
| Decision method history | `officialResult.winningTechnique` | Available for source-backed records only. |
| Entry shift history | `officialExhibition.entries.course` | Historical exhibition coverage is limited. Today's exhibition remains primary. |
| Motor/boat history | `officialRace.racers.motorNo/boatNo`, finish order | Displays only a concise history when at least five source-backed races exist. |
| Racer linkage | exact `registrationNo` match | No name matching, fuzzy matching, or inferred registration number. |

For a prediction date different from the latest EX date, daily venue/racer evidence, today-flow, and latest-day race-analysis remain `target-date-mismatch` and are not presented as same-day evidence.
