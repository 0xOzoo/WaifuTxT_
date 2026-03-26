import { useState, useCallback, useRef, useEffect } from 'react'
import {
  getQuickReactions,
  setQuickReactions,
  emojiToQuickEntry,
  TwemojiImg,
  EmojiPicker,
  addRecentEmoji,
  DEFAULT_QUICK_REACTIONS,
  type QuickReactionEntry,
} from '../common/EmojiPicker'

export function CustomizationSettings() {
  const [reactions, setReactions] = useState<QuickReactionEntry[]>(getQuickReactions)
  const [showPicker, setShowPicker] = useState(false)
  const [saved, setSaved] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (
        pickerRef.current?.contains(e.target as Node) ||
        addBtnRef.current?.contains(e.target as Node)
      )
        return
      setShowPicker(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  const handleAddEmoji = useCallback(
    (emoji: string) => {
      if (reactions.some((r) => r.emoji === emoji)) return
      const entry = emojiToQuickEntry(emoji)
      if (!entry) return
      addRecentEmoji(emoji)
      setReactions((prev) => [...prev, entry])
      setShowPicker(false)
    },
    [reactions],
  )

  const handleRemove = useCallback((emoji: string) => {
    setReactions((prev) => prev.filter((r) => r.emoji !== emoji))
  }, [])

  const handleSave = useCallback(() => {
    setQuickReactions(reactions)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }, [reactions])

  const handleReset = useCallback(() => {
    setReactions(DEFAULT_QUICK_REACTIONS)
  }, [])

  return (
    <div className="mt-6 space-y-4">
      <div className="p-4 rounded-lg border border-border bg-bg-primary/40 space-y-4">
        <div>
          <p className="text-sm font-medium text-text-primary">Réactions rapides</p>
          <p className="text-xs text-text-secondary mt-1">
            Ces émojis apparaissent en haut du panneau de réactions pour un accès immédiat.
            Maximum&nbsp;18.
          </p>
        </div>

        {/* Current list */}
        <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 rounded-md bg-bg-tertiary/50 border border-border/60">
          {reactions.length === 0 ? (
            <span className="text-xs text-text-muted self-center px-1">Aucune réaction rapide</span>
          ) : (
            reactions.map(({ emoji, hexcode }) => (
              <div
                key={emoji}
                className="group relative flex items-center justify-center w-9 h-9 rounded-md bg-bg-secondary hover:bg-bg-hover border border-border/60 transition-colors"
              >
                <TwemojiImg hexcode={hexcode} emoji={emoji} size={20} />
                <button
                  onClick={() => handleRemove(emoji)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-danger text-white text-[9px] leading-none cursor-pointer shadow"
                  title="Retirer"
                  aria-label={`Retirer ${emoji}`}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add button + picker */}
        <div className="relative inline-block">
          <button
            ref={addBtnRef}
            onClick={() => setShowPicker((v) => !v)}
            disabled={reactions.length >= 18}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Ajouter un émoji
          </button>
          {showPicker && (
            <div ref={pickerRef} className="absolute left-0 top-full mt-1 z-40">
              <EmojiPicker
                onSelect={(emoji) => {
                  handleAddEmoji(emoji)
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/40">
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md text-sm font-medium bg-accent-pink text-white hover:bg-accent-pink-hover transition-colors cursor-pointer"
          >
            {saved ? '✓ Enregistré' : 'Enregistrer'}
          </button>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-md text-sm border border-border text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
          >
            Réinitialiser
          </button>
        </div>
      </div>
    </div>
  )
}
