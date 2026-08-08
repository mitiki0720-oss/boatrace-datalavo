# BOATRACE EX prediction structure readiness contract

## Scope

Prediction Structure LAB uses only fields already stored in BOATRACE EX history. It does not parse natural-language prediction text into tickets and does not infer tickets, hit or miss, results, or payout values.

## Source-backed fields

| Purpose | Stored history contract |
| --- | --- |
| Prediction text | `prediction.textExcerpt` with `prediction.sourceStatus === "available"` |
| Structured ticket | A non-empty array in `tickets`, `ticketGroups`, `bets`, `recommendedTickets`, `buyTickets`, or the corresponding `prediction.*` field |
| Result | Valid `officialResult.finishOrder` top three |
| Payout | Valid 3連単 item in `officialResult.payout[]` using `payoutYen`, `amount`, `payoutAmount`, `payout`, or `yen` |
| Evaluated prediction | A structured ticket and source-backed result/payout on the same history record |

## Readiness

`ready` requires at least 30 target-date races for each of prediction text, structured tickets, and evaluated predictions. Otherwise the output remains `insufficient-history` and lists the exact gaps in `readiness.missingRequirements`.

For the 2026-08-02 target date, official results and payouts are available, but no source-backed prediction text or structured tickets are stored. Across the 68 indexed days, prediction text exists for historical coverage but structured tickets remain absent. Therefore prediction structure analysis remains unavailable without fabricating or extracting tickets from natural language.

## Audit

```powershell
node scripts/generateBoatExPredictionStructure.mjs
node scripts/checkBoatExPredictionStructureContract.mjs
```

The audit output is:

```text
public/data/boatrace-ex/audit/prediction-structure-contract-2026-08-02.generated.json
```
