-- Topic 2.3.3: the "Structure" checklist item bundled a manual and a work
-- plan document into one checkbox — split into two, plus a new item for a
-- third, previously-missing document (support from the parent facility).
-- Reads the target item's current sort_order dynamically so this doesn't
-- assume a fixed position regardless of what earlier migrations shifted it to.
do $$
declare
  v_topic_id uuid;
  v_base_sort int;
begin
  select id into v_topic_id from public.topics where code = '2.3.3';
  select sort_order into v_base_sort from public.topic_score_items where id = 'ffa70a68-68b0-4eb3-bfcf-bc8aa2bb3876';

  update public.topic_score_items
    set sort_order = sort_order + 2
    where topic_id = v_topic_id and score_level = -2 and sort_order > v_base_sort;

  update public.topic_score_items
    set item_text = 'Structure: คู่มือการป้องกันและควบคุมการติดเชื้ออายุไม่เกิน 3 ปี'
    where id = 'ffa70a68-68b0-4eb3-bfcf-bc8aa2bb3876';

  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values
    (v_topic_id, -2, 'เอกสารแผนงานด้านการป้องกันและควบคุมการติดเชื้อ', v_base_sort + 1),
    (
      v_topic_id,
      -2,
      'เอกสารการได้รับสนับสนุนด้านโครงสร้างและอุปกรณ์ที่จำเป็นด้านการป้องกันและควบคุมการติดเชื้อจากแม่ข่ายหรือหน่วยบังคับบัญชา ตามข้อเสนอแนะจากการนิเทศ IC rounds ของแม่ข่ายและแผนจัดซื้อประจำปี',
      v_base_sort + 2
    );
end $$;
