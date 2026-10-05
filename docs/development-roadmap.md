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
- Next: **M4 DRAFT COMPLETE, NOT APPLIED** (2026-10-05:
  `0004_correlation.sql` + `assert_0004_correlation.sql`; scratch PG16
  11/11 functional tests + assertions PASS ×2, static checks clean —
  plan §14) → researcher **G-3 approval for 0004** → apply + verify;
  EX-07/O-01 candidates + D-8 checklist **awaiting researcher review**;
  SEC-01 rotation **awaiting researcher** (then rejection verification)

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
