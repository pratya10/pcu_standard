-- Admin allowlist: gates who may actually act as admin. Until now every
-- policy checked auth.role() = 'authenticated', which — now that Google
-- sign-in accepts any Google account — would let literally anyone who logs
-- in manage the whole system. This introduces an explicit allowlist and a
-- helper function, then tightens the write policies from earlier
-- migrations to require membership in it.
--
-- Written to be safely re-runnable (create-if-not-exists / drop-then-create
-- policy) in case an earlier attempt partially applied.

create table if not exists public.admin_allowlist (
  email text primary key,
  added_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.admin_allowlist enable row level security;

-- security definer so it can read admin_allowlist regardless of the
-- caller's own RLS visibility, without ever exposing table contents itself.
-- Defined before any policy references it — Postgres validates that a
-- function used in a policy expression already exists.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_allowlist a
    where lower(a.email) = lower(coalesce((auth.jwt() ->> 'email'), ''))
  );
$$;

-- Any signed-in user can check the list (needed to self-gate on login);
-- only an existing admin can add or remove entries.
drop policy if exists "admin_allowlist_read" on public.admin_allowlist;
create policy "admin_allowlist_read" on public.admin_allowlist for select
  using (auth.role() = 'authenticated');
drop policy if exists "admin_allowlist_insert" on public.admin_allowlist;
create policy "admin_allowlist_insert" on public.admin_allowlist for insert
  with check (public.is_admin());
drop policy if exists "admin_allowlist_delete" on public.admin_allowlist;
create policy "admin_allowlist_delete" on public.admin_allowlist for delete
  using (public.is_admin());

-- Tighten write policies that previously accepted any authenticated user.
drop policy if exists "facilities_write" on public.facilities;
create policy "facilities_write" on public.facilities for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "standard_versions_write" on public.standard_versions;
create policy "standard_versions_write" on public.standard_versions for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "categories_write" on public.categories;
create policy "categories_write" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "topic_groups_write" on public.topic_groups;
create policy "topic_groups_write" on public.topic_groups for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "topics_write" on public.topics;
create policy "topics_write" on public.topics for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "topic_evidence_items_write" on public.topic_evidence_items;
create policy "topic_evidence_items_write" on public.topic_evidence_items for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "rounds_insert" on public.assessment_rounds;
create policy "rounds_insert" on public.assessment_rounds for insert
  with check (public.is_admin());
drop policy if exists "rounds_update" on public.assessment_rounds;
create policy "rounds_update" on public.assessment_rounds for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "rounds_delete" on public.assessment_rounds;
create policy "rounds_delete" on public.assessment_rounds for delete
  using (public.is_admin());

drop policy if exists "participants_insert" on public.participants;
create policy "participants_insert" on public.participants for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
drop policy if exists "participants_update" on public.participants;
create policy "participants_update" on public.participants for update
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "participants_delete" on public.participants;
create policy "participants_delete" on public.participants for delete
  using (public.is_admin());

drop policy if exists "scores_insert" on public.scores;
create policy "scores_insert" on public.scores for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
drop policy if exists "scores_update" on public.scores;
create policy "scores_update" on public.scores for update
  using (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
drop policy if exists "scores_delete" on public.scores;
create policy "scores_delete" on public.scores for delete
  using (public.is_admin());

drop policy if exists "branding_write" on storage.objects;
create policy "branding_write" on storage.objects for insert
  with check (bucket_id = 'branding' and public.is_admin());
drop policy if exists "branding_update" on storage.objects;
create policy "branding_update" on storage.objects for update
  using (bucket_id = 'branding' and public.is_admin())
  with check (bucket_id = 'branding' and public.is_admin());
drop policy if exists "branding_delete" on storage.objects;
create policy "branding_delete" on storage.objects for delete
  using (bucket_id = 'branding' and public.is_admin());

drop policy if exists "admin_profiles_write" on public.admin_profiles;
create policy "admin_profiles_write" on public.admin_profiles for insert
  with check (auth.uid() = user_id and public.is_admin());
drop policy if exists "admin_profiles_update" on public.admin_profiles;
create policy "admin_profiles_update" on public.admin_profiles for update
  using (auth.uid() = user_id and public.is_admin())
  with check (auth.uid() = user_id and public.is_admin());

-- Standalone committee-member registry: reference data an admin curates
-- (rank/level, affiliation, position, contact) independent of any one
-- assessment round, e.g. for printed appendices or to keep spelling
-- consistent across rounds. Distinct from `participants`, which records
-- who actually joined and scored a specific round.
create table if not exists public.committee_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  civil_service_level text,
  affiliation text,
  position text,
  phone text,
  email text,
  note text,
  created_at timestamptz not null default now()
);

alter table public.committee_members enable row level security;
drop policy if exists "committee_members_read" on public.committee_members;
create policy "committee_members_read" on public.committee_members for select using (true);
drop policy if exists "committee_members_write" on public.committee_members;
create policy "committee_members_write" on public.committee_members for all
  using (public.is_admin()) with check (public.is_admin());
