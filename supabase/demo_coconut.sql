-- RePair DEMO: a problem with MANY solvers. "I have 127 coconut trees. I need someone to pluck the coconuts."
-- Adds 7 coconut pluckers (South Indian names) who differ in price, speed and quality, plus one demo problem.
-- Run after ai_matching.sql and explore.sql. Safe to run twice. Removed by supabase/demo_remove.sql
-- (the demo_remove.sql pattern also matches these accounts).

alter table public.profiles add column if not exists is_demo boolean not null default false;

-- words people use for the same idea (Malayalam "thenga", Tamil "thengai", Hindi "nariyal" all mean coconut)
insert into public.synonyms (word, adds) values
  ('pluck','pluck'), ('plucks','pluck'), ('plucking','pluck'), ('plucker','pluck'), ('pluckers','pluck'),
  ('harvest','pluck'), ('harvesting','pluck'), ('climb','pluck'), ('climbing','pluck'), ('climber','pluck'), ('climbers','pluck'),
  ('coconut','coconut'), ('coconuts','coconut'), ('thenga','coconut'), ('thengai','coconut'), ('nariyal','coconut'), ('kobbari','coconut'),
  ('tree','tree'), ('trees','tree'), ('palm','tree'), ('palms','tree')
on conflict (word) do update set adds = excluded.adds;

delete from auth.users where email like '%@coconut.demo.repair.test';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name', v.name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000c01', 'rajan@coconut.demo.repair.test',    'Rajan Nair'),
  ('00000000-0000-4000-8000-000000000c02', 'babu@coconut.demo.repair.test',     'Babu Menon'),
  ('00000000-0000-4000-8000-000000000c03', 'murugan@coconut.demo.repair.test',  'Murugan Pillai'),
  ('00000000-0000-4000-8000-000000000c04', 'suresh@coconut.demo.repair.test',   'Suresh Warrier'),
  ('00000000-0000-4000-8000-000000000c05', 'karthik@coconut.demo.repair.test',  'Karthikeyan Raja'),
  ('00000000-0000-4000-8000-000000000c06', 'lakshmi@coconut.demo.repair.test',  'Lakshmi Kutty'),
  ('00000000-0000-4000-8000-000000000c07', 'gopal@coconut.demo.repair.test',    'Gopalakrishna Gowda'),
  ('00000000-0000-4000-8000-000000000c08', 'pradeep@coconut.demo.repair.test',  'Pradeep Varma')
) as v(id, email, name);

-- Each helper wrote it the way a real person would. Price, speed and style are in their own words,
-- and the cards read them from there (nothing is invented).
update public.profiles p set
  intent = 'solver', is_demo = true, availability_status = v.avail, discoverable = true, onboarded_at = now(),
  city = v.city, state = v.state, headline = v.headline, offer_text = v.offer, offer_summary = v.offer
from (values
  ('00000000-0000-4000-8000-000000000c01', 'Kochi', 'Kerala', 'open', 'Coconut tree climber, cheapest honest rate',
   'I am a coconut tree climber for 22 years. I pluck coconuts for ₹7 per tree. I can do about 35 trees a day. Reliable and I always come on the day I say.'),
  ('00000000-0000-4000-8000-000000000c02', 'Kottayam', 'Kerala', 'open', 'Coconut plucker with my own ropes and tools',
   'I pluck coconuts from tall trees for ₹8 per tree. I do about 50 trees a day and bring my own rope and tools. Evenings and weekends are fine.'),
  ('00000000-0000-4000-8000-000000000c03', 'Pollachi', 'Tamil Nadu', 'open', 'Fastest: a team of three, big plantations',
   'We are a team of three coconut pluckers from Pollachi. We charge ₹9 per tree and do about 150 trees a day, so even a large plantation is finished in one morning. Very fast.'),
  ('00000000-0000-4000-8000-000000000c04', 'Thrissur', 'Kerala', 'limited', 'Careful coconut climber, cleans the crown',
   'Careful coconut tree climber, 15 years. I do not damage young nuts or fronds. I clean the crown, remove dry leaves and stack all the nuts neatly. ₹11 per tree. I do about 30 trees a day.'),
  ('00000000-0000-4000-8000-000000000c05', 'Coimbatore', 'Tamil Nadu', 'open', 'Climbing machine, quick and safe',
   'I use a coconut climbing machine, so no ladder or rope is needed. ₹8 per tree and about 70 trees a day. Quick and safe, and I can start tomorrow.'),
  ('00000000-0000-4000-8000-000000000c06', 'Alappuzha', 'Kerala', 'open', 'Gentle coconut plucker, I also tidy the garden',
   'I pluck coconuts gently, with no damage to the tree. ₹7 per tree, about 25 trees a day. I also remove dry leaves for free and collect every nut.'),
  ('00000000-0000-4000-8000-000000000c07', 'Tiptur', 'Karnataka', 'open', 'Coconut harvesting, 18 years of plantations',
   'Coconut harvesting for plantations, 18 years of experience. ₹10 per tree. About 90 trees a day with my helper. Dependable, and I stack and count the nuts for you.')
) as v(id, city, state, avail, headline, offer)
where p.id = v.id::uuid;

update public.profiles set intent = 'seeker', is_demo = true, onboarded_at = now(), city = 'Kollam', state = 'Kerala'
where id = '00000000-0000-4000-8000-000000000c08';

-- a natural, simple problem, the way a person would say it
insert into public.cases (id, owner_id, title, description, summary, status, visibility, remote_ok, city, state, created_at)
values ('00000000-0000-4000-8000-0000000e0001', '00000000-0000-4000-8000-000000000c08',
        'Someone to pluck my coconuts',
        'I have 127 coconut trees and I need someone to pluck the coconuts. I can show the trees any day this week.',
        'A farmer needs someone to pluck coconuts from 127 trees this week.',
        'open', 'public_anonymised', false, 'Kollam', 'Kerala', now() - interval '2 hours');

-- recompute words and matches with the new synonyms
update public.profiles set offer_keywords = offer_keywords;
update public.cases set title = title;
delete from public.matches where decision is null;
select public.find_matches_for_case(id) from public.cases where kind = 'problem' and status = 'open';
