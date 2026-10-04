# Database Design Amendments (PROPOSED)

**Status:** Draft — proposed 2026-10-04 for human review. **NOT APPROVED.**
These amendments, if approved, would extend `docs/database-design.md`
(Approved v1.0) via a future amendment vote; **the approved document is not
modified by this file.**

**Branch:** `feature/database-schema` · **Companion:**
`docs/database-migration-plan-v0.2-proposed.md`

## 0. Summary decision table

| ID | Issue | Resolution status | Needed approval | Blocks M? |
|---|---|---|---|---|
| A-01 | Member notification read path | Proposed (EX-01) | Human | M6 |
| A-02 | Report creation/modification audit | Proposed (EX-02) | Human | M3, M7 |
| A-03 | Author-editable report fields | Proposed (EX-03) | Human | M3 |
| A-04 | Migration tooling/verification | Proposed (EX-04) | Human (dev tooling) | M1+ apply |
| A-05 | Env isolation | Conditional (EX-05) | Human for real-data phase | none (synthetic phase) |
| A-06 | Risk with empty thresholds | Proposed (EX-06) | Human | M5 |
| A-07 | Pending reference values | Proposed (EX-07) | Institutional | M2 shared seeding |
| A-08 | Architecture doc gaps | Non-blocking (EX-08) | Institutional content | none |
| A-09 | Synthetic auth provisioning | Proposed (EX-09) | Human (credential process) | M8/G-5 |

`[HUMAN DECISION REQUIRED]` marks where existing approved documents do not
determine the answer and no safe resolution exists without instruction.

---

## A-01 — Notification recipient read authorization

**Existing design statement (v1.0 §5.6, §8):**
- `notification_recipients` SELECT policy: `recipient_id = auth.uid()` OR
  administrator; INSERT/UPDATE service_role only.
- `notifications` SELECT policy: `created_by = auth.uid()` OR administrator;
  policy note says "members read via recipient rows".
- §12 lists client-direct "read delivered notifications".

**Conflict:** A member can SELECT their recipient row (holding
`notification_id`) but the `notifications` policy grants no SELECT to
members — the stated "read via recipient rows" path is **not expressible**
under the written policies. Members could see a recipient-row link but never
the content; alternatively the row alone leaks the notification's existence
including before delivery.

**Proposed resolution (EX-01):** amend §8 as follows (proposed amendment
text):
1. `notification_recipients` SELECT policy becomes:
   `recipient_id = auth.uid() AND delivered_at IS NOT NULL` OR
   administrator — pending expansions are invisible to recipients.
2. `notifications` gains an additional SELECT policy for members:
   `id IN (SELECT notification_id FROM notification_recipients
   WHERE recipient_id = auth.uid()) AND status = 'sent'` — content is only
   readable after delivery, never in draft/pending/approved-not-sent.
3. Read of delivered notification content may alternatively be served by
   the backend endpoint; the RLS predicate is the database backstop
   (consistent with §12 "server-authorized, RLS as backstop").

**Security/privacy implications:** prevents enumeration of pending
notifications; sent-only visibility; no cross-member content access;
administrator path unchanged.

**Required tests (add to T-04):** member cannot read notification in
`draft`/`pending_approval`/`approved`; member reads own `sent` notification;
member cannot read another member's `sent` notification; recipient row
invisible before `delivered_at`.

**Approval:** Human — amendment to approved design before M6 drafting.

---

## A-02 — Report creation and modification audit coverage

**Existing design statement (v1.0 §9, §12):**
- Audit written by trusted backend operations only; audited events list
  "report status transitions" — creation is not listed.
- §12 client-direct list includes "create own report" and "correct/withdraw
  own submitted report".

**Conflict:** Report creation is a client-direct write, but audit rows can
only be written by `service_role`; with no backend step, report creation
would be entirely unaudited (and non-creation edits partially so) —
contradicting the §9 "coverage by construction" claim for the reporting
lifecycle.

**Proposed resolution (EX-02):** amend §12 (and RLS §8 for `reports`) so all
report **writes** are server-routed:
1. Report creation, correction, and withdrawal move to backend Functions
   (`service_role`); the backend derives `reporter_id` from the JWT and
   rejects mismatches (honors D-03: no anonymous insert, authenticated
   only).
2. New audited events: `report.created`, `report.updated` (author edit),
   `report.withdrawn`.
3. Client-direct list narrows to: sign-in, reads (own), acknowledgment
   requests, and the community feed endpoint.
4. RLS for `reports` becomes read-focused: members SELECT own rows only;
   **no client INSERT/UPDATE/DELETE policies** (defense in depth on top of
   backend checks).

**Security/privacy implications:** complete audit chain for the reporting
lifecycle; reporter identity still bound to JWT server-side; reduced client
attack surface; minor latency increase on submit (acceptable for prototype).

**Required tests:** client INSERT/UPDATE on `reports` fails (T-01/T-04);
backend create/edit/withdraw succeed and each writes an audit row;
`reporter_id` mismatch attempts rejected.

**Approval:** Human — amendment (scope change to client-direct operations).

---

## A-03 — Author-editable report fields

**Existing design statement (v1.0 §8):** "UPDATE own rows while
`status='submitted'`, allowed columns only" — the allowlist is not
enumerated anywhere.

**Proposed resolution (EX-03):** define the author-editable allowlist
explicitly (backend-enforced; RLS reflects it if client writes are ever
restored):

**Editable while `status = 'submitted'`:** `description`, `category_id`,
`location_id`, `occurred_at`, `claimed_severity`, `is_anonymous`,
`latitude`, `longitude`.

**Never author-editable:** `reporter_id`, `status`, `is_synthetic`,
`created_at`, `updated_at`. Withdrawal is a status transition via
`report.withdrawn` backend action, not a field edit.

**Security/privacy implications:** prevents author tampering with status or
identity; `is_anonymous` remains togglable pre-review only.

**Required tests:** edit of each allowlisted column succeeds; edit of
`status`/`reporter_id`/`is_synthetic` fails; edit after status leaves
`submitted` fails (T-04).

**Approval:** Human — amendment.

---

## A-04 — Migration tooling and verification method

**Existing design statement:** design §15 and plan leave tooling open
(A-04); repo has `supabase/config.toml`, empty `supabase/migrations/`,
`seed.sql` stub; `package.json` has no Supabase CLI dependency.

**Proposed resolution (EX-04):**
1. **Tooling:** ship migrations as plain `.sql` files in
   `supabase/migrations/` (the design's stated convention) and apply with
   the **Supabase CLI local stack** (`supabase start`, `supabase migration
   up`) for all development; shared-environment apply uses the same
   reviewed files through the CLI with explicit human authorization (G-3/
   G-4).
2. **Verification:** SQL assertion scripts under `supabase/tests/` (one per
   stage; idempotent; local-only) asserting the §6 test categories;
   repository node test extended with a migration-scan guard (every table
   has RLS, zero `anon` policies) at CI time.
3. **Dependency note:** installing the Supabase CLI is a dev-tool addition
   (not a runtime dependency); it requires approval under AGENTS.md §1.
4. **Deferred sub-decision:** whether to adopt a formal framework (e.g.,
   pgTAP) is deferred until local assertions prove insufficient —
   `[HUMAN DECISION REQUIRED]` only if the institution prefers a framework.

**Security/privacy implications:** local-only until authorized; no
credentials added to the repo; consistent audit trail via versioned files.

**Required tests:** `supabase db reset` from clean state reaches stage M8
with all assertions passing; re-run idempotent.

**Approval:** Human — dev-tooling addition.

---

## A-05 — Development, preview, and production Supabase isolation

**Existing design statement:** single Supabase project; Cloudflare preview
builds reach the same database (plan R-05); Supabase branching is paid and
out of budget.

**Proposed resolution (EX-05) — conditional:**
- **Synthetic phase (now):** acceptable — local CLI stack is fully isolated
  for development; preview+production sharing one project is tolerated
  **only because all data is synthetic** (`is_synthetic` guarantees).
- **Real-data phase:** `[HUMAN DECISION REQUIRED]` — before any real
  personal data, the institution must choose: (a) separate Supabase project
  for production, (b) disable preview builds, or (c) accept shared with
  documented residual risk. This decision must precede the privacy/
  data-residency review (D-12) and is a **blocker for real data only**.
- Until then: migration apply to the shared project (G-3) remains
  human-authorized and fixtures remain synthetic.

**Security/privacy implications:** avoids cross-environment data bleed;
residual risk only in the synthetic phase; real-data path gated twice
(D-12 + this decision).

**Required tests:** environment smoke test (health endpoint reflects the
expected `SUPABASE_URL` per environment); fixture guard asserts no
non-synthetic rows in shared env.

**Approval:** Human — for the real-data phase decision; non-blocking now.

---

## A-06 — Risk assessment behavior when thresholds are unconfigured

**Existing design statement (v1.0 §5.5):** `risk_level` NOT NULL CHECK IN
('low','moderate','high','critical'); `risk_thresholds` values deferred to
O-02; §5.5 notes bands arrive with the risk methodology.

**Conflict:** until O-02 is delivered, `risk_thresholds` has zero rows, so
no check can validate `risk_level` against bands; writing provisional
levels risks recording wrong risk classifications that may later be
retracted.

**Proposed resolution (EX-06):** **assessment writes are disabled until
threshold configuration exists.** Add a write-time guard (backend check in
the M5 service path, mirrored by a database guard): inserting
`risk_assessments` (or replacing `is_current`) requires at least one row in
`risk_thresholds` and the full band set for the four levels; otherwise the
write is rejected with a documented error. No provisional `risk_level` is
ever stored. Schema stays NOT NULL.

**Security/privacy implications:** no misleading risk levels; risk
classification only ever reflects approved methodology; no data repairs
needed later.

**Required tests (T-04 extension):** assessment insert rejected while
`risk_thresholds` empty; accepted and band-validated once configured;
`is_current` replacement re-validated.

**Approval:** Human — amendment.

---

## A-07 — Pending reference values

**Existing design statement (v1.0 §5.2):** values are generic placeholders,
all marked `[CONFIRM]`; O-01 requires confirmation before treating them as
real.

**Proposed resolution (EX-07):**
- **Local/development CLI stack:** placeholder values may be seeded for
  functional testing, clearly identified in the fixture as placeholders.
- **Shared (preview/production) environment:** reference rows are seeded
  **only after O-01 confirmation**; until then, M2 creates empty tables
  there.
- Confirmation is an **institutional act** (school names/categories);
  unconfirmed values never appear as live configuration.

**Security/privacy implications:** no fabricated official names in shared
environments; confusion risk limited to local testing.

**Required tests:** fixture guard asserts zero `[CONFIRM]` rows outside
local; checklist item in G-6.

**Approval:** Institutional — O-01 confirmation (school).

---

## A-08 — Architecture documentation requirements

**Existing design statement:** `docs/system-architecture.md` is a
placeholder; database design v1.0 was approved independently; plan assumed
database-only grounding (R-08/A-08).

**Proposed resolution (EX-08) — non-blocking documentation debt:**
1. Architecture documentation must exist **before any application module
   implementation** (modules are already approval-gated by the roadmap) —
   it does not gate database schema drafting (M1–M7) or local schema
   application.
2. The architecture scope to be covered (from the placeholder's required
   sections): overview; component/module design; incident correlation
   design; multi-criteria risk design; notification flow; security
   architecture (auth, RLS, secrets); deployment architecture — content
   must come from approved material; nothing is invented here.
3. Tracked as a checklist item in the plan's readiness section.

**Security/privacy implications:** none directly; prevents unfounded
architectural assumptions in later phases.

**Required tests:** none (documentation completeness checklist).

**Approval:** Institutional — content authoring; non-blocking for M1–M7.

---

## A-09 — Secure synthetic authentication-user provisioning

**Existing design statement (v1.0 §11):** synthetic users provisioned via
backend admin flow with `.invalid` emails; never open self-signup; M8/G-5
gate; credentials never committed.

**Conflict:** exact mechanism and credential handling are unspecified; any
provisioning touching the shared project would use a privileged credential
that AGENTS.md forbids storing in the repo.

**Proposed resolution (EX-09):**
1. Synthetic auth users are created **only on the local CLI stack** via a
   provisioning script (`scripts/provision-synthetic-users.mjs` —
   placeholder path, subject to approval), with credentials supplied at
   runtime (environment/CLI prompt), never stored, and never committed.
2. The script is deterministic (fixed UUIDs/emails per D-13), idempotent,
   and verifies each provisioned user by signing in with the generated
   throwaway password before discarding it.
3. Shared-environment provisioning of synthetic users: `[HUMAN DECISION
   REQUIRED]` — requires an approved credential mechanism (e.g., scoped
   service token handled outside the repo by a human operator) before
   G-5/G-6 can proceed.

**Security/privacy implications:** no credentials in the repository; local
provisioning limits blast radius; deterministic accounts are unusable
externally (`.invalid` domains).

**Required tests:** script idempotency (re-run produces no duplicates);
provisioned user can authenticate locally; provisioned user cannot escalate
role (T-03); failure modes leave no partial credentials.

**Approval:** Human — for local mechanism; `[HUMAN DECISION REQUIRED]` for
any shared-environment provisioning.

---

## 1. Proposed amendment text (review-ready excerpts)

> **EX-01 (§8 notifications/recipients):** Add member SELECT predicates:
> `notifications`: `id IN (SELECT notification_id FROM
> notification_recipients WHERE recipient_id = auth.uid()) AND
> status = 'sent'`; `notification_recipients`: `recipient_id = auth.uid()
> AND delivered_at IS NOT NULL` (administrator remains exempt).
>
> **EX-02 (§9/§12):** Report creation, author correction, and withdrawal
> become backend operations; audit events `report.created`,
> `report.updated`, `report.withdrawn` added; `reports` RLS removes client
> INSERT/UPDATE policies.
>
> **EX-03 (§8/§12):** Author-editable report columns (while `submitted`):
> description, category_id, location_id, occurred_at, claimed_severity,
> is_anonymous, latitude, longitude. All other columns immutable to
> authors.
>
> **EX-06 (§5.5):** Risk assessment writes require configured
> `risk_thresholds` (four bands present) at write time; otherwise rejected.
> No provisional risk levels are stored.

## 2. Items marked `[HUMAN DECISION REQUIRED]` (not inventable)

1. A-05 — real-data phase environment topology (separate project vs
   disabled preview vs accepted risk) — **blocker for real data only**.
2. A-09 — shared-environment synthetic-user credential mechanism.
3. A-04 — formal test framework preference (only if institution asks).

## 3. Explicitly NOT done

The approved `docs/database-design.md` and the historical proposal were
**not modified**. No SQL, no database contact, no objects/accounts, no real
personal data, no application/Cloudflare changes, no commits/pushes/merges/
deploys, no branch change, no credentials requested or exposed.
