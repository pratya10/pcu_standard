// Committee members "join" a round with a code from their phone — no real
// login. We keep a per-round participant identity in localStorage so a
// reload / re-open on the same device resumes the same participant row
// instead of creating a duplicate.
// ฐานข้อมูลรับการเขียนของกรรมการผ่าน RPC ที่ตรวจ join_code + participant_id + device_key เท่านั้น
// จึงเก็บทั้งสามค่าไว้ในเครื่อง · device_key ผูกกับเบราว์เซอร์ (ใช้ซ้ำทุกรอบ) เพื่อกลับเข้ารอบเดิมได้

type StoredSession = {
  participantId: string
  roundId: string
  name: string
  role: 'evaluator' | 'viewer' | 'chair'
  joinCode: string
  deviceKey: string
}

const KEY_PREFIX = 'pcu_participant_'
const DEVICE_KEY = 'pcu_device_key'

export type ParticipantCredentials = { joinCode: string; participantId: string; deviceKey: string }

export function saveParticipantSession(session: StoredSession) {
  localStorage.setItem(KEY_PREFIX + session.roundId, JSON.stringify(session))
}

export function getParticipantSession(roundId: string): StoredSession | null {
  const raw = localStorage.getItem(KEY_PREFIX + roundId)
  if (!raw) return null
  try {
    const s = JSON.parse(raw) as Partial<StoredSession>
    // เซสชันแบบเก่า (ก่อนใช้ RPC) ไม่มีรหัสเข้าร่วม/กุญแจเครื่อง ต้องเข้าร่วมใหม่
    if (!s.participantId || !s.roundId || !s.joinCode || !s.deviceKey) return null
    return s as StoredSession
  } catch {
    return null
  }
}

export function getParticipantCredentials(roundId: string): ParticipantCredentials | null {
  const s = getParticipantSession(roundId)
  return s ? { joinCode: s.joinCode, participantId: s.participantId, deviceKey: s.deviceKey } : null
}

export function clearParticipantSession(roundId: string) {
  localStorage.removeItem(KEY_PREFIX + roundId)
}

export function randomJoinCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I to avoid confusion
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export function randomDeviceKey() {
  return crypto.randomUUID()
}

// กุญแจเครื่องเดียวต่อเบราว์เซอร์ · เข้าร่วมรอบเดิมซ้ำจากเครื่องเดิมจะได้ผู้เข้าร่วมคนเดิม (คะแนนเดิมไม่หาย)
export function deviceKeyForThisBrowser() {
  let key = localStorage.getItem(DEVICE_KEY)
  if (!key || key.length < 16) {
    key = randomDeviceKey()
    localStorage.setItem(DEVICE_KEY, key)
  }
  return key
}

// แปลงรหัสผิดพลาดจาก RPC เป็นข้อความที่ผู้ใช้อ่านเข้าใจ
export function rpcErrorMessage(code: string | undefined) {
  switch (code) {
    case 'FORBIDDEN':
      return 'เซสชันนี้ใช้ไม่ได้แล้ว (รอบอาจปิดแล้ว หรือถูกลบออกจากรอบ) กรุณาเข้าร่วมใหม่'
    case 'ROUND_NOT_FOUND':
      return 'ไม่พบรอบการประเมินสำหรับรหัสนี้ หรือรอบปิดรับคะแนนแล้ว'
    case 'BAD_FILE':
      return 'รองรับเฉพาะรูป JPG, PNG หรือ WEBP ขนาดไม่เกิน 30 MB'
    case 'BAD_TOPIC':
      return 'หัวข้อนี้ไม่อยู่ในมาตรฐานของรอบนี้'
    default:
      return 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
  }
}

type RpcResult = { ok: boolean; error?: string; [k: string]: unknown }

export function unwrapRpc<T extends RpcResult>(data: unknown, error: unknown): T {
  if (error) throw error
  const r = data as T
  if (!r || !r.ok) throw new Error(rpcErrorMessage(r?.error))
  return r
}
