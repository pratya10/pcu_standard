import type { Score } from '../types'

export type TopicAggregate = {
  topicId: string
  scores: Score[]
  nScored: number
  nNa: number
  avgScore: number | null // average of 0/1/2 among non-NA scores
  mustPassCount: number
  mustFailCount: number
  mustAnsweredCount: number
  mustPassFinal: boolean | null // majority vote; null if nobody has answered yet
}

export function aggregateForTopic(topicId: string, allScores: Score[]): TopicAggregate {
  const scores = allScores.filter((s) => s.topic_id === topicId)
  const scored = scores.filter((s) => !s.is_na && s.score !== null)
  const naCount = scores.filter((s) => s.is_na).length
  const avgScore = scored.length ? scored.reduce((sum, s) => sum + (s.score as number), 0) / scored.length : null

  const mustAnswered = scores.filter((s) => s.must_pass !== null && s.must_pass !== undefined)
  const mustPassCount = mustAnswered.filter((s) => s.must_pass === true).length
  const mustFailCount = mustAnswered.filter((s) => s.must_pass === false).length
  const mustPassFinal = mustAnswered.length === 0 ? null : mustPassCount / mustAnswered.length >= 0.5

  return {
    topicId,
    scores,
    nScored: scored.length,
    nNa: naCount,
    avgScore,
    mustPassCount,
    mustFailCount,
    mustAnsweredCount: mustAnswered.length,
    mustPassFinal,
  }
}

export function aggregateAll(topicIds: string[], allScores: Score[]) {
  const map = new Map<string, TopicAggregate>()
  for (const id of topicIds) map.set(id, aggregateForTopic(id, allScores))
  return map
}

export function formatAvg(avg: number | null) {
  if (avg === null) return '—'
  return avg.toFixed(2)
}
