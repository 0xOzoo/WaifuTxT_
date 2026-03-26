import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react'
import emojibaseShortcodes from 'emojibase-data/en/shortcodes/emojibase.json'
import emojibaseData from 'emojibase-data/en/data.json'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RawEntry {
  hexcode: string
  emoji: string
  order?: number
  group?: number
}

export interface EmojiEntry {
  emoji: string
  hexcode: string
  shortcode: string
  terms: string[]
}

interface EmojiGroupDef {
  id: number
  label: string
  icon: string
  hexcode: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toShortcode(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function twemojiUrl(hexcode: string): string {
  // Twemoji ne conserve pas le sélecteur de variation FE0F à la fin du nom de fichier
  const parts = hexcode.toLowerCase().split('-')
  while (parts.length > 1 && parts[parts.length - 1] === 'fe0f') parts.pop()
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15/assets/svg/${parts.join('-')}.svg`
}

const RECENTLY_USED_KEY = 'waifutxt_recent_emojis'
const MAX_RECENT = 18

function getRecentEmojis(): string[] {
  try {
    const stored = localStorage.getItem(RECENTLY_USED_KEY)
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

export function addRecentEmoji(emoji: string): void {
  const current = getRecentEmojis()
  const next = [emoji, ...current.filter((e) => e !== emoji)].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Build grouped data (module-level, built once)
// ---------------------------------------------------------------------------
const EMOJI_CATEGORY_DEFS: EmojiGroupDef[] = [
  { id: 0, label: 'Smileys',    icon: '😀', hexcode: '1F600' },
  { id: 1, label: 'Personnes',  icon: '🧑', hexcode: '1F9D1' },
  { id: 3, label: 'Animaux',    icon: '🐶', hexcode: '1F436' },
  { id: 4, label: 'Nourriture', icon: '🍔', hexcode: '1F354' },
  { id: 5, label: 'Voyages',    icon: '✈️', hexcode: '2708'  },
  { id: 6, label: 'Activités',  icon: '⚽', hexcode: '26BD'  },
  { id: 7, label: 'Objets',     icon: '💡', hexcode: '1F4A1' },
  { id: 8, label: 'Symboles',   icon: '❤️', hexcode: '2764'  },
  { id: 9, label: 'Drapeaux',   icon: '🚩', hexcode: '1F6A9' },
]

const GROUPED_EMOJIS: Map<number, EmojiEntry[]> = (() => {
  const sc = emojibaseShortcodes as Record<string, string | string[]>
  const seen = new Set<string>()
  const groups = new Map<number, EmojiEntry[]>()

  const sorted = [...(emojibaseData as RawEntry[])].sort(
    (a, b) => (a.order ?? 99999) - (b.order ?? 99999),
  )

  for (const raw of sorted) {
    if (raw.group === undefined || raw.group === 2) continue
    const value = sc[raw.hexcode] ?? sc[raw.hexcode.toLowerCase()]
    if (!value) continue
    const aliases = (Array.isArray(value) ? value : [value])
      .map((v) => toShortcode(v))
      .filter(Boolean)
    if (aliases.length === 0) continue
    const primary = aliases[0]
    if (seen.has(primary)) continue
    seen.add(primary)
    if (!groups.has(raw.group)) groups.set(raw.group, [])
    groups.get(raw.group)!.push({
      emoji: raw.emoji,
      hexcode: raw.hexcode,
      shortcode: primary,
      terms: Array.from(new Set(aliases)),
    })
  }

  return groups
})()

/** Flat list for search, ordered by natural emoji order */
const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORY_DEFS.flatMap(
  (cat) => GROUPED_EMOJIS.get(cat.id) ?? [],
)

/** Quick lookup: emoji char → EmojiEntry */
const EMOJI_CHAR_MAP = new Map<string, EmojiEntry>(ALL_EMOJIS.map((e) => [e.emoji, e]))

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
export type QuickReactionEntry = { emoji: string; hexcode: string }

export const QUICK_REACTIONS_KEY = 'waifutxt_quick_reactions'

export const DEFAULT_QUICK_REACTIONS: QuickReactionEntry[] = [
  { emoji: '👍', hexcode: '1F44D' },
  { emoji: '❤️', hexcode: '2764' },
  { emoji: '😂', hexcode: '1F602' },
  { emoji: '🎉', hexcode: '1F389' },
  { emoji: '😮', hexcode: '1F62E' },
]

export function getQuickReactions(): QuickReactionEntry[] {
  try {
    const stored = localStorage.getItem(QUICK_REACTIONS_KEY)
    if (stored) return JSON.parse(stored) as QuickReactionEntry[]
  } catch { /* ignore */ }
  return DEFAULT_QUICK_REACTIONS
}

export function setQuickReactions(reactions: QuickReactionEntry[]): void {
  try {
    localStorage.setItem(QUICK_REACTIONS_KEY, JSON.stringify(reactions))
    window.dispatchEvent(new StorageEvent('storage', { key: QUICK_REACTIONS_KEY }))
  } catch { /* ignore */ }
}

/** Résout un emoji char en QuickReactionEntry (via EMOJI_CHAR_MAP) */
export function emojiToQuickEntry(emoji: string): QuickReactionEntry | null {
  const entry = EMOJI_CHAR_MAP.get(emoji)
  if (!entry) return null
  return { emoji: entry.emoji, hexcode: entry.hexcode }
}

export function TwemojiImg({
  hexcode,
  emoji,
  size = 22,
}: {
  hexcode: string
  emoji: string
  size?: number
}) {
  return (
    <img
      src={twemojiUrl(hexcode)}
      alt={emoji}
      width={size}
      height={size}
      loading="lazy"
      draggable={false}
      className="select-none object-contain pointer-events-none"
    />
  )
}

const EmojiButton = memo(function EmojiButton({
  entry,
  onSelect,
  onHover,
  onLeave,
}: {
  entry: EmojiEntry
  onSelect: (e: EmojiEntry) => void
  onHover: (e: EmojiEntry) => void
  onLeave: () => void
}) {
  return (
    <button
      type="button"
      className="h-9 w-9 rounded-md hover:bg-white/10 active:scale-90 transition-all flex items-center justify-center cursor-pointer"
      title={`:${entry.shortcode}:`}
      onMouseEnter={() => onHover(entry)}
      onMouseLeave={onLeave}
      onClick={() => onSelect(entry)}
    >
      <TwemojiImg hexcode={entry.hexcode} emoji={entry.emoji} size={22} />
    </button>
  )
})

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState(0)
  const [recentEmojis, setRecentEmojis] = useState<EmojiEntry[]>([])
  const [quickReactions, setQuickReactionsState] = useState<QuickReactionEntry[]>(getQuickReactions)
  const [hovered, setHovered] = useState<EmojiEntry | null>(null)
  // Progressive rendering: start with first category only, add more on idle frames
  const [renderedCatCount, setRenderedCatCount] = useState(1)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Map<number, HTMLElement>>(new Map())
  const isScrollingToRef = useRef(false)

  // Progressively render remaining categories so the initial paint is fast
  useEffect(() => {
    if (renderedCatCount >= EMOJI_CATEGORY_DEFS.length) return
    const schedule = (cb: () => void): number =>
      'requestIdleCallback' in window
        ? (window as Window & { requestIdleCallback: (cb: () => void, opts?: object) => number })
            .requestIdleCallback(cb, { timeout: 400 })
        : window.setTimeout(cb, 16)
    const cancel = (id: number) =>
      'cancelIdleCallback' in window
        ? (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
        : window.clearTimeout(id)

    const id = schedule(() => setRenderedCatCount((n) => n + 1))
    return () => cancel(id)
  }, [renderedCatCount])

  // Sync quick reactions when another tab or the settings page updates them
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === QUICK_REACTIONS_KEY) setQuickReactionsState(getQuickReactions())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  useEffect(() => {
    const stored = getRecentEmojis()
    setRecentEmojis(
      stored.flatMap((emoji) => {
        const entry = EMOJI_CHAR_MAP.get(emoji)
        return entry ? [entry] : []
      }),
    )
  }, [])

  const filteredEmojis = useMemo(() => {
    const q = toShortcode(query)
    if (!q) return null
    return ALL_EMOJIS.filter((e) => e.terms.some((t) => t.includes(q)))
  }, [query])

  const handleSelect = useCallback(
    (entry: EmojiEntry) => {
      onSelect(entry.emoji)
      addRecentEmoji(entry.emoji)
      setRecentEmojis((prev) => {
        const next = [entry, ...prev.filter((e) => e.emoji !== entry.emoji)].slice(0, MAX_RECENT)
        return next
      })
    },
    [onSelect],
  )

  const handleHover = useCallback((entry: EmojiEntry) => setHovered(entry), [])
  const handleLeave = useCallback(() => setHovered(null), [])

  const scrollToCategory = useCallback((id: number) => {
    const catIdx = EMOJI_CATEGORY_DEFS.findIndex((c) => c.id === id)
    // Force-render the target category if not yet rendered
    if (catIdx >= 0) setRenderedCatCount((n) => Math.max(n, catIdx + 1))

    // Defer scroll until the section is actually in the DOM
    const doScroll = () => {
      const el = sectionRefs.current.get(id)
      const container = scrollRef.current
      if (!el || !container) return
      isScrollingToRef.current = true
      setActiveCategory(id)
      container.scrollTo({ top: el.offsetTop - 4, behavior: 'smooth' })
      setTimeout(() => { isScrollingToRef.current = false }, 600)
    }

    // Give React one frame to flush the state update before scrolling
    requestAnimationFrame(doScroll)
  }, [])

  // Track active category on scroll
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      if (isScrollingToRef.current) return
      const scrollTop = container.scrollTop
      let current = EMOJI_CATEGORY_DEFS[0].id
      for (const cat of EMOJI_CATEGORY_DEFS) {
        const el = sectionRefs.current.get(cat.id)
        if (el && el.offsetTop - 8 <= scrollTop + 4) current = cat.id
      }
      setActiveCategory(current)
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  const recentEntries = recentEmojis.slice(0, MAX_RECENT)

  return (
    <div
      className="emoji-picker-enter flex flex-col overflow-hidden rounded-xl border border-border bg-[#1e1f22] shadow-2xl"
      style={{ width: 352, height: 444 }}
    >
      {/* Category tabs */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-0 border-b border-white/10 flex-shrink-0">
        {recentEntries.length > 0 && (
          <button
            type="button"
            title="Récemment utilisés"
            className={`h-8 w-8 flex items-center justify-center rounded-t-md text-base transition-colors ${activeCategory === -1 ? 'text-white border-b-2 border-[#5865f2]' : 'text-[#b5bac1] hover:text-white'}`}
            onClick={() => {
              isScrollingToRef.current = true
              setActiveCategory(-1)
              scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
              setTimeout(() => { isScrollingToRef.current = false }, 600)
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"/>
            </svg>
          </button>
        )}
        {EMOJI_CATEGORY_DEFS.map((cat) => (
          <button
            key={cat.id}
            type="button"
            title={cat.label}
            className={`h-8 w-8 flex items-center justify-center rounded-t-md transition-colors pb-0.5 ${activeCategory === cat.id ? 'text-white border-b-2 border-[#5865f2]' : 'text-[#b5bac1] hover:text-white opacity-70 hover:opacity-100'}`}
            onClick={() => scrollToCategory(cat.id)}
          >
            <TwemojiImg
              hexcode={cat.hexcode}
              emoji={cat.icon}
              size={18}
            />
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-2 pt-2 pb-1 flex-shrink-0">
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher"
            className="w-full rounded-md bg-[#2b2d31] border border-white/10 px-3 py-1.5 pl-8 text-sm text-white placeholder:text-[#87898c] focus:outline-none focus:ring-2 focus:ring-[#5865f2]/50"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#87898c] pointer-events-none"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" d="m21 21-4.35-4.35" />
          </svg>
        </div>
      </div>

      {/* Emoji grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-1 emoji-picker-scroll">
        {filteredEmojis ? (
          /* Search results */
          <>
            {filteredEmojis.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-sm text-[#87898c]">
                Aucun emoji trouvé
              </div>
            ) : (
              <>
                <p className="text-[11px] uppercase tracking-wider text-[#87898c] font-semibold mb-1 mt-2 px-0.5">
                  Résultats ({filteredEmojis.length})
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {filteredEmojis.map((entry) => (
                    <EmojiButton
                      key={entry.shortcode}
                      entry={entry}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onLeave={handleLeave}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Quick reactions */}
            <section>
              <p className="text-[11px] uppercase tracking-wider text-[#87898c] font-semibold mb-1 mt-2 px-0.5">
                Réactions rapides
              </p>
              <div className="flex gap-0.5">
                {quickReactions.flatMap(({ emoji }) => {
                  const entry = EMOJI_CHAR_MAP.get(emoji)
                  return entry ? [entry] : []
                }).map((entry) => (
                  <EmojiButton
                    key={`quick-${entry.emoji}`}
                    entry={entry}
                    onSelect={handleSelect}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                ))}
              </div>
            </section>

            {/* Recently used */}
            {recentEntries.length > 0 && (
              <section>
                <p className="text-[11px] uppercase tracking-wider text-[#87898c] font-semibold mb-1 mt-2 px-0.5">
                  Utilisé fréquemment
                </p>
                <div className="grid grid-cols-8 gap-0.5">
                  {recentEntries.map((entry) => (
                    <EmojiButton
                      key={`recent-${entry.emoji}`}
                      entry={entry}
                      onSelect={handleSelect}
                      onHover={handleHover}
                      onLeave={handleLeave}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Category sections — rendered progressively */}
            {EMOJI_CATEGORY_DEFS.map((cat, idx) => {
              const emojis = GROUPED_EMOJIS.get(cat.id) ?? []
              if (emojis.length === 0) return null
              // Placeholder for categories not yet rendered
              if (idx >= renderedCatCount) {
                return (
                  <section
                    key={cat.id}
                    ref={(el) => { if (el) sectionRefs.current.set(cat.id, el) }}
                    style={{ minHeight: '120px' }}
                  />
                )
              }
              return (
                <section
                  key={cat.id}
                  ref={(el) => {
                    if (el) sectionRefs.current.set(cat.id, el)
                  }}
                >
                  <p className="text-[11px] uppercase tracking-wider text-[#87898c] font-semibold mb-1 mt-3 px-0.5">
                    {cat.label}
                  </p>
                  <div className="grid grid-cols-8 gap-0.5">
                    {emojis.map((entry) => (
                      <EmojiButton
                        key={entry.shortcode}
                        entry={entry}
                        onSelect={handleSelect}
                        onHover={handleHover}
                        onLeave={handleLeave}
                      />
                    ))}
                  </div>
                </section>
              )
            })}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-2 bg-[#1e1f22] flex-shrink-0 min-h-[52px] flex items-center gap-3">
        {hovered ? (
          <>
            <TwemojiImg hexcode={hovered.hexcode} emoji={hovered.emoji} size={28} />
            <div className="min-w-0">
              <p className="text-sm text-white truncate capitalize">
                {hovered.shortcode.replace(/_/g, ' ')}
              </p>
              <p className="text-xs text-[#87898c] truncate">:{hovered.shortcode}:</p>
            </div>
          </>
        ) : (
          <p className="text-xs text-[#87898c]">Choisir un emoji…</p>
        )}
      </div>
    </div>
  )
}
