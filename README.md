# ระบบประเมินมาตรฐาน PCU

เว็บแอปสำหรับให้คณะกรรมการร่วมกันประเมินหน่วยบริการปฐมภูมิ (รพ.สต./ศสม.) ตาม **มาตรฐานหน่วยบริการปฐมภูมิ ฉบับก้าวหน้า ปี 2571–2573** ผ่านมือถือ เห็นคะแนนสรุปแบบ real-time ระหว่างการประเมิน และ export รายงานเมื่อประเมินเสร็จ

- Frontend: React + Vite + TypeScript + Tailwind (SPA, มือถือก่อน) → deploy บน Cloudflare Workers ที่ path `mshprimary.com/pcustandard71`
- Backend: Supabase (Postgres + Auth + Realtime)

## 1) ตั้งค่า Supabase

1. สร้างโปรเจกต์ใหม่ที่ [supabase.com](https://supabase.com) (แผนฟรีเพียงพอสำหรับเริ่มต้น)
2. ไปที่ **SQL Editor** แล้วรันไฟล์ `supabase/migrations/0001_init.sql` ทั้งไฟล์ เพื่อสร้างตารางและ RLS policy
3. คัดลอกไฟล์ `.env.example` เป็น `.env` แล้วกรอกค่า `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` (ดูได้จาก Project Settings → API)
4. รัน seed script เพื่อโหลดเนื้อหามาตรฐาน (26 หัวข้อ) เข้าตาราง `categories` / `topics`:

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

## 3) Deploy ขึ้น Cloudflare (Workers, path-based)

แอปนี้ deploy เป็น **Cloudflare Worker (static assets)** แทน Pages เพราะต้องขึ้นที่ path ย่อยของโดเมนที่มีอยู่แล้ว (`mshprimary.com/pcustandard71`) ซึ่ง Pages custom domain ทำแบบ path ไม่ได้ — ต้องใช้ Workers Route แทน

การตั้งค่าทำไว้ให้แล้วใน:

- `vite.config.ts` — `base: '/pcustandard71/'` และ build ออกไปที่ `dist/pcustandard71/`
- `src/App.tsx` — `<BrowserRouter basename="/pcustandard71">`
- `wrangler.jsonc` — ประกาศ route `mshprimary.com/pcustandard71*` และ `not_found_handling: "single-page-application"` สำหรับ client-side routing
- `package.json` → `npm run build` จะคัดลอก `index.html` ไว้ที่ root ของ `dist/` เพิ่มอีกชุด (จำเป็นสำหรับ SPA fallback ของ Cloudflare)

ขั้นตอน deploy:

```bash
npx wrangler login   # ครั้งแรกครั้งเดียว เปิดเบราว์เซอร์ให้ authorize บัญชี Cloudflare
npm run deploy       # build + wrangler deploy
```

เนื่องจากเป็นการ build แล้ว deploy จากเครื่อง (ไม่ใช่ CI ของ Cloudflare) ค่าใน `.env` ตอนรัน `npm run deploy` จะถูกฝังเข้าไปในไฟล์ JS ที่ deploy โดยตรง — ไม่ต้องตั้งค่า Environment variables แยกในหน้า Cloudflare Dashboard

หากต้องการเปลี่ยน path หรือโดเมน แก้ที่ `vite.config.ts` (`base`), `src/App.tsx` (`basename`) และ `wrangler.jsonc` (`routes[0].pattern`, `zone_name`) ให้ตรงกันทั้ง 3 จุด แล้ว deploy ใหม่

## โครงสร้างคะแนน

- 3 หมวด: (1) การนำองค์กรและการอภิบาลระบบ, (2) ระบบบริการและระบบสนับสนุนบริการ, (3) ผลลัพธ์ต่อประชาชนและการพัฒนาที่ยั่งยืน
- แต่ละหัวข้อประเมิน 2 ส่วน: **The Must** (ผ่าน/ไม่ผ่าน) และ **Continuous Improvement** (0/1/2 คะแนน, บางหัวข้อมี N/A)
- กรรมการหลายคนให้คะแนนหัวข้อเดียวกันได้พร้อมกัน ระบบคำนวณ **คะแนนเฉลี่ย** และ **มติผ่าน The Must แบบเสียงข้างมาก** โดยอัตโนมัติแบบ real-time (ผ่าน Supabase Realtime)
- เนื้อหาเกณฑ์ทั้งหมดอยู่ใน `supabase/seed/standard-2571-2573.json` แก้ไข/เพิ่มหัวข้อได้โดยตรงแล้วรัน `npm run seed` ซ้ำ (เป็น upsert ตาม `code` จึงปลอดภัย)
