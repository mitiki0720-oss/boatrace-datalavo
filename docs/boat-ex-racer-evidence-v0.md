# BOATRACE EX Racer Evidence v0

## Purpose

Phase 5 adds source-backed racer evidence for the EX page. It summarizes the
Phase 3 history by racer and keeps racer-profile, course-change, exhibition
reliability, start-timing, and prediction signal judgments in a pending or
insufficient-history state.

## Inputs

- `public/data/boatrace-ex/history/races/YYYY-MM-DD.json`
- `public/data/boatrace-ex/coverage/YYYY-MM-DD.json`
- `public/data/boatrace-ex/derived/venue-evidence/YYYY-MM-DD.json`

Venue evidence is optional context. The generator can continue with a warning
state if it is missing, but it does not read `public/data/reviews/**` or
`public/data/boatrace/*.generated.json` directly.

## Outputs

- `public/data/boatrace-ex/derived/racer-evidence/YYYY-MM-DD.json`
- `public/data/boatrace-ex/derived/manifest.generated.json`

The derived manifest keeps the existing venue evidence entry and adds a racer
evidence entry.

## Identity

`registrationNumber` is the primary key when it exists:

```text
registrationNumber:5133
```

If a registration number is missing, the generator creates a temporary
`unverified` key from source-backed fields and adds a warning. It must not
invent a registration number, branch, class, age, or profile fact.

## Evidence

Each racer item contains:

- appearances by venue and frame
- race-level evidence for frame, finish order, ST, exhibition time, motor, and boat
- start evidence from source-backed ST values
- exhibition evidence from source-backed exhibition times
- course-change evidence only when final course data exists
- result evidence from source-backed finish order
- motor and boat numbers observed in the Phase 3 history

Unknown or unparseable values remain `null`, `missing`, `partial`, `pending`, or
`insufficient-history`.

## Course Change Evidence

Course-change evidence compares frame, exhibition course, and final course only
when those source-backed values exist. If final course is unavailable,
`sourceStatus` is `missing` and change counts stay `null`. Phase 5 v0 does not
claim that a racer changes course often or rarely from one day of data.

## Fake Completion Ban

Phase 5 v0 must not output:

- racer profile scores
- course-change pattern scores
- exhibition reliability scores
- start timing pattern scores
- high confidence labels
- fixed racer pattern labels
- prediction signals

The EX page displays source-backed counts and pending readiness states only.

## Phase 6 Targets

Later phases can add multi-day racer profiles, course-change patterns,
exhibition reliability, start timing patterns, and prediction signals after
enough validated history has accumulated.
