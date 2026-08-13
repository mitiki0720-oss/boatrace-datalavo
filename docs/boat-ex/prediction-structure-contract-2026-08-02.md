# BOATRACE EX prediction structure readiness contract

## Scope

Prediction Structure LAB uses only fields already stored in BOATRACE EX history. It may extract only strict, documented 3-trifecta ticket lines from source-backed prediction text; it never infers tickets, hit or miss, results, or payout values.

## Source-backed fields

| Purpose | Stored history contract |
| --- | --- |
| Prediction text | `prediction.textExcerpt` with `prediction.sourceStatus === "available"` |
| Structured ticket | A strict `1-2-3` line after a buy-ticket marker, under a 3-trifecta heading with 厚め, 本線, 中穴, or 大穴 |
| Result | Valid `officialResult.finishOrder` top three |
| Payout | Valid 3連単 item in `officialResult.payout[]` using `payoutYen`, `amount`, `payoutAmount`, `payout`, or `yen` |
| Evaluated prediction | Exact ordered triple equality against `officialResult.finishOrder[0..2]` on the same history record |

## Readiness

`ready` requires at least 30 historical races with both strict structured tickets and evaluated predictions. Otherwise the output remains `insufficient-history` and lists the exact gaps in `readiness.missingRequirements`.

For the 2026-08-02 target date, official results and payouts are available, but no source-backed prediction text or structured tickets are stored. Across the 68 indexed days, 8,292 source-backed prediction texts produce one strict structured-ticket race containing ten tickets. That race is evaluated by exact order and is a source-backed hit with an official 770 yen payout. This remains below the 30-race readiness threshold, so the status is `insufficient-history`.

## Audit

```powershell
node scripts/generateBoatExPredictionStructure.mjs
node scripts/checkBoatExPredictionStructureContract.mjs
```

The audit output is:

```text
public/data/boatrace-ex/audit/prediction-structure-contract-2026-08-02.generated.json
```
Run the strict ticket generator first:

```powershell
node scripts/generateBoatExStructuredTickets.mjs
node scripts/checkBoatExStructuredTickets.mjs
node scripts/checkBoatExPredictionEvaluation.mjs
```
