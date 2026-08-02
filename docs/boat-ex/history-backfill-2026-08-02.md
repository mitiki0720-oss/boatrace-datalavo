# Boat EX Safe History Backfill (2026-07-20 to 2026-08-02)

## Source Rule

A date is eligible only when an official history input file explicitly contains that date and the existing daily generator dry-run returns non-empty history. Schedule-only dates are not eligible. Existing EX history dates are never regenerated.

## Result

- existing dates: 2026-07-13, 2026-07-19, 2026-08-02
- official history-source candidates in range: none
- generated dates: none
- skipped existing dates: none
- rejected dates: none

## Registration Identity Safety

Only explicit official registrationNumber values are retained. No name-only matching, fuzzy matching, guessed registration number, or placeholder identity is allowed. Missing values remain unresolved and are reported by the registration coverage audit.
