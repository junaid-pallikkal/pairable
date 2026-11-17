-- RePair phase 9. Run ONCE in the Supabase SQL editor, after schema.sql.
-- Adds: resources, blocking, reporting, verification, admin tools, suspended-account lockout.
-- Safe to run twice.

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and is_admin and status = 'active');
$$;

create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and status = 'active');
$$;

-- Suspended or banned people can no longer use any action
create or replace function public.me() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.profiles where id = uid and status = 'active') then
    raise exception 'Account is not active';
  end if;
  return uid;
end $$;

-- ============================================================
-- Verification level on profiles (users cannot change it themselves)
-- ============================================================
alter table public.profiles
  add column if not exists verification text not null default 'none'
  check (verification in ('none','email','phone','id'));

create or replace function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('app.rpc', true), '') <> 'on'
     and (new.is_admin is distinct from old.is_admin
          or new.status is distinct from old.status
          or new.verification is distinct from old.verification) then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;

-- ============================================================
-- Resources
-- ============================================================
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  direction text not null check (direction in ('offer','request')),
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 1000),
  kind text not null default 'physical' check (kind in ('physical','digital','space')),
  category_id uuid references public.categories(id),
  city text,
  state text,
  status text not null default 'available' check (status in ('available','reserved','unavailable')),
  hidden_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists resources_owner_idx on public.resources (owner_id);
create index if not exists resources_browse_idx on public.resources (direction, status);
drop trigger if exists resources_updated on public.resources;
create trigger resources_updated before update on public.resources
  for each row execute function public.set_updated_at();

create or replace function public.guard_resource() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and new.hidden_by_admin is distinct from old.hidden_by_admin
     and coalesce(current_setting('app.rpc', true), '') <> 'on' then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
drop trigger if exists resources_guard on public.resources;
create trigger resources_guard before update on public.resources
  for each row execute function public.guard_resource();

alter table public.resources enable row level security;
drop policy if exists resources_read on public.resources;
create policy resources_read on public.resources for select to authenticated
  using (owner_id = auth.uid() or (status in ('available','reserved') and not hidden_by_admin));
drop policy if exists resources_insert on public.resources;
create policy resources_insert on public.resources for insert to authenticated
  with check (owner_id = auth.uid() and not hidden_by_admin);
drop policy if exists resources_update on public.resources;
create policy resources_update on public.resources for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists resources_delete on public.resources;
create policy resources_delete on public.resources for delete to authenticated
  using (owner_id = auth.uid());

-- A request can point at a resource
alter table public.connections
  add column if not exists resource_id uuid references public.resources(id) on delete set null;

-- ============================================================
-- Blocks
-- ============================================================
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
drop policy if exists blocks_read on public.blocks;
create policy blocks_read on public.blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists blocks_delete on public.blocks;
create policy blocks_delete on public.blocks for delete to authenticated using (blocker_id = auth.uid());
-- inserting goes through block_user()

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me();
begin
  if p_user = uid then raise exception 'Not allowed'; end if;
  insert into public.blocks (blocker_id, blocked_id) values (uid, p_user) on conflict do nothing;
  update public.connections set status = 'cancelled'
   where status in ('pending','clarification_requested')
     and ((seeker_id = uid and solver_id = p_user) or (seeker_id = p_user and solver_id = uid));
  update public.connections set status = 'closed'
   where status = 'accepted'
     and ((seeker_id = uid and solver_id = p_user) or (seeker_id = p_user and solver_id = uid));
end $$;

create or replace function public.block_guard_connections() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.is_blocked_between(new.seeker_id, new.solver_id) then
    raise exception 'This person is not available';
  end if;
  return new;
end $$;
drop trigger if exists connections_block on public.connections;
create trigger connections_block before insert on public.connections
  for each row execute function public.block_guard_connections();

create or replace function public.block_guard_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.connections;
begin
  select * into c from public.connections where id = new.connection_id;
  if public.is_blocked_between(c.seeker_id, c.solver_id) then
    raise exception 'Message not sent';
  end if;
  return new;
end $$;
drop trigger if exists messages_block on public.messages;
create trigger messages_block before insert on public.messages
  for each row execute function public.block_guard_messages();

-- Matching: keep the original as run_matching_core, wrap it to remove blocked people
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'run_matching_core') then
    alter function public.run_matching(uuid) rename to run_matching_core;
  end if;
end $$;

create or replace function public.run_matching(p_case uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  perform public.run_matching_core(p_case);
  delete from public.matches m using public.cases c
   where m.case_id = p_case and c.id = p_case and public.is_blocked_between(c.owner_id, m.profile_id);
  update public.matches m set rank = r.rn
    from (select id, row_number() over (order by rank) as rn from public.matches where case_id = p_case) r
   where m.id = r.id;
  select count(*) into n from public.matches where case_id = p_case;
  return n;
end $$;

-- ============================================================
-- Resource matching and requests
-- ============================================================
create or replace function public.resources_for_case(p_case uuid)
returns table (id uuid, title text, description text, kind text, city text, state text, owner_id uuid, owner_name text, reason text)
language plpgsql stable security definer set search_path = '' as $$
declare c public.cases;
begin
  select * into c from public.cases where cases.id = p_case;
  if c.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  return query
  select r.id, r.title, r.description, r.kind, r.city, r.state, r.owner_id, p.display_name,
         case
           when r.category_id is not null and r.category_id = c.category_id then 'Same category as your problem'
           else 'Mentions ' || (select s.name from public.case_skills cs join public.skills s on s.id = cs.skill_id
                                where cs.case_id = c.id
                                  and (r.title ilike '%' || s.name || '%' or coalesce(r.description,'') ilike '%' || s.name || '%')
                                limit 1)
         end
  from public.resources r
  join public.profiles p on p.id = r.owner_id
  where r.direction = 'offer' and r.status = 'available' and not r.hidden_by_admin
    and r.owner_id <> c.owner_id and p.status = 'active'
    and not public.is_blocked_between(c.owner_id, r.owner_id)
    and (r.kind = 'digital' or (c.city is not null and lower(r.city) = lower(c.city)))
    and (
      (r.category_id is not null and r.category_id = c.category_id)
      or exists (select 1 from public.case_skills cs join public.skills s on s.id = cs.skill_id
                 where cs.case_id = c.id
                   and (r.title ilike '%' || s.name || '%' or coalesce(r.description,'') ilike '%' || s.name || '%'))
    )
  order by r.created_at desc
  limit 10;
end $$;

create or replace function public.request_resource(p_case uuid, p_resource uuid, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.cases; r public.resources; uid uuid := public.me(); new_id uuid; pend int;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.owner_id <> uid then raise exception 'Not allowed'; end if;
  if c.status not in ('open','in_progress') then raise exception 'This problem is not open'; end if;
  select * into r from public.resources where id = p_resource;
  if r.id is null or r.direction <> 'offer' or r.status <> 'available' or r.hidden_by_admin then
    raise exception 'This resource is not available';
  end if;
  if r.owner_id = uid then raise exception 'You cannot invite yourself'; end if;
  select count(*) into pend from public.connections
   where initiated_by = uid and status in ('pending','clarification_requested');
  if pend >= 10 then raise exception 'Too many open requests. Wait for replies.'; end if;
  insert into public.connections (case_id, seeker_id, solver_id, initiated_by, message, resource_id)
  values (p_case, uid, r.owner_id, uid, nullif(trim(p_message), ''), p_resource)
  returning id into new_id;
  return new_id;
end $$;

-- ============================================================
-- Reports and audit log
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('user','case','message','resource')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','abuse','fake','unsafe','other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  handled_by uuid references public.profiles(id),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists reports_read on public.reports;
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid());

create or replace function public.limit_reports() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports
       where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too many reports today';
  end if;
  return new;
end $$;
drop trigger if exists reports_limit on public.reports;
create trigger reports_limit before insert on public.reports
  for each row execute function public.limit_reports();

create table if not exists public.audit_log (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
-- no policies: only the admin functions below write it; admins read it through admin_audit()

-- ============================================================
-- Verification requests
-- ============================================================
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  note text check (char_length(note) <= 500),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  level text check (level in ('email','phone','id')),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists verification_one_open
  on public.verification_requests (user_id) where status = 'submitted';
alter table public.verification_requests enable row level security;
drop policy if exists verif_insert on public.verification_requests;
create policy verif_insert on public.verification_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'submitted');
drop policy if exists verif_read on public.verification_requests;
create policy verif_read on public.verification_requests for select to authenticated using (user_id = auth.uid());

-- ============================================================
-- Admin: categories and skills (direct, guarded by is_admin())
-- ============================================================
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists skills_admin_update on public.skills;
create policy skills_admin_update on public.skills for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists skills_admin_delete on public.skills;
create policy skills_admin_delete on public.skills for delete to authenticated using (public.is_admin());

-- ============================================================
-- Admin functions (every one checks is_admin() first)
-- ============================================================
create or replace function public.admin_check() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Not allowed'; end if;
  return auth.uid();
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'suspended', (select count(*) from public.profiles where status <> 'active'),
    'cases_open', (select count(*) from public.cases where status in ('open','in_progress','resolution_proposed')),
    'cases_resolved', (select count(*) from public.cases where status = 'resolved'),
    'connections_accepted', (select count(*) from public.connections where status in ('accepted','closed')),
    'resources', (select count(*) from public.resources where not hidden_by_admin),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'submitted')
  );
end $$;

create or replace function public.admin_users(p_q text default '')
returns table (id uuid, display_name text, email text, intent text, status text, verification text, is_admin boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return query
  select p.id, p.display_name, u.email::text, p.intent, p.status, p.verification, p.is_admin, p.created_at
  from public.profiles p join auth.users u on u.id = p.id
  where coalesce(p_q, '') = '' or p.display_name ilike '%' || p_q || '%' or u.email ilike '%' || p_q || '%'
  order by p.created_at desc limit 100;
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare admin_id uuid := public.admin_check();
begin
  if p_status not in ('active','suspended','banned') then raise exception 'Not allowed'; end if;
  if p_user = admin_id then raise exception 'Not allowed'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.profiles set status = p_status where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (admin_id, 'set_user_status', 'profile', p_user, jsonb_build_object('status', p_status, 'reason', p_reason));
end $$;

create or replace function public.admin_set_verification(p_user uuid, p_level text)
returns void language plpgsql security definer set search_path = '' as $$
declare admin_id uuid := public.admin_check();
begin
  if p_level not in ('none','email','phone','id') then raise exception 'Not allowed'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.profiles set verification = p_level where id = p_user;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (admin_id, 'set_verification', 'profile', p_user, jsonb_build_object('level', p_level));
end $$;

create or replace function public.admin_cases(p_status text default '')
returns table (id uuid, title text, owner_name text, status text, visibility text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return query
  select c.id, c.title, p.display_name, c.status, c.visibility, c.created_at
  from public.cases c join public.profiles p on p.id = c.owner_id
  where coalesce(p_status, '') = '' or c.status = p_status
  order by c.created_at desc limit 100;
end $$;

create or replace function public.admin_close_case(p_case uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare admin_id uuid := public.admin_check();
begin
  perform set_config('app.rpc', 'on', true);
  update public.cases set status = 'closed' where id = p_case and status not in ('resolved','closed');
  update public.connections set status = 'cancelled' where case_id = p_case and status in ('pending','clarification_requested');
  update public.connections set status = 'closed' where case_id = p_case and status = 'accepted';
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (admin_id, 'close_case', 'case', p_case, jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_reports(p_status text default 'open')
returns table (id uuid, reporter_name text, target_type text, target_id uuid, target_label text,
               reason text, details text, status text, admin_note text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return query
  select r.id, p.display_name, r.target_type, r.target_id,
    case r.target_type
      when 'user' then (select display_name from public.profiles where profiles.id = r.target_id)
      when 'case' then (select title from public.cases where cases.id = r.target_id)
      when 'resource' then (select title from public.resources where resources.id = r.target_id)
      when 'message' then (select left(body, 120) from public.messages where messages.id = r.target_id)
    end,
    r.reason, r.details, r.status, r.admin_note, r.created_at
  from public.reports r join public.profiles p on p.id = r.reporter_id
  where coalesce(p_status, '') = '' or r.status = p_status
  order by r.created_at desc limit 100;
end $$;

-- p_effect: none | hide_content | suspend_user
create or replace function public.admin_resolve_report(p_report uuid, p_action text, p_effect text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare admin_id uuid := public.admin_check(); r public.reports; owner uuid;
begin
  if p_action not in ('actioned','dismissed') or p_effect not in ('none','hide_content','suspend_user') then
    raise exception 'Not allowed';
  end if;
  select * into r from public.reports where id = p_report;
  if r.id is null or r.status <> 'open' then raise exception 'Not allowed'; end if;

  perform set_config('app.rpc', 'on', true);
  if p_action = 'actioned' and p_effect <> 'none' then
    owner := case r.target_type
      when 'user' then r.target_id
      when 'case' then (select owner_id from public.cases where id = r.target_id)
      when 'resource' then (select owner_id from public.resources where id = r.target_id)
      when 'message' then (select sender_id from public.messages where id = r.target_id)
    end;
    if p_effect = 'hide_content' then
      if r.target_type = 'case' then
        update public.cases set status = 'closed' where id = r.target_id and status not in ('resolved','closed');
      elsif r.target_type = 'resource' then
        update public.resources set hidden_by_admin = true where id = r.target_id;
      end if;
    elsif p_effect = 'suspend_user' and owner is not null and owner <> admin_id then
      update public.profiles set status = 'suspended' where id = owner;
    end if;
  end if;

  update public.reports
     set status = p_action, handled_by = admin_id, admin_note = nullif(trim(p_note), ''), resolved_at = now()
   where id = p_report;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (admin_id, 'resolve_report', 'report', p_report, jsonb_build_object('action', p_action, 'effect', p_effect));
  perform public.notify(r.reporter_id, 'report_update', 'Your report was reviewed', '/app');
end $$;

create or replace function public.admin_verification_requests()
returns table (id uuid, user_id uuid, display_name text, note text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return query
  select v.id, v.user_id, p.display_name, v.note, v.created_at
  from public.verification_requests v join public.profiles p on p.id = v.user_id
  where v.status = 'submitted' order by v.created_at;
end $$;

create or replace function public.admin_review_verification(p_request uuid, p_approve boolean, p_level text default 'id')
returns void language plpgsql security definer set search_path = '' as $$
declare admin_id uuid := public.admin_check(); v public.verification_requests;
begin
  if p_level not in ('email','phone','id') then raise exception 'Not allowed'; end if;
  select * into v from public.verification_requests where id = p_request and status = 'submitted';
  if v.id is null then raise exception 'Not allowed'; end if;
  update public.verification_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         level = case when p_approve then p_level end, reviewed_by = admin_id, reviewed_at = now()
   where id = p_request;
  if p_approve then
    perform set_config('app.rpc', 'on', true);
    update public.profiles set verification = p_level where id = v.user_id;
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, details)
  values (admin_id, 'review_verification', 'verification_request', p_request,
          jsonb_build_object('approved', p_approve, 'level', p_level));
  perform public.notify(v.user_id, 'verification_update',
    case when p_approve then 'You are verified' else 'Verification was not approved' end, '/app/settings');
end $$;

create or replace function public.admin_audit()
returns table (id bigint, actor_name text, action text, entity text, entity_id uuid, details jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return query
  select a.id, p.display_name, a.action, a.entity, a.entity_id, a.details, a.created_at
  from public.audit_log a left join public.profiles p on p.id = a.actor_id
  order by a.id desc limit 100;
end $$;

-- ============================================================
-- Suspended / banned people lose access to everything
-- (restrictive policies are AND-ed with the existing ones)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['cases','case_skills','user_skills','connections','messages','milestones','tasks',
                           'progress_updates','resolutions','feedback','resources','reports','blocks',
                           'verification_requests','matches','notifications']
  loop
    execute format('drop policy if exists active_only on public.%I', t);
    execute format('create policy active_only on public.%I as restrictive for all to authenticated using (public.is_active()) with check (public.is_active())', t);
  end loop;
end $$;

-- Realtime for resources is not needed.

-- ============================================================
-- To make yourself an admin, run (replace the email):
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');
-- ============================================================
