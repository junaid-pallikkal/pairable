-- RePair: photos and supporting files. Run ONCE in the Supabase SQL editor, after explore.sql.
-- Adds: a profile photo for everyone, and photos, short videos or documents that
--   - helpers show on their profile (their work), and
--   - problem makers attach to a problem (visual direction for helpers).
-- Files are stored in two public buckets with random file names. Anyone who can see the profile or problem can open them.
-- Safe to run twice.

alter table public.profiles add column if not exists avatar_url text;

-- ============================================================
-- Storage buckets and who may upload
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('media', 'media', true, 20971520, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime',
                                           'application/pdf', 'application/msword',
                                           'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- a person can only add, replace or delete files inside their own folder (the folder is their user id)
drop policy if exists "repair_upload_own" on storage.objects;
create policy "repair_upload_own" on storage.objects for insert to authenticated
  with check (bucket_id in ('avatars', 'media') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "repair_update_own" on storage.objects;
create policy "repair_update_own" on storage.objects for update to authenticated
  using (bucket_id in ('avatars', 'media') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "repair_delete_own" on storage.objects;
create policy "repair_delete_own" on storage.objects for delete to authenticated
  using (bucket_id in ('avatars', 'media') and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- The list of files shown on profiles and problems
-- ============================================================
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('profile', 'problem')),
  case_id uuid references public.cases(id) on delete cascade,
  url text not null,
  path text not null,
  file_type text not null check (file_type in ('image', 'video', 'document')),
  name text check (char_length(name) <= 200),
  size_bytes int,
  created_at timestamptz not null default now(),
  check ((kind = 'problem' and case_id is not null) or (kind = 'profile' and case_id is null))
);
create index if not exists media_owner_idx on public.media (owner_id, kind);
create index if not exists media_case_idx on public.media (case_id);
alter table public.media enable row level security;

-- who may see the files of a problem: its owner, people connected to it, and anyone who can browse it
create or replace function public.can_see_case_media(p_case uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view_case(p_case)
      or exists (select 1 from public.cases c
                 where c.id = p_case and c.visibility = 'public_anonymised' and c.status in ('open', 'in_progress'));
$$;

drop policy if exists media_read on public.media;
create policy media_read on public.media for select to authenticated
  using (kind = 'profile' or public.can_see_case_media(case_id));
drop policy if exists media_insert on public.media;
create policy media_insert on public.media for insert to authenticated
  with check (owner_id = auth.uid() and (kind = 'profile' or public.is_case_owner(case_id)));
drop policy if exists media_delete on public.media;
create policy media_delete on public.media for delete to authenticated using (owner_id = auth.uid());
drop policy if exists active_only on public.media;
create policy active_only on public.media as restrictive for all to authenticated
  using (public.is_active()) with check (public.is_active());

-- keep it reasonable: 8 files on a profile, 5 on a problem
create or replace function public.limit_media() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'profile' and (select count(*) from public.media where owner_id = new.owner_id and kind = 'profile') >= 8 then
    raise exception 'You can add up to 8 files to your profile';
  end if;
  if new.kind = 'problem' and (select count(*) from public.media where case_id = new.case_id) >= 5 then
    raise exception 'You can add up to 5 files to a problem';
  end if;
  return new;
end $$;
drop trigger if exists media_limit on public.media;
create trigger media_limit before insert on public.media
  for each row execute function public.limit_media();

-- ============================================================
-- Explore: people now come with their photo
-- ============================================================
drop function if exists public.explore_helpers(text, text, int);
create function public.explore_helpers(p_query text default '', p_sort text default 'new', p_limit int default 60)
returns table (id uuid, display_name text, headline text, about text, city text, availability_status text,
               verification text, is_demo boolean, updated_at timestamptz, hits text[], fits boolean, score numeric,
               avatar_url text)
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
                        / greatest(cardinality(case when typed then q else wants end), 1)), 4),
         p.avatar_url
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
