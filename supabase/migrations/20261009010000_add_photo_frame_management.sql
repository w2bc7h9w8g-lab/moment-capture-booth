create table if not exists public.photo_frames (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  storage_path text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.photo_frames enable row level security;

drop policy if exists "Active photo frames are visible to kiosk" on public.photo_frames;
create policy "Active photo frames are visible to kiosk"
on public.photo_frames for select to anon, authenticated
using (is_active = true);

drop policy if exists "Admins can manage photo frames" on public.photo_frames;
create policy "Admins can manage photo frames"
on public.photo_frames for all to authenticated
using (exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'))
with check (exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()) and r.role = 'admin'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photo-frames', 'photo-frames', true, 5242880, array['image/png','image/webp'])
on conflict (id) do update
set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png','image/webp'];

drop policy if exists "Photo frames are publicly readable" on storage.objects;
create policy "Photo frames are publicly readable"
on storage.objects for select to anon, authenticated
using (bucket_id = 'photo-frames');

drop policy if exists "Admins can upload photo frames" on storage.objects;
create policy "Admins can upload photo frames"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'photo-frames'
  and name like 'frames/%'
  and exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()) and r.role = 'admin')
);

drop policy if exists "Admins can update photo frames" on storage.objects;
create policy "Admins can update photo frames"
on storage.objects for update to authenticated
using (
  bucket_id = 'photo-frames'
  and exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()) and r.role = 'admin')
)
with check (
  bucket_id = 'photo-frames'
  and name like 'frames/%'
  and exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()) and r.role = 'admin')
);

drop policy if exists "Admins can delete photo frames" on storage.objects;
create policy "Admins can delete photo frames"
on storage.objects for delete to authenticated
using (
  bucket_id = 'photo-frames'
  and name like 'frames/%'
  and exists (select 1 from public.staff_roles r where r.user_id = (select auth.uid()) and r.role = 'admin')
);
