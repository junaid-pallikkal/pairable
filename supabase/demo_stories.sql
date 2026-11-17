-- RePair DEMO data for the grandmother-and-parent story. Run AFTER supabase/ai_matching.sql.
-- Adds: 5 demo helpers (3 grandmothers who tell stories, a retired teacher, a home cook)
--       and 2 demo parents with problems. One problem has a match, one deliberately has none ("waiting").
-- Demo people cannot log in. Removed together with the other demo data by supabase/demo_remove.sql.
-- Safe to run twice.

alter table public.profiles add column if not exists is_demo boolean not null default false;

delete from auth.users where email like '%@story.demo.repair.test';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name', v.name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000b01', 'leela@story.demo.repair.test',     'Leela Amma'),
  ('00000000-0000-4000-8000-000000000b02', 'saraswati@story.demo.repair.test', 'Saraswati Bai'),
  ('00000000-0000-4000-8000-000000000b03', 'meenakshi@story.demo.repair.test', 'Meenakshi Paati'),
  ('00000000-0000-4000-8000-000000000b04', 'thomas@story.demo.repair.test',    'Thomas Kurian'),
  ('00000000-0000-4000-8000-000000000b05', 'zainab@story.demo.repair.test',    'Zainab Khan'),
  ('00000000-0000-4000-8000-000000000b06', 'neha@story.demo.repair.test',      'Neha Kapoor'),
  ('00000000-0000-4000-8000-000000000b07', 'arjun@story.demo.repair.test',     'Arjun Rao')
) as v(id, email, name);

-- helpers: one free-text message each, exactly what a real person would write to Pip
update public.profiles p set
  intent = 'solver', is_demo = true, availability_status = 'open', discoverable = true, onboarded_at = now(),
  city = v.city, state = v.state,
  headline = v.headline, offer_text = v.offer, offer_summary = v.summary
from (values
  ('00000000-0000-4000-8000-000000000b01', 'Kochi', 'Kerala',
   'Grandmother who loves telling bedtime stories',
   'I am a grandmother and I have told bedtime stories to children for forty years. My grandchildren live abroad now, so I have no little ones to tell my stories to. I know folk tales, fairy tales and Malayalam stories, and I love telling them in the evening.',
   'A grandmother with forty years of bedtime stories, folk tales and fairy tales. Her grandchildren live abroad, so she is happy to tell stories to other children.'),
  ('00000000-0000-4000-8000-000000000b02', 'Pune', 'Maharashtra',
   'Retired teacher who tells stories with puppets',
   'Retired schoolteacher and a grandmother of three. I tell stories to children aged three to eight using puppets and songs. I can do evenings or weekends and I enjoy being around kids.',
   'A retired teacher and grandmother who tells stories with puppets and songs for children aged three to eight.'),
  ('00000000-0000-4000-8000-000000000b03', 'Chennai', 'Tamil Nadu',
   'Paati with hundreds of Tamil tales and lullabies',
   'I am a paati who knows hundreds of Tamil stories and lullabies. My grandchildren are grown up. I can tell stories over a video call to kids who miss having grandparents around.',
   'A grandmother who tells Tamil stories and sings lullabies, happy to do it over video calls.'),
  ('00000000-0000-4000-8000-000000000b04', 'Kozhikode', 'Kerala',
   'Retired English teacher who reads to children',
   'Retired English teacher. I read picture books aloud to children and help young readers practise reading. Calm, patient and good with shy kids.',
   'A retired English teacher who reads aloud to children and helps young readers practise.'),
  ('00000000-0000-4000-8000-000000000b05', 'Hyderabad', 'Telangana',
   'Home cook who teaches simple recipes',
   'I cook at home every day and I teach beginners simple Indian recipes, especially students living alone and people who have never cooked before.',
   'A home cook who teaches beginners and students simple everyday Indian recipes.')
) as v(id, city, state, headline, offer, summary)
where p.id = v.id::uuid;

-- parents (seekers)
update public.profiles p set intent = 'seeker', is_demo = true, onboarded_at = now(), city = v.city, state = v.state
from (values
  ('00000000-0000-4000-8000-000000000b06', 'Bengaluru', 'Karnataka'),
  ('00000000-0000-4000-8000-000000000b07', 'Hyderabad', 'Telangana')
) as v(id, city, state)
where p.id = v.id::uuid;

-- problem 1: has matches (the grandmothers)
-- problem 2: no helper yet, so the seeker sees "I will notify you". A helper who teaches seniors phones will match it live.
insert into public.cases (id, owner_id, title, description, summary, status, visibility, remote_ok, city, state, created_at)
values
  ('00000000-0000-4000-8000-0000000d0001', '00000000-0000-4000-8000-000000000b06',
   'A grandmother to tell bedtime stories to my kids',
   'I am looking for a grandmother who can tell bedtime stories to my two young kids in the evenings. We live far from our own grandparents and the children really miss that.',
   'A parent wants a grandmother to tell bedtime stories to two young children in the evenings.',
   'open', 'public_anonymised', true, 'Bengaluru', 'Karnataka', now() - interval '3 hours'),
  ('00000000-0000-4000-8000-0000000d0002', '00000000-0000-4000-8000-000000000b07',
   'Someone to teach my father to use a smartphone',
   'My father is 72 and cannot use a smartphone. He wants to make WhatsApp video calls to his family. I need someone to teach him how to use it.',
   'A son needs someone to teach his elderly father to use a smartphone and make video calls.',
   'open', 'public_anonymised', true, 'Hyderabad', 'Telangana', now() - interval '5 hours');

select public.find_matches_for_case('00000000-0000-4000-8000-0000000d0001');
select public.find_matches_for_case('00000000-0000-4000-8000-0000000d0002');
