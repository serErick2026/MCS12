# Cloud-First Database Development Strategy — Project SENTINEL (PROPOSED)

**Status:** Proposal for human review — **NOT APPROVED.** Documentation
only: no project created, no remote connection, no SQL executed, no file
modified outside this document, 2026-10-04.

**Context:** Repository `serErick2026/MCS12`, branch
`feature/database-schema`, commit `39f420c`, worktree clean. Supabase CLI
v2.115.0; Docker Desktop + WSL2 installed but local stack stopped;
`0001_identity.sql` committed, never executed; no database objects exist
anywhere. Binding design: `docs/database-design.md` **v1.1 approved**
(unchanged by this proposal). Companion: `docs/database-migration-plan-v0.4-proposed.md`.

## 1. Purpose

Reassess the Docker-based G-2 plan and propose a **Cloud-First**
development strategy: Supabase Cloud (development project) becomes the
primary database target; the local Docker stack is demoted to an
**optional** tool. Cloudflare Pages (preview/production) and Supabase
remain the deployment platforms.

## 2. Required assessment

### 2.1 Review of design and current G-2 plan
- Design v1.1 §10.4 already defines environment boundaries: local =
  fully isolated; preview+production share one Supabase project **only
  while synthetic**; real-data topology = `[HUMAN DECISION REQUIRED]`
  (EX-05). This strategy **adds a development layer in front**; it does
  not alter those boundaries or the design.
- Plan v0.3 G-2 = "apply to local stack". Verified stale assumption:
  local stack mandatory ⇒ unnecessary (Docker installed, but Cloudflare
  preview/production ultimately point at **cloud** databases; a cloud
  development project tests the real target sooner).
- Gap: today the **existing** Supabase project
  (`idytcuiecducelmwqrbo`, ap-northeast-1) is already referenced by
  Cloudflare Pages production via `wrangler.toml [vars]` — it is the
  de-facto production project and currently contains **no migrated
  schema**. Writing migrations into it during development would mix
  dev/prod until G-4.

### 2.2 Dedicated development project evaluation — **recommended**
Create (by a human, outside this scope) a **second, dedicated Supabase
project**, e.g. ref/alias `MCS12-dev`, same region (ap-northeast-1),
own free tier.

| Criterion | Dev project | Reuse existing project for dev |
|---|---|---|
| Prod isolation (keys, data, schema) | Full — separate JWT secret, DB password, refs | None — dev errors hit prod DB |
| Reset freedom | Drop/re-run migrations freely | Destructive risk to production path |
| Cost | Free tier (2nd project — verify quota) | None |
| Complexity | One extra project to manage | Minimal |
| Matches AGENTS.md §5 "staging-equivalent first" | Yes | No |

**Verdict:** dedicated dev project is the recommended architecture; the
"reuse" option is explicitly rejected as unsafe once any cloud write
happens. Creating the project is **not** done here (out of authorized
scope).

### 2.3 Environment relationship (recommended topology)

```
(optional) Local CLI stack  ──draft/test──▶  Supabase DEV project (new)
   Docker, fully isolated                     G-2 target (cloud-first)
                                                  │
                                      G-3 (synthetic phase only,
                                      separate approval + backup)
                                                  ▼
                                  Supabase PRODUCTION project (existing
                                  idytcuiecducelmwqrbo) ◀── shared by
                                          ▲          Cloudflare PREVIEW
                                          │          and PRODUCTION
                              G-4 (separate approval + backup +      (wrangler.toml
                              real-data decision EX-05)              [vars])
```

- **Local development (optional):** migration authoring, offline work,
  fixture iteration. Never required; safe to leave stopped.
- **Cloudflare preview:** branch previews of UI/API; database = the
  production Supabase project **while synthetic** (approved design
  §10.4) — or optionally repointed to the dev project; that Cloudflare
  change is a separate human decision (§5, D-3).
- **Supabase development:** primary cloud target for G-2; all migration
  rehearsal and verification.
- **Cloudflare production:** Pages prod; unchanged.
- **Supabase production:** existing project; first schema write only at
  G-3 (synthetic phase) with separate approval; real-data topology still
  gated by EX-05.

### 2.4 Applying migration files safely to Supabase Cloud — options
All options below are **proposals requiring explicit approval**; none
was attempted.

| Option | Mechanism | Pros | Cons |
|---|---|---|---|
| **A (recommended)** | `supabase link` → `supabase db push` (CLI applies pending files, tracks history in `supabase_migrations.schema_migrations`) | File-based, reproducible, auditable, matches repo workflow | Requires remote link (credential/authorization step); file naming must satisfy CLI pattern — `0001_identity.sql` parses as version `0001` [verify at G-2.1, do **not** rename now] |
| B | Dashboard SQL editor (human pastes file) | No CLI remote session; human-visible | Manual, drift-prone, easy to diverge from repo |
| C | Direct `psql`/pooler execution | Scriptable | No `psql` installed; exposes DB password; not repo-tracked |

**Safety rules (all options):** dev project first · forward-only (no
down-migrations; rollback = snapshot restore or forward-fix, per plan
§8) · verify against design §16 immediately after · never production
without G-4 + backup confirmation · no execution without named approval.

### 2.5 Supabase CLI without the local Docker stack — **yes, supported**
Remote-capable commands needing **no** Docker: `supabase link`,
`supabase migration status`, `supabase db push`, `supabase db pull`,
`supabase migration repair`. Local-only (Docker) commands: `start`,
`db reset`, `migration up` against local, `db diff` (needs local side),
`test`. Therefore a Cloud-First workflow is fully viable with CLI
v2.115.0: **local stack optional; `link`/`push` require their own
explicit human authorization** (they were excluded by the G-0.5
conditions — this proposal asks to supersede that exclusion via a new
gate, not silently).

### 2.6 `0001_identity.sql` cloud compatibility review (static, unmodified)
- **Portable constructs only:** `create table` + FK to `auth.users`,
  CHECKs, two plpgsql triggers, `enable row level security`, policies,
  `grant`/`revoke`, `comment`. No `pgTAP`, no extensions, no
  `supabase_admin`-only features, no `alter default privileges`,
  no `storage`/`realtime`/`cron` references.
- **Cloud prerequisites (satisfied on any Supabase project):**
  `auth.users` exists by default; `gen_random_uuid()` is available as
  default; `anon`/`authenticated`/`service_role` roles exist by default.
- **Environment-specific assumptions: none** — no hardcoded refs, URLs,
  passwords, or project identifiers anywhere in the file.
- **Revokes** are scoped to `profiles` only → no cross-app impact even
  on a shared project (design C-01).
- **Verdict:** compatible with dev, production, and local targets
  unchanged. Renaming/renumbering file **not** proposed.

### 2.7 Credential separation and secret handling
- **Per-project isolation:** dev and production projects have distinct
  JWT secrets ⇒ dev `service_role` key cannot authenticate against
  production. This is the core isolation guarantee.
- **Never in repo/CI/chat:** DB passwords, `service_role` keys. (AGENTS
  §2/§5.) Local dev project credentials live in gitignored `.env` or a
  password manager, referenced by nothing committed.
- **Public-by-design:** `SUPABASE_URL` + `anon` key in `wrangler.toml`
  `[vars]` (approved exception) refer to the **production** project only.
  **Dev-project keys must not be added to Cloudflare** unless/until the
  preview-repoint decision (D-3) is approved.
- **Human actions outstanding:** rotate the two tokens previously pasted
  in chat (Supabase `sbp_…`, Cloudflare `cfut_IGYO…`) — still pending.
- **Dashboard access:** human-held; CLI `link` uses the access token +
  published API key for `db push` — token entered at link time, not
  stored in the repo.

### 2.8 Dev database backup, recovery, reset
- **Philosophy:** the dev database is **disposable** — migrations +
  fixtures are the source of truth; backup discipline matters most for
  the production project (G-4 precondition).
- **Dev reset options:** (i) re-run all migrations from scratch after a
  schema drop [needs authorization, destructive]; (ii) recreate the dev
  project (human); (iii) manual Dashboard snapshot/export before
  high-risk experiments (human).
- **Automated backups:** Supabase free tier backup/PITR entitlement is a
  **[VERIFY]** item (§2.10) — presumed limited/none on free tier ⇒ do
  not rely on it; take a manual export before any risky dev-state loss
  would matter.
- **Production (for later):** backup confirmation is already a hard
  precondition of G-3/G-4; Cloudflare-side rollback = Pages deploy
  rollback (unchanged).

### 2.9 Synthetic test users and test data
- Design §11 + EX-09 (binding): synthetic auth users are provisioned
  **local-stack only**, via dedicated script, runtime-supplied
  credentials, deterministic/idempotent, throwaway passwords, never
  stored/committed.
- **Key unresolved interaction:** a **cloud dev project is a
  shared/remote environment**, so EX-09's current wording does **not**
  authorize provisioning users there. Seeding the dev project with auth
  users requires an explicit EX-09 extension/decision (D-2) — flagged,
  not assumed.
- Same for reference-data placeholders: EX-07/O-01 gate applies to any
  shared environment, including the dev project.
- Test data rules unchanged: `is_synthetic` markers, `.invalid` emails,
  no real personal data, production seeding never unprompted.

### 2.10 Free-tier constraints and human-verification items
All figures **[VERIFY]** before relying on them (console is
authoritative; free-tier terms change):

| Item | Expectation | Impact |
|---|---|---|
| Supabase free: concurrent projects | 2 free projects [VERIFY] | Dev project consumes 2nd slot — fits, but quota-exhausted accounts cannot create it |
| Supabase free: DB storage / egress | ~500 MB / ~5 GB [VERIFY] | Dev usage trivial at this scale |
| Supabase free: project auto-pause after inactivity | Paused after ~7 days idle [VERIFY] | Dev project cold-start ~seconds; `migration status`/`push` may unpause — schedule periodic use |
| Supabase free: automated backups / PITR | Not included or limited [VERIFY] | Dev reset strategy must not depend on them; manual export for safety |
| Supabase free: connection limits / compute hours | Limited [VERIFY] | One-time `db push` well within quota |
| Cloudflare Pages free | 500 builds/month [VERIFY] | Unaffected by this strategy |
| Region | Existing project ap-northeast-1 (Tokyo) [CONFIRM] | Dev project recommended same region for latency parity |
| EX-05 status | Unchanged — `[HUMAN DECISION REQUIRED]` | This strategy does not resolve it |

### 2.11 Proposed revised G-2 sequence (Cloud-First)

| Stage | Action | Executor | Requires |
|---|---|---|---|
| **G-2.0** | Create dedicated dev Supabase project (region Tokyo) | Human in Dashboard | This strategy approved |
| **G-2.1** | `supabase link` to dev ref + `migration status` baseline | Tool (with human-supplied token) | **Explicit approval superseding G-0.5 no-remote condition, limited to dev ref** |
| **G-2.2** | Apply `0001_identity.sql` to dev (Option A `db push`, or B manually) | Tool/Human | Explicit approval naming file + dev project |
| **G-2.3** | Verify design §16 on dev (V-01…V-07 static→executable; T-01…T-06 posture) | Tool (queries against dev) | Same approval as G-2.2 |
| **G-2.4** | *(Optional)* local-stack apply as offline cross-check | Tool | Docker already installed; separate OK |
| **G-2.5** | Dev seeding with synthetic users/fixtures | Tool | **EX-09 extension decision (D-2) + EX-07/O-01 for shared env** |
| **G-3** | Apply to production project (synthetic phase) | Human+Tool | Unchanged: separate approval + backup confirmation |
| **G-4** | Production at real-data phase | Human | Unchanged: EX-05 decision + privacy review |

*Old G-2 ("apply to local stack") becomes optional stage G-2.4.*

## 3. Deliberate non-actions (this proposal)

No Supabase project created · no remote connection or link · no SQL
executed or modified · `0001_identity.sql` untouched · no credentials
requested/exposed · no Cloudflare settings/env changed · no application
code changed · no commit/push/merge/deploy · no branch change ·
`docs/database-design.md` (v1.1) untouched · Docker left stopped.

## 4. Unresolved human decisions (for review)

| ID | Decision | Blocks |
|---|---|---|
| **D-1** | Approve this strategy + create dev project (G-2.0) | Cloud G-2 |
| **D-2** | EX-09 extension: credential mechanism for synthetic users in the **dev project** (or keep dev unseeded) | G-2.5 |
| **D-3** | Repoint Cloudflare **preview** to dev project, or keep shared synthetic topology (current approved behavior) | Preview isolation |
| **D-4** | Migration execution option A / B / C | G-2.2 |
| **D-5** | EX-05 (unchanged, still required before real data) | G-7/real-data |
| **D-6** | Rotate previously chat-pasted tokens (Supabase, Cloudflare) | Security hygiene |
| **D-7** | A-04 assertion framework (pgTAP vs plain SQL) for verification scripts | Test automation |
| **D-8** | §2.10 free-tier [VERIFY] items — confirm in Supabase console | Capacity planning |

## 5. Status

Draft awaiting human review and explicit approval. Recommended gate
sequence in `docs/database-migration-plan-v0.4-proposed.md`.
