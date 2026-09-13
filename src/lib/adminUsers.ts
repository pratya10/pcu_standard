import { supabase } from './supabaseClient'
import type { AdminAllowlistEntry } from '../types'

export async function listAdminUsers() {
  const { data, error } = await supabase.from('admin_allowlist').select('*').order('created_at')
  if (error) throw error
  return data as AdminAllowlistEntry[]
}

export async function addAdminUser(email: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { error } = await supabase.from('admin_allowlist').insert({ email: email.trim().toLowerCase(), added_by: user?.id ?? null })
  if (error) throw error
}

export async function removeAdminUser(email: string) {
  const { error } = await supabase.from('admin_allowlist').delete().eq('email', email)
  if (error) throw error
}
