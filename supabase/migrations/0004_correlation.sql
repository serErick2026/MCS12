-- 0004_correlation.sql — Stage M4: incident correlation
--
-- Project:   School Safety Intelligence and Notification System (MCS12)
-- Design:    docs/database-design.md — APPROVED DESIGN BASELINE, Version 1.1
--            §3 conventions, §5.4 incident correlation (= v1.0 §5.4,
--            docs/database-design-archive-v1.0.md), §8 RLS policies,
--            §10.1 community-feed allowlist (O-05/O-09 approved).
-- Plan:      docs/database-migration-plan-v0.4-proposed.md — stage M4 (§14).
-- Authority: continuous-development protocol (drafting authorized
--            2026-10-05). Applying this file requires the separate
--            per-migration G-3 approval.
--
-- STATUS: DRAFT — NOT APPLIED. Apply only after explicit human G-3
-- approval with a fresh pre-apply export/backup check (D-GATE-01).
--
-- Design posture (v1.1 §8 / v1.0 §8, unchanged):
--   * SELECT, INSERT, UPDATE for officer/administrator only (role
--     predicate on active profiles.role); "backend is primary path" —
--     client policies are the backstop.
--   * NO DELETE policy or grant on either table.
--   * Community publication fields (O-05/O-09 seven-field allowlist)
--     are backend-written only: excluded from every client column
--     grant, so PostgREST rejects any client attempt to touch them.
--   * opened_by / linked_by are backend-derived (excluded from client
--     INSERT grants) — mirrors the D-03 reporter_id posture.
--   * Members see incidents only via the server-side community feed
--     path (O-09/D-07) — no member policy here.
--   * Zero anon policies (V-06); anon holds no table privileges (C-01).
--   * NO INSERT statements — schema only; no EX-07 values seeded.
--   * Reuses public.set_updated_at() from M2 (no M1–M3 objects touched).
--
-- Documented interpretations (flagged in G-3 review):
--   * incidents.category_id: FK RESTRICT as written; nullable (the
--     v1.0 §5.4 spec does not mark it NOT NULL, unlike reports §5.3).
--   * is_synthetic: boolean DEFAULT false (consistent with reports).
--   * Client INSERT column set excludes id/opened_by/is_synthetic/
--     community_*; client UPDATE excludes id/opened_by/is_synthetic/
--     community_*/created_at/updated_at; incident_reports client
--     UPDATE is limited to link_method/link_confidence (re-linking is
--     a backend operation).
-- ------------------------------------------------------------------------

-- 1. incidents (design §5.4) ---------------------------------------------
create table public.incidents (
    id                     uuid primary key default gen_random_uuid(),
    title                  text not null check (char_length(title) between 1 and 120),
    category_id            uuid references public.report_categories(id) on delete restrict,
    location_id            uuid references public.locations(id) on delete set null,
    status                 text not null default 'open'
                           check (status in ('open', 'investigating', 'contained',
                                             'closed', 'invalid')),
    severity               smallint check (severity between 1 and 5),
    first_reported_at      timestamptz not null,
    last_reported_at       timestamptz not null,
    opened_by              uuid references public.profiles(id) on delete set null,
    closed_at              timestamptz,
    summary                text,
    community_summary      text,
    community_guidance     text,
    is_community_visible   boolean not null default false,
    community_published_at timestamptz,
    community_updated_at   timestamptz,
    is_synthetic           boolean default false,
    created_at             timestamptz not null default now(),
    updated_at             timestamptz not null default now()
);

create trigger trg_incidents_set_updated_at
    before update on public.incidents
    for each row execute function public.set_updated_at();

alter table public.incidents enable row level security;

-- 2. incident_reports (design §5.4) --------------------------------------
create table public.incident_reports (
    id              uuid primary key default gen_random_uuid(),
    incident_id     uuid not null references public.incidents(id) on delete cascade,
    report_id       uuid not null unique references public.reports(id) on delete cascade,
    link_method     text not null check (link_method in ('manual', 'auto')),
    link_confidence numeric(4,3) check (link_confidence >= 0 and link_confidence <= 1),
    linked_by       uuid references public.profiles(id) on delete set null,
    linked_at       timestamptz not null default now()
);

alter table public.incident_reports enable row level security;

-- 3. Policies (v1.1 §8): officer/administrator SELECT/INSERT/UPDATE,
--    role predicate on active profiles (pattern proven in M2).
--    NO DELETE policies. Zero anon. -------------------------------------
create policy "incidents: officer select"
on public.incidents
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

create policy "incidents: officer insert"
on public.incidents
for insert
to authenticated
with check (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
);

create policy "incidents: officer update"
on public.incidents
for update
to authenticated
using (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
)
with check (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
);

create policy "incident_reports: officer select"
on public.incident_reports
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

create policy "incident_reports: officer insert"
on public.incident_reports
for insert
to authenticated
with check (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
);

create policy "incident_reports: officer update"
on public.incident_reports
for update
to authenticated
using (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
)
with check (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('safety_officer', 'administrator')
          and p.is_active = true
    )
);

-- 4. Scoped revokes + minimal grants (v1.1 §14 C-01; §8) ---------------
revoke all on table public.incidents from anon, authenticated;
revoke all on table public.incident_reports from anon, authenticated;

grant all on table public.incidents to service_role;
grant all on table public.incident_reports to service_role;

grant select on table public.incidents to authenticated;
grant insert (title, category_id, location_id, status, severity,
              first_reported_at, last_reported_at, summary)
    on table public.incidents to authenticated;
grant update (title, category_id, location_id, status, severity,
              first_reported_at, last_reported_at, closed_at, summary)
    on table public.incidents to authenticated;

grant select on table public.incident_reports to authenticated;
grant insert (incident_id, report_id, link_method, link_confidence)
    on table public.incident_reports to authenticated;
grant update (link_method, link_confidence)
    on table public.incident_reports to authenticated;

-- 5. Indexes (v1.0 §5.4 list) -------------------------------------------
create index idx_incidents_status_created
    on public.incidents (status, created_at desc);
create index idx_incidents_location_id
    on public.incidents (location_id);
create index idx_incidents_category_id
    on public.incidents (category_id);
create index idx_incidents_community_visible
    on public.incidents (is_community_visible)
    where is_community_visible;
create index idx_incident_reports_incident_id
    on public.incident_reports (incident_id);

-- 6. Documentation comments (traceability) ------------------------------
comment on table public.incidents is
    'Database Design v1.1 §5.4 / §8 / §10.1 — incident correlation; community publication fields serve the O-05/O-09 seven-field allowlist (backend-written only); officer/administrator policies are the backstop, backend is the primary path; no client DELETE; members read via server feed only (O-09/D-07).';
comment on table public.incident_reports is
    'Database Design v1.1 §5.4 — report↔incident links (1 report ↔ 1 incident via UNIQUE report_id, CASCADE both sides); officer/administrator policies, backend primary path, no client DELETE.';
comment on policy "incidents: officer select" on public.incidents is
    'Design v1.1 §8 — officer/administrator role predicate on active profiles; zero anon policies (V-06).';
comment on policy "incidents: officer insert" on public.incidents is
    'Design v1.1 §8 — backstop for backend-first creation; opened_by and community fields excluded from client column grants.';
comment on policy "incidents: officer update" on public.incidents is
    'Design v1.1 §8 — backstop for backend-first updates; community publication fields not client-updatable (O-05/O-09).';
comment on policy "incident_reports: officer select" on public.incident_reports is
    'Design v1.1 §8 — officer/administrator role predicate; zero anon policies (V-06).';
comment on policy "incident_reports: officer insert" on public.incident_reports is
    'Design v1.1 §8 — backstop for backend-first linking; linked_by excluded from client grants.';
comment on policy "incident_reports: officer update" on public.incident_reports is
    'Design v1.1 §8 — client UPDATE limited to link_method/link_confidence; re-linking is backend-only.';

-- End of stage M4 (schema only). Verification targets (plan §14):
--   * officer vs member visibility on populated rows (deferred to data);
--   * community-column write rejection from clients (verifiable now);
--   * UNIQUE report_id, CASCADE behaviours, partial index;
--   * anon 401 on both new tables; M1–M3 regression guards.
-- Deferred: executable assertions ship as
-- tests/sql/assert_0004_correlation.sql (A-04 per D-7); all row content
-- requires approved synthetic identities only — no seeding here.
