-- A short, admin-editable nickname per topic — the sidebar nav row only has
-- room for the topic code plus its Must/CI result, so the full name (often
-- a long bilingual title) never fit there at all.
alter table public.topics
  add column if not exists short_name text;
