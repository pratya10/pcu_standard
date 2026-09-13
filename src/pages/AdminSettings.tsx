import { useRef, useState } from 'react'
import AdminNav from '../components/AdminNav'
import { deleteLogo, getLogoUrl, uploadLogo } from '../lib/branding'

export default function AdminSettings() {
  const [logoUrl, setLogoUrl] = useState(() => getLogoUrl())
  const [hasLogo, setHasLogo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSaving(true)
    try {
      await uploadLogo(file)
      setLogoUrl(getLogoUrl())
      setHasLogo(true)
    } catch (err) {
      console.error(err)
      setError('อัปโหลดไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDelete() {
    if (!confirm('ลบโลโก้ปัจจุบัน? หน้าแรกและรายงานจะไม่แสดงโลโก้จนกว่าจะอัปโหลดใหม่')) return
    setError(null)
    setSaving(true)
    try {
      await deleteLogo()
      setHasLogo(false)
    } catch (err) {
      console.error(err)
      setError('ลบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <AdminNav title="ตั้งค่าโลโก้หน่วยงาน" />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-medium text-slate-600">โลโก้ปัจจุบัน (แสดงที่หน้าแรกและหัวรายงาน)</p>

        <div className="mb-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
          {hasLogo ? (
            <img
              src={logoUrl}
              alt="โลโก้หน่วยงาน"
              className="max-h-full max-w-full object-contain"
              onError={() => setHasLogo(false)}
            />
          ) : (
            <p className="text-sm text-slate-400">ยังไม่มีโลโก้</p>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <label className="flex-1 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-center text-sm font-semibold text-white">
            {saving ? 'กำลังอัปโหลด...' : 'อัปโหลด / แทนที่โลโก้'}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="hidden"
              disabled={saving}
              onChange={handleFileChange}
            />
          </label>
          {hasLogo && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50"
            >
              ลบโลโก้
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-400">รองรับไฟล์ PNG, JPG, SVG, WebP — แนะนำพื้นหลังโปร่งใส (PNG/SVG)</p>
      </div>
    </div>
  )
}
