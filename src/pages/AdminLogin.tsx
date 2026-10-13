import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import BrandLogo from '../components/BrandLogo'
import VersionFooter from '../components/VersionFooter'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isCallback = params.get('callback') === 'google'
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(isCallback)
  const signingIn = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (isCallback) {
      const denied = new URLSearchParams(window.location.hash.slice(1)).has('error')
      void supabase.auth.getSession().then(({ data, error: authError }) => {
        if (cancelled) return
        if (!denied && !authError && data.session) {
          navigate('/admin', { replace: true })
          return
        }
        setError('เข้าสู่ระบบไม่สำเร็จหรือถูกยกเลิก กรุณาลองอีกครั้ง')
        setPending(false)
        navigate('/admin/login', { replace: true })
      }).catch(() => {
        if (cancelled) return
        setError('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง')
        setPending(false)
      })
    }
    // Restore the button when returning from Google with the browser Back action.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !isCallback) {
        signingIn.current = false
        setPending(false)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      cancelled = true
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [isCallback, navigate])

  async function signIn() {
    if (signingIn.current || pending) return
    signingIn.current = true
    setError(null)
    setPending(true)
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: new URL(`${import.meta.env.BASE_URL}admin/login?callback=google`, window.location.origin).href,
        },
      })
      if (authError) throw authError
    } catch {
      signingIn.current = false
      setPending(false)
      setError('เปิดหน้า Google ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง')
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <BrandLogo className="mx-auto mb-4 h-[96px] w-auto object-contain" />
      <h1 className="mb-6 text-center text-xl font-bold text-slate-800">เข้าสู่ระบบผู้ดูแล</h1>
      <div className="w-full">
        <button type="button" className="pcu-google-button" onClick={() => void signIn()} disabled={pending} aria-busy={pending}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z" />
            <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.6A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3A10 10 0 0 0 3 16.6L6.4 14Z" />
            <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 3 7.5l3.4 2.6C7.2 7.8 9.4 6 12 6Z" />
          </svg>
          <span>เข้าสู่ระบบด้วย Google</span>
        </button>
        <div className="mt-3 min-h-[3rem] text-center text-sm" aria-live="polite" aria-atomic="true">
          {pending && <p role="status" className="text-slate-600">{isCallback ? 'กำลังเข้าสู่ระบบ…' : 'กำลังเปิดหน้า Google…'}</p>}
          {error && <p role="alert" className="text-red-600">{error}</p>}
        </div>
      </div>
      <VersionFooter />
    </div>
  )
}
