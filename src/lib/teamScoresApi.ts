import { supabase } from './supabaseClient'
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
export async function upsertTeamScore(
  draft: TeamScoreDraft,
  participantId: string,
  attribution: { ci?: boolean; must?: boolean } = {},
): Promise<TeamScore> {
  const payload: Record<string, unknown> = {
    round_id: draft.roundId,
    topic_id: draft.topicId,
    score: draft.isNa ? 0 : draft.score,
    is_na: draft.isNa,
    must_pass: draft.mustPass,
    comment: draft.comment || null,
    item_notes: draft.itemNotes,
    updated_at: new Date().toISOString(),
  }
  if (attribution.ci) payload.updated_by = participantId
  if (attribution.must) {
    payload.must_pass_updated_by = participantId
    payload.must_pass_updated_at = payload.updated_at
  }

  const { data, error } = await supabase.from('team_scores').upsert(payload, { onConflict: 'round_id,topic_id' }).select().single()
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
