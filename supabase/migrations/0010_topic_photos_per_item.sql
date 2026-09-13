-- Photo evidence moves from "one shared bucket per topic" to "one shared
-- bucket per checklist sub-item" (still shared across the whole committee,
-- just scoped one level deeper so each sub-item's evidence is separate).
alter table public.topic_photos
  add column if not exists item_id uuid references public.topic_score_items(id) on delete cascade;

create index if not exists topic_photos_item_idx on public.topic_photos (item_id);
