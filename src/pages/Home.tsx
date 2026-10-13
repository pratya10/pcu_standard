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
        className="home-join-button cursor-pointer rounded-2xl border border-emerald-700 bg-emerald-600 px-6 py-5 text-center text-white hover:bg-emerald-700 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
      >
        <span className="block text-xl font-bold">เข้าร่วมประเมิน</span>
        <span className="block text-sm font-medium text-emerald-50">(กรรมการ และ ผู้สังเกตการณ์)</span>
      </Link>

      <Link
        to="/history"
        className="cursor-pointer rounded-2xl border-2 border-sky-300 bg-white px-6 py-4 text-center text-lg font-semibold text-sky-700 hover:bg-sky-50 focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-sky-600 active:scale-[0.98]"
      >
        ประวัติการประเมิน
      </Link>

      <GuideLink />

      <Link to="/documents" className="guide-link">
        เอกสารการประเมิน
      </Link>

      <Link
        to="/admin/login"
        aria-label="สำหรับ Admin"
        title="ผู้ดูแลระบบ"
        className="mx-auto inline-flex min-h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-xs font-medium text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
      >
        สำหรับ Admin
      </Link>
      <VersionFooter />
    </div>
  )
}
