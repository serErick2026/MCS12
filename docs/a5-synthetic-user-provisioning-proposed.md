# A5 Synthetic-User Provisioning — EX-09 Credential Mechanism (COMPLETE)

**Status:** **A5 EXECUTED 2026-10-05.** M1 approved (D-A5-02) → A5.1
script + mocked validation (18/18) → **A5.2 live: dry-run, provisioned
5/5 synthetic users + profiles (idempotent reuse verified), deferred
suite 49/49 PASS, post-state integrity confirmed (exactly 5 accounts,
display names restored, no extras).** Runtime credential lives only in
gitignored `.env` but was chat-exposed → **rotation required (SEC-01).**
All preflight steps in §6 completed; G-2's four deferred items
discharged (reported, this document).

## 1. Purpose and scope

Resolve **EX-09** (design v1.1 §11: *"Shared-environment synthetic
provisioning requires a separate human decision on the credential
mechanism"*) for the shared **MCS12** project, and define the A5
execution preflight that will discharge the four verification items
deferred by D-G2-02 (own-row access, role self-escalation,
display-name update, privileged backend access).

In scope: mechanism design, credential handling, provisioning spec,
guardrails, preflight definition. Out of scope: writing the script,
executing anything, creating users.

## 2. Binding constraints (approved records)

| Source | Requirement |
|---|---|
| Design v1.1 §11 (EX-09) | Deterministic, idempotent, `.invalid` emails, explicit synthetic indicators, throwaway passwords verified and discarded, credentials never stored/committed, never production-unprompted |
| Design v1.1 §6 | Profiles are **backend upserts** (1:1 with `auth.users`); JWT roles per C-03 |
| Design v1.1 §12 | Privileged operations server-side only; **no client writes** |
| Design v1.1 §5.1 | `role`/`is_active` writable only by backend (`service_role`); role-freeze trigger enforces |
| AGENTS §2/§3 | Synthetic sample data only; service_role never in browser/code/committed files; no new dependencies |
| D-A5-01 | Preparation only; execution = separate preflight; no credential disclosure |

## 3. Proposed mechanism — **M1: repo admin script + runtime-only service-role credential (RECOMMENDED)**

**Component (to be authored only after this proposal is approved):**
`scripts/provision-synthetic.mjs` — Node ESM, **zero new dependencies**
(built-in `fetch`, `node:crypto`), following `scripts/*.mjs` conventions.

**Credential flow (the EX-09 decision core):**
1. `SUPABASE_SERVICE_ROLE_KEY` is supplied **at run time only** — from
   the human-held gitignored `.env` (or an interactive prompt) — loaded
   into the process environment, **never written to any file, never
   committed, never pasted in chat, never placed in Cloudflare vars or
   client bundles** (AGENTS §3; separate from the public anon key).
2. `SUPABASE_URL` = already-public value from `wrangler.toml`.
3. Script exits if the key is absent; it never echoes or logs the key.
4. Any exposure ⇒ rotate immediately + SEC-01-style record.

**Provisioning rules:**
- **Deterministic identities** (fixed, listed in the script after
  approval): `synthetic.administrator@school-safety.invalid`,
  `synthetic.safety-officer@…invalid`, `synthetic.member-a@…invalid`,
  `synthetic.member-b@…invalid` (two members are required for the
  own-row isolation test), `synthetic.viewer@…invalid` — each with a
  fixed deterministic UUID so re-runs are idempotent.
- **User creation:** Supabase Auth Admin API
  (`POST /auth/v1/admin/users`) with the runtime service-role key;
  lookup-by-email first — existing users are reused, never duplicated.
- **Password:** fresh `crypto.randomBytes` value **per provisioning
  run**, used immediately to verify sign-in (password grant), then
  **discarded from memory** — not stored, not logged, not committed
  (design §11 "verified and discarded"). Re-runs generate new passwords;
  determinism applies to identity, not secrets.
- **Profile row:** backend upsert per design §6 via PostgREST
  `POST /rest/v1/profiles` (service-role key ⇒ RLS bypassed by design;
  column grants cover service_role): `id` = auth UUID, `role` per test
  matrix, `display_name` (synthetic, e.g. "Synthetic Administrator"),
  `is_active = true`, **`is_synthetic = true`** (explicit indicator).
- **Idempotent + auditable:** every action logged as outcome
  (created / reused / upserted) with no secret material in output.

**Why M1 fits the tests:** the four deferred tests need (a) five
session-authenticated JWTs (the password-grant flow above) and (b) role
assignment on profiles (backend upsert) — both provided without any
schema or application change.

### Alternatives considered
| Option | Why rejected/kept |
|---|---|
| **M2** Manual Dashboard creation | Works, but non-reproducible, error-prone role entry, no idempotency — fallback only if M1 refused |
| **M3** Deployed Cloudflare provisioning endpoint | Rejected: persistent attack surface in production for a one-shot task; conflicts with "never production-unprompted" |
| **M4** Defer indefinitely | Leaves the four D-G2-02 tests permanently deferred |

## 4. Guardrails (binding at execution)

1. Verify project ref `idytcuiecducelmwqrbo` immediately before any run.
2. Allowlist: **only** the five fixed synthetic identities; script must
   reject any other email/role input (no free-form provisioning).
3. Synthetic-only content; **no real student/teacher/incident data**.
4. Profiles must carry `is_synthetic = true`; production usage of these
   accounts is limited to the synthetic data phase (design §10.4).
5. No schema changes, no migrations, no commits during execution.
6. **Stop conditions:** ref mismatch; key absent/exposed; user exists
   with mismatched attributes; any API error ⇒ halt and report (no
   blind retries).

## 5. Credential handling summary (EX-09 answer)

| Item | Rule |
|---|---|
| Service-role key | Human-held; runtime env only; gitignored `.env` or prompt; never repo/browser/chat/Cloudflare |
| Passwords | Random per run; verified; discarded; never stored |
| Anon/public URL | Public-by-design (existing approved exception) — unchanged |
| Rotation | SEC-01 remains OPEN for previously exposed tokens; any new exposure forces immediate rotation |
| Test result data | Only synthetic identities in reports |

## 6. A5 execution preflight (separate approval required)

The later A5 preflight will, in order: (1) confirm this mechanism
approved and the script authored + statically reviewed; (2) capture
pre-state (read-only dump); (3) provision the five users; (4) run the
four deferred tests + auth sanity; (5) discard passwords, record
outcomes; (6) deliver a results report (actual results, no overclaiming);
(7) confirm worktree clean of secrets. **All steps (1)–(7) COMPLETED
2026-10-05:** mechanism approved (D-A5-02), script authored + mocked
validated (A5.1), pre-state export + read-only dry-run, 5/5 provisioned,
four deferred tests + auth sanity executed (49/49 PASS; actual results
in plan §12 and this status header), passwords discarded after use,
worktree secret-scanned. **Remaining follow-up: rotate the chat-exposed
service-role key (SEC-01).**

## 7. Non-authorizations (this proposal)

No users created or seeded · no SQL/migrations · no remote API calls ·
no credentials requested/disclosed · no commits · no
Cloudflare/app changes · G-2 remains closed with four items deferred.
(Local implementation + mocked tests only: `scripts/provision-synthetic.mjs`,
`tests/provision-synthetic.test.js`.)

## 8. Exit criteria / next gate

**Met 2026-10-05:** five users provisioned → four deferred tests
executed + reported (49/49) → G-2 verification fully discharged per
D-G2-02. **Open follow-ups:** SEC-01 key rotation (independently
verify old key rejected), risk-table officer row-scoping retest at
first EX-07/O-01 seeding.
