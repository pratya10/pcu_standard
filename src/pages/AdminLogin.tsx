import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import BrandLogo from '../components/BrandLogo'
import VersionFooter from '../components/VersionFooter'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export default function AdminLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setError('ยังไม่ได้ตั้งค่า VITE_GOOGLE_CLIENT_ID')
      return
    }

    let cancelled = false
    let attempts = 0

    function trySetup() {
      if (cancelled) return
      if (!window.google || !buttonRef.current) {
        if (attempts++ < 100) setTimeout(trySetup, 100)
        return
      }
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID!,
        callback: handleCredentialResponse,
      })
      // Rendered invisible and overlaid on our own custom-styled button below
      // — Google's terms require the real button to be the click target, but
      // don't require it to be the visible one.
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: 320,
      })
    }
    trySetup()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCredentialResponse(response: { credential: string }) {
    setError(null)
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential,
    })
    if (error) {
      setError('เข้าสู่ระบบด้วย Google ไม่สำเร็จ: ' + error.message)
      return
    }
    navigate('/admin')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <BrandLogo className="mx-auto mb-4 h-[96px] w-auto object-contain" />
      <h1 className="mb-6 text-center text-xl font-bold text-slate-800">เข้าสู่ระบบผู้ดูแล</h1>

      {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}

      <div className="relative mx-auto" style={{ width: 320, height: 44 }}>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white font-semibold text-slate-800 shadow-sm">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
            />
            <path
              fill="#4CAF50"
              d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.6 35.9 44 30.3 44 24c0-1.3-.1-2.7-.4-3.5z"
            />
          </svg>
          เข้าสู่ระบบด้วย Google
        </div>
        <div ref={buttonRef} className="absolute inset-0 overflow-hidden opacity-0" />
      </div>

      <VersionFooter />
    </div>
  )
}
