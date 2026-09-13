import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabaseClient'
import type { AssessmentRound, Facility, Participant } from '../types'
import AdminNav from '../components/AdminNav'
import { formatThaiDate } from '../lib/thaiDate'
import { useConfirm } from '../components/ConfirmProvider'

export default function AdminRoundDetail() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [editingInfo, setEditingInfo] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDate, setEditDate] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [editingCode, setEditingCode] = useState(false)
  const [editCode, setEditCode] = useState('')
  const [codeError, setCodeError] = useState<string | null>(null)

  async function load() {
    if (!roundId) return
    setLoading(true)
    const { data: roundRow } = await supabase.from('assessment_rounds').select('*').eq('id', roundId).single()
    if (roundRow) {
      const [{ data: fac }, { data: parts }] = await Promise.all([
        supabase.from('facilities').select('*').eq('id', roundRow.facility_id).single(),
        supabase.from('participants').select('*').eq('round_id', roundId).order('joined_at'),
      ])
      setRound(roundRow as AssessmentRound)
      setFacility((fac as Facility) ?? null)
      setParticipants((parts as Participant[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId])

  async function setStatus(status: AssessmentRound['status']) {
    if (!roundId) return
    setUpdating(true)
    await supabase
      .from('assessment_rounds')
      .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
      .eq('id', roundId)
    await load()
    setUpdating(false)
  }

  async function togglePublic() {
    if (!roundId || !round) return
    setUpdating(true)
    await supabase.from('assessment_rounds').update({ is_public: !round.is_public }).eq('id', roundId)
    await load()
    setUpdating(false)
  }

  async function removeParticipant(id: string) {
    if (!(await confirm({ title: 'ลบผู้เข้าร่วม', message: 'ลบผู้เข้าร่วมนี้ออกจากรอบการประเมิน?', confirmLabel: 'ลบ' }))) return
    await supabase.from('participants').delete().eq('id', id)
    load()
  }

  function startEditInfo() {
    if (!round) return
    setEditName(round.name)
    setEditDate(round.survey_date ?? '')
    setEditingInfo(true)
  }

  async function saveInfo() {
    if (!roundId || !editName.trim()) return
    setUpdating(true)
    await supabase
      .from('assessment_rounds')
      .update({ name: editName.trim(), survey_date: editDate || null })
      .eq('id', roundId)
    await load()
    setUpdating(false)
    setEditingInfo(false)
  }

  async function saveJoinCode() {
    if (!roundId) return
    const code = editCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{3,12}$/.test(code)) {
      setCodeError('รหัสต้องเป็นตัวอักษร A-Z หรือตัวเลข ยาว 3-12 ตัว')
      return
    }
    setUpdating(true)
    setCodeError(null)
    const { error } = await supabase.from('assessment_rounds').update({ join_code: code }).eq('id', roundId)
    setUpdating(false)
    if (error) {
      setCodeError(error.message.includes('duplicate') ? `รหัส "${code}" ถูกใช้ไปแล้ว กรุณาเลือกรหัสอื่น` : 'บันทึกไม่สำเร็จ: ' + error.message)
      return
    }
    await load()
    setEditingCode(false)
  }

  async function handleDeleteRound() {
    if (!roundId || !round) return
    const ok = await confirm({
      title: 'ลบรอบการประเมิน',
      message: `ลบรอบการประเมิน "${round.name}" ทั้งหมด รวมถึงคะแนนและผู้เข้าร่วมทั้งหมด?\nการลบนี้ย้อนกลับไม่ได้`,
      confirmLabel: 'ลบทั้งหมด',
    })
    if (!ok) return
    setDeleting(true)
    const { error } = await supabase.from('assessment_rounds').delete().eq('id', roundId)
    setDeleting(false)
    if (error) {
      alert('ลบไม่สำเร็จ: ' + error.message)
      return
    }
    navigate('/admin')
  }

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL}join` : ''

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังโหลด...</div>
  if (!round) return <div className="flex min-h-screen items-center justify-center text-red-600">ไม่พบรอบการประเมิน</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav title={round.name} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">ชื่อรอบการประเมิน</p>
              {editingInfo ? (
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm font-semibold"
                />
              ) : (
                <p className="font-semibold text-slate-800">{round.name}</p>
              )}
            </div>
            {!editingInfo && (
              <button onClick={startEditInfo} className="shrink-0 text-xs text-emerald-700 hover:underline">
                แก้ไข
              </button>
            )}
          </div>

          <p className="text-sm text-slate-500">หน่วยบริการ</p>
          <p className="mb-3 font-semibold text-slate-800">{facility?.name}</p>

          <p className="text-sm text-slate-500">วันที่ประเมิน</p>
          {editingInfo ? (
            <input
              type="date"
              value={editDate}
              onChange={(e) => setEditDate(e.target.value)}
              className="mb-3 w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
            />
          ) : (
            <p className="mb-3 font-semibold text-slate-800">{formatThaiDate(round.survey_date)}</p>
          )}

          {editingInfo && (
            <div className="mb-3 flex gap-2">
              <button
                onClick={saveInfo}
                disabled={updating}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                บันทึก
              </button>
              <button onClick={() => setEditingInfo(false)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-500">
                ยกเลิก
              </button>
            </div>
          )}

          <p className="text-sm text-slate-500">สถานะ</p>
          <div className="flex gap-2">
            {(['in_progress', 'completed'] as const).map((s) => (
              <button
                key={s}
                disabled={updating || round.status === s}
                onClick={() => setStatus(s)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${round.status === s ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-slate-300 text-slate-500'}`}
              >
                {s === 'in_progress' ? 'กำลังประเมิน' : 'ปิดรับคะแนน (เสร็จสิ้น)'}
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-slate-500">การเผยแพร่สู่สาธารณะ</p>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePublic}
              disabled={updating || round.status !== 'completed'}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${round.is_public ? 'border-sky-600 bg-sky-50 text-sky-700' : 'border-slate-300 text-slate-500'}`}
            >
              {round.is_public ? '✓ เผยแพร่อยู่ (คนทั่วไปดูได้ที่หน้า "ประวัติการประเมิน")' : 'ยังไม่เผยแพร่'}
            </button>
          </div>
          {round.status !== 'completed' && (
            <p className="mt-1 text-xs text-slate-400">ต้องปิดรับคะแนน (เสร็จสิ้น) ก่อน จึงจะเผยแพร่ผลสู่สาธารณะได้</p>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-[75%] flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-sm text-slate-500">รหัสเข้าร่วม (Join Code)</p>
          {editingCode ? (
            <div className="mb-3 flex flex-col items-center gap-2">
              <input
                value={editCode}
                onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                maxLength={12}
                className="w-40 rounded-lg border border-slate-300 px-2 py-1 text-center font-mono text-xl tracking-widest uppercase"
              />
              {codeError && <p className="text-xs text-red-600">{codeError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveJoinCode}
                  disabled={updating}
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  บันทึก
                </button>
                <button
                  onClick={() => {
                    setEditingCode(false)
                    setCodeError(null)
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-500"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-3 flex items-center gap-2">
              <p className="font-mono text-4xl font-bold tracking-widest text-slate-800">{round.join_code}</p>
              <button
                onClick={() => {
                  setEditCode(round.join_code)
                  setEditingCode(true)
                }}
                className="text-xs text-emerald-700 hover:underline"
              >
                แก้ไข
              </button>
            </div>
          )}
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            title="คลิกเพื่อคัดลอกลิงก์เข้าร่วม"
            className="cursor-pointer rounded-lg p-1 transition hover:bg-slate-50 active:scale-95"
          >
            <QRCodeSVG value={joinUrl} size={120} />
          </button>
          <p className="mt-2 text-xs text-slate-400">{copied ? 'คัดลอกลิงก์แล้ว ✓' : 'แตะที่ QR code เพื่อคัดลอกลิงก์เข้าร่วม'}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <Link to={`/round/${roundId}/live`} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          ดูคะแนน Real-time
        </Link>
        <Link to={`/round/${roundId}/report`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
          รายงานสรุปผล / Export
        </Link>
        <button
          onClick={handleDeleteRound}
          disabled={deleting}
          className="ml-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
        >
          {deleting ? 'กำลังลบ...' : 'ลบรอบการประเมินนี้'}
        </button>
      </div>

      <h2 className="mb-2 text-sm font-bold text-slate-700">ผู้เข้าร่วม ({participants.length})</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {participants.map((p) => (
          <div key={p.id} className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm last:border-0">
            <div>
              <span className="font-medium text-slate-800">{p.name}</span>{' '}
              <span className="text-xs text-slate-400">
                {p.role === 'evaluator' ? 'กรรมการประเมิน' : p.role === 'viewer' ? 'ผู้สังเกตการณ์' : 'ประธาน'}
              </span>
            </div>
            <button onClick={() => removeParticipant(p.id)} className="text-xs text-red-500 hover:text-red-700">
              ลบ
            </button>
          </div>
        ))}
        {participants.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">ยังไม่มีผู้เข้าร่วม</p>}
      </div>
    </div>
  )
}
