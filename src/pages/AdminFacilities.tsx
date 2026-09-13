import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Facility } from '../types'
import AdminNav from '../components/AdminNav'

const emptyForm = {
  code: '',
  name: '',
  facility_type: 'รพ.สต.',
  affiliation: '',
  district: '',
  province: '',
  cup_hospital: '',
  address: '',
  contact: '',
}

export default function AdminFacilities() {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('facilities').select('*').order('name')
    if (!error) setFacilities(data as Facility[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อหน่วยบริการ')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('facilities').insert({
      ...form,
      code: form.code.trim() || null,
    })
    setSaving(false)
    if (error) {
      setError('บันทึกไม่สำเร็จ: ' + error.message)
      return
    }
    setForm(emptyForm)
    load()
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav title="จัดการหน่วยบริการ (PCU)" />

      <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <input
          placeholder="รหัสหน่วยบริการ 5 หลัก"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="ชื่อหน่วยบริการ *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={form.facility_type}
          onChange={(e) => setForm({ ...form, facility_type: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option>รพ.สต.</option>
          <option>ศสม.</option>
          <option>คลินิกชุมชนอบอุ่น</option>
          <option>อื่นๆ</option>
        </select>
        <input
          placeholder="สังกัด (เช่น อบจ.เชียงราย)"
          value={form.affiliation}
          onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="อำเภอ"
          value={form.district}
          onChange={(e) => setForm({ ...form, district: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="จังหวัด"
          value={form.province}
          onChange={(e) => setForm({ ...form, province: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="โรงพยาบาลแม่ข่าย (CUP)"
          value={form.cup_hospital}
          onChange={(e) => setForm({ ...form, cup_hospital: e.target.value })}
          className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="ที่อยู่"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="ช่องทางติดต่อ"
          value={form.contact}
          onChange={(e) => setForm({ ...form, contact: e.target.value })}
          className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="col-span-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'กำลังบันทึก...' : '+ เพิ่มหน่วยบริการ'}
        </button>
      </form>

      {loading ? (
        <p className="text-slate-400">กำลังโหลด...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2">รหัส</th>
                <th className="px-3 py-2">ชื่อหน่วยบริการ</th>
                <th className="px-3 py-2">ประเภท</th>
                <th className="px-3 py-2">อำเภอ/จังหวัด</th>
                <th className="px-3 py-2">CUP</th>
              </tr>
            </thead>
            <tbody>
              {facilities.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono">{f.code ?? '-'}</td>
                  <td className="px-3 py-2 font-medium">{f.name}</td>
                  <td className="px-3 py-2">{f.facility_type}</td>
                  <td className="px-3 py-2">
                    {f.district} {f.province}
                  </td>
                  <td className="px-3 py-2">{f.cup_hospital}</td>
                </tr>
              ))}
              {facilities.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    ยังไม่มีหน่วยบริการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
