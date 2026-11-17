-- RePair DEMO data. Run once in the Supabase SQL editor (after schema.sql and phase9.sql).
-- Adds: 6 demo people (with skills), 6 public problems, 6 resources.
-- Demo people cannot log in (random passwords) and are marked is_demo = true, shown as "Demo" in the app.
-- Safe to run twice (it replaces its own rows). Remove everything with supabase/demo_remove.sql.

alter table public.profiles add column if not exists is_demo boolean not null default false;

-- start clean: deleting the demo users removes their profiles, skills, problems and resources
delete from auth.users where email like '%@demo.repair.test';

-- ---------- people ----------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', v.id::uuid, 'authenticated', 'authenticated', v.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('display_name', v.name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000a01', 'anita@demo.repair.test',  'Anita Menon'),
  ('00000000-0000-4000-8000-000000000a02', 'rahul@demo.repair.test',  'Rahul Verma'),
  ('00000000-0000-4000-8000-000000000a03', 'priya@demo.repair.test',  'Priya Nair'),
  ('00000000-0000-4000-8000-000000000a04', 'imran@demo.repair.test',  'Imran Sheikh'),
  ('00000000-0000-4000-8000-000000000a05', 'kavya@demo.repair.test',  'Kavya Iyer'),
  ('00000000-0000-4000-8000-000000000a06', 'suresh@demo.repair.test', 'Suresh Pillai')
) as v(id, email, name);

update public.profiles p set
  headline = v.headline, bio = v.bio, city = v.city, state = v.state, intent = 'both',
  availability_status = v.avail, remote_ok = v.remote, onboarded_at = now(), is_demo = true
from (values
  ('00000000-0000-4000-8000-000000000a01', 'Full-stack developer', 'Builds small business websites and web apps. Happy to review code or explain things simply.', 'Kochi', 'Kerala', 'open', true),
  ('00000000-0000-4000-8000-000000000a02', 'Chartered accountant', 'Helps shops and freelancers with GST, income tax and clean books.', 'Pune', 'Maharashtra', 'open', true),
  ('00000000-0000-4000-8000-000000000a03', 'UI and brand designer', 'Logos, simple brand kits and app screens for small teams.', 'Bengaluru', 'Karnataka', 'limited', true),
  ('00000000-0000-4000-8000-000000000a04', 'Electrician and repair technician', 'Home wiring, appliance repair and safe fixes. On-site work only.', 'Mumbai', 'Maharashtra', 'open', false),
  ('00000000-0000-4000-8000-000000000a05', 'Research mentor', 'Guides students on research writing, statistics and exam preparation.', 'Chennai', 'Tamil Nadu', 'open', true),
  ('00000000-0000-4000-8000-000000000a06', 'Small business advisor', 'Business plans, first marketing steps and talking to investors.', 'Thiruvananthapuram', 'Kerala', 'limited', true)
) as v(id, headline, bio, city, state, avail, remote)
where p.id = v.id::uuid;

-- ---------- skills of the demo people ----------
insert into public.user_skills (user_id, skill_id, proficiency, years)
select v.uid::uuid, s.id, v.prof, v.yrs
from (values
  ('00000000-0000-4000-8000-000000000a01', 'Python', 4, 6),
  ('00000000-0000-4000-8000-000000000a01', 'React', 4, 5),
  ('00000000-0000-4000-8000-000000000a01', 'Web development', 4, 7),
  ('00000000-0000-4000-8000-000000000a02', 'GST filing', 4, 9),
  ('00000000-0000-4000-8000-000000000a02', 'Income tax', 4, 9),
  ('00000000-0000-4000-8000-000000000a02', 'Bookkeeping', 3, 8),
  ('00000000-0000-4000-8000-000000000a03', 'UI design', 4, 5),
  ('00000000-0000-4000-8000-000000000a03', 'Logo design', 3, 4),
  ('00000000-0000-4000-8000-000000000a04', 'Electrical repair', 4, 12),
  ('00000000-0000-4000-8000-000000000a04', 'Appliance repair', 3, 10),
  ('00000000-0000-4000-8000-000000000a05', 'Research writing', 4, 8),
  ('00000000-0000-4000-8000-000000000a05', 'Statistics', 4, 7),
  ('00000000-0000-4000-8000-000000000a05', 'Maths tutoring', 3, 6),
  ('00000000-0000-4000-8000-000000000a06', 'Business plan', 4, 10),
  ('00000000-0000-4000-8000-000000000a06', 'Marketing', 3, 8),
  ('00000000-0000-4000-8000-000000000a06', 'Fundraising', 3, 5)
) as v(uid, skill, prof, yrs)
join public.skills s on lower(s.name) = lower(v.skill);

-- ---------- 6 public problems ----------
insert into public.cases (id, owner_id, title, description, urgency, city, state, remote_ok, budget_min, budget_max,
                          category_id, status, visibility, created_at)
select v.id::uuid, v.owner::uuid, v.title, v.descr, v.urgency, v.city, v.state, v.remote, v.bmin, v.bmax,
       (select c.id from public.categories c where c.name = v.cat), 'open', 'public_anonymised',
       now() - (v.age || ' hours')::interval
from (values
  ('00000000-0000-4000-8000-0000000c0001', '00000000-0000-4000-8000-000000000a02', 'Small booking website for my clinic',
   'I need a simple website where patients can see timings and book a slot. Mobile friendly. I can share the content and photos.',
   'this_month', 'Pune', 'Maharashtra', true, 15000, 40000, 'Technology & Software', 5),
  ('00000000-0000-4000-8000-0000000c0002', '00000000-0000-4000-8000-000000000a01', 'GST registration and monthly filing for a new shop',
   'Starting a small online shop. Need help registering for GST and setting up a simple monthly filing routine.',
   'this_week', 'Kochi', 'Kerala', true, 3000, 8000, 'Finance & Accounting', 9),
  ('00000000-0000-4000-8000-0000000c0003', '00000000-0000-4000-8000-000000000a03', 'Electrician for rewiring a 2BHK flat',
   'Old wiring needs replacing in a two bedroom flat. Looking for a licensed electrician who can inspect first and quote.',
   'this_week', 'Bengaluru', 'Karnataka', false, 10000, 25000, 'Home & Local Services', 14),
  ('00000000-0000-4000-8000-0000000c0004', '00000000-0000-4000-8000-000000000a04', 'Logo and simple look for my repair shop',
   'Need a clean logo and a colour set I can use on the shop board, bills and a social page.',
   'flexible', 'Mumbai', 'Maharashtra', true, 2000, 6000, 'Design & Creative', 20),
  ('00000000-0000-4000-8000-0000000c0005', '00000000-0000-4000-8000-000000000a05', 'Review my business plan for a village dairy',
   'I have a draft plan for a small dairy collection centre. Want an experienced person to review numbers and next steps.',
   'this_month', 'Chennai', 'Tamil Nadu', true, 0, 5000, 'Business & Startups', 27),
  ('00000000-0000-4000-8000-0000000c0006', '00000000-0000-4000-8000-000000000a06', 'Help analysing survey results',
   'Collected 300 survey responses for a study. Need help choosing the right tests and reading the results.',
   'this_month', 'Thiruvananthapuram', 'Kerala', true, 2000, 7000, 'Research & Academia', 33)
) as v(id, owner, title, descr, urgency, city, state, remote, bmin, bmax, cat, age);

insert into public.case_skills (case_id, skill_id, importance)
select v.cid::uuid, s.id, v.imp
from (values
  ('00000000-0000-4000-8000-0000000c0001', 'Web development', 3),
  ('00000000-0000-4000-8000-0000000c0001', 'Python', 1),
  ('00000000-0000-4000-8000-0000000c0002', 'GST filing', 3),
  ('00000000-0000-4000-8000-0000000c0002', 'Bookkeeping', 2),
  ('00000000-0000-4000-8000-0000000c0003', 'Electrical repair', 3),
  ('00000000-0000-4000-8000-0000000c0004', 'Logo design', 3),
  ('00000000-0000-4000-8000-0000000c0004', 'UI design', 1),
  ('00000000-0000-4000-8000-0000000c0005', 'Business plan', 3),
  ('00000000-0000-4000-8000-0000000c0005', 'Fundraising', 1),
  ('00000000-0000-4000-8000-0000000c0006', 'Statistics', 3),
  ('00000000-0000-4000-8000-0000000c0006', 'Data analysis', 2)
) as v(cid, skill, imp)
join public.skills s on lower(s.name) = lower(v.skill);

-- ---------- 6 resources ----------
insert into public.resources (owner_id, direction, title, description, kind, category_id, city, state, status, created_at)
select v.owner::uuid, v.dir, v.title, v.descr, v.kind,
       (select c.id from public.categories c where c.name = v.cat), v.city, v.state, 'available',
       now() - (v.age || ' hours')::interval
from (values
  ('00000000-0000-4000-8000-000000000a01', 'offer', '3D printer time, 2 hours a week', 'A desktop 3D printer I can lend time on for small parts and prototypes. You bring the file.', 'physical', 'Design & Creative', 'Kochi', 'Kerala', 6),
  ('00000000-0000-4000-8000-000000000a02', 'offer', 'Laptop on loan for students', 'A spare laptop for a student or job seeker for up to a month. Pickup only.', 'physical', 'Education & Career', 'Pune', 'Maharashtra', 12),
  ('00000000-0000-4000-8000-000000000a03', 'offer', 'Co-working desk, weekday mornings', 'A quiet desk with Wi-Fi in a small studio. Free for people starting out.', 'space', 'Business & Startups', 'Bengaluru', 'Karnataka', 18),
  ('00000000-0000-4000-8000-000000000a04', 'offer', 'Multimeter and soldering kit', 'Basic electronics tools to borrow for a weekend. Show how to use them on request.', 'physical', 'Home & Local Services', 'Mumbai', 'Maharashtra', 24),
  ('00000000-0000-4000-8000-000000000a05', 'offer', 'Python and statistics course notes', 'Plain-language notes and exercises for learning Python and basic statistics. Shared as a link.', 'digital', 'Technology & Software', 'Chennai', 'Tamil Nadu', 30),
  ('00000000-0000-4000-8000-000000000a06', 'request', 'Camera and lights for a product shoot', 'Looking to borrow a camera and two lights for one afternoon to photograph products.', 'physical', 'Design & Creative', 'Thiruvananthapuram', 'Kerala', 36)
) as v(owner, dir, title, descr, kind, cat, city, state, age);
