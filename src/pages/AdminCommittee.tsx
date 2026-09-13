import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CommitteeMember } from '../types'
import AdminNav from '../components/AdminNav'
import { useConfirm } from '../components/ConfirmProvider'

const emptyForm = {
  name: '',
  civil_service_level: '',
  affiliation: '',
  position: '',
  phone: '',
  email: '',
  note: '',
}

export default function AdminCommittee() {
  const confirm = useConfirm()
  const [members, setMembers] = useState<CommitteeMember[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await supabase.from('committee_members').select('*').order('name')
    if (!error) setMembers(data as CommitteeMember[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(m: CommitteeMember) {
    setEditingId(m.id)
    setForm({
      name: m.name,
      civil_service_level: m.civil_service_level ?? '',
      affiliation: m.affiliation ?? '',
      position: m.position ?? '',
      phone: m.phone ?? '',
      email: m.email ?? '',
      note: m.note ?? '',
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
      setError('กรุณากรอกชื่อ-สกุล')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      name: form.name.trim(),
      civil_service_level: form.civil_service_level.trim() || null,
      affiliation: form.affiliation.trim() || null,
      position: form.position.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      note: form.note.trim() || null,
    }
    const { error } = editingId
      ? await supabase.from('committee_members').update(payload).eq('id', editingId)
      : await supabase.from('committee_members').insert(payload)
    setSaving(false)
    if (error) {
      setError('บันทึกไม่สำเร็จ: ' + error.message)
      return
    }
    cancelEdit()
    load()
  }

  async function handleDelete(m: CommitteeMember) {
    const ok = await confirm({ title: 'ลบรายชื่อ', message: `ลบ "${m.name}" ออกจากทะเบียนคณะกรรมการ?`, confirmLabel: 'ลบ' })
    if (!ok) return
    await supabase.from('committee_members').delete().eq('id', m.id)
    if (editingId === m.id) cancelEdit()
    load()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AdminNav title="ทะเบียนคณะกรรมการ" />
      <p className="mb-4 -mt-4 text-sm text-slate-500">
        ข้อมูลอ้างอิงสำหรับใช้ประกอบการประเมิน (ระดับ/ตำแหน่ง สังกัด) แยกจากรายชื่อผู้เข้าร่วมในแต่ละรอบที่เก็บตอนกดเข้าร่วมด้วยรหัส
      </p>

      <form onSubmit={handleSubmit} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4">
        {editingId && (
          <p className="col-span-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            กำลังแก้ไข: {members.find((m) => m.id === editingId)?.name}
          </p>
        )}
        <input
          placeholder="ชื่อ-สกุล *"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="ตำแหน่ง (เช่น นักวิชาการสาธารณสุขชำนาญการ)"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="ระดับข้าราชการ (เช่น ชำนาญการพิเศษ)"
          value={form.civil_service_level}
          onChange={(e) => setForm({ ...form, civil_service_level: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="หน่วยงานที่สังกัด"
          value={form.affiliation}
          onChange={(e) => setForm({ ...form, affiliation: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="เบอร์โทร"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="อีเมล"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="หมายเหตุ"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          className="col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : '+ เพิ่มรายชื่อ'}
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
                <th className="px-3 py-2">ชื่อ-สกุล</th>
                <th className="px-3 py-2">ตำแหน่ง</th>
                <th className="px-3 py-2">ระดับ</th>
                <th className="px-3 py-2">สังกัด</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2">{m.position ?? '-'}</td>
                  <td className="px-3 py-2">{m.civil_service_level ?? '-'}</td>
                  <td className="px-3 py-2">{m.affiliation ?? '-'}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(m)} className="mr-3 text-xs text-emerald-700 hover:underline">
                      แก้ไข
                    </button>
                    <button onClick={() => handleDelete(m)} className="text-xs text-red-500 hover:underline">
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    ยังไม่มีรายชื่อในทะเบียน
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
