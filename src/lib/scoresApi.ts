import { supabase } from './supabaseClient'
import type { Score, ScoreValue } from '../types'

export type ScoreDraft = {
  roundId: string
  topicId: string
  participantId: string
  score: ScoreValue | null
  isNa: boolean
  mustPass: boolean | null
  comment: string
  evidenceChecked: string[]
}

export async function upsertScore(draft: ScoreDraft): Promise<Score> {
  const { data, error } = await supabase
    .from('scores')
    .upsert(
      {
        round_id: draft.roundId,
        topic_id: draft.topicId,
        participant_id: draft.participantId,
        score: draft.isNa ? null : draft.score,
        is_na: draft.isNa,
        must_pass: draft.mustPass,
        comment: draft.comment || null,
        evidence_checked: draft.evidenceChecked,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'round_id,topic_id,participant_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as Score
}

export async function fetchScoresForParticipant(roundId: string, participantId: string) {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('round_id', roundId)
    .eq('participant_id', participantId)
  if (error) throw error
  return data as Score[]
}

export async function fetchScoresForRound(roundId: string) {
  const { data, error } = await supabase.from('scores').select('*').eq('round_id', roundId)
  if (error) throw error
  return data as Score[]
}
