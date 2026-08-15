# Boat EX Current-day Registry Linkage Gap Audit (2026-08-15)

## Result

- current-day slots with registration numbers: 1,296 / 1,296
- exact registry links before the supplement: 1,098
- unmatched slots before the supplement: 198
- safe current-day identities added: 127
- exact registry links after the supplement: 1,296 / 1,296
- remaining unmatched slots: 0

The 198 originally unmatched slots used 127 unique registration numbers. Every added identity has an explicit current-day official source, source timestamp, racer name, branch, age, and class. No registration number had a name collision, and no current-day candidate shared a normalized name with a different historical registration number.

## Safety Contract

The registry key is the explicit registration number only. Current-day additions use `public/data/boatrace/today-race-details.generated.json` only when the venue source is official and all required source metadata is present. The process does not match by name, normalize aliases into identities, infer a registration number, or modify historical appearances.

## Feature Availability

The 127 new identities are safe exact registry entries, but they have no matching EX historical appearance. Their racer features are retained with `historyStarts: 0` and `sampleLevel: no-history`. GPT copy must describe this as `登録番号exact registry: available / EX履歴特徴: 履歴不足 / no-history`, rather than claiming a missing registration number or inventing history.

## Audit Files

- `public/data/boatrace-ex/audit/current-day-registry-linkage-gap-2026-08-15.generated.json`
- `public/data/boatrace-ex/audit/racer-registration-linkage-audit-2026-08-15.generated.json`
