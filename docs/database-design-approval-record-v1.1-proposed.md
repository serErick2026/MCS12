# Database Design Approval Record — Version 1.1 (RECORDED)

**Status:** **ACKNOWLEDGED AND RECORDED** — the in-principle approval
decision was acknowledged by the human reviewer, and Version 1.1 was
**promoted** to the authoritative baseline (documentation-only) on
2026-10-04.

**IMPORTANT — candidate approval ≠ authorization to implement.** This record
documents approval of the Version 1.1 baseline for drafting. It does
**not** authorize SQL drafting, migration execution, database modification,
application implementation, real personal data collection, or any
commit/push/merge/deploy. See §6. The v1.1 **promotion itself** was
authorized separately on 2026-10-04.

**Branch:** `feature/database-schema`

## 1. Baseline identity

| Item | Value |
|---|---|
| **Previous baseline** | **Version 1.0** — APPROVED DESIGN BASELINE, `docs/database-design.md` (2026-10-04). **Archived verbatim at `docs/database-design-archive-v1.0.md`** upon promotion of v1.1. |
| **Proposed revised baseline** | **Version 1.1** — `docs/database-design-v1.1-candidate.md` consolidated EX-01…EX-09 (change log references). **Promoted to the authoritative `docs/database-design.md` as APPROVED DESIGN BASELINE, Version 1.1, on 2026-10-04.** |
| **Current authoritative baseline** | **Version 1.1 — `docs/database-design.md`** |
| **Procedure** | v1.0 → proposals/amendments (EX-01…EX-09) → candidate v1.1 → clarification (availability/viewing/acknowledgment, authorized docs-only) → in-principle approval (this record) → **promotion (2026-10-04)** |

## 2. Approved amendments (subject to documented authorization and verification)

The human reviewer **approves in principle**, with conditions:

| ID | Amendment | Condition |
|---|---|---|
| EX-01 | Notification recipient authorization and delivery visibility, **including the availability / viewing / acknowledgment semantics clarification** | Approved subject to the documented authorization and verification requirements (change log EX-01; tests T-04) |
| EX-02 | Backend-controlled report creation, correction, withdrawal (+ audit events) | Approved subject to documented authorization and verification |
| EX-03 | Report field editability and lifecycle restrictions | Approved subject to documented authorization and verification |
| EX-06 | Complete risk-threshold configuration requirement | Approved subject to documented authorization and verification |

## 3. Conditional amendments (pending their stated implementation gates)

| ID | Amendment | Gate |
|---|---|---|
| EX-04 | Migration tooling and local verification (Supabase CLI) | Conditional on dev-tooling approval before G-2 (apply) — not before drafting |
| EX-07 | Reference-data confirmation requirements | Deferred: institutional O-01 confirmation before shared-env seeding |
| EX-08 | Architecture documentation dependency | Deferred: content required before application modules only |
| EX-09 | Synthetic authentication-user provisioning | Conditional: local provisioning accepted as candidate; shared-environment mechanism pending human decision |

## 4. Unresolved decisions (NOT approved — remain open)

1. **EX-05 — real-data environment topology:** separate production
   Supabase project vs disabled preview builds vs accepted residual risk.
   Blocks real personal data only; unrelated to SQL drafting.
2. **Shared-environment synthetic authentication provisioning:** credential
   mechanism unresolved; open before G-5.5/G-6.

Both remain `[HUMAN DECISION REQUIRED]` and are not resolved by this
record.

## 5. Approval conditions — consistency confirmation

The candidate was inspected against all six supplied conditions:

| # | Condition | Status |
|---|---|---|
| 1 | EX-01, EX-02, EX-03, EX-06 approved subject to documented authorization/verification | ✅ reflected (candidate §0; change log) |
| 2 | EX-04, EX-07, EX-08, EX-09 conditional on stated gates | ✅ reflected (§3 above) |
| 3 | EX-05 real-data topology unresolved | ✅ reflected (candidate §10.4) |
| 4 | Shared-env synthetic provisioning unresolved | ✅ reflected (candidate §11; EX-09) |
| 5 | Availability vs viewing distinct concepts | ✅ now explicit (candidate §5.6 semantics block; change log EX-01 clarification) |
| 6 | No SQL/db/data/commit/push/merge/deploy authorized | ✅ reflected (this record §6; candidate §0.2 analog) |

Consistency verified: candidate §5.6 (§8 RLS row) and change log EX-01 use
the identical member access predicate (recipient membership + `status='sent'`
+ `delivered_at IS NOT NULL`); acknowledgment binding via `recipient_row_id`
unique FK is unchanged; approval/send/audit/RLS requirements untouched.

## 6. Explicit non-authorization boundaries (binding)

This decision authorizes **none** of the following:
- Writing or executing SQL migrations
- Any connection to or modification of the live Supabase database
- Creating database objects or accounts; inserting data of any kind
- Collecting or introducing real personal data (further gated by privacy/
  data-residency review + retention policy, D-12/O-03)
- Application implementation of any module
- Changes to application code or Cloudflare/deployment configuration
- Commits, pushes, merges, deployments, or any Git branch changes
- **Promotion of Version 1.1 into `docs/database-design.md`** (separate
  authorization required)
- Exposure or solicitation of credentials

## 7. Required verification before implementation

Before any SQL is drafted (G-1), the following must hold:
1. **G-0 satisfied:** this approval record acknowledged (human sign-off of
   the record itself).
2. Drafting-affecting amendments (EX-01/02/03/06) are captured in the
   candidate exactly as approved; change log verification fields accepted.
3. Test requirements are registered: T-01…T-06 (incl. new EX-01 semantics
   cases: unset-`delivered_at` access denial; `read_at` without
   `acknowledged_at` permitted; acknowledgment join integrity).
4. EX-04 tooling approved before any G-2 (apply); local stack only.
5. EX-05/EX-09 decisions still open — they do **not** gate drafting.

## 8. Record log

| Step | Date | Action |
|---|---|---|
| v1.0 baseline | 2026-10-04 | Approved Design Baseline |
| v1.1 candidate | 2026-10-04 | Consolidated EX-01…EX-09 |
| Clarification | 2026-10-04 | Availability/viewing/acknowledgment semantics (docs-only authorization) |
| In-principle approval | 2026-10-04 | Human decision with six conditions — recorded here |
| **Promotion** | **2026-10-04** | **Version 1.1 promoted to `docs/database-design.md` (documentation-only); v1.0 archived. EX-05 topology and shared-env provisioning remain open.** |

## 9. Explicitly NOT done

No SQL; no migrations; no Supabase contact or modification; no accounts or
data; no real personal data; no application or deployment changes; no
commits, pushes, merges, deploys, or branch changes; `docs/database-design.md`
(v1.0) untouched. This record awaits final human review.