-- 0003_reporting.sql — Stage M3: reports (core submission entity)
--
-- Project:   School Safety Intelligence and Notification System (MCS12)
-- Design:    docs/database-design.md — APPROVED DESIGN BASELINE, Version 1.1
--            §3 conventions, §5.3 reports [EX-02, EX-03], §8 RLS policies.
--            Column-level schema per v1.0 §5.3
--            (docs/database-design-archive-v1.0.md, "Columns, CHECKs,
--            and indexes unchanged from v1.0").
-- Plan:      docs/database-migration-plan-v0.4-proposed.md — stage M3.
-- Authority: continuous-development protocol (drafting); applying this
--            file requires the separate per-migration G-3 approval.
--
-- STATUS: DRAFT — NOT APPLIED. Apply only after explicit human G-3
-- approval with a pre-apply export/backup check (D-GATE-01).
--
-- Design points (v1.1 EX-02/EX-03, D-03):
--   * Backend-controlled writes: clients get NO INSERT/UPDATE/DELETE
--     policies or grants on reports — creation, author correction and
--     withdrawal run through backend Functions (service_role).
--   * reporter_id is NOT NULL and derived server-side from the caller's
--     JWT; clients cannot supply or override it.
--   * Clients may SELECT their own rows only (policy below); officers
--     read others via the backend.
--   * is_anonymous is display-hiding only — identity always stored.
--   * EX-06/risk linkage arrives in M5; notification linkage in M6.
--   * NO INSERT statements — this migration creates schema only.
-- ------------------------------------------------------------------------

-- 1. updated_at trigger reuses public.set_updated_at() from 0002 (M2) —
--    no M1/M2 objects are created, replaced, or altered by this file.
-- ------------------------------------------------------------------------

-- 2. reports (design §5.3) ----------------------------------------------
create table public.reports (
    id               uuid primary key default gen_random_uuid(),
    reporter_id      uuid not null references public.profiles(id) on delete restrict,
    category_id      uuid not null references public.report_categories(id) on delete restrict,
    location_id      uuid references public.locations(id) on delete set null,
    occurred_at      timestamptz not null check (occurred_at <= now() + interval '5 minutes'),
    description      text not null check (char_length(description) between 10 and 2000),
    claimed_severity smallint check (claimed_severity between 1 and 5),
    status           text not null default 'submitted'
                     check (status in ('submitted', 'under_review', 'linked',
                                       'dismissed', 'resolved', 'withdrawn')),
    latitude         numeric(9,6),
    longitude        numeric(9,6),
    is_anonymous     boolean default false,
    is_synthetic     boolean default false,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create trigger trg_reports_set_updated_at
    before update on public.reports
    for each row execute function public.set_updated_at();

alter table public.reports enable row level security;

-- 3. Policies (design v1.1 §8): SELECT own rows only; no client write
--    policies of any kind (EX-02 — all writes via backend) --------------
create policy "reports: select own rows"
on public.reports
for select
to authenticated
using (reporter_id = auth.uid());

-- 4. Scoped revokes + minimal grants (v1.1 §14 C-01; §8) ---------------
revoke all on table public.reports from anon, authenticated;
grant all on table public.reports to service_role;
grant select on table public.reports to authenticated;

-- 5. Indexes (v1.0 §5.3 list, unchanged) --------------------------------
create index idx_reports_status_created_at on public.reports (status, created_at desc);
create index idx_reports_category_id       on public.reports (category_id);
create index idx_reports_location_id       on public.reports (location_id);
create index idx_reports_reporter_created  on public.reports (reporter_id, created_at desc);
create index idx_reports_occurred_at       on public.reports (occurred_at);

-- 6. Documentation comments (traceability) ------------------------------
comment on table public.reports is
    'Database Design v1.1 §5.3 / §8 — community hazard/incident reports; EX-02 backend-controlled writes (no client INSERT/UPDATE/DELETE), EX-03 field editability enforced server-side, D-03 reporter_id derived from JWT; officers read others via backend.';
comment on policy "reports: select own rows" on public.reports is
    'Design v1.1 §8 — own-row visibility (reporter_id = auth.uid()); zero anon policies (V-06); no client write policies (EX-02).';

-- End of stage M3 (schema only). Verification targets when applied:
--   * own-row SELECT only; anon denied; client INSERT/UPDATE/DELETE all
--     denied (grant + policy absence);
--   * FK behaviour: reporter/category RESTRICT, location SET NULL;
--   * CHECK rejection: future occurred_at, 1-char description, status
--     outside the approved list (to be exercised under A-04 once the
--     assertion framework is chosen).
-- Deferred: executable assertions (A-04 undecided); any row content
-- requires A5-approved synthetic identities only (EX-09) — no seeding
-- in this migration.
