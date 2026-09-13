-- Migration 0012 created team_scores/team_score_audit but forgot to register
-- them with Supabase Realtime (creating a table does NOT automatically add
-- it to logical replication) — so the collaborative "ทีมคณะกรรมช่วยกัน" mode's
-- live sync between committee members' screens never actually fired, and the
-- overwrite-confirmation logic (which relies on each screen having an
-- up-to-date view of what everyone else already set) worked from stale,
-- session-local data only, causing silent overwrites and inconsistent
-- "already set" prompts.
alter publication supabase_realtime add table public.team_scores;
alter publication supabase_realtime add table public.team_score_audit;
