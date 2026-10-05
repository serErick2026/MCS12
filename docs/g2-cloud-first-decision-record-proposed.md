# G-2 Cloud-First Strategy — Decision Record (PROPOSED)

**Status:** Decision package for human review — **NO DECISION RECORDED,
ALL APPROVALS PENDING.** Documentation only, prepared 2026-10-04 on
`feature/database-schema`. Nothing in this file authorizes action by
itself; each authorization in §14 requires an explicit human reply.

**Inputs inspected:** `docs/cloud-first-database-strategy-proposed.md`
(**NOT APPROVED** proposal), `docs/database-migration-plan-v0.4-proposed.md`
(**NOT APPROVED** draft), `docs/database-design.md`
(**APPROVED v1.1 baseline — binding, unchanged**),
`docs/database-design-approval-record-v1.1-proposed.md`
(ACKNOWLEDGED AND RECORDED), root `AGENTS.md` (binding; note:
`docs/AGENTS.md` does not exist), `docs/git-workflow.md`, plan v0.3 and
earlier phase/gate records. No proposed document is treated as approved.

## 1. Executive decision summary

The Cloud-First strategy review is complete. The project now needs a
deliberate human decision before **any** remote Supabase activity: seven
separate authorizations (§6/§14) govern the path from strategy approval
to a verified dev migration. G-2 remains paused; `0001_identity.sql`
remains drafted and never executed; no dev project exists; production is
unaffected.

## 2. Current verified technical state

- Branch `feature/database-schema` @ `39f420c`, **ahead 1**, clean
  tracked tree; 2 untracked drafts (strategy + plan v0.4).
- `supabase/migrations/0001_identity.sql` committed, statically
  validated, **never executed**; no database objects exist anywhere.
- Supabase CLI v2.115.0 (no-pin per G-0.5); Docker Desktop + WSL2
  installed, **local stack stopped** (optional, per Cloud-First).
- No DEV project; no remote link; no `db push`; no Supabase/Cloudflare
  writes this phase.
- Design v1.1 approved baseline intact; G-0/G-0.5/G-1 satisfied and
  recorded; **G-2 paused**; G-3+ blocked (EX-05, EX-09 open).
- Worktree may gain this record file as untracked; no commits authorized.

## 3. Recommended cloud-first architecture

**Local CLI stack (optional, isolated) → Supabase DEV project (new,
dedicated, Tokyo) → existing production Supabase project
(`idytcuiecducelmwqrbo`, shared by Cloudflare preview + production,
synthetic phase only per design §10.4).** Dev-first migration rehearsal;
production writes only at G-3 (backup-confirmed) and G-4 (EX-05 + privacy
review). Local Docker remains an optional cross-check (old G-2 → new
G-2.4), never mandatory.

## 4. Decisions D-1 through D-8

| ID | Decision | Origin |
|---|---|---|
| D-1 | Approve Cloud-First strategy and create a dedicated DEV Supabase project | Strategy §4 |
| D-2 | EX-09 extension: synthetic-user credentials in the dev project, or keep dev unseeded | Strategy §4 |
| D-3 | Repoint Cloudflare preview to DEV, or keep current shared synthetic topology | Strategy §4 |
| D-4 | Migration execution option: A `db push` / B Dashboard / C psql | Strategy §2.4 |
| D-5 | EX-05 real-data environment topology | Design §10.4 (pre-existing) |
| D-6 | Rotate tokens previously pasted in chat (Supabase `sbp_…`, Cloudflare `cfut_IGYO…`) | Strategy §2.7 |
| D-7 | A-04 assertion framework: pgTAP vs plain SQL | Plan v0.3 (pre-existing) |
| D-8 | Free-tier `[VERIFY]` items (projects quota, pause, backups, storage, region) | Strategy §2.10 |

## 5. Recommended resolution for each decision

| ID | Recommendation | Note |
|---|---|---|
| D-1 | **Approve strategy (D-1a) and create DEV project (D-1b) as two separate sign-offs** (§14 A1/A2) | Split for decision separation; project creation is a human Dashboard action — record ref + region in this file when done |
| D-2 | **Keep DEV unseeded initially**; defer EX-09 extension until after migration verification | Smallest blast radius; seeding = later gate G-2.5 |
| D-3 | **Keep current approved topology** (preview shares production project while synthetic); revisit after EX-05 | No Cloudflare change now |
| D-4 | **Option A (`db push`)** — file-based, reproducible, history-tracked | Option B accepted fallback; C discouraged |
| D-5 | **Leave open** — not required for G-2 | Blocks G-7/real data only |
| D-6 | **Rotate both tokens now** (human action, outside this record) | Hygiene; independent of G-2 |
| D-7 | **Plain SQL assertion scripts** for the first verification cycle (no extension dependency); revisit pgTAP later | Keeps free-tier untouched |
| D-8 | **Verify all `[VERIFY]` items in the Supabase console before/at D-1b** | Console is authoritative |

## 6. Decisions requiring explicit human confirmation

Each is a **separate authorization** unless explicitly combined by the
approver in one reply:

- **A1 — Strategy approval:** accept Cloud-First strategy + this record's
  recommendations (documentation-level only).
- **A2 — DEV project creation:** create dedicated Supabase project (human
  Dashboard action; later performed by human, reported here).
- **A3 — Remote CLI link:** authorize `supabase link`/`migration status`
  **limited to the DEV ref** — expressly supersedes the G-0.5 "no remote"
  condition for that scope only.
- **A4 — Migration execution:** authorize applying `0001_identity.sql`
  to DEV (file + target named in the reply).
- **A5 — Synthetic seeding:** authorize dev seeding (requires D-2/EX-09
  extension first; not recommended in the first cycle).
- **A6 — Cloudflare environment change:** any preview repoint/vars change
  (D-3) — separate, currently not recommended.
- **A7 — Production database activity (G-3+):** separate approval +
  backup confirmation; unaffected by anything in this package.

## 7. Preconditions for creating the DEV project

- [ ] A1 strategy approval recorded (§14)
- [ ] D-8 free-tier quotas confirmed in console (projects count, region)
- [ ] Project named/aliased distinctly (e.g. `MCS12-dev`), region
      ap-northeast-1 (Tokyo) for parity **[CONFIRM]**
- [ ] New unique DB password + `service_role` key generated; stored in
      password manager / gitignored `.env` only — never committed/chat
- [ ] Project ref recorded in this document after creation
- [ ] No data import; empty project; not linked to any Cloudflare env

## 8. Preconditions for remote CLI linking

- [ ] A3 approval explicitly superseding G-0.5 no-remote condition,
      **scoped to the DEV ref**
- [ ] DEV ref re-verified immediately before `supabase link` (type it
      from §7 record, not from memory/history)
- [ ] Access token entered at link time from human; never written to
      repo, scripts, logs, or chat
- [ ] `migration status` baseline captured; confirm expected pending
      state for `0001_identity.sql`
- [ ] `git status` clean of secrets after the operation

## 9. Preconditions for applying `0001_identity.sql`

- [ ] A4 approval naming file + DEV project ref
- [ ] File byte-identical to commit `39f420c` (no edits; any change
      requires a separately reviewed authorization)
- [ ] Execution option per D-4 (recommended A); local stack not required
- [ ] Verification script/report template ready (§10) before execution
- [ ] Post-apply: `git status` shows no new tracked changes; no
      production project ref present in the command/config
- [ ] Production project **definitely not** a link target during G-2

## 10. Required post-migration verification

Verification report (`docs/g2-verification-report-proposed.md` or as
directed) must document, before G-2 may be declared complete:

1. Objects created matching design v1.1 §3/§5.1 (inventory diff)
2. RLS enabled; exactly the two designed policies; **zero `anon` policies**
3. Effective privileges: `anon` denied on `profiles`; `authenticated` =
   `SELECT` + `UPDATE(display_name)` only
4. Role-freeze: non-`service_role` role/is_active change fails; backend
   path succeeds (design C-02)
5. Own-row visibility/escalation posture (V-01…V-07, T-01…T-06 subset
   feasible without seeded users — note any deferred items explicitly)
6. Design traceability matrix (file → design sections) confirmed
7. Explicit statement: target project ref, execution option used,
   timestamp, and that production was untouched

## 11. Security and privacy safeguards (binding conditions)

1. DEV must be a **dedicated** Supabase project (never production).
2. **Verify the project reference before every remote operation.**
3. Never expose `service_role` key in browser code or client bundles.
4. Never commit access tokens, DB passwords, or `.env` contents.
5. Never apply migrations to production during G-2.
6. Never use real student, teacher, or incident data (synthetic only).
7. Preserve `0001_identity.sql` unless a separately reviewed change is
   authorized.
8. Do not assume free-tier limits, backup availability, or inactivity
   behavior without console verification (D-8).
9. Keep local Docker optional — no workflow may depend on it.
10. A documented verification report (§10) is required before declaring
    G-2 complete.

## 12. Explicitly prohibited actions (until their gate is approved)

No Supabase project creation (pre-A2) · no remote link (pre-A3) · no SQL
execution/`db push` (pre-A4) · no user creation/seeding (pre-A5) · no
Cloudflare variable/secret changes (pre-A6) · no production database
activity (pre-A7) · no modification of `0001_identity.sql` or
`docs/database-design.md` v1.1 · no commits/pushes/merges/deploys · no
branch changes · no claiming G-2 complete.

## 13. Gate transition criteria

| Transition | Criteria |
|---|---|
| Strategy → G-2.0 | A1 recorded |
| G-2.0 → G-2.1 | DEV project created + §7 checklist complete |
| G-2.1 → G-2.2 | A3 recorded + link done + status baseline captured |
| G-2.2 → G-2.3 | A4 recorded + migration applied to DEV only |
| **G-2 complete** | §10 verification report documented and human-reviewed |
| G-2 → G-3 | Separate approval + backup confirmation (unchanged); EX-07/O-01 before any shared seeding; EX-05 remains blocking only for real data (G-7) |

## 14. Approval and sign-off

**A1 APPROVED 2026-10-04. A2 SUPERSEDED (Amendment A-01). A3 + A4
APPROVED 2026-10-04 and EXECUTED 2026-10-05. G-2 CLOSED per D-G2-02
(2026-10-05, §15). A5 preparation-only per D-A5-01; A5 execution, A6,
A7 remain UNAPPROVED.**

## AMENDMENT A-01 (2026-10-04) — G-2 target changed to existing project

Human decision: G-2 operates on the **existing `MCS12` Supabase project
(`idytcuiecducelmwqrbo`)**, not a dedicated DEV project.

**Superseded:** §7 DEV-project preconditions, readiness doc R-2/R-3/R-5
ref rules, "dedicated DEV" isolation premise (§3/§6 of strategy — the
strategy/plan v0.4 documents now diverge from this decision and require
reconciliation before promotion).

**Now different — requires explicit confirmation before A3/A4:**
1. A3 link and A4 execution target the **production-bound project** —
   the safeguard "never migrate during G-2" is hereby amended: A4, if
   approved, applies `0001_identity.sql` to this project by design.
2. **Recommended precondition:** manual Dashboard schema export/snapshot
   of the (empty) database before A4, recorded as done/not-done.
3. Project ref verification rule (§4) still binding — target ref is now
   `idytcuiecducelmwqrbo` and must be re-verified before each operation.
4. All other safeguards unchanged: no real data, no service_role in
   client code, no credential commits, no Cloudflare changes (A6 still
   pending), synthetic-only content, verification report before G-2
   completion.
5. D-2/D-3 (dev seeding, preview repoint) become moot; free-tier
   second-slot verification (D-8a) no longer needed.

**Pending:** explicit A3 approval (link CLI to `idytcuiecducelmwqrbo`)
and explicit A4 approval (apply `0001_identity.sql`) — reply separately
or combine explicitly (e.g. "approve A3, A4").

| # | Authorization | Approver reply (verbatim) | Date |
|---|---|---|---|
| A1 | Approve Cloud-First strategy + record recommendations | ✅ approved ("A1 approved") | 2026-10-04 |
| A2 | Create dedicated DEV Supabase project (§7) | ⏹ superseded — target = existing MCS12 (Amendment A-01) | 2026-10-04 |
| A3 | Remote CLI link (target amended to MCS12 per A-01) | ✅ approved 2026-10-04; **executed 2026-10-05** (linked `idytcuiecducelmwqrbo`, region ap-northeast-1) | 2026-10-05 |
| A4 | Apply `0001_identity.sql` (target amended per A-01) | ✅ approved 2026-10-04; **executed 2026-10-05** (`db push` exit 0; history `local:0001 remote:0001`) | 2026-10-05 |
| A5 | Seed/provision synthetic accounts | ✅ **executed 2026-10-05** — M1 approved (D-A5-02), A5.1 local validation (18/18), A5.2 live: dry-run → 5/5 provisioned → deferred suite **49/49 PASS** → post-state verified (5 accounts, no extras) | 2026-10-05 |
| A6 | Cloudflare environment change (D-3) | ⬜ pending | — |
| A7 | Production database activity (G-3) | ✅ **0002 applied 2026-10-05** (first attempt rejected pre-apply, corrected, post-verified) **and 0003 applied 2026-10-05** (fresh backup 5-tables/no-reports, push exit 0, history `local:0003 remote:0003`, pre/post diff additive-only, SQL assertions A–H PASS, REST 17/17) **and 0004 applied 2026-10-05** (researcher "Approve G-3 for `0004_correlation.sql`"; pre-apply export `supabase/.temp/pre-g3-0004-export.sql` = 6 tables/7 policies; `db push` exit 0; history `local:0004 remote:0004`; post export `supabase/.temp/post-g3-0004-export.sql`; diff additive-only — 289 insertions all `incidents`/`incident_reports`-scoped, 0 real removals; SQL assertions A–H PASS remotely; REST 32/32; npm test 18/18); later migrations remain gated per-migration | 2026-10-05 |

*Approver may combine A1–A7 only by listing the authorization numbers
explicitly in one reply (e.g. "approve A1, A2"). Silence = no approval.*

## 15. G-2 CLOSURE DECISIONS — approved 2026-10-05

Recorded from the human owner's approval of the Stage 6 G-2 Consolidated
Completion Report (session record, 2026-10-05). Evidence artifacts:
linked project state, migration history, schema dumps in gitignored
`supabase/.temp/`, `npm test` output.

### D-G2-01 — E2 Export Deviation
- **Approval status:** APPROVED (2026-10-05)
- **Scope:** accept the read-only Supabase CLI schema dump (E2) as the documented alternative to the undelivered Dashboard export (E1)
- **Evidence basis:** `pre-a4-schema-export.sql` (1,996 chars) and `post-a4-schema-export.sql` (5,895 chars) verified schema-only — 0 `COPY`/`INSERT` statements, 0 secret markers, 0 personal-data columns (checks run 2026-10-05)
- **Limitations:** E1 was never delivered; deviation history preserved — nothing rewritten to imply E1 completion
- **Deferred work:** none
- **Explicit non-authorizations:** dump artifacts must not be committed; no obligation to produce E1 retroactively
- **Next gate / exit criteria:** n/a — closed record

### D-G2-02 — G-2 Closure
- **Approval status:** APPROVED for closure (2026-10-05)
- **Scope:** close G-2 on: successful A3 link to MCS12, successful A4 application of `0001_identity.sql`, post-migration structural verification, anonymous access-denial results, existing automated test results
- **Evidence basis:** link exit 0 (`project_ref idytcuiecducelmwqrbo`, region `ap-northeast-1`); `db push` exit 0; history `local:0001 remote:0001`; post-apply dump matches design v1.1 §3/§5.1/§8/§14 (table, 2 trigger functions, 2 triggers, RLS enabled, exactly 2 `authenticated` policies, scoped grants/revokes, FK→`auth.users` CASCADE); REST anon GET/POST → **HTTP 401 (42501)**; zero `anon` policies; `npm test` 5/5
- **Limitations:** **no exhaustive security assurance** — verification covered structure and anonymous denial only
- **Deferred work (four items retained):** (1) authenticated own-row access (2) role self-escalation prevention (3) display-name update (4) privileged backend access — all require provisioned synthetic users/credentials (A5) — **ALL FOUR DISCHARGED 2026-10-05: 49/49 checks PASS across 5 identities (plan §12, A5 proposal §6); honest limit — officer row-scoping on risk tables pending first EX-07/O-01 seeding**
- **Explicit non-authorizations:** no G-3 start, no user creation, no push/merge/deploy
- **Next gate / exit criteria:** A5 preparation (D-A5-01); the four deferred tests discharge the remainder of G-2 verification once executed and reported

### D-A5-01 — Synthetic-User Verification (preparation)
- **Approval status:** APPROVED — preparation only (2026-10-05)
- **Scope:** resolve EX-09 (safe credential mechanism for synthetic users on the shared MCS12 project) and define the A5 execution preflight
- **Evidence basis:** design v1.1 §11 (EX-09: shared-environment provisioning requires a separate human decision); four deferred tests from D-G2-02
- **Limitations:** documentation/planning only
- **Deferred work:** A5 execution — separate preflight, separate approval
- **Explicit non-authorizations:** creating or seeding users; disclosing credentials; running authenticated tests
- **Next gate / exit criteria:** A5 execution preflight approved → users provisioned → four deferred tests executed and reported

### D-A5-02 — EX-09 Credential Mechanism (M1) + A5.1 Local Implementation
- **Approval status:** APPROVED — mechanism M1 (repo admin script + runtime-only service-role key) selected for EX-09 (2026-10-05)
- **Scope:** author `scripts/provision-synthetic.mjs` (five fixed `.invalid` identities, fixed UUIDs, fail-closed target/config/state checks, idempotent reuse, redaction) and validate locally under mocked API
- **Evidence basis:** `tests/provision-synthetic.test.js` (13 mocked tests) + full suite 18/18 + build OK + secret scan clean + diff scope review; A5 proposal §3–§5
- **Limitations:** LOCAL ONLY — no login, no remote API calls, no users created, no SQL, no credentials disclosed or committed
- **Deferred work:** A5.2 execution preflight (pre-state dump → real provisioning → four deferred tests)
- **Explicit non-authorizations:** remote mutation; credential rotation; commits/push
- **Next gate / exit criteria:** human approval of A5.2 preflight → execution → G-2 verification fully discharged

### D-A-04 — Assertion Framework (D-7 resolved)
- **Approval status:** APPROVED (2026-10-05) — **plain-SQL assertions**
- **Scope:** `tests/sql/assert_<stage>.sql` read-only scripts (psql `-v ON_ERROR_STOP=1`, `RAISE EXCEPTION` on failure); structural + privilege + regression guards; row-content assertions deferred until seeded data exists
- **Evidence basis:** `tests/sql/assert_0003_reporting.sql` sections A–H PASS against the live MCS12 project (2026-10-05)
- **Limitations:** read-only; cannot observe row-level RLS filtering on empty tables
- **Next gate:** each future stage ships its assertion file with the migration draft

### D-DOC-01 — Documentation Commit
- **Approval status:** APPROVED (2026-10-05) — one documentation-only commit on `feature/database-schema`; **no push**
- **Scope:** pending `docs/` files plus roadmap/plan/record updates; excludes secrets, `.env`, `.temp` dumps, application code, migrations, unrelated files
- **Evidence basis:** exact staged-diff review + `npm test` + `npm run build` + staged secret scan before commit
- **Limitations:** single commit; feature branch only
- **Explicit non-authorizations:** push, merge, deploy, SQL execution, Cloudflare changes
- **Next gate / exit criteria:** n/a — executed 2026-10-05 (hash reported in session)

### D-M2-01 — Reference Migration Drafting
- **Approval status:** APPROVED — drafting and static review only (2026-10-05)
- **Scope:** draft `supabase/migrations/0002_reference.sql` per design v1.1 §5.2 (four reference tables + RLS), honoring EX-07 placeholder rules and existing architecture/security constraints
- **Limitations:** static review only; no remote execution
- **Deferred work:** applying `0002_reference.sql` → per-migration gate (revised G-3)
- **Explicit non-authorizations:** executing SQL remotely; committing the migration (separate approval); seeding shared reference data (EX-07/O-01)
- **Next gate / exit criteria:** draft + static review report accepted by human → revised G-3 approval to apply

### D-GATE-01 — Revised G-3/G-4
- **Approval status:** APPROVED (2026-10-05)
- **Scope:** retire the obsolete assumption that G-3 is a future shared/preview application of `0001_identity.sql` — M1 is already applied to the production-associated MCS12 project serving preview and production. Authoritative definitions (plan v0.4 §11): **G-3 = per-migration application authorization for M2+ to the MCS12 project + app-integration verification (export/backup check each time); G-4 = real-data readiness gate (EX-05 decision + privacy review + retention policy) before any real personal data**
- **Evidence basis:** A4 execution record (2026-10-05); design v1.1 §10.4 environment boundaries
- **Limitations:** G-3 remains per-migration human approval; G-7 (real personal data) unchanged
- **Deferred work:** EX-05 remains open for G-4
- **Next gate / exit criteria:** M2 drafting (D-M2-01) → revised G-3 approval before apply

### SEC-01 — Credential Rotation Follow-up (formerly D-6)
- **Approval status:** **OPEN** — rotation required, **not verified**
- **Scope:** Supabase `sbp_*` access token and Cloudflare `cfut_IGYO*` token previously exposed in chat; **plus two tokens pasted 2026-10-05 during A5.2 preparation: (a) a second `sbp_*` access token (mis-delivered, not stored, unusable as intended) and (b) the `service_role` JWT (stored only in gitignored `.env` for A5.2 runtime use; chat-exposure requires key rotation after A5.2 — Supabase Dashboard → Settings → API → rotate)** — all require rotation
- **Evidence basis:** none — no rotation evidence exists
- **Limitations:** values will not be printed, copied, or requested; rotation may not be claimed complete without independent verification (e.g., old token rejected)
- **Next gate / exit criteria:** independent verification closes SEC-01

**Record status:** **G-2 CLOSED** (D-G2-02, 2026-10-05). A5/A6/A7 and
SEC-01 remain open; this record was updated for closure decisions on
2026-10-05 — no external resources were modified during the
documentation task.
