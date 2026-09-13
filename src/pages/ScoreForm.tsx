import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForParticipant, upsertScore } from '../lib/scoresApi'
import { getParticipantSession } from '../lib/participantSession'
import type { AssessmentRound, FullStandard, Score } from '../types'
import TopicScoreCard from '../components/TopicScoreCard'

export default function ScoreForm() {
  const { roundId } = useParams<{ roundId: string }>()
  const navigate = useNavigate()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [standard, setStandard] = useState<FullStandard | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const sections = useMemo(() => {
    const list: { id: string; label: string; color: string }[] = []
    const rainbow = ['#e11d48', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6']
    let i = 0
    for (const cat of standard?.categories ?? []) {
      if (cat.topics.length > 0) {
        list.push({ id: `sec-cat-${cat.id}`, label: `หมวด ${cat.code}`, color: rainbow[i % rainbow.length] })
        i++
      }
      for (const g of cat.groups) {
        list.push({ id: `sec-group-${g.id}`, label: `${g.code} ${g.name_th}`, color: rainbow[i % rainbow.length] })
        i++
      }
    }
    return list
  }, [standard])
  const colorById = useMemo(() => new Map(sections.map((s) => [s.id, s.color])), [sections])

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

  const readOnly = round.status === 'completed'

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  return (
    <div className="mx-auto flex max-w-5xl gap-4 px-4 py-6 pb-20">
      <nav className="sticky top-4 hidden h-fit w-48 shrink-0 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 md:flex">
        <p className="mb-1 text-xs font-semibold text-slate-400">หมวดหมู่</p>
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => scrollToSection(s.id)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="truncate">{s.label}</span>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-10 mb-4 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
          <h1 className="text-lg font-bold text-slate-800">{round.name}</h1>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-slate-500">
              {session.name} · {session.role === 'evaluator' ? 'กรรมการประเมิน' : session.role}
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
          <Link to={`/round/${roundId}/live`} className="mt-2 inline-block text-xs text-emerald-700 underline">
            ดูคะแนนรวมแบบ Real-time →
          </Link>
          {readOnly && <p className="mt-2 rounded-lg bg-slate-100 p-2 text-xs text-slate-500">รอบนี้ปิดรับคะแนนแล้ว (โหมดดูอย่างเดียว)</p>}

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: s.color }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {standard.categories.map((cat) => (
          <div key={cat.id} className="mb-6">
            {cat.topics.length > 0 && (
              <>
                <h2 id={`sec-cat-${cat.id}`} className="mb-2 scroll-mt-40 text-sm font-bold text-slate-700">
                  หมวดที่ {cat.code} · {cat.name_th}
                </h2>
                <div className="mb-3 flex flex-col gap-2">
                  {cat.topics.map((t, i) => (
                    <TopicScoreCard
                      key={t.id}
                      topic={t}
                      index={i + 1}
                      existing={scoreByTopic.get(t.id)}
                      readOnly={readOnly}
                      roundId={roundId!}
                      participantId={session.participantId}
                      accentColor={colorById.get(`sec-cat-${cat.id}`)}
                      onSave={(draft) => handleSave(t.id, draft)}
                    />
                  ))}
                </div>
              </>
            )}

            {cat.groups.map((g) => (
              <div key={g.id} className="mb-3">
                <h3 id={`sec-group-${g.id}`} className="mb-2 scroll-mt-40 text-xs font-semibold text-slate-500">
                  {g.code} {g.name_th}
                </h3>
                <div className="flex flex-col gap-2">
                  {g.topics.map((t, i) => (
                    <TopicScoreCard
                      key={t.id}
                      topic={t}
                      index={i + 1}
                      existing={scoreByTopic.get(t.id)}
                      readOnly={readOnly}
                      roundId={roundId!}
                      participantId={session.participantId}
                      accentColor={colorById.get(`sec-group-${g.id}`)}
                      onSave={(draft) => handleSave(t.id, draft)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
