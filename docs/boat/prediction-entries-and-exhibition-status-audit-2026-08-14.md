# Prediction Entries And Exhibition Status Audit (2026-08-14)

## Scope

- Normal BOAT prediction data only: `public/data/boatrace/today-race-details.generated.json`
- Checked all 16 venues and 192 races, including both 1R-6R and 7R-12R ranges.
- EX-derived data is not used for the entry or exhibition-time display contract.

## Entry completeness

- All 192 official-source races contained six entry rows.
- The GPT material rendered all six boats for all 192 source-complete races.
- 三国 4R and 三国 7R each contained six entries and rendered six boats.
- Race number joins now canonicalize `4`, `04`, and `4R` to the same 1R-12R key before merging, range selection, or venue-extra lookup.

## Exhibition-time status

- A numeric display time greater than zero is required for a boat to count as exhibition-time available.
- `-.--`, `-.-`, `-`, `--`, `0`, `未取得`, `未公開`, `確認中`, and `未設定` are not exhibition times.
- Six placeholder rows had previously been counted as six available times in 36 races. Their generated coverage is now `official-unpublished` with `timeAvailableCount: 0`.
- For this snapshot, numeric exhibition display times were available for zero races. One race has partial non-time exhibition information; all remaining races are correctly treated as exhibition-time unavailable.

## Display contract

- `展示タイムOK`: all six boats have a valid numeric official exhibition display time.
- `展示タイム一部取得 n/6`: one to five boats have valid display times.
- `展示情報一部取得（タイム未取得）`: non-time exhibition values exist but no valid display time exists.
- `展示タイム未取得`: no usable exhibition information exists. GPT material uses pre-race prediction wording.

## Regression checks

- `node scripts/checkBoatPredictionEntriesCompleteness.mjs`
- `node scripts/checkBoatPredictionExhibitionStatus.mjs`

Both checks fail when a source-complete race loses entries in GPT material, when race-number normalization drops a range race, when a placeholder is labelled `展示タイムOK`, or when generated exhibition coverage disagrees with the actual valid-time count.
