import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { AdminAllowlistEntry } from '../types'
import { addAdminUser, listAdminUsers, removeAdminUser } from '../lib/adminUsers'
import { useConfirm } from '../components/ConfirmProvider'
import { formatThaiDate } from '../lib/thaiDate'
import AdminNav from '../components/AdminNav'

export default function AdminUsers() {
  const confirm = useConfirm()
  const [users, setUsers] = useState<AdminAllowlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [myEmail, setMyEmail] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      setUsers(await listAdminUsers())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    supabase.auth.getUser().then(({ data }) => setMyEmail(data.user?.email ?? null))
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addAdminUser(email)
      setEmail('')
      load()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message.includes('duplicate') ? 'อีเมลนี้อยู่ในรายชื่อผู้ดูแลอยู่แล้ว' : 'เพิ่มไม่สำเร็จ: ' + message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(entry: AdminAllowlistEntry) {
    if (entry.email === myEmail) {
      const ok = await confirm({
        title: 'ลบสิทธิ์ของตัวเอง',
        message: 'นี่คืออีเมลที่คุณใช้ล็อกอินอยู่ ถ้าลบแล้วจะออกจากระบบผู้ดูแลทันทีและเข้าใช้งานอีกไม่ได้จนกว่าจะมีผู้ดูแลคนอื่นเพิ่มกลับให้ ยืนยันลบ?',
        confirmLabel: 'ลบสิทธิ์ตัวเอง',
      })
      if (!ok) return
    } else {
      const ok = await confirm({ title: 'ลบสิทธิ์ผู้ดูแล', message: `เอา "${entry.email}" ออกจากรายชื่อผู้ดูแลระบบ?`, confirmLabel: 'ลบ' })
      if (!ok) return
    }
    await removeAdminUser(entry.email)
    if (entry.email === myEmail) {
      await supabase.auth.signOut()
      window.location.href = '/pcustandard71/admin/login'
      return
    }
    load()
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <AdminNav title="จัดการผู้ดูแลระบบ" />

      <form onSubmit={handleAdd} className="mb-6 flex gap-2 rounded-xl border border-slate-200 bg-white p-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="อีเมล Google ที่ต้องการให้สิทธิ์ผู้ดูแล"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'กำลังเพิ่ม...' : '+ เพิ่ม'}
        </button>
      </form>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {users.map((u) => (
            <div key={u.email} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-0">
              <div>
                <p className="font-medium text-slate-800">
                  {u.email} {u.email === myEmail && <span className="text-xs text-emerald-600">(คุณ)</span>}
                </p>
                <p className="text-xs text-slate-400">เพิ่มเมื่อ {formatThaiDate(u.created_at.slice(0, 10))}</p>
              </div>
              <button onClick={() => handleRemove(u)} className="text-xs text-red-500 hover:underline">
                ลบ
              </button>
            </div>
          ))}
          {users.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">ยังไม่มีผู้ดูแลระบบ</p>}
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        ผู้ที่มีอีเมลอยู่ในรายชื่อนี้เท่านั้นที่จะเข้าสู่ระบบผู้ดูแลด้วย Google ได้ ผู้ใช้ต้องล็อกอินด้วยบัญชี Google ที่ตรงกับอีเมลนี้
      </p>
    </div>
  )
}
