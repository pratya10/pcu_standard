import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Facility, StandardVersion } from '../types'
import { randomJoinCode } from '../lib/participantSession'
import AdminNav from '../components/AdminNav'

export default function AdminNewRound() {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [versions, setVersions] = useState<StandardVersion[]>([])
  const [facilityId, setFacilityId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [name, setName] = useState('')
  const [surveyDate, setSurveyDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [{ data: fac }, { data: ver }] = await Promise.all([
        supabase.from('facilities').select('*').order('name'),
        supabase.from('standard_versions').select('*').order('created_at', { ascending: false }),
      ])
      setFacilities((fac as Facility[]) ?? [])
      setVersions((ver as StandardVersion[]) ?? [])
      if (ver && ver.length) setVersionId(ver[0].id)
    }
    load()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!facilityId || !versionId || !name.trim()) {
      setError('กรุณาเลือกหน่วยบริการและกรอกชื่อรอบการประเมิน')
      return
    }
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    for (let attempt = 0; attempt < 5; attempt++) {
      const joinCode = randomJoinCode()
      const { data, error } = await supabase
        .from('assessment_rounds')
        .insert({
          facility_id: facilityId,
          standard_version_id: versionId,
          name: name.trim(),
          survey_date: surveyDate || null,
          join_code: joinCode,
          status: 'in_progress',
          created_by: user?.id ?? null,
        })
        .select()
        .single()
      if (!error) {
        navigate(`/admin/rounds/${data.id}`)
        return
      }
      if (!error.message.includes('duplicate')) {
        setError('สร้างรอบการประเมินไม่สำเร็จ: ' + error.message)
        setSaving(false)
        return
      }
    }
    setError('ไม่สามารถสร้างรหัสเข้าร่วมที่ไม่ซ้ำได้ กรุณาลองใหม่')
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <AdminNav title="สร้างรอบการประเมินใหม่" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">หน่วยบริการ</label>
          <select
            value={facilityId}
            onChange={(e) => setFacilityId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— เลือกหน่วยบริการ —</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} {f.code ? `(${f.code})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">มาตรฐานที่ใช้ประเมิน</label>
          <select
            value={versionId}
            onChange={(e) => setVersionId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">ชื่อรอบการประเมิน</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น รอบ Presurvey กันยายน 2569"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">วันที่ประเมิน (Survey Day)</label>
          <input
            type="date"
            value={surveyDate}
            onChange={(e) => setSurveyDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving || !facilities.length}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'กำลังสร้าง...' : 'สร้างรอบการประเมิน'}
        </button>
        {!facilities.length && (
          <p className="text-xs text-amber-600">ยังไม่มีหน่วยบริการในระบบ กรุณาเพิ่มที่หน้า "หน่วยบริการ" ก่อน</p>
        )}
      </form>
    </div>
  )
}
