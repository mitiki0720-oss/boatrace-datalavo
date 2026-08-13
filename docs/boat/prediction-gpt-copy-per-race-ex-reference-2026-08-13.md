# Per-Race KURARI BOAT EX Reference

## Scope

The Prediction page includes a source-backed EX reference block in every existing race section of both GPT copy ranges. The block is supporting material only. It does not modify prediction text, tickets, results, payouts, saved predictions, or generated datasets.

## Reference Contents

Each block contains `EX参照レベル`, `登録番号/選手EXリンク`, official registration linkage, exact-name linkage, unresolved count, venue EX readiness, venue feature readiness, today-flow readiness, current-date race-analysis availability, weather/wind/wave availability, exhibition availability, and cautions.

The source-backed levels are A, B, C, D, and `unknown`. A represents complete source-backed race analysis with near-complete linkage plus exhibition and weather. B and C represent partial but recorded linkage. D represents missing or incomplete current-date race analysis. `unknown` represents unavailable EX context. LOW SAMPLE and unresolved linkage stay as warnings, never as inferred facts.

## Safety

The copy must use only recorded availability and source-backed linkage. It must not add a fake score, rank, generated prediction, generated ticket, or inferred identity. The existing 3連単10点 instruction remains unchanged: 厚め2点、本線3点、中穴3点、大穴2点, and 2連単は使わない.
