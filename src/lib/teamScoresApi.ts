import { supabase } from './supabaseClient'
import type { ItemNote, Score, ScoreValue, TeamScore, TeamScoreAudit, TeamScoreAuditField } from '../types'

// Lets a collaborative round's single shared team_scores row flow through
// the exact same aggregate/report/docx code that 'average' mode already
// uses for its per-participant `scores` rows — aggregating an array with
// just this one synthetic entry naturally reduces to "use this value as-is".
export function teamScoreToScore(ts: TeamScore): Score {
  return {
    id: ts.id,
    round_id: ts.round_id,
    topic_id: ts.topic_id,
    participant_id: ts.updated_by ?? 'team',
    score: ts.score,
    is_na: ts.is_na,
    must_pass: ts.must_pass,
    comment: ts.comment,
    evidence_checked: [],
    item_notes: ts.item_notes,
    updated_at: ts.updated_at,
  }
}

export async function fetchTeamScoresForRound(roundId: string): Promise<TeamScore[]> {
  const { data, error } = await supabase.from('team_scores').select('*').eq('round_id', roundId)
  if (error) throw error
  return data as TeamScore[]
}

export async function fetchTeamScoreAuditForRound(roundId: string): Promise<TeamScoreAudit[]> {
  const { data, error } = await supabase
    .from('team_score_audit')
    .select('*')
    .eq('round_id', roundId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as TeamScoreAudit[]
}

export type TeamScoreDraft = {
  roundId: string
  topicId: string
  score: ScoreValue | null
  isNa: boolean
  mustPass: boolean | null
  comment: string
  itemNotes: Record<string, ItemNote>
}

export async function upsertTeamScore(draft: TeamScoreDraft, participantId: string): Promise<TeamScore> {
  const { data, error } = await supabase
    .from('team_scores')
    .upsert(
      {
        round_id: draft.roundId,
        topic_id: draft.topicId,
        score: draft.isNa ? null : draft.score,
        is_na: draft.isNa,
        must_pass: draft.mustPass,
        comment: draft.comment || null,
        item_notes: draft.itemNotes,
        updated_by: participantId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'round_id,topic_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data as TeamScore
}

export async function logTeamScoreOverwrite(params: {
  roundId: string
  topicId: string
  itemId?: string | null
  field: TeamScoreAuditField
  participantId: string
  oldValue: unknown
  newValue: unknown
}) {
  const { error } = await supabase.from('team_score_audit').insert({
    round_id: params.roundId,
    topic_id: params.topicId,
    item_id: params.itemId ?? null,
    field: params.field,
    participant_id: params.participantId,
    old_value: params.oldValue,
    new_value: params.newValue,
  })
  if (error) throw error
}

export function subscribeToTeamScores(roundId: string, onChange: (row: TeamScore, eventType: string) => void) {
  const channel = supabase
    .channel(`team-scores-${roundId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'team_scores', filter: `round_id=eq.${roundId}` },
      (payload) => {
        onChange((payload.new ?? payload.old) as TeamScore, payload.eventType)
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
