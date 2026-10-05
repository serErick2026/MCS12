# Development Roadmap

**Status:** Placeholder — pending approval for application modules.
Database-schema entries below reflect recorded decisions (updated
2026-10-05). Roadmap items must be approved before implementation
begins. The current approved phase is:

## Phase 1 — Project initialization (complete)

- Repository structure
- Cloudflare Pages + Workers configuration
- Supabase client scaffolding and environment variable documentation
- Health-check endpoint
- Landing page and manifest
- Test and validation setup

## Phase 2 — Database schema (in progress)

- Git workflow approved (2026-10-04)
- Database Design v1.1 approved and promoted (2026-10-04)
- `0001_identity.sql` applied to the MCS12 Supabase project;
  **G-2 closed (2026-10-05)** — see
  `docs/g2-cloud-first-decision-record-proposed.md` (D-G2-02); four
  authenticated-path verification items deferred
- Next: **M4 APPLIED + VERIFIED** (2026-10-05: history `local:0004
  remote:0004`, SQL assertions A–H PASS remotely, REST 32/32, diff
  additive-only — plan §14) → **M5 `0005_risk.sql` drafting** (plan §4/§5)
  → G-3 approval → apply; EX-07/O-01 candidates + D-8 checklist
  **awaiting researcher review**; SEC-01 rotation **awaiting researcher**
  (then rejection verification)

## Phase 2+ — Application modules (not started)

Reserved module slots awaiting approval:

- `src/modules/authentication`
- `src/modules/reports`
- `src/modules/incidents`
- `src/modules/correlation`
- `src/modules/risk`
- `src/modules/notifications`
- `src/modules/analytics`

Do not start any module without explicit approval.
