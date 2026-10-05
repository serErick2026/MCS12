-- assert_0004_correlation.sql — plain-SQL assertions for stage M4
--
-- Framework: D-7/A-04 plain SQL (approved 2026-10-05).
-- Read-only; raises an exception on any failed expectation:
--   docker run --rm -e PGPASSWORD postgres:16-alpine \
--     psql -h <pooler-host> -p 6543 -U postgres.<ref> -d postgres \
--     -v ON_ERROR_STOP=1 -f assert_0004_correlation.sql
-- Scope: structural + privilege assertions; row-content/RLS-filtering
-- assertions for populated data are explicitly deferred.

do $$
declare
    n int;
    txt text;
begin
    -- [A] tables + RLS
    if not exists (select 1 from pg_class where oid='public.incidents'::regclass)
    then raise exception 'A1: incidents table missing'; end if;
    if not exists (select 1 from pg_class where oid='public.incident_reports'::regclass)
    then raise exception 'A2: incident_reports table missing'; end if;
    if not exists (select 1 from pg_class where oid='public.incidents'::regclass and relrowsecurity)
    then raise exception 'A3: RLS not enabled on incidents'; end if;
    if not exists (select 1 from pg_class where oid='public.incident_reports'::regclass and relrowsecurity)
    then raise exception 'A4: RLS not enabled on incident_reports'; end if;

    -- [B] policies: 3 per table, authenticated-only, SELECT/INSERT/UPDATE,
    --     role predicate present; zero anon; zero DELETE anywhere
    select count(*) into n from pg_policies
      where schemaname='public' and tablename='incidents';
    if n <> 3 then raise exception 'B1: expected 3 incidents policies, got %', n; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename='incident_reports';
    if n <> 3 then raise exception 'B2: expected 3 incident_reports policies, got %', n; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename in ('incidents','incident_reports')
        and (roles <> array['authenticated']::name[]
             or cmd not in ('SELECT','INSERT','UPDATE')
             or (coalesce(qual,'') || coalesce(with_check,'')) not like '%profiles%');
    if n <> 0 then raise exception 'B3: unexpected policy shape (roles/cmd/predicate) count=%', n; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and tablename in ('incidents','incident_reports')
        and (roles @> array['anon']::name[] or cmd='DELETE');
    if n <> 0 then raise exception 'B4: anon or DELETE policy exists on M4 tables'; end if;
    select count(*) into n from pg_policies
      where schemaname='public' and roles @> array['anon']::name[];
    if n <> 0 then raise exception 'B5: anon policy exists database-wide (V-06)'; end if;

    -- [C] grants: backend-controlled posture + community-column lockdown
    if not has_table_privilege('authenticated','public.incidents','SELECT')
       or not has_table_privilege('authenticated','public.incident_reports','SELECT')
    then raise exception 'C1: authenticated lost SELECT'; end if;
    if has_table_privilege('authenticated','public.incidents','DELETE')
       or has_table_privilege('authenticated','public.incident_reports','DELETE')
       or has_table_privilege('authenticated','public.incidents','TRUNCATE')
    then raise exception 'C2: authenticated holds DELETE/TRUNCATE (no-client-DELETE violated)'; end if;
    if has_table_privilege('anon','public.incidents','SELECT')
       or has_table_privilege('anon','public.incidents','INSERT')
       or has_table_privilege('anon','public.incident_reports','SELECT')
       or has_table_privilege('anon','public.reports','SELECT')
    then raise exception 'C3: anon holds privileges (C-01 violated)'; end if;
    if not has_table_privilege('service_role','public.incidents','UPDATE')
       or not has_table_privilege('service_role','public.incident_reports','INSERT')
    then raise exception 'C4: service_role missing backend privileges'; end if;
    for txt in
        select unnest(array['community_summary','community_guidance',
                            'is_community_visible','community_published_at',
                            'community_updated_at','opened_by','is_synthetic'])
    loop
        if has_column_privilege('authenticated','public.incidents', txt, 'INSERT')
           or has_column_privilege('authenticated','public.incidents', txt, 'UPDATE')
        then raise exception 'C5: client can write protected incidents column % (O-05/O-09 violated)', txt; end if;
    end loop;
    for txt in select unnest(array['linked_by','linked_at','id'])
    loop
        if has_column_privilege('authenticated','public.incident_reports', txt, 'INSERT')
           or has_column_privilege('authenticated','public.incident_reports', txt, 'UPDATE')
        then raise exception 'C6: client can write backend-owned incident_reports column %', txt; end if;
    end loop;
    if not has_column_privilege('authenticated','public.incidents','title','INSERT')
       or not has_column_privilege('authenticated','public.incidents','summary','UPDATE')
    then raise exception 'C7: officer client backstop columns missing'; end if;

    -- [D] constraints
    if not exists (select 1 from pg_constraint where conrelid='public.incidents'::regclass
                     and contype='c' and pg_get_constraintdef(oid) like '%title%120%')
    then raise exception 'D1: title length check missing'; end if;
    if not exists (select 1 from pg_constraint where conrelid='public.incidents'::regclass
                     and contype='c' and pg_get_constraintdef(oid) like '%investigating%')
    then raise exception 'D2: status list check missing'; end if;
    if not exists (select 1 from pg_constraint where conrelid='public.incidents'::regclass
                     and contype='c' and pg_get_constraintdef(oid) like '%severity%5%')
    then raise exception 'D3: severity check missing'; end if;
    if not exists (select 1 from pg_constraint where conrelid='public.incident_reports'::regclass
                     and contype='c' and pg_get_constraintdef(oid) like '%manual%auto%')
    then raise exception 'D4: link_method check missing'; end if;
    if not exists (select 1 from pg_constraint where conrelid='public.incident_reports'::regclass
                     and contype='c' and pg_get_constraintdef(oid) like '%link_confidence%')
    then raise exception 'D5: link_confidence check missing'; end if;
    if not exists (select 1 from pg_constraint where conrelid='public.incident_reports'::regclass
                     and contype='u')
    then raise exception 'D6: UNIQUE(report_id) missing (1 report to 1 incident)'; end if;

    -- [E] foreign keys: RESTRICT / SET NULL / SET NULL / CASCADE / CASCADE / SET NULL
    if coalesce((select confdeltype from pg_constraint where conrelid='public.incidents'::regclass
                   and contype='f' and conname='incidents_category_id_fkey'),'?') <> 'r'::"char"
    then raise exception 'E1: incidents.category_id FK not RESTRICT'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.incidents'::regclass
                   and contype='f' and conname='incidents_location_id_fkey'),'?') <> 'n'::"char"
    then raise exception 'E2: incidents.location_id FK not SET NULL'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.incidents'::regclass
                   and contype='f' and conname='incidents_opened_by_fkey'),'?') <> 'n'::"char"
    then raise exception 'E3: incidents.opened_by FK not SET NULL'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.incident_reports'::regclass
                   and contype='f' and conname='incident_reports_incident_id_fkey'),'?') <> 'c'::"char"
    then raise exception 'E4: incident_reports.incident_id FK not CASCADE'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.incident_reports'::regclass
                   and contype='f' and conname='incident_reports_report_id_fkey'),'?') <> 'c'::"char"
    then raise exception 'E5: incident_reports.report_id FK not CASCADE'; end if;
    if coalesce((select confdeltype from pg_constraint where conrelid='public.incident_reports'::regclass
                   and contype='f' and conname='incident_reports_linked_by_fkey'),'?') <> 'n'::"char"
    then raise exception 'E6: incident_reports.linked_by FK not SET NULL'; end if;

    -- [F] indexes incl. partial community-visibility index
    for txt in
        select unnest(array['idx_incidents_status_created','idx_incidents_location_id',
                            'idx_incidents_category_id','idx_incidents_community_visible',
                            'idx_incident_reports_incident_id'])
    loop
        select count(*) into n from pg_indexes
          where schemaname='public' and indexname=txt;
        if n <> 1 then raise exception 'F1: missing index %', txt; end if;
    end loop;
    if not exists (select 1 from pg_indexes where schemaname='public'
                     and indexname='idx_incidents_community_visible'
                     and indexdef like '%WHERE%is_community_visible%')
    then raise exception 'F2: community-visibility index is not partial'; end if;

    -- [G] empty by design (no seeding in M4)
    if (select count(*) from public.incidents) <> 0
    then raise exception 'G1: incidents not empty'; end if;
    if (select count(*) from public.incident_reports) <> 0
    then raise exception 'G2: incident_reports not empty'; end if;

    -- [H] M1-M3 regression guards
    select count(*) into n from pg_tables where schemaname='public';
    if n <> 8 then raise exception 'H1: public table count changed (got %, expected 8)', n; end if;
    select count(*) into n from pg_policies where schemaname='public' and tablename='profiles';
    if n <> 2 then raise exception 'H2: profiles policy count changed'; end if;
    select count(*) into n from pg_policies where schemaname='public'
      and tablename in ('report_categories','locations','risk_criteria','risk_thresholds');
    if n <> 4 then raise exception 'H3: M2 policy count changed'; end if;
    select count(*) into n from pg_policies where schemaname='public' and tablename='reports';
    if n <> 1 then raise exception 'H4: reports policy count changed'; end if;
    if not exists (select 1 from pg_class where oid='public.profiles'::regclass)
       or not exists (select 1 from pg_class where oid='public.reports'::regclass)
    then raise exception 'H5: M1/M3 table missing'; end if;

    raise notice 'ASSERT PASS: 0004_correlation (all sections A-H)';
end $$;
