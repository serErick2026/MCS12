# Database Migration Execution Plan — v0.4 (PROPOSED)

**Status:** Draft v0.4 — originally 2026-10-04; **revised 2026-10-05**
per D-G2-02 (G-2 closure) and D-GATE-01 (gate redefinition). Planning
document only — execution authorizations live in
`docs/g2-cloud-first-decision-record-proposed.md`; this file is not an
approved baseline.

**Source design:** `docs/database-design.md` — **APPROVED v1.1 baseline
(binding, promoted 2026-10-04)**.
**Companion:** `docs/cloud-first-database-strategy-proposed.md`
(Cloud-First architecture; environment topology; G-2 revision).
**Branch:** `feature/database-schema`. Supersedes plan v0.3.

## 1. Purpose and scope

Implementation-ready plan for the **approved v1.1 schema** (v1.0 +
EX-01…EX-09, promoted 2026-10-04), now with a **Cloud-First** execution
model: a dedicated Supabase development project is the primary migration
target; the local Docker stack is an optional cross-check. Planning and
documentation only.

## 2. Source design and assumptions

| Source | State |
|---|---|
| `docs/database-design.md` | **APPROVED v1.1 baseline — binding** |
| `docs/database-design-archive-v1.0.md`, `-v1.1-candidate.md`, change log, amendments | Historical records (superseded by promotion) |
| `docs/cloud-first-database-strategy-proposed.md` | Cloud-First proposal (pending approval) |
| `AGENTS.md`, `docs/git-workflow.md` | Binding rules |

**Assumptions:** Supabase CLI tooling (EX-04, approved G-0.5 no-pin);
shared preview/prod project while synthetic (EX-05); synthetic-only until
privacy review (D-12); **local stack optional** (Cloud-First) — a
dedicated **dev Supabase project** is the G-2 target once created.

## 3. Dependency map

Unchanged from v0.2/v0.3 (§3): design v1.1 → migration files M1…M8 →
verification T-01…T-06 → synthetic fixtures → gates.

## 4. Migration order

Unchanged from v0.3 (§4): M1 `0001_identity.sql` · M2 `0002_reference.sql`
· M3 `0003_reporting.sql` · M4 `0004_correlation.sql` · M5 `0005_risk.sql`
· M6 `0006_notifications.sql` · M7 `0007_audit.sql` · M8
`0008_fixtures.sql` — with v1.1 reconciliations (EX-01/02/03/06/07/09)
as recorded there.

## 5. Per-stage implementation and verification criteria

Unchanged from v0.3 (§5). General rules unchanged: RLS with creation;
scoped REVOKE+GRANT; zero `anon` policies; policy comments cite
design/change-log section.

## 6. RLS and privilege testing strategy

Unchanged identities/test set (T-01…T-06, one synthetic user per role +
`anon`). **Mechanism update (Cloud-First):** assertion scripts in
`supabase/tests/` run **against the linked dev project** (remote verify,
CLI-compatible) *or* on the optional local stack; repository node test
keeps the migration-scan guard (RLS on every table; zero `anon`
policies). A-04 (pgTAP vs plain SQL) remains a human decision.
No shared-environment tests (incl. dev) without authorization.

## 7. Synthetic fixture strategy

Unchanged rules (deterministic, `.invalid`, idempotent, credential-free
repo). **Placement update (Cloud-First):** fixtures target the local
stack **or** the dev project — the dev project counts as a **shared
environment**, so EX-09 (credential mechanism) and EX-07/O-01 gates
apply before any dev seeding (strategy D-2). Production seeding never
unprompted.

## 8. Rollback and recovery considerations

Unchanged: no down-migrations — snapshot restore or forward-fix;
**Cloud-First additions:** dev project is disposable (reset = re-run
migrations/recreate); free-tier automated backup entitlement is
**[VERIFY]** and must not be relied upon; production backup confirmation
remains a hard precondition of G-3/G-4; manual Dashboard export advised
before risky dev-state experiments (human action).

## 9. Development / preview / production separation

**Revised (Cloud-First, pending approval):**

| Layer | Database | Notes |
|---|---|---|
| Local CLI stack (optional) | Local, Docker | Fully isolated; fixtures permitted |
| ~~Supabase DEV project (new)~~ | — | **SUPERSEDED by Amendment A-01 (2026-10-04)** — G-2 executed against the existing MCS12 project |
| Cloudflare preview | Existing production Supabase project | Shared **while synthetic** (v1.1 §10.4); repoint option D-3 **moot** (no dev project) |
| Cloudflare production | Existing production Supabase project | Unchanged (`wrangler.toml [vars]`) |
| Real-data phase | `[HUMAN DECISION REQUIRED]` EX-05 | Unchanged; this plan does not resolve it |

## 10. Risks and unresolved decisions

**Cleared by v1.1 promotion (2026-10-04):** EX-01, EX-02, EX-03, EX-06
(as recorded in v0.3 §10).

**Safely deferred:** EX-04 framework choice (before automated test runs);
EX-05 (real-data phase); EX-07/O-01 (before any shared seeding, incl.
dev project); EX-08 (before modules); EX-09 (before any synthetic auth
provisioning beyond local stack — **now includes the dev project**).

**`[HUMAN DECISION REQUIRED]` / strategy decisions:** D-1 approve
Cloud-First (A1) and create dev project (A2) — split into separate
sign-offs per the G-2 decision record; D-2 EX-09 extension for dev seeding;
D-3 preview repoint; D-4 execution option (push/dashboard/psql); EX-05;
EX-09 shared mechanism; A-04 assertion framework; §2.10 free-tier
**[VERIFY]** items.

**Residual risks:** R-01…R-07 unchanged from v0.2 + new R-08 (dev project
quota/pause availability [VERIFY]).

**Decision status update (2026-10-05):** D-1/A1 approved; A2 + D-2
superseded (Amendment A-01); D-3 moot; D-4 resolved = Option A executed;
D-6 → SEC-01 **OPEN**; D-7/D-8 remain; EX-09 → preparation under
D-A5-01; G-2 closed under D-G2-02.

## 11. Authorization gates

| Gate | Action | Requires |
|---|---|---|
| G-0 | ✅ **SATISFIED** — v1.1 approved and promoted (2026-10-04) | Recorded |
| G-0.5 | ✅ **SATISFIED** — CLI tooling approved, no-pin (2026-10-04) | Recorded |
| G-1 | ✅ **SATISFIED** — `0001_identity.sql` drafted + committed `39f420c` | Recorded |
| **G-2.0** | ~~Create dedicated dev Supabase project~~ | ⏹ SUPERSEDED by Amendment A-01 (target = existing MCS12) |
| **G-2.1** | Link + migration-history baseline (first remote touch) | ✅ **DONE 2026-10-05** — A3 executed; linked `idytcuiecducelmwqrbo` |
| **G-2.2** | Apply `0001_identity.sql` to MCS12 | ✅ **DONE 2026-10-05** — A4 executed; `db push` exit 0; history `local:0001 remote:0001` |
| **G-2.3** | Verify design §16 | ✅ **PARTIAL 2026-10-05** — structural + anonymous-denial tests passed; four authenticated-path items deferred (D-G2-02) |
| G-2.4 | *(Optional)* local-stack apply cross-check | Not exercised; remains optional |
| G-2.5 | Synthetic users/fixtures on shared project | **→ A5**: preparation authorized (D-A5-01); execution = separate preflight |
| **G-3 (revised — D-GATE-01)** | Per-migration application of **M2+** to the production-associated MCS12 project + app-integration verification | Per-migration human approval + export/backup check |
| **G-4 (revised — D-GATE-01)** | Real-data readiness before any real personal data | EX-05 decision + privacy review + retention policy |
| G-5 / G-5.5 / G-6 | Synthetic provisioning (local / shared) / seeding | Unchanged from v0.3 |
| G-7 | Real personal data | Privacy review + EX-05 |
| G-8 | Commit/push/merge/deploy | Approval per git-workflow |

## 12. Readiness checklist

- [x] G-0 ✅ SATISFIED — v1.1 approved + promoted (2026-10-04)
- [x] G-0.5 ✅ SATISFIED — CLI tooling, no-pin (2026-10-04)
- [x] G-1 ✅ SATISFIED — `0001_identity.sql` committed `39f420c`
- [x] Cloud-First strategy approved (A1, 2026-10-04); A2 superseded (A-01)
- [x] G-2.1 link + G-2.2 apply executed (2026-10-05); G-2.3 partial
- [x] **G-2 CLOSED** (D-G2-02, 2026-10-05) — four verification items deferred
- [x] A5.1 provisioning script implemented + locally validated (D-A5-02, 2026-10-05; mocked API, 18/18)
- [x] A5.2 execution preflight approved + executed (researcher 2026-10-05; dry-run → provision → verify, exit 0)
- [x] Four deferred verification tests executed — **49/49 PASS** (own-row, escalation-blocked 403, display-name update+restore, admin-API/insert denied; ×5 identities; anon 401 ×4; wrong-password 400 ×5). *Honest limit: officer row-scoping on risk tables not distinguishable while tables are empty (EX-07/O-01) — retest at first seeding.*
- [x] M2 `0002_reference.sql` drafted + statically reviewed (D-M2-01, 2026-10-05)
- [x] M2 applied via revised G-3 (researcher approval 2026-10-05; pre-state export profiles-only/schema-only; first attempt rejected pre-apply on nonexistent PG role targets — remote unchanged — corrected to archive §8 `TO authenticated` posture + active-profiles role predicate; push exit 0, history `local:0002 remote:0002`)
- [ ] SEC-01 token rotation independently verified
- [ ] Free-tier [VERIFY] items confirmed in console (D-8)
- [ ] A-04 assertion framework chosen (D-7)
- [ ] EX-08 architecture doc scheduled pre-module
- [ ] O-01 confirmation scheduled (before shared seeding)
- [ ] EX-05 decision scheduled (before G-4/real data)
- [x] Export/backup check confirmed before each revised-G-3 apply (0002: pre-apply export `supabase/.temp/pre-g3-0002-export.sql`, 2026-10-05)

## 13. Current execution state (updated 2026-10-05)

**Done:** A3 link and A4 application of `0001_identity.sql` to the MCS12
project (production-associated), with structural and anonymous-denial
verification; G-2 closed (D-G2-02).
**Not done:** applying M3–M8 (M1+M2 applied 2026-10-05);
user provisioning/seeding; pushes,
merges, deploys; Cloudflare changes; `0001_identity.sql` and
`docs/database-design.md` (v1.1) untouched since `39f420c`; no
credentials committed; SEC-01 rotation unverified.
