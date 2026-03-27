import { create } from 'zustand'

interface VoiceState {
  joinedRoomId: string | null
  isMuted: boolean
  isDeafened: boolean
  speakingUsers: Set<string>
  localStream: MediaStream | null

  setJoinedRoom: (roomId: string | null) => void
  setMuted: (muted: boolean) => void
  setDeafened: (deafened: boolean) => void
  setSpeaking: (userId: string, speaking: boolean) => void
  clearSpeaking: () => void
  setLocalStream: (stream: MediaStream | null) => void
  reset: () => void
}

export const useVoiceStore = create<VoiceState>((set, get) => ({
  joinedRoomId: null,
  isMuted: false,
  isDeafened: false,
  speakingUsers: new Set(),
  localStream: null,

  setJoinedRoom: (roomId) => set({ joinedRoomId: roomId }),

  setMuted: (muted) => set({ isMuted: muted }),

  setDeafened: (deafened) => set({ isDeafened: deafened }),

  setSpeaking: (userId, speaking) => {
    const prev = get().speakingUsers
    const next = new Set(prev)
    if (speaking) next.add(userId)
    else next.delete(userId)
    if (next.size !== prev.size || !([...next].every((u) => prev.has(u)))) {
      set({ speakingUsers: next })
    }
  },

  clearSpeaking: () => set({ speakingUsers: new Set() }),

  setLocalStream: (stream) => set({ localStream: stream }),

  reset: () =>
    set({
      joinedRoomId: null,
      isMuted: false,
      isDeafened: false,
      speakingUsers: new Set(),
      localStream: null,
    }),
}))
