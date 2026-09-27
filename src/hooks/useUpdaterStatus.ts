import { useEffect, useState } from 'react'

// Desktop auto-update state (electron/main.cjs "setupAutoUpdater"). Always null on the web build.
export function useUpdaterStatus(): WaifuUpdaterStatus | null {
  const [status, setStatus] = useState<WaifuUpdaterStatus | null>(null)

  useEffect(() => {
    const api = window.waifuUpdater
    if (!api) return
    let cancelled = false
    const unsubscribe = api.onStatus((next) => setStatus(next))
    void api.getStatus().then((current) => {
      if (!cancelled) setStatus((prev) => prev ?? current)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return status
}
