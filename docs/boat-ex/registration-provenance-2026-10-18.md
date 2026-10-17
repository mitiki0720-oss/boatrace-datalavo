# Boat EX Registration Provenance Propagation (2026-10-18)

## Policy

Only metadata from the same history race record is copied. sourceFetchedAt uses the original explicit sourceFetchedAt, or that source's generatedAt with timestampField=generatedAt. No registrationNo or racerName is changed.

## Result

- before complete/missing: 49320/0
- propagated: 0
- alreadyComplete: 49320
- sourceMissing: 0
- sourceConflict: 0
- contextMismatch: 0
- unresolved: 0
- after complete/missing: 49320/0
- changed dates: none

## Safety

registrationNo and racerName hashes are identical before and after propagation. Unresolved registration rows are not inspected or changed.
