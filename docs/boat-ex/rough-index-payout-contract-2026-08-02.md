# BOATRACE EX rough index payout contract

## Purpose

The rough index counts only source-backed trifecta payout values already stored in BOATRACE EX history. It does not parse reviews or dog sources again, infer a payout, or create a payout value.

## Stored history contract

For each history record, the eligible source path is:

```text
officialResult.payout[]
```

An entry is payout-available only when all of these conditions hold:

1. Its type in `betType`, `type`, or `name` identifies a trifecta (`3連単`, `三連単`, or `trifecta`).
2. One existing amount field is a non-negative integer or yen-formatted string: `payoutYen`, `amount`, `payoutAmount`, `payout`, or `yen`.

`payoutYen` is the current history schema's primary amount field. The contract matches `generateBoatExTodayFlow.mjs` and `checkBoatExTodayFlow.mjs`.

## Audit

Generate the rough index and contract audit together:

```powershell
node scripts/generateBoatExRoughIndex.mjs
node scripts/checkBoatExRoughIndexPayoutContract.mjs
```

The audit output is:

```text
public/data/boatrace-ex/audit/rough-index-payout-contract-2026-08-02.generated.json
```

It records the contract, source history coverage, payout availability counts, and readiness. A race without an eligible stored amount remains unavailable.
