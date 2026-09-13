-- Topics 2.2.1, 2.2.2 and 2.2.3's content_text (a single descriptive
-- paragraph) become individually checkable items instead, so each one gets
-- its own check/comment/photo like the rest of the app's checklists. Reuses
-- score_level -2 (evidence), appended after each topic's existing
-- structural-readiness items via sort_order 100+.
do $$
declare
  v_topic_id uuid;
begin
  select id into v_topic_id from public.topics where code = '2.2.1';

  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values
    (v_topic_id, -2, '1) หญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - ANC', 100),
    (v_topic_id, -2, '1) หญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - WCC', 101),
    (v_topic_id, -2, '1) หญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - EPI', 102),
    (v_topic_id, -2, '1) หญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - ประเมินและกระตุ้นพัฒนาการ (สมุดสีชมพู/TEDA4I/DSPM)', 103),
    (v_topic_id, -2, '1) หญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - คัดกรองโภชนาการ/โลหิตจาง/สุขภาพจิต', 104),
    (v_topic_id, -2, '2) วัยเรียน (6-13 ปี) - คัดกรองสุขภาพนักเรียน โภชนาการ สายตา', 105),
    (v_topic_id, -2, '2) วัยเรียน (6-13 ปี) - ทันตสุขภาพในโรงเรียน', 106),
    (v_topic_id, -2, '2) วัยเรียน (6-13 ปี) - สุขภาพจิต สารเสพติด/บุหรี่/สุรา', 107),
    (v_topic_id, -2, '3) วัยรุ่น (14-24 ปี) - คลินิกวัยรุ่น', 108),
    (v_topic_id, -2, '3) วัยรุ่น (14-24 ปี) - อนามัยเจริญพันธุ์', 109),
    (v_topic_id, -2, '3) วัยรุ่น (14-24 ปี) - สุขภาพจิต สารเสพติด/บุหรี่/สุรา', 110),
    (v_topic_id, -2, '4) วัยทำงาน (25-59 ปี) - คัดกรอง CVD risk/เบาหวาน/ความดันโลหิตสูง', 111),
    (v_topic_id, -2, '4) วัยทำงาน (25-59 ปี) - คัดกรองมะเร็ง', 112),
    (v_topic_id, -2, '4) วัยทำงาน (25-59 ปี) - ปรับเปลี่ยนพฤติกรรม', 113),
    (v_topic_id, -2, '4) วัยทำงาน (25-59 ปี) - สุขภาพจิต สารเสพติด/บุหรี่/สุรา', 114),
    (v_topic_id, -2, '5) ผู้สูงอายุ (60 ปีขึ้นไป) - ประเมิน ADL', 115),
    (v_topic_id, -2, '5) ผู้สูงอายุ (60 ปีขึ้นไป) - คัดกรองสุขภาพผู้สูงอายุ 9 ด้าน', 116),
    (v_topic_id, -2, '5) ผู้สูงอายุ (60 ปีขึ้นไป) - ส่งเสริมสุขภาพจิต/สังคม', 117);

  update public.topics set content_text = null where id = v_topic_id;
end $$;

do $$
declare
  v_topic_id uuid;
begin
  select id into v_topic_id from public.topics where code = '2.2.2';

  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values
    (v_topic_id, -2, 'การคัดกรองและค้นหาผู้ป่วยรายใหม่ (DM, HT, CVD risk, CKD)', 100),
    (v_topic_id, -2, 'การดูแลรักษาและป้องกันภาวะแทรกซ้อน (จ่ายยาต่อเนื่อง เฝ้าระวัง ดูแลต่อเนื่องที่บ้าน)', 101),
    (v_topic_id, -2, 'การปรับเปลี่ยนพฤติกรรมและลดความเสี่ยง (บุหรี่/สุรา ด้วย ASSIST/CAGE/5A 5R, คลินิก DPAC)', 102);

  update public.topics set content_text = null where id = v_topic_id;
end $$;

do $$
declare
  v_topic_id uuid;
begin
  select id into v_topic_id from public.topics where code = '2.2.3';

  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values
    (v_topic_id, -2, 'หน่วยบริการมีทะเบียนรายชื่อกลุ่มเป้าหมาย', 100),
    (v_topic_id, -2, 'มีการวางแผนค้นหาและจัดบริการสำหรับกลุ่มเป้าหมาย', 101),
    (v_topic_id, -2, 'มีประเมินกระบวนการคัดกรองมะเร็งที่สำคัญ เช่น มะเร็งปากมดลูก (HPV DNA/Pap smear), มะเร็งเต้านม, มะเร็งลำไส้ใหญ่ (FIT test)', 102),
    (v_topic_id, -2, 'ประเมินความสามารถในการให้คำปรึกษา แนะนำ และกระบวนการติดตามผลการคัดกรองเพื่อแจ้งให้ผู้รับบริการทราบ', 103);

  update public.topics set content_text = null where id = v_topic_id;
end $$;
