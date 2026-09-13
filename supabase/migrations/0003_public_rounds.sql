-- Lets an admin mark a completed assessment round as publicly viewable
-- (e.g. once the committee has finished and approved release of results).
-- assessment_rounds already has an open SELECT policy (rounds_read), so no
-- RLS change is needed for the public history page to query this column.

alter table public.assessment_rounds
  add column if not exists is_public boolean not null default false;
