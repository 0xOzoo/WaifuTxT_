import { useEffect, useState } from 'react'

// Shows up only once a new desktop build has finished downloading in the
// background (electron/main.cjs "setupAutoUpdater"). Renders nothing on the
// web build or while nothing is ready yet — no noise for the common case.
export function UpdateBanner() {
  const [status, setStatus] = useState<WaifuUpdaterStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = window.waifuUpdater
    if (!api) return
    return api.onStatus((next) => {
      if (next.state === 'downloaded') setDismissed(false)
      setStatus(next)
    })
  }, [])

  if (!status || status.state !== 'downloaded' || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] w-[320px] max-w-[calc(100vw-2rem)] rounded-lg border border-accent-pink/30 bg-bg-secondary shadow-2xl p-3">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-accent-pink mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">Mise à jour prête</p>
          <p className="text-xs text-text-secondary mt-0.5">
            WaifuChat {status.version} a été téléchargée. Redémarre pour l'appliquer.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => window.waifuUpdater?.restartAndInstall()}
              className="px-3 py-1.5 bg-accent-pink text-white text-xs rounded-md hover:bg-accent-pink-hover transition-colors cursor-pointer"
            >
              Redémarrer maintenant
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-text-muted text-xs hover:text-text-secondary transition-colors cursor-pointer"
            >
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
