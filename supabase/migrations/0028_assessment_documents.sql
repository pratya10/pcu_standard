-- Assessment reference documents ("เอกสารการประเมิน"): admin-uploaded files stored on
-- the organization's shared Google Drive account, mirroring msh-organize's /doc?tab=files
-- pattern (same Drive account/credentials, reused from public.system_google_credentials
-- in this shared project — see supabase/functions/pcu-doc/drive.ts).
-- No RLS policies here on purpose — all access goes through the pcu-doc Edge Function
-- (service role), which strips drive_file_id/drive_upload_url before responding and
-- enforces admin-only writes via pcu_standard.admin_allowlist.
create table if not exists pcu_standard.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null,
  drive_file_id text,
  drive_upload_url text,
  uploaded_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table pcu_standard.documents enable row level security;

grant select, insert, update, delete on pcu_standard.documents to anon, authenticated, service_role;
