// Committee members "join" a round with a code from their phone — no real
// login. We keep a per-round participant identity in localStorage so a
// reload / re-open on the same device resumes the same participant row
// instead of creating a duplicate.

type StoredSession = {
  participantId: string
  roundId: string
  name: string
  role: 'evaluator' | 'viewer' | 'chair'
}

const KEY_PREFIX = 'pcu_participant_'

export function saveParticipantSession(session: StoredSession) {
  localStorage.setItem(KEY_PREFIX + session.roundId, JSON.stringify(session))
}

export function getParticipantSession(roundId: string): StoredSession | null {
  const raw = localStorage.getItem(KEY_PREFIX + roundId)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
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
