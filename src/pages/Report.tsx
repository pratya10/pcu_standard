import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForRound } from '../lib/scoresApi'
import { aggregateAll, formatAvg } from '../lib/aggregate'
import type { AssessmentRound, FullStandard, Facility, Participant, Score } from '../types'

export default function Report() {
  const { roundId } = useParams<{ roundId: string }>()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [standard, setStandard] = useState<FullStandard | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!roundId) return
    const rid = roundId
    async function load() {
      setLoading(true)
      const { data: roundRow } = await supabase.from('assessment_rounds').select('*').eq('id', rid).single()
      if (!roundRow) {
        setLoading(false)
        return
      }
      const [std, sc, { data: fac }, { data: parts }] = await Promise.all([
        loadStandardByVersionId(roundRow.standard_version_id),
        fetchScoresForRound(rid),
        supabase.from('facilities').select('*').eq('id', roundRow.facility_id).single(),
        supabase.from('participants').select('*').eq('round_id', rid).order('joined_at'),
      ])
      setRound(roundRow as AssessmentRound)
      setStandard(std)
      setScores(sc)
      setFacility((fac as Facility) ?? null)
      setParticipants((parts as Participant[]) ?? [])
      setLoading(false)
    }
    load()
  }, [roundId])

  const flatTopics = useMemo(() => (standard ? allTopicsFlat(standard) : []), [standard])
  const aggregates = useMemo(() => aggregateAll(flatTopics.map((t) => t.id), scores), [flatTopics, scores])
  const evaluators = participants.filter((p) => p.role !== 'viewer')

  function exportCsv() {
    if (!standard) return
    const rows = [['หมวด', 'รหัสหัวข้อ', 'ชื่อหัวข้อ', 'ผ่าน The Must', 'คะแนนเฉลี่ย', 'จำนวนผู้ประเมิน', 'N/A']]
    for (const cat of standard.categories) {
      const catTopics = [...cat.topics, ...cat.groups.flatMap((g) => g.topics)]
      for (const t of catTopics) {
        const agg = aggregates.get(t.id)
        rows.push([
          `หมวด ${cat.code}`,
          t.code,
          t.name_th,
          agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? '-' : agg.mustPassFinal ? 'ผ่าน' : 'ไม่ผ่าน',
          formatAvg(agg?.avgScore ?? null),
          String(agg?.nScored ?? 0),
          String(agg?.nNa ?? 0),
        ])
      }
    }
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pcu-report-${round?.join_code ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังโหลด...</div>
  if (!round || !standard) return <div className="flex min-h-screen items-center justify-center text-red-600">ไม่พบรอบการประเมิน</div>

  const grandTotal = flatTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
  const mustFailTopics = flatTopics.filter((t) => aggregates.get(t.id)?.mustPassFinal === false)
  const overallPass = mustFailTopics.length === 0

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
      <div className="no-print mb-6 flex justify-end gap-2">
        <button onClick={exportCsv} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600">
          ดาวน์โหลด CSV
        </button>
        <button onClick={() => window.print()} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white">
          พิมพ์ / บันทึกเป็น PDF
        </button>
      </div>

      <div className="mb-6 text-center">
        <h1 className="text-xl font-bold text-slate-800">รายงานผลการประเมินมาตรฐานหน่วยบริการปฐมภูมิ</h1>
        <p className="text-sm text-slate-500">{standard.standardVersion.name}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-slate-200 p-4 text-sm">
        <p>
          <span className="text-slate-500">หน่วยบริการ: </span>
          {facility?.name}
        </p>
        <p>
          <span className="text-slate-500">รหัสหน่วยบริการ: </span>
          {facility?.code ?? '-'}
        </p>
        <p>
          <span className="text-slate-500">รอบการประเมิน: </span>
          {round.name}
        </p>
        <p>
          <span className="text-slate-500">วันที่ประเมิน: </span>
          {round.survey_date ?? '-'}
        </p>
        <p className="col-span-2">
          <span className="text-slate-500">คณะกรรมการผู้ประเมิน: </span>
          {evaluators.map((e) => e.name).join(', ') || '-'}
        </p>
      </div>

      {standard.categories.map((cat) => {
        const catTopics = [...cat.topics, ...cat.groups.flatMap((g) => g.topics)]
        const catTotal = catTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
        const catPass = catTopics.every((t) => aggregates.get(t.id)?.mustPassFinal !== false)
        return (
          <div key={cat.id} className="mb-6 break-inside-avoid">
            <h2 className="mb-2 text-sm font-bold text-slate-800">
              หมวดที่ {cat.code} · {cat.name_th}
            </h2>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs text-slate-500">
                  <th className="py-1 pr-2">หัวข้อ</th>
                  <th className="py-1 pr-2 text-center">The Must</th>
                  <th className="py-1 pr-2 text-center">คะแนน (0-2)</th>
                </tr>
              </thead>
              <tbody>
                {catTopics.map((t) => {
                  const agg = aggregates.get(t.id)
                  return (
                    <tr key={t.id} className="border-b border-slate-100">
                      <td className="py-1 pr-2">
                        <span className="font-mono text-xs text-slate-400">{t.code}</span> {t.name_th}
                      </td>
                      <td className="py-1 pr-2 text-center">
                        {agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? '-' : agg.mustPassFinal ? 'ผ่าน' : 'ไม่ผ่าน'}
                      </td>
                      <td className="py-1 pr-2 text-center font-semibold">{formatAvg(agg?.avgScore ?? null)}</td>
                    </tr>
                  )
                })}
                <tr className="font-semibold text-slate-800">
                  <td className="py-1 pr-2">รวม</td>
                  <td className="py-1 pr-2 text-center">{catPass ? 'ผ่าน' : 'ไม่ผ่าน'}</td>
                  <td className="py-1 pr-2 text-center">{catTotal.toFixed(1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      })}

      <div className="mb-8 rounded-xl border-2 border-slate-800 p-4 text-center">
        <p className="text-sm text-slate-500">สรุปผลการประเมินภาพรวม</p>
        <p className="text-3xl font-bold text-slate-800">{grandTotal.toFixed(1)} คะแนน</p>
        <p className={`text-sm font-semibold ${overallPass ? 'text-emerald-600' : 'text-red-600'}`}>
          {overallPass ? 'ผ่านเกณฑ์ The Must ครบทุกหัวข้อ' : `ไม่ผ่านเกณฑ์ The Must จำนวน ${mustFailTopics.length} หัวข้อ`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8 pt-8 text-center text-sm">
        <div>
          <p className="mb-8">ลงชื่อ .............................................</p>
          <p>ประธานคณะกรรมการประเมิน</p>
        </div>
        <div>
          <p className="mb-8">ลงชื่อ .............................................</p>
          <p>ผู้อำนวยการหน่วยบริการ</p>
        </div>
      </div>
    </div>
  )
}
