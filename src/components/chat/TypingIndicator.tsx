import { useMessageStore } from '../../stores/messageStore'
import { useRoomStore } from '../../stores/roomStore'
import { useUiStore } from '../../stores/uiStore'
import { getWaifuById } from '../../lib/waifu'

const EMPTY_USERS: string[] = []

export function TypingIndicator() {
  const activeRoomId = useRoomStore((s) => s.activeRoomId)
  const typingMap = useMessageStore((s) => s.typing)
  const waifuOptIn = useUiStore((s) => s.waifuOptIn)
  const selectedWaifuId = useUiStore((s) => s.selectedWaifuId)
  const typingIndicatorStyle = useUiStore((s) => s.typingIndicatorStyle)

  const typingUsers = activeRoomId ? typingMap.get(activeRoomId) ?? EMPTY_USERS : EMPTY_USERS

  if (typingUsers.length === 0) return null

  let text: string
  if (typingUsers.length === 1) {
    text = `${typingUsers[0]} est en train d'écrire...`
  } else if (typingUsers.length === 2) {
    text = `${typingUsers[0]} et ${typingUsers[1]} sont en train d'écrire...`
  } else {
    text = `${typingUsers[0]} et ${typingUsers.length - 1} autres sont en train d'écrire...`
  }

  return (
    <div className="px-4 py-1 text-xs text-text-muted flex items-center gap-2">
      {typingIndicatorStyle === 'waifu' && waifuOptIn ? (
        <img
          src={getWaifuById(selectedWaifuId).imageUrl}
          alt="Waifu typing"
          className="w-12 h-12 rounded-full object-cover border-2 border-accent-pink/70"
        />
      ) : (
        <span className="flex gap-0.5">
          <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      )}
      <span>{text}</span>
    </div>
  )
}
