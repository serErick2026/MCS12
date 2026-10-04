# Database Migration Execution Plan (PROPOSED)

**Status:** Draft — proposed 2026-10-04 for human review. **NOT APPROVED.**
**Authorizes nothing:** no SQL, no database contact, no migration execution.

**Source design:** `docs/database-design.md` — *Document 04, APPROVED DESIGN
BASELINE v1.0* (2026-10-04).
**Branch:** `feature/database-schema`

## 1. Purpose and scope

Implementation-ready plan for turning the approved v1.0 schema into reviewed
migrations — without writing or executing any SQL yet. Covers object
dependencies, migration order, per-stage verification, RLS/privilege testing,
synthetic fixtures, rollback, environment separation, risks, and
authorization gates.

**In scope:** planning + documentation only.
**Out of scope:** SQL files, database changes, account creation, data
insertion, app code, Cloudflare config, commits/pushes/deploys.

## 2. Source design and assumptions

| Source | State |
|---|---|
| `docs/database-design.md` | Approved v1.0 — sole schema authority |
| `AGENTS.md` | Security, phase, and workflow rules (binding) |
| `docs/git-workflow.md` | Branch/PR/review rules; migrations require human review |
| `docs/development-roadmap.md` | Phase 2 modules approval-gated |
| `docs/system-architecture.md` | **Placeholder** — no approved architecture text (gap A-08) |
| `docs/project-charter.md` | **Placeholder** — one-school scope known from project brief only |

**Assumptions (to be confirmed):**
1. One Supabase project serves dev/preview/prod unless separation is
   approved (risk R-05).
2. Migrations will be applied through a CLI or reviewed SQL — the mechanism
   is **undecided** (A-04).
3. `pgcrypto` is available (Supabase default) for `gen_random_uuid()`.
4. The eight-part sequence in design §15 is the intended order.
5. Synthetic-only data until privacy/data-residency review passes.

## 3. Migration dependency map

```
auth.users (Supabase-managed)
    └─ profiles
         ├─ report_categories ─┐
         ├─ locations ─────────┤
         ├─ reports ───────────┴─ incident_reports ── incidents
         │                                        └─ risk_assessments ─ risk_assessment_scores ─ risk_criteria
         │                                        └─ notifications ─ notification_recipients ─ notification_acknowledgments
         └─ audit_logs (references profiles; written by backend only)
risk_thresholds (independent of the above; consumed by risk logic)
```

Hard dependencies:
- Everything depends on `profiles` (FK to `auth.users`).
- `reports` depends on `report_categories`, `locations`, `profiles`.
- `incidents` depends on `report_categories`, `locations`, `profiles`;
  `incident_reports` depends on `incidents` + `reports`.
- `risk_*` depends on `incidents`, `profiles`, `risk_criteria`.
- `notifications` depends on `incidents`, `profiles`; recipients depend on
  `notifications` + `profiles`; acknowledgments depend on recipients.
- `audit_logs` depends on `profiles` only.

## 4. Proposed migration order

| Stage | File (planned) | Objects |
|---|---|---|
| M1 | `0001_identity.sql` | privilege baseline, `profiles`, role-freeze trigger, RLS |
| M2 | `0002_reference.sql` | `report_categories`, `locations`, `risk_criteria`, `risk_thresholds` + RLS |
| M3 | `0003_reporting.sql` | `reports` + RLS |
| M4 | `0004_correlation.sql` | `incidents` (+ community fields), `incident_reports` + RLS |
| M5 | `0005_risk.sql` | `risk_assessments`, `risk_assessment_scores` + RLS |
| M6 | `0006_notifications.sql` | `notifications` (+ `sent_by`), `notification_recipients`, `notification_acknowledgments` + RLS |
| M7 | `0007_audit.sql` | `audit_logs`, append-only trigger, deny-all RLS, privilege restrictions |
| M8 | `0008_fixtures.sql` | deterministic synthetic fixtures (dev only) |

Rationale: reference data before data-bearing tables; parents before
children; audit last (needs `profiles`); fixtures strictly after all
structure. Each stage is independently reviewable and reversible in
principle.

## 5. Per-stage implementation and verification criteria

For every stage: RLS enabled in the same migration as table creation;
explicit `REVOKE` + minimal `GRANT`; no `anon` policy; every policy carries a
comment citing the design section.

### M1 — Identity and privilege baseline
- **Objects:** revoke Supabase default grants on `public`; `profiles`
  (FK `auth.users`, role CHECK); column grant `UPDATE(display_name)`;
  role-freeze trigger; RLS (select own, update own).
- **Prerequisites:** design §5.1, §8, §14 C-01/C-02 approved; auth schema
  reachable.
- **Verify:** table exists; `anon` cannot select/insert/update; authenticated
  user sees only own row; updating `role`/`is_active` fails; `display_name`
  update succeeds.
- **Security tests:** privilege escalation attempts (T-01…T-03, §6).
- **Rollback:** drop trigger, table, restore grants (see §8).
- **Risk:** role-freeze trigger misreading JWT claims could lock out backend
  (mitigate: test service_role path first in local).

### M2 — Reference tables
- **Objects:** `report_categories`, `locations`, `risk_criteria`,
  `risk_thresholds`; RLS (read by role per design §8); write service_role
  only.
- **Prerequisites:** O-01 confirmation for category/location **values**
  (structure may proceed regardless); O-02 for criteria/thresholds content.
- **Verify:** authenticated can read categories/locations; members cannot
  read risk criteria/thresholds; inserts denied to clients.
- **Data:** reference values carry `[CONFIRM]` until confirmed (A-07).
- **Rollback:** drop tables (no dependents yet).

### M3 — Reports
- **Objects:** `reports` + indexes + RLS.
- **Prerequisites:** M2.
- **Verify:** authenticated insert with `reporter_id = auth.uid()`
  succeeds; insert as another reporter fails; `anon` denied; member sees own
  rows only; status change by member denied.
- **Ambiguity:** exact list of author-editable columns while `submitted` is
  not enumerated in the design (A-03).
- **Rollback:** drop table (M4 not yet applied).

### M4 — Incidents and associations
- **Objects:** `incidents` (incl. `community_summary`,
  `community_guidance`, `is_community_visible`, timestamps),
  `incident_reports` + indexes + RLS.
- **Prerequisites:** M3.
- **Verify:** members have no direct select; officer/admin paths work;
  unique report-per-incident enforced; community fields writable only
  server-side.
- **Rollback:** drop `incident_reports`, then `incidents`.

### M5 — Risk assessment
- **Objects:** `risk_assessments`, `risk_assessment_scores` + partial unique
  `is_current` + RLS.
- **Prerequisites:** M4, `risk_criteria` rows (M2).
- **Verify:** one current assessment per incident enforced; non-admin
  assessor must equal `auth.uid()`; scores unique per criterion.
- **Dependency:** threshold bands empty until O-02 — `risk_level` cannot yet
  be validated against `risk_thresholds` (A-06).
- **Rollback:** drop scores then assessments.

### M6 — Notifications, recipients, acknowledgments
- **Objects:** `notifications` (+ `sent_by`, CHECKs), `notification_
  recipients`, `notification_acknowledgments` + RLS.
- **Prerequisites:** M4, M5 optional.
- **Verify:** `sent` impossible without approval/execution fields; rejection
  requires reason; acknowledgment writes denied to clients (server-side
  only); recipient expansion service-role only.
- **Inconsistency:** the design's member notification read path (via
  recipient rows) is **not expressible under the stated `notifications`
  SELECT policy** — see A-01.
- **Rollback:** drop acknowledgments → recipients → notifications.

### M7 — Audit logs
- **Objects:** `audit_logs`, append-only trigger, deny-all RLS, revoke
  UPDATE/DELETE/TRUNCATE from `anon`/`authenticated`/`service_role`.
- **Prerequisites:** M1 (profiles FK).
- **Verify:** clients cannot read; UPDATE/DELETE fail even for
  `service_role`; INSERT by `service_role` succeeds.
- **Limitation:** owner/superuser can alter records (design §9) — accepted,
  governance-mitigated.
- **Rollback:** drop trigger, table (note: dropping defeats append-only
  intent — requires authorization).

### M8 — Synthetic fixtures
- **Objects:** deterministic synthetic rows only (no structure).
- **Prerequisites:** M1–M7; synthetic-user provisioning path (A-09).
- **Verify:** all rows `is_synthetic = true`; `.invalid` emails; idempotent
  re-run; no real personal data.
- **Rollback:** delete synthetic rows by fixed IDs (dev only).
- **Gate:** requires separate authorization; never against production
  unprompted.

## 6. RLS and privilege testing strategy

- **Test identities (synthetic):** one user per role
  (administrator/safety_officer/member/viewer) + `anon` (no JWT).
- **Categories:**
  - **T-01 anon denial:** every table returns zero rows / denied writes for
    `anon`.
  - **T-02 cross-user isolation:** member A cannot read member B's reports
    or profile.
  - **T-03 role escalation:** member cannot update `role`/`is_active` by any
    SQL/API path.
  - **T-04 workflow integrity:** `sent` without approval, rejection without
    reason, acknowledgment client-write — all rejected.
  - **T-05 least privilege:** members cannot read risk criteria/thresholds,
    audit logs, or other users' incidents.
  - **T-06 backend path:** `service_role` operations succeed (except
    append-only UPDATE/DELETE on audit).
- **Mechanism (undecided):** plain SQL assertion scripts in local dev, or a
  test framework — choose at A-04 resolution. **No test runs against a live
  shared database without authorization.**
- **Repository guard (future):** node test scanning migrations for
  `ENABLE ROW LEVEL SECURITY` on every created table and zero `anon`
  policies (design V-06).

## 7. Synthetic fixture strategy

- Deterministic IDs (`00000000-0000-4000-8000-0000000000NN`), fixed codes,
  idempotent inserts.
- `.invalid` email domains only; `Synthetic <Role> NN` display names;
  `is_synthetic = true` everywhere.
- Synthetic **auth users** require privileged provisioning (admin API /
  service_role) — an authorization-gated action (A-09, G-5).
- Reference data (M2) is configuration, not synthetic fixtures, and carries
  no `is_synthetic` flag; values stay `[CONFIRM]` until confirmed.
- Fixtures are development-only; production seeding requires explicit
  approval.

## 8. Rollback and recovery considerations

- Supabase migrations are forward-applied; **there is no automatic
  down-migration** unless the tooling supports it. Options: paired
  down-scripts per stage, or forward-fix migrations. Choice is part of A-04.
- Recommended posture: apply to a **local** database first; only after full
  verification consider a shared environment.
- Destructive rollback (`DROP`) requires explicit authorization per
  AGENTS.md; `audit_logs` rollback additionally defeats append-only intent.
- Backup expectation: rely on Supabase project backups/PITR where available;
  **not verified** in this task (no live access). If unavailable on free
  tier, note as a risk (R-03).
- Recovery of a failed mid-migration: each stage is single-purpose so it can
  be re-applied after a forward-fix; avoid multi-stage transactions until
  the tooling is confirmed.

## 9. Development / preview / production separation

| Environment | Database | Notes |
|---|---|---|
| Local dev | Supabase local stack (CLI) | Preferred target for M1–M8 + tests; no shared data |
| Preview (Cloudflare Pages preview builds) | **Currently the same Supabase project** | Risk R-05: preview traffic can touch shared data |
| Production (Cloudflare Pages `main`) | Same Supabase project | Migrations here require explicit authorization |

- **Undecided:** whether a separate Supabase project/branch is provisioned
  for preview (Supabase branching is a paid feature; free-tier constraints
  apply). Documented, not assumed.
- Environment values (`SUPABASE_URL`, anon key) are already separated by
  build config, but the **database instance is not** — this is the key
  separation gap.
- No environment change is performed by this plan.

## 10. Risks and unresolved decisions

**Design ambiguities/gaps (documented, not resolved — stop condition):**
| ID | Issue |
|---|---|
| A-01 | `notifications` SELECT policy grants members only `created_by = auth.uid()` or administrator — it does **not** express the design's stated "members read via recipient rows" path. Needs a recipient-based SELECT predicate or a server-delivered read path. |
| A-02 | Report **creation** (client-direct) is not listed among audited events; audit coverage of creation vs. transitions is unclear. |
| A-03 | Exact author-editable column list for `reports` while `submitted` is not enumerated. |
| A-04 | Migration tooling and test mechanism undefined (Supabase CLI vs reviewed SQL; pgTAP vs plain assertions) — may require credentials/tooling install. |
| A-05 | Whether preview and production share one Supabase instance (currently they do). |
| A-06 | `risk_thresholds` empty until O-02, so `risk_level` cannot be validated against thresholds at write time. |
| A-07 | Reference values are `[CONFIRM]`; seeding them before confirmation is a data-quality risk. |
| A-08 | `docs/system-architecture.md` is a placeholder — the plan relies on the database design alone. |
| A-09 | Synthetic auth-user provisioning method (admin API) requires privileged credentials. |

**Risks:**
| ID | Risk | Mitigation |
|---|---|---|
| R-01 | Misapplied migration on a shared DB | Local-first; per-stage verification; authorization gates |
| R-02 | RLS policy gaps exposing data | T-01…T-06 test suite; repository guard test |
| R-03 | Backup/PITR availability unverified on free tier | Confirm before any shared apply |
| R-04 | Audit append-only limits (owner can alter) | Governance; documented limitation |
| R-05 | Preview/production share one database | Decide separation before preview use |
| R-06 | Role-freeze trigger blocks legitimate backend writes if claims parsing is wrong | Test service_role path locally first |
| R-07 | Real personal data introduced accidentally | Synthetic-only rule + privacy review gate (§design 10.3) |

## 11. Explicit authorization gates

| Gate | Action | Requires |
|---|---|---|
| G-1 | Write migration SQL files | Explicit human approval |
| G-2 | Apply migrations to **local** database | Approval + local tooling |
| G-3 | Apply migrations to **shared/preview** database | Approval + confirmation of environment separation |
| G-4 | Apply migrations to **production** | Separate explicit approval + backup confirmation |
| G-5 | Create synthetic auth users (privileged API) | Approval + credentials handling outside the repo |
| G-6 | Run seed/fixtures on any shared environment | Approval |
| G-7 | Introduce any real personal data | Privacy/data-residency review + retention policy (design O-03/D-12) |
| G-8 | Any commit/push/merge/deploy | Approval per git-workflow |

## 12. Readiness checklist for the next phase

- [ ] Human resolves A-01…A-09 (or accepts documented deferral)
- [ ] Migration tooling + test mechanism chosen (A-04)
- [ ] Environment separation decision made (A-05/R-05)
- [ ] Backup/PITR availability confirmed (R-03)
- [ ] O-01 reference values confirmed (or explicitly deferred with
      `[CONFIRM]` seeds in dev only)
- [ ] O-02 risk content planned (can lag M5 structurally)
- [ ] This plan approved
- [ ] G-1 authorized to write SQL migrations
- [ ] Local database target confirmed (G-2)

## 13. Explicitly NOT done

No SQL written; no migration files; no database contact or change; no
objects created/altered/deleted; no data inserted; no accounts created; no
real personal data; no application/config changes; no commits, pushes,
merges, or deploys; no branch change. This document is a draft awaiting
human review.