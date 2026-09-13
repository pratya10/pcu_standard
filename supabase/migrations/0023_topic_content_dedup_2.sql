-- Remove two more content_text paragraphs the user flagged as redundant/unwanted.

-- Topic covering "ความสามารถในการนำปัญหาสุขภาพเฉพาะพื้นที่..." — remove entirely.
update public.topics set content_text = null where id = '37083507-988b-4da7-8710-fd72fdc4d121';

-- Topic 3.3 "การวัดผลลัพธ์ด้านสุขภาพและความพึงพอใจของผู้รับบริการ" — remove the
-- "Overall Goals ของ WHO" explanatory paragraph.
update public.topics
set content_text = null
where content_text = 'ประเมินผลสัมฤทธิ์ปลายทางของการจัดบริการ ว่าตอบสนองต่อเป้าหมายสูงสุดของระบบสุขภาพ (Overall Goals ของ WHO) ทั้ง 4 ด้านได้หรือไม่: 1) Improved health 2) Responsiveness 3) Social and financial risk protection 4) Improved efficiency';
