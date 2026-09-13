import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatAdminName, getMyAdminProfile } from '../lib/adminProfile'

export default function AdminNav({ title }: { title: string }) {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('ผู้ดูแล')

  useEffect(() => {
    async function load() {
      const [{ data }, profile] = await Promise.all([supabase.auth.getUser(), getMyAdminProfile()])
      setDisplayName(formatAdminName(profile, data.user?.email))
    }
    load()
  }, [])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }
  return (
    <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
      <div>
        <p className="text-xs text-slate-400">ระบบประเมินมาตรฐาน PCU · {displayName}</p>
        <h1 className="text-lg font-bold text-slate-800">{title}</h1>
      </div>
      <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-sm">
        <Link to="/admin" className="text-slate-500 hover:text-slate-800">
          รอบการประเมิน
        </Link>
        <Link to="/admin/facilities" className="text-slate-500 hover:text-slate-800">
          หน่วยบริการ
        </Link>
        <Link to="/admin/committee" className="text-slate-500 hover:text-slate-800">
          คณะกรรมการ
        </Link>
        <Link to="/admin/users" className="text-slate-500 hover:text-slate-800">
          ผู้ดูแลระบบ
        </Link>
        <Link to="/admin/settings" className="text-slate-500 hover:text-slate-800">
          ตั้งค่า
        </Link>
        <button onClick={logout} className="text-red-500 hover:text-red-700">
          ออกจากระบบ
        </button>
      </nav>
    </div>
  )
}
