import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForRound } from '../lib/scoresApi'
import { fetchTeamScoreAuditForRound, fetchTeamScoresForRound, teamScoreToScore } from '../lib/teamScoresApi'
import { aggregateAll, formatAvg } from '../lib/aggregate'
import type { AssessmentRound, FullStandard, Facility, Participant, Score, TeamScoreAudit, TopicPhoto } from '../types'
import { formatThaiDateTime } from '../lib/thaiDate'
import BrandLogo from '../components/BrandLogo'
import { downloadBlob, generateReportDocx } from '../lib/docxExport'
import { formatThaiDate } from '../lib/thaiDate'
import { getTopicPhotoUrl, groupPhotosByTopicAndItem, listRoundPhotos } from '../lib/topicPhotos'

// "ความคิดเห็นที่ N : ... โดย ..." — one evaluator's comment per line, numbered
// within its own group (a topic's general comments and each sub-item's
// comments are numbered separately), with no extra status text.
function buildCommentLines(scores: Score[] | undefined, evaluatorNameById: Map<string, string>, pick: (s: Score) => string | null | undefined): string[] {
  if (!scores) return []
  const lines: string[] = []
  let n = 0
  for (const s of scores) {
    const comment = pick(s)
    if (!comment) continue
    n++
    const name = evaluatorNameById.get(s.participant_id) ?? 'กรรมการ'
    lines.push(`ความคิดเห็นที่ ${n} : ${comment} โดย ${name}`)
  }
  return lines
}

export default function Report() {
  const { roundId } = useParams<{ roundId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [standard, setStandard] = useState<FullStandard | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [photos, setPhotos] = useState<TopicPhoto[]>([])
  const [auditLog, setAuditLog] = useState<TeamScoreAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [printMode, setPrintMode] = useState<'summary' | 'detailed'>('summary')
  const [showAuditLog, setShowAuditLog] = useState(false)
  const printAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!roundId) return
    const rid = roundId
    // Guards against a slower request for a round the user has since
    // navigated away from resolving after — and silently overwriting —
    // the currently-viewed round's freshly-loaded data with stale scores.
    let cancelled = false
    setLoading(true)
    setRound(null)
    setStandard(null)
    setScores([])
    setFacility(null)
    setParticipants([])
    setPhotos([])
    setAuditLog([])
    async function load() {
      const { data: roundRow } = await supabase.from('assessment_rounds').select('*').eq('id', rid).single()
      if (cancelled) return
      if (!roundRow) {
        setLoading(false)
        return
      }
      const round = roundRow as AssessmentRound
      const [std, sc, { data: fac }, { data: parts }, ph, audit] = await Promise.all([
        loadStandardByVersionId(round.standard_version_id),
        round.scoring_mode === 'collaborative' ? fetchTeamScoresForRound(rid).then((rows) => rows.map(teamScoreToScore)) : fetchScoresForRound(rid),
        supabase.from('facilities').select('*').eq('id', round.facility_id).single(),
        supabase.from('participants').select('*').eq('round_id', rid).order('joined_at'),
        listRoundPhotos(rid),
        round.scoring_mode === 'collaborative' ? fetchTeamScoreAuditForRound(rid) : Promise.resolve([]),
      ])
      if (cancelled) return
      setRound(round)
      setStandard(std)
      setScores(sc)
      setFacility((fac as Facility) ?? null)
      setParticipants((parts as Participant[]) ?? [])
      setPhotos(ph)
      setAuditLog(audit)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [roundId])

  useEffect(() => {
    function resetAfterPrint() {
      setPrintMode('summary')
    }
    window.addEventListener('afterprint', resetAfterPrint)
    return () => window.removeEventListener('afterprint', resetAfterPrint)
  }, [])

  // The logo (and any evidence photos in the detailed report) are fetched
  // over the network, so without this the print dialog/PDF can capture the
  // page before those images have actually finished loading and render
  // them blank.
  function waitForImages(root: HTMLElement, timeoutMs = 8000): Promise<void> {
    const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
    if (pending.length === 0) return Promise.resolve()
    return new Promise((resolve) => {
      let remaining = pending.length
      const done = () => {
        remaining -= 1
        if (remaining <= 0) resolve()
      }
      pending.forEach((img) => {
        img.addEventListener('load', done, { once: true })
        img.addEventListener('error', done, { once: true })
      })
      setTimeout(resolve, timeoutMs)
    })
  }

  async function triggerPrint(mode: 'summary' | 'detailed') {
    setPrintMode(mode)
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    if (printAreaRef.current) await waitForImages(printAreaRef.current)
    window.print()
  }

  function printDetailed() {
    triggerPrint('detailed')
  }

  function printSummary() {
    triggerPrint('summary')
  }

  useEffect(() => {
    if (loading) return
    const autoPrint = searchParams.get('print')
    if (autoPrint === 'summary') printSummary()
    else if (autoPrint === 'detailed') printDetailed()
    if (autoPrint) {
      const next = new URLSearchParams(searchParams)
      next.delete('print')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const flatTopics = useMemo(() => (standard ? allTopicsFlat(standard) : []), [standard])
  const aggregates = useMemo(() => aggregateAll(flatTopics.map((t) => t.id), scores), [flatTopics, scores])
  const evaluators = participants.filter((p) => p.role !== 'viewer')
  const evaluatorNameById = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants])
  const photosByTopicAndItem = useMemo(() => groupPhotosByTopicAndItem(photos), [photos])
  const itemTextById = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of flatTopics) for (const it of t.scoreItems) map.set(it.id, it.item_text)
    return map
  }, [flatTopics])
  const [exportingDocx, setExportingDocx] = useState<'with' | 'without' | null>(null)

  async function exportDocx(includeComments: boolean) {
    if (!standard || !round) return
    setExportingDocx(includeComments ? 'with' : 'without')
    try {
      const blob = await generateReportDocx({
        round,
        facility,
        standard,
        aggregates,
        evaluators,
        grandTotal: flatTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0),
        mustFailCount: flatTopics.filter((t) => aggregates.get(t.id)?.mustPassFinal === false).length,
        includeComments,
        photosByTopicAndItem: includeComments ? photosByTopicAndItem : undefined,
      })
      const suffix = includeComments ? 'with-comments' : 'no-comments'
      downloadBlob(blob, `pcu-report-${round.join_code}-${suffix}.docx`)
    } finally {
      setExportingDocx(null)
    }
  }

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
    <div ref={printAreaRef} className="mx-auto max-w-3xl px-6 py-8 print:px-0 print:py-0">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <Link to={`/round/${roundId}/score`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600">
            ← กลับสู่การประเมิน
          </Link>
          <Link to="/admin" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600">
            ไปหน้าแอดมิน
          </Link>
        </div>
      </div>

      <div className="no-print mb-6 flex flex-wrap gap-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-400">สรุปภาพรวม</p>
          <div className="flex gap-2">
            <button onClick={printSummary} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white">
              PDF
            </button>
            <button
              onClick={() => exportDocx(false)}
              disabled={exportingDocx !== null}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-50"
            >
              {exportingDocx === 'without' ? 'กำลังสร้าง...' : 'Word'}
            </button>
            <button onClick={exportCsv} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600">
              Excel (CSV)
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-400">แบบละเอียด (มี comment + รูป)</p>
          <div className="flex gap-2">
            <button onClick={printDetailed} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-medium text-white">
              PDF
            </button>
            <button
              onClick={() => exportDocx(true)}
              disabled={exportingDocx !== null}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 disabled:opacity-50"
            >
              {exportingDocx === 'with' ? 'กำลังสร้าง...' : 'Word'}
            </button>
          </div>
        </div>

        {round.scoring_mode === 'collaborative' && auditLog.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-400">ประวัติการแก้ไข (ทีมคณะกรรมช่วยกัน)</p>
            <button
              onClick={() => setShowAuditLog((v) => !v)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600"
            >
              {showAuditLog ? 'ซ่อนประวัติการแก้ไข' : 'ดูประวัติการแก้ไข'}
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 text-center print:mb-8">
        <BrandLogo className="mx-auto mb-3 h-[83px] w-auto object-contain print:mb-1 print:h-11" />
        <h1 className="text-xl font-bold text-slate-800 print:text-sm">รายงานผลการประเมินมาตรฐานหน่วยบริการปฐมภูมิ</h1>
        <p className="text-sm text-slate-500 print:text-[10px]">{standard.standardVersion.name}</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-slate-200 p-4 text-sm print:mb-8 print:gap-y-0 print:p-2 print:text-[9.5px]">
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
          {formatThaiDate(round.survey_date)}
        </p>
        <p className="col-span-2">
          <span className="text-slate-500">คณะกรรมการผู้ประเมิน: </span>
          {evaluators.map((e) => e.name).join(', ') || '-'}
        </p>
      </div>

      <div className={printMode === 'summary' ? 'print:mb-8' : ''}>
        {standard.categories.map((cat) => {
          const catTopics = [...cat.topics, ...cat.groups.flatMap((g) => g.topics)]
          const catTotal = catTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
          const catPass = catTopics.every((t) => aggregates.get(t.id)?.mustPassFinal !== false)
          const compact = printMode === 'summary'
          return (
            <div key={cat.id} className={`mb-6 break-inside-avoid ${compact ? 'print:mb-1' : 'print:mb-6'}`}>
              <h2 className={`mb-2 text-sm font-bold text-slate-800 ${compact ? 'print:mb-0.5 print:text-[9px]' : 'print:text-sm'}`}>
                หมวดที่ {cat.code} · {cat.name_th}
              </h2>
              <table className={`w-full border-collapse text-sm ${compact ? 'print:text-[7.5px] print:leading-tight' : 'print:text-xs'}`}>
                <thead>
                  <tr className={`border-b border-slate-300 text-left text-xs text-slate-500 ${compact ? 'print:text-[7px]' : 'print:text-[11px]'}`}>
                    <th className={`py-1 pr-2 ${compact ? 'print:py-0' : 'print:py-1'}`}>หัวข้อ</th>
                    <th className={`py-1 pr-2 text-center ${compact ? 'print:py-0' : 'print:py-1'}`}>The Must</th>
                    <th className={`py-1 pr-2 text-center ${compact ? 'print:py-0' : 'print:py-1'}`}>คะแนน (0-2)</th>
                  </tr>
                </thead>
                <tbody>
                  {catTopics.map((t) => {
                    const agg = aggregates.get(t.id)
                    const generalLines = compact ? [] : buildCommentLines(agg?.scores, evaluatorNameById, (s) => s.comment)
                    const itemBlocks = compact
                      ? []
                      : t.scoreItems
                          .map((item) => ({
                            item,
                            lines: buildCommentLines(agg?.scores, evaluatorNameById, (s) => s.item_notes?.[item.id]?.comment),
                            itemPhotos: photosByTopicAndItem.get(t.id)?.get(item.id) ?? [],
                          }))
                          .filter((b) => b.lines.length > 0 || b.itemPhotos.length > 0)
                    const hasDetail = generalLines.length > 0 || itemBlocks.length > 0
                    return (
                      <Fragment key={t.id}>
                        <tr className="border-b border-slate-100">
                          <td className={`py-1 pr-2 ${compact ? 'print:py-0' : 'print:py-1'}`}>
                            <span className={`font-mono text-xs text-slate-400 ${compact ? 'print:text-[7px]' : 'print:text-[10px]'}`}>{t.code}</span>{' '}
                            {t.name_th}
                          </td>
                          <td className={`py-1 pr-2 text-center ${compact ? 'print:py-0' : 'print:py-1'}`}>
                            {agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? '-' : agg.mustPassFinal ? 'ผ่าน' : 'ไม่ผ่าน'}
                          </td>
                          <td className={`py-1 pr-2 text-center font-semibold ${compact ? 'print:py-0' : 'print:py-1'}`}>{formatAvg(agg?.avgScore ?? null)}</td>
                        </tr>
                        {hasDetail && (
                          <tr className="break-inside-avoid border-b border-slate-100">
                            <td colSpan={3} className="bg-slate-50 px-3 py-2 align-top text-xs text-slate-600 print:text-[11px]">
                              {generalLines.length > 0 && (
                                <ul className="mb-1.5 list-none space-y-0.5 pl-0 last:mb-0">
                                  {generalLines.map((line, i) => (
                                    <li key={i}>{line}</li>
                                  ))}
                                </ul>
                              )}
                              {itemBlocks.map(({ item, lines, itemPhotos }) => (
                                <div key={item.id} className="mt-1.5 border-l-2 border-slate-200 pl-2 first:mt-0">
                                  <p className="font-medium text-slate-700">{item.item_text}</p>
                                  {lines.length > 0 && (
                                    <ul className="list-none space-y-0.5 pl-0">
                                      {lines.map((line, i) => (
                                        <li key={i}>{line}</li>
                                      ))}
                                    </ul>
                                  )}
                                  {itemPhotos.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      {itemPhotos.map((p) => (
                                        <img
                                          key={p.id}
                                          src={getTopicPhotoUrl(p.file_path)}
                                          alt={p.file_name ?? ''}
                                          className="h-20 w-20 rounded-md border border-slate-200 object-cover"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  <tr className="font-semibold text-slate-800">
                    <td className={`py-1 pr-2 ${compact ? 'print:py-0' : 'print:py-1'}`}>รวม</td>
                    <td className={`py-1 pr-2 text-center ${compact ? 'print:py-0' : 'print:py-1'}`}>{catPass ? 'ผ่าน' : 'ไม่ผ่าน'}</td>
                    <td className={`py-1 pr-2 text-center ${compact ? 'print:py-0' : 'print:py-1'}`}>{catTotal.toFixed(1)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {showAuditLog && auditLog.length > 0 && (
        <div className="no-print mb-6 rounded-xl border border-slate-200 p-4">
          <h2 className="mb-2 text-sm font-bold text-slate-800">ประวัติการแก้ไขคะแนน (โหมดทีมคณะกรรมช่วยกัน)</h2>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {auditLog.map((a) => {
              const topicLabel = flatTopics.find((t) => t.id === a.topic_id)
              const fieldLabel = a.field === 'score' ? 'คะแนน' : a.field === 'must_pass' ? 'ผล The Must' : `ข้อย่อย "${itemTextById.get(a.item_id ?? '') ?? ''}"`
              const describe = (v: unknown) => (a.field === 'must_pass' ? (v ? 'ผ่าน' : 'ไม่ผ่าน') : a.field === 'item_checked' ? (v ? 'มี' : 'ไม่มี') : String(v))
              return (
                <li key={a.id}>
                  <span className="font-mono text-xs text-slate-400">{topicLabel?.code}</span> {topicLabel?.name_th} — {fieldLabel}: เปลี่ยนจาก "
                  {describe(a.old_value)}" เป็น "{describe(a.new_value)}" โดย {evaluatorNameById.get(a.participant_id ?? '') ?? 'กรรมการ'} เมื่อ{' '}
                  {formatThaiDateTime(a.created_at)}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="break-inside-avoid">
        <div className="mb-8 rounded-xl border-2 border-slate-800 p-4 text-center print:mb-4 print:border print:border-slate-800 print:p-2">
          <p className="text-sm text-slate-500 print:text-[10px]">สรุปผลการประเมินภาพรวม</p>
          <p className="text-3xl font-bold text-slate-800 print:text-base">{grandTotal.toFixed(1)} คะแนน</p>
          <p className={`text-sm font-semibold print:text-[10px] ${overallPass ? 'text-emerald-600' : 'text-red-600'}`}>
            {overallPass ? 'ผ่านเกณฑ์ The Must ครบทุกหัวข้อ' : `ไม่ผ่านเกณฑ์ The Must จำนวน ${mustFailTopics.length} หัวข้อ`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-8 text-center text-sm print:gap-6 print:pt-0 print:text-[10px]">
          <div>
            <p className="mb-8 print:mb-4">ลงชื่อ .............................................</p>
            <p>ประธานคณะกรรมการประเมิน</p>
          </div>
          <div>
            <p className="mb-8 print:mb-4">ลงชื่อ .............................................</p>
            <p>ผู้อำนวยการหน่วยบริการ</p>
          </div>
        </div>
      </div>
    </div>
  )
}
