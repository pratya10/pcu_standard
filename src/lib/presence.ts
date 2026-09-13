import { supabase } from './supabaseClient'

export type PresenceInfo = {
  participantId: string
  name: string
  role: string
}

// Supabase Realtime Presence: tracks who currently has this round's score
// page open (not who has ever joined, and not who last edited something —
// just "is a tab open right now"). Presence state lives only in-memory on
// Supabase's realtime server for the life of the socket connection, so it
// clears itself automatically when a tab closes or loses connection.
export function subscribeToPresence(roundId: string, self: PresenceInfo, onSync: (online: PresenceInfo[]) => void) {
  const channel = supabase.channel(`presence-round-${roundId}`, {
    config: { presence: { key: self.participantId } },
  })

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<PresenceInfo>()
    const online: PresenceInfo[] = Object.values(state)
      .map((entries) => entries[0])
      .filter((p): p is PresenceInfo & { presence_ref: string } => !!p)
      .map(({ participantId, name, role }) => ({ participantId, name, role }))
    onSync(online)
  })

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      channel.track(self)
    }
  })

  return () => {
    supabase.removeChannel(channel)
  }
}
