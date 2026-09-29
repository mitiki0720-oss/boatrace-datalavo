# Boat EX Registration Bridge (2026-09-29)

## Policy

Only an exact date + venueCode + raceNo + official boatNo tuple with one normalized exact racerName match and explicit official registrationNumber is written. No fuzzy matching, inferred identity, or dog/review registration number is allowed.

## Sources

- official detail archives: 1
- official candidate entries: 600
- review source files (read-only, not used for registration inference): 2988
- dog source files (read-only, not used for registration inference): 1487

## Result

- before registration appearances: 31752
- before missing registration appearances: 72792
- safeBridge: 0
- candidateBridge: 0
- unresolved: 72792
- after registration appearances: 31752
- after missing registration appearances: 72792
- changed dates: none

## Safety

Candidate and unresolved appearances remain unmodified. No review or dog file is written, and neither source is used to infer a registration number.
