# G-2 Preflight Readiness — MCS12 Migration (PROPOSED)

**Status:** Preflight report for approved A3/A4 — **NO AUTHENTICATION,
LINK, OR EXECUTION PERFORMED.** 2026-10-04, `feature/database-schema`.

**Authorizations:** A1 approved · A2 superseded (Amendment A-01: target =
existing **MCS12** project) · **A3 approved, not executed** · **A4
approved, not executed** · A5–A7 pending · G-2 paused (not complete).

## 1. Readiness checklist

| # | Item | State |
|---|---|---|
| 1 | `SUPABASE_ACCESS_TOKEN` present | ❌ **absent** (.env and session) |
| 2 | `SUPABASE_DB_PASSWORD` present | ❌ **absent** (.env and session) |
| 3 | `.env` git-ignored | ✅ confirmed (`.gitignore:23`) |
| 4 | Target verified vs A-01 (§3) | ✅ matches approved target |
| 5 | Migration static review (§4) | ✅ passed — no destructive ops |
| 6 | Schema export decision (§2) | ⚠️ **pending human choice** |
| 7 | Remote migration history | ⛔ unknown until A3 (`migration status`) |
| 8 | Existing-object conflict check | ⛔ unknown until remote introspect (A3) |

## 2. Export decision

A read-only export **requires either Supabase Dashboard access (human) or
CLI authentication (prohibited in this preflight phase)** — therefore no
export was executed. Prepared options:

| Option | Command / action | Output | Status |
|---|---|---|---|
| **E1 (recommended)** | Human: Dashboard → Database → Schemas → export | human-held file | awaiting human |
| E2 | After A3: `supabase db dump --schema public > supabase\.temp\pre-a4-schema-export.sql` | repo-ignored dir (`supabase/.temp/`) | prepared, **not executed** (needs auth; runs between A3 and A4 if authorized) |
| E3 | Skip | — | requires human "skip export" (A4 approval permits recorded not-done) |

**Reason unavailable now:** preflight prohibits authenticate/link; CLI
cannot reach the remote schema without them.

## 3. Target confirmation (vs Amendment A-01)

| Attribute | Approved value | Verified |
|---|---|---|
| Project name | MCS12 | ✅ (A-01 record) |
| Project ref | `idytcuiecducelmwqrbo` | ✅ — appears in `wrangler.toml` `SUPABASE_URL` (sole Supabase ref in repo) |
| Environment | **PRODUCTION-ASSOCIATED** — Cloudflare Pages prod + preview point here | ✅ identified |
| Region | Asia Pacific (Tokyo) ap-northeast-1 | previously recorded; confirm via `supabase projects list` after A3 |
| Migration history | Unknown (never linked by CLI) | ⛔ check at A3 via `migration status` |

**Production-target coverage check:** This **is** a production-associated
target. Authorization explicitly covers it: Amendment A-01 states A4
applies `0001_identity.sql` to this project **by design**, and A3/A4 were
approved *after* A-01 was recorded ("approved what is recommended for
A3 and A4"). Scope = link + one migration file; no Cloudflare change
(A6 pending); application remains DB-inert (health check only).

## 4. Migration static review (`0001_identity.sql` @ `39f420c`, unmodified)

| Aspect | Finding |
|---|---|
| Destructive operations | **None** — 0 DROP / TRUNCATE / DELETE / INSERT |
| `ALTER` statements | 1 — `alter table public.profiles enable row level security` (**new object only**) |
| Existing-object conflicts | **Unverifiable pre-link**: fixed names (`profiles`, 2 functions, 2 triggers, 2 policies) would conflict if already present → **stop condition S-2** |
| Role/privilege changes | Scoped: REVOKE ×3 (table from anon/authenticated; EXECUTE ×2 from PUBLIC/anon/authenticated), GRANT ×3 (all→service_role; select/update(display_name)→authenticated). **No roles created; no global/schema-wide revokes** |
| RLS policies | `enable` + exactly 2 policies, both `to authenticated`, own-row only; **zero `anon` policies** |
| Auth relationship | `profiles.id → auth.users(id) ON DELETE CASCADE` (standard Supabase FK) |
| Rollback limitation | **No down-migration** — recovery = forward-fix or empty-state restore; DB currently has no app schema, so worst case = remediate forward |
| DB password note | `db push` (Option A) will need `SUPABASE_DB_PASSWORD` at runtime |

## 5. Explicit execution prerequisites (in order)

1. Human adds `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` to `.env` (never chat)
2. Human decides export E1/E2/E3
3. **A3:** `supabase login` → `supabase link --project-ref idytcuiecducelmwqrbo` → re-verify ref → `supabase migration status` (expect: no recorded history)
4. **Conflict gate:** confirm target has no `profiles` table / no `0001` recorded (S-2)
5. **A4:** `supabase db push` (file byte-identical to `39f420c`)
6. Post-migration tests (§6) → verification report → human review

## 6. Stop conditions

| ID | Condition | Action |
|---|---|---|
| S-1 | Credentials absent or invalid | Stop at A3; no auth retry loops |
| S-2 | Target already contains `profiles` (or `0001` in history) | Stop before push; human decides (adopt/forward-fix) |
| S-3 | Ref mismatch (any command targets anything ≠ `idytcuiecducelmwqrbo`) | Abort immediately |
| S-4 | Migration file differs from `39f420c` | Abort; re-review required |
| S-5 | Export decision not resolved | Do not proceed past step 2 |
| S-6 | Any push/ALTER error output | Stop; capture error; human review |
| S-7 | Human revokes/defers A3 or A4 at any point | Halt |

## 7. Required post-migration tests (decision record §10 subset)

1. Object inventory matches design v1.1 §3/§5.1 (profiles, 2 triggers, 2 functions)
2. RLS enabled; exactly 2 policies; **zero `anon` policies**
3. Effective privileges: `anon` denied; `authenticated` = SELECT + UPDATE(display_name) only
4. Role-freeze behavior (non-service_role escalation blocked) — SQL session test
5. `migration status` shows `0001` applied
6. Report documents: ref, timestamp, option used, production-untouched statement (Cloudflare unchanged)
7. **G-2 remains incomplete until the verification report is human-reviewed** (this doc is preflight only)

## 8. Verdict

- **A3 linking: READY** — pending only human-supplied `.env` credentials (S-1) + export decision (S-5).
- **A4 migration: NOT YET READY** — requires A3 executed, history/conflict checks (S-2), and export resolution first.
- **G-2: NOT complete** (verification report outstanding).
