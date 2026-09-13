-- The existing updated_by/updated_at on team_scores only tracked "who
-- touched this row last" as a whole. To show "แก้ล่าสุดโดย ..." under each
-- individually-clickable control (CI score, Must result, and each checklist
-- item), we need attribution per field, not just per row.
--   updated_by            -> now specifically "who last set the CI score"
--   must_pass_updated_by  -> "who last set the Must result" (new)
--   item checklist notes  -> "checkedBy" added inside the existing
--                            item_notes jsonb blob (no schema change needed)
alter table public.team_scores
  add column if not exists must_pass_updated_by uuid references public.participants(id) on delete set null;
