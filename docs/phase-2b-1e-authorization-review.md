# Phase 2B-1E — Authorization Review Decision Package (PROPOSED)

**Status:** Review and preparation only — **not an approval**. Prepared
2026-10-04 on `feature/database-schema`.

## 1. Executive summary

G-0 (v1.1 baseline approval) is satisfied. Two gates remain open and require
explicit human authorization: **G-0.5** (Supabase CLI tooling) and **G-1**
(draft `supabase/migrations/0001_identity.sql`). Inspection confirms the
CLI **already exists** (global npm, v2.115.0); **Docker is absent**, which
blocks local application/verification (G-2) but not drafting. EX-05 and
EX-09 remain unresolved and are not resolved by this package. No SQL,
tooling, database, application, or Git actions were taken. This package
recommends approval scopes; it does not grant them.

*Observation for the record:* the instruction names "Project SENTINEL";
that name appears **nowhere** in this repository (0 matches in docs/
AGENTS/README). Not resolved — flagged for the project owner.

## 2. Repository status

- Branch `feature/database-schema`, in sync with `origin`; **nothing staged
  or committed**; no branch changes.
- Worktree: 1 modified (`docs/database-design.md` = v1.1 baseline) + 9
  untracked documentation files (archive, candidate, record, change log,
  amendments, plans v0.1–v0.3, historical proposal).
- Authority confirmed: `docs/database-design.md` header = **APPROVED DESIGN
  BASELINE, Version 1.1, October 4, 2026**; approval record =
  **ACKNOWLEDGED AND RECORDED**; plan v0.3 lists G-0.5 and G-1 as open,
  G-2 as approval+CLI.
- Historical records untouched (v1.0 archive, v0.1–v0.3 plans, candidate).

## 3. G-0.5 tooling assessment

| Question | Finding |
|---|---|
| Exact tool proposed | Supabase CLI, **global npm install, v2.115.0** (verified present; `supabase migration --help` functional offline) |
| Already available? | **Yes** — no installation required |
| Proposed invocation | Local-only commands: `supabase init/start/db reset/migration up` + SQL assertion scripts under `supabase/tests/` (EX-04 mechanism; pgTAP-vs-plain still deferred) |
| Package/lockfile changes | Only if owner opts to **pin `supabase` as devDependency** (touches `package.json` + `package-lock.json`) — owner's choice, listed as an option |
| Config/environment changes | First `init/start` may **expand the committed `supabase/config.toml`**; may create `supabase/.branches` (gitignore already covers `supabase/.temp/` only) |
| Remote Supabase contact? | **Local commands do not touch any remote project.** Remote contact exists only via `supabase login/link/db push` — **explicitly excluded**. (The CLI's version-check notice reaches the npm registry only; no DB contact.) |
| Minimum safe scope | Recognition of the existing CLI + local invocation pattern + tolerance of documented config/gitignore churn; **nothing else** |

**G-0.5 approval would authorize:** (a) recognizing global CLI v2.115.0 as
project migration tooling; (b) using local-only commands for drafting and
validation workflows; (c) optional devDependency pin [owner choice];
(d) associated `config.toml`/`.gitignore` maintenance changes when the
local stack is first used.
**Would NOT authorize:** installing Docker (separate environment decision —
currently missing and required by `supabase start`), upgrading the CLI,
running `supabase init/start` (deferred to G-2), `login`/`link`/`db push` or
any remote connection, executing SQL, commits/pushes.

## 4. G-1 migration scope assessment

**Target:** draft **only** `supabase/migrations/0001_identity.sql`
(per plan stage M1; static validation only).

| Aspect | Scope |
|---|---|
| Intended schema objects | `profiles` (uuid PK, FK `auth.users` CASCADE, role `CHECK` ∈ administrator/safety_officer/member/viewer, `display_name`, `is_active`, `is_synthetic`, timestamps); `updated_at` trigger; role-freeze `BEFORE UPDATE` trigger (JWT-claims check, C-02); column grants (`SELECT`, `UPDATE(display_name)` only); `ENABLE ROW LEVEL SECURITY` + select-own / update-own policies; scoped `REVOKE` of default `anon`/`authenticated` privileges on the new objects (C-01); policy comments citing design v1.1 |
| Dependencies/prerequisites | G-0 satisfied; design v1.1 §3/§5.1/§8/§14; at apply time: `auth.users` exists, `gen_random_uuid()` available (Supabase default) |
| Access-control requirements | Deny-by-default RLS; zero `anon` policies; no client INSERT/DELETE on `profiles`; backend-only role writes; defense-in-depth (grants + policies + trigger) |
| Validation procedures | **This phase: static review only** (human/AI inspection against design). Executable validation (assertion scripts, T-01/T-03/T-06) deferred to **G-2, which requires Docker — currently absent** |
| Unresolved assumptions | Assertion framework (pgTAP vs plain, A-04); Docker availability for G-2; whether `supabase init` may rewrite `config.toml` (only at G-2 time) |
| Destructive/consequential operations | **Drafting: none (inert text).** At future apply: `CREATE TABLE`/triggers/policies are additive; privilege `REVOKE`s are **scoped to the new objects only** (no DROP/TRUNCATE/DELETE; no impact on other apps' tables); applying to shared environments remains gated by G-3/G-4 |

**G-1 approval would authorize:** writing the single migration file for
review, uncommitted, plus at most a companion static-review checklist note.
**Would NOT authorize:** executing/applying it, connecting to any database,
assertion runs, staging/committing/pushing, or drafting later stages
(0002+) without their own approval.

## 5. Risks and dependencies

| ID | Risk/dependency | Impact | Gate |
|---|---|---|---|
| R-D1 | **Docker not installed** | Local apply/verify (G-2) impossible until separately authorized | New environment decision |
| R-D2 | Unpinned global CLI (v2.115.0; v2.119.0 available) | Version drift; upgrade not performed | Owner decision |
| R-D3 | `config.toml` expansion / gitignore gaps on first local use | Repo churn | Covered by G-0.5 scope if approved |
| R-D4 | Accidental remote command (`link`/`push`) | Remote DB modification | Excluded by scope; command discipline |
| R-D5 | SentinEL naming discrepancy (§1) | Document ambiguity | Owner clarification |
| R-D6 | EX-05 / EX-09 unresolved | Block G-3/G-4/G-5.5 only — **not** G-0.5/G-1 | Preserved, unresolved |

## 6. Outstanding human decisions (preserved — no assumptions made)

1. **EX-05** — real-data environment topology: **unresolved.**
2. **EX-09** — shared-environment synthetic provisioning credential
   mechanism: **unresolved.**
3. **EX-07** — institutional confirmation of reference values: deferred.
4. **EX-08** — architecture documentation: deferred, pre-module gate.
5. Docker installation (new): required before G-2; decision not made here.
6. Assertion framework (A-04): pgTAP vs plain SQL — decision not made here.
7. Optional devDependency pin (part of Request A choice).

## 7. Approval recommendations (separate — neither granted yet)

> **REQUEST A — G-0.5:** *Recommend approval* of: recognition of existing
> Supabase CLI v2.115.0 + local-only invocation pattern + documented
> config/gitignore churn + [ ] pin as devDependency / [ ] no pin.
> Reply: **"approve G-0.5 (pin)"**, **"approve G-0.5 (no-pin)"**, or
> *decline*.

> **REQUEST B — G-1:** *Recommend approval* of drafting
> `supabase/migrations/0001_identity.sql` (static validation only,
> uncommitted). Reply: **"approve G-1"** or *decline*.

## 8. Explicit non-actions (this phase)

No SQL written or modified · no tooling installed or upgraded · no Supabase
connection · no DB objects · no auth users/credentials · no real personal
data · no application/Cloudflare changes · no files staged or committed ·
no push/merge/deploy · no branch change · approved historical records
untouched. The only file produced is this review document.

## 9. Recommended next phase

**Phase 2B-2 (upon G-0.5 + G-1 approval):** draft `0001_identity.sql` +
static-review checklist; report for human review (still uncommitted).
Then a separate **environment decision** (Docker install → G-2 local apply
+ assertion runs). G-3/G-4 remain blocked by EX-05/EX-09 decisions as
applicable.
