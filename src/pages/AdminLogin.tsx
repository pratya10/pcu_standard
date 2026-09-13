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
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
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
      <BrandLogo className="mx-auto mb-4 h-16 w-auto object-contain" />
      <h1 className="mb-6 text-center text-xl font-bold text-slate-800">เข้าสู่ระบบผู้ดูแล</h1>

      {error && <p className="mb-3 text-center text-sm text-red-600">{error}</p>}

      <div ref={buttonRef} className="flex justify-center" />

      <VersionFooter />
    </div>
  )
}
