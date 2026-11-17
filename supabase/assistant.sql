-- Run once in the Supabase SQL editor (after schema.sql).
-- Adds an hourly limit for AI calls: 30 per person per hour.

create table if not exists public.ai_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_calls_user_idx on public.ai_calls (user_id, created_at desc);
alter table public.ai_calls enable row level security;
-- no policies: nobody can read or write this table directly

create or replace function public.use_assistant() returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me(); n int;
begin
  select count(*) into n from public.ai_calls
   where user_id = uid and created_at > now() - interval '1 hour';
  if n >= 30 then raise exception 'Too many questions. Try again later.'; end if;
  insert into public.ai_calls (user_id) values (uid);
end $$;
