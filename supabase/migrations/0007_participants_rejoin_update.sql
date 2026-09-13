-- The Join form now resumes an existing participant row (same round +
-- name + role) instead of creating a duplicate when someone rejoins after
-- accidentally leaving. 0005 restricted participants UPDATE to admins only,
-- which blocked that anonymous rejoin-update. Loosen it to match the
-- existing insert policy: anon may update while the round is still active.
drop policy if exists "participants_update" on public.participants;
create policy "participants_update" on public.participants for update
  using (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.assessment_rounds r where r.id = round_id and r.status <> 'completed')
  );
