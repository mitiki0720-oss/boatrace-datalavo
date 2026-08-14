# Boat EX current-day and historical latest-day coverage wording

## Separate source roles

The GPT copy intentionally contains two different source-backed availability blocks.

1. `【KURARI BOAT EX 当日予想coverage】`
   - Uses `public/data/boatrace/today-race-details.generated.json` for the prediction target date.
   - Reports observed entries, registration numbers, motors, boats, exhibition display times, and weather availability.
   - Keeps `結果/払戻: pre-race` and `race-analysis: 未取得（結果・払戻の確定後に生成）` until result-dependent data exists.

2. `【KURARI BOAT EX 履歴latest-day venue-evidence】`
   - Uses the latest historical EX venue evidence, currently `public/data/boatrace-ex/derived/venue-evidence/2026-08-02.json`.
   - States the EX historical latest date and the prediction target date independently.
   - Is an historical latest-day evidence check. It is never presented as prediction-day normal-material coverage.

## Guardrails

The GPT copy must not emit the legacy header `【KURARI BOAT EX 当日coverage】`, its `daily` date-period label, or an `EX当日フロー: 対象日不一致` label. When `today-flow/latest.json` is not for the prediction target date, the copy calls it `EX履歴latest-day flow` instead.

This wording change does not create results, payouts, race analysis, scores, rankings, predictions, or tickets. It only makes the dates and source roles explicit.
