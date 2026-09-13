import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForParticipant, upsertScore } from '../lib/scoresApi'
import { fetchTeamScoresForRound, subscribeToTeamScores } from '../lib/teamScoresApi'
import { subscribeToPresence, type PresenceInfo } from '../lib/presence'
import { getParticipantSession } from '../lib/participantSession'
import type { AssessmentRound, FullStandard, Participant, Score, TeamScore } from '../types'
import TopicScoreCard from '../components/TopicScoreCard'
import TeamTopicScoreCard from '../components/TeamTopicScoreCard'
import Icon from '../components/Icon'

type SectionTopic = FullStandard['categories'][number]['topics'][number]

type Summary = { ciAchieved: number; ciMax: number; ciAnswered: number; mustPass: number; mustTotal: number; mustAnswered: number }

type Block = { id: string; navLabel: string; headerLabel: string; color: string; topics: SectionTopic[] }
type TopSection = Block & { subSections: Block[] }

const RAINBOW = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6']

function isComplete(s: Summary, topicCount: number) {
  const mustOk = s.mustTotal === 0 || (s.mustAnswered === s.mustTotal && s.mustPass === s.mustTotal)
  const ciOk = topicCount === 0 || (s.ciAnswered === topicCount && s.ciMax > 0 && s.ciAchieved === s.ciMax)
  return mustOk && ciOk && topicCount > 0
}

export default function ScoreForm() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [standard, setStandard] = useState<FullStandard | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [teamScores, setTeamScores] = useState<TeamScore[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [navOpen, setNavOpen] = useState(false)
  const [online, setOnline] = useState<PresenceInfo[]>([])

  const session = roundId ? getParticipantSession(roundId) : null
  const collaborative = round?.scoring_mode === 'collaborative'

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
      const round = roundRow as AssessmentRound
      const [std, parts] = await Promise.all([
        loadStandardByVersionId(round.standard_version_id),
        supabase.from('participants').select('*').eq('round_id', rid).order('joined_at'),
      ])
      setParticipants((parts.data as Participant[]) ?? [])
      if (round.scoring_mode === 'collaborative') {
        setTeamScores(await fetchTeamScoresForRound(rid))
      } else {
        setScores(await fetchScoresForParticipant(rid, session!.participantId))
      }
      setRound(round)
      setStandard(std)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId])

  useEffect(() => {
    if (!roundId || !collaborative) return
    const unsubscribe = subscribeToTeamScores(roundId, (row, eventType) => {
      setTeamScores((prev) => {
        if (eventType === 'DELETE') return prev.filter((s) => s.id !== row.id)
        const others = prev.filter((s) => s.id !== row.id)
        return [...others, row]
      })
    })
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, collaborative])

  useEffect(() => {
    if (!roundId || !session) return
    const unsubscribe = subscribeToPresence(roundId, { participantId: session.participantId, name: session.name, role: session.role }, setOnline)
    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, session?.participantId])

  const flatTopics = useMemo(() => (standard ? allTopicsFlat(standard) : []), [standard])
  const scoreByTopic = useMemo(() => new Map(scores.map((s) => [s.topic_id, s])), [scores])
  const teamScoreByTopic = useMemo(() => new Map(teamScores.map((s) => [s.topic_id, s])), [teamScores])
  const participantNameById = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants])

  function resultFor(topicId: string) {
    if (collaborative) {
      const s = teamScoreByTopic.get(topicId)
      return s ? { score: s.score, isNa: s.is_na, mustPass: s.must_pass } : undefined
    }
    const s = scoreByTopic.get(topicId)
    return s ? { score: s.score, isNa: s.is_na, mustPass: s.must_pass } : undefined
  }

  const answeredCount = flatTopics.filter((t) => {
    const r = resultFor(t.id)
    return !!r && (r.isNa || r.score !== null)
  }).length

  // Rainbow-ordered sections for the jump nav: หมวด 1, หมวด 2 (with 2.1-2.4
  // as a submenu), หมวด 3.
  const sections = useMemo<TopSection[]>(() => {
    const list: TopSection[] = []
    let i = 0
    for (const cat of standard?.categories ?? []) {
      if (cat.groups.length === 0) {
        if (cat.topics.length > 0) {
          list.push({
            id: `sec-cat-${cat.id}`,
            navLabel: `หมวด ${cat.code}`,
            headerLabel: `หมวดที่ ${cat.code} · ${cat.name_th}`,
            color: RAINBOW[i % RAINBOW.length],
            topics: cat.topics,
            subSections: [],
          })
          i++
        }
      } else {
        const subSections = cat.groups.map((g) => {
          const sub = {
            id: `sec-group-${g.id}`,
            navLabel: `${g.code} ${g.name_th}`,
            headerLabel: `${g.code} ${g.name_th}`,
            color: RAINBOW[i % RAINBOW.length],
            topics: g.topics,
          }
          i++
          return sub
        })
        list.push({
          id: `sec-cat-${cat.id}`,
          navLabel: `หมวด ${cat.code}`,
          headerLabel: `หมวดที่ ${cat.code} · ${cat.name_th}`,
          color: '#64748b',
          topics: cat.topics,
          subSections,
        })
      }
    }
    return list
  }, [standard])

  function summarize(topics: SectionTopic[]): Summary {
    let ciAchieved = 0
    let ciMax = 0
    let ciAnswered = 0
    let mustPass = 0
    let mustTotal = 0
    let mustAnswered = 0
    for (const t of topics) {
      const s = resultFor(t.id)
      if (!s?.isNa) {
        ciAchieved += s?.score ?? 0
        ciMax += 2
      }
      if (s && (s.isNa || s.score !== null)) ciAnswered++
      if (t.must_text) {
        mustTotal++
        if (s?.mustPass === true) mustPass++
        if (s?.mustPass !== null && s?.mustPass !== undefined) mustAnswered++
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

  const allBlocks: Block[] = sections.flatMap((top) => (top.subSections.length > 0 ? top.subSections : [top]))
  const visibleBlocks: Block[] = activeSectionId
    ? (() => {
        const top = sections.find((s) => s.id === activeSectionId && s.subSections.length > 0)
        if (top) return top.subSections
        return allBlocks.filter((b) => b.id === activeSectionId)
      })()
    : allBlocks

  function selectSection(id: string) {
    setActiveSectionId((prev) => (prev === id ? null : id))
    setNavOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function goToTopic(topicId: string, parentBlockId: string) {
    setActiveSectionId(parentBlockId)
    setNavOpen(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(`topic-${topicId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
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

  function handleTeamSaved(updated: TeamScore) {
    setTeamScores((prev) => {
      const others = prev.filter((s) => s.id !== updated.id)
      return [...others, updated]
    })
  }

  function NavDot({ color, complete }: { color: string; complete: boolean }) {
    if (complete) return <Icon name="check_circle" filled className="!text-base shrink-0 text-emerald-600" />
    return <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
  }

  function TopicNavRow({ topic, parentBlockId }: { topic: SectionTopic; parentBlockId: string }) {
    const r = resultFor(topic.id)
    const hasMust = !!topic.must_text
    const mustLabel = !hasMust ? null : r?.mustPass === true ? 'ผ่าน' : r?.mustPass === false ? 'ไม่ผ่าน' : '-'
    const ciLabel = r?.isNa ? 'NA' : (r?.score ?? '-')
    const mustClass = mustLabel === 'ผ่าน' ? 'text-emerald-600' : mustLabel === 'ไม่ผ่าน' ? 'text-red-600' : 'text-slate-400'
    // Matches the CI score buttons' own colors (SCORE_COLOR in TopicScoreCard): 0=amber, 1=orange, 2=emerald, NA=sky.
    const ciClass =
      ciLabel === 0
        ? 'text-amber-600'
        : ciLabel === 1
          ? 'text-orange-600'
          : ciLabel === 2
            ? 'text-emerald-600'
            : ciLabel === 'NA'
              ? 'text-sky-600'
              : 'text-slate-400'
    return (
      <button
        type="button"
        onClick={() => goToTopic(topic.id, parentBlockId)}
        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-bold text-slate-600 hover:bg-slate-50"
      >
        <span className="truncate font-mono font-medium text-slate-400">{topic.code}</span>
        <span className="flex shrink-0 items-center gap-1">
          {mustLabel !== null && <span className={mustClass}>{mustLabel}</span>}
          <span className={ciClass}>| {ciLabel}</span>
        </span>
      </button>
    )
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
      {sections.map((top) => {
        const hasSub = top.subSections.length > 0
        const topicsForSummary = hasSub ? top.subSections.flatMap((s) => s.topics) : top.topics
        const summary = summarize(topicsForSummary)
        const active = activeSectionId === top.id
        const isOpen = expanded.has(top.id)
        return (
          <div key={top.id}>
            <button
              type="button"
              onClick={() => toggleExpanded(top.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <NavDot color={top.color} complete={isComplete(summary, topicsForSummary.length)} />
              <span className="flex-1 truncate">{top.navLabel}</span>
              <span className="text-slate-300">{isOpen ? '▾' : '▸'}</span>
            </button>
            {isOpen && (
              <div className="ml-3 flex flex-col gap-1 border-l border-slate-100 pl-2">
                {hasSub
                  ? top.subSections.map((sub) => {
                      const subSummary = summarize(sub.topics)
                      const subOpen = expanded.has(sub.id)
                      const subActive = activeSectionId === sub.id
                      return (
                        <div key={sub.id}>
                          <button
                            type="button"
                            onClick={() => toggleExpanded(sub.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs font-medium ${subActive ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                          >
                            <NavDot color={sub.color} complete={isComplete(subSummary, sub.topics.length)} />
                            <span className="flex-1 truncate">{sub.navLabel}</span>
                            <span className="text-slate-300">{subOpen ? '▾' : '▸'}</span>
                          </button>
                          {subOpen && (
                            <div className="ml-3 flex flex-col border-l border-slate-100 pl-2">
                              {sub.topics.map((t) => (
                                <TopicNavRow key={t.id} topic={t} parentBlockId={sub.id} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })
                  : top.topics.map((t) => <TopicNavRow key={t.id} topic={t} parentBlockId={top.id} />)}
              </div>
            )}
          </div>
        )
      })}

      <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
        <Link to={`/round/${roundId}/live`} className="rounded-lg px-2 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">
          ดูคะแนนรวม (Real-time)
        </Link>
        <Link
          to={`/round/${roundId}/report?print=summary`}
          className="rounded-lg px-2 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          รายงานแบบสรุป (PDF)
        </Link>
        <Link
          to={`/round/${roundId}/report?print=detailed`}
          className="rounded-lg px-2 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          รายงานฉบับเต็ม (PDF)
        </Link>
        <Link to="/admin" className="rounded-lg px-2 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">
          หน้าแอดมิน
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex w-full gap-4 px-4 py-6 pb-20">
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
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-400">
            <Icon name="save" className="!text-sm" /> Save อัตโนมัติ
            {collaborative && (
              <>
                {' | '}
                <Icon name="groups" className="!text-sm" /> การประเมินแบบทีม
              </>
            )}
          </p>
          {online.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-400">ออนไลน์ตอนนี้:</span>
              {online.map((p) => (
                <span
                  key={p.participantId}
                  className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  {p.name}
                </span>
              ))}
            </div>
          )}
          {readOnly && (
            <p className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-500">
              {round.status === 'completed' ? 'รอบนี้ปิดรับคะแนนแล้ว (โหมดดูอย่างเดียว)' : 'ผู้สังเกตการณ์ดูข้อมูลได้อย่างเดียว'}
            </p>
          )}
        </div>

        {visibleBlocks.map((s) => (
          <div key={s.id} className="mb-6">
            <h2 id={s.id} className="mb-2 scroll-mt-40 text-sm font-bold text-slate-700">
              {s.headerLabel}
            </h2>
            <div className="mb-3 flex flex-col gap-2">
              {s.topics.map((t) => (
                <div key={t.id} id={`topic-${t.id}`} className="scroll-mt-40">
                  {collaborative ? (
                    <TeamTopicScoreCard
                      topic={t}
                      teamScore={teamScoreByTopic.get(t.id)}
                      readOnly={readOnly}
                      roundId={roundId!}
                      participantId={session.participantId}
                      participantName={session.name}
                      participantNameById={participantNameById}
                      accentColor={s.color}
                      onSaved={handleTeamSaved}
                    />
                  ) : (
                    <TopicScoreCard
                      topic={t}
                      existing={scoreByTopic.get(t.id)}
                      readOnly={readOnly}
                      roundId={roundId!}
                      participantId={session.participantId}
                      accentColor={s.color}
                      onSave={(draft) => handleSave(t.id, draft)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
