# Boat EX Registration Provenance Propagation (2026-08-02)

## Policy

Only metadata from the same history race record is copied. sourceFetchedAt uses the original explicit sourceFetchedAt, or that source's generatedAt with timestampField=generatedAt. No registrationNo or racerName is changed.

## Result

- before complete/missing: 0/2952
- propagated: 2952
- alreadyComplete: 0
- sourceMissing: 0
- sourceConflict: 0
- contextMismatch: 0
- unresolved: 0
- after complete/missing: 2952/0
- changed dates: 2026-07-13, 2026-07-19, 2026-08-02

## Safety

registrationNo and racerName hashes are identical before and after propagation. Unresolved registration rows are not inspected or changed.
