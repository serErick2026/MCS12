# Document 04 — Database Design Specification (ARCHIVED Version 1.0)

**Status:** **ARCHIVED — superseded by Version 1.1 (APPROVED DESIGN
BASELINE, 2026-10-04).** Retained **verbatim** as the historical Version 1.0
baseline. Do not treat this archived document as authoritative; the current
baseline is `docs/database-design.md` (Version 1.1).

**Provenance:** derived from `docs/database-design-proposed.md`
(v0.1 → v0.2 → v0.3), which is retained unchanged as the historical
proposal.

**Branch:** `feature/database-schema`

## 0. Approval record and authorization limits

### 0.1 Approval decisions
| ID | Disposition |
|---|---|
| O-08 | A **designated safety_officer** = an active user holding the `safety_officer` role, authorized by backend checks to execute an already administrator-approved notification. Approval identity (`approved_by`) and execution identity (`sent_by`) remain separate. |
| O-09 | The **seven-field community feed allowlist is approved.** Location generalization must be determined server-side; sensitive locations, exact coordinates, and potentially identifying details must never be exposed. Public UUID references are identifiers, not access credentials. |
| O-10 | **Database design baseline approved** (v1.0), with all explicitly deferred requirements preserved as deferred (§19). |

Prior dispositions D-01…D-14 (v0.2) and O-01…O-07 (v0.3) remain binding and
are incorporated in the sections below.

### 0.2 What this approval does NOT authorize (binding)
This document is a **design baseline only**. It does **not** authorize:
- creating or applying SQL migrations — each migration requires separate
  human approval (AGENTS.md; git-workflow §6);
- any modification of the live Supabase database;
- deployment of anything, or merging/pushing branches;
- **collecting, entering, or introducing real personal data of any kind** —
  the prototype remains synthetic-only until the privacy/data-residency
  review (§10.3) passes and the separate data-retention policy (O-03) is
  approved;
- starting any application module (roadmap approval still required).

## 1. Purpose and scope

Approved PostgreSQL schema design (Supabase) for the **one-school research
prototype** (single site, no multi-school/tenant modeling — scope
preserved): community-driven hazard/incident reporting, incident
correlation, multi-criteria risk assessment, approval-gated notifications,
acknowledgment tracking, and audit logging — with Row Level Security on
every table.

**Applied dispositions (complete list):**

| ID | Disposition (applied in) |
|---|---|
| D-01 | `text` + `CHECK` constraints, not PG enums (§3) |
| D-02 | Four roles retained; least-privilege model + role self-escalation blocked (§7, §8, §16 V-05) |
| D-03 | Reporting requires authentication; no public anonymous inserts (§5.3, §8) |
| D-04 | Attachments/Storage deferred from v1 (§5.8) |
| D-05 | `anon` denied on every application table (§8, §16 V-06) |
| D-06 | Administrator approval required for all notifications in v1 (§5.6, §7) |
| D-07 | Members receive only allowlisted, sanitized, server-delivered community data (§5.4, §7, §8, §10.1, §12) |
| D-08 / O-02 | Criteria, weights, scales, thresholds deferred to risk-module methodology (§5.2, §5.5) |
| D-09 / O-01 | Reference values proposed with `[CONFIRM]` markers retained — generic placeholders, not official school names, no institutional approval claimed (§5.2) |
| D-10 | Audit events from trusted backend operations; append-only safeguards with documented owner-level limits (§9) |
| D-11 / O-03 | No permanent deletion in v1 without approved policy + authorization; retention periods pending institutional approval; separate data-retention policy required before real personal data (§10.2) |
| D-12 | Tokyo region documented; privacy/data-residency review required before real personal data (§10.3) |
| D-13 | Deterministic synthetic fixtures, `.invalid` domains, explicit indicators (§11, §16 V-07) |
| D-14 | No soft-delete columns in v1 (§3) |
| O-04 | Administrator or designated safety_officer may execute an approved notification; approval identity preserved; executor recorded separately; substantive message change invalidates approval (§5.6, §7, §8) |
| O-05 / **O-09** | Community feed = approved seven-field allowlist with named exclusions; server-side generalization; UUIDs are identifiers, not credentials (§10.1) |
| O-06 | In-app notifications only in v1; SMS/email/external messaging deferred (§5.6) |
| O-07 | Resolved by this approval: this file is now the approved baseline; the proposal file remains historical |
| **O-08** | Designated safety_officer defined as active holder of the role with backend authorization (§7) |

## 2. Design principles and constraints

- **One-school prototype:** no school/tenant table.
- **RLS mandatory and deny-by-default** on every table; policies enforce
  data rules at the database — the frontend is never the enforcement layer.
- **Sensitive data access is server-authorized:** approval, send,
  acknowledgment, audit, and all state transitions run in Pages Functions
  with `service_role` (§12, §16).
- **`anon` may never read or write application tables** (D-05); the anon key
  in the client bundle is protected only by RLS + privileges.
- **Supabase Auth only** for identity; no credentials in tables.
- **Free tier only**; extensions limited to Supabase defaults (`pgcrypto`).
- **Synthetic data only** until privacy review passes (D-12/D-13, §10.3).
- **Approval of this document does not authorize migrations or data
  collection** (§0.2).

## 3. Conventions (D-01, D-14)

- Tables: plural `snake_case`; columns: `snake_case`.
- PKs: `uuid` default `gen_random_uuid()`; append-only `audit_logs` uses
  `bigint generated always as identity`.
- Timestamps: `timestamptz` (UTC); `created_at`/`updated_at` maintained by
  trigger; school-local rendering is an application concern.
- State fields: **`text` + `CHECK` constraints** (D-01).
- **No soft-delete columns in v1** (D-14); deletion only under an approved
  policy (§10.2).
- `ON DELETE`: `CASCADE` for owned children; `RESTRICT` for reference data
  and accountability references (`reporter_id`, `assessor_id`,
  `approved_by`, `sent_by`); `SET NULL` for non-critical actor references
  (`opened_by`, `linked_by`).
- `is_synthetic` boolean on data-bearing tables — explicit synthetic
  indicator.

## 4. Entity relationship overview

```mermaid
erDiagram
    profiles ||--|| auth_users : "1:1 with auth.users"
    profiles ||--o{ reports : reports
    profiles ||--o{ incidents : reviews
    profiles ||--o{ notifications : creates
    profiles ||--o{ risk_assessments : assesses
    report_categories ||--o{ reports : classifies
    locations ||--o{ reports : locates
    report_categories ||--o{ incidents : classifies
    locations ||--o{ incidents : locates
    incidents ||--o{ incident_reports : links
    reports ||--o{ incident_reports : linked_to
    incidents ||--o{ risk_assessments : assessed_by
    risk_assessments ||--o{ risk_assessment_scores : contains
    risk_criteria ||--o{ risk_assessment_scores : scores
    incidents ||--o{ notifications : triggers
    notifications ||--o{ notification_recipients : targets
    notification_recipients ||--o| notification_acknowledgments : acknowledged_by
    profiles ||--o{ audit_logs : actions
```

## 5. Entities and attributes

### 5.1 `profiles` — application identity (1:1 with `auth.users`)
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK, references `auth.users(id)` ON DELETE CASCADE |
| `role` | text | NOT NULL DEFAULT 'member', CHECK IN ('administrator','safety_officer','member','viewer') (D-02) |
| `display_name` | text | NOT NULL, 1–60 chars (pseudonymous allowed) |
| `is_active` | boolean | NOT NULL DEFAULT true |
| `is_synthetic` | boolean | NOT NULL DEFAULT false |
| `created_at`/`updated_at` | timestamptz | NOT NULL DEFAULT now() |

**Role self-escalation prevention (D-02):** (1) column-level privileges —
`REVOKE ALL … FROM anon, authenticated; GRANT SELECT, UPDATE(display_name)
ON profiles TO authenticated`; clients physically cannot write `role` or
`is_active`; (2) `BEFORE UPDATE` trigger raising an exception when
`role`/`is_active` changes unless the request JWT role is `service_role`.
Role assignment happens only in backend Functions (§16 V-05).
**Active-user rule (O-08):** backend capability checks verify both the role
and `is_active = true` before privileged actions such as notification
execution.

### 5.2 Reference data (controlled configuration)

**Schema:**
- **`report_categories`** — `id` uuid PK; `code` text UNIQUE NOT NULL; `name`
  text NOT NULL; `description` text; `sort_order` int; `is_active` boolean
  DEFAULT true; timestamps.
- **`locations`** — `id` uuid PK; `code` text UNIQUE; `name` text NOT NULL;
  `zone` text; `latitude`/`longitude` numeric(9,6) NULL; `is_active` boolean;
  timestamps. Intra-school places only.
- **`risk_criteria`** — `id` uuid PK; `code` text UNIQUE; `name` text;
  `weight` numeric(5,3) CHECK (`weight` > 0); `scale_min` smallint DEFAULT 1;
  `scale_max` smallint DEFAULT 5; `description` text; `is_active` boolean;
  timestamps. **Content deferred (D-08/O-02).**
- **`risk_thresholds`** — `id` uuid PK; `level` text CHECK IN ('low',
  'moderate','high','critical') UNIQUE; `min_score`/`max_score` numeric(7,3)
  CHECK (`min_score` <= `max_score`); `action_hint` text.
  **Values deferred (D-08/O-02).**

**Reference values — [CONFIRM] markers retained (O-01).** These are generic
placeholders only; they are **not official school location names**, and no
institutional approval is claimed or implied. Final values require
confirmation by the researcher/school before seed data is used beyond
development.

`report_categories` — all rows **[CONFIRM]**:

| code | name | description |
|---|---|---|
| FIRE | Fire / Smoke | Fire or smoke observed on school grounds |
| FLOOD | Flood / Water Hazard | Flooding, standing water, or major leakage |
| STRUCT | Structural Damage | Cracks, collapse risk, damaged fixtures |
| HEALTH | Health / Medical Hazard | Illness cluster, sanitation, medical incident |
| SEC | Security / Safety Concern | Unauthorized entry, fight, unsafe behavior |
| ENV | Environmental Hazard | Chemical spill, odor, air quality, pests |
| OTHER | Other Hazard | Not covered above; classified on review |

`locations` — generic placeholders, all rows **[CONFIRM]**:

| code | name |
|---|---|
| MAIN-GATE | Main Gate |
| SIDE-GATE | Side Gate |
| BLOCK-A | Classroom Block A |
| BLOCK-B | Classroom Block B |
| GYM | Covered Court / Gymnasium |
| LAB | Science Laboratory |
| LIB | Library |
| CANTEEN | Canteen |
| CLINIC | Clinic |
| GROUNDS | Open Grounds |

Reference rows are controlled configuration (migration/seed), distinct from
synthetic test fixtures (§11); no `is_synthetic` flag on reference data.

### 5.3 `reports` — community hazard/incident reports
| Column | Type | Constraints |
|---|---|---|
| `id` | uuid | PK DEFAULT gen_random_uuid() |
| `reporter_id` | uuid | FK → profiles(id) ON DELETE RESTRICT, NOT NULL |
| `category_id` | uuid | FK → report_categories(id) RESTRICT, NOT NULL |
| `location_id` | uuid | FK → locations(id) SET NULL, NULL allowed |
| `occurred_at` | timestamptz | NOT NULL, CHECK (≤ now() + 5 min) |
| `description` | text | NOT NULL, CHECK 10–2000 chars |
| `claimed_severity` | smallint | NULL, CHECK 1–5 |
| `status` | text | NOT NULL DEFAULT 'submitted', CHECK IN ('submitted','under_review','linked','dismissed','resolved','withdrawn') |
| `latitude`/`longitude` | numeric(9,6) | NULL |
| `is_anonymous` | boolean | DEFAULT false — display-hiding only; identity always stored |
| `is_synthetic` | boolean | DEFAULT false |
| `created_at`/`updated_at` | timestamptz | NOT NULL DEFAULT now() |

**D-03:** creation requires authentication; `reporter_id` always equals the
authenticated `auth.uid()`; no anonymous submission path exists. Only
`submitted` rows may be corrected/withdrawn by their author (backend rules +
RLS).

Indexes: `(status, created_at DESC)`, `(category_id)`, `(location_id)`,
`(reporter_id, created_at DESC)`, `(occurred_at)`.

### 5.4 Incident correlation
- **`incidents`** — `id` uuid PK (serves as the public incident reference in
  community output; per O-09 a UUID is an identifier, not an access
  credential); `title` text NOT NULL (1–120) *internal*; `category_id` FK
  RESTRICT; `location_id` FK SET NULL; `status` text NOT NULL DEFAULT 'open'
  CHECK IN ('open','investigating','contained','closed','invalid');
  `severity` smallint NULL CHECK 1–5 *internal*;
  `first_reported_at`/`last_reported_at` timestamptz NOT NULL; `opened_by`
  FK → profiles SET NULL; `closed_at` timestamptz NULL; `summary` text
  *internal, officer-facing*; **community publication fields (O-05/O-09):**
  `community_summary` text NULL, `community_guidance` text NULL,
  `is_community_visible` boolean NOT NULL DEFAULT false,
  `community_published_at` timestamptz NULL, `community_updated_at`
  timestamptz NULL — written only by administrator/safety_officer via
  backend; `is_synthetic` boolean; timestamps. Indexes:
  `(status, created_at DESC)`, `(location_id)`, `(category_id)`,
  `(is_community_visible) WHERE is_community_visible`.
- **`incident_reports`** — `id` uuid PK; `incident_id` FK CASCADE NOT NULL;
  `report_id` FK CASCADE NOT NULL UNIQUE (report joins ≤ 1 incident);
  `link_method` text CHECK IN ('manual','auto') NOT NULL; `link_confidence`
  numeric(4,3) NULL CHECK 0–1; `linked_by` FK → profiles SET NULL;
  `linked_at` timestamptz NOT NULL DEFAULT now(). Index: `(incident_id)`.

### 5.5 Multi-criteria risk assessment (content deferred — D-08/O-02)
- **`risk_assessments`** — `id` uuid PK; `incident_id` FK CASCADE NOT NULL;
  `assessor_id` FK → profiles RESTRICT NOT NULL; `method` text NOT NULL
  DEFAULT 'multi_criteria_v1'; `overall_score` numeric(7,3) NOT NULL CHECK ≥
  0; `risk_level` text NOT NULL CHECK IN ('low','moderate','high','critical');
  `is_current` boolean NOT NULL DEFAULT true with partial UNIQUE index on
  `(incident_id) WHERE is_current`; `rationale` text; `assessed_at`
  timestamptz NOT NULL DEFAULT now(); timestamps.
- **`risk_assessment_scores`** — `id` uuid PK; `assessment_id` FK CASCADE NOT
  NULL; `criterion_id` FK → risk_criteria RESTRICT NOT NULL; `score`
  numeric(6,3) NOT NULL; `weighted_score` numeric(7,3); UNIQUE
  `(assessment_id, criterion_id)`.

Criterion codes, weights, scales, and threshold bands arrive with the
approved risk methodology (O-02); internal risk scores are never part of
community output (§10.1).

### 5.6 Notifications — approval (D-06), execution (O-04/O-08), acknowledgment
- **`notifications`** — `id` uuid PK; `incident_id` FK → incidents SET NULL
  NULL; `type` text NOT NULL CHECK IN ('incident_update','risk_alert',
  'system'); `title` text NOT NULL (1–120); `body` text NOT NULL (1–2000);
  `target_mode` text NOT NULL DEFAULT 'role' CHECK IN ('role','all_members');
  `target_role` text NULL CHECK IN role set; `status` text NOT NULL DEFAULT
  'draft' CHECK IN ('draft','pending_approval','approved','rejected','sent',
  'cancelled'); `requires_approval` boolean NOT NULL DEFAULT true — every
  notification requires administrator approval in v1 (D-06); `created_by` FK
  → profiles RESTRICT NOT NULL; `approved_by` FK → profiles RESTRICT NULL
  (approval identity preserved, O-04); `approved_at` timestamptz;
  `rejection_reason` text; `sent_by` FK → profiles RESTRICT NULL (executor
  recorded separately, O-04); `sent_at` timestamptz; `is_synthetic`
  boolean; timestamps.
  CHECKs: `'approved'` ⇒ `approved_by` + `approved_at` NOT NULL;
  `'rejected'` ⇒ `rejection_reason` NOT NULL;
  `'sent'` ⇒ `approved_by` + `approved_at` + `sent_by` + `sent_at` NOT NULL.
  **Reapproval rule (O-04):** while `status = 'approved'`, any substantive
  change to `title`, `body`, `type`, `target_mode`, or `target_role` resets
  `status` to `'pending_approval'`, clears approval fields, and writes a
  `notification.approval_invalidated` audit row. After `sent`, message
  fields are immutable — revised content requires a new notification.
  **Channels (O-06): v1 is in-app only** — SMS/email/external messaging
  deferred.
  Indexes: `(status, created_at DESC)`, `(incident_id)`, `(created_by)`.
- **`notification_recipients`** — `id` uuid PK; `notification_id` FK CASCADE
  NOT NULL; `recipient_id` FK → profiles CASCADE NOT NULL; `delivered_at`
  timestamptz NULL; UNIQUE `(notification_id, recipient_id)`. Expansion is
  a backend operation at approval/send time.
- **`notification_acknowledgments`** — `id` uuid PK; `recipient_row_id` uuid
  FK → notification_recipients CASCADE NOT NULL UNIQUE; `read_at` timestamptz
  NULL; `acknowledged_at` timestamptz NULL; `note` text NULL (≤200 chars).
  Writes server-side only (§8/§12); clients read their own rows.

### 5.7 `audit_logs` — append-only (D-10)
| Column | Type | Constraints |
|---|---|---|
| `id` | bigint | PK GENERATED ALWAYS AS IDENTITY |
| `actor_id` | uuid | FK → profiles SET NULL; NULL = system/service_role |
| `action` | text | NOT NULL (e.g. `report.status_changed`, `notification.approved`, `notification.approval_invalidated`, `notification.executed`, `notification.acknowledged`, `profile.role_changed`) |
| `table_name` | text | NOT NULL |
| `record_id` | text | NOT NULL (uuid as text) |
| `old_data`/`new_data` | jsonb | NULL — sanitized values, never secrets |
| `request_id` | text | NULL — Pages Function correlation id |
| `created_at` | timestamptz | NOT NULL DEFAULT now() |

Indexes: `(table_name, record_id, created_at DESC)`,
`(actor_id, created_at DESC)`. Safeguards and limits: §9.

### 5.8 Deferred (D-04)
`report_attachments` and all Supabase Storage usage are deferred from v1.

## 6. Supabase Auth identity relationship

- `auth.users` ←1:1→ `profiles.id` FK with CASCADE.
- Sign-up/sign-in via Supabase Auth only; credentials never copied into
  application tables.
- Backend Function (service_role) upserts `profiles` on first sign-in with
  default role `member`, checking `is_active`.
- JWT roles used by RLS: `anon`, `authenticated`, `service_role` — `anon`
  matches zero policies (D-05, V-06).
- Account-deletion interaction: conflict C-03 (§14).

## 7. Role-based access model — least privilege (D-02, D-06, D-07, O-04, O-08)

**Principle:** minimum capability per role; every sensitive operation runs
server-side (§12) after the backend verifies the caller's JWT role **and
active status** (O-08).

| Capability | administrator | safety_officer | member | viewer | anon |
|---|---|---|---|---|---|
| Read own profile; update own `display_name` | ✔ | ✔ | ✔ | ✔ | ✖ |
| Assign roles / activate-deactivate users | ✔ (backend) | ✖ | ✖ | ✖ | ✖ |
| Create report (as self) | ✔ | ✔ | ✔ | ✖ | ✖ |
| Read own reports; correct/withdraw while `submitted` | ✔ (own) | ✔ (own) | ✔ (own) | ✖ | ✖ |
| Read all reports / report status transitions | ✔ (backend) | ✔ (backend) | ✖ | ✖ | ✖ |
| Create/link/close incidents; write community fields | ✔ (backend) | ✔ (backend) | ✖ | ✖ | ✖ |
| Risk assessment create/replace `is_current` | ✔ (backend) | ✔ (backend) | ✖ | ✖ | ✖ |
| Create notification draft | ✔ | ✔ | ✖ | ✖ | ✖ |
| Approve/reject notification | ✔ (backend) | ✖ (D-06) | ✖ | ✖ | ✖ |
| Execute (send) an already-approved notification | ✔ (backend) | ✔ (backend), active holder of role per O-08 | ✖ | ✖ | ✖ |
| Read notifications delivered to them | ✔ | ✔ | ✔ | ✖ | ✖ |
| Read own acknowledgment rows; request ack via server | ✔ | ✔ | ✔ | ✖ | ✖ |
| Read sanitized community feed (allowlist, server endpoint) | ✔ | ✔ | ✔ (O-09) | ✔ (O-09) | ✖ (D-05) |
| Read reference data (category/location names) | ✔ | ✔ | ✔ (form) | ✔ | ✖ |
| Read risk criteria/thresholds | ✔ | ✔ | ✖ | ✖ | ✖ |
| Read audit logs | ✔ (backend) | ✖ | ✖ | ✖ | ✖ |

Approval identity (`approved_by`) and execution identity (`sent_by`) are
stored separately; the same person may hold both, but the audit trail
distinguishes the acts.

## 8. Row Level Security policies

Every table: `ENABLE ROW LEVEL SECURITY`, deny-by-default. All policies are
explicitly `TO authenticated` — **no policy exists for `anon` on any table
(D-05, V-06)**; Supabase's default schema-wide grants are revoked (C-01).
Policies are the database-level backstop; primary enforcement of sensitive
transitions is server-side (§12, V-04).

| Table | Policies |
|---|---|
| `profiles` | SELECT own row only. UPDATE own row, column grant `display_name` only + role-freeze trigger (D-02). INSERT/DELETE: service_role only. |
| `report_categories`, `locations` | SELECT `authenticated`. Write: service_role only. |
| `risk_criteria`, `risk_thresholds` | SELECT safety_officer/administrator only. Write: service_role only. |
| `reports` | INSERT `authenticated` AND `reporter_id = auth.uid()` (D-03). SELECT own rows (officers read others via backend). UPDATE own rows while `status='submitted'`, allowed columns only. DELETE: none. |
| `incidents`, `incident_reports` | SELECT officer/administrator (members: server feed only, D-07/O-09). INSERT/UPDATE officer/administrator (backend is primary path). DELETE: none. |
| `risk_assessments`, `risk_assessment_scores` | SELECT officer/administrator. INSERT/UPDATE officer/administrator with `assessor_id = auth.uid()` for non-admins. DELETE: none. |
| `notifications` | SELECT `created_by = auth.uid()` OR administrator (members read via recipient rows). INSERT officer/administrator with `created_by = auth.uid()`, `status='draft'`. UPDATE: administrator approval transitions with `approved_by = auth.uid()` (D-06); creators edit own drafts only while `status='draft'`; reapproval invalidation handled server-side. |
| `notification_recipients` | SELECT `recipient_id = auth.uid()` OR administrator. INSERT/UPDATE: service_role only. |
| `notification_acknowledgments` | SELECT own (via recipient join) OR administrator. INSERT/UPDATE: service_role only (acknowledgment transitions are server-side, V-04). |
| `audit_logs` | No policies ⇒ RLS deny-all for `anon`/`authenticated`; INSERT by service_role only, privileges additionally restricted (§9). |

Column-level privileges: clients hold `UPDATE` only on
`profiles.display_name` and `reports` (non-privileged fields while
`submitted`). State columns (`status`, `role`, `is_active`,
approval/execution fields, community fields) are backend-writable only.
REVOKE + policies at both layers (defense in depth).

## 9. Audit logging requirements and limits (D-10; review items V-01…V-03)

- **Mechanism:** audit rows are written by trusted backend operations (Pages
  Functions using `service_role`). Every state transition is routed through
  the backend (§12), so transition coverage is complete by construction. No
  client code path writes audit rows.
- **Audited events (minimum):** report status transitions; incident
  create/link/close and community publication; risk assessment create and
  `is_current` swaps; notification draft→pending→approved/rejected; approval
  invalidation; execution (`sent_by`); recipient expansion; acknowledgments;
  profile role/activation changes; reference-data changes; any retention
  purge.
- **Append-only protections:** `BEFORE UPDATE OR DELETE` trigger raises an
  exception for every role including `service_role` (triggers fire
  regardless of RLS bypass); RLS deny-all for `anon`/`authenticated`;
  `REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM anon, authenticated,
  service_role` (INSERT retained for `service_role` only).
- **Explicit limitation:** these protections constrain application roles,
  **not privileged database owners.** The database owner/superuser
  (`postgres`), Supabase Studio/SQL Editor access, or anyone able to drop
  triggers or alter privileges can still modify records. Append-only is an
  application-level guarantee plus governance, not an owner-proof chain of
  custody.
- **Controlled administrative access:** Supabase Studio, SQL Editor, and
  the service_role key are restricted to designated project administrators;
  the service_role key exists only in backend secrets (AGENTS.md); schema
  changes occur only through separately approved, reviewed migrations.
- **Authorized retention procedure:** purge runs only after (1) an approved
  data-retention policy exists, (2) explicit human authorization, (3) a
  reviewed migration/script temporarily restoring privileges, (4) an audit
  entry recording the purge. No purge exists in v1 (O-03).
- **Content rules:** sanitized snapshots and identifiers only — never
  passwords, tokens, JWTs, or service keys; `request_id` links rows to
  Pages Function invocations.

## 10. Data privacy and retention (D-11/O-03, D-12, O-05/O-09)

### 10.1 Privacy rules and the approved community-feed allowlist (O-09)
- No learner PII; reports must not name learners/staff beyond the reporter's
  own account; `display_name` may be pseudonymous; members never read other
  profiles.
- **APPROVED allowlist** (server endpoint only, only when
  `is_community_visible = true`):
  1. **Public incident reference** — `incidents.id` (opaque UUID — an
     identifier, **not an access credential**, O-09)
  2. **Hazard category** — category `name` (and `code`)
  3. **Approved community summary** — `community_summary`
  4. **Generalized location when safe** — coarse `name`/`zone`;
     **generalization determined server-side**; sensitive locations, exact
     coordinates, and potentially identifying details must never be exposed
  5. **Public incident status** — `status`
  6. **Approved safety guidance** — `community_guidance`
  7. **Publication and update timestamps** — `community_published_at`,
     `community_updated_at`
- **Explicit exclusions:** reporter identity (including de-anonymized
  mapping), report `description`, internal notes/summaries/rationales,
  exact or sensitive location coordinates, internal risk scores/levels/
  criteria (`risk_*` excluded entirely), internal actor identities
  (`opened_by`/`linked_by`/`approved_by`/`sent_by`), and audit data.

### 10.2 Retention policy requirements (O-03 — pending institutional approval)
| Data | Draft proposal (PENDING — not approved) |
|---|---|
| Reports, incidents, assessments | Study period + 12 months → archive extract → authorized purge |
| Notifications + recipients/acks | 12 months after `sent_at` |
| `audit_logs` | 12 months (subject to §9 constraints) |
| Inactive profiles | Keep record, `is_active=false`; anonymize display fields after 12 months |

**Binding rules:** no permanent deletion of records in v1 without an approved
policy and explicit authorization; retention periods remain **pending
institutional approval**; a **separate data-retention policy
(`docs/data-retention-policy.md`) must be created and approved before any
real personal data is introduced** — and before any purge is ever executed.

### 10.3 Data residency gate (D-12)
- Supabase region: **Tokyo (`ap-northeast-1`)** — to be recorded in
  charter/consent materials.
- **Privacy/data-residency review required before any real personal data is
  introduced.** Synthetic-only until that review passes (§11, V-07); real
  learner/staff data remains out of scope for v1.

## 11. Synthetic data strategy (D-13 — V-07)

- Migrations = structure only; fixtures in `supabase/seed.sql`.
- **Deterministic:** fixed UUIDs (`00000000-0000-4000-8000-0000000000NN`)
  and fixed codes; idempotent (`ON CONFLICT DO NOTHING` on natural keys).
- Reserved `.invalid` emails (RFC 2606), e.g.
  `synthetic.member01@example.invalid`.
- Explicit indicators: `is_synthetic = true` on every seeded data row;
  `display_name` pattern `Synthetic <Role> NN`.
- Synthetic users provisioned via backend admin flow only; seeds never run
  against production without explicit approval.
- The prototype accepts synthetic data only until privacy/data-residency
  review passes (§10.3).

## 12. Server authorization boundary — server-side enforcement verification

RLS and column privileges are the database backstop; primary enforcement is
in Pages Functions (`service_role`), each verifying the caller's JWT role
(and active status, O-08) before acting (V-04):

| Transition | Server-side enforcement |
|---|---|
| Notification approval/rejection | Backend Function, administrator-only check → `approved_by`/`approved_at`; RLS mirror; CHECK constraint (§5.6) |
| Approval invalidation on substantive change (O-04) | Backend detects change, resets to `pending_approval`, clears approval fields, writes `notification.approval_invalidated` |
| Notification execution/send | Backend Function, administrator **or active** safety_officer (O-08) → sets `sent_by`/`sent_at`/`delivered_at`; CHECK forbids `sent` without prior approval |
| Acknowledgment | Backend Function, recipient-identity check → writes ack rows; clients read-only |
| Audit writes | Backend only; no client path; append-only guards (§9) |
| All other state transitions (report status, incident lifecycle, risk `is_current`, roles, reference/community fields) | Backend only (§7) |

Client-direct operations: sign-in, create own report, correct/withdraw own
`submitted` report, read own profile/reports/delivered notifications/ack
rows, read the allowlisted community feed via the server endpoint.

## 13. Feature traceability

| Feature | Tables |
|---|---|
| Incident correlation | `reports`, `incidents`, `incident_reports` |
| Multi-criteria risk assessment (content per O-02) | `risk_criteria`, `risk_assessments`, `risk_assessment_scores`, `risk_thresholds` |
| Notification approval (D-06) + execution identity (O-04/O-08) | `notifications` (`approved_by`/`approved_at` vs `sent_by`/`sent_at` + CHECKs) |
| In-app-only channels (O-06) | `notification_recipients`, `notification_acknowledgments` |
| Community allowlist feed (O-05/O-09) | `incidents` community columns + server endpoint |
| Audit (backend-written, append-only, D-10) | `audit_logs` |
| One-school scope | No tenant table; intra-school `locations` |

## 14. Conflicts with Supabase Auth and PostgreSQL behavior

- **C-01 — Supabase default grants:** `ALL` on `public` schema tables is
  granted to `anon`/`authenticated`. *Resolution:* explicit `REVOKE` +
  minimal `GRANT`s in every migration (V-06).
- **C-02 — RLS is row-level:** policies cannot block updating `role` on
  one's own row. *Resolution:* column grants + role-freeze trigger (V-05).
- **C-03 — Auth user deletion vs FK RESTRICT:** `profiles` cascade with
  `auth.users`, but accountability FKs (`reporter_id`, `assessor_id`,
  `approved_by`, `sent_by`) RESTRICT profile deletion — hard account
  deletion fails while such rows exist. *Resolution (v1):* deactivation
  only (`is_active=false`); hard deletion deferred until the approved
  retention policy (O-03) defines anonymization of accountability
  references.
- **C-04 — `service_role` bypasses RLS (V-01):** `service_role` carries
  BYPASSRLS semantics — it ignores every policy and row filter.
  Consequences, by design: (a) key never exposed to browsers; (b) Functions
  must perform explicit authorization checks — policies cannot protect
  against backend bugs; (c) RLS deny-all on `audit_logs` does not stop
  `service_role` inserts — which is exactly how audit writes occur;
  (d) the append-only trigger still fires for `service_role`;
  (e) owner/superuser limitations as stated in §9.
- **C-05 — `auth.uid()` is NULL for `service_role`:** uid-based policies
  grant the backend nothing — documented so future authors do not rely on
  `auth.uid()` in backend logic.
- **C-06 — anon key in browsers (approved exception):** any policy granted
  to `anon` would expose data publicly. *Resolution:* zero `anon` policies
  + repository test asserting none exist (V-06).
- **C-07 — verified compatible:** `gen_random_uuid()` (pgcrypto), partial
  unique indexes, `timestamptz`, jsonb, CHECK constraints, column-level
  grants, and trigger guards are supported by Supabase PostgreSQL.

## 15. Proposed migration sequence (future — NOT authorized by this approval)

1. `0001_identity.sql` — privilege baseline (C-01), `profiles`, guards, RLS
2. `0002_reference.sql` — reference tables, values `[CONFIRM]` (O-01) + RLS
3. `0003_reporting.sql` — `reports` + RLS
4. `0004_correlation.sql` — `incidents` (+ community columns), `incident_reports` + RLS
5. `0005_risk.sql` — assessment tables + RLS (content per O-02)
6. `0006_notifications.sql` — notifications (+ `sent_by`), recipients, acknowledgments + RLS
7. `0007_audit.sql` — `audit_logs`, append-only safeguards, deny-all RLS
8. `0008_fixtures.sql` — deterministic synthetic fixtures (D-13)

Each migration requires separate human approval before it is written and
before it is applied (AGENTS.md; git-workflow §6; §0.2 of this document).

## 16. Technical review verification

| # | Review item | Result |
|---|---|---|
| V-01 | service_role behavior / RLS bypass | Documented (C-04): bypasses policies; explicit backend checks required; triggers still apply |
| V-02 | Audit protections vs privileged owners | Documented (§9): owner/superuser can alter records; mitigated by controlled-access governance |
| V-03 | Controlled admin access + authorized retention | Documented (§9): restricted Studio/key access; 4-step purge authorization procedure |
| V-04 | Approval/send/ack/audit server-side | Verified (§12): all enforced in backend functions (+RLS mirrors, +CHECKs) |
| V-05 | No self role escalation | Verified (§5.1, §8, C-02): column grants + trigger + backend-only assignment |
| V-06 | No public anon access | Verified (§8, C-01, C-06): zero `anon` policies; default grants revoked; repo test planned |
| V-07 | Synthetic-only restriction preserved | Verified (§10.3, §11): synthetic-only until privacy review; seeds never run on production unprompted |

## 17. Approval consistency check (AGENTS.md and project scope)

- Approved stack only: Supabase PostgreSQL/Auth, Pages Functions backend,
  free tier, no new dependencies (AGENTS.md §1) ✓
- Security rules: no service_role in any file, no secrets in this document,
  RLS mandatory, synthetic data only, destructive operations
  authorization-gated, privileged operations backend-only (AGENTS.md §3) ✓
- Phase discipline: design approval ≠ module implementation; reporting/
  dashboard/correlation/risk/notification/analytics modules remain
  approval-gated (AGENTS.md §2; roadmap) ✓
- One-school charter scope preserved — no tenant/multi-school modeling ✓
- Approved documents slot honored: this file replaces the placeholder in
  `docs/database-design.md` as instructed; the historical proposal is
  preserved at `docs/database-design-proposed.md` ✓

## 18. Deferred requirements preserved (O-10)

The following remain **explicitly deferred** and are not part of the v1.0
baseline's implementable scope until separately approved:

| Item | Disposition | Awaiting |
|---|---|---|
| Hazard category + location values (all `[CONFIRM]`) | O-01 | Researcher/school confirmation |
| Risk criteria, weights, scales, thresholds | O-02/O-08(n/a) | Risk-module methodology |
| Retention periods + `docs/data-retention-policy.md` | O-03 | Institutional approval **before real personal data** |
| Attachments / Supabase Storage | D-04 | Later phase, separate approval |
| SMS/email/external notification channels | O-06 | Later phase, separate approval |
| Soft-delete columns | D-14 | Only with documented requirement |
| Public (`anon`) visibility of anything | D-05 | Remains denied unless re-decided |
| Real personal data of any kind | D-12 | Privacy/data-residency review + retention policy |
| SQL migrations and deployment | §0.2 | Separate explicit human authorization |

## 19. Document history

| Version | Date | Status |
|---|---|---|
| v0.1 | 2026-10-04 | Initial proposal (`docs/database-design-proposed.md`) |
| v0.2 | 2026-10-04 | D-01…D-14 dispositions incorporated |
| v0.3 | 2026-10-04 | O-01…O-07 dispositions + technical review |
| **v1.0** | **2026-10-04** | **APPROVED DESIGN BASELINE** (O-08, O-09, O-10) |
