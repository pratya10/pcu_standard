import { supabase } from './supabaseClient'
import { getParticipantCredentials, rpcErrorMessage, unwrapRpc } from './participantSession'
import type { ItemNote, Score, ScoreValue } from '../types'

export type ScoreDraft = {
  roundId: string
  topicId: string
  participantId: string
  score: ScoreValue | null
  isNa: boolean
  mustPass: boolean | null
  comment: string
  evidenceChecked: string[]
  itemNotes: Record<string, ItemNote>
}

// กรรมการบันทึกคะแนนผ่าน RPC pcu_standard.save_score (ตรวจรหัสเข้าร่วม + ผู้เข้าร่วม + กุญแจเครื่อง)
export async function upsertScore(draft: ScoreDraft): Promise<Score> {
  const creds = getParticipantCredentials(draft.roundId)
  if (!creds || creds.participantId !== draft.participantId) throw new Error(rpcErrorMessage('FORBIDDEN'))
  const { data, error } = await supabase.rpc('save_score', {
    p_join_code: creds.joinCode,
    p_participant_id: creds.participantId,
    p_device_key: creds.deviceKey,
    p_topic_id: draft.topicId,
    p_fields: {
      score: draft.isNa ? 0 : draft.score,
      is_na: draft.isNa,
      must_pass: draft.mustPass,
      comment: draft.comment || null,
      evidence_checked: draft.evidenceChecked,
      item_notes: draft.itemNotes,
    },
  })
  return unwrapRpc<{ ok: boolean; score: Score }>(data, error).score
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
