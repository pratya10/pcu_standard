-- Itemized checklist per topic per score level (0/1/2), so committees can
-- check off individual criteria (e.g. the 4 separate clauses bundled into
-- topic 1.2's "2 คะแนน" description) instead of only picking one overall
-- score for a paragraph that actually bundles several distinct conditions.
create table public.topic_score_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  score_level smallint not null check (score_level in (0, 1, 2)),
  item_text text not null,
  sort_order int not null default 0
);
create index topic_score_items_topic_idx on public.topic_score_items (topic_id, score_level, sort_order);

alter table public.topic_score_items enable row level security;
create policy "topic_score_items_read" on public.topic_score_items for select using (true);
create policy "topic_score_items_write" on public.topic_score_items for all
  using (public.is_admin()) with check (public.is_admin());

-- Per-checklist-item check state + free-text comment, keyed by which
-- `scores` row (one per round/topic/participant) it belongs to. Stored as
-- jsonb keyed by topic_score_items.id: { "<item_id>": { "checked": bool,
-- "comment": "..." } }. Piggybacks on the existing scores insert/update
-- policies — no new RLS needed for this column.
alter table public.scores
  add column if not exists item_notes jsonb not null default '{}'::jsonb;

-- Photo evidence, shared per round+topic (not per participant, since the
-- whole committee is looking at the same site) rather than tied to one
-- person's score row.
create table public.topic_photos (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.assessment_rounds(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  uploaded_by uuid references public.participants(id) on delete set null,
  file_path text not null,
  file_name text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);
create index topic_photos_round_topic_idx on public.topic_photos (round_id, topic_id);

alter table public.topic_photos enable row level security;
create policy "topic_photos_read" on public.topic_photos for select using (true);
create policy "topic_photos_insert" on public.topic_photos for insert
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
create policy "topic_photos_delete" on public.topic_photos for delete
  using (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );

-- Storage bucket for the actual files. Kept open (like committee_members)
-- rather than admin-gated, since evaluators need frictionless upload from
-- their phones while walking the site; the app enforces the 30MB/file and
-- 5-photos/topic limits client-side, and admins can remove anything later.
insert into storage.buckets (id, name, public, file_size_limit)
values ('topic-evidence', 'topic-evidence', true, 31457280)
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

create policy "topic_evidence_read" on storage.objects for select
  using (bucket_id = 'topic-evidence');
create policy "topic_evidence_insert" on storage.objects for insert
  with check (bucket_id = 'topic-evidence');
create policy "topic_evidence_delete" on storage.objects for delete
  using (bucket_id = 'topic-evidence');
