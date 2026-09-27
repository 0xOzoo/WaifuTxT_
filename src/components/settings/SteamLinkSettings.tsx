import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import {
  getOwnSteamLink,
  startSteamLink,
  unlinkSteam,
  type SteamLinkInfo,
} from '../../lib/steamPresence'

type Flash = { kind: 'success' | 'error'; message: string } | null

function consumeCallbackFlash(): Flash {
  const params = new URLSearchParams(window.location.search)
  const status = params.get('steam')
  if (!status) return null

  params.delete('steam')
  params.delete('reason')
  const qs = params.toString()
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
  window.history.replaceState(null, '', url)

  if (status === 'linked') return { kind: 'success', message: 'Compte Steam lié.' }
  const reason = new URLSearchParams(window.location.search).get('reason') ?? ''
  return { kind: 'error', message: `Échec de la liaison Steam${reason ? ` (${reason})` : ''}.` }
}

export function SteamLinkSettings({ disabled }: { disabled?: boolean }) {
  const session = useAuthStore((s) => s.session)
  const [info, setInfo] = useState<SteamLinkInfo | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [awaitingBrowser, setAwaitingBrowser] = useState(false)
  const [flash, setFlash] = useState<Flash>(() => consumeCallbackFlash())

  const refresh = useCallback(async (): Promise<SteamLinkInfo | null> => {
    if (!session) return null
    try {
      const i = await getOwnSteamLink(session.accessToken)
      setInfo(i)
      setCheckError(null)
      return i
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Vérification Steam impossible')
      return null
    }
  }, [session])

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }
    setLoading(true)
    void refresh().finally(() => setLoading(false))
  }, [session, refresh])

  // Desktop: the Steam login happens in the system browser, so re-check when the user comes back.
  useEffect(() => {
    if (!awaitingBrowser) return
    const onFocus = () => {
      void refresh().then((i) => {
        if (i?.linked) {
          setAwaitingBrowser(false)
          setFlash({ kind: 'success', message: 'Compte Steam lié.' })
        }
      })
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [awaitingBrowser, refresh])

  const handleLink = async () => {
    if (!session) return
    setWorking(true)
    setFlash(null)
    try {
      const current = await getOwnSteamLink(session.accessToken)
      setInfo(current)
      setCheckError(null)
      if (current.linked) {
        setFlash({ kind: 'success', message: 'Ce compte est déjà lié à Steam.' })
        setWorking(false)
        return
      }
      const url = await startSteamLink(session.accessToken)
      if (window.waifuSteam) {
        window.open(url, '_blank')
        setAwaitingBrowser(true)
        setWorking(false)
      } else {
        window.location.href = url
      }
    } catch (err) {
      setFlash({ kind: 'error', message: err instanceof Error ? err.message : 'Erreur' })
      setWorking(false)
    }
  }

  const handleUnlink = async () => {
    if (!session) return
    setWorking(true)
    setFlash(null)
    try {
      await unlinkSteam(session.accessToken)
      setInfo({ linked: false, steamId: null, linkedAt: null })
      setFlash({ kind: 'success', message: 'Compte Steam délié.' })
    } catch (err) {
      setFlash({ kind: 'error', message: err instanceof Error ? err.message : 'Erreur' })
    } finally {
      setWorking(false)
    }
  }

  const isDisabled = disabled || !session || loading || working

  return (
    <div className="rounded-lg border border-border/80 bg-bg-secondary/40 p-3 space-y-2">
      <p className="text-sm font-medium text-text-primary">Steam</p>
      <p className="text-xs text-text-muted leading-relaxed">
        Liez votre compte Steam pour afficher le jeu en cours dans votre profil. La liaison utilise
        OpenID Steam et ne transmet pas votre mot de passe à WaifuChat.
      </p>

      {!info && checkError ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-danger">{checkError}</span>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => {
              setLoading(true)
              void refresh().finally(() => setLoading(false))
            }}
            className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Vérification…' : 'Réessayer'}
          </button>
        </div>
      ) : info?.linked ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-text-secondary font-mono truncate">
            SteamID : {info.steamId}
          </span>
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => void handleUnlink()}
            className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium border border-border text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {working ? '…' : 'Délier'}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {awaitingBrowser && (
            <span className="mr-auto text-xs text-text-muted">
              Termine la liaison dans ton navigateur, puis reviens ici.
            </span>
          )}
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => void handleLink()}
            className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium bg-accent-pink text-white hover:bg-accent-pink-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Chargement…' : working ? 'Vérification…' : 'Lier un compte Steam'}
          </button>
        </div>
      )}

      {flash && (
        <p className={`text-xs ${flash.kind === 'success' ? 'text-success' : 'text-danger'}`}>
          {flash.message}
        </p>
      )}
    </div>
  )
}
