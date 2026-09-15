import { supabase } from './supabaseClient'

export async function updateParticipantDetails(id: string, name: string, civilServiceLevel: string): Promise<void> {
  const { error } = await supabase
    .from('participants')
    .update({ name, civil_service_level: civilServiceLevel.trim() || null })
    .eq('id', id)
  if (error) throw error
}

export type MergeParticipantsResult = {
  moved_scores: number
  resolved_conflicts: number
}

/** Folds `mergeId`'s scores and attribution into `keepId`, then deletes `mergeId`. */
export async function mergeParticipants(keepId: string, mergeId: string): Promise<MergeParticipantsResult> {
  const { data, error } = await supabase.rpc('merge_participants', { keep_id: keepId, merge_id: mergeId })
  if (error) throw error
  return data as MergeParticipantsResult
}
