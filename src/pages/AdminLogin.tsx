import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { goToCentralLogin } from '../lib/mshSession'
import BrandLogo from '../components/BrandLogo'
import VersionFooter from '../components/VersionFooter'

// เข้าสู่ระบบผ่านหน้ากลางของ MSH แบบเดียวกับ organize (Google / สแกนคิวอาร์ / ด่านยืนยันตัวตน)
// มี session อยู่แล้ว -> เข้าหน้าผู้ดูแลทันที · ไม่มี -> ไปหน้ากลาง แล้วกลับมาที่ /pcustandard71/admin
export default function AdminLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return
        if (data.session) navigate('/admin', { replace: true })
        else goToCentralLogin()
      })
      .catch(() => {
        if (!cancelled) setError('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง')
      })
    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <BrandLogo className="mx-auto mb-4 h-[96px] w-auto object-contain" />
      <h1 className="mb-6 text-center text-xl font-bold text-slate-800">เข้าสู่ระบบผู้ดูแล</h1>
      <div className="w-full">
        <button type="button" className="pcu-google-button" onClick={() => goToCentralLogin()}>
          <span>เข้าสู่ระบบ</span>
        </button>
        <div className="mt-3 min-h-[3rem] text-center text-sm" aria-live="polite" aria-atomic="true">
          {error ? (
            <p role="alert" className="text-red-600">{error}</p>
          ) : (
            <p role="status" className="text-slate-600">กำลังไปหน้าเข้าสู่ระบบ (Google / สแกนคิวอาร์ด้วยมือถือ)…</p>
          )}
        </div>
      </div>
      <VersionFooter />
    </div>
  )
}
