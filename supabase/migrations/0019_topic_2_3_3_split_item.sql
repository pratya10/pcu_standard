-- Topic 2.3.3 had one checklist item bundling two distinct documents into a
-- single checkbox, so a committee couldn't confirm one without the other.
-- Split it into two: the original item id/text is repointed to just the
-- first document (preserving whatever check state/comments already exist,
-- since those are keyed by item id in team_scores/scores' item_notes), and
-- the second document becomes a new item right after it.
do $$
declare
  v_topic_id uuid;
begin
  select id into v_topic_id from public.topics where code = '2.3.3';

  update public.topic_score_items
    set item_text = 'System: เอกสารทะเบียนผู้ป่วยกลุ่มเสี่ยงสำคัญ'
    where id = 'b9473595-bcd2-471c-ab18-bcd236418233';

  update public.topic_score_items
    set sort_order = sort_order + 1
    where topic_id = v_topic_id and score_level = -2 and sort_order >= 5;

  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values
    (v_topic_id, -2, 'System: เอกสารการตรวจสอบประสิทธิภาพการทำให้ปราศจากเชื้อ', 5);
end $$;
