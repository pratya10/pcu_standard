import { supabase } from './supabaseClient'
import type { AdminProfile } from '../types'

export async function getMyAdminProfile(): Promise<AdminProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('admin_profiles').select('*').eq('user_id', user.id).maybeSingle()
  return (data as AdminProfile) ?? null
}

export async function saveMyAdminProfile(input: { firstName: string; lastName: string; profession: string }) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ')
  const { error } = await supabase.from('admin_profiles').upsert({
    user_id: user.id,
    first_name: input.firstName.trim() || null,
    last_name: input.lastName.trim() || null,
    profession: input.profession.trim() || null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export function formatAdminName(profile: AdminProfile | null, fallbackEmail?: string | null) {
  if (profile && (profile.first_name || profile.last_name)) {
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
    return profile.profession ? `${name} · ${profile.profession}` : name
  }
  return fallbackEmail ?? 'ผู้ดูแล'
}
