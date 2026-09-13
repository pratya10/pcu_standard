-- Public storage bucket for site branding (logo shown on the home page and
-- on exported reports). Single well-known object path `logo` is
-- upserted/removed by the admin UI, so no extra settings table is needed.

insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = excluded.public;

create policy "branding_read" on storage.objects for select
  using (bucket_id = 'branding');

create policy "branding_write" on storage.objects for insert
  with check (bucket_id = 'branding' and auth.role() = 'authenticated');

create policy "branding_update" on storage.objects for update
  using (bucket_id = 'branding' and auth.role() = 'authenticated')
  with check (bucket_id = 'branding' and auth.role() = 'authenticated');

create policy "branding_delete" on storage.objects for delete
  using (bucket_id = 'branding' and auth.role() = 'authenticated');
