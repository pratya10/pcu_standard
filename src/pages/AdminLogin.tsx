import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadGoogleIdentity } from '../lib/googleIdentity'
import BrandLogo from '../components/BrandLogo'
import VersionFooter from '../components/VersionFooter'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export default function AdminLogin() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed' | 'signing-in'>('loading')
  const [attempt, setAttempt] = useState(0)
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = buttonRef.current!
    let cancelled = false
    let signingIn = false
    let resizeObserver: ResizeObserver | undefined

    async function setup() {
      if (!GOOGLE_CLIENT_ID) {
        setStatus('failed')
        setError('ยังไม่พร้อมให้เข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ')
        return
      }
      try {
        const googleId = await loadGoogleIdentity()
        if (cancelled) return
        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (cancelled || signingIn) return
            signingIn = true
            setError(null)
            setStatus('signing-in')
            try {
              const { error: authError } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: response.credential,
              })
              if (authError) throw authError
              if (!cancelled) navigate('/admin', { replace: true })
            } catch {
              if (!cancelled) {
                setError('เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง')
                setStatus('ready')
              }
            } finally {
              signingIn = false
            }
          },
        })
        let renderedWidth = 0
        const render = () => {
          const width = Math.floor(host.clientWidth)
          if (cancelled || width === 0 || width === renderedWidth) return
          renderedWidth = width
          host.replaceChildren()
          // The visible Google control is the actual pointer and keyboard target.
          googleId.renderButton(host, {
            type: 'standard', theme: 'outline', size: 'large',
            text: 'signin_with', shape: 'pill', width, locale: 'th',
          })
        }
        render()
        resizeObserver = new ResizeObserver(render)
        resizeObserver.observe(host)
        setStatus('ready')
      } catch {
        if (!cancelled) {
          setStatus('failed')
          setError('โหลดปุ่ม Google ไม่สำเร็จ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่')
        }
      }
    }
    void setup()
    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      host.replaceChildren()
    }
  }, [attempt, navigate])

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <BrandLogo className="mx-auto mb-4 h-[96px] w-auto object-contain" />
      <h1 className="mb-6 text-center text-xl font-bold text-slate-800">เข้าสู่ระบบผู้ดูแล</h1>

      <div className="mx-auto w-full max-w-[320px]">
        <div className="grid min-h-[44px] items-center">
          <div ref={buttonRef} inert={status !== 'ready'} className="col-start-1 row-start-1 min-w-0 w-full" />
          {status === 'loading' && (
            <p role="status" className="col-start-1 row-start-1 text-center text-sm text-slate-500">
              กำลังโหลดปุ่ม Google…
            </p>
          )}
          {status === 'failed' && GOOGLE_CLIENT_ID && (
            <button type="button" onClick={() => {
              setError(null)
              setStatus('loading')
              setAttempt((value) => value + 1)
            }}
              className="col-start-1 row-start-1 min-h-[44px] cursor-pointer rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600">
              ลองโหลดปุ่ม Google อีกครั้ง
            </button>
          )}
        </div>
        <div className="mt-3 min-h-[3rem] text-center text-sm" aria-live="polite" aria-atomic="true">
          {status === 'signing-in' && <p role="status" className="text-slate-600">กำลังเข้าสู่ระบบ…</p>}
          {error && <p role="alert" className="text-red-600">{error}</p>}
        </div>
      </div>
      <VersionFooter />
    </div>
  )
}
