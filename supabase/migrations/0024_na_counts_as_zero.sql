-- N/A now counts as a score of 0 (still labeled "N/A" via is_na) instead of
-- being excluded from the average entirely — backfill existing rows saved
-- under the old semantics (score left null) so historical averages match.
update public.scores set score = 0 where is_na = true and score is null;
update public.team_scores set score = 0 where is_na = true and score is null;
