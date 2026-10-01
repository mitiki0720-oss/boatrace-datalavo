# Boat EX Registration Provenance Propagation (2026-10-01)

## Policy

Only metadata from the same history race record is copied. sourceFetchedAt uses the original explicit sourceFetchedAt, or that source's generatedAt with timestampField=generatedAt. No registrationNo or racerName is changed.

## Result

- before complete/missing: 31752/1812
- propagated: 1812
- alreadyComplete: 31752
- sourceMissing: 0
- sourceConflict: 0
- contextMismatch: 0
- unresolved: 0
- after complete/missing: 33564/0
- changed dates: 2026-09-30, 2026-10-01

## Safety

registrationNo and racerName hashes are identical before and after propagation. Unresolved registration rows are not inspected or changed.
