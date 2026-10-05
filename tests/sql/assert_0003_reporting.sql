-- assert_0003_reporting.sql — plain-SQL assertions for stage M3 (applied)
--
-- Framework: D-7/A-04 approved "plain SQL" (2026-10-05).
-- Convention: tests/sql/assert_<stage>.sql — read-only; each file exits
-- non-zero / raises an exception on any failed expectation. Run e.g.:
--   docker run --rm -e PGPASSWORD postgres:16-alpine \
--     psql -h db.<ref>.supabase.co -U postgres -d postgres \
--     -v ON_ERROR_STOP=1 -f assert_0003_reporting.sql
-- Scope: structural + privilege assertions only (row-content assertions
-- require seeded data and are explicitly deferred).

do $$
declare
    n int;
    txt text;
begin
    -- [A] table + RLS
    select count(*) into n from pg_class
      where oid = 'public.reports'::regclass;
    if n <> 1 then raise exception 'A1: reports table missing'; end if;
    if not exists (select 1 from pg_class where oid='public.reports'::regclass and relrowsecurity)
    then raise exception 'A2: RLS not enabled on reports'; end if;

    -- [B] policy posture: exactly one SELECT/own-row policy, authenticated only
    select count(*) into n from pg_policies
      where schemaname='public' and tablename='reports';
    if n <> 1 then raise exception 'B1: expected exactly 1 reports policy, got %', n; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename='reports'
        and cmd='SELECT' and roles = array['authenticated']::name[]
        and qual like '%reporter_id%auth.uid()%';
    if n <> 1 then raise exception 'B2: own-row SELECT policy shape mismatch'; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename='reports'
        and (roles @> array['anon']::name[] or cmd <> 'SELECT');
    if n <> 0 then raise exception 'B3: anon or non-SELECT policy exists on reports'; end if;

    -- [C] grants: backend-controlled writes (EX-02)
    if not has_table_privilege('authenticated', 'public.reports', 'SELECT')
    then raise exception 'C1: authenticated lost SELECT'; end if;
    if has_table_privilege('authenticated', 'public.reports', 'INSERT')
       or has_table_privilege('authenticated', 'public.reports', 'UPDATE')
       or has_table_privilege('authenticated', 'public.reports', 'DELETE')
    then raise exception 'C2: authenticated holds client write privileges (EX-02 violated)'; end if;
    if has_table_privilege('anon', 'public.reports', 'SELECT')
       or has_table_privilege('anon', 'public.reports', 'INSERT')
    then raise exception 'C3: anon holds privileges on reports (V-06 violated)'; end if;
    if not has_table_privilege('service_role', 'public.reports', 'INSERT')
       or not has_table_privilege('service_role', 'public.reports', 'UPDATE')
       or not has_table_privilege('service_role', 'public.reports', 'DELETE')
    then raise exception 'C4: service_role missing write privileges'; end if;

    -- [D] indexes (v1.0 §5.3 list)
    for txt in
        select unnest(array['idx_reports_status_created_at','idx_reports_category_id',
                            'idx_reports_location_id','idx_reports_reporter_created',
                            'idx_reports_occurred_at'])
    loop
        if not exists (select 1 from pg_indexes
                       where schemaname='public' and tablename='reports' and indexname=txt)
        then raise exception 'D1: missing index %', txt; end if;
    end loop;

    -- [E] constraints
    if not exists (select 1 from pg_constraint
                   where conrelid='public.reports'::regclass and contype='c'
                     and pg_get_constraintdef(oid) like '%occurred_at%00:05:00%')
    then raise exception 'E1: occurred_at future-check missing'; end if;
    if not exists (select 1 from pg_constraint
                   where conrelid='public.reports'::regclass and contype='c'
                     and pg_get_constraintdef(oid) like '%description%2000%')
    then raise exception 'E2: description length check missing'; end if;
    if not exists (select 1 from pg_constraint
                   where conrelid='public.reports'::regclass and contype='c'
                     and pg_get_constraintdef(oid) like '%withdrawn%')
    then raise exception 'E3: status list check missing'; end if;

    -- [F] foreign keys: RESTRICT/RESTRICT/SET NULL
    if coalesce((select confdeltype from pg_constraint where conrelid='public.reports'::regclass
          and contype='f' and conname='reports_reporter_id_fkey'), '?') <> 'r'::"char"
    then raise exception 'F1: reporter_id FK not RESTRICT'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.reports'::regclass
          and contype='f' and conname='reports_category_id_fkey'), '?') <> 'r'::"char"
    then raise exception 'F2: category_id FK not RESTRICT'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.reports'::regclass
          and contype='f' and conname='reports_location_id_fkey'), '?') <> 'n'::"char"
    then raise exception 'F3: location_id FK not SET NULL'; end if;

    -- [G] empty by design (no seeding in M3)
    select count(*) into n from public.reports;
    if n <> 0 then raise exception 'G1: reports not empty (expected 0 rows)'; end if;

    -- [H] M1/M2 regression guards
    if not exists (select 1 from pg_class where oid='public.profiles'::regclass)
    then raise exception 'H1: profiles (M1) missing'; end if;
    select count(*) into n from pg_policies where schemaname='public' and tablename='profiles';
    if n <> 2 then raise exception 'H2: profiles policy count changed (got %)', n; end if;
    select count(*) into n from pg_policies where schemaname='public'
      and tablename in ('report_categories','locations','risk_criteria','risk_thresholds');
    if n <> 4 then raise exception 'H3: M2 reference policy count changed (got %)', n; end if;
    select count(*) into n from pg_tables where schemaname='public';
    if n <> 6 then raise exception 'H4: public table count changed (got %, expected 6)', n; end if;

    raise notice 'ASSERT PASS: 0003_reporting (all sections A-H)';
end $$;
