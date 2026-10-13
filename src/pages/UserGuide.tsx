import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'

const lessons = [
  { id: 'join', title: '1. เข้าร่วมประเมิน', image: 'join', steps: ['ขอรหัสเข้าร่วมจากผู้ดูแล แล้วกรอกในช่อง “รหัสเข้าร่วม”', 'กรอกชื่อ-สกุล ระดับข้าราชการ / ตำแหน่ง และหน่วยงานที่สังกัด หากมีรายชื่อแนะนำ ให้เลือกชื่อของตนเองและตรวจข้อมูล', 'เลือก “กรรมการประเมิน” เพื่อให้คะแนน หรือ “ผู้สังเกตการณ์” เพื่อดูผลอย่างเดียว', 'กด “เข้าร่วม” เพื่อเข้าสู่รอบประเมิน'], note: 'เริ่มจากปุ่ม “เข้าร่วมประเมิน” ที่หน้าแรก หรือสแกน QR ที่ผู้ดูแลส่งให้ ผู้สังเกตการณ์ไม่ต้องกรอกตำแหน่งและหน่วยงาน' },
  { id: 'score', title: '2. เปิดหัวข้อที่ต้องการประเมิน', image: 'score', steps: ['เลือกหมวดจากเมนูด้านซ้าย บนมือถือให้กด “☰ หมวดหมู่” ก่อน', 'กดชื่อหัวข้อเพื่อเปิดรายละเอียด อ่านเกณฑ์และตรวจหลักฐานก่อนให้คะแนน', 'ดูจำนวนหัวข้อที่ให้คะแนนแล้วด้านบน แล้วทำหัวข้อที่เหลือให้ครบ'], note: 'รอบแบบ “ค่าเฉลี่ยกรรมการทุกคน” ให้คะแนนแยกคน ส่วนรอบแบบ “ทีมคณะกรรมช่วยกัน” ใช้คะแนนชุดเดียวร่วมกัน หากมีคำถามยืนยันก่อนทับคะแนน ให้อ่านก่อนเลือก' },
  { id: 'rating', title: '3. ให้คะแนนและบันทึกเหตุผล', image: 'rating', steps: ['เลือกผล The Must “ผ่าน” หรือ “ไม่ผ่าน” ตามเกณฑ์', 'เลือกคะแนน 0, 1 หรือ 2 ตามเกณฑ์ ใช้ N/A เฉพาะกรณีที่ไม่เกี่ยวข้องกับการประเมิน', 'กรอก “เหตุผล / บันทึกเพิ่มเติม” แล้วกดออกจากช่องข้อความเพื่อบันทึก'], note: 'ระบบบันทึกคะแนนอัตโนมัติ ต้องเชื่อมต่ออินเทอร์เน็ต รอให้ “กำลังบันทึก...” หายก่อนออกจากหน้า แล้วเปิดหัวข้ออีกครั้งเพื่อตรวจคะแนน หากแจ้งข้อผิดพลาด ให้ลองใหม่และตรวจว่าคะแนนยังอยู่' },
  { id: 'results', title: '4. ดูผลและดาวน์โหลดรายงาน', image: 'report', steps: ['ตรวจชื่อหน่วยบริการ ชื่อรอบ และวันที่ในรายงานให้ตรงกับรอบที่ต้องการ', 'ในกล่อง “สรุปภาพรวม” กด PDF, Word หรือ Excel (CSV) ตามไฟล์ที่ต้องการ', 'ในกล่อง “แบบละเอียด (มี comment + รูป)” กด “ดูในหน้าเว็บ” เพื่อดูรายละเอียด หรือกด PDF / Word เพื่อดาวน์โหลด'], note: 'จากหน้าประเมิน กด “ดูคะแนนรวม (Real-time)” เพื่อดูผลรวม หรือ “รายงานแบบสรุป (PDF)” / “รายงานฉบับเต็ม (PDF)” เพื่อเปิดรายงาน ประวัติการประเมินที่หน้าแรกแสดงเฉพาะรอบที่เปิดเผยสาธารณะ' },
  { id: 'admin', title: '5. ผู้ดูแล: เตรียมรอบการประเมิน', image: 'admin', steps: ['ที่หน้าแรก กด “ผู้ดูแลระบบ” แล้ว “เข้าสู่ระบบด้วย Google” ใช้บัญชีที่ได้รับสิทธิ์ จากหน้า “รอบการประเมิน” กด “+ สร้างรอบการประเมินใหม่”', 'เลือกหน่วยบริการและมาตรฐาน กรอกชื่อรอบและวันที่ประเมิน หากไม่มีหน่วยบริการ ให้เพิ่มจากเมนู “หน่วยบริการ” ก่อน', 'เลือกหลักการประเมิน: คะแนนแยกคน หรือคะแนนร่วมกันทั้งทีม เลือกให้ถูกตั้งแต่สร้างรอบ เพราะเปลี่ยนภายหลังไม่ได้', 'กด “สร้างรอบการประเมิน” จากนั้นส่งรหัสเข้าร่วมหรือ QR ให้กรรมการและผู้สังเกตการณ์'], note: 'รหัสเข้าร่วมปล่อยว่างได้ ระบบจะสุ่มให้ หากกรอกเองควรใช้รหัสสั้นที่กรอกได้ในช่องเข้าร่วม (ไม่เกิน 8 ตัว) และไม่ซ้ำกับรอบอื่น' },
]

export default function UserGuide() {
  const { hash } = useLocation()
  const [activeLesson, setActiveLesson] = useState(lessons[0].id)
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  useEffect(() => {
    let frame = 0
    const sections = lessons.map(lesson => document.getElementById(lesson.id)!)
    const update = () => {
      frame = 0
      const readingLine = Math.min(window.innerHeight * .3, 180)
      let current = lessons[0].id
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= readingLine) current = section.id
      }
      setActiveLesson(current)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    const resize = new ResizeObserver(schedule)
    sections.forEach(section => resize.observe(section))
    update()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  useEffect(() => {
    const nav = navRef.current
    const active = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    // Keep the current item visible in the compact mobile strip without moving the page.
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
      const offset = active.getBoundingClientRect().left - nav.getBoundingClientRect().left
      nav.scrollTo({ left: nav.scrollLeft + offset - (nav.clientWidth - active.clientWidth) / 2 })
    }
  }, [activeLesson])

  return (
    <div id="guide-top" className="guide-page mx-auto max-w-7xl px-4 py-6 sm:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6">
        <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="guide-link">← กลับหน้าแรก</Link>
          <button type="button" onClick={() => window.print()} className="guide-link">พิมพ์คู่มือ / บันทึก PDF</button>
        </div>
        <BrandLogo className="mb-4 h-14 w-auto object-contain" />
        <p className="mb-2 font-semibold text-emerald-700">ระบบประเมินมาตรฐาน PCU/NPCU</p>
        <h1 className="text-3xl font-bold text-slate-800">คู่มือใช้งานสำหรับเจ้าหน้าที่</h1>
      </header>
      <div className="guide-layout">
        <aside className="guide-sidebar no-print">
          <p className="mb-2 text-sm font-semibold text-slate-600">หัวข้อคู่มือ</p>
          <nav ref={navRef} aria-label="หัวข้อคู่มือ" className="guide-nav">
            {lessons.map(lesson => <a key={lesson.id} href={`#${lesson.id}`} className="guide-nav-link" aria-current={activeLesson === lesson.id ? 'location' : undefined}>{lesson.title}</a>)}
          </nav>
        </aside>
      <main className="min-w-0 space-y-10">
        {lessons.map(lesson => (
          <section key={lesson.id} id={lesson.id} className="guide-lesson rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby={`${lesson.id}-title`}>
            <h2 id={`${lesson.id}-title`} className="mb-5 text-xl font-bold text-slate-800">{lesson.title}</h2>
            <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_1fr]">
              <figure className={lesson.image === 'join' ? 'mx-auto w-full min-w-0 max-w-[280px]' : 'min-w-0'}>
                <a href={`${import.meta.env.BASE_URL}guide/${lesson.image}.png`} target="_blank" rel="noopener noreferrer" className="guide-image-link block rounded-xl border border-slate-200" aria-label={`เปิดภาพขนาดเต็ม: ${lesson.title}`}>
                  <img src={`${import.meta.env.BASE_URL}guide/${lesson.image}.png`} alt={`หน้าจอ${lesson.title} พร้อมวงกลมสีแดงแสดงตำแหน่งตามขั้นตอนด้านข้าง`} className="h-auto w-full rounded-xl" width={lesson.image === 'join' ? 540 : 1100} height={lesson.image === 'join' ? 1100 : 900} loading="lazy" />
                </a>
                <figcaption className="mt-2 text-sm text-slate-500">ภาพหน้าจอจริง · ข้อมูลตัวอย่าง · กดภาพเพื่อดูขนาดเต็ม</figcaption>
              </figure>
              <div>
                <ol className="space-y-5">
                  {lesson.steps.map((step, i) => <li key={step} className="flex items-start gap-3"><span className="guide-number shrink-0" aria-hidden="true">{i + 1}</span><span className="leading-relaxed"><span className="sr-only">ขั้นตอน {i + 1}: </span>{step}</span></li>)}
                </ol>
                <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">{lesson.note}</p>
              </div>
            </div>
          </section>
        ))}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-xl font-bold">ติดปัญหา ทำอย่างไร?</h2>
          <dl className="space-y-4 leading-relaxed">
            <div><dt className="font-semibold">เข้าร่วมไม่ได้ / ไม่พบรอบประเมิน</dt><dd className="text-slate-600">ตรวจรหัสกับผู้ดูแลให้ตรงกัน หากรอบปิดรับคะแนนแล้ว ให้เลือกผู้สังเกตการณ์เพื่อดูผล</dd></div>
            <div><dt className="font-semibold">กลับมาให้คะแนนต่อ</dt><dd className="text-slate-600">ใช้เครื่องและเบราว์เซอร์เดิม เปิดลิงก์รอบเดิม หากต้องเข้าร่วมอีกครั้ง ให้ใช้รหัส ชื่อ และบทบาทเดิม แล้วตรวจคะแนนก่อนกรอกต่อ</dd></div>
            <div><dt className="font-semibold">กดคะแนนไม่ได้</dt><dd className="text-slate-600">ตรวจว่าเข้าร่วมเป็นกรรมการประเมิน และรอบยังไม่ปิดรับคะแนน ผู้สังเกตการณ์ดูผลได้อย่างเดียว</dd></div>
            <div><dt className="font-semibold">บัญชี Google ไม่มีสิทธิ์ผู้ดูแล</dt><dd className="text-slate-600">แจ้งผู้ดูแลระบบให้ตรวจสิทธิ์ของอีเมลที่ใช้เข้าสู่ระบบ</dd></div>
          </dl>
        </section>
      </main>
      </div>
      <footer className="mt-8 py-4 text-sm text-slate-500">คู่มือภาพหน้าจอ ณ 13 ตุลาคม 2569 <a href="#guide-top" className="no-print ml-3 underline">กลับด้านบน ↑</a></footer>
    </div>
  )
}
