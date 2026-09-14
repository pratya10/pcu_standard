-- Migration 0018 (topics 2.2.1, 2.2.2, 2.2.3 age-group / risk-group
-- checklists) was accidentally run 3 times against production, since its
-- plain inserts have no guard against re-running — every checklist item
-- in that migration exists as 3 identical duplicate rows. Evaluators had
-- already answered ใช่/ไม่ใช่ on all 3 duplicate copies of many items
-- (not realizing they were duplicates, all 3 copies always agreed), so
-- this consolidates each trio's data onto one surviving id per item —
-- using targeted jsonb key removal/merge (not a full item_notes replace)
-- so it can't clobber any other item a committee member is answering
-- concurrently — before the redundant rows are deleted.

-- 2.2.1 round-scoped team_scores row 4f57cf13-469d-49e2-9c71-5d4163897fa2: consolidate 54 duplicate keys into 18
update public.team_scores set item_notes = (item_notes - '2482bfac-c12a-4cf1-9f7f-092dc1a67713' - '6a20d52d-bb2c-4e8f-8515-ce493b0a3301' - '9b0533c0-924f-43cb-a4f5-8796b320ccc9' - '51d6f291-14c4-4ce3-9d12-b87744cd0127' - '6f737f9d-5877-4950-9b42-8b5906e04c7a' - '98132c1d-233d-4da4-a046-516ead949416' - '0862a6e8-ee79-4097-990e-eae7f5437671' - 'c7cd133d-a48e-42e6-84ad-fe7afd0024fa' - 'eed6aee1-d2a6-4e59-afba-0ab796fed2e3' - '26925d01-e2e7-4c0d-afae-d5851fa1b15f' - '2db6ceee-9d08-494e-826a-a2cb76cd46cf' - 'b0f35e2d-d026-4819-bbb4-c422cb4cf399' - '508e8cbe-ac64-4c4d-a042-35478d266956' - '519fa667-26bd-4ddd-b42e-b3990a3c8ee7' - '833a3266-47eb-4ed6-97f7-c70a6d8342b0' - '34f6c1b0-14ff-4846-a191-3d59832e3748' - 'b8bf3e42-28da-45a7-9c27-ecc78e5c650d' - 'd63e4306-e434-42eb-81fd-a7c430543a10' - '09c2f86d-d6aa-451a-8af0-0254ffd41134' - '3ff43da0-5661-44ac-9e38-68edc81a2714' - '9d412f41-844d-42ed-a517-4c65cf810fa0' - '093d434f-85f7-42f4-a998-824d555ff4e7' - 'b3770dee-31f4-4da0-9182-c54e0650c13d' - 'b9b6f75a-5706-4f7d-9a79-a4b2e948dcc6' - '4fdb73d2-ffb2-44bd-9230-8a7f9aab1096' - '781e144f-ff05-4ac4-9e56-68d60f6ac74d' - '87972ea6-ed7e-41df-95c7-91a62cdaf59b' - '21b6a469-87b7-4ddc-bf32-35ed5f3951b7' - '682a9fdf-9fc9-4dcb-8f2b-aba6e740161d' - 'b5bcfaf2-1f65-48b1-b952-9e5c96c80820' - '5bae20f6-4f50-4af2-8d77-e199b5dcbe18' - '849ab87d-d960-4d95-a508-0e9377c61cd0' - 'da02a142-2a66-411f-8ade-c361baa8d358' - '3c16e4c9-a74a-4f69-bd8c-fa7811e218fe' - '428370d1-7b6d-46fe-bd9d-ba9be9e4d7e6' - 'e284c12d-ad0a-47fb-9236-d98e969461ba' - '1548289b-9336-4870-92b0-683d22b000a3' - 'ade54d0a-6d66-4f48-99c3-c91fc9b43d5f' - 'db32e258-4ad5-477d-848d-77adaafc35ee' - '414dfa98-70ef-445c-a623-5c5b305fbe45' - '4ea7656f-85dc-409c-8c5b-2eaf8d80d907' - 'e0ecce48-c2db-49a0-87ed-f9bbd005e813' - '52ef554f-4357-4394-a800-5f2dde73e1f1' - 'adda8b58-3527-4e04-8a8c-d85d0ec729c8' - 'c74d03fb-0d20-49f9-ad40-15995f17159d' - '27228438-ed18-4e09-9702-4b163b5ada1b' - 'b2677247-887f-46ab-85b4-e0e050c38ae0' - 'bccdec5b-a7d9-481f-83bf-46350c20fcc4' - '83c5c67f-16e3-468b-9a27-ddb6f50dafcd' - 'a42b52ef-51f9-4e09-8113-cfbc63916206' - 'd4246389-97b2-4ef5-bc5a-41c8cd8fcdd2' - '0304769e-1911-456e-8e3b-1d3c4151e509' - 'aeb44784-9ecc-41e9-ad07-ff26e7d3c88c' - 'b51a3ea7-abde-4f0a-a131-cb557d7b92fd') || jsonb_build_object('2482bfac-c12a-4cf1-9f7f-092dc1a67713', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:00.801Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '51d6f291-14c4-4ce3-9d12-b87744cd0127', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:17.309Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '0862a6e8-ee79-4097-990e-eae7f5437671', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:21.793Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '26925d01-e2e7-4c0d-afae-d5851fa1b15f', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:30.125Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '508e8cbe-ac64-4c4d-a042-35478d266956', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:39.137Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '34f6c1b0-14ff-4846-a191-3d59832e3748', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:44.617Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '09c2f86d-d6aa-451a-8af0-0254ffd41134', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:00:49.332Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '093d434f-85f7-42f4-a998-824d555ff4e7', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:08.064Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '4fdb73d2-ffb2-44bd-9230-8a7f9aab1096', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:12.677Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '21b6a469-87b7-4ddc-bf32-35ed5f3951b7', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:17.359Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '5bae20f6-4f50-4af2-8d77-e199b5dcbe18', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:20.688Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '3c16e4c9-a74a-4f69-bd8c-fa7811e218fe', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:28.322Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '1548289b-9336-4870-92b0-683d22b000a3', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:32.970Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '414dfa98-70ef-445c-a623-5c5b305fbe45', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:36.353Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '52ef554f-4357-4394-a800-5f2dde73e1f1', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:42.517Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '27228438-ed18-4e09-9702-4b163b5ada1b', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:46.483Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '83c5c67f-16e3-468b-9a27-ddb6f50dafcd', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:48.899Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '0304769e-1911-456e-8e3b-1d3c4151e509', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:01:51.063Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb) where id = '4f57cf13-469d-49e2-9c71-5d4163897fa2';

-- 2.2.2 round-scoped team_scores row 284fef47-1643-47a7-84b8-a7fa13d9c200: consolidate 9 duplicate keys into 3
update public.team_scores set item_notes = (item_notes - '7dd74525-27a1-4a9b-9573-b3efb619872c' - '834e7bbd-80e0-4186-9546-2ab8e25f7b90' - 'c7b54dc4-f027-45d8-8418-cfd5228d61f2' - '31d9fc45-1b74-4c05-94d1-31587ecade51' - '49e90388-9941-4d67-bb4c-11ffb864df67' - '7902bc7e-682d-41e2-b0f7-06957570d914' - '847e5dd7-419b-40ed-9e12-5be4fe246180' - 'cd718807-c461-4c42-9709-e3d7fbd82349' - 'eed81b64-2f52-43d3-8168-891976e4ca0c') || jsonb_build_object('7dd74525-27a1-4a9b-9573-b3efb619872c', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T07:03:00.217Z", "checkedBy": "42f9ed3a-2fa1-481c-8d0e-4de24bc1cec2"}'::jsonb, '31d9fc45-1b74-4c05-94d1-31587ecade51', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:05:50.848Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '847e5dd7-419b-40ed-9e12-5be4fe246180', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:05:56.214Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb) where id = '284fef47-1643-47a7-84b8-a7fa13d9c200';

-- 2.2.3 round-scoped team_scores row 18f09529-9f6a-4f79-bd24-a594801c47d4: consolidate 12 duplicate keys into 4
update public.team_scores set item_notes = (item_notes - '3ecb3fb2-7f86-4e1e-bd2b-1e3738f66fae' - '8602e6c3-e33c-43eb-8984-fa07b7e900c1' - 'bc20820e-c9b8-4f6a-8c85-43f208973783' - 'cd19d6cd-35bd-428d-81ce-ebf714058283' - 'd026451f-27fc-49f3-90ed-75a8528014a5' - 'fdfb0e2e-c4d9-4a66-917d-a647fbcb9231' - '31f72c6c-ad44-4ac2-9a8d-b083fd12f964' - '8bc821c9-54d0-4c95-a135-f6d2b8e5c90c' - 'efdb2a3a-dccc-4125-8903-0e589cf97356' - '0aeb8133-b0f3-4e32-850c-355745f25a2f' - '6d9a9dc3-aa41-444a-8572-8aa0deaa80eb' - 'aa8a45d5-2b01-42c1-8c4a-8778d016f049') || jsonb_build_object('3ecb3fb2-7f86-4e1e-bd2b-1e3738f66fae', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:31:22.929Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, 'cd19d6cd-35bd-428d-81ce-ebf714058283', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:31:32.408Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '31f72c6c-ad44-4ac2-9a8d-b083fd12f964', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:31:38.940Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb, '0aeb8133-b0f3-4e32-850c-355745f25a2f', '{"checked": true, "comments": [], "checkedAt": "2026-09-14T08:49:18.534Z", "checkedBy": "09369270-3607-42fd-8a54-9eb96cde3bd9"}'::jsonb) where id = '18f09529-9f6a-4f79-bd24-a594801c47d4';

-- Remove the 50 now-redundant duplicate rows (each surviving
-- id already carries every round's consolidated data from above).
delete from public.topic_score_items where id in (
  '6a20d52d-bb2c-4e8f-8515-ce493b0a3301',
  '9b0533c0-924f-43cb-a4f5-8796b320ccc9',
  '6f737f9d-5877-4950-9b42-8b5906e04c7a',
  '98132c1d-233d-4da4-a046-516ead949416',
  'c7cd133d-a48e-42e6-84ad-fe7afd0024fa',
  'eed6aee1-d2a6-4e59-afba-0ab796fed2e3',
  '2db6ceee-9d08-494e-826a-a2cb76cd46cf',
  'b0f35e2d-d026-4819-bbb4-c422cb4cf399',
  '519fa667-26bd-4ddd-b42e-b3990a3c8ee7',
  '833a3266-47eb-4ed6-97f7-c70a6d8342b0',
  'b8bf3e42-28da-45a7-9c27-ecc78e5c650d',
  'd63e4306-e434-42eb-81fd-a7c430543a10',
  '3ff43da0-5661-44ac-9e38-68edc81a2714',
  '9d412f41-844d-42ed-a517-4c65cf810fa0',
  'b3770dee-31f4-4da0-9182-c54e0650c13d',
  'b9b6f75a-5706-4f7d-9a79-a4b2e948dcc6',
  '781e144f-ff05-4ac4-9e56-68d60f6ac74d',
  '87972ea6-ed7e-41df-95c7-91a62cdaf59b',
  '682a9fdf-9fc9-4dcb-8f2b-aba6e740161d',
  'b5bcfaf2-1f65-48b1-b952-9e5c96c80820',
  '849ab87d-d960-4d95-a508-0e9377c61cd0',
  'da02a142-2a66-411f-8ade-c361baa8d358',
  '428370d1-7b6d-46fe-bd9d-ba9be9e4d7e6',
  'e284c12d-ad0a-47fb-9236-d98e969461ba',
  'ade54d0a-6d66-4f48-99c3-c91fc9b43d5f',
  'db32e258-4ad5-477d-848d-77adaafc35ee',
  '4ea7656f-85dc-409c-8c5b-2eaf8d80d907',
  'e0ecce48-c2db-49a0-87ed-f9bbd005e813',
  'adda8b58-3527-4e04-8a8c-d85d0ec729c8',
  'c74d03fb-0d20-49f9-ad40-15995f17159d',
  'b2677247-887f-46ab-85b4-e0e050c38ae0',
  'bccdec5b-a7d9-481f-83bf-46350c20fcc4',
  'a42b52ef-51f9-4e09-8113-cfbc63916206',
  'd4246389-97b2-4ef5-bc5a-41c8cd8fcdd2',
  'aeb44784-9ecc-41e9-ad07-ff26e7d3c88c',
  'b51a3ea7-abde-4f0a-a131-cb557d7b92fd',
  '834e7bbd-80e0-4186-9546-2ab8e25f7b90',
  'c7b54dc4-f027-45d8-8418-cfd5228d61f2',
  '49e90388-9941-4d67-bb4c-11ffb864df67',
  '7902bc7e-682d-41e2-b0f7-06957570d914',
  'cd718807-c461-4c42-9709-e3d7fbd82349',
  'eed81b64-2f52-43d3-8168-891976e4ca0c',
  '8602e6c3-e33c-43eb-8984-fa07b7e900c1',
  'bc20820e-c9b8-4f6a-8c85-43f208973783',
  'd026451f-27fc-49f3-90ed-75a8528014a5',
  'fdfb0e2e-c4d9-4a66-917d-a647fbcb9231',
  '8bc821c9-54d0-4c95-a135-f6d2b8e5c90c',
  'efdb2a3a-dccc-4125-8903-0e589cf97356',
  '6d9a9dc3-aa41-444a-8572-8aa0deaa80eb',
  'aa8a45d5-2b01-42c1-8c4a-8778d016f049'
);
-- Also refine topic 2.2.1's checklist wording/breakdown now that the
-- duplicates above are gone: split each age-group's combined "สุขภาพจิต"
-- item out on its own (6/6/4/5/3 items instead of 5/3/3/4/3), and update
-- the wording throughout to the fuller phrasing requested.

do $$
declare
  v_topic_id uuid := '3045681c-84dd-4612-88db-05262ab1799b';
begin
  -- Move every existing item out of the way first so the final
  -- renumbering (100-123) below can't collide with itself.
  update public.topic_score_items set sort_order = sort_order + 1000
    where topic_id = v_topic_id and score_level = -2 and sort_order >= 100;

  update public.topic_score_items set sort_order = 100, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - งานฝากครรภ์คุณภาพ (ANC)' where id = '6a20d52d-bb2c-4e8f-8515-ce493b0a3301';
  update public.topic_score_items set sort_order = 101, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - คลินิกเด็กดี (WCC)' where id = '98132c1d-233d-4da4-a046-516ead949416';
  update public.topic_score_items set sort_order = 102, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - งานวัคซีน (EPI)' where id = 'c7cd133d-a48e-42e6-84ad-fe7afd0024fa';
  update public.topic_score_items set sort_order = 103, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - การประเมินและกระตุ้นพัฒนาการ (เช่น ใช้สมุดสีชมพู/TEDA4I/DSPM)' where id = 'b0f35e2d-d026-4819-bbb4-c422cb4cf399';
  update public.topic_score_items set sort_order = 104, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - และการคัดกรองภาวะโภชนาการ/โลหิตจาง' where id = '508e8cbe-ac64-4c4d-a042-35478d266956';
  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values (v_topic_id, -2, '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - สุขภาพจิต', 105);
  update public.topic_score_items set sort_order = 106, item_text = '2) กลุ่มวัยเรียน (6-13 ปี) - การตรวจคัดกรองสุขภาพนักเรียน' where id = 'd63e4306-e434-42eb-81fd-a7c430543a10';
  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values (v_topic_id, -2, '2) กลุ่มวัยเรียน (6-13 ปี) - ภาวะโภชนาการ', 107);
  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values (v_topic_id, -2, '2) กลุ่มวัยเรียน (6-13 ปี) - การตรวจวัดสายตา', 108);
  update public.topic_score_items set sort_order = 109, item_text = '2) กลุ่มวัยเรียน (6-13 ปี) - ทันตสุขภาพในโรงเรียน' where id = '09c2f86d-d6aa-451a-8af0-0254ffd41134';
  update public.topic_score_items set sort_order = 110, item_text = '2) กลุ่มวัยเรียน (6-13 ปี) - การให้คำปรึกษาด้านสุขภาพจิต' where id = 'b9b6f75a-5706-4f7d-9a79-a4b2e948dcc6';
  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values (v_topic_id, -2, '2) กลุ่มวัยเรียน (6-13 ปี) - การคัดกรองสารเสพติด/บุหรี่/สุรา', 111);
  update public.topic_score_items set sort_order = 112, item_text = '3) กลุ่มวัยรุ่น (14-24 ปี) - บริการคลินิกวัยรุ่น' where id = '4fdb73d2-ffb2-44bd-9230-8a7f9aab1096';
  update public.topic_score_items set sort_order = 113, item_text = '3) กลุ่มวัยรุ่น (14-24 ปี) - อนามัยเจริญพันธุ์ (การคุมกำเนิด/ตั้งครรภ์ไม่พร้อม)' where id = '682a9fdf-9fc9-4dcb-8f2b-aba6e740161d';
  update public.topic_score_items set sort_order = 114, item_text = '3) กลุ่มวัยรุ่น (14-24 ปี) - การให้คำปรึกษาด้านสุขภาพจิต' where id = '5bae20f6-4f50-4af2-8d77-e199b5dcbe18';
  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values (v_topic_id, -2, '3) กลุ่มวัยรุ่น (14-24 ปี) - การคัดกรองสารเสพติด/บุหรี่/สุรา', 115);
  update public.topic_score_items set sort_order = 116, item_text = '4) กลุ่มวัยทำงาน (25-59 ปี) - การคัดกรองความเสี่ยงโรคไม่ติดต่อเรื้อรัง (CVD risk / เบาหวาน / ความดันโลหิตสูง)' where id = '3c16e4c9-a74a-4f69-bd8c-fa7811e218fe';
  update public.topic_score_items set sort_order = 117, item_text = '4) กลุ่มวัยทำงาน (25-59 ปี) - การคัดกรองมะเร็ง (เช่น มะเร็งปากมดลูก)' where id = 'db32e258-4ad5-477d-848d-77adaafc35ee';
  update public.topic_score_items set sort_order = 118, item_text = '4) กลุ่มวัยทำงาน (25-59 ปี) - และการปรับเปลี่ยนพฤติกรรม' where id = '414dfa98-70ef-445c-a623-5c5b305fbe45';
  update public.topic_score_items set sort_order = 119, item_text = '4) กลุ่มวัยทำงาน (25-59 ปี) - การให้คำปรึกษาด้านสุขภาพจิต' where id = 'c74d03fb-0d20-49f9-ad40-15995f17159d';
  insert into public.topic_score_items (topic_id, score_level, item_text, sort_order) values (v_topic_id, -2, '4) กลุ่มวัยทำงาน (25-59 ปี) - การคัดกรองสารเสพติด/บุหรี่/สุรา', 120);
  update public.topic_score_items set sort_order = 121, item_text = '5) กลุ่มผู้สูงอายุ (60 ปีขึ้นไป) - การประเมินสมรรถนะการใช้ชีวิตประจำวัน (ADL)' where id = '27228438-ed18-4e09-9702-4b163b5ada1b';
  update public.topic_score_items set sort_order = 122, item_text = '5) กลุ่มผู้สูงอายุ (60 ปีขึ้นไป) - คัดกรองสุขภาพผู้สูงอายุ 9 ด้าน (เช่น ภาวะสมองเสื่อม, ภาวะหกล้ม, โภชนาการ)' where id = 'a42b52ef-51f9-4e09-8113-cfbc63916206';
  update public.topic_score_items set sort_order = 123, item_text = '5) กลุ่มผู้สูงอายุ (60 ปีขึ้นไป) - การส่งเสริมสุขภาพจิต/สังคม' where id = 'b51a3ea7-abde-4f0a-a131-cb557d7b92fd';
end $$;