import { useState } from 'react'
import { format } from 'date-fns'
import { useUpdaterStatus } from '../../hooks/useUpdaterStatus'

function describe(status: WaifuUpdaterStatus): { text: string; tone: 'muted' | 'ok' | 'accent' | 'danger' } {
  switch (status.state) {
    case 'unsupported':
      return status.reason === 'portable'
        ? { text: 'Version portable : mises à jour manuelles', tone: 'muted' }
        : { text: 'Mode développement', tone: 'muted' }
    case 'checking':
      return { text: 'Recherche de mises à jour…', tone: 'muted' }
    case 'not-available':
      return {
        text: `À jour${status.checkedAt ? ` · vérifié à ${format(status.checkedAt, 'HH:mm')}` : ''}`,
        tone: 'ok',
      }
    case 'available':
      return { text: `Version ${status.version ?? ''} disponible, téléchargement…`, tone: 'accent' }
    case 'downloading':
      return {
        text: `Téléchargement de la ${status.version ?? 'nouvelle version'}… ${status.percent ?? 0} %`,
        tone: 'accent',
      }
    case 'downloaded':
      return { text: `Version ${status.version ?? ''} prête à être installée`, tone: 'accent' }
    case 'error':
      return { text: 'Échec de la vérification des mises à jour', tone: 'danger' }
    default:
      return { text: 'Pas encore vérifié', tone: 'muted' }
  }
}

const TONE_CLASS = {
  muted: 'text-text-muted',
  ok: 'text-success',
  accent: 'text-accent-pink',
  danger: 'text-danger',
} as const

export function AppVersionSettings() {
  const status = useUpdaterStatus()
  const [checking, setChecking] = useState(false)

  const handleCheck = async () => {
    if (!window.waifuUpdater) return
    setChecking(true)
    try {
      await window.waifuUpdater.checkNow()
    } finally {
      setChecking(false)
    }
  }

  const info = status ? describe(status) : null
  const busy =
    checking || status?.state === 'checking' || status?.state === 'available' || status?.state === 'downloading'
  const canCheck = status && status.state !== 'unsupported' && status.state !== 'downloaded'

  return (
    <div className="px-4 py-2.5 rounded-lg border border-border bg-bg-primary/40 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-text-muted">Version</span>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-text-secondary">{__APP_VERSION__}</span>
          {canCheck && (
            <button
              type="button"
              onClick={() => void handleCheck()}
              disabled={busy}
              title="Rechercher une mise à jour"
              aria-label="Rechercher une mise à jour"
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {info && (
        <div className="flex items-center justify-between gap-3">
          <span className={`text-xs ${TONE_CLASS[info.tone]}`} title={status?.message}>
            {info.text}
          </span>
          {status?.state === 'downloaded' && (
            <button
              type="button"
              onClick={() => window.waifuUpdater?.restartAndInstall()}
              className="shrink-0 px-3 py-1.5 bg-accent-pink text-white text-xs rounded-md hover:bg-accent-pink-hover transition-colors cursor-pointer"
            >
              Redémarrer maintenant
            </button>
          )}
        </div>
      )}
    </div>
  )
}
