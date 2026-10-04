# Document 04 — Database Design Specification, Version 1.1 (CANDIDATE)

**Status:** **CANDIDATE — Version 1.1** (Draft, 2026-10-04). Consolidates
Version 1.0 (Approved Design Baseline) with proposed amendments EX-01…EX-09.
**NOT APPROVED.** This candidate does not amend `docs/database-design.md`
(v1.0), which remains the approved baseline until a human approves this
revision.

**Branch:** `feature/database-schema`
**Sources:** v1.0 approved baseline; `docs/database-design-amendments-proposed.md`;
plans v0.1/v0.2.
**Companion documents:** `docs/database-design-change-log-proposed.md`;
`docs/database-migration-plan-v0.3-proposed.md`.

## 0. Amendment integration

| ID | Amendment | Classification |
|---|---|---|
| EX-01 | Notification recipient authorization and delivery visibility | Candidate-accepted (§5.6, §8, §12) |
| EX-02 | Backend-controlled report creation, correction, withdrawal | Candidate-accepted (§5.3, §8, §9, §12) |
| EX-03 | Report field editability and lifecycle restrictions | Candidate-accepted (§5.3, §8) |
| EX-04 | Migration tooling and local verification | Conditional (plan §10; tooling approval) |
| EX-05 | Environment boundaries | Conditional/deferred (real-data phase) |
| EX-06 | Complete risk-threshold configuration requirement | Candidate-accepted (§5.5) |
| EX-07 | Reference-data confirmation requirements | Deferred (institutional) |
| EX-08 | Architecture documentation dependency | Deferred (non-blocking) |
| EX-09 | Synthetic authentication-user provisioning | Conditional (local candidate-accepted; shared pending decision) |

All Version 1.0 decisions not explicitly amended are preserved unchanged
(e.g., D-01…D-14, O-04…O-10, role model, append-only audit posture,
conflict analysis C-01…C-07, one-school scope).

## 1. Purpose and scope

Same as v1.0: PostgreSQL schema design (Supabase) for the one-school
prototype — reporting, correlation, multi-criteria risk, approval-gated
notifications, acknowledgments, audit — with RLS on every table. Scope
preserved.

## 2. Design principles and constraints

v1.0 principles unchanged, with the following v1.1 clarifications:
- All report **writes** are backend-controlled (EX-02); clients never
  insert or update `reports` directly.
- Members may access notification content **only after delivery**
  (EX-01).
- Risk assessment writes require **complete threshold configuration**
  (EX-06).
- Synthetic provisioning is local-stack-first (EX-09).
- Architecture documentation is a **precondition for application modules,
  not for schema stages** (EX-08).

## 3. Conventions

Unchanged (D-01, D-14, naming, keys, timestamps, CHECK states, FKs,
`is_synthetic`).

## 4. Entity relationship overview

Unchanged (identical to v1.0 §4).

## 5. Entities and attributes

### 5.1 `profiles`

Unchanged from v1.0 (role CHECK, column grant `display_name`,
role-freeze trigger, backend-only role assignment, active-user rule O-08).

### 5.2 Reference data

Schema unchanged. **EX-07 (v1.1):** values remain `[CONFIRM]` generic
placeholders (not official school names, no institutional approval claimed);
placeholder values may be seeded **only on the local development stack**;
shared (preview/production) environments get reference rows **only after
institutional O-01 confirmation**. Reference rows are controlled
configuration, not synthetic fixtures.

### 5.3 `reports` — [v1.1: EX-02, EX-03]

Columns, CHECKs, and indexes unchanged from v1.0.

**Backend-controlled writes (EX-02):**
- Creation, author correction, and withdrawal execute through backend
  Functions (`service_role`); `reporter_id` is always derived from the
  caller's JWT — a client cannot supply or override it (D-03 preserved).
- Clients have **no direct INSERT, UPDATE, or DELETE** on `reports`
  (RLS has no write policies for clients; §8).

**Field editability (EX-03):** while `status = 'submitted'` an author may
edit only:
`description`, `category_id`, `location_id`, `occurred_at`,
`claimed_severity`, `is_anonymous`, `latitude`, `longitude`.
Never author-editable: `reporter_id`, `status`, `is_synthetic`,
`created_at`, `updated_at`. Withdrawal is a backend status transition
(report.withdrawn), not a field edit; any edit attempt after `submitted`
is rejected.

### 5.4 Incident correlation

Unchanged from v1.0 (incidents incl. community fields; incident_reports;
indexes).

### 5.5 Multi-criteria risk assessment — [v1.1: EX-06]

Schema unchanged (assessments, scores, partial unique `is_current`,
deferred criteria content O-02).

**Complete threshold configuration requirement (EX-06):**
- `risk_assessments` writes (insert or `is_current` replacement) are
  **rejected unless `risk_thresholds` contains the complete four-band
  configuration** (low, moderate, high, critical with valid ranges).
- The guard is enforced in the backend path and mirrored as a database
  check; `risk_level` remains NOT NULL — **no provisional risk levels**
  are ever stored; classification only ever reflects approved methodology.

### 5.6 Notifications, recipients, acknowledgments — [v1.1: EX-01]

Schema unchanged from v1.0 (including `sent_by`, CHECKs, reapproval rule
O-04, in-app-only O-06).

**Member read authorization (EX-01):**
- Members may read notification content **only** where
  `id IN (SELECT notification_id FROM notification_recipients WHERE
  recipient_id = auth.uid() AND delivered_at IS NOT NULL)
  AND status = 'sent'` — drafts, `pending_approval`, `approved` (not yet
  sent), and `rejected` content is never readable by members; undelivered
  deliveries are not accessible.
- `notification_recipients` rows are visible to the recipient **only after
  `delivered_at` is set** — pending expansions cannot be enumerated.
- Administrator paths unchanged. Backend endpoint may serve delivered
  content; the RLS predicates are the database backstop.

**Availability, viewing, and acknowledgment semantics (EX-01
clarification, authorized 2026-10-04):**
- **Availability:** `notification_recipients.delivered_at` records when the
  notification becomes available to its authorized recipient. Member
  content access requires all three: recipient membership, `status =
  'sent'`, and delivery availability (`delivered_at IS NOT NULL`).
  Availability does **not** establish that the recipient viewed or
  acknowledged the notification.
- **Viewing:** `notification_acknowledgments.read_at` records the actual
  viewing event. Viewing is recorded separately from availability and must
  **never automatically imply acknowledgment**.
- **Acknowledgment:** `notification_acknowledgments.acknowledged_at`
  records an **explicit** acknowledgment action. Acknowledgment is never
  inferred from delivery or viewing alone.
- **No epistemic claim:** a database timestamp proves a message became
  available or was opened — it **never proves that a person understood the
  message**. Interface, report, and analytic language must respect this
  limit.
- **Still distinct (unchanged):** notification `status` (workflow state)
  and recipient `delivered_at` (per-recipient availability) are separate
  columns and separate concepts; acknowledgment rows remain bound to the
  exact recipient row (`notification_acknowledgments.recipient_row_id`,
  unique FK) which in turn binds the notification — preserving
  recipient+notification association. Approval, sending, audit, and RLS
  requirements are unchanged by this clarification.

### 5.7 `audit_logs`

Unchanged schema. **EX-02 adds audited events:** `report.created`,
`report.updated` (author edit), `report.withdrawn` (§9).

### 5.8 Deferred

Unchanged (attachments/Storage deferred, D-04).

## 6. Supabase Auth identity relationship

Unchanged (1:1 profiles/auth.users, backend upsert, JWT roles, C-03).

## 7. Role-based access model

v1.0 matrix unchanged, with EX-02/EX-03/EX-01 reflected in the capability
wording:
- "Create report" → "Create report **via backend** (as self)".
- "Read/acknowledge own acknowledgment rows" unchanged; notification reads
  are **delivered-only** for members.
- All other rows (approval, execution per O-08, community feed O-09)
  unchanged.

## 8. Row Level Security policies — [v1.1: EX-01, EX-02, EX-03]

Baseline posture unchanged: RLS deny-by-default on every table, zero `anon`
policies, default grants revoked, column-level privileges, defense in depth.

**Amended policies (registered candidate text):**
| Table | Policy (v1.1 candidate) |
|---|---|
| `profiles` | Unchanged (select own; update own `display_name` via column grant; role-freeze trigger; backend role assignment). |
| `report_categories`, `locations` | Unchanged (SELECT authenticated; writes service_role). |
| `risk_criteria`, `risk_thresholds` | Unchanged (SELECT officer/administrator; writes service_role). |
| `reports` | **EX-02:** SELECT own rows only; **no client INSERT/UPDATE/DELETE policies** — all writes via backend. **EX-03:** backend enforces editable allowlist; RLS reflects no author-write. |
| `incidents`, `incident_reports` | Unchanged (officer/administrator; members via server feed; no client DELETE). |
| `risk_assessments`, `risk_assessment_scores` | Unchanged + **EX-06 guard** mirrors config requirement. |
| `notifications` | **EX-01:** SELECT `created_by = auth.uid()` OR administrator **OR member predicate (sent + recipient membership + delivered availability)**; INSERT officer/administrator `status='draft'`; UPDATE administrator transitions / draft edits (reapproval server-side). |
| `notification_recipients` | **EX-01:** SELECT `recipient_id = auth.uid() AND delivered_at IS NOT NULL` OR administrator; INSERT/UPDATE service_role only. |
| `notification_acknowledgments` | Unchanged (SELECT own/admin; writes service_role). |
| `audit_logs` | Unchanged (no client policies; service_role INSERT; append-only). |

## 9. Audit logging requirements — [v1.1: EX-02]

v1.0 mechanism unchanged (backend-written, append-only trigger, RLS
deny-all, privilege restrictions, owner-level limitation, controlled admin
access, 4-step authorized retention). **Audited events now include**
`report.created`, `report.updated`, `report.withdrawn` so the reporting
lifecycle is fully covered "by construction".

## 10. Data privacy and retention

### 10.1 Privacy rules and community-feed allowlist — unchanged (O-09)
Allowlist and exclusions exactly as v1.0 (UUID = identifier, not
credential; server-side generalization).

### 10.2 Retention policy — unchanged (O-03)
Pending institutional approval; no permanent deletion in v1 without
approved policy + authorization; retention policy doc required before real
personal data.

### 10.3 Data residency gate — unchanged (D-12)
Tokyo region; privacy/data-residency review before any real personal data.

### 10.4 Environment boundaries — [v1.1: EX-05]
- **Local development:** Supabase CLI local stack — fully isolated;
  placeholders and fixtures permitted.
- **Preview + production:** share one Supabase project; acceptable
  **only while data is synthetic** (`is_synthetic` guarantees).
- **Real-data phase:** `[HUMAN DECISION REQUIRED]` — separate production
  project vs disabled preview vs accepted residual risk must be decided
  before the privacy/data-residency review and before any real personal
  data.

## 11. Synthetic data strategy — [v1.1: EX-09]

v1.0 strategy unchanged (deterministic fixtures, `.invalid` emails,
explicit indicators, idempotent, never production-unprompted) plus:
- **Local-stack provisioning only** for synthetic auth users (EX-09):
  dedicated script, credentials supplied at runtime, never stored/committed,
  deterministic, idempotent, throwaway passwords verified and discarded.
- Shared-environment synthetic provisioning requires a **separate human
  decision** on the credential mechanism.
- Local-only placeholder reference data (EX-07).

## 12. Server authorization boundary — [v1.1: EX-01, EX-02]

v1.0 table unchanged, with additions:
| Transition | Server-side enforcement |
|---|---|
| Report create/correct/withdraw | Backend (EX-02): JWT-derived reporter, allowlist (EX-03), audit events |
| Notification member reads | Backend endpoint optional; RLS delivered-only predicate (EX-01) |
| Risk assessment writes | Backend + DB guard: complete thresholds required (EX-06) |

Client-direct operations (narrowed): sign-in; reads of own
profile/reports/delivered notifications/ack rows; ack requests; community
feed endpoint. **No client writes to reports** (EX-02).

## 13. Feature traceability

Unchanged table + additions: backend-write reporting (EX-02),
delivered-only member notifications (EX-01), threshold-guarded risk
(EX-06).

## 14. Conflicts with Supabase Auth and PostgreSQL behavior

C-01…C-07 unchanged. C-02 note reinforced by EX-02/EX-03 (with no client
UPDATE policies, escalation surface on reports is removed).

## 15. Proposed migration sequence

Unchanged eight stages (M1–M8) referencing the v1.1 candidate once
approved; applies per plan v0.3.

## 16. Technical review verification

V-01…V-07 unchanged; additions: EX-01/EX-02/EX-03/EX-06 verification
requirements are recorded in the change log and plan test matrices
(T-01…T-06).

## 17. Consistency check

Same checks as v1.0 (AGENTS.md stack/security/phase rules; one-school
scope; docs conventions) — all satisfied; candidate does not alter stack,
security rules, or scope.

## 18. Deferred requirements

v1.0 §18 table preserved (O-01 values, O-02 risk content, O-03 retention,
D-04 attachments, O-06 channels, D-14 soft-delete, D-05 anon visibility,
D-12 real data, migrations/deployment) plus v1.1 deferreds: EX-04 tooling
decision (conditional), EX-05 real-data topology, EX-07 confirmation,
EX-08 architecture content, EX-09 shared provisioning mechanism.

## 19. Legislation/document history placeholder — v1.0 history retained;
v1.1 candidate added:

| Version | Status |
|---|---|
| v1.0 | Approved Design Baseline (2026-10-04) |
| **v1.1 (candidate)** | Consolidates EX-01…EX-09 — **pending human approval** |
