# Database Migration Execution Plan — v0.2 (PROPOSED, RECONCILED)

**Status:** Draft v0.2 — reconciled 2026-10-04 with
`docs/database-design-amendments-proposed.md` (EX-01…EX-09). **NOT
APPROVED.** Authorizes nothing; no SQL, no database contact, no execution.

**Source design:** `docs/database-design.md` v1.0 (approved) as amended by
the proposed amendments (pending human approval).
**Branch:** `feature/database-schema` · Supersedes
`docs/database-migration-plan-proposed.md` (v0.1).

## 1. Purpose and scope

Implementation-ready plan for the approved v1.0 schema plus the proposed v0.3
amendments, distinguishing what blocks SQL drafting from what is safely
deferred. Planning and documentation only.

## 2. Source design and assumptions

| Source | State |
|---|---|
| `docs/database-design.md` | Approved v1.0 (authoritative) |
| `docs/database-design-amendments-proposed.md` | **Proposed EX-01…EX-09 — must be approved before affected stages are drafted** |
| `docs/database-design-proposed.md` | Historical proposal (reference) |
| `AGENTS.md`, `docs/git-workflow.md` | Binding rules |
| `docs/system-architecture.md`, `docs/project-charter.md` | Placeholders (A-08, non-blocking) |

**Assumptions:** one shared Supabase project for preview+production (A-05,
synthetic phase); Supabase CLI as tooling (EX-04, pending approval);
synthetic-only data until privacy review (D-12).

## 3. Dependency map (unchanged from v0.1)

```
auth.users → profiles → reports → incident_reports → incidents
                                    → risk_assessments → risk_assessment_scores (risk_criteria)
                                    → notifications → notification_recipients → notification_acknowledgments
audit_logs (references profiles; backend-written)
```

## 4. Migration order (structure; names unchanged, content reconciled)

| Stage | File | Objects | Reconciliation notes |
|---|---|---|---|
| M1 | `0001_identity.sql` | privilege baseline, `profiles`, role-freeze trigger, RLS | unchanged (needs EX-04 CLI for apply) |
| M2 | `0002_reference.sql` | categories, locations, criteria, thresholds + RLS | **EX-07:** shared-env seeding deferred until O-01; local placeholders only |
| M3 | `0003_reporting.sql` | `reports` + RLS | **EX-02/EX-03:** no client INSERT/UPDATE policies; backend-write model; editable-column allowlist |
| M4 | `0004_correlation.sql` | `incidents` (+community fields), `incident_reports` + RLS | unchanged |
| M5 | `0005_risk.sql` | assessments, scores + RLS | **EX-06:** write-time guard requiring configured thresholds |
| M6 | `0006_notifications.sql` | notifications (+`sent_by`), recipients, acknowledgments + RLS | **EX-01:** member read predicates (sent-only; delivered-only recipient rows) |
| M7 | `0007_audit.sql` | `audit_logs`, append-only trigger, deny-all RLS | **EX-02:** audit events incl. `report.created/updated/withdrawn` |
| M8 | `0008_fixtures.sql` | deterministic synthetic fixtures | **EX-09:** local-stack provisioning only; shared provisioning requires decision |

## 5. Per-stage implementation and verification criteria

General: RLS enabled with table creation; explicit REVOKE+GRANT; zero `anon`
policies; policy comments cite design or amendment section.

### M1 — Identity and privilege baseline
- Objects: revoke defaults; `profiles` (FK `auth.users`, role CHECK,
  column grant `display_name`, role-freeze trigger); RLS.
- Verify: `anon` denied; user sees own row; `role`/`is_active` update
  fails; `display_name` update succeeds; backend path works (T-06).
- Rollback: drop trigger/table, restore grants. Depends: EX-04 (CLI).

### M2 — Reference tables
- Objects: 4 reference tables + RLS (reads per role).
- Verify: authenticated reads categories/locations; members blocked from
  criteria/thresholds; client writes denied.
- Data: placeholders allowed **local only** (EX-07); shared seeding gated
  on O-01.
- Rollback: drop tables (no dependents).

### M3 — Reports (backend-write model)
- Objects: `reports` + indexes + **read-only RLS** (EX-02): members SELECT
  own rows; **no client INSERT/UPDATE/DELETE policies**.
- Verify: client INSERT/UPDATE fails; backend create succeeds with
  `reporter_id` from JWT; allowlist edits (EX-03) succeed server-side;
  non-allowlist edits rejected; audit rows written (M7 dependency at
  runtime).
- Rollback: drop table (M4 not applied yet).

### M4 — Incidents and associations
- Objects: `incidents` (+ community fields), `incident_reports` + indexes +
  RLS (officer/administrator paths; members via server feed only).
- Verify: member direct select denied; report-per-incident unique;
  community fields writable only server-side.
- Rollback: drop `incident_reports`, then `incidents`.

### M5 — Risk assessment (threshold guard)
- Objects: `risk_assessments`, `risk_assessment_scores` + partial unique
  `is_current` + RLS.
- Verify: **writes rejected while `risk_thresholds` has no full four-band
  config (EX-06)**; after config, band-validated; one current assessment
  per incident; assessor-mismatch rejected.
- Rollback: drop scores, then assessments.

### M6 — Notifications (member read predicates)
- Objects: `notifications` (+`sent_by`, CHECKs), `notification_recipients`,
  `notification_acknowledgments` + RLS.
- Verify (EX-01): member cannot read draft/pending/approved-not-sent
  notifications; member reads own `sent` notification; recipient rows
  hidden until `delivered_at`; `sent` without approval fields rejected;
  acknowledgment client-writes rejected.
- Rollback: drop acknowledgments → recipients → notifications.

### M7 — Audit logs
- Objects: `audit_logs`, append-only trigger, deny-all RLS, privilege
  restrictions.
- Verify: clients cannot read; UPDATE/DELETE fail for all roles incl.
  `service_role`; service_role INSERT succeeds; `report.created/updated/
  withdrawn` events expected from M3 backend (EX-02).
- Rollback: drop trigger/table (defeats append-only intent; requires
  authorization).

### M8 — Synthetic fixtures
- Objects: deterministic fixture rows only.
- Verify: `is_synthetic` everywhere; `.invalid` emails; idempotent;
  placeholders confined to local (EX-07).
- Provisioning: local-stack script only (EX-09); shared provisioning
  `[HUMAN DECISION REQUIRED]`.
- Rollback: delete by fixed IDs (dev only).

## 6. RLS and privilege testing strategy

Test identities: one synthetic user per role + `anon`.
- **T-01** `anon` denial on every table.
- **T-02** cross-user isolation (reports, profiles, notifications).
- **T-03** role escalation blocked (all paths).
- **T-04** workflow integrity: sent-without-approval; rejection-without-
  reason; acknowledgment client-write; **member draft/approved-not-sent
  notification reads (EX-01)**; **reports client INSERT/UPDATE blocked
  (EX-02)**; **allowlist violations (EX-03)**; **assessment writes with
  empty thresholds (EX-06)**.
- **T-05** least privilege: members blocked from criteria/thresholds,
  audit logs, other users' incidents.
- **T-06** backend path: service_role operations succeed; audit
  UPDATE/DELETE still fail.
- Mechanism: SQL assertion scripts in `supabase/tests/` on the local CLI
  stack (EX-04); repository node test extended with migration-scan guard
  (RLS on every table; zero `anon` policies). No tests against shared
  environments without authorization.

## 7. Synthetic fixture strategy

Unchanged from v0.1 (deterministic IDs, `.invalid` emails, `is_synthetic`
flags, idempotent) plus: local-only placeholder reference values (EX-07);
local-only synthetic user provisioning via runtime-credential script
(EX-09).

## 8. Rollback and recovery considerations

Unchanged posture with EX-04 detail: if the Supabase CLI is adopted,
`supabase migration` provides forward application; **down-migrations are
unsupported** — rollback equals authored, authorized down-scripts or
forward-fix. Local-stack `db reset` is the clean recovery path for
development. Destructive actions require human authorization (AGENTS.md);
audit rollback additionally defeats append-only intent.

## 9. Development / preview / production separation

| Environment | Database | Status |
|---|---|---|
| Local dev | Supabase CLI local stack | Fully isolated; M1–M8 + tests live here |
| Preview (Pages) | Shared Supabase project | Tolerated **only while synthetic** (EX-05) |
| Production (Pages) | Shared Supabase project | Migrations require G-4; fixtures stay synthetic |

**Real-data phase:** `[HUMAN DECISION REQUIRED]` — separate project vs
disabled preview vs accepted risk; precedes privacy/data-residency review
(D-12) and blocks real data only (EX-05).

## 10. Risks and unresolved decisions

**Unresolved — blockers for SQL drafting (amendments must be approved first):**
| ID | Decision | Blocks |
|---|---|---|
| EX-01 (A-01) | Member notification read predicate | M6 |
| EX-02 (A-02) | Report backend-write + audit events | M3, M7 |
| EX-03 (A-03) | Author-editable column allowlist | M3 |
| EX-06 (A-06) | Threshold guard for risk writes | M5 |

**Unresolved — safely deferred (non-blocking for drafting):**
| ID | Decision | Deferred to |
|---|---|---|
| EX-04 (A-04) | CLI tooling + assertion scripts (needs dev-dependency approval) | Before G-2 (apply) |
| EX-05 (A-05) | Real-data environment topology | Real-data phase only |
| EX-07 (A-07) | Reference values confirmation | Before shared seeding (G-6) |
| EX-08 (A-08) | Architecture documentation | Before any module implementation |
| EX-09 (A-09) | Local provisioning approved; shared provisioning mechanism | Before G-5/G-6 |

**`[HUMAN DECISION REQUIRED]` (not inventable):**
1. A-05 real-data topology.
2. A-09 shared-environment synthetic-user credential mechanism.
3. A-04 formal test framework preference (only if institution asks).

**Residual risks (unchanged):** R-01 misapplication on shared DB (gated);
R-02 RLS gaps (T-suite); R-03 backup/PITR unverified (confirm before G-3);
R-04 audit owner-limitation (governance); R-05 shared preview/prod
(reviewed in EX-05); R-06 role-freeze trigger mis-parse (test backend
path first); R-07 accidental real data (synthetic rule + gated).

## 11. Explicit authorization gates (updated)

| Gate | Action | Requires |
|---|---|---|
| G-0 | Approve amendments EX-01…EX-03, EX-06 (drafting blockers) | Human |
| G-0.5 | Approve Supabase CLI dev-tooling (EX-04) | Human |
| G-1 | Write migration SQL files | Human (after G-0) |
| G-2 | Apply to local stack | Approval + CLI installed |
| G-3 | Apply to shared/preview | Approval + env confirmation |
| G-4 | Apply to production | Separate approval + backup confirmation |
| G-5 | Provision synthetic auth users (local) | Approval + runtime credentials |
| G-5.5 | Shared-env synthetic provisioning | Human decision (A-09) |
| G-6 | Seed/fixtures on shared env | Approval + O-01 confirmation (A-07) |
| G-7 | Introduce real personal data | Privacy review + retention policy + EX-05 decision |
| G-8 | Commit/push/merge/deploy | Approval per git-workflow |

## 12. Readiness checklist for next phase

- [ ] G-0: amendments EX-01…EX-03, EX-06 approved
- [ ] G-0.5: CLI tooling approved and installed; assertion mechanism chosen
- [ ] EX-08 architecture doc tracked as pre-module check
- [ ] O-01 reference confirmation scheduled (needed only before G-6)
- [ ] A-04/A-09 `[HUMAN DECISION REQUIRED]` items scheduled, not urgent
- [ ] Backup availability confirmed before any G-3
- [ ] This v0.2 plan approved
- [ ] G-1 authorized to write `supabase/migrations/*.sql`

## 13. Explicitly NOT done

No SQL; no migration files; no DB contact or change; no objects/accounts;
no data inserted; no real personal data; no application/Cloudflare changes;
no commits/pushes/merges/deploys; no branch change; no credentials
requested or exposed. The approved design and historical proposal are
untouched. Draft plan awaiting human review.
