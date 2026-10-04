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
- Next: **A5 COMPLETE** (provisioned 5/5 synthetic users 2026-10-05;
  deferred suite 49/49; G-2 verification discharged) — follow-ups:
  rotate chat-exposed service-role key (SEC-01) + `sbp_*` tokens, and
  retest risk-table officer scoping at first EX-07/O-01 seeding;
  **M2 applied** (G-3, 2026-10-05); M3+ migrations next, each under
  per-migration G-3

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
