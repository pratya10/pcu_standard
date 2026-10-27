// เข้าสู่ระบบด้วยระบบกลางของ MSH (Central Login ที่ mshprimary.com) แบบเดียวกับ organize:
// Google / สแกนคิวอาร์ด้วยมือถือ / ด่านยืนยันตัวตน (/verify) แล้วกลับมาหน้าเดิม
// session เก็บที่ localStorage คีย์ msh:v3:supabase-session (โดเมนเดียวกัน) · /supabase-auth.js ใน index.html
// เป็นตัวจัดการกลาง และตรวจด่านยืนยันตัวตนให้ทุกหน้าที่มี session อยู่แล้ว
// supabase-js ของแอปนี้อ่าน/เขียน session ผ่าน adapter ด้านล่าง จึงใช้ session ชุดเดียวกัน ไม่ต่ออายุแยกกัน

export const MSH_SESSION_KEY = 'msh:v3:supabase-session'
export const PCU_AUTH_STORAGE_KEY = 'pcu-standard-auth'
const ADMIN_PATH = '/pcustandard71/admin'

type MshStored = { access_token: string; refresh_token?: string; expires_at: number }

type MshAuth = {
  login?: (returnTo?: string) => void
  logout?: () => void
}

declare global {
  interface Window {
    mshSupabaseAuth?: MshAuth
  }
}

function claims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(part), (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readMsh(): MshStored | null {
  try {
    const value = JSON.parse(localStorage.getItem(MSH_SESSION_KEY) || 'null') as MshStored | null
    return value?.access_token && value.expires_at ? value : null
  } catch {
    return null
  }
}

// session ของระบบกลาง -> รูปแบบที่ supabase-js ต้องการ (expires_at เป็นวินาที + user จาก JWT)
function toSupabase(value: MshStored) {
  const c = claims(value.access_token)
  const expiresAt = Math.floor(value.expires_at / 1000)
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token || '',
    token_type: 'bearer',
    expires_at: expiresAt,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    user: {
      id: String(c.sub || ''),
      aud: String(c.aud || 'authenticated'),
      role: String(c.role || 'authenticated'),
      email: typeof c.email === 'string' ? c.email : undefined,
      app_metadata: (c.app_metadata as object) || {},
      user_metadata: (c.user_metadata as object) || {},
      created_at: '',
    },
  }
}

export const mshAuthStorage = {
  getItem(key: string): string | null {
    if (key !== PCU_AUTH_STORAGE_KEY) return localStorage.getItem(key)
    const value = readMsh()
    return value ? JSON.stringify(toSupabase(value)) : null
  },
  setItem(key: string, raw: string) {
    if (key !== PCU_AUTH_STORAGE_KEY) return localStorage.setItem(key, raw)
    try {
      const value = JSON.parse(raw) as { access_token?: string; refresh_token?: string; expires_at?: number }
      if (!value.access_token || !value.expires_at) return
      const stored: MshStored = {
        access_token: value.access_token,
        refresh_token: value.refresh_token || '',
        expires_at: value.expires_at * 1000,
      }
      localStorage.setItem(MSH_SESSION_KEY, JSON.stringify(stored))
    } catch {
      // ค่าเสีย ไม่เขียนทับ session กลาง
    }
  },
  removeItem(key: string) {
    if (key !== PCU_AUTH_STORAGE_KEY) return localStorage.removeItem(key)
    localStorage.removeItem(MSH_SESSION_KEY)
  },
}

// ไปหน้าเข้าสู่ระบบกลาง แล้วกลับหน้าผู้ดูแล (หรือหน้าที่ระบุ)
export function goToCentralLogin(returnTo = ADMIN_PATH) {
  const auth = window.mshSupabaseAuth
  if (auth?.login) return auth.login(returnTo)
  window.location.replace(`https://mshprimary.com/?login=1&returnTo=${encodeURIComponent(returnTo)}`)
}

// ออกจากระบบ = ออกจาก session กลาง (organize ในเบราว์เซอร์นี้ออกด้วย เพราะเป็น session เดียวกัน)
export function centralLogout() {
  const auth = window.mshSupabaseAuth
  if (auth?.logout) return auth.logout()
  localStorage.removeItem(MSH_SESSION_KEY)
  window.location.assign(`https://mshprimary.com/?logout=1&returnTo=${encodeURIComponent(ADMIN_PATH)}`)
}
