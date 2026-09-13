import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Facility, ScoringMode, StandardVersion } from '../types'
import { randomJoinCode } from '../lib/participantSession'
import AdminLayout from '../components/AdminLayout'

export default function AdminNewRound() {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [versions, setVersions] = useState<StandardVersion[]>([])
  const [facilityId, setFacilityId] = useState('')
  const [versionId, setVersionId] = useState('')
  const [name, setName] = useState('')
  const [surveyDate, setSurveyDate] = useState('')
  const [customJoinCode, setCustomJoinCode] = useState('')
  const [scoringMode, setScoringMode] = useState<ScoringMode>('average')
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
    const custom = customJoinCode.trim().toUpperCase()
    if (custom && !/^[A-Z0-9]{3,12}$/.test(custom)) {
      setError('รหัสเข้าร่วมที่กำหนดเองต้องเป็นตัวอักษร A-Z หรือตัวเลข ยาว 3-12 ตัว')
      return
    }
    setSaving(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (custom) {
      const { data, error } = await supabase
        .from('assessment_rounds')
        .insert({
          facility_id: facilityId,
          standard_version_id: versionId,
          name: name.trim(),
          survey_date: surveyDate || null,
          join_code: custom,
          status: 'in_progress',
          scoring_mode: scoringMode,
          created_by: user?.id ?? null,
        })
        .select()
        .single()
      setSaving(false)
      if (error) {
        setError(error.message.includes('duplicate') ? `รหัสเข้าร่วม "${custom}" ถูกใช้ไปแล้ว กรุณาเลือกรหัสอื่น` : 'สร้างรอบการประเมินไม่สำเร็จ: ' + error.message)
        return
      }
      navigate(`/admin/rounds/${data.id}`)
      return
    }

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
          scoring_mode: scoringMode,
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
    <AdminLayout title="สร้างรอบการประเมินใหม่" maxWidth="max-w-xl lg:max-w-2xl xl:max-w-3xl">
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

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">หลักการประเมิน</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setScoringMode('average')}
              className={`rounded-lg border-2 p-3 text-left text-sm ${scoringMode === 'average' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}
            >
              <p className="font-semibold text-slate-800">ค่าเฉลี่ยกรรมการทุกคน</p>
              <p className="mt-0.5 text-xs text-slate-500">กรรมการแต่ละคนประเมินทุกข้อแยกกัน ไม่เห็นของกัน แล้วนำผลมาเฉลี่ย</p>
            </button>
            <button
              type="button"
              onClick={() => setScoringMode('collaborative')}
              className={`rounded-lg border-2 p-3 text-left text-sm ${scoringMode === 'collaborative' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}
            >
              <p className="font-semibold text-slate-800">ทีมคณะกรรมช่วยกัน</p>
              <p className="mt-0.5 text-xs text-slate-500">ทุกคนเห็นคะแนนกันแบบ real-time ช่วยกันให้คะแนนชุดเดียว มีระบบยืนยันก่อนทับค่าที่มีอยู่แล้ว</p>
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-600">เลือกได้ครั้งเดียวตอนสร้างรอบ เปลี่ยนภายหลังไม่ได้</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-600">
            รหัสเข้าร่วม (Join Code) — กำหนดเองได้ <span className="text-slate-400">(ไม่บังคับ)</span>
          </label>
          <input
            value={customJoinCode}
            onChange={(e) => setCustomJoinCode(e.target.value.toUpperCase())}
            placeholder="ปล่อยว่างไว้เพื่อให้ระบบสุ่มให้อัตโนมัติ"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm tracking-widest uppercase"
            maxLength={12}
          />
          <p className="mt-1 text-xs text-slate-400">A-Z หรือตัวเลข 3-12 ตัว เช่น PAOO2569</p>
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
    </AdminLayout>
  )
}
