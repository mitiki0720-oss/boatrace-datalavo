# Boat EX Registration Provenance Propagation (2026-11-15)

## Policy

Only metadata from the same history race record is copied. sourceFetchedAt uses the original explicit sourceFetchedAt, or that source's generatedAt with timestampField=generatedAt. No registrationNo or racerName is changed.

## Result

- before complete/missing: 73644/936
- propagated: 936
- alreadyComplete: 73644
- sourceMissing: 0
- sourceConflict: 0
- contextMismatch: 0
- unresolved: 0
- after complete/missing: 74580/0
- changed dates: 2026-11-15

## Safety

registrationNo and racerName hashes are identical before and after propagation. Unresolved registration rows are not inspected or changed.
