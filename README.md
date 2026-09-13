# ระบบประเมินมาตรฐาน PCU

เว็บแอปสำหรับให้คณะกรรมการร่วมกันประเมินหน่วยบริการปฐมภูมิ (รพ.สต./ศสม.) ตาม **มาตรฐานหน่วยบริการปฐมภูมิ ฉบับก้าวหน้า ปี 2571–2573** ผ่านมือถือ เห็นคะแนนสรุปแบบ real-time ระหว่างการประเมิน และ export รายงานเมื่อประเมินเสร็จ

- Frontend: React + Vite + TypeScript + Tailwind (SPA, มือถือก่อน) → deploy บน Cloudflare Pages
- Backend: Supabase (Postgres + Auth + Realtime)

## 1) ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com) (แผนฟรีเพียงพอสำหรับเริ่มต้น)
2. ไปที่ **SQL Editor** แล้วรันไฟล์ `supabase/migrations/0001_init.sql` ทั้งไฟล์ เพื่อสร้างตารางและ RLS policy
3. คัดลอกไฟล์ `.env.example` เป็น `.env` แล้วกรอกค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` (ดูได้จาก Project Settings → API)
4. รัน seed script เพื่อโหลดเนื้อหามาตรฐาน (29 หัวข้อ) เข้าตาราง `categories` / `topics`:

   ```bash
   SUPABASE_URL=https://xxxx.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=xxxxx \
   npm run seed
   ```

   (ใช้ **service_role key** จาก Project Settings → API — ห้ามใส่ค่านี้ใน `.env` ของฝั่ง frontend)

5. สร้างบัญชีผู้ดูแล (สสอ./สสจ.) ที่ Authentication → Users → Add user (กำหนดอีเมล/รหัสผ่านเอง)

## 2) รันในเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:5173`

- `/admin/login` — ผู้ดูแลเข้าสู่ระบบ, เพิ่มหน่วยบริการ, สร้างรอบการประเมิน (จะได้ **รหัสเข้าร่วม 6 หลัก** + QR code)
- `/join` — กรรมการ/ผู้สังเกตการณ์กรอกรหัสเข้าร่วม + ชื่อ เพื่อเริ่มให้คะแนนจากมือถือ
- `/round/:id/live` — จอสรุปคะแนนแบบ real-time (เปิดฉายระหว่างประชุมกรรมการได้)
- `/round/:id/report` — รายงานสรุปผล พร้อมปุ่ม Export CSV และพิมพ์เป็น PDF

## 3) Deploy ขึ้น Cloudflare Pages

วิธีที่แนะนำ (auto-deploy ทุกครั้งที่ push ขึ้น GitHub):

1. Push โค้ดขึ้น `git@github.com:pratya10/pcu_standard.git`
2. ใน Cloudflare Dashboard → Workers & Pages → **Create → Pages → Connect to Git** เลือก repo นี้
3. ตั้งค่า Build:
   - Build command: `npm run build`
   - Build output directory: `dist`
4. เพิ่ม Environment variables (Production & Preview): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
5. Deploy — ไฟล์ `public/_redirects` ทำให้ client-side routing (React Router) ทำงานถูกต้องบน Cloudflare Pages

หรือ deploy จากเครื่องโดยตรงด้วย Wrangler CLI:

```bash
npm run deploy
```

## โครงสร้างคะแนน

- 3 หมวด: (1) การนำองค์กรและการอภิบาลระบบ, (2) ระบบบริการและระบบสนับสนุนบริการ, (3) ผลลัพธ์ต่อประชาชนและการพัฒนาที่ยั่งยืน
- แต่ละหัวข้อประเมิน 2 ส่วน: **The Must** (ผ่าน/ไม่ผ่าน) และ **Continuous Improvement** (0/1/2 คะแนน, บางหัวข้อมี N/A)
- กรรมการหลายคนให้คะแนนหัวข้อเดียวกันได้พร้อมกัน ระบบคำนวณ **คะแนนเฉลี่ย** และ **มติผ่าน The Must แบบเสียงข้างมาก** โดยอัตโนมัติแบบ real-time (ผ่าน Supabase Realtime)
- เนื้อหาเกณฑ์ทั้งหมดอยู่ใน `supabase/seed/standard-2571-2573.json` แก้ไข/เพิ่มหัวข้อได้โดยตรงแล้วรัน `npm run seed` ซ้ำ (เป็น upsert ตาม `code` จึงปลอดภัย)
