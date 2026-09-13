import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Facility } from '../types'
import AdminNav from '../components/AdminNav'
import { useConfirm } from '../components/ConfirmProvider'

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
  const confirm = useConfirm()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
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

  function startEdit(f: Facility) {
    setEditingId(f.id)
    setForm({
      code: f.code ?? '',
      name: f.name,
      facility_type: f.facility_type ?? 'รพ.สต.',
      affiliation: f.affiliation ?? '',
      district: f.district ?? '',
      province: f.province ?? '',
      cup_hospital: f.cup_hospital ?? '',
      address: f.address ?? '',
      contact: f.contact ?? '',
    })
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('กรุณากรอกชื่อหน่วยบริการ')
      return
    }
    setSaving(true)
    setError(null)
    const payload = { ...form, code: form.code.trim() || null }
    const { error } = editingId
      ? await supabase.from('facilities').update(payload).eq('id', editingId)
      : await supabase.from('facilities').insert(payload)
    setSaving(false)
    if (error) {
      setError('บันทึกไม่สำเร็จ: ' + error.message)
      return
    }
    setForm(emptyForm)
    setEditingId(null)
    load()
  }

  async function handleDelete(f: Facility) {
    const ok = await confirm({ title: 'ลบหน่วยบริการ', message: `ลบหน่วยบริการ "${f.name}" ออกจากระบบ?`, confirmLabel: 'ลบ' })
    if (!ok) return
    const { error } = await supabase.from('facilities').delete().eq('id', f.id)
    if (error) {
      alert(
        error.code === '23503'
          ? 'ลบไม่ได้ เพราะหน่วยบริการนี้มีรอบการประเมินผูกอยู่แล้ว กรุณาลบรอบการประเมินที่เกี่ยวข้องก่อน'
          : 'ลบไม่สำเร็จ: ' + error.message,
      )
      return
    }
    if (editingId === f.id) cancelEdit()
    load()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav title="จัดการหน่วยบริการ (PCU)" />

      <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {editingId && (
          <p className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            กำลังแก้ไข: {facilities.find((f) => f.id === editingId)?.name}
          </p>
        )}
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
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : '+ เพิ่มหน่วยบริการ'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
            >
              ยกเลิก
            </button>
          )}
        </div>
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
                <th className="px-3 py-2"></th>
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
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(f)} className="mr-3 text-xs text-emerald-700 hover:underline">
                      แก้ไข
                    </button>
                    <button onClick={() => handleDelete(f)} className="text-xs text-red-500 hover:underline">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {facilities.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
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
