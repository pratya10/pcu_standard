import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { centralLogout } from '../lib/mshSession'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authed' | 'anon' | 'unauthorized'>('loading')

  useEffect(() => {
    let cancelled = false

    async function check(session: unknown) {
      if (!session) {
        if (!cancelled) setStatus('anon')
        return
      }
      const { data, error } = await supabase.rpc('is_admin')
      if (cancelled) return
      if (error || !data) {
        // ไม่ signOut: session นี้เป็นของระบบกลาง ใช้กับ organize ต่อได้ แค่ไม่มีสิทธิ์ผู้ดูแลที่นี่
        if (!cancelled) setStatus('unauthorized')
        return
      }
      setStatus('authed')
    }

    supabase.auth.getSession().then(({ data }) => check(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => check(session))
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังตรวจสอบสิทธิ์...</div>
  }
  if (status === 'unauthorized') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-semibold text-red-600">บัญชีนี้ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแล</p>
        <p className="text-sm text-slate-500">กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึง</p>
        <button type="button" onClick={() => centralLogout()} className="mt-2 text-sm text-emerald-700 underline">
          เข้าสู่ระบบด้วยบัญชีอื่น
        </button>
      </div>
    )
  }
  if (status === 'anon') return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
