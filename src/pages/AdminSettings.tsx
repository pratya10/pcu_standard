import { useEffect, useRef, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { deleteLogo, getLogoUrl, uploadLogo } from '../lib/branding'
import { getMyAdminProfile, saveMyAdminProfile } from '../lib/adminProfile'
import { useConfirm } from '../components/ConfirmProvider'

export default function AdminSettings() {
  const confirm = useConfirm()
  const [logoUrl, setLogoUrl] = useState(() => getLogoUrl())
  const [hasLogo, setHasLogo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [profession, setProfession] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const profile = await getMyAdminProfile()
      if (profile) {
        setFirstName(profile.first_name ?? '')
        setLastName(profile.last_name ?? '')
        setProfession(profile.profession ?? '')
      }
      setProfileLoading(false)
    }
    load()
  }, [])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileSaved(false)
    try {
      await saveMyAdminProfile({ firstName, lastName, profession })
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } finally {
      setProfileSaving(false)
    }
  }

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
    const ok = await confirm({
      title: 'ลบโลโก้',
      message: 'ลบโลโก้ปัจจุบัน? หน้าแรกและรายงานจะไม่แสดงโลโก้จนกว่าจะอัปโหลดใหม่',
      confirmLabel: 'ลบ',
    })
    if (!ok) return
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
    <AdminLayout title="ตั้งค่า" maxWidth="max-w-xl lg:max-w-2xl xl:max-w-3xl">
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-medium text-slate-600">ข้อมูลผู้ใช้งาน (แสดงแทนคำว่า "ผู้ดูแล" ในระบบ)</p>
        {profileLoading ? (
          <p className="text-sm text-slate-400">กำลังโหลด...</p>
        ) : (
          <form onSubmit={handleSaveProfile} className="grid grid-cols-2 gap-3">
            <input
              placeholder="ชื่อจริง"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="นามสกุล"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              placeholder="วิชาชีพ (เช่น นักวิชาการสาธารณสุข)"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={profileSaving}
              className="col-span-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {profileSaving ? 'กำลังบันทึก...' : profileSaved ? '✓ บันทึกแล้ว' : 'บันทึกข้อมูลผู้ใช้งาน'}
            </button>
          </form>
        )}
      </div>

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
    </AdminLayout>
  )
}
