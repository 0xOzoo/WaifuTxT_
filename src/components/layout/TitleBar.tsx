import { useEffect, useState } from 'react'

// Title bar of the frameless desktop window (electron/main.cjs "setupWindowControls"), like
// Discord's. Renders nothing on the web build and on macOS, and hides itself in fullscreen.
// The space it takes is published as --titlebar-height (styles/theme.css) so the layout makes room.
export function TitleBar() {
  const api = window.waifuWindow
  const [state, setState] = useState<WaifuWindowState>({ maximized: false, fullscreen: false })

  useEffect(() => {
    if (!api) return
    let cancelled = false
    const unsubscribe = api.onState(setState)
    void api.getState().then((current) => {
      if (!cancelled) setState(current)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [api])

  const visible = !!api && !state.fullscreen

  useEffect(() => {
    const root = document.documentElement
    if (visible) root.setAttribute('data-titlebar', '')
    else root.removeAttribute('data-titlebar')
  }, [visible])

  if (!api || !visible) return null

  const buttonClass =
    'app-no-drag h-full w-[46px] flex items-center justify-center text-text-secondary transition-colors cursor-default focus-visible:outline-none focus-visible:bg-bg-hover'

  return (
    <div className="app-drag fixed top-0 inset-x-0 z-[200] h-[var(--titlebar-height)] flex items-center bg-bg-primary select-none">
      <div className="flex items-center gap-1.5 pl-3 pointer-events-none">
        <img src="/favicon.png" alt="" className="w-3.5 h-3.5" draggable={false} />
        <span className="text-[12px] font-semibold tracking-wide text-text-secondary">WaifuChat</span>
      </div>

      <div className="ml-auto flex h-full">
        <button
          type="button"
          onClick={api.minimize}
          className={`${buttonClass} hover:bg-bg-hover hover:text-text-primary`}
          title="Réduire"
          aria-label="Réduire"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0 5h10" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          type="button"
          onClick={api.toggleMaximize}
          className={`${buttonClass} hover:bg-bg-hover hover:text-text-primary`}
          title={state.maximized ? 'Restaurer' : 'Agrandir'}
          aria-label={state.maximized ? 'Restaurer' : 'Agrandir'}
        >
          {state.maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M2.5 2.5V0.5h7v7h-2" stroke="currentColor" strokeWidth="1" />
              <rect x="0.5" y="2.5" width="7" height="7" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={api.close}
          className={`${buttonClass} hover:bg-[#e81123] hover:text-white`}
          title="Fermer"
          aria-label="Fermer"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </div>
    </div>
  )
}
