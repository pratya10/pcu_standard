import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from '../lib/supabaseClient'
import type { AssessmentRound, Facility, Participant } from '../types'
import AdminNav from '../components/AdminNav'

export default function AdminRoundDetail() {
  const { roundId } = useParams<{ roundId: string }>()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [copied, setCopied] = useState(false)

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

  async function removeParticipant(id: string) {
    if (!confirm('ลบผู้เข้าร่วมนี้ออกจากรอบการประเมิน?')) return
    await supabase.from('participants').delete().eq('id', id)
    load()
  }

  const joinUrl = typeof window !== 'undefined' ? `${window.location.origin}/join` : ''

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังโหลด...</div>
  if (!round) return <div className="flex min-h-screen items-center justify-center text-red-600">ไม่พบรอบการประเมิน</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <AdminNav title={round.name} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">หน่วยบริการ</p>
          <p className="mb-3 font-semibold text-slate-800">{facility?.name}</p>
          <p className="text-sm text-slate-500">วันที่ประเมิน</p>
          <p className="mb-3 font-semibold text-slate-800">{round.survey_date ?? '-'}</p>
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
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-2 text-sm text-slate-500">รหัสเข้าร่วม (Join Code)</p>
          <p className="mb-3 font-mono text-4xl font-bold tracking-widest text-slate-800">{round.join_code}</p>
          <QRCodeSVG value={joinUrl} size={120} />
          <button
            onClick={() => {
              navigator.clipboard.writeText(joinUrl)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="mt-3 text-xs text-emerald-700 underline"
          >
            {copied ? 'คัดลอกแล้ว' : `คัดลอกลิงก์เข้าร่วม (${joinUrl})`}
          </button>
        </div>
      </div>

      <div className="mb-6 flex gap-3">
        <Link to={`/round/${roundId}/live`} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">
          ดูคะแนน Real-time
        </Link>
        <Link to={`/round/${roundId}/report`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">
          รายงานสรุปผล / Export
        </Link>
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
