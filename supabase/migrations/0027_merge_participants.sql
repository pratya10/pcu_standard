-- Admin utility: two participant rows in the same round turn out to be the
-- same physical evaluator — most often someone mis-typed their own name,
-- got it corrected by the admin, and now shows up twice under the same
-- name. This folds `merge_id`'s scores and collaborative-mode attribution
-- into `keep_id`, then removes the now-redundant participant row, so the
-- round shows one evaluator instead of two.
create or replace function public.merge_participants(keep_id uuid, merge_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_round uuid;
  merge_round uuid;
  moved_scores int := 0;
  resolved_conflicts int := 0;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if keep_id = merge_id then
    raise exception 'cannot merge a participant into itself';
  end if;

  select round_id into keep_round from public.participants where id = keep_id;
  select round_id into merge_round from public.participants where id = merge_id;

  if keep_round is null or merge_round is null then
    raise exception 'participant not found';
  end if;
  if keep_round <> merge_round then
    raise exception 'participants must belong to the same round';
  end if;

  -- Topics only merge_id scored: reassign the row outright.
  update public.scores
  set participant_id = keep_id
  where participant_id = merge_id
    and topic_id not in (
      select topic_id from public.scores where participant_id = keep_id
    );
  get diagnostics moved_scores = row_count;

  -- Topics both scored (e.g. they rejoined mid-survey and re-answered a
  -- few items): keep whichever entry was actually saved most recently.
  with newer_merge as (
    select m.id as merge_row_id, k.id as keep_row_id
    from public.scores m
    join public.scores k on k.topic_id = m.topic_id and k.participant_id = keep_id
    where m.participant_id = merge_id and m.updated_at > k.updated_at
  )
  update public.scores k
  set score = m.score,
      is_na = m.is_na,
      must_pass = m.must_pass,
      comment = m.comment,
      evidence_checked = m.evidence_checked,
      item_notes = m.item_notes,
      updated_at = m.updated_at
  from newer_merge nm
  join public.scores m on m.id = nm.merge_row_id
  where k.id = nm.keep_row_id;
  get diagnostics resolved_conflicts = row_count;

  delete from public.scores where participant_id = merge_id;

  -- Collaborative-mode "who last set this" pointers.
  update public.team_scores set updated_by = keep_id where updated_by = merge_id;
  update public.team_scores set must_pass_updated_by = keep_id where must_pass_updated_by = merge_id;

  -- Collaborative-mode checklist attribution + comment authorship embedded
  -- in item_notes jsonb (keyed by topic_score_items.id: { checkedBy,
  -- comments: [{ authorId, ... }] }). Left untouched, these ids would point
  -- at a participant row we're about to delete and fall back to a generic
  -- "กรรมการ" label in the UI.
  update public.team_scores ts
  set item_notes = (
    select coalesce(jsonb_object_agg(e.key, combined.note), '{}'::jsonb)
    from jsonb_each(ts.item_notes) e
    cross join lateral (
      select
        e.value
        || case when (e.value ->> 'checkedBy') = merge_id::text
                then jsonb_build_object('checkedBy', keep_id::text)
                else '{}'::jsonb
           end
        || case when e.value ? 'comments'
                then jsonb_build_object(
                       'comments',
                       (select coalesce(jsonb_agg(
                          case when (c ->> 'authorId') = merge_id::text
                               then c || jsonb_build_object('authorId', keep_id::text)
                               else c
                          end
                        ), '[]'::jsonb)
                        from jsonb_array_elements(e.value -> 'comments') c)
                     )
                else '{}'::jsonb
           end as note
    ) combined
  )
  where ts.round_id = keep_round
    and ts.item_notes::text like '%' || merge_id::text || '%';

  -- Audit trail + photo-evidence attribution.
  update public.team_score_audit set participant_id = keep_id where participant_id = merge_id;
  update public.topic_photos set uploaded_by = keep_id where uploaded_by = merge_id;

  delete from public.participants where id = merge_id;

  return jsonb_build_object('moved_scores', moved_scores, 'resolved_conflicts', resolved_conflicts);
end;
$$;
