import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'authed' | 'anon'>('loading')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? 'authed' : 'anon')
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setStatus(session ? 'authed' : 'anon')
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังตรวจสอบสิทธิ์...</div>
  }
  if (status === 'anon') return <Navigate to="/admin/login" replace />
  return <>{children}</>
}
