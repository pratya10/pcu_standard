-- Committee-member registry is already public-read (0005). Evaluators
-- joining a round anonymously via join code can now also correct their own
-- entry (e.g. updated position/affiliation) from the join form itself,
-- without needing admin access. Read stays wide open, and admin still has
-- full insert/update/delete via committee_members_write (0005); this simply
-- adds an additional permissive UPDATE path for everyone else.
create policy "committee_members_public_update" on public.committee_members for update
  using (true) with check (true);
