-- Security audit queries. Run in the Supabase SQL editor. Every result should be EMPTY (except check 5).

-- 1. Tables in public WITHOUT row level security (must be empty)
select c.relname as table_without_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2. Tables with RLS on but NO policy (only ai_calls, audit_log are allowed here: locked on purpose)
select c.relname as table_with_no_policy
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  and not exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname);

-- 3. SECURITY DEFINER functions without a fixed search_path (must be empty)
select p.proname as definer_without_search_path
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) x where x like 'search_path=%');

-- 4. Policies that allow anyone (anon) to write (must be empty)
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and cmd in ('INSERT','UPDATE','DELETE','ALL')
  and (roles @> '{anon}' or roles @> '{public}');

-- 5. Views that bypass RLS (expected: only public_cases)
select c.relname as view_name
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v';

-- 6. Admin accounts (review this list)
select id, display_name from public.profiles where is_admin;
