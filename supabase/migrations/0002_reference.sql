-- 0002_reference.sql — Stage M2: reference data (controlled configuration)
--
-- Project:   School Safety Intelligence and Notification System (MCS12)
-- Design:    docs/database-design.md — APPROVED DESIGN BASELINE, Version 1.1
--            §3 conventions, §5.2 reference data, §8 RLS policies.
--            Column-level schema per v1.0 §5.2
--            (docs/database-design-archive-v1.0.md, "Schema unchanged").
-- Plan:      docs/database-migration-plan-v0.4-proposed.md — stage M2.
-- Authority: D-M2-01 (2026-10-05) — drafting + static review only.
--
-- STATUS: APPLIED to MCS12 (idytcuiecducelmwqrbo) 2026-10-05 under the
-- revised G-3 gate (D-GATE-01; researcher approval "approve G-3 for
-- 0002"). First attempt was rejected pre-apply (policies targeted
-- nonexistent PG roles); remote remained unchanged (verified by
-- re-export), then corrected to the archive §8 posture: all policies
-- `TO authenticated` with an active-profiles role predicate. No custom
-- JWT claims; no PG roles created.
--
-- Scope (D-M2-01): four reference tables + RLS + grants/revokes +
-- updated_at triggers. EMPTY TABLES ONLY — EX-07: placeholder values are
-- local-stack-only and shared-environment rows require O-01
-- confirmation; therefore this migration contains NO INSERT statements
-- and no seed data (design v1.1 §5.2, EX-07).
-- ------------------------------------------------------------------------

-- 1. updated_at maintenance trigger (design v1.1 §3 conventions) --------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

revoke execute on function public.set_updated_at() from public, anon, authenticated;

-- 2. report_categories (design §5.2) ------------------------------------
create table public.report_categories (
    id          uuid primary key default gen_random_uuid(),
    code        text unique not null,
    name        text not null,
    description text,
    sort_order  int,
    is_active   boolean default true,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create trigger trg_report_categories_set_updated_at
    before update on public.report_categories
    for each row execute function public.set_updated_at();

alter table public.report_categories enable row level security;

create policy "report_categories: authenticated select"
on public.report_categories
for select
to authenticated
using (true);

-- 3. locations (design §5.2 — intra-school places only) -----------------
create table public.locations (
    id         uuid primary key default gen_random_uuid(),
    code       text unique,
    name       text not null,
    zone       text,
    latitude   numeric(9,6),
    longitude  numeric(9,6),
    is_active  boolean,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create trigger trg_locations_set_updated_at
    before update on public.locations
    for each row execute function public.set_updated_at();

alter table public.locations enable row level security;

create policy "locations: authenticated select"
on public.locations
for select
to authenticated
using (true);

-- 4. risk_criteria (design §5.2; content deferred D-08/O-02) ------------
create table public.risk_criteria (
    id          uuid primary key default gen_random_uuid(),
    code        text unique,
    name        text,
    weight      numeric(5,3) check (weight > 0),
    scale_min   smallint default 1,
    scale_max   smallint default 5,
    description text,
    is_active   boolean,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create trigger trg_risk_criteria_set_updated_at
    before update on public.risk_criteria
    for each row execute function public.set_updated_at();

alter table public.risk_criteria enable row level security;

create policy "risk_criteria: officer select"
on public.risk_criteria
for select
to authenticated
using (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
);

-- 5. risk_thresholds (design §5.2; values deferred D-08/O-02) -----------
create table public.risk_thresholds (
    id          uuid primary key default gen_random_uuid(),
    level       text unique check (level in ('low', 'moderate', 'high', 'critical')),
    min_score   numeric(7,3),
    max_score   numeric(7,3),
    action_hint text,
    check (min_score <= max_score),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

create trigger trg_risk_thresholds_set_updated_at
    before update on public.risk_thresholds
    for each row execute function public.set_updated_at();

alter table public.risk_thresholds enable row level security;

create policy "risk_thresholds: officer select"
on public.risk_thresholds
for select
to authenticated
using (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
);

-- 6. Scoped revokes + minimal grants (design v1.1 §14 C-01; §8) ---------
-- Controlled configuration: client roles read only; writes are
-- service_role (backend) only — no client INSERT/UPDATE/DELETE policies.
revoke all on table public.report_categories from anon, authenticated;
revoke all on table public.locations from anon, authenticated;
revoke all on table public.risk_criteria from anon, authenticated;
revoke all on table public.risk_thresholds from anon, authenticated;

grant all on table public.report_categories to service_role;
grant all on table public.locations to service_role;
grant all on table public.risk_criteria to service_role;
grant all on table public.risk_thresholds to service_role;

grant select on table public.report_categories to authenticated;
grant select on table public.locations to authenticated;
grant select on table public.risk_criteria to authenticated;
grant select on table public.risk_thresholds to authenticated;

-- 7. Documentation comments (traceability) ------------------------------
comment on table public.report_categories is
    'Database Design v1.1 §5.2 / §8 — controlled configuration; rows seeded only after O-01 on shared envs (EX-07).';
comment on table public.locations is
    'Database Design v1.1 §5.2 / §8 — intra-school places only; shared-env rows gated by O-01 (EX-07).';
comment on table public.risk_criteria is
    'Database Design v1.1 §5.2 / §8 — content deferred (D-08/O-02); officer/administrator reads.';
comment on table public.risk_thresholds is
    'Database Design v1.1 §5.2 / §8 — four-band values deferred (D-08/O-02); EX-06 guard consumes on M5.';
comment on policy "report_categories: authenticated select" on public.report_categories is
    'Design v1.1 §8 — authenticated reads; zero anon policies (V-06); writes service_role only.';
comment on policy "locations: authenticated select" on public.locations is
    'Design v1.1 §8 — authenticated reads; zero anon policies (V-06); writes service_role only.';
comment on policy "risk_criteria: officer select" on public.risk_criteria is
    'Design v1.1 §8 — role-scoped reads: TO authenticated + active profiles.role in (safety_officer, administrator); no custom JWT claims or PG roles (archive §8 posture); writes service_role only.';
comment on policy "risk_thresholds: officer select" on public.risk_thresholds is
    'Design v1.1 §8 — role-scoped reads: TO authenticated + active profiles.role in (safety_officer, administrator); no custom JWT claims or PG roles (archive §8 posture); writes service_role only.';

-- End of stage M2 (empty tables). Verification targets (plan §5, M2):
--   role scoping of risk_criteria/risk_thresholds reads; authenticated
--   reads of categories/locations; anon denial on all four; zero anon
--   policies; no rows present until O-01-gated seeding.
-- Deferred: executable assertions (A-04 undecided) and all row seeding.
