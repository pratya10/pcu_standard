-- Unify Must-criteria and Evidence checklists into topic_score_items too,
-- so every checklist in a topic (Must / Evidence / CI 0-2) shares the same
-- per-item comment (scores.item_notes) and per-item photo (topic_photos)
-- infrastructure instead of each having its own bespoke storage.
--   score_level -2 = evidence item (was topic_evidence_items)
--   score_level -1 = Must criterion (was only free text in topics.must_text)
--   score_level 0/1/2 = Continuous Improvement criteria (unchanged)
alter table public.topic_score_items drop constraint if exists topic_score_items_score_level_check;
alter table public.topic_score_items add constraint topic_score_items_score_level_check check (score_level in (-2, -1, 0, 1, 2));
