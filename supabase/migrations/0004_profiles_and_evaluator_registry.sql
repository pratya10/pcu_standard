-- Admin profile: real name + profession shown in the admin nav bar instead
-- of a generic "ผู้ดูแล" label.
create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  profession text,
  updated_at timestamptz not null default now()
);

alter table public.admin_profiles enable row level security;

-- Any signed-in admin can read the list (useful for "created by" style
-- attribution elsewhere); only the owner can write their own row.
drop policy if exists "admin_profiles_read" on public.admin_profiles;
create policy "admin_profiles_read" on public.admin_profiles for select
  using (auth.role() = 'authenticated');
drop policy if exists "admin_profiles_write" on public.admin_profiles;
create policy "admin_profiles_write" on public.admin_profiles for insert
  with check (auth.uid() = user_id);
drop policy if exists "admin_profiles_update" on public.admin_profiles;
create policy "admin_profiles_update" on public.admin_profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Evaluator registry: capture civil-service level and affiliated agency
-- alongside the name/role already collected when someone joins a round.
alter table public.participants
  add column if not exists civil_service_level text,
  add column if not exists affiliation text;
