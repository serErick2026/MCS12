# EX-07 / O-01 — Candidate Reference Values (FOR REVIEW, NOT SEEDED)

**Status:** PROPOSAL 2026-10-05 — prepared under the M3 execution
authorization ("prepare candidate values for my review"). **Nothing in
this document has been or will be inserted into the database until the
researcher explicitly confirms the values (O-01) and authorizes a seed
operation.** Per design v1.1 §5.2 / EX-07, shared-environment rows are
gated; risk criteria/threshold content stays deferred (D-08/O-02) and
is not proposed here.

All rows below are drafts — edit, reorder, add, or reject freely.

## 1. `report_categories` (code, name, description, sort_order)

| code | name | description | sort |
|---|---|---|---|
| `BULLY` | Bullying / harassment | Repeated targeted mistreatment, hazing, or intimidation | 10 |
| `FIGHT` | Fight / physical aggression | Physical violence between students or against staff | 20 |
| `WEAPON` | Weapon concern | Observed, reported, or suspected weapon on campus | 30 |
| `THREAT` | Threat / intimidation | Verbal, written, or online threat of harm | 40 |
| `SUBSTANCE` | Substance use | Suspected use, possession, or distribution of substances | 50 |
| `VANDAL` | Vandalism / property damage | Damage or defacement of school property | 60 |
| `UNSAFE` | Unsafe condition | Facility, environmental, or procedural hazard | 70 |
| `INJURY` | Injury / medical | Student or staff injury requiring attention | 80 |
| `DIGITAL` | Online / cyber concern | Off-campus or online conduct affecting the school community | 90 |
| `OTHER` | Other | Does not fit the categories above | 99 |

## 2. `locations` (code, name, zone, latitude/longitude)

Latitude/longitude intentionally left empty — they are site-specific
(the actual school's coordinates are your data to provide).

| code | name | zone |
|---|---|---|
| `GATE-N` | North gate / entrance | arrival |
| `GATE-S` | South gate / entrance | arrival |
| `HALL-A` | Academic wing corridor | academic |
| `HALL-B` | Administrative wing corridor | administrative |
| `CLASSROOM` | Classroom (specify number in description) | academic |
| `RESTROOM` | Restroom / washroom | service |
| `CANTEEN` | Canteen / cafeteria | recreation |
| `PLAYGROUND` | Playground / courtyard | recreation |
| `GYM` | Gymnasium / auditorium | recreation |
| `PARKING` | Parking area | arrival |
| `BUS-STOP` | Bus stop / pick-up zone | arrival |
| `PERIMETER` | School grounds / perimeter | perimeter |

## 3. Decisions requested

1. **O-01:** confirm, edit, or replace the categories above (exact
   codes/names as they will appear in the product).
2. **O-01:** confirm, edit, or replace the locations above; optionally
   supply real coordinates for the school (or confirm leaving them null).
3. Confirm whether `OTHER` should exist at all (some review boards
   prefer forcing a concrete category).
4. After confirmation: authorize a **separate seed operation** (backend
   / service-role INSERT via an approved, reviewed step — not part of
   any migration file, per EX-07).

**Nothing here is institutional policy until you say so.**
