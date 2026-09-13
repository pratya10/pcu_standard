import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForParticipant, upsertScore } from '../lib/scoresApi'
import { getParticipantSession } from '../lib/participantSession'
import type { AssessmentRound, FullStandard, Score } from '../types'
import TopicScoreCard from '../components/TopicScoreCard'

type SectionTopic = FullStandard['categories'][number]['topics'][number]

type Section = {
  id: string
  navLabel: string
  headerLabel: string
  color: string
  topics: SectionTopic[]
}

const RAINBOW = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6']

export default function ScoreForm() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [standard, setStandard] = useState<FullStandard | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  const session = roundId ? getParticipantSession(roundId) : null

  useEffect(() => {
    if (!roundId) return
    if (!session) {
      navigate('/join')
      return
    }
    const rid = roundId
    async function load() {
      setLoading(true)
      const { data: roundRow, error: roundErr } = await supabase.from('assessment_rounds').select('*').eq('id', rid).single()
      if (roundErr || !roundRow) {
        setError('ไม่พบรอบการประเมิน')
        setLoading(false)
        return
      }
      const [std, sc] = await Promise.all([
        loadStandardByVersionId(roundRow.standard_version_id),
        fetchScoresForParticipant(rid, session!.participantId),
      ])
      setRound(roundRow as AssessmentRound)
      setStandard(std)
      setScores(sc)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId])

  const flatTopics = useMemo(() => (standard ? allTopicsFlat(standard) : []), [standard])
  const scoreByTopic = useMemo(() => new Map(scores.map((s) => [s.topic_id, s])), [scores])
  const answeredCount = flatTopics.filter((t) => {
    const s = scoreByTopic.get(t.id)
    return !!s && (s.is_na || s.score !== null)
  }).length

  // Rainbow-ordered sections for the jump nav: หมวด 1, หมวด 2.1-2.4, หมวด 3.
  const sections = useMemo<Section[]>(() => {
    const list: Section[] = []
    let i = 0
    for (const cat of standard?.categories ?? []) {
      if (cat.topics.length > 0) {
        list.push({
          id: `sec-cat-${cat.id}`,
          navLabel: `หมวด ${cat.code}`,
          headerLabel: `หมวดที่ ${cat.code} · ${cat.name_th}`,
          color: RAINBOW[i % RAINBOW.length],
          topics: cat.topics,
        })
        i++
      }
      for (const g of cat.groups) {
        list.push({
          id: `sec-group-${g.id}`,
          navLabel: `${g.code} ${g.name_th}`,
          headerLabel: `${g.code} ${g.name_th}`,
          color: RAINBOW[i % RAINBOW.length],
          topics: g.topics,
        })
        i++
      }
    }
    return list
  }, [standard])

  function sectionSummary(section: Section) {
    let ciAchieved = 0
    let ciMax = 0
    let ciAnswered = 0
    let mustPass = 0
    let mustTotal = 0
    let mustAnswered = 0
    for (const t of section.topics) {
      const s = scoreByTopic.get(t.id)
      if (!s?.is_na) {
        ciAchieved += s?.score ?? 0
        ciMax += 2
      }
      if (s && (s.is_na || s.score !== null)) ciAnswered++
      if (t.must_text) {
        mustTotal++
        if (s?.must_pass === true) mustPass++
        if (s?.must_pass !== null && s?.must_pass !== undefined) mustAnswered++
      }
    }
    return { ciAchieved, ciMax, ciAnswered, mustPass, mustTotal, mustAnswered }
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังโหลด...</div>
  if (error || !round || !standard || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-red-600">{error ?? 'เกิดข้อผิดพลาด'}</p>
        <Link to="/join" className="text-emerald-600 underline">
          กลับไปหน้าเข้าร่วม
        </Link>
      </div>
    )
  }

  const readOnly = round.status === 'completed' || session.role === 'viewer'
  const visibleSections = activeSectionId ? sections.filter((s) => s.id === activeSectionId) : sections

  function selectSection(id: string) {
    setActiveSectionId((prev) => (prev === id ? null : id))
    setNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave(topicId: string, draft: Parameters<Parameters<typeof TopicScoreCard>[0]['onSave']>[0]) {
    const saved = await upsertScore({
      roundId: roundId!,
      topicId,
      participantId: session!.participantId,
      score: draft.score,
      isNa: draft.isNa,
      mustPass: draft.mustPass,
      comment: draft.comment,
      evidenceChecked: draft.evidenceChecked,
      itemNotes: draft.itemNotes,
    })
    setScores((prev) => {
      const others = prev.filter((s) => s.topic_id !== topicId)
      return [...others, saved]
    })
  }

  const navList = (
    <>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">หมวดหมู่</p>
        {activeSectionId && (
          <button type="button" onClick={() => selectSection(activeSectionId)} className="text-xs font-medium text-emerald-700 underline">
            แสดงทั้งหมด
          </button>
        )}
      </div>
      {sections.map((s) => {
        const { ciAchieved, ciMax, ciAnswered, mustPass, mustTotal, mustAnswered } = sectionSummary(s)
        const active = activeSectionId === s.id
        const mustClass =
          mustAnswered === 0
            ? 'text-slate-400'
            : mustPass === mustTotal
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-600'
        const ciClass =
          ciAnswered === 0
            ? 'text-slate-400'
            : ciMax > 0 && ciAchieved === ciMax
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-200 text-slate-600'
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => selectSection(s.id)}
            className={`flex flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-xs font-medium ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="flex-1 truncate">{s.navLabel}</span>
            </span>
            <span className="flex gap-1 pl-[18px]">
              {mustTotal > 0 && (
                <span title="The Must" className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${mustClass}`}>
                  {mustPass} | {mustTotal}
                </span>
              )}
              <span title="Continuous Improvement" className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${ciClass}`}>
                {ciAchieved} | {ciMax}
              </span>
            </span>
          </button>
        )
      })}
    </>
  )

  return (
    <div className="mx-auto flex max-w-5xl gap-4 px-4 py-6 pb-20">
      <nav className="sticky top-4 hidden h-fit w-52 shrink-0 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 md:flex">
        {navList}
      </nav>

      {navOpen && (
        <div className="fixed inset-0 z-30 flex md:hidden" onClick={() => setNavOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div
            className="relative flex h-full w-64 max-w-[80vw] flex-col gap-1 overflow-y-auto bg-white p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-700">หมวดหมู่</p>
              <button type="button" onClick={() => setNavOpen(false)} className="rounded-lg px-2 py-1 text-slate-400">
                ✕
              </button>
            </div>
            {navList}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 mb-4 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-lg font-bold text-slate-800">{round.name}</h1>
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 md:hidden"
            >
              ☰ หมวดหมู่
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {session.name} · {session.role === 'evaluator' ? 'กรรมการประเมิน' : session.role === 'viewer' ? 'ผู้สังเกตการณ์' : session.role}
            </span>
            <span className="font-semibold text-emerald-700">
              {answeredCount}/{flatTopics.length} หัวข้อ
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${flatTopics.length ? (answeredCount / flatTopics.length) * 100 : 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">ระบบบันทึกผลอัตโนมัติทันทีที่กดเลือก ไม่ต้องกด Save</p>
          <Link to={`/round/${roundId}/live`} className="mt-2 inline-block text-xs text-emerald-700 underline">
            ดูคะแนนรวมแบบ Real-time →
          </Link>
          {readOnly && (
            <p className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-500">
              {round.status === 'completed' ? 'รอบนี้ปิดรับคะแนนแล้ว (โหมดดูอย่างเดียว)' : 'ผู้สังเกตการณ์ดูข้อมูลได้อย่างเดียว'}
            </p>
          )}
        </div>

        {visibleSections.map((s) => (
          <div key={s.id} className="mb-6">
            <h2 id={s.id} className="mb-2 scroll-mt-40 text-sm font-bold text-slate-700">
              {s.headerLabel}
            </h2>
            <div className="mb-3 flex flex-col gap-2">
              {s.topics.map((t) => (
                <TopicScoreCard
                  key={t.id}
                  topic={t}
                  existing={scoreByTopic.get(t.id)}
                  readOnly={readOnly}
                  roundId={roundId!}
                  participantId={session.participantId}
                  accentColor={s.color}
                  onSave={(draft) => handleSave(t.id, draft)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
