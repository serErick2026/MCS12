# A2 Readiness — MCS12-DEV Supabase Project (PROPOSED)

**Status:** Readiness preparation for a **separate A2 decision** —
**A2 NOT APPROVED; NO PROJECT CREATED.** Documentation only,
2026-10-04, `feature/database-schema`.

**Authorization context:** **A1 APPROVED** (Cloud-First Database
Strategy). A1 authorizes this documentation only — it does **not**
authorize project creation, remote link, SQL/migration execution,
`db push`, seeding, Cloudflare changes, or production activity
(A2–A7 remain pending per `docs/g2-cloud-first-decision-record-proposed.md`).

**Binding inputs:** `docs/database-design.md` v1.1 (approved, untouched) ·
`docs/cloud-first-database-strategy-proposed.md` (A1-approved
strategy) · `docs/g2-cloud-first-decision-record-proposed.md` · root
`AGENTS.md` · `docs/git-workflow.md`.

## 1. Purpose and scope of the DEV project

- **Purpose:** dedicated cloud target for G-2 — apply and verify
  `0001_identity.sql` (and later M2…M7) against a real Supabase Cloud
  project without touching production; primary database for the
  Cloud-First workflow (local Docker optional).
- **In scope after A2:** creating an empty project only (§7 checklist).
- **Out of scope until separately approved:** A3 link, A4 migration, A5
  seeding, A6 Cloudflare wiring, any G-3/G-4 production activity.

## 2. Proposed project identification

| Attribute | Proposed value | Note |
|---|---|---|
| Project name | **MCS12-DEV** | Console may slugify (`MCS12-DEV` → ref slug); the immutable **project ref** governs identity, not the display name |
| Alias/ID in repo configs | `school-safety-intelligence-dev` | For future CLI/config use; not written anywhere until A3 |
| Organization | Same Supabase account as production (assumed) **[VERIFY]** | Console check |
| **Region** | **ap-northeast-1 (Tokyo)** | Parity with production `idytcuiecducelmwqrbo` — **subject to console verification** of availability on free tier |

## 3. Free-tier project-slot and quota verification **[CONSOLE REQUIRED]**

Must be confirmed in the Supabase console **before/while** A2 is
decided (strategy D-8; do not assume):

- [ ] Concurrent free projects allowed ≥ 2 (DEV consumes slot 2) [VERIFY]
- [ ] Free-tier DB storage / egress / compute-hour quotas adequate [VERIFY]
- [ ] Inactivity auto-pause policy (expected ~7 days idle) [VERIFY] —
      affects availability, not correctness
- [ ] Automated backup/PITR entitlement on free tier (expected:
      none/limited) [VERIFY] — reset strategy in §8 must not depend on it
- [ ] Region `ap-northeast-1` selectable for a new free project [VERIFY]
- [ ] Account not already at quota / project-creation restrictions [VERIFY]

If any check fails → **stop** and return to the human (rollback
condition R-2).

## 4. Project reference identification and verification

- After creation (A2), the human records in the decision record:
  **project ref** (20-char), display name, region, creation date.
- **Verification rule (binding):** re-read and verify the DEV ref from
  the recorded value **immediately before every remote operation**
  (link, status, push). Never operate on a ref recalled from memory,
  shell history, or autocomplete.
- Distinguish refs visually: production = `idytcuiecducelmwqrbo`;
  DEV = *to be recorded*. Any command containing the production ref
  during G-2 is a **stop condition (R-3)**.

## 5. Credential and secret-handling requirements

| Item | Rule |
|---|---|
| DB password | Newly generated at creation; unique; stored in password manager or gitignored `.env` only — never in repo, scripts, logs, or chat |
| `service_role` key | **Never** in browser code, client bundles, or committed files; stored like the password; never pasted in chat |
| `anon` key + URL | Public-by-design but project-scoped; must **not** be added to Cloudflare or repo until (and unless) A6/D-3 approves |
| CLI access token | Entered at link time (A3) by the human; never written to disk in the repo, never committed |
| Git hygiene | After any operation: `git status` + secret scan must show zero credential leakage |
| Rotation | Any credential exposed in chat/logs is rotated immediately and recorded as used |

## 6. DEV versus production isolation

- Separate project ⇒ **separate JWT secret, DB password, API keys** —
  DEV credentials cannot authenticate against production.
- DEV has **no** Cloudflare binding (preview/production remain on
  production project; topology unchanged pending D-3/A6).
- Workflow isolation: G-2 remote operations are DEV-scoped only;
  production ref never appears in G-2 commands (§4, R-3).
- Data isolation: nothing exported from production into DEV; DEV seeded
  only with synthetic data (§7 of strategy; EX-07/O-01 gate for shared
  seeding still applies).

## 7. Synthetic-data-only restriction

- DEV may contain **only** synthetic/fixture data (`is_synthetic`
  markers, `.invalid` emails) once A5 is approved; **no real student,
  teacher, staff, or incident data — ever** (design D-12/privacy;
  AGENTS §2).
- Until A5: DEV stays **empty of application rows** (default Supabase
  system tables only).
- No production data export/import at any time.

## 8. Backup, reset, and recovery assumptions

- **Assumption (to verify):** free tier provides **no reliable automated
  backups** → DEV recovery = **re-run migrations** (migrations + repo
  are source of truth), not restore.
- **Reset (drop schema / re-apply) is destructive** → requires
  authorization each time (dev-state destructive actions still gated).
- Optional manual export via Dashboard before risky experiments (human
  action; advised, not required).
- **Rollback of A2 itself:** deleting the DEV project is a human console
  action with no effect on production/Cloudflare (nothing else points at
  DEV before A6).

## 9. Explicit A2 authorization checkpoint

**A2 grants, if and only if explicitly approved:** creating one empty
Supabase project named `MCS12-DEV` (region §2) in the human's account.

**A2 does NOT grant:** A3 link · A4 migration/`db push` · A5 seeding ·
A6 Cloudflare changes · production activity · commits/pushes.

**Approver reply format:** *"approve A2"* (or combined, explicitly:
*"approve A2, A3"*). Silence = no approval. Current status:
**A2 ⬜ pending.**

## 10. Post-creation verification checklist (after A2, before A3)

- [ ] Project exists, status Active, name ≈ MCS12-DEV, region Tokyo
- [ ] Project **ref recorded** in decision record §14 (or directed file)
- [ ] New DB password stored (password manager / gitignored `.env`)
- [ ] `service_role` key stored per §5; **not** in chat/repo
- [ ] Database is empty except Supabase defaults (no app tables)
- [ ] No CLI link established yet; no Cloudflare references DEV
- [ ] `git status`: no secrets, no unexpected changes; worktree clean
- [ ] §3 free-tier items confirmed against live console
- [ ] Production project `idytcuiecducelmwqrbo` untouched (spot-check)

## 11. Rollback and stop conditions

| ID | Condition | Action |
|---|---|---|
| R-1 | A2 not explicitly approved | Do nothing; stay paused |
| R-2 | Free-tier/quota/region verification fails (§3) | Stop; report to human; do not create |
| R-3 | Production ref detected in any G-2 command/target | Abort operation immediately; report |
| R-4 | Credentials exposed (chat/log/repo) | Rotate; report; pause A3+ |
| R-5 | Unexpected content found in new project (not empty) | Stop; investigate; possible delete/recreate (human) |
| R-6 | Human revokes A1/A2 at any time | Halt current step; no partial actions |

## 12. Assumptions requiring account-console access (cannot verify offline)

1. Free-tier concurrent-project slot count (§3)
2. Region `ap-northeast-1` availability for new free projects
3. Auto-pause / backup / storage / compute entitlements
4. Account/org restrictions on project creation
5. Accepted display name `MCS12-DEV` and resulting slug/ref
6. Generated credentials (password, API keys) — created by human,
   never generated or handled by the tool

## 13. Status

Readiness documentation prepared; awaiting **explicit A2 decision**.
A1 recorded as approved; **A2–A7 pending; G-2 paused; `0001_identity.sql`
never executed; production and Cloudflare untouched; no commits.**
