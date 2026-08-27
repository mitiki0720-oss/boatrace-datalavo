# Boat EX Reviews and Dog History Backfill

## Source Rules

The review and dog roots are read-only local inputs. The collector records a portable local-readonly source locator, the source file mtime as sourceFetchedAt, and source provenance. It never writes to, stages, or commits either source root.

A date is historyReady only when a same-venue prediction file and result file have identical non-empty race-number sets, every race has a parsed entry table and confirmed result, and the prediction includes its official-extras provenance marker. Dog summaries are supplemental audit inputs only; they never override review race facts.

## Current Result

- read-only review files: 671
- read-only dog summaries: 146
- historyReady dates created: 24
- missing registration appearances: 24072
- unresolved source conditions: 12

## Re-run

```powershell
node scripts/backfillBoatExHistoryFromReviewsDog.mjs --review-source-root "<reviews root>" --dog-source-root "<dog root>" --from 2026-05-24 --to 2026-08-02 --dry-run
node scripts/backfillBoatExHistoryFromReviewsDog.mjs --review-source-root "<reviews root>" --dog-source-root "<dog root>" --from 2026-05-24 --to 2026-08-02 --write
node scripts/checkBoatExReviewsDogBackfill.mjs
```

No registration number is inferred or fuzzy matched. Records without an explicit registration number remain unverified and are not bridge candidates.
