import { supabase } from './supabaseClient'
import { getParticipantCredentials, rpcErrorMessage, unwrapRpc } from './participantSession'
import type { ItemNote, Score, ScoreValue, TeamComment, TeamItemNote, TeamScore, TeamScoreAudit, TeamScoreAuditField } from '../types'

// Team comments are stored as JSON.stringify(TeamComment[]) in what's
// otherwise a plain text column, so old (pre-edit-feature) rounds whose
// comment is still a plain free-text log fail to parse as JSON — that
// fallback surfaces the whole old blob as a single read-only legacy entry
// instead of losing it.
export function parseTeamComments(raw: string | null | undefined): TeamComment[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as TeamComment[]
  } catch {
    // not JSON — legacy plain-text append-log, fall through
  }
  return [{ id: 'legacy', authorId: null, author: '', text: raw, createdAt: '' }]
}

export function serializeTeamComments(comments: TeamComment[]): string {
  return JSON.stringify(comments)
}

function formatEntryTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function commentsToText(comments: TeamComment[]): string {
  return comments.map((c) => (c.author ? `[${c.author}${c.createdAt ? ' · ' + formatEntryTime(c.createdAt) : ''}] ${c.text}` : c.text)).join('\n')
}

// Lets a collaborative round's single shared team_scores row flow through
// the exact same aggregate/report/docx code that 'average' mode already
// uses for its per-participant `scores` rows — aggregating an array with
// just this one synthetic entry naturally reduces to "use this value as-is".
// The structured, editable comment lists are flattened back into the same
// "[name · time] text" lines the reports already know how to render.
export function teamScoreToScore(ts: TeamScore): Score {
  const itemNotes: Record<string, ItemNote> = {}
  for (const [itemId, note] of Object.entries(ts.item_notes)) {
    const comments = note.comments && note.comments.length > 0 ? note.comments : parseTeamComments(note.comment)
    itemNotes[itemId] = { checked: note.checked, comment: commentsToText(comments) }
  }
  return {
    id: ts.id,
    round_id: ts.round_id,
    topic_id: ts.topic_id,
    participant_id: ts.updated_by ?? 'team',
    score: ts.score,
    is_na: ts.is_na,
    must_pass: ts.must_pass,
    comment: commentsToText(parseTeamComments(ts.comment)),
    evidence_checked: [],
    item_notes: itemNotes,
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
  itemNotes: Record<string, TeamItemNote>
}

// `attribution` says which specific control this save came from, so only
// that field's "who set this" column gets stamped — a comment-only or
// item-only save shouldn't silently reassign the CI score's or Must
// result's attribution to whoever happened to save last.
// กรรมการบันทึกคะแนนทีมผ่าน RPC pcu_standard.save_team_score · attribution.ci = ผู้เรียกเป็นผู้ให้คะแนน CI ล่าสุด
// attribution.must = ผู้เรียกเป็นผู้ตัดสิน Must (ฐานข้อมูลบันทึกเวลาให้เอง)
export async function upsertTeamScore(
  draft: TeamScoreDraft,
  participantId: string,
  attribution: { ci?: boolean; must?: boolean } = {},
): Promise<TeamScore> {
  const creds = getParticipantCredentials(draft.roundId)
  if (!creds || creds.participantId !== participantId) throw new Error(rpcErrorMessage('FORBIDDEN'))
  const fields: Record<string, unknown> = {
    score: draft.isNa ? 0 : draft.score,
    is_na: draft.isNa,
    comment: draft.comment || null,
    item_notes: draft.itemNotes,
    attribute_ci: !!attribution.ci,
  }
  // must_pass ส่งเฉพาะเมื่อผู้เรียกเป็นผู้ตัดสิน Must เพื่อไม่ให้ชื่อผู้ตัดสินเดิมถูกแทนที่
  if (attribution.must) fields.must_pass = draft.mustPass
  const { data, error } = await supabase.rpc('save_team_score', {
    p_join_code: creds.joinCode,
    p_participant_id: creds.participantId,
    p_device_key: creds.deviceKey,
    p_topic_id: draft.topicId,
    p_fields: fields,
  })
  return unwrapRpc<{ ok: boolean; team_score: TeamScore }>(data, error).team_score
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
  const creds = getParticipantCredentials(params.roundId)
  if (!creds || creds.participantId !== params.participantId) throw new Error(rpcErrorMessage('FORBIDDEN'))
  const { data, error } = await supabase.rpc('log_team_score_audit', {
    p_join_code: creds.joinCode,
    p_participant_id: creds.participantId,
    p_device_key: creds.deviceKey,
    p_topic_id: params.topicId,
    p_field: params.field,
    p_old_value: params.oldValue ?? null,
    p_new_value: params.newValue ?? null,
    p_item_id: params.itemId ?? null,
  })
  unwrapRpc(data, error)
}

export function subscribeToTeamScores(roundId: string, onChange: (row: TeamScore, eventType: string) => void) {
  const channel = supabase
    .channel(`team-scores-${roundId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'pcu_standard', table: 'team_scores', filter: `round_id=eq.${roundId}` },
      (payload) => {
        onChange((payload.new ?? payload.old) as TeamScore, payload.eventType)
      },
    )
    .subscribe()
  return () => {
    supabase.removeChannel(channel)
  }
}
