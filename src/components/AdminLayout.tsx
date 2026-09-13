import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { formatAdminName, getMyAdminProfile } from '../lib/adminProfile'
import BrandLogo from './BrandLogo'

function formatBuildDate(iso: string) {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${dd} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`
}

const NAV_ITEMS = [
  { to: '/admin', label: 'รอบการประเมิน' },
  { to: '/admin/facilities', label: 'หน่วยบริการ' },
  { to: '/admin/committee', label: 'คณะกรรมการ' },
  { to: '/admin/users', label: 'ผู้ดูแลระบบ' },
  { to: '/admin/settings', label: 'ตั้งค่า' },
]

export default function AdminLayout({
  title,
  children,
  maxWidth = 'max-w-4xl xl:max-w-6xl 2xl:max-w-7xl',
}: {
  title: string
  children: ReactNode
  maxWidth?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [displayName, setDisplayName] = useState('ผู้ดูแล')
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data }, profile] = await Promise.all([supabase.auth.getUser(), getMyAdminProfile()])
      setDisplayName(formatAdminName(profile, data.user?.email))
    }
    load()
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  async function logout() {
    await supabase.auth.signOut()
    navigate('/admin/login')
  }

  function isActive(to: string) {
    return to === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(to)
  }

  const linkClass = (to: string) =>
    `rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(to) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
        <div className="border-b border-slate-100 p-4">
          <BrandLogo className="mb-2 h-10 w-auto object-contain" />
          <p className="text-xs text-slate-400">ระบบประเมินมาตรฐาน PCU</p>
          <p className="truncate text-sm font-medium text-slate-700">{displayName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className={linkClass(item.to)}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <button
            onClick={logout}
            className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-500 hover:bg-red-50"
          >
            ออกจากระบบ
          </button>
        </div>
        <div className="border-t border-slate-100 p-3">
          <p className="text-[10px] leading-tight text-slate-400">
            Version {__APP_VERSION__}
            <br />
            {formatBuildDate(__BUILD_DATE__)} ( {__GIT_HASH__} )
          </p>
        </div>
      </aside>

      {/* Mobile top bar + collapsible dropdown */}
      <div className="border-b border-slate-200 bg-white md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-slate-400">{displayName}</p>
            <h1 className="text-lg font-bold text-slate-800">{title}</h1>
          </div>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="เมนู"
            className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-600"
          >
            {menuOpen ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
              </svg>
            )}
          </button>
        </div>
        {menuOpen && (
          <nav className="flex flex-col gap-1 border-t border-slate-100 px-4 py-3">
            {NAV_ITEMS.map((item) => (
              <Link key={item.to} to={item.to} className={linkClass(item.to)}>
                {item.label}
              </Link>
            ))}
            <button
              onClick={logout}
              className="mt-1 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-500 hover:bg-red-50"
            >
              ออกจากระบบ
            </button>
          </nav>
        )}
      </div>

      {/* Main content */}
      <main className="min-w-0 flex-1">
        <div className={`mx-auto ${maxWidth} px-4 py-8`}>
          <h1 className="mb-6 hidden text-xl font-bold text-slate-800 md:block">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  )
}
