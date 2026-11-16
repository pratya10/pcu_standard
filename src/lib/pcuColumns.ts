// คอลัมน์ที่ anon / ผู้ที่ไม่ใช่ผู้ดูแลอ่านได้ (ฐานข้อมูลซ่อน join_code, device_key, เบอร์/อีเมล/หมายเหตุกรรมการ)
// ใช้แทน select('*') ทุกที่ เพราะ '*' จะถูกปฏิเสธทั้งคำขอเมื่อมีคอลัมน์ที่อ่านไม่ได้
import { supabase } from './supabaseClient'
import type { AssessmentRound } from '../types'

export const ROUND_COLUMNS = 'id,facility_id,standard_version_id,name,survey_date,status,created_by,created_at,completed_at,is_public,scoring_mode'
export const PARTICIPANT_COLUMNS = 'id,round_id,name,role,joined_at,civil_service_level,affiliation'
export const COMMITTEE_PUBLIC_COLUMNS = 'id,name,civil_service_level,affiliation,position,created_at'

// ผู้ดูแลเท่านั้น: เติม join_code ให้รายการรอบ (ไม่ใช่ผู้ดูแล = คืนรายการเดิม)
export async function withJoinCodes<T extends AssessmentRound>(rounds: T[]): Promise<T[]> {
  const { data, error } = await supabase.rpc('admin_round_join_codes')
  if (error || !Array.isArray(data)) return rounds
  const codes = new Map((data as { round_id: string; join_code: string }[]).map((r) => [r.round_id, r.join_code]))
  return rounds.map((r) => ({ ...r, join_code: codes.get(r.id) ?? r.join_code }))
}
