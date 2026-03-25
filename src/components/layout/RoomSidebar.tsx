import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useRoomStore } from '../../stores/roomStore'
import { Avatar } from '../common/Avatar'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import {
  getOwnAvatarUrl,
  getRoomMemberProfileBasics,
  getUserProfileBasics,
  joinRoom,
  declineInvite,
  joinVoiceRoom,
  leaveVoiceRoom,
  loadRoomMembers,
  setOwnPresence,
} from '../../lib/matrix'
import { getWaifuById } from '../../lib/waifu'
import type { RoomSummary } from '../../types/matrix'
import type { PresenceValue } from '../../stores/uiStore'

const PRESENCE_OPTIONS: { value: PresenceValue; label: string; color: string }[] = [
  { value: 'online',      label: 'En ligne',   color: 'bg-success' },
  { value: 'unavailable', label: 'Absent',      color: 'bg-warning' },
  { value: 'offline',     label: 'Hors-ligne',  color: 'bg-text-muted' },
]

type CategoryGroup = {
  id: string
  name: string
  rooms: RoomSummary[]
  totalUnread: number
  totalMentions: number
}

type SidebarOrder = {
  categories: Record<string, string[]>  // spaceId -> ordered sub-space IDs
  rooms: Record<string, string[]>       // contextKey -> ordered roomIds
}

type DragState = {
  id: string
  kind: 'room' | 'category'
} | null

function isVoiceRoom(room: { roomType?: string; name: string; topic: string }): boolean {
  const maybeVoice = room as { isVoice?: boolean; roomType?: string; name: string; topic: string }
  if (maybeVoice.isVoice) return true
  const type = (room.roomType || '').toLowerCase()
  if (type.includes('voice') || type.includes('call')) return true
  const label = `${room.name} ${room.topic}`.toLowerCase()
  return /\b(vocal|voice|audio)\b/.test(label)
}

function isVoiceDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try { return localStorage.getItem('waifutxt_debug_voice') === '1' } catch { return false }
}

function loadCollapsedCategories(): Set<string> {
  try {
    const stored = localStorage.getItem('waifutxt_collapsed_categories')
    return new Set(stored ? (JSON.parse(stored) as string[]) : [])
  } catch { return new Set() }
}

function loadSidebarOrder(): SidebarOrder {
  try {
    const stored = localStorage.getItem('waifutxt_sidebar_order')
    return stored ? (JSON.parse(stored) as SidebarOrder) : { categories: {}, rooms: {} }
  } catch { return { categories: {}, rooms: {} } }
}

function applyOrder<T>(items: T[], orderedIds: string[] | undefined, getId: (item: T) => string): T[] {
  if (!orderedIds || orderedIds.length === 0) return items
  const map = new Map(items.map((item) => [getId(item), item]))
  const result: T[] = []
  for (const id of orderedIds) {
    const item = map.get(id)
    if (item) result.push(item)
  }
  for (const item of items) {
    if (!orderedIds.includes(getId(item))) result.push(item)
  }
  return result
}

function moveInList(list: string[], fromId: string, toId: string): string[] {
  const result = list.filter((id) => id !== fromId)
  const toIdx = result.indexOf(toId)
  if (toIdx === -1) return list
  result.splice(toIdx, 0, fromId)
  return result
}

export function RoomSidebar() {
  const [search, setSearch] = useState('')
  const [isMuted, setIsMuted] = useState(false)
  const [isDeafened, setIsDeafened] = useState(false)
  const [voiceActionRoomId, setVoiceActionRoomId] = useState<string | null>(null)
  const [showPresenceMenu, setShowPresenceMenu] = useState(false)
  const [ownPresence, setOwnPresenceStore] = useState<PresenceValue>(() => {
    const stored = localStorage.getItem('waifutxt_presence')
    return stored === 'online' || stored === 'unavailable' || stored === 'offline' ? stored : 'online'
  })
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(loadCollapsedCategories)
  const [sidebarOrder, setSidebarOrder] = useState<SidebarOrder>(loadSidebarOrder)
  const [dragging, setDragging] = useState<DragState>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const presenceMenuRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const rooms = useRoomStore((s) => s.rooms)
  const activeSpaceId = useRoomStore((s) => s.activeSpaceId)
  const activeRoomId = useRoomStore((s) => s.activeRoomId)
  const setActiveRoom = useRoomStore((s) => s.setActiveRoom)
  const membersByRoom = useRoomStore((s) => s.members)
  const updatePresence = useRoomStore((s) => s.updatePresence)
  const session = useAuthStore((s) => s.session)
  const setSettingsModal = useUiStore((s) => s.setSettingsModal)
  const showRoomMessagePreview = useUiStore((s) => s.showRoomMessagePreview)
  const showUnreadDot = useUiStore((s) => s.showUnreadDot)
  const showMentionBadge = useUiStore((s) => s.showMentionBadge)
  const waifuOptIn = useUiStore((s) => s.waifuOptIn)
  const selectedWaifuId = useUiStore((s) => s.selectedWaifuId)
  const roomSearchFocusBump = useUiStore((s) => s.roomSearchFocusBump)
  const myUserId = session?.userId ?? null

  useEffect(() => {
    if (roomSearchFocusBump > 0) {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }
  }, [roomSearchFocusBump])

  const [ownAvatarUrl, setOwnAvatarUrl] = useState<string | null>(null)
  const [voiceProfileMap, setVoiceProfileMap] = useState<Record<string, { displayName: string | null; avatarUrl: string | null }>>({})
  const loadedVoiceMembersRef = useRef(new Set<string>())
  useEffect(() => {
    const url = getOwnAvatarUrl()
    if (url) setOwnAvatarUrl(url)
  }, [rooms])

  const displayedOwnAvatarUrl = useMemo(() => {
    if (waifuOptIn) return getWaifuById(selectedWaifuId).imageUrl
    return ownAvatarUrl
  }, [ownAvatarUrl, selectedWaifuId, waifuOptIn])

  useEffect(() => {
    if (!showPresenceMenu) return
    const handler = (e: MouseEvent) => {
      if (!presenceMenuRef.current?.contains(e.target as Node)) setShowPresenceMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPresenceMenu])

  const handleSetPresence = async (presence: PresenceValue) => {
    setOwnPresenceStore(presence)
    localStorage.setItem('waifutxt_presence', presence)
    if (myUserId) updatePresence(myUserId, presence)
    setShowPresenceMenu(false)
    await setOwnPresence(presence)
  }

  // --- Invitations ---
  const [pendingInvites, setPendingInvites] = useState<Set<string>>(new Set())

  const handleAcceptInvite = async (roomId: string) => {
    setPendingInvites((s) => new Set(s).add(roomId))
    try { await joinRoom(roomId); setActiveRoom(roomId) }
    finally { setPendingInvites((s) => { const n = new Set(s); n.delete(roomId); return n }) }
  }

  const handleDeclineInvite = async (roomId: string) => {
    setPendingInvites((s) => new Set(s).add(roomId))
    try { await declineInvite(roomId) }
    finally { setPendingInvites((s) => { const n = new Set(s); n.delete(roomId); return n }) }
  }

  // --- Category collapse ---
  const toggleCategory = useCallback((key: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem('waifutxt_collapsed_categories', JSON.stringify([...next]))
      return next
    })
  }, [])

  // --- Drag & drop ---
  const handleDragStart = useCallback((e: React.DragEvent, id: string, kind: 'room' | 'category') => {
    setDragging({ id, kind })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string, kind: 'room' | 'category') => {
    if (!dragging || dragging.kind !== kind) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverId(id)
  }, [dragging])

  const handleDragEnd = useCallback(() => {
    setDragging(null)
    setDragOverId(null)
  }, [])

  const saveOrder = useCallback((next: SidebarOrder) => {
    setSidebarOrder(next)
    localStorage.setItem('waifutxt_sidebar_order', JSON.stringify(next))
  }, [])

  const handleDropCategory = useCallback((e: React.DragEvent, targetId: string, currentCategories: CategoryGroup[]) => {
    e.preventDefault()
    if (!dragging || dragging.kind !== 'category' || dragging.id === targetId || !activeSpaceId) {
      handleDragEnd(); return
    }
    const newList = moveInList(currentCategories.map((c) => c.id), dragging.id, targetId)
    saveOrder({ ...sidebarOrder, categories: { ...sidebarOrder.categories, [activeSpaceId]: newList } })
    handleDragEnd()
  }, [dragging, activeSpaceId, sidebarOrder, saveOrder, handleDragEnd])

  const handleDropRoom = useCallback((e: React.DragEvent, targetId: string, contextKey: string, currentRooms: RoomSummary[]) => {
    e.preventDefault()
    if (!dragging || dragging.kind !== 'room' || dragging.id === targetId) {
      handleDragEnd(); return
    }
    const newList = moveInList(currentRooms.map((r) => r.roomId), dragging.id, targetId)
    saveOrder({ ...sidebarOrder, rooms: { ...sidebarOrder.rooms, [contextKey]: newList } })
    handleDragEnd()
  }, [dragging, sidebarOrder, saveOrder, handleDragEnd])

  // --- Room hierarchy with order applied ---
  const { uncategorized, uncatKey, categories, invitedRooms } = useMemo(() => {
    const allRooms = Array.from(rooms.values())
    const invited = allRooms.filter((r) => r.membership === 'invite')
    const joinedOnly = allRooms.filter((r) => r.membership !== 'invite')

    if (activeSpaceId === null) {
      const dms = joinedOnly.filter((r) => r.isDirect)
      const nonSpaceNonDm = joinedOnly.filter((r) => !r.isSpace && !r.isDirect)
      const flat = [...dms, ...nonSpaceNonDm].sort((a, b) => b.lastMessageTs - a.lastMessageTs)
      const key = '_flat'
      return {
        uncategorized: applyOrder(flat, sidebarOrder.rooms[key], (r) => r.roomId),
        uncatKey: key,
        categories: [] as CategoryGroup[],
        invitedRooms: invited,
      }
    }

    const space = rooms.get(activeSpaceId)
    if (!space) return { uncategorized: [], uncatKey: `${activeSpaceId}::_`, categories: [] as CategoryGroup[], invitedRooms: invited }

    const subSpaces: RoomSummary[] = []
    const directRooms: RoomSummary[] = []

    for (const childId of space.children) {
      const child = rooms.get(childId)
      if (!child || child.membership === 'invite') continue
      if (child.isSpace) subSpaces.push(child)
      else directRooms.push(child)
    }

    const uncatCtxKey = `${activeSpaceId}::_`
    const sortedDirect = directRooms.sort((a, b) => b.lastMessageTs - a.lastMessageTs)
    const orderedDirect = applyOrder(sortedDirect, sidebarOrder.rooms[uncatCtxKey], (r) => r.roomId)

    const baseCats: CategoryGroup[] = subSpaces.map((sub) => {
      const ctxKey = `${activeSpaceId}::${sub.roomId}`
      const subRooms = sub.children
        .map((id) => rooms.get(id))
        .filter((r): r is RoomSummary => !!r && !r.isSpace && r.membership !== 'invite')
        .sort((a, b) => b.lastMessageTs - a.lastMessageTs)
      const orderedRooms = applyOrder(subRooms, sidebarOrder.rooms[ctxKey], (r) => r.roomId)
      return {
        id: sub.roomId,
        name: sub.name,
        rooms: orderedRooms,
        totalUnread: orderedRooms.reduce((s, r) => s + r.unreadCount, 0),
        totalMentions: orderedRooms.reduce((s, r) => s + r.mentionCount, 0),
      }
    })

    const orderedCats = applyOrder(baseCats, sidebarOrder.categories[activeSpaceId], (c) => c.id)

    return {
      uncategorized: orderedDirect,
      uncatKey: uncatCtxKey,
      categories: orderedCats,
      invitedRooms: invited,
    }
  }, [rooms, activeSpaceId, sidebarOrder])

  const allDisplayedRooms = useMemo(
    () => [...uncategorized, ...categories.flatMap((c) => c.rooms)],
    [uncategorized, categories],
  )

  const searchResults = useMemo(() => {
    if (!search) return null
    const q = search.toLowerCase()
    return allDisplayedRooms.filter((r) => r.name.toLowerCase().includes(q))
  }, [search, allDisplayedRooms])

  const voiceScanRooms = searchResults ?? allDisplayedRooms

  useEffect(() => {
    const voiceUsers = new Map<string, string>()
    for (const room of voiceScanRooms) {
      if (!isVoiceRoom(room)) continue
      if ((room.voiceParticipants || []).length > 0 && !membersByRoom.get(room.roomId) && !loadedVoiceMembersRef.current.has(room.roomId)) {
        loadedVoiceMembersRef.current.add(room.roomId)
        loadRoomMembers(room.roomId).catch(() => { loadedVoiceMembersRef.current.delete(room.roomId) })
      }
      for (const participant of room.voiceParticipants || []) {
        if (!participant.userId || participant.avatarUrl) continue
        voiceUsers.set(participant.userId, room.roomId)
      }
    }
    const toFetch = Array.from(voiceUsers.entries()).filter(([userId]) => !(userId in voiceProfileMap))
    if (toFetch.length === 0) return

    let cancelled = false
    Promise.all(
      toFetch.map(async ([userId, roomId]) => ({
        userId,
        profile: await (async () => {
          const p = await getRoomMemberProfileBasics(roomId, userId, 24)
          return p.avatarUrl ? p : getUserProfileBasics(userId, 24)
        })(),
      })),
    ).then((items) => {
      if (cancelled) return
      setVoiceProfileMap((prev) => { const next = { ...prev }; for (const i of items) next[i.userId] = i.profile; return next })
    }).catch(() => { /* ignore */ })

    return () => { cancelled = true }
  }, [voiceScanRooms, voiceProfileMap, membersByRoom])

  useEffect(() => {
    if (!isVoiceDebugEnabled()) return
    const snapshot = voiceScanRooms
      .filter((room) => isVoiceRoom(room) && (room.voiceParticipants || []).length > 0)
      .map((room) => ({
        roomId: room.roomId,
        roomName: room.name,
        participants: (room.voiceParticipants || []).map((p) => {
          const member = (membersByRoom.get(room.roomId) || []).find((m) => m.userId === p.userId)
          const fallback = voiceProfileMap[p.userId]
          return {
            userId: p.userId,
            displayName: member?.displayName || fallback?.displayName || p.displayName,
            avatarUrl: member?.avatarUrl || p.avatarUrl || fallback?.avatarUrl || null,
          }
        }),
      }))
    console.debug('[VoiceDebug] RoomSidebar snapshot', snapshot)
  }, [voiceScanRooms, membersByRoom, voiceProfileMap])

  const spaceName = activeSpaceId ? rooms.get(activeSpaceId)?.name || 'Space' : 'Messages'
  const joinedVoiceRoomId = useMemo(() => {
    for (const room of rooms.values()) {
      if (isVoiceRoom(room) && room.voiceJoinedByMe) return room.roomId
    }
    return null
  }, [rooms])

  const handleVoiceJoinLeave = async (roomId: string, joined: boolean) => {
    if (voiceActionRoomId) return
    setVoiceActionRoomId(roomId)
    try {
      if (joined) await leaveVoiceRoom(roomId)
      else { await joinVoiceRoom(roomId); setActiveRoom(roomId) }
    } catch (err) {
      console.error('[Voice] join/leave failed:', err instanceof Error ? err.message : 'Action vocale impossible')
    } finally {
      setVoiceActionRoomId(null)
    }
  }

  // --- Room item renderer ---
  const renderRoomItem = (room: RoomSummary, contextKey: string, contextRooms: RoomSummary[]) => {
    const isVoice = isVoiceRoom(room)
    const isJoinedVoice = joinedVoiceRoomId === room.roomId
    const participants = room.voiceParticipants || []
    const roomMembers = membersByRoom.get(room.roomId) || []
    const isDraggingThis = dragging?.id === room.roomId && dragging.kind === 'room'
    const isDropTarget = dragOverId === room.roomId && dragging?.kind === 'room'

    return (
      <div
        key={room.roomId}
        className={`space-y-1 transition-opacity ${isDraggingThis ? 'opacity-40' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, room.roomId, 'room')}
        onDragOver={(e) => handleDragOver(e, room.roomId, 'room')}
        onDrop={(e) => handleDropRoom(e, room.roomId, contextKey, contextRooms)}
        onDragEnd={handleDragEnd}
      >
        {isDropTarget && <div className="h-0.5 rounded-full bg-accent-pink mx-2 mb-0.5" />}
        <button
          onClick={() => setActiveRoom(room.roomId)}
          className={`w-full flex items-center px-2 py-1.5 rounded-md transition-colors text-left cursor-pointer group ${
            activeRoomId === room.roomId
              ? 'bg-bg-hover text-text-primary'
              : room.unreadCount > 0
                ? 'text-text-primary hover:bg-bg-hover/50'
                : 'text-text-secondary hover:bg-bg-hover/50 hover:text-text-primary'
          }`}
        >
          {/* Drag handle */}
          <span className="mr-1 text-text-muted/0 group-hover:text-text-muted/40 shrink-0 transition-colors cursor-grab active:cursor-grabbing" aria-hidden>
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2.5" cy="2" r="1.5" /><circle cx="7.5" cy="2" r="1.5" />
              <circle cx="2.5" cy="7" r="1.5" /><circle cx="7.5" cy="7" r="1.5" />
              <circle cx="2.5" cy="12" r="1.5" /><circle cx="7.5" cy="12" r="1.5" />
            </svg>
          </span>
          <span className="mr-1.5 text-text-muted/90 shrink-0" aria-hidden>
            {isVoice ? (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 11-14 0m7 7v3" />
              </svg>
            ) : (
              <span className="text-base leading-none">#</span>
            )}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1.5">
              <span className={`text-sm truncate ${room.unreadCount > 0 && activeRoomId !== room.roomId ? 'font-semibold' : 'font-medium'}`}>
                {room.name}
              </span>
              <div className="flex items-center gap-1">
                {isVoice && (
                  <button
                    onClick={(e) => { e.stopPropagation(); void handleVoiceJoinLeave(room.roomId, isJoinedVoice) }}
                    disabled={voiceActionRoomId === room.roomId}
                    className={`shrink-0 inline-flex items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                      isJoinedVoice ? 'text-danger bg-danger/12 hover:bg-danger/20' : 'text-success bg-success/12 hover:bg-success/20'
                    } ${voiceActionRoomId === room.roomId ? 'opacity-60 cursor-wait' : ''}`}
                    title={isJoinedVoice ? 'Quitter le vocal' : 'Rejoindre le vocal'}
                  >
                    {voiceActionRoomId === room.roomId ? '...' : isJoinedVoice ? 'Quitter' : 'Rejoindre'}
                  </button>
                )}
                {showMentionBadge && activeRoomId !== room.roomId && room.mentionCount > 0 ? (
                  <span className="shrink-0 flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-accent-pink">
                    {room.mentionCount > 99 ? '99+' : room.mentionCount}
                  </span>
                ) : showUnreadDot && activeRoomId !== room.roomId && room.unreadCount > 0 ? (
                  <span className="shrink-0 w-2 h-2 rounded-full bg-accent-pink" />
                ) : null}
              </div>
            </div>
            {showRoomMessagePreview && room.lastMessage && (
              <p className="text-xs text-text-muted truncate">{room.lastMessage}</p>
            )}
          </div>
        </button>

        {isVoice && participants.length > 0 && (
          <div className="pl-6 pr-2 pb-1 space-y-1">
            {participants.map((participant) => {
              const matchedMember = roomMembers.find((m) => m.userId === participant.userId)
              const displayName = matchedMember?.displayName || voiceProfileMap[participant.userId]?.displayName || participant.displayName
              const avatarUrl = matchedMember?.avatarUrl || participant.avatarUrl || voiceProfileMap[participant.userId]?.avatarUrl || null
              return (
                <button
                  key={`${room.roomId}:${participant.userId}`}
                  onClick={() => setActiveRoom(room.roomId)}
                  className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-left text-text-muted hover:text-text-primary hover:bg-bg-hover/40 transition-colors cursor-pointer"
                  title={participant.userId}
                >
                  <Avatar src={avatarUrl} name={displayName} size={18} />
                  <span className="text-xs truncate">{displayName}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="w-60 bg-bg-secondary flex flex-col border-r border-border">
      <div className="h-12 px-3 flex items-center border-b border-border shrink-0">
        <h2 className="font-semibold text-text-primary truncate text-sm">{spaceName}</h2>
      </div>

      <div className="px-2 py-2">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); searchInputRef.current?.blur() } }}
          className="w-full text-xs !py-1.5 !px-2"
        />
      </div>

      <div
        className="flex-1 overflow-y-auto px-2 space-y-0.5"
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverId(null)
        }}
      >
        {/* Invitations */}
        {invitedRooms.length > 0 && (
          <div className="mb-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Invitations ({invitedRooms.length})
            </p>
            {invitedRooms.map((room) => (
              <div key={room.roomId} className="flex items-center px-2 py-1.5 rounded-md bg-bg-tertiary/60 mb-0.5">
                <span className="mr-1.5 text-text-muted/90 shrink-0 text-base leading-none">#</span>
                <span className="flex-1 min-w-0 text-sm font-medium text-text-secondary truncate">{room.name}</span>
                <div className="flex gap-1 shrink-0 ml-1">
                  <button
                    onClick={() => handleAcceptInvite(room.roomId)}
                    disabled={pendingInvites.has(room.roomId)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-accent-pink text-white hover:bg-accent-pink-hover transition-colors disabled:opacity-50 cursor-pointer"
                    title="Accepter l'invitation"
                  >Oui</button>
                  <button
                    onClick={() => handleDeclineInvite(room.roomId)}
                    disabled={pendingInvites.has(room.roomId)}
                    className="px-2 py-0.5 text-[10px] font-semibold rounded bg-bg-hover text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 cursor-pointer"
                    title="Refuser l'invitation"
                  >Non</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search mode: flat filtered list */}
        {searchResults !== null ? (
          <>
            {searchResults.map((r) => renderRoomItem(r, '_search', searchResults))}
            {searchResults.length === 0 && (
              <div className="text-center text-text-muted text-xs py-8">Aucun salon trouvé</div>
            )}
          </>
        ) : categories.length > 0 ? (
          /* Hierarchical mode */
          <>
            {uncategorized.map((r) => renderRoomItem(r, uncatKey, uncategorized))}

            {categories.map((cat) => {
              const collapseKey = `${activeSpaceId}::${cat.id}`
              const isCollapsed = collapsedCategories.has(collapseKey)
              const isDraggingCat = dragging?.id === cat.id && dragging.kind === 'category'
              const isDropTargetCat = dragOverId === cat.id && dragging?.kind === 'category'
              const ctxKey = `${activeSpaceId}::${cat.id}`

              return (
                <div
                  key={cat.id}
                  className={`mt-2 transition-opacity ${isDraggingCat ? 'opacity-40' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, cat.id, 'category')}
                  onDragOver={(e) => handleDragOver(e, cat.id, 'category')}
                  onDrop={(e) => handleDropCategory(e, cat.id, categories)}
                  onDragEnd={handleDragEnd}
                >
                  {isDropTargetCat && <div className="h-0.5 rounded-full bg-accent-pink mx-1 mb-1" />}
                  {/* Category header */}
                  <div className="flex items-center gap-1 px-1 py-0.5 group rounded transition-colors hover:bg-bg-hover/30">
                    {/* Category drag handle */}
                    <span
                      className="text-text-muted/0 group-hover:text-text-muted/40 shrink-0 transition-colors cursor-grab active:cursor-grabbing"
                      aria-hidden
                    >
                      <svg className="w-2.5 h-2.5" viewBox="0 0 10 16" fill="currentColor">
                        <circle cx="2.5" cy="2" r="1.5" /><circle cx="7.5" cy="2" r="1.5" />
                        <circle cx="2.5" cy="7" r="1.5" /><circle cx="7.5" cy="7" r="1.5" />
                        <circle cx="2.5" cy="12" r="1.5" /><circle cx="7.5" cy="12" r="1.5" />
                      </svg>
                    </span>
                    <button
                      onClick={() => toggleCategory(collapseKey)}
                      className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                      aria-expanded={!isCollapsed}
                    >
                      <svg
                        className={`w-3 h-3 text-text-muted shrink-0 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                        fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted group-hover:text-text-secondary truncate">
                        {cat.name}
                      </span>
                    </button>
                    {isCollapsed && (cat.totalMentions > 0 ? (
                      <span className="shrink-0 flex items-center justify-center rounded-full min-w-[16px] h-[16px] px-1 text-[10px] font-bold text-white bg-accent-pink">
                        {cat.totalMentions > 99 ? '99+' : cat.totalMentions}
                      </span>
                    ) : cat.totalUnread > 0 ? (
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-pink" />
                    ) : null)}
                  </div>

                  {!isCollapsed && (
                    <div className="mt-0.5 space-y-0.5">
                      {cat.rooms.map((r) => renderRoomItem(r, ctxKey, cat.rooms))}
                      {cat.rooms.length === 0 && (
                        <p className="px-4 py-1 text-xs text-text-muted italic">Aucun salon</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {uncategorized.length === 0 && categories.every((c) => c.rooms.length === 0) && (
              <div className="text-center text-text-muted text-xs py-8">Aucun salon</div>
            )}
          </>
        ) : (
          /* Flat mode */
          <>
            {uncategorized.map((r) => renderRoomItem(r, uncatKey, uncategorized))}
            {uncategorized.length === 0 && (
              <div className="text-center text-text-muted text-xs py-8">Aucun salon trouvé</div>
            )}
          </>
        )}
      </div>

      <div className="relative -left-[72px] w-[calc(100%+72px)] h-14 pl-[80px] pr-2 flex items-center gap-2 bg-bg-tertiary/95 border-t border-border">
        {showPresenceMenu && (
          <div
            ref={presenceMenuRef}
            className="absolute bottom-16 left-[80px] w-44 bg-bg-tertiary border border-border rounded-lg shadow-xl p-1 z-50"
          >
            {PRESENCE_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => handleSetPresence(value)}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />
                <span className="flex-1 text-left">{label}</span>
                {ownPresence === value && (
                  <svg className="w-3.5 h-3.5 text-accent-pink shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => setShowPresenceMenu((v) => !v)}
          className="flex items-center gap-2 min-w-0 flex-1 px-1.5 py-1 rounded-md hover:bg-bg-hover/70 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-pink"
          title="Changer de statut"
          aria-label="Changer de statut"
        >
          <Avatar src={displayedOwnAvatarUrl} name={session?.userId || '?'} size={32} status={ownPresence} />
          <div className="min-w-0 text-left">
            <div className="text-sm font-semibold truncate text-text-primary leading-tight">
              {session?.userId?.split(':')[0]?.replace('@', '') || ''}
            </div>
            <div className="text-[11px] text-text-muted truncate leading-tight">
              {PRESENCE_OPTIONS.find((o) => o.value === ownPresence)?.label ?? 'Hors-ligne'}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setIsMuted((v) => !v)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${isMuted ? 'text-danger bg-danger/10 hover:bg-danger/20' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover/80'}`}
            title={isMuted ? 'Activer le micro' : 'Couper le micro'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {isMuted ? (
                <><path strokeLinecap="round" strokeLinejoin="round" d="M9 9v3a3 3 0 006 0V9m-3 8v3m-4-3a7 7 0 008 0M3 3l18 18" /></>
              ) : (
                <><path strokeLinecap="round" strokeLinejoin="round" d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 11-14 0m7 7v3" /></>
              )}
            </svg>
          </button>

          <button
            onClick={() => setIsDeafened((v) => !v)}
            className={`p-1.5 rounded-md transition-colors cursor-pointer ${isDeafened ? 'text-danger bg-danger/10 hover:bg-danger/20' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover/80'}`}
            title={isDeafened ? "Activer l'audio" : "Désactiver l'audio"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              {isDeafened ? (
                <><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /><path strokeLinecap="round" strokeLinejoin="round" d="M10 8.5L7.5 11H5v2h2.5l3.5 3.5V8.5zM16 8a5 5 0 012 4 5 5 0 01-.6 2.4" /></>
              ) : (
                <><path strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H3v6h3l5 4V5z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.5 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" /></>
              )}
            </svg>
          </button>

          <button
            onClick={() => setSettingsModal(true)}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover/80 transition-colors cursor-pointer"
            title="Paramètres utilisateur"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317a1.724 1.724 0 013.35 0 1.724 1.724 0 002.573 1.066 1.724 1.724 0 012.353.994 1.724 1.724 0 001.724 2.99 1.724 1.724 0 010 3.266 1.724 1.724 0 00-1.724 2.99 1.724 1.724 0 01-2.353.994 1.724 1.724 0 00-2.573 1.066 1.724 1.724 0 01-3.35 0 1.724 1.724 0 00-2.573-1.066 1.724 1.724 0 01-2.353-.994 1.724 1.724 0 00-1.724-2.99 1.724 1.724 0 010-3.266 1.724 1.724 0 001.724-2.99 1.724 1.724 0 012.353-.994 1.724 1.724 0 002.573-1.066z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
