-- Denormalize the admin's email onto admin_profiles so the admin-users list
-- (which only knows emails from admin_allowlist) can look up a matching
-- display name without needing access to auth.users directly.
alter table public.admin_profiles
  add column if not exists email text;
