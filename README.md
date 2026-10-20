# ระบบประเมินมาตรฐาน PCU

เว็บแอปสำหรับให้คณะกรรมการร่วมกันประเมินหน่วยบริการปฐมภูมิ (รพ.สต./ศสม.) ตาม **มาตรฐานหน่วยบริการปฐมภูมิ ฉบับก้าวหน้า ปี 2571–2573** ผ่านมือถือ เห็นคะแนนสรุปแบบ real-time ระหว่างการประเมิน และ export รายงานเมื่อประเมินเสร็จ

- Frontend: React + Vite + TypeScript + Tailwind (SPA, มือถือก่อน) → deploy บน Cloudflare Workers ที่ path `mshprimary.com/pcustandard71`
- Backend: Supabase (Postgres + Auth + Realtime)

## 1) Supabase production configuration

Production uses project `hysaddgpbriartpgselc` with schema `pcu_standard`, shared with msh-organize. All PCU database clients, seed scripts, and Realtime subscriptions target this schema. Storage uses `pcu-standard-branding` and `pcu-standard-topic-evidence`.

Do not run the historical SQL files in `supabase/migrations` against the shared project unchanged: those files target the former project's `public` schema. Scope future SQL explicitly to `pcu_standard` and the two PCU buckets.

Copy `.env.example` to `.env` and set:

- `VITE_SUPABASE_URL=https://hysaddgpbriartpgselc.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: the project's public anon key (never a service-role key)
- `VITE_GOOGLE_CLIENT_ID=1031385252659-rk45j7lb4db4eo52f2a4vm04m9bj0u7h.apps.googleusercontent.com`

Google login uses Google Identity Services and `signInWithIdToken()`. The Supabase Google provider accepts the client ID above. Google Cloud includes the origin `https://mshprimary.com` and callback `https://hysaddgpbriartpgselc.supabase.co/auth/v1/callback`; existing origins and callbacks are retained.

Migration verification on 2026-10-13:

- Exposed `pcu_standard`; added schema/table/sequence privileges governed by existing RLS. All 16 tables have RLS enabled. The summary view uses `security_invoker`.
- Copied the logo and five evidence files; downloaded target bytes match the source bytes.
- Verified 14 non-admin tables against source data; corrected one comment's character ordering to preserve the original. Mapped round creators and both admin profiles to existing target Auth users by matching email; restored both admin allowlist entries. No shared Auth records were changed.
- Confirmed Realtime publication contains PCU assessment rounds, participants, scores, team scores and score audit tables; client subscriptions now use the custom schema.
- Public report for 14 September 2569 displays 39 points (75%), comments and evidence images.
- TypeScript and production build pass. Cloudflare version: `49b52cb2-e18b-4170-aa7e-d94b8544063f`.
- Interactive Google login still needs user confirmation; database-level authenticated-role checks pass, but do not substitute for a completed browser login.

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

## คู่มือสำหรับเจ้าหน้าที่

กด **วิธีใช้งาน** จากหน้าแรก หน้าเข้าร่วม เมนูหน้าประเมิน หรือเมนูผู้ดูแล เพื่อเปิดหน้า HTML ที่ `/pcustandard71/guide` อ่านได้โดยไม่ต้องเข้าสู่ระบบ มีภาพหน้าจอจริงพร้อมวงกลมเลขสีแดง ขั้นตอนภาษาไทย การแก้ปัญหาเบื้องต้น และปุ่มพิมพ์/บันทึก PDF บนมือถือกดภาพเพื่อเปิดขนาดเต็มได้

การปรับคู่มือและจับภาพใหม่ดู `public/guide/README.md` ใช้ข้อมูลตัวอย่างและไม่เขียนข้อมูลลงฐานข้อมูลจริง

หน้า `/history` แสดงตารางรอบสาธารณะที่เสร็จสิ้น ค้นหาชื่อหน่วยบริการและเลือกวันที่ประเมินร่วมกันได้ (ส่วนค้นหาซ่อนไว้ก่อน กดปุ่ม "ค้นหาชื่อ / วันที่" เพื่อเปิด · เปิดเองเมื่อ URL มีตัวกรองอยู่แล้ว) แบ่งหน้า 10 รายการจากฐานข้อมูล บนมือถือวันที่อยู่ใต้ชื่อหน่วยบริการและมีปุ่มดูรายงานแยกแต่ละรอบ ตัวกรองเก็บใน URL เพื่อกลับมาใช้ต่อได้

ตรวจ flow ด้วยข้อมูลจำลองได้โดยรัน dev server แล้ว `node scripts/check-public-history.mjs` (ต้องมี Playwright; รองรับ `PLAYWRIGHT_MODULE`, `CHROME_PATH` และ `PCU_TEST_ORIGIN` เช่นเดียวกับสคริปต์จับภาพคู่มือ) สคริปต์ดักคำขอ assessment_rounds ด้วย fixture และทดสอบค้นหา/วันที่/แบ่งหน้า/กรณีผิดพลาดโดยไม่เขียนข้อมูลจริง
