import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'

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

      <Link
        to="/admin/login"
        className="rounded-2xl border border-slate-300 bg-white px-6 py-2 text-center text-sm font-medium text-slate-600 active:scale-[0.98]"
      >
        ผู้ดูแลระบบ
      </Link>
    </div>
  )
}
