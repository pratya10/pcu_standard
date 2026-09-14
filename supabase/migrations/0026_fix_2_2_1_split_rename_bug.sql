-- Migration 0025's topic 2.2.1 split/rename step referenced the wrong
-- source ids for 11 of the 24 checklist items (ids that had just been
-- deleted as duplicates in the same migration, instead of the canonical
-- survivor ids that migration 0025's own dedup step had already
-- consolidated all evaluator answers onto). Those 11 renames silently
-- matched zero rows, so the app now shows both an incomplete 13-item
-- "new wording" set and a set of never-renamed pre-split duplicate rows.
--
-- Verified against live data before writing this: every one of the 18
-- leftover duplicate/orphan rows removed below has zero entries in every
-- team_scores.item_notes across all 3 rounds scoring this topic, and zero
-- attached topic_photos — so nothing here has ever been checked,
-- commented on, or photographed. The 11 renamed ids below are exactly
-- the canonical ids migration 0025 already merged every duplicate's
-- checked/comment data onto, so their existing answers are untouched.

update public.topic_score_items set sort_order = 100, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - งานฝากครรภ์คุณภาพ (ANC)' where id = '2482bfac-c12a-4cf1-9f7f-092dc1a67713';
update public.topic_score_items set sort_order = 101, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - คลินิกเด็กดี (WCC)' where id = '51d6f291-14c4-4ce3-9d12-b87744cd0127';
update public.topic_score_items set sort_order = 102, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - งานวัคซีน (EPI)' where id = '0862a6e8-ee79-4097-990e-eae7f5437671';
update public.topic_score_items set sort_order = 103, item_text = '1) กลุ่มหญิงตั้งครรภ์และเด็กปฐมวัย (0-5 ปี) - การประเมินและกระตุ้นพัฒนาการ (เช่น ใช้สมุดสีชมพู/TEDA4I/DSPM)' where id = '26925d01-e2e7-4c0d-afae-d5851fa1b15f';
update public.topic_score_items set sort_order = 106, item_text = '2) กลุ่มวัยเรียน (6-13 ปี) - การตรวจคัดกรองสุขภาพนักเรียน' where id = '34f6c1b0-14ff-4846-a191-3d59832e3748';
update public.topic_score_items set sort_order = 110, item_text = '2) กลุ่มวัยเรียน (6-13 ปี) - การให้คำปรึกษาด้านสุขภาพจิต' where id = '093d434f-85f7-42f4-a998-824d555ff4e7';
update public.topic_score_items set sort_order = 113, item_text = '3) กลุ่มวัยรุ่น (14-24 ปี) - อนามัยเจริญพันธุ์ (การคุมกำเนิด/ตั้งครรภ์ไม่พร้อม)' where id = '21b6a469-87b7-4ddc-bf32-35ed5f3951b7';
update public.topic_score_items set sort_order = 117, item_text = '4) กลุ่มวัยทำงาน (25-59 ปี) - การคัดกรองมะเร็ง (เช่น มะเร็งปากมดลูก)' where id = '1548289b-9336-4870-92b0-683d22b000a3';
update public.topic_score_items set sort_order = 119, item_text = '4) กลุ่มวัยทำงาน (25-59 ปี) - การให้คำปรึกษาด้านสุขภาพจิต' where id = '52ef554f-4357-4394-a800-5f2dde73e1f1';
update public.topic_score_items set sort_order = 122, item_text = '5) กลุ่มผู้สูงอายุ (60 ปีขึ้นไป) - คัดกรองสุขภาพผู้สูงอายุ 9 ด้าน (เช่น ภาวะสมองเสื่อม, ภาวะหกล้ม, โภชนาการ)' where id = '83c5c67f-16e3-468b-9a27-ddb6f50dafcd';
update public.topic_score_items set sort_order = 123, item_text = '5) กลุ่มผู้สูงอายุ (60 ปีขึ้นไป) - การส่งเสริมสุขภาพจิต/สังคม' where id = '0304769e-1911-456e-8e3b-1d3c4151e509';

delete from public.topic_score_items where id in (
  '1fe4d131-0408-4a77-8a83-b2436f394cd3',
  '1f366f73-edcf-49e1-9e04-2877c2e59304',
  '362015e5-12ce-4406-994f-5f6bcebf4a8d',
  '77d7d8a9-0817-4853-8c05-5c0f176d1913',
  '0b401d81-6be5-41bc-9ae6-55ee59ea50d0',
  'b23ed520-2d75-4610-9086-8615a6fccfcd',
  '4749df84-71e0-4054-87fe-371cd2eb809f',
  'd7d9f9e3-f025-4ae1-a736-62e235553459',
  'acfc1bd9-e960-4dae-9f29-b9738ef6b18c',
  'bbbcdc5c-8ce1-4198-92c3-5c536c9c3b83',
  'b8e365e7-dde2-44ae-a20f-0532cfb83523',
  'b3485346-e35e-462b-94be-6f982174ab87',
  '40d0a715-0f1b-47fa-82e7-f5162f8093f9',
  '66c68b6f-fc3f-42b7-86db-e3ec9b8f24d3',
  'a2fd06aa-b182-4b42-a87b-c75ac7883e1a',
  '6a71de62-4418-48b6-ac73-38acd7cb24ae',
  '0e620fb0-5f10-441c-82fa-f0a208e59726',
  '6b194254-bc6c-48b6-aae5-3f11c1e34869'
);
