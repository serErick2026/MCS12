-- 0001_identity.sql — Stage M1: identity foundation
--
-- Project:   School Safety Intelligence and Notification System (MCS12)
-- Design:    docs/database-design.md — APPROVED DESIGN BASELINE, Version 1.1
--            (2026-10-04): §3 conventions, §5.1 profiles, §8 RLS,
--            §9 role-freeze rationale, §14 conflicts C-01/C-02.
-- Plan:      docs/database-migration-plan-v0.3-proposed.md — stage M1.
-- Authority: G-1 approved 2026-10-04 (drafting + static review only).
--
-- STATUS: DRAFT — NOT APPLIED, NOT EXECUTED. No database connection was
-- made while producing this file. Applying requires gate G-2 (local stack;
-- Docker decision pending) and a separate human authorization.
--
-- Authorized scope (G-1): profiles table; updated_at trigger; role-freeze
-- trigger; column-level grants; deny-by-default RLS policies; scoped
-- revokes. No rows/inserts, no assertion scripts, no later stages.
-- Deliberately out of scope (future review, not authorized here):
-- schema-wide ALTER DEFAULT PRIVILEGES hardening.
-- ------------------------------------------------------------------------

-- 1. Table (design v1.1 §3 conventions; §5.1 profiles) ------------------
create table public.profiles (
    id          uuid primary key references auth.users (id) on delete cascade,
    role        text not null default 'member'
                check (role in ('administrator', 'safety_officer', 'member', 'viewer')),
    display_name text not null check (char_length(display_name) between 1 and 60),
    is_active   boolean not null default true,
    is_synthetic boolean not null default false,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

comment on table public.profiles is
    'Database Design v1.1 §5.1 — application identity, 1:1 with auth.users; backend-only role assignment.';

-- 2. updated_at maintenance trigger (design v1.1 §3) ---------------------
create or replace function public.profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger trg_profiles_set_updated_at
    before update on public.profiles
    for each row
    execute function public.profiles_set_updated_at();

-- 3. Role-freeze trigger (design v1.1 §5.1, §14 C-02) --------------------
-- Defense in depth on top of column-level grants: role/is_active may only
-- change when the request JWT role is service_role (backend path).
-- Fail-closed: missing or malformed claims => exception.
create or replace function public.profiles_protect_privileged_columns()
returns trigger
language plpgsql
as $$
declare
    jwt_role text;
begin
    if (new.role is distinct from old.role)
       or (new.is_active is distinct from old.is_active) then
        jwt_role := (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}'))::jsonb ->> 'role';
        if jwt_role is distinct from 'service_role' then
            raise exception 'profiles: role and is_active may only be modified by the backend (service_role)';
        end if;
    end if;
    return new;
end;
$$;

create trigger trg_profiles_protect_privileged_columns
    before update on public.profiles
    for each row
    execute function public.profiles_protect_privileged_columns();

-- 4. RLS — deny-by-default (design v1.1 §8; no anon policy exists) -------
alter table public.profiles enable row level security;

create policy "profiles: select own row"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles: update own row"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- No INSERT / DELETE policies: client writes are denied (design v1.1 §8;
-- profiles INSERT/DELETE are service_role only).
-- No policy targets 'anon' (design v1.1 §8, verification V-06).

-- 5. Scoped revokes + minimal grants (design v1.1 §14 C-01) --------------
revoke all on table public.profiles from anon, authenticated;
grant  all on table public.profiles to service_role;          -- backend writer (C-04)
grant  select on table public.profiles to authenticated;
grant  update (display_name) on table public.profiles to authenticated;
-- Clients: SELECT + UPDATE(display_name) only. role, is_active and all
-- other columns are backend-writable exclusively (column grants layer 1).

revoke execute on function public.profiles_set_updated_at() from public, anon, authenticated;
revoke execute on function public.profiles_protect_privileged_columns() from public, anon, authenticated;

-- 6. Documentation comments (policy/implementation traceability) ---------
comment on policy "profiles: select own row" on public.profiles is
    'Design v1.1 §8 — members read own row only; administrators read via backend; anon denied (V-06).';
comment on policy "profiles: update own row" on public.profiles is
    'Design v1.1 §8 — own row via policy; column grant limits writes to display_name; role-freeze trigger (C-02) blocks escalation.';

-- End of stage M1. Verification targets (design v1.1 §16 / plan M1):
--   anon denied; own-row visibility; role/is_active escalation blocked;
--   display_name update succeeds; backend (service_role) path succeeds.
-- Deferred: executable assertion scripts (G-2, Docker pending).
