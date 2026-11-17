-- RePair: free-text matching. Run ONCE in the Supabase SQL editor, after schema.sql and phase9.sql.
-- A seeker just writes their problem. A helper just writes what they can offer.
-- No categories, skills or forms. Matching compares the meaning-bearing words of the two texts
-- (word stems, plus a small synonym list such as kids = children, granny = grandmother).
-- If the AI function is deployed it adds extra related words; matching works without it.
-- Safe to run twice.

-- ============================================================
-- Synonyms and word stems
-- ============================================================
create table if not exists public.synonyms (word text primary key, adds text not null);
alter table public.synonyms enable row level security;
drop policy if exists synonyms_read on public.synonyms;
create policy synonyms_read on public.synonyms for select using (true);

insert into public.synonyms (word, adds) values
  ('kids','child children'), ('kid','child children'), ('child','kids children'), ('children','child kids'),
  ('grandchildren','child children kids'), ('grandkids','child children kids'), ('toddler','child kids'), ('baby','child kids'),
  ('grandma','grandmother granny'), ('grandmother','grandma granny'), ('granny','grandmother grandma'),
  ('grandmama','grandmother grandma'), ('grandmamas','grandmother grandma'), ('grandmothers','grandmother grandma'),
  ('paati','grandmother grandma'), ('nani','grandmother grandma'), ('dadi','grandmother grandma'), ('ammamma','grandmother grandma'),
  ('grandpa','grandfather'), ('grandfather','grandpa'), ('appooppan','grandfather grandpa'),
  ('story','stories tales tell'), ('stories','story tales tell'), ('tale','story stories'), ('tales','story stories'),
  ('storytelling','story stories tell'), ('storyteller','story stories tell'), ('storytellers','story stories tell'),
  ('fairytale','story stories tales'), ('fairytales','story stories tales'), ('folktales','story stories tales'), ('folktale','story stories tales'),
  ('bedtime','night evening sleep'), ('lullaby','bedtime night sleep'), ('lullabies','bedtime night sleep'),
  ('elderly','senior seniors old'), ('senior','elderly old'), ('seniors','elderly old'), ('retired','elderly senior'),
  ('smartphone','phone mobile'), ('whatsapp','phone mobile video call'), ('videocall','video call phone'),
  ('teach','teacher teaching tutor'), ('teacher','teach teaching tutor'), ('teaching','teach teacher tutor'), ('tutor','teach teacher teaching'),
  ('fix','repair fixing'), ('repair','fix fixing'), ('repairing','fix repair'),
  ('cook','cooking food recipe'), ('cooking','cook food recipe'), ('recipe','cook cooking food'),
  ('website','web site developer'), ('developer','website web code programming'), ('coding','code programming developer'),
  ('lawyer','legal law advocate'), ('legal','law lawyer advocate'), ('accountant','accounts tax gst'),
  ('garden','gardening plants'), ('gardening','garden plants'), ('plants','garden gardening'),
  ('music','song singing'), ('singing','song music'), ('song','music singing'), ('dance','dancing'), ('dancing','dance'),
  ('maths','math mathematics'), ('math','maths mathematics'), ('mathematics','maths math')
on conflict (word) do update set adds = excluded.adds;

create or replace function public.expand_text(p text) returns text
language sql stable set search_path = '' as $$
  select coalesce(p, '') || ' ' || coalesce((
    select string_agg(s.adds, ' ')
    from regexp_split_to_table(lower(coalesce(p, '')), '[^a-z]+') w
    join public.synonyms s on s.word = w
  ), '')
$$;

-- stems of the meaningful words, without very generic ones
create or replace function public.text_stems(p text) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct s), '{}')
  from unnest(tsvector_to_array(to_tsvector('english', public.expand_text(p)))) as s
  where char_length(s) > 2
    and s <> all (array['help','need','want','look','find','person','peopl','someon','anyon','good','like','know','make','get',
                        'come','use','also','would','could','pleas','thank','requir','search','seek','offer','provid','skill','abl',
                        'love','happi','readi','work','time','day','year','thing','way','lot','new','small','big','great','real',
                        'much','mani','still','even','just','back','take','give','tri','start','kind','best','nice','proper','around'])
$$;

-- readable words from a text whose stem is in the list (for "why you match")
create or replace function public.readable_hits(p_text text, p_hits text[]) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(w), '{}') from (
    select distinct w from regexp_split_to_table(lower(coalesce(p_text, '')), '[^a-z]+') w
    where char_length(w) > 2 and (tsvector_to_array(to_tsvector('english', w)))[1] = any(coalesce(p_hits, '{}'))
    limit 6
  ) t
$$;

-- ============================================================
-- New columns
-- ============================================================
alter table public.profiles
  add column if not exists offer_text text check (char_length(offer_text) <= 2000),
  add column if not exists offer_summary text,
  add column if not exists offer_keywords text[] not null default '{}',
  add column if not exists offer_stems text[] not null default '{}',
  add column if not exists offer_updated_at timestamptz;

alter table public.cases
  add column if not exists summary text,
  add column if not exists extra_keywords text[] not null default '{}',
  add column if not exists stems text[] not null default '{}';

alter table public.matches
  add column if not exists decision text check (decision in ('liked','passed')),
  add column if not exists hits text[] not null default '{}';

create index if not exists cases_stems_idx on public.cases using gin (stems);
create index if not exists profiles_stems_idx on public.profiles using gin (offer_stems);

create or replace function public.profile_stems() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.offer_stems := public.text_stems(concat_ws(' ', new.offer_text, new.headline, new.bio, array_to_string(new.offer_keywords, ' ')));
  return new;
end $$;
drop trigger if exists profiles_stems on public.profiles;
create trigger profiles_stems before insert or update of offer_text, headline, bio, offer_keywords on public.profiles
  for each row execute function public.profile_stems();

create or replace function public.case_stems() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.stems := public.text_stems(concat_ws(' ', new.title, new.description, new.summary, array_to_string(new.extra_keywords, ' ')));
  return new;
end $$;
drop trigger if exists cases_stems on public.cases;
create trigger cases_stems before insert or update of title, description, summary, extra_keywords on public.cases
  for each row execute function public.case_stems();

-- existing people: use what they already wrote plus their skills
update public.profiles p set
  offer_text = coalesce(p.offer_text, nullif(concat_ws('. ', p.headline, p.bio), '')),
  offer_keywords = coalesce((select array_agg(s.name) from public.user_skills us join public.skills s on s.id = us.skill_id
                             where us.user_id = p.id), '{}');
update public.cases set title = title;

-- ============================================================
-- Matching a problem to helpers
-- ============================================================
create or replace function public.find_matches_for_case(p_case uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare c public.cases; total int; n int;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null then return 0; end if;
  total := coalesce(cardinality(c.stems), 0);
  if total = 0 then return 0; end if;

  insert into public.matches (case_id, profile_id, rank, score, breakdown, explanation, missing, hits)
  select p_case, s.pid, 0, round(least(1, s.n::numeric / total), 4),
         jsonb_build_object('type', 'text', 'hits', to_jsonb(r.rh), 'total', total),
         coalesce(nullif('Matches on: ' || array_to_string(r.rh, ', '), 'Matches on: '), 'Their profile fits what you described.'),
         '{}', s.hit_stems
  from (
    select p.id as pid, concat_ws(' ', p.offer_text, p.headline, p.bio) as doc,
           array(select x from unnest(c.stems) x where x = any(p.offer_stems)) as hit_stems,
           cardinality(array(select x from unnest(c.stems) x where x = any(p.offer_stems))) as n
    from public.profiles p
    where p.id <> c.owner_id and p.status = 'active' and p.discoverable
      and p.intent in ('solver', 'both') and p.availability_status <> 'unavailable'
      and not public.is_blocked_between(c.owner_id, p.id)
      and not exists (select 1 from public.connections x where x.case_id = p_case and x.solver_id = p.id and x.status = 'declined')
  ) s
  cross join lateral (select public.readable_hits(s.doc, s.hit_stems) as rh) r
  where s.n >= 1 and (s.n >= 2 or s.n::numeric / total >= 0.34)
  on conflict (case_id, profile_id) do update
    set score = excluded.score, breakdown = excluded.breakdown, explanation = excluded.explanation, hits = excluded.hits;

  update public.matches m set rank = r.rn
    from (select id, row_number() over (order by score desc, created_at) as rn from public.matches where case_id = p_case) r
   where m.id = r.id;

  select count(*) into n from public.matches where case_id = p_case;
  return n;
end $$;

-- The seeker writes a problem. It is saved, matched, and fitting helpers are told.
create or replace function public.submit_problem(
  p_text text, p_title text default null, p_summary text default null,
  p_keywords text[] default '{}', p_public boolean default true, p_city text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me(); cid uuid; ttl text; n int; h record;
begin
  if char_length(trim(coalesce(p_text, ''))) < 8 then raise exception 'Tell me a little more'; end if;
  ttl := left(coalesce(nullif(trim(p_title), ''), regexp_replace(trim(p_text), '[.!?\n].*$', '')), 140);
  if char_length(ttl) < 3 then ttl := 'My problem'; end if;

  perform set_config('app.rpc', 'on', true);
  insert into public.cases (owner_id, title, description, summary, extra_keywords, status, visibility, city, remote_ok)
  values (uid, ttl, left(trim(p_text), 5000), left(nullif(trim(p_summary), ''), 400), coalesce(p_keywords, '{}'),
          'open', case when p_public then 'public_anonymised' else 'private' end, nullif(trim(p_city), ''), true)
  returning id into cid;

  n := public.find_matches_for_case(cid);

  if p_public then
    for h in select profile_id from public.matches where case_id = cid order by rank limit 10 loop
      perform public.notify(h.profile_id, 'new_problem', 'A new problem may fit you: ' || ttl, '/app/browse');
    end loop;
  end if;
  return jsonb_build_object('case_id', cid, 'matches', n);
end $$;

-- The helper writes what they can offer. Profile saved; waiting problems that fit are matched and their owners told.
create or replace function public.save_offer(
  p_text text, p_headline text default null, p_summary text default null,
  p_keywords text[] default '{}', p_city text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me(); hl text; cs record; had boolean; matched int := 0;
begin
  if char_length(trim(coalesce(p_text, ''))) < 8 then raise exception 'Tell me a little more'; end if;
  hl := left(coalesce(nullif(trim(p_headline), ''), regexp_replace(trim(p_text), '[.!?\n].*$', '')), 120);

  update public.profiles set
    offer_text = left(trim(p_text), 2000),
    offer_summary = left(nullif(trim(p_summary), ''), 400),
    offer_keywords = coalesce(p_keywords, '{}'),
    headline = hl,
    city = coalesce(nullif(trim(p_city), ''), city),
    intent = case when intent = 'seeker' then 'both' else intent end,
    availability_status = case when availability_status = 'unavailable' then 'open' else availability_status end,
    discoverable = true,
    onboarded_at = coalesce(onboarded_at, now()),
    offer_updated_at = now()
  where id = uid;

  for cs in select id, owner_id, title from public.cases
            where status = 'open' and owner_id <> uid order by created_at desc limit 150 loop
    if public.is_blocked_between(cs.owner_id, uid) then continue; end if;
    had := exists (select 1 from public.matches where case_id = cs.id and profile_id = uid);
    perform public.find_matches_for_case(cs.id);
    if not had and exists (select 1 from public.matches where case_id = cs.id and profile_id = uid) then
      matched := matched + 1;
      perform public.notify(cs.owner_id, 'new_match', 'Good news: a possible match for "' || cs.title || '"',
                            '/app/cases/' || cs.id || '?tab=matches');
    end if;
  end loop;
  return jsonb_build_object('matched_problems', matched);
end $$;

-- Swipe: choose sends a request; pass hides the card
create or replace function public.decide_match(p_match uuid, p_choose boolean, p_message text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare m public.matches; c public.cases; cid uuid;
begin
  select * into m from public.matches where id = p_match;
  select * into c from public.cases where id = m.case_id;
  if m.id is null or c.owner_id <> public.me() then raise exception 'Not allowed'; end if;
  if p_choose then
    cid := public.send_request(m.case_id, m.profile_id, p_message);
    update public.matches set decision = 'liked' where id = p_match;
    return cid;
  end if;
  update public.matches set decision = 'passed' where id = p_match;
  return null;
end $$;

-- Helper: registered problems, best fit first. Optional free-text search ("where can I help?").
create or replace function public.problems_for_helper(p_query text default '')
returns table (id uuid, title text, summary text, city text, remote_ok boolean, created_at timestamptz,
               hits text[], waiting boolean, score numeric)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public.me(); q text[]; mine text[]; typed boolean := coalesce(trim(p_query), '') <> '';
begin
  select offer_stems into mine from public.profiles where profiles.id = uid;
  q := case when typed then public.text_stems(p_query) else coalesce(mine, '{}') end;
  return query
  select c.id, c.title, coalesce(c.summary, left(c.description, 280)), c.city, c.remote_ok, c.created_at,
         public.readable_hits(concat_ws(' ', c.title, c.description, c.summary), l.hs),
         not exists (select 1 from public.connections k
                     where k.case_id = c.id and k.status in ('pending', 'clarification_requested', 'accepted')),
         round(least(1, cardinality(l.hs)::numeric / greatest(cardinality(c.stems), 1)), 4)
  from public.cases c
  cross join lateral (select array(select x from unnest(c.stems) x where x = any(q)) as hs) l
  where c.status = 'open' and c.visibility = 'public_anonymised' and c.owner_id <> uid
    and not public.is_blocked_between(c.owner_id, uid)
    and (cardinality(q) = 0
         or (typed and cardinality(l.hs) >= 1)
         or (not typed and cardinality(l.hs) >= 1 and (cardinality(l.hs) >= 2
              or cardinality(l.hs)::numeric / greatest(cardinality(c.stems), 1) >= 0.34)))
  order by 9 desc, c.created_at desc
  limit 40;
end $$;

-- ============================================================
-- Admin: a bit more insight, and problems nobody can help with yet
-- ============================================================
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'helpers', (select count(*) from public.profiles where offer_text is not null and status = 'active'),
    'suspended', (select count(*) from public.profiles where status <> 'active'),
    'cases_open', (select count(*) from public.cases where status in ('open','in_progress','resolution_proposed')),
    'waiting_problems', (select count(*) from public.cases c where c.status = 'open'
                          and not exists (select 1 from public.matches m where m.case_id = c.id)),
    'cases_resolved', (select count(*) from public.cases where status = 'resolved'),
    'connections_accepted', (select count(*) from public.connections where status in ('accepted','closed')),
    'resources', (select count(*) from public.resources where not hidden_by_admin),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'submitted')
  );
end $$;

create or replace function public.admin_waiting()
returns table (id uuid, title text, owner_name text, created_at timestamptz, visibility text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return query
  select c.id, c.title, p.display_name, c.created_at, c.visibility
  from public.cases c join public.profiles p on p.id = c.owner_id
  where c.status = 'open' and not exists (select 1 from public.matches m where m.case_id = c.id)
  order by c.created_at limit 100;
end $$;
