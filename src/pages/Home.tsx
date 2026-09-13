import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div className="text-center">
        <BrandLogo className="mx-auto mb-4 h-20 w-auto object-contain" />
        <h1 className="text-2xl font-bold text-slate-800">ระบบประเมินมาตรฐาน PCU</h1>
        <p className="mt-2 text-sm text-slate-500">มาตรฐานหน่วยบริการปฐมภูมิ ฉบับก้าวหน้า ปี 2571–2573</p>
      </div>

      <Link
        to="/join"
        className="rounded-2xl bg-emerald-600 px-6 py-5 text-center text-lg font-semibold text-white shadow-sm active:scale-[0.98]"
      >
        เข้าร่วมประเมิน (กรรมการ / ผู้สังเกตการณ์)
      </Link>

      <Link
        to="/admin/login"
        className="rounded-2xl border border-slate-300 bg-white px-6 py-4 text-center font-medium text-slate-600 active:scale-[0.98]"
      >
        เข้าสู่ระบบผู้ดูแล (สสอ. / สสจ.)
      </Link>
    </div>
  )
}
