-- Mirrors must_pass_updated_by (0014): the shared `updated_at` column bumps
-- on every save regardless of which field changed, so it can't be trusted
-- as "when the Must result was last set" once we show that time in the UI.
alter table public.team_scores
  add column if not exists must_pass_updated_at timestamptz;
