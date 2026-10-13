import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import GuideLink from '../components/GuideLink'
import VersionFooter from '../components/VersionFooter'

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <BrandLogo className="mx-auto mb-4 h-[104px] w-auto object-contain" />
        <h1 className="text-2xl font-bold text-slate-800">ระบบประเมินมาตรฐาน PCU/NPCU</h1>
        <p className="mt-2 text-sm text-slate-500">ฉบับก้าวหน้า ปี 2571–2573</p>
      </div>

      <Link
        to="/join"
        className="rounded-2xl bg-emerald-600 px-6 py-5 text-center text-white shadow-sm active:scale-[0.98]"
      >
        <span className="block text-xl font-bold">เข้าร่วมประเมิน</span>
        <span className="block text-sm font-medium text-emerald-50">(กรรมการ และ ผู้สังเกตการณ์)</span>
      </Link>

      <Link
        to="/history"
        className="rounded-2xl border border-sky-300 bg-white px-6 py-2 text-center text-sm font-medium text-sky-700 active:scale-[0.98]"
      >
        ประวัติการประเมิน
      </Link>

      <GuideLink />

      <Link
        to="/admin/login"
        aria-label="ผู้ดูแลระบบ"
        title="ผู้ดูแลระบบ"
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600 active:scale-[0.98]"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M12 3 4 6v6c0 4 4 7 8 9 4-2 8-5 8-9V6l-8-3Z" strokeLinejoin="round" />
          <circle cx="12" cy="10" r="2" />
          <path d="M8.5 16c.5-2 1.7-3 3.5-3s3 1 3.5 3" strokeLinecap="round" />
        </svg>
      </Link>
      <VersionFooter />
    </div>
  )
}
