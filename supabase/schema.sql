-- SOLVIA schema. Run ONCE in the Supabase SQL editor (Dashboard > SQL Editor > New query).
-- Covers phases 3-7: profiles, skills, cases, matching, connections, messages,
-- notifications, milestones, tasks, progress, resolution, feedback.
-- Row Level Security is enabled on every table.

-- ============================================================
-- Helpers
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.me() returns uuid
language plpgsql stable as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  return uid;
end $$;

-- ============================================================
-- Reference data
-- ============================================================
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort int not null default 0
);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 60),
  category_id uuid references public.categories(id),
  is_approved boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index skills_name_key on public.skills (lower(name));

-- ============================================================
-- Profiles
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  headline text check (char_length(headline) <= 120),
  bio text check (char_length(bio) <= 1500),
  intent text not null default 'both' check (intent in ('seeker','solver','both')),
  city text,
  state text,
  remote_ok boolean not null default true,
  availability_status text not null default 'open' check (availability_status in ('open','limited','unavailable')),
  help_types text[] not null default '{}',
  discoverable boolean not null default true,
  is_admin boolean not null default false,
  status text not null default 'active' check (status in ('active','suspended','banned')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.guard_profile() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.is_admin is distinct from old.is_admin
    or new.status is distinct from old.status) then
    raise exception 'Not allowed';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1), 'User'), 60)
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.user_skills (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  proficiency smallint not null default 2 check (proficiency between 1 and 4),
  years numeric(3,1) check (years >= 0 and years <= 60),
  primary key (user_id, skill_id)
);

-- ============================================================
-- Cases
-- ============================================================
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 140),
  description text not null check (char_length(description) between 1 and 5000),
  category_id uuid references public.categories(id),
  status text not null default 'draft'
    check (status in ('draft','open','in_progress','resolution_proposed','resolved','closed')),
  visibility text not null default 'private'
    check (visibility in ('private','matched_only','public_anonymised')),
  urgency text check (urgency in ('flexible','this_month','this_week','urgent')),
  city text,
  state text,
  remote_ok boolean not null default true,
  budget_min int check (budget_min >= 0),
  budget_max int check (budget_max >= 0),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cases_owner_idx on public.cases (owner_id);
create index cases_status_idx on public.cases (status, visibility);
create trigger cases_updated before update on public.cases
  for each row execute function public.set_updated_at();

create or replace function public.guard_case_status() returns trigger
language plpgsql as $$
begin
  if auth.uid() is not null
     and new.status is distinct from old.status
     and coalesce(current_setting('app.rpc', true), '') <> 'on' then
    raise exception 'Use the provided actions to change status';
  end if;
  return new;
end $$;
create trigger cases_guard before update on public.cases
  for each row execute function public.guard_case_status();

create table public.case_skills (
  case_id uuid not null references public.cases(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  importance smallint not null default 2 check (importance between 1 and 3),
  primary key (case_id, skill_id)
);

-- ============================================================
-- Matching
-- ============================================================
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  rank int not null,
  score numeric(5,4) not null,
  breakdown jsonb not null,
  explanation text not null,
  missing text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (case_id, profile_id)
);
create index matches_profile_idx on public.matches (profile_id);

-- ============================================================
-- Connections, messages, notifications
-- ============================================================
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  seeker_id uuid not null references public.profiles(id) on delete cascade,
  solver_id uuid not null references public.profiles(id) on delete cascade,
  initiated_by uuid not null references public.profiles(id),
  message text check (char_length(message) <= 500),
  status text not null default 'pending'
    check (status in ('pending','clarification_requested','accepted','declined','cancelled','expired','closed')),
  expires_at timestamptz not null default now() + interval '14 days',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (seeker_id <> solver_id),
  check (initiated_by in (seeker_id, solver_id))
);
create unique index connections_one_open
  on public.connections (case_id, solver_id)
  where status in ('pending','clarification_requested','accepted');
create index connections_seeker_idx on public.connections (seeker_id);
create index connections_solver_idx on public.connections (solver_id);
create trigger connections_updated before update on public.connections
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_conn_idx on public.messages (connection_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ============================================================
-- Collaboration
-- ============================================================
create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  position int not null default 0,
  status text not null default 'pending' check (status in ('pending','done')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  assignee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tasks_updated before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.progress_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.resolutions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id),
  summary text not null check (char_length(summary) between 1 and 1000),
  status text not null default 'proposed' check (status in ('proposed','confirmed','rejected')),
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  outcome text not null check (outcome in ('resolved','partially','not_resolved')),
  rating smallint check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (case_id, from_user, to_user),
  check (from_user <> to_user)
);

-- ============================================================
-- Access helpers (SECURITY DEFINER: avoid recursive RLS)
-- ============================================================
create or replace function public.is_case_owner(p_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cases where id = p_case and owner_id = auth.uid());
$$;

create or replace function public.is_case_participant(p_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cases where id = p_case and owner_id = auth.uid())
      or exists (select 1 from public.connections
                 where case_id = p_case and status in ('accepted','closed')
                   and auth.uid() in (seeker_id, solver_id));
$$;

create or replace function public.can_view_case(p_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.cases where id = p_case and owner_id = auth.uid())
      or exists (select 1 from public.connections
                 where case_id = p_case and auth.uid() in (seeker_id, solver_id))
      or exists (select 1 from public.matches m join public.cases c on c.id = m.case_id
                 where m.case_id = p_case and m.profile_id = auth.uid()
                   and c.visibility in ('matched_only','public_anonymised')
                   and c.status in ('open','in_progress'));
$$;

create or replace function public.is_connection_party(p_conn uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.connections
                 where id = p_conn and auth.uid() in (seeker_id, solver_id));
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.categories enable row level security;
alter table public.skills enable row level security;
alter table public.profiles enable row level security;
alter table public.user_skills enable row level security;
alter table public.cases enable row level security;
alter table public.case_skills enable row level security;
alter table public.matches enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.milestones enable row level security;
alter table public.tasks enable row level security;
alter table public.progress_updates enable row level security;
alter table public.resolutions enable row level security;
alter table public.feedback enable row level security;

create policy categories_read on public.categories for select using (true);
create policy skills_read on public.skills for select using (true);
create policy skills_add on public.skills for insert to authenticated
  with check (is_approved = false);

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or (discoverable and status = 'active'));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy user_skills_read on public.user_skills for select to authenticated using (true);
create policy user_skills_write on public.user_skills for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy cases_read on public.cases for select to authenticated
  using (owner_id = auth.uid() or public.can_view_case(id));
create policy cases_insert on public.cases for insert to authenticated
  with check (owner_id = auth.uid() and status = 'draft');
create policy cases_update on public.cases for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy cases_delete on public.cases for delete to authenticated
  using (owner_id = auth.uid() and status = 'draft');

create policy case_skills_read on public.case_skills for select to authenticated
  using (public.can_view_case(case_id));
create policy case_skills_write on public.case_skills for all to authenticated
  using (public.is_case_owner(case_id)) with check (public.is_case_owner(case_id));

create policy matches_read on public.matches for select to authenticated
  using (profile_id = auth.uid() or public.is_case_owner(case_id));

create policy connections_read on public.connections for select to authenticated
  using (auth.uid() in (seeker_id, solver_id));

create policy messages_read on public.messages for select to authenticated
  using (public.is_connection_party(connection_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_connection_party(connection_id)
    and exists (select 1 from public.connections c
                where c.id = connection_id and c.status in ('accepted','clarification_requested'))
  );

create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

create policy milestones_read on public.milestones for select to authenticated
  using (public.is_case_participant(case_id));
create policy milestones_insert on public.milestones for insert to authenticated
  with check (public.is_case_participant(case_id) and created_by = auth.uid());
create policy milestones_update on public.milestones for update to authenticated
  using (public.is_case_participant(case_id)) with check (public.is_case_participant(case_id));
create policy milestones_delete on public.milestones for delete to authenticated
  using (public.is_case_owner(case_id));

create policy tasks_read on public.tasks for select to authenticated
  using (public.is_case_participant(case_id));
create policy tasks_insert on public.tasks for insert to authenticated
  with check (public.is_case_participant(case_id) and created_by = auth.uid());
create policy tasks_update on public.tasks for update to authenticated
  using (public.is_case_participant(case_id)) with check (public.is_case_participant(case_id));
create policy tasks_delete on public.tasks for delete to authenticated
  using (public.is_case_owner(case_id));

create policy progress_read on public.progress_updates for select to authenticated
  using (public.is_case_participant(case_id));
create policy progress_insert on public.progress_updates for insert to authenticated
  with check (public.is_case_participant(case_id) and author_id = auth.uid());

create policy resolutions_read on public.resolutions for select to authenticated
  using (public.is_case_participant(case_id));

create policy feedback_read on public.feedback for select to authenticated
  using (auth.uid() in (from_user, to_user));

-- Messages: at most 3 per person before the request is accepted.
create or replace function public.limit_preaccept_messages() returns trigger
language plpgsql security definer set search_path = '' as $$
declare st text; n int;
begin
  select status into st from public.connections where id = new.connection_id;
  if st <> 'accepted' then
    select count(*) into n from public.messages
      where connection_id = new.connection_id and sender_id = new.sender_id;
    if n >= 3 then raise exception 'Message limit reached until the request is accepted'; end if;
  end if;
  return new;
end $$;
create trigger messages_limit before insert on public.messages
  for each row execute function public.limit_preaccept_messages();

-- ============================================================
-- Public view: anonymised open problems (no owner, safe for visitors)
-- ============================================================
create or replace view public.public_cases as
  select c.id, c.title, c.description, c.urgency, c.city, c.state, c.remote_ok,
         c.budget_min, c.budget_max, c.created_at,
         cat.name as category,
         coalesce((select array_agg(s.name order by s.name)
                   from public.case_skills cs join public.skills s on s.id = cs.skill_id
                   where cs.case_id = c.id), '{}') as skills,
         coalesce((select array_agg(cs.skill_id)
                   from public.case_skills cs where cs.case_id = c.id), '{}') as skill_ids
  from public.cases c
  left join public.categories cat on cat.id = c.category_id
  where c.visibility = 'public_anonymised' and c.status = 'open';
grant select on public.public_cases to anon, authenticated;

-- ============================================================
-- Notifications (written by triggers only)
-- ============================================================
create or replace function public.notify(p_user uuid, p_kind text, p_title text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, link) values (p_user, p_kind, p_title, p_link);
$$;

create or replace function public.on_connection_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid; initiator uuid := new.initiated_by; ctitle text;
begin
  recipient := case when new.initiated_by = new.seeker_id then new.solver_id else new.seeker_id end;
  select title into ctitle from public.cases where id = new.case_id;
  if tg_op = 'INSERT' then
    perform public.notify(recipient, 'request_received', 'New request: ' || ctitle, '/app/connections');
  elsif new.status is distinct from old.status then
    if new.status = 'accepted' then
      perform public.notify(initiator, 'request_accepted', 'Accepted: ' || ctitle, '/app/messages/' || new.id);
    elsif new.status = 'declined' then
      perform public.notify(initiator, 'request_declined', 'Declined: ' || ctitle, '/app/connections');
    elsif new.status = 'clarification_requested' then
      perform public.notify(initiator, 'clarification', 'A question about: ' || ctitle, '/app/messages/' || new.id);
    elsif new.status = 'pending' and old.status = 'clarification_requested' then
      perform public.notify(recipient, 'clarification', 'Answer received: ' || ctitle, '/app/messages/' || new.id);
    end if;
  end if;
  return new;
end $$;
create trigger connections_notify after insert or update on public.connections
  for each row execute function public.on_connection_change();

create or replace function public.on_message_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.connections; other uuid; sname text;
begin
  select * into c from public.connections where id = new.connection_id;
  other := case when new.sender_id = c.seeker_id then c.solver_id else c.seeker_id end;
  select display_name into sname from public.profiles where id = new.sender_id;
  perform public.notify(other, 'message', 'Message from ' || sname, '/app/messages/' || c.id);
  return new;
end $$;
create trigger messages_notify after insert on public.messages
  for each row execute function public.on_message_insert();

-- ============================================================
-- Case actions
-- ============================================================
create or replace function public.publish_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  if c.status <> 'draft' then raise exception 'Already published'; end if;
  if not exists (select 1 from public.case_skills where case_id = p_case) then
    raise exception 'Add at least one skill';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.cases set status = 'open' where id = p_case;
end $$;

create or replace function public.close_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  if c.status in ('resolved','closed') then raise exception 'Already finished'; end if;
  perform set_config('app.rpc', 'on', true);
  update public.cases set status = 'closed' where id = p_case;
  update public.connections set status = 'cancelled'
    where case_id = p_case and status in ('pending','clarification_requested');
  update public.connections set status = 'closed'
    where case_id = p_case and status = 'accepted';
end $$;

-- ============================================================
-- Matching (rule-based; weights below are the v1 defaults)
-- skill 0.50 | experience 0.20 | availability 0.20 | reliability 0.10
-- Factors with no real data are excluded and the weights re-normalised.
-- ============================================================
create or replace function public.run_matching(p_case uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare c public.cases; n int; need_count int;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  if c.status not in ('open','in_progress') then raise exception 'Publish the problem first'; end if;
  select count(*) into need_count from public.case_skills where case_id = p_case;
  if need_count = 0 then raise exception 'Add at least one skill'; end if;

  delete from public.matches where case_id = p_case;

  insert into public.matches (case_id, profile_id, rank, score, breakdown, explanation, missing)
  select p_case, f.pid, row_number() over (order by f.score desc, f.pid), f.score,
    jsonb_build_object(
      'skill',        jsonb_build_object('value', round(f.f_skill, 3), 'weight', 0.5, 'included', true),
      'experience',   jsonb_build_object('value', round(f.f_exp, 3),   'weight', 0.2, 'included', f.f_exp is not null),
      'availability', jsonb_build_object('value', f.f_av,              'weight', 0.2, 'included', true),
      'reliability',  jsonb_build_object('value', round(f.f_rel, 3),   'weight', 0.1, 'included', f.f_rel is not null,
                                         'accepted', f.acc, 'confirmed', f.ok),
      'matched_skills', to_jsonb(f.names),
      'needed_skills', need_count
    ),
    'Offers ' || array_to_string(f.names, ', ') || ' (' || f.m || ' of ' || need_count || ' skills needed). '
      || case when f.yrs is not null then 'Reports about ' || round(f.yrs, 1) || ' years of experience. '
              else 'Experience not provided. ' end
      || case f.av when 'open' then 'Available now. ' else 'Limited availability. ' end
      || case when f.f_rel is not null
              then 'Completed ' || f.ok || ' of ' || f.acc || ' accepted cases.'
              else 'No history yet.' end,
    array_remove(array[
      case when f.f_exp is null then 'experience' end,
      case when f.f_rel is null then 'reliability' end], null)
  from (
    select g.*,
      (0.5 * g.f_skill + coalesce(0.2 * g.f_exp, 0) + 0.2 * g.f_av + coalesce(0.1 * g.f_rel, 0))
      / (0.5 + case when g.f_exp is not null then 0.2 else 0 end + 0.2
         + case when g.f_rel is not null then 0.1 else 0 end) as score
    from (
      select cand.*,
        least(cand.w / nullif(tot.t, 0), 1) as f_skill,
        case when cand.yrs is null then null else least(cand.yrs / 5.0, 1) end as f_exp,
        case cand.av when 'open' then 1.0 else 0.5 end as f_av,
        case when rel.acc >= 3 then rel.ok::numeric / rel.acc end as f_rel,
        rel.acc, rel.ok
      from (
        select p.id as pid, p.availability_status as av,
               sum(cs.importance * us.proficiency / 4.0) as w,
               count(*) as m,
               array_agg(s.name order by s.name) as names,
               avg(us.years) as yrs
        from public.profiles p
        join public.user_skills us on us.user_id = p.id
        join public.case_skills cs on cs.skill_id = us.skill_id and cs.case_id = p_case
        join public.skills s on s.id = cs.skill_id
        where p.id <> c.owner_id
          and p.status = 'active' and p.discoverable
          and p.intent in ('solver','both')
          and p.availability_status <> 'unavailable'
          and ((c.remote_ok and p.remote_ok)
               or (c.city is not null and lower(p.city) = lower(c.city)))
          and not exists (select 1 from public.connections x
                          where x.case_id = p_case and x.solver_id = p.id and x.status = 'declined')
        group by p.id, p.availability_status
      ) cand
      cross join (select sum(importance)::numeric as t from public.case_skills where case_id = p_case) tot
      cross join lateral (
        select
          (select count(*) from public.connections x
            where x.solver_id = cand.pid and x.status in ('accepted','closed')) as acc,
          (select count(*) from public.connections x join public.cases cc on cc.id = x.case_id
            where x.solver_id = cand.pid and x.status in ('accepted','closed')
              and cc.status = 'resolved') as ok
      ) rel
    ) g
  ) f
  order by f.score desc, f.pid
  limit 20;

  get diagnostics n = row_count;
  return n;
end $$;

-- ============================================================
-- Connections
-- ============================================================
create or replace function public.send_request(p_case uuid, p_solver uuid, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.cases; uid uuid := public.me(); seeker uuid; solver uuid; new_id uuid; pend int;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null then raise exception 'Problem not found'; end if;
  if c.status not in ('open','in_progress') then raise exception 'This problem is not open'; end if;

  if c.owner_id = uid then
    -- seeker invites a solver
    seeker := uid; solver := p_solver;
    if solver = uid then raise exception 'You cannot invite yourself'; end if;
    if not exists (select 1 from public.profiles
                   where id = solver and status = 'active' and intent in ('solver','both')) then
      raise exception 'This person is not available';
    end if;
  else
    -- solver offers help on a public problem
    if c.visibility <> 'public_anonymised' then raise exception 'Not allowed'; end if;
    if not exists (select 1 from public.profiles where id = uid and status = 'active' and intent in ('solver','both')) then
      raise exception 'Turn on helping in your profile first';
    end if;
    seeker := c.owner_id; solver := uid;
  end if;

  if exists (select 1 from public.connections
             where case_id = p_case and solver_id = solver and status = 'declined' and initiated_by = seeker) then
    raise exception 'This person declined before';
  end if;

  select count(*) into pend from public.connections
    where initiated_by = uid and status in ('pending','clarification_requested');
  if pend >= 10 then raise exception 'Too many open requests. Wait for replies.'; end if;

  insert into public.connections (case_id, seeker_id, solver_id, initiated_by, message)
  values (p_case, seeker, solver, uid, nullif(trim(p_message), ''))
  returning id into new_id;
  return new_id;
end $$;

create or replace function public.transition_connection(p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare k public.connections; uid uuid := public.me(); recipient uuid; initiator uuid; new_status text;
begin
  select * into k from public.connections where id = p_id;
  if k.id is null or uid not in (k.seeker_id, k.solver_id) then raise exception 'Not allowed'; end if;
  initiator := k.initiated_by;
  recipient := case when initiator = k.seeker_id then k.solver_id else k.seeker_id end;

  if p_action = 'accept' and uid = recipient and k.status = 'pending' then new_status := 'accepted';
  elsif p_action = 'decline' and uid = recipient and k.status in ('pending','clarification_requested') then new_status := 'declined';
  elsif p_action = 'ask' and uid = recipient and k.status = 'pending' then new_status := 'clarification_requested';
  elsif p_action = 'respond' and uid = initiator and k.status = 'clarification_requested' then new_status := 'pending';
  elsif p_action = 'cancel' and uid = initiator and k.status in ('pending','clarification_requested') then new_status := 'cancelled';
  elsif p_action = 'close' and k.status = 'accepted' then new_status := 'closed';
  else raise exception 'That action is not possible now';
  end if;

  update public.connections
     set status = new_status,
         responded_at = case when new_status in ('accepted','declined','clarification_requested') then now() else responded_at end
   where id = p_id;

  if new_status = 'accepted' then
    perform set_config('app.rpc', 'on', true);
    update public.cases set status = 'in_progress' where id = k.case_id and status = 'open';
  end if;
end $$;

create or replace function public.expire_connections() returns void
language sql security definer set search_path = '' as $$
  update public.connections set status = 'expired'
   where status in ('pending','clarification_requested') and expires_at < now()
     and auth.uid() in (seeker_id, solver_id);
$$;

-- ============================================================
-- Resolution and feedback
-- ============================================================
create or replace function public.propose_resolution(p_case uuid, p_summary text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases; uid uuid := public.me();
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or not public.is_case_participant(p_case) then raise exception 'Not allowed'; end if;
  if c.status <> 'in_progress' then raise exception 'Not ready for resolution'; end if;
  insert into public.resolutions (case_id, proposed_by, summary) values (p_case, uid, p_summary);
  perform set_config('app.rpc', 'on', true);
  update public.cases set status = 'resolution_proposed' where id = p_case;
  if uid <> c.owner_id then
    perform public.notify(c.owner_id, 'resolution_proposed', 'Please confirm: ' || c.title, '/app/cases/' || p_case);
  end if;
end $$;

create or replace function public.respond_resolution(p_case uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases; r record;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  if c.status <> 'resolution_proposed' then raise exception 'Nothing to confirm'; end if;
  perform set_config('app.rpc', 'on', true);
  if p_accept then
    update public.resolutions set status = 'confirmed' where case_id = p_case and status = 'proposed';
    update public.cases set status = 'resolved', resolved_at = now() where id = p_case;
    for r in select solver_id from public.connections where case_id = p_case and status = 'accepted' loop
      perform public.notify(r.solver_id, 'resolution_confirmed', 'Resolved: ' || c.title, '/app/cases/' || p_case);
    end loop;
  else
    update public.resolutions set status = 'rejected' where case_id = p_case and status = 'proposed';
    update public.cases set status = 'in_progress' where id = p_case;
  end if;
end $$;

create or replace function public.reopen_case(p_case uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  if c.status <> 'resolved' or c.resolved_at < now() - interval '7 days' then
    raise exception 'This problem cannot be reopened';
  end if;
  perform set_config('app.rpc', 'on', true);
  update public.cases set status = 'in_progress', resolved_at = null where id = p_case;
end $$;

create or replace function public.submit_feedback(
  p_case uuid, p_to uuid, p_outcome text, p_rating int, p_comment text) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.cases; uid uuid := public.me();
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.status <> 'resolved' then raise exception 'Feedback opens after resolution'; end if;
  if not public.is_case_participant(p_case) then raise exception 'Not allowed'; end if;
  if p_to = uid then raise exception 'Not allowed'; end if;
  if not (p_to = c.owner_id or exists (select 1 from public.connections
          where case_id = p_case and solver_id = p_to and status in ('accepted','closed'))) then
    raise exception 'Not allowed';
  end if;
  insert into public.feedback (case_id, from_user, to_user, outcome, rating, comment)
  values (p_case, uid, p_to, p_outcome, p_rating, nullif(trim(p_comment), ''));
end $$;

-- ============================================================
-- Realtime
-- ============================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.connections;

-- ============================================================
-- Reference seed data
-- ============================================================
insert into public.categories (name, sort) values
  ('Technology & Software', 1), ('Business & Startups', 2), ('Legal & Compliance', 3),
  ('Finance & Accounting', 4), ('Education & Career', 5), ('Design & Creative', 6),
  ('Home & Local Services', 7), ('Community & Impact', 8), ('Research & Academia', 9),
  ('Agriculture & Rural', 10), ('Government & Documents', 11), ('Other', 99);

insert into public.skills (name, category_id)
select s.name, c.id from (values
  ('Python','Technology & Software'), ('JavaScript','Technology & Software'),
  ('React','Technology & Software'), ('Web development','Technology & Software'),
  ('Mobile apps','Technology & Software'), ('Data analysis','Technology & Software'),
  ('Machine learning','Technology & Software'), ('Cybersecurity','Technology & Software'),
  ('Cloud hosting','Technology & Software'), ('Databases','Technology & Software'),
  ('Excel','Technology & Software'), ('IT support','Technology & Software'),
  ('Business plan','Business & Startups'), ('Marketing','Business & Startups'),
  ('SEO','Business & Startups'), ('Sales','Business & Startups'),
  ('Fundraising','Business & Startups'), ('Operations','Business & Startups'),
  ('Contract review','Legal & Compliance'), ('Company registration','Legal & Compliance'),
  ('Trademark','Legal & Compliance'), ('Tenant rights','Legal & Compliance'),
  ('GST filing','Finance & Accounting'), ('Income tax','Finance & Accounting'),
  ('Bookkeeping','Finance & Accounting'), ('Budgeting','Finance & Accounting'),
  ('Career guidance','Education & Career'), ('Resume review','Education & Career'),
  ('Interview practice','Education & Career'), ('Maths tutoring','Education & Career'),
  ('English speaking','Education & Career'), ('Exam preparation','Education & Career'),
  ('UI design','Design & Creative'), ('Logo design','Design & Creative'),
  ('Video editing','Design & Creative'), ('Photography','Design & Creative'),
  ('Content writing','Design & Creative'), ('3D printing','Design & Creative'),
  ('Plumbing','Home & Local Services'), ('Electrical repair','Home & Local Services'),
  ('Carpentry','Home & Local Services'), ('Appliance repair','Home & Local Services'),
  ('Fundraising for causes','Community & Impact'), ('Volunteer coordination','Community & Impact'),
  ('Public speaking','Community & Impact'), ('Event planning','Community & Impact'),
  ('Research writing','Research & Academia'), ('Statistics','Research & Academia'),
  ('Soil testing','Agriculture & Rural'), ('Crop planning','Agriculture & Rural'),
  ('Passport help','Government & Documents'), ('Government schemes','Government & Documents'),
  ('Translation','Other'), ('Project management','Other')
) as s(name, cat) join public.categories c on c.name = s.cat;
