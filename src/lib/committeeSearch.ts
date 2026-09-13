import { supabase } from './supabaseClient'
import type { CommitteeMember } from '../types'

export async function searchCommitteeMembers(query: string): Promise<CommitteeMember[]> {
  const { data, error } = await supabase
    .from('committee_members')
    .select('*')
    .ilike('name', `%${query}%`)
    .order('name')
    .limit(8)
  if (error) throw error
  return data as CommitteeMember[]
}

export async function updateCommitteeMember(id: string, patch: Partial<CommitteeMember>) {
  const { error } = await supabase.from('committee_members').update(patch).eq('id', id)
  if (error) throw error
}
