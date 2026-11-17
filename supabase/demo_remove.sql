-- Removes all demo data created by supabase/demo.sql (people, their skills, problems, resources).
-- Real accounts are not touched.
delete from auth.users where email like '%@demo.repair.test';
