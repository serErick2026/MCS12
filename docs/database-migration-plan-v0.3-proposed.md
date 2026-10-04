# Database Migration Execution Plan — v0.3 (PROPOSED)

**Status:** Draft v0.3 — reconciled with the **Database Design v1.1
candidate** and its change log, 2026-10-04. **NOT APPROVED.** Authorizes
nothing: no SQL, no database contact, no execution.

**Source design:** `docs/database-design-v1.1-candidate.md` (pending human
approval); currently binding: `docs/database-design.md` v1.0 (approved).
**Companion:** `docs/database-design-change-log-proposed.md`.
**Branch:** `feature/database-schema`. Supersedes plan v0.2.

## 1. Purpose and scope

Implementation-ready plan for the **approved v1.1 schema** (v1.0 +
EX-01…EX-09, promoted 2026-10-04), distinguishing drafting gates from
safely deferred items. Planning and documentation only.

## 2. Source design and assumptions

| Source | State |
|---|---|
| `docs/database-design.md` | **APPROVED v1.1 baseline (current, promoted 2026-10-04)** — binding |
| `docs/database-design-v1.1-candidate.md` | Historical candidate (superseded by promotion) |
| `docs/database-design-archive-v1.0.md` | Archived v1.0 baseline (historical) |
| `docs/database-design-change-log-proposed.md`, `-amendments-proposed.md` | Change rationale and verification requirements |
| `AGENTS.md`, `docs/git-workflow.md` | Binding rules |

**Assumptions:** Supabase CLI tooling (EX-04); shared preview/prod project
while synthetic (EX-05); synthetic-only until privacy review (D-12).

## 3. Dependency map

Unchanged from v0.2 (§3).

## 4. Migration order

| Stage | File | Objects | v1.1 reconciliation |
|---|---|---|---|
| M1 | `0001_identity.sql` | privilege baseline, `profiles`, role-freeze trigger, RLS | unchanged |
| M2 | `0002_reference.sql` | 4 reference tables + RLS | EX-07: placeholders local-only; shared seeding after O-01 |
| M3 | `0003_reporting.sql` | `reports` + RLS | **EX-02/EX-03:** no client write policies; backend-write model; editable allowlist |
| M4 | `0004_correlation.sql` | `incidents` (+community fields), `incident_reports` + RLS | unchanged |
| M5 | `0005_risk.sql` | assessments, scores + RLS | **EX-06:** DB guard — full four-band thresholds required for writes |
| M6 | `0006_notifications.sql` | notifications, recipients, acknowledgments + RLS | **EX-01:** delivered-only member predicates on `notifications` + `notification_recipients` |
| M7 | `0007_audit.sql` | `audit_logs`, append-only trigger, deny-all RLS | EX-02: audit events incl. `report.created/updated/withdrawn` |
| M8 | `0008_fixtures.sql` | deterministic synthetic fixtures | EX-09: local-stack provisioning only; shared mechanism pending decision |

## 5. Per-stage implementation and verification criteria

General rules unchanged (RLS with creation; REVOKE+GRANT; zero `anon`
policies; policy comments cite design/change-log section).

- **M1:** as v0.2. Verify anon denial, own-row visibility, escalation
  failure, backend path (T-06).
- **M2:** as v0.2 + EX-07 shared seeding gate. Verify role scoping of
  criteria/thresholds reads.
- **M3:** per EX-02/EX-03 — no client INSERT/UPDATE/DELETE policies on
  `reports`; backend create/correct/withdraw with JWT-derived
  `reporter_id`; allowlist enforcement. Verify T-01/T-04 additions and
  audit-row expectations (M7 runtime dependency).
- **M4:** as v0.2 (member direct select denied; uniqueness; community
  fields server-only).
- **M5:** per EX-06 — assessment writes rejected until `risk_thresholds`
  holds all four bands; accepted + band-validated after; `is_current`
  swap re-validated.
- **M6:** per EX-01 — member read predicate (`status='sent'` +
  recipient membership); recipient rows invisible pre-`delivered_at`;
  `sent` requires approval+execution fields; ack client-writes rejected.
- **M7:** as v0.2 + EX-02 audited event set; UPDATE/DELETE fail for all
  roles incl. `service_role`; service_role INSERT succeeds.
- **M8:** per EX-09 — local-stack provisioning script, runtime
  credentials, deterministic/idempotent; placeholders local-only (EX-07).

## 6. RLS and privilege testing strategy

Identities: one synthetic user per role + `anon`.
- **T-01** anon denial · **T-02** isolation · **T-03** escalation ·
  **T-04** workflow integrity (incl. EX-01/02/03/06 cases) ·
  **T-05** least privilege · **T-06** backend path.
- Mechanism (EX-04): SQL assertion scripts in `supabase/tests/` on the
  local CLI stack; repository node test extended with migration-scan guard
  (RLS on every table; zero `anon` policies). No shared-environment tests
  without authorization.

## 7. Synthetic fixture strategy

As v0.2 + EX-07 (local-only placeholders) + EX-09 (local provisioning
script, throwaway passwords, credential-free repo).

## 8. Rollback and recovery considerations

As v0.2: CLI has no down-migrations — authored, authorized down-scripts or
forward-fix; local `db reset` for dev; destructive actions and audit
rollback require authorization.

## 9. Development / preview / production separation

As v0.2/EX-05: local CLI stack isolated; shared preview/prod tolerated
while synthetic; real-data topology `[HUMAN DECISION REQUIRED]` precedes
privacy review.

## 10. Risks and unresolved decisions

**Drafting gates — CLEARED by v1.1 approval/promotion (2026-10-04); G-1
still required before writing SQL:**

| ID (was blocker) | Behavioral change now in the approved baseline | Affects |
|---|---|---|
| EX-01 | Delivered-only member notification reads (+ availability/viewing/ack semantics) | M6 |
| EX-02 | Report backend-write + audit events (`report.created/updated/withdrawn`) | M3, M7 |
| EX-03 | Editable-column allowlist | M3 |
| EX-06 | Threshold guard for risk writes | M5 |

**Safely deferred (non-blocking for drafting):**
EX-04 (before G-2), EX-05 (real-data phase), EX-07 (before shared seeding),
EX-08 (before modules), EX-09 shared part (before G-5/G-6).

**`[HUMAN DECISION REQUIRED]`:** EX-05 topology; EX-09 shared credential
mechanism; EX-04 test-framework preference (optional).

**Residual risks R-01…R-07:** unchanged from v0.2.

## 11. Authorization gates

| Gate | Action | Requires |
|---|---|---|
| G-0 | ✅ **SATISFIED** — v1.1 baseline approved and promoted (2026-10-04) | Recorded |
| G-0.5 | Approve Supabase CLI dev-tooling (EX-04) | Human |
| G-1 | Write migration SQL files | Human (after G-0) |
| G-2 | Apply to local stack | Approval + CLI |
| G-3 | Apply to shared/preview | Approval + env confirmation |
| G-4 | Apply to production | Separate approval + backup confirmation |
| G-5 | Provision synthetic auth users (local) | Approval + runtime credentials |
| G-5.5 | Shared-env synthetic provisioning | Human decision (EX-09) |
| G-6 | Seed/fixtures on shared env | Approval + O-01 confirmation (EX-07) |
| G-7 | Real personal data | Privacy review + retention policy + EX-05 decision |
| G-8 | Commit/push/merge/deploy | Approval per git-workflow |

## 12. Readiness checklist

- [ ] G-0 ✅ **SATISFIED** — v1.1 approved + promoted (2026-10-04)
- [ ] G-0.5: CLI tooling approved + installed; assertion mechanism chosen
- [ ] EX-08 architecture doc scheduled pre-module
- [ ] O-01 confirmation scheduled (before G-6)
- [ ] EX-05/EX-09 decisions scheduled (non-urgent)
- [ ] Backup availability confirmed before any G-3
- [ ] This v0.3 plan approved
- [ ] G-1 authorized to write `supabase/migrations/*.sql`

## 13. Explicitly NOT done

No SQL; no migration files; no DB contact or change; no objects/accounts;
no data inserted; no real personal data; no application/Cloudflare
changes; no commits/pushes/merges/deploys; no branch change; no
credentials requested or exposed. `docs/database-design.md` (v1.0) and all
historical proposals untouched. Draft awaiting human review.
