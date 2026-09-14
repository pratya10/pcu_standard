import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { loadStandardByVersionId, allTopicsFlat } from '../lib/loadStandard'
import { fetchScoresForRound } from '../lib/scoresApi'
import { fetchTeamScoresForRound, teamScoreToScore } from '../lib/teamScoresApi'
import { aggregateAll, formatAvg } from '../lib/aggregate'
import { subscribeToPresenceListenOnly, type PresenceInfo } from '../lib/presence'
import type { AssessmentRound, FullStandard, Facility, Participant, Score, TeamScore } from '../types'

export default function LiveDashboard() {
  const { roundId } = useParams<{ roundId: string }>()
  const [round, setRound] = useState<AssessmentRound | null>(null)
  const [facility, setFacility] = useState<Facility | null>(null)
  const [standard, setStandard] = useState<FullStandard | null>(null)
  const [scores, setScores] = useState<Score[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [online, setOnline] = useState<PresenceInfo[]>([])
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

  useEffect(() => {
    if (!roundId) return
    return subscribeToPresenceListenOnly(roundId, setOnline)
  }, [roundId])

  const flatTopics = useMemo(() => (standard ? allTopicsFlat(standard) : []), [standard])
  const aggregates = useMemo(() => aggregateAll(flatTopics.map((t) => t.id), scores), [flatTopics, scores])
  const evaluators = participants.filter((p) => p.role !== 'viewer')
  const participantNameById = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants])
  const collaborative = round?.scoring_mode === 'collaborative'

  if (loading) return <div className="flex min-h-screen items-center justify-center text-slate-400">กำลังโหลด...</div>
  if (!round || !standard) return <div className="flex min-h-screen items-center justify-center text-red-600">ไม่พบรอบการประเมิน</div>

  const grandTotal = flatTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
  const mustFailTopics = flatTopics.filter((t) => aggregates.get(t.id)?.mustPassFinal === false)

  return (
    <div className="w-full px-4 py-6 pb-24 md:px-8">
      <div className="mb-4">
        <p className="text-xs text-slate-400">{standard.standardVersion.name} · Live</p>
        <h1 className="text-xl font-bold text-slate-800">{round.name}</h1>
        <p className="text-sm text-slate-500">{facility?.name}</p>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="กรรมการเข้าร่วม" value={String(evaluators.length)} />
        <StatCard label="คะแนนรวม (เฉลี่ย)" value={grandTotal.toFixed(1)} />
        <StatCard label="หัวข้อไม่ผ่านมาตรฐานพื้นฐาน" value={String(mustFailTopics.length)} tone={mustFailTopics.length ? 'danger' : 'ok'} />
      </div>

      {online.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-400">ออนไลน์ตอนนี้:</span>
          {online.map((p) => (
            <span key={p.participantId} className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              {p.name}
            </span>
          ))}
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        {participants.map((p) => (
          <span
            key={p.id}
            className={`rounded-full px-3 py-1 text-xs font-medium ${p.role === 'viewer' ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}`}
          >
            {p.name} {p.role === 'viewer' ? '(ผู้สังเกตการณ์)' : ''}
          </span>
        ))}
      </div>

      {standard.categories.map((cat) => {
        const catTopics = [...cat.topics, ...cat.groups.flatMap((g) => g.topics)]
        const catTotal = catTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.avgScore ?? 0), 0)
        const catPass = catTopics.every((t) => aggregates.get(t.id)?.mustPassFinal !== false)
        return (
          <div key={cat.id} className="mb-6">
            <h2 className="mb-2 text-sm font-bold text-[#2E74B5]">
              หมวดที่ {cat.code} · {cat.name_th}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-dotted border-slate-300 text-left text-xs text-slate-800">
                    <th className="py-1 pr-3">หัวข้อ</th>
                    {collaborative ? (
                      <>
                        <th className="w-[17%] py-1 pr-3 text-center">มาตรฐานพื้นฐาน</th>
                        <th className="w-[17%] py-1 pr-3 text-center">การพัฒนาต่อเนื่อง</th>
                      </>
                    ) : (
                      evaluators.map((p) => (
                        <th key={p.id} className="whitespace-nowrap py-1 pr-3 text-center">
                          {p.name}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {catTopics.map((t) => {
                    const agg = aggregates.get(t.id)
                    const updaterName = collaborative ? participantNameById.get(agg?.scores[0]?.participant_id ?? '') : null
                    return (
                      <Fragment key={t.id}>
                        <tr className="border-b border-dotted border-slate-300">
                          <td className="py-1 pr-3">
                            <span className="font-mono text-xs text-[#2E74B5]">{t.code}</span> {t.name_th}
                          </td>
                          {collaborative ? (
                            <>
                              <td className="py-1 pr-3 text-center">
                                {agg?.mustPassFinal === null || agg?.mustPassFinal === undefined ? '-' : agg.mustPassFinal ? 'ผ่าน' : 'ไม่ผ่าน'}
                              </td>
                              <td className="py-1 pr-3 text-center font-semibold">{formatAvg(agg?.avgScore ?? null)}</td>
                            </>
                          ) : (
                            evaluators.map((p) => {
                              const s = agg?.scores.find((sc) => sc.participant_id === p.id)
                              return (
                                <td key={p.id} className="py-1 pr-3 text-center">
                                  {!s ? (
                                    <span className="text-slate-300">-</span>
                                  ) : s.is_na ? (
                                    <span className="font-semibold text-slate-400">N/A</span>
                                  ) : (
                                    <span className={`font-semibold ${s.score === 2 ? 'text-emerald-600' : s.score === 1 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {s.score}
                                    </span>
                                  )}
                                </td>
                              )
                            })
                          )}
                        </tr>
                        {collaborative && updaterName && (
                          <tr className="border-b border-dotted border-slate-300">
                            <td colSpan={3} className="pb-1 pl-2 text-xs text-slate-400">
                              โดย {updaterName}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  <tr className="font-semibold text-slate-800">
                    <td className="py-1 pr-3">รวม</td>
                    {collaborative ? (
                      <>
                        <td className="py-1 pr-3 text-center">{catPass ? 'ผ่าน' : 'ไม่ผ่าน'}</td>
                        <td className="py-1 pr-3 text-center">{catTotal.toFixed(1)}</td>
                      </>
                    ) : (
                      evaluators.map((p) => {
                        const total = catTopics.reduce((sum, t) => sum + (aggregates.get(t.id)?.scores.find((sc) => sc.participant_id === p.id)?.score ?? 0), 0)
                        return (
                          <td key={p.id} className="py-1 pr-3 text-center">
                            {total.toFixed(1)}
                          </td>
                        )
                      })
                    )}
                  </tr>
                </tbody>
              </table>
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
