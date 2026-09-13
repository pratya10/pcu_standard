import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForRound } from '../lib/scoresApi'
import { fetchTeamScoresForRound, teamScoreToScore } from '../lib/teamScoresApi'
import { aggregateAll, formatAvg } from '../lib/aggregate'
import type { AssessmentRound, FullStandard, Facility, Participant, Score, TeamScore } from '../types'

export default function LiveDashboard() {
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
    async function load() {
      const { data: roundRow } = await supabase.from('assessment_rounds').select('*').eq('id', rid).single()
      if (cancelled) return
      if (!roundRow) {
        setLoading(false)
        return
      }
      const round = roundRow as AssessmentRound
      const [std, sc, { data: fac }, { data: parts }] = await Promise.all([
        loadStandardByVersionId(round.standard_version_id),
        round.scoring_mode === 'collaborative' ? fetchTeamScoresForRound(rid).then((rows) => rows.map(teamScoreToScore)) : fetchScoresForRound(rid),
        supabase.from('facilities').select('*').eq('id', round.facility_id).single(),
        supabase.from('participants').select('*').eq('round_id', rid).order('joined_at'),
      ])
      if (cancelled) return
      setRound(round)
      setStandard(std)
      setScores(sc)
      setFacility((fac as Facility) ?? null)
      setParticipants((parts as Participant[]) ?? [])
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [roundId])

  useEffect(() => {
    if (!roundId || !round) return
    const scoreTable = round.scoring_mode === 'collaborative' ? 'team_scores' : 'scores'
    const channel = supabase
      .channel(`round-${roundId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: scoreTable, filter: `round_id=eq.${roundId}` }, (payload) => {
        setScores((prev) => {
          if (payload.eventType === 'DELETE') return prev.filter((s) => s.id !== (payload.old as Score | TeamScore).id)
          const row = round.scoring_mode === 'collaborative' ? teamScoreToScore(payload.new as TeamScore) : (payload.new as Score)
          const others = prev.filter((s) => s.id !== row.id)
          return [...others, row]
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `round_id=eq.${roundId}` }, (payload) => {
        setParticipants((prev) => {
          if (payload.eventType === 'DELETE') return prev.filter((p) => p.id !== (payload.old as Participant).id)
          const row = payload.new as Participant
          const others = prev.filter((p) => p.id !== row.id)
          return [...others, row]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assessment_rounds', filter: `id=eq.${roundId}` }, (payload) => {
        setRound(payload.new as AssessmentRound)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId, round?.scoring_mode])

  const flatTopics = useMemo(() => (standard ? allTopicsFlat(standard) : []), [standard])
  const aggregates = useMemo(() => aggregateAll(flatTopics.map((t) => t.id), scores), [flatTopics, scores])
  const evaluators = participants.filter((p) => p.role !== 'viewer')

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังโหลด...</div>
  if (!round || !standard) return <div className="flex min-h-screen items-center justify-center text-red-600">ไม่พบรอบการประเมิน</div>

  const grandTotal = flatTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
  const mustFailTopics = flatTopics.filter((t) => aggregates.get(t.id)?.mustPassFinal === false)

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-24">
      <div className="mb-4">
        <p className="text-xs text-slate-400">{standard.standardVersion.name} · Live</p>
        <h1 className="text-xl font-bold text-slate-800">{round.name}</h1>
        <p className="text-sm text-slate-500">{facility?.name}</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <StatCard label="กรรมการเข้าร่วม" value={String(evaluators.length)} />
        <StatCard label="คะแนนรวม (เฉลี่ย)" value={grandTotal.toFixed(1)} />
        <StatCard label="หัวข้อไม่ผ่าน The Must" value={String(mustFailTopics.length)} tone={mustFailTopics.length ? 'danger' : 'ok'} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {participants.map((p) => (
          <span
            key={p.id}
            className={`rounded-full px-3 py-1 text-xs font-medium ${p.role === 'viewer' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}
          >
            {p.name} {p.role === 'viewer' ? '(ผู้สังเกตการณ์)' : ''}
          </span>
        ))}
      </div>

      {evaluators.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-bold text-slate-700">ตารางคะแนนรายบุคคล</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full min-w-max border-collapse text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="sticky left-0 bg-slate-50 px-3 py-2 font-medium">หัวข้อ</th>
                  {evaluators.map((p) => (
                    <th key={p.id} className="px-3 py-2 text-center font-medium">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flatTopics.map((t) => {
                  const agg = aggregates.get(t.id)
                  return (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0">
                      <td className="sticky left-0 bg-white px-3 py-2 text-slate-700">
                        <span className="font-mono text-xs text-slate-400">{t.code}</span> {t.name_th}
                      </td>
                      {evaluators.map((p) => {
                        const s = agg?.scores.find((sc) => sc.participant_id === p.id)
                        return (
                          <td key={p.id} className="px-3 py-2 text-center">
                            {!s ? (
                              <span className="text-slate-300">-</span>
                            ) : s.is_na ? (
                              <span className="font-semibold text-slate-500">N/A</span>
                            ) : (
                              <span
                                className={`font-semibold ${s.score === 2 ? 'text-emerald-600' : s.score === 1 ? 'text-amber-600' : 'text-red-600'}`}
                              >
                                {s.score}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {round.scoring_mode === 'collaborative' && (
            <p className="mt-1 text-xs text-slate-400">โหมดทีมช่วยกัน: คะแนนแต่ละหัวข้อมีชุดเดียว แสดงในคอลัมน์ของคนที่บันทึกคะแนนล่าสุด</p>
          )}
        </div>
      )}

      {standard.categories.map((cat) => {
        const catTopics = [...cat.topics, ...cat.groups.flatMap((g) => g.topics)]
        const catTotal = catTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
        return (
          <div key={cat.id} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-slate-700">
                หมวดที่ {cat.code} · {cat.name_th}
              </h2>
              <span className="text-sm font-semibold text-emerald-700">รวม {catTotal.toFixed(1)}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              {catTopics.map((t) => {
                const agg = aggregates.get(t.id)
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-slate-700">
                        <span className="font-mono text-xs text-slate-400">{t.code}</span> {t.name_th}
                      </p>
                      {round.scoring_mode !== 'collaborative' && evaluators.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {evaluators.map((p) => {
                            const s = agg?.scores.find((sc) => sc.participant_id === p.id)
                            return (
                              <span
                                key={p.id}
                                title={p.name}
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                                  !s ? 'bg-slate-100 text-slate-300' : s.is_na ? 'bg-slate-300 text-white' : s.score === 2 ? 'bg-emerald-500 text-white' : s.score === 1 ? 'bg-amber-400 text-white' : 'bg-red-500 text-white'
                                }`}
                              >
                                {!s ? '·' : s.is_na ? 'NA' : s.score}
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-800">{formatAvg(agg?.avgScore ?? null)}</p>
                      {t.must_text && (
                        <p className={`text-xs font-medium ${agg?.mustPassFinal === false ? 'text-red-600' : agg?.mustPassFinal === true ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? 'The Must: -' : agg.mustPassFinal ? 'The Must: ผ่าน' : 'The Must: ไม่ผ่าน'}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      <div className="fixed inset-x-0 bottom-0 flex justify-center border-t border-slate-200 bg-white/95 py-3 backdrop-blur">
        <Link to={`/round/${roundId}/report`} className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white">
          ดูรายงานสรุปผล →
        </Link>
      </div>
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'ok' }) {
  const color = tone === 'danger' ? 'text-red-600' : tone === 'ok' ? 'text-emerald-600' : 'text-slate-800'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
