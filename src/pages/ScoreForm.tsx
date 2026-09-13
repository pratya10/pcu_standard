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
    })
    setScores((prev) => {
      const others = prev.filter((s) => s.topic_id !== topicId)
      return [...others, saved]
    })
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-20">
      <div className="sticky top-0 z-10 mb-4 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <p className="text-xs text-slate-400">{standard.standardVersion.name}</p>
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
      </div>

      {standard.categories.map((cat) => (
        <div key={cat.id} className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-slate-700">
            หมวดที่ {cat.code} · {cat.name_th}
          </h2>

          {cat.topics.length > 0 && (
            <div className="mb-3 flex flex-col gap-2">
              {cat.topics.map((t, i) => (
                <TopicScoreCard
                  key={t.id}
                  topic={t}
                  index={i + 1}
                  existing={scoreByTopic.get(t.id)}
                  readOnly={readOnly}
                  onSave={(draft) => handleSave(t.id, draft)}
                />
              ))}
            </div>
          )}

          {cat.groups.map((g) => (
            <div key={g.id} className="mb-3">
              <h3 className="mb-2 text-xs font-semibold text-slate-500">
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
                    onSave={(draft) => handleSave(t.id, draft)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
