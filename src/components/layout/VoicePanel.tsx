import { useState, useCallback } from 'react'
import { useVoiceStore } from '../../stores/voiceStore'
import { useRoomStore } from '../../stores/roomStore'
import { leaveVoiceRoom } from '../../lib/matrix'
import { setVoiceMuted, setVoiceDeafened } from '../../lib/voice'

export function VoicePanel() {
  const joinedRoomId = useVoiceStore((s) => s.joinedRoomId)
  const isMuted = useVoiceStore((s) => s.isMuted)
  const isDeafened = useVoiceStore((s) => s.isDeafened)
  const rooms = useRoomStore((s) => s.rooms)
  const [isLeaving, setIsLeaving] = useState(false)

  const room = joinedRoomId ? rooms.get(joinedRoomId) : null

  const handleLeave = useCallback(async () => {
    if (!joinedRoomId || isLeaving) return
    setIsLeaving(true)
    try {
      await leaveVoiceRoom(joinedRoomId)
    } catch (err) {
      console.error('[Voice] leave failed:', err)
    } finally {
      setIsLeaving(false)
    }
  }, [joinedRoomId, isLeaving])

  if (!joinedRoomId || !room) return null

  return (
    <div className="relative -left-[72px] w-[calc(100%+72px)] pl-[80px] pr-2 py-2 bg-bg-tertiary/95 border-t border-success/30 animate-in">
      {/* Status line */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-success shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3ZM5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-3.07A7 7 0 0 1 5 11Z"/>
            </svg>
            <span className="text-xs font-semibold text-success truncate">
              Connecté au vocal
            </span>
          </div>
          <p className="text-[11px] text-text-muted truncate mt-0.5 pl-5">
            {room.name}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Mute */}
          <button
            onClick={() => setVoiceMuted(!isMuted)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isMuted
                ? 'text-danger bg-danger/10 hover:bg-danger/20'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover/80'
            }`}
            title={isMuted ? 'Activer le micro' : 'Couper le micro'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {isMuted ? (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 006 0V9m-3 8v3m-4-3a7 7 0 008 0M3 3l18 18" />
                </>
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 11-14 0m7 7v3" />
                </>
              )}
            </svg>
          </button>

          {/* Deafen */}
          <button
            onClick={() => setVoiceDeafened(!isDeafened)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${
              isDeafened
                ? 'text-danger bg-danger/10 hover:bg-danger/20'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-hover/80'
            }`}
            title={isDeafened ? "Activer l'audio" : "Désactiver l'audio"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {isDeafened ? (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 8.5L7.5 11H5v2h2.5l3.5 3.5V8.5zM16 8a5 5 0 012 4 5 5 0 01-.6 2.4" />
                </>
              ) : (
                <>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" />
                </>
              )}
            </svg>
          </button>

          {/* Disconnect */}
          <button
            onClick={handleLeave}
            disabled={isLeaving}
            className="p-1.5 rounded-md text-danger bg-danger/10 hover:bg-danger/20 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            title="Se déconnecter du vocal"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.858 18.364l12.728-12.728" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
