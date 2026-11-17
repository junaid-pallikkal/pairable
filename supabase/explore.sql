-- RePair: Explore. Run ONCE in the Supabase SQL editor, after ai_matching.sql.
-- Adds: browsing all problems and all solvers, offering help from any account,
-- and "chat" with a solver without having posted a problem first.
-- Safe to run twice.

alter table public.profiles add column if not exists is_demo boolean not null default false;

-- A "chat" is a small private conversation opener. It is not a problem, so it is kept out of lists and counts.
alter table public.cases
  add column if not exists kind text not null default 'problem' check (kind in ('problem', 'chat'));


-- ============================================================
-- PART 0: better match quality (version 2: one concept counts once)
-- Found while testing: "grandchildren" was treated as "children", and generic words like "patient"
-- made unrelated people match. Now a match needs at least 2 shared meaningful words,
-- and 3 unless those 2 cover a third of the problem.
-- ============================================================
-- Synonyms: each group of related words now maps to ONE concept word, so one idea counts once.
-- (Before, "teach" also added "teacher" and "tutor", so a single shared word counted three times
--  and a phone-teaching problem matched a cook, a reading teacher and a puppeteer.)
delete from public.synonyms;
insert into public.synonyms (word, adds) values
  ('kids','child'), ('kid','child'), ('child','child'), ('children','child'), ('toddler','child'), ('toddlers','child'), ('baby','child'), ('babies','child'),
  ('grandma','grandmother'), ('granny','grandmother'), ('grandmama','grandmother'), ('grandmamas','grandmother'), ('grandmothers','grandmother'), ('grandmother','grandmother'),
  ('paati','grandmother'), ('nani','grandmother'), ('dadi','grandmother'), ('ammamma','grandmother'),
  ('grandpa','grandfather'), ('appooppan','grandfather'),
  ('story','story'), ('stories','story'), ('tale','story'), ('tales','story'), ('storytelling','story'), ('storyteller','story'), ('storytellers','story'),
  ('fairytale','story'), ('fairytales','story'), ('folktale','story'), ('folktales','story'),
  ('bedtime','bedtime'), ('lullaby','bedtime'), ('lullabies','bedtime'),
  ('elderly','elderly'), ('senior','elderly'), ('seniors','elderly'), ('older','elderly'),
  ('smartphone','phone'), ('smartphones','phone'), ('phone','phone'), ('phones','phone'), ('mobile','phone'), ('whatsapp','phone'),
  ('teach','teach'), ('teacher','teach'), ('teaching','teach'), ('teaches','teach'), ('tutor','teach'), ('tutors','teach'), ('tutoring','teach'),
  ('fix','repair'), ('fixing','repair'), ('repair','repair'), ('repairing','repair'), ('repairs','repair'),
  ('cook','cook'), ('cooking','cook'), ('recipe','cook'), ('recipes','cook'),
  ('website','website'), ('websites','website'), ('developer','code'), ('coding','code'), ('programmer','code'), ('programming','code'),
  ('lawyer','legal'), ('legal','legal'), ('law','legal'), ('advocate','legal'),
  ('accountant','tax'), ('tax','tax'), ('gst','tax'),
  ('garden','garden'), ('gardening','garden'), ('plants','garden'),
  ('music','music'), ('singing','music'), ('song','music'), ('songs','music'),
  ('dance','dance'), ('dancing','dance'),
  ('maths','math'), ('math','math'), ('mathematics','math');

-- Replace each word by its concept (instead of adding extra words)
create or replace function public.expand_text(p text) returns text
language sql stable set search_path = '' as $$
  select coalesce(string_agg(coalesce(s.adds, w), ' '), '')
  from regexp_split_to_table(lower(coalesce(p, '')), '[^a-z]+') as w
  left join public.synonyms s on s.word = w
  where w <> ''
$$;

-- Readable words for "why you match": the words of the text whose concept is among the shared ones
create or replace function public.readable_hits(p_text text, p_hits text[]) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(w), '{}') from (
    select distinct w from regexp_split_to_table(lower(coalesce(p_text, '')), '[^a-z]+') as w
    where char_length(w) > 2
      and (tsvector_to_array(to_tsvector('english',
             coalesce((select s.adds from public.synonyms s where s.word = w), w))))[1] = any(coalesce(p_hits, '{}'))
    limit 6
  ) t
$$;


create or replace function public.text_stems(p text) returns text[]
language sql stable set search_path = '' as $$
  select coalesce(array_agg(distinct s), '{}')
  from unnest(tsvector_to_array(to_tsvector('english', public.expand_text(p)))) as s
  where char_length(s) > 2
    and s <> all (array['help','need','want','look','find','person','peopl','someon','anyon','good','like','know','make','get',
                        'come','use','also','would','could','pleas','thank','requir','search','seek','offer','provid','skill','abl',
                        'love','happi','readi','work','time','day','year','thing','way','lot','new','small','big','great','real',
                        'much','mani','still','even','just','back','take','give','tri','start','kind','best','nice','proper','around',
                        'patient','calm','step','easi','simpl','quick','friend','honest','reliabl','experi','enjoy','will','can',
                        'cannot','live','home','famili','everi','alway','often','sometim','learn','explain','person','group','local'])
$$;

create or replace function public.strong_match(n int, total int) returns boolean
language sql immutable set search_path = '' as $$
  select n >= 2 and (n >= 3 or n::numeric / greatest(total, 1) >= 0.34)
$$;

create or replace function public.find_matches_for_case(p_case uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare c public.cases; total int; n int;
begin
  select * into c from public.cases where id = p_case;
  if c.id is null or c.kind <> 'problem' then return 0; end if;
  total := coalesce(cardinality(c.stems), 0);
  if total = 0 then return 0; end if;

  -- forget old suggestions nobody has acted on; decided ones stay
  delete from public.matches where case_id = p_case and decision is null;

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
  where public.strong_match(s.n, total)
  on conflict (case_id, profile_id) do update
    set score = excluded.score, breakdown = excluded.breakdown, explanation = excluded.explanation, hits = excluded.hits;

  update public.matches m set rank = r.rn
    from (select id, row_number() over (order by score desc, created_at) as rn from public.matches where case_id = p_case) r
   where m.id = r.id;

  select count(*) into n from public.matches where case_id = p_case;
  return n;
end $$;

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
  where c.status = 'open' and c.visibility = 'public_anonymised' and c.kind = 'problem' and c.owner_id <> uid
    and not public.is_blocked_between(c.owner_id, uid)
    and (cardinality(q) = 0
         or (typed and cardinality(l.hs) >= 1)
         or (not typed and public.strong_match(cardinality(l.hs), cardinality(c.stems))))
  order by 9 desc, c.created_at desc
  limit 40;
end $$;

-- Visitors who are not signed in can still browse problems (no names, no owners)
create or replace view public.public_cases as
  select c.id, c.title, c.description, c.urgency, c.city, c.state, c.remote_ok,
         c.budget_min, c.budget_max, c.created_at,
         cat.name as category,
         coalesce((select array_agg(s.name order by s.name)
                   from public.case_skills cs join public.skills s on s.id = cs.skill_id
                   where cs.case_id = c.id), '{}') as skills,
         coalesce((select array_agg(cs.skill_id)
                   from public.case_skills cs where cs.case_id = c.id), '{}') as skill_ids,
         c.summary
  from public.cases c
  left join public.categories cat on cat.id = c.category_id
  where c.visibility = 'public_anonymised' and c.status = 'open' and c.kind = 'problem';
grant select on public.public_cases to anon, authenticated;

-- ============================================================
-- Explore: problems
-- sort: new | fit (best for me) | waiting (waiting longest, no offers yet)
-- ============================================================
create or replace function public.explore_problems(p_query text default '', p_sort text default 'new', p_limit int default 60)
returns table (id uuid, title text, summary text, description text, city text, remote_ok boolean, created_at timestamptz,
               hits text[], fits boolean, waiting boolean, offers int, score numeric)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public.me(); typed boolean := coalesce(trim(p_query), '') <> ''; q text[]; mine text[];
begin
  q := case when typed then public.text_stems(p_query) else '{}' end;
  select coalesce(offer_stems, '{}') into mine from public.profiles where profiles.id = uid;
  return query
  select c.id, c.title, coalesce(c.summary, left(c.description, 280)), c.description, c.city, c.remote_ok, c.created_at,
         public.readable_hits(concat_ws(' ', c.title, c.description, c.summary), case when typed then l.qh else l.mh end),
         f.fit, o.n = 0, o.n,
         round(least(1, cardinality(case when typed then l.qh else l.mh end)::numeric / greatest(cardinality(c.stems), 1)), 4)
  from public.cases c
  cross join lateral (select array(select x from unnest(c.stems) x where x = any(q)) as qh,
                             array(select x from unnest(c.stems) x where x = any(mine)) as mh) l
  cross join lateral (select public.strong_match(cardinality(l.mh), cardinality(c.stems)) as fit) f
  cross join lateral (select count(*)::int as n from public.connections k
                      where k.case_id = c.id and k.status in ('pending', 'clarification_requested', 'accepted')) o
  where c.status = 'open' and c.visibility = 'public_anonymised' and c.kind = 'problem' and c.owner_id <> uid
    and not public.is_blocked_between(c.owner_id, uid)
    and (not typed or cardinality(l.qh) >= 1
         or c.title ilike '%' || trim(p_query) || '%' or c.description ilike '%' || trim(p_query) || '%')
  order by case p_sort
             when 'fit' then (case when f.fit then 1 else 0 end)::numeric * 10
                             + least(1, cardinality(l.mh)::numeric / greatest(cardinality(c.stems), 1))
             when 'waiting' then (case when o.n = 0 then 1 else 0 end)::numeric
             else 0 end desc,
           case when p_sort = 'waiting' then c.created_at end asc,
           c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 100));
end $$;

-- ============================================================
-- Explore: solvers (people who wrote what they offer)
-- "fit" = they match what I asked for in my own open problems
-- ============================================================
create or replace function public.explore_helpers(p_query text default '', p_sort text default 'new', p_limit int default 60)
returns table (id uuid, display_name text, headline text, about text, city text, availability_status text,
               verification text, is_demo boolean, updated_at timestamptz, hits text[], fits boolean, score numeric)
language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := public.me(); typed boolean := coalesce(trim(p_query), '') <> ''; q text[]; wants text[];
begin
  q := case when typed then public.text_stems(p_query) else '{}' end;
  select coalesce(array_agg(distinct s), '{}') into wants
  from public.cases c2, unnest(c2.stems) s
  where c2.owner_id = uid and c2.status = 'open' and c2.kind = 'problem';
  return query
  select p.id, p.display_name, p.headline, coalesce(p.offer_summary, left(p.offer_text, 300)), p.city,
         p.availability_status, p.verification, p.is_demo, p.offer_updated_at,
         public.readable_hits(concat_ws(' ', p.offer_text, p.headline), case when typed then l.qh else l.wh end),
         f.fit,
         round(least(1, cardinality(case when typed then l.qh else l.wh end)::numeric
                        / greatest(cardinality(case when typed then q else wants end), 1)), 4)
  from public.profiles p
  cross join lateral (select array(select x from unnest(p.offer_stems) x where x = any(q)) as qh,
                             array(select x from unnest(p.offer_stems) x where x = any(wants)) as wh) l
  cross join lateral (select cardinality(l.wh) >= 2 as fit) f
  where p.id <> uid and p.status = 'active' and p.discoverable and p.intent in ('solver', 'both')
    and p.offer_text is not null and not public.is_blocked_between(uid, p.id)
    and (not typed or cardinality(l.qh) >= 1
         or p.offer_text ilike '%' || trim(p_query) || '%' or p.display_name ilike '%' || trim(p_query) || '%')
  order by case when p_sort = 'fit' and f.fit then 1 else 0 end desc,
           case when p_sort = 'fit' then cardinality(l.wh) else 0 end desc,
           p.offer_updated_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 60), 100));
end $$;

-- ============================================================
-- Offer help on a problem from ANY account.
-- Someone who only signed up to ask for help can still help: helping is switched on for them.
-- ============================================================
create or replace function public.offer_help(p_case uuid, p_message text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me();
begin
  update public.profiles set intent = 'both' where id = uid and intent = 'seeker';
  return public.send_request(p_case, uid, p_message);
end $$;

-- ============================================================
-- Chat with a solver straight from Explore.
-- Opens a small private conversation: the solver sees your message as a request.
-- When they accept, you chat freely. Before that each side can send up to 3 messages.
-- ============================================================
create or replace function public.contact_helper(p_helper uuid, p_message text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.me(); cid uuid; ok boolean; ttl text;
begin
  if char_length(trim(coalesce(p_message, ''))) < 3 then raise exception 'Tell me a little more'; end if;
  if p_helper = uid then raise exception 'You cannot invite yourself'; end if;
  select true into ok from public.profiles
   where id = p_helper and status = 'active' and discoverable and intent in ('solver', 'both');
  if ok is null then raise exception 'This person is not available'; end if;
  ttl := left(regexp_replace(trim(p_message), '[.!?\n].*$', ''), 140);
  if char_length(ttl) < 3 then ttl := 'A message'; end if;
  perform set_config('app.rpc', 'on', true);
  insert into public.cases (owner_id, title, description, status, visibility, kind, remote_ok)
  values (uid, ttl, left(trim(p_message), 5000), 'open', 'private', 'chat', true)
  returning id into cid;
  return public.send_request(cid, p_helper, p_message);
end $$;

-- ============================================================
-- Keep chat openers out of matching, notifications and admin counts
-- ============================================================
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
            where status = 'open' and kind = 'problem' and owner_id <> uid order by created_at desc limit 150 loop
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

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_check();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'helpers', (select count(*) from public.profiles where offer_text is not null and status = 'active'),
    'suspended', (select count(*) from public.profiles where status <> 'active'),
    'cases_open', (select count(*) from public.cases where kind = 'problem' and status in ('open','in_progress','resolution_proposed')),
    'waiting_problems', (select count(*) from public.cases c where c.kind = 'problem' and c.status = 'open'
                          and not exists (select 1 from public.matches m where m.case_id = c.id)),
    'cases_resolved', (select count(*) from public.cases where kind = 'problem' and status = 'resolved'),
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
  where c.kind = 'problem' and c.status = 'open' and not exists (select 1 from public.matches m where m.case_id = c.id)
  order by c.created_at limit 100;
end $$;

-- ============================================================
-- Apply the new rules to everything already saved
-- ============================================================
update public.profiles set offer_keywords = offer_keywords;
update public.cases set title = title;
delete from public.matches where decision is null;
select public.find_matches_for_case(id) from public.cases where kind = 'problem' and status = 'open';
