import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function AdminNav({ title }: { title: string }) {
  const navigate = useNavigate()
  async function logout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }
  return (
    <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
      <div>
        <p className="text-xs text-slate-400">ระบบประเมินมาตรฐาน PCU · ผู้ดูแล</p>
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      </div>
      <nav className="flex items-center gap-4 text-sm">
        <Link to="/admin" className="text-slate-500 hover:text-slate-800">
          รอบการประเมิน
        </Link>
        <Link to="/admin/facilities" className="text-slate-500 hover:text-slate-800">
          หน่วยบริการ
        </Link>
        <Link to="/admin/settings" className="text-slate-500 hover:text-slate-800">
          ตั้งค่าโลโก้
        </Link>
        <button onClick={logout} className="text-red-500 hover:text-red-700">
          ออกจากระบบ
        </button>
      </nav>
    </div>
  )
}
