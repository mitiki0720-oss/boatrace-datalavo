# Prediction Exhibition Availability Wording Audit (2026-08-14)

## Rule

The prediction availability contract is based only on valid numeric exhibition display times.

- `6/6`: exhibition-ready.
- `1/6` through `5/6`: partial exhibition-time availability.
- `0/6`: `展示タイム未取得 / 事前予想`.

Entry order, tilt, weight, adjustment weight, start timing, before-info objects, weather, odds, and performance notes are not display times. They can remain as source-backed reference details, but they cannot make the prediction availability partial or ready.

## Current Feed Audit

Source: `public/data/boatrace/today-race-details.generated.json`

- Venues: 16
- Races: 192
- `displayTimeCount=6`: 72 races
- `displayTimeCount=1-5`: 1 race
- `displayTimeCount=0`: 119 races
- Zero-time races with partial wording after the fix: 0

## Regression Cases

| Race | Display-time count | Card | GPT availability |
| --- | ---: | --- | --- |
| 桐生 1R | 0 | 展示タイム未取得 | 展示タイム未取得 / 事前予想 |
| 桐生 7R | 0 | 展示タイム未取得 | 展示タイム未取得 / 事前予想 |
| 戸田 7R | 0 | 展示タイム未取得 | 展示タイム未取得 / 事前予想 |
| 平和島 1R | 6 | 展示タイムOK | 展示取得済み (6/6艇: 展示タイム・展示ST・進入・チルト) |

## Guardrails

`scripts/checkBoatPredictionExhibitionStatus.mjs` checks all current races and fixtures. It rejects zero-time output containing any of the following:

- `展示情報一部取得（タイム未取得`
- `展示一部取得です`
- `展示情報は一部取得です`
- `展示取得済み`
- `展示タイムOK`

The checker also retains the six-entry source and GPT-material regression checks through `scripts/checkBoatPredictionEntriesCompleteness.mjs`.
