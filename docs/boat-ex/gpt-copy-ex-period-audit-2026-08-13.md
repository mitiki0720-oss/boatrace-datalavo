# Boat EX GPT Copy Period Audit (2026-08-13)

## Period contract

| Signal | Period type | Prediction-copy rule |
| --- | --- | --- |
| Weather and water history | historical | Use only as a historical reference. Show the aggregate date range and sample counts. |
| Venue bias | historical | Use as a historical venue tendency. Do not claim it is a same-day condition. |
| Rough index | historical | Use as payout-history reference only. Do not infer condition matching. |
| Today flow | latest-day | Use only when its target date exactly matches the prediction date. |
| Race analysis | latest-day | Use only when its target date exactly matches the prediction date. |
| Venue evidence | daily | Show separately from history and do not use it as prediction-day evidence on a date mismatch. |

## Source boundaries

`public/data/boatrace-ex/history/races/<date>.json` is the sole source for the weather/water history aggregate. The aggregate must not cite `public/data/reviews/**`, `public/dog/**`, or daily venue-evidence JSON as history input.

## Verification

Run the following after regenerating EX derived data:

```powershell
node scripts/generateBoatExWeatherWaterHistory.mjs
node scripts/checkBoatExWeatherWaterHistory.mjs
node scripts/generateBoatExGptCopyPeriodAudit.mjs --target-date 2026-08-13
node scripts/checkBoatExGptCopyPeriodAudit.mjs 2026-08-13
```
