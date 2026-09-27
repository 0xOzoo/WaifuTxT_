/**
 * Client for the steam-presence backend service.
 * The backend is reached via an nginx proxy at /api/steam/* in production,
 * overridable via VITE_STEAM_PRESENCE_BASE_URL for local dev. In the desktop app,
 * requests go through the Electron main process (window.waifuSteam) instead.
 */

const BASE_URL =
  (import.meta.env.VITE_STEAM_PRESENCE_BASE_URL as string | undefined)?.replace(/\/+$/, '') ??
  '/api/steam'

export type SteamStatus = {
  game: string
  gameId: string | null
  since: number | null
  updatedAt: number
}

export type SteamLinkInfo = {
  linked: boolean
  steamId: string | null
  linkedAt: number | null
}

type SteamResponse = { ok: boolean; status: number; data: unknown }

async function steamRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  token?: string,
): Promise<SteamResponse> {
  let status: number
  let text: string
  if (window.waifuSteam) {
    ;({ status, body: text } = await window.waifuSteam.request(method, path, token))
  } else {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : undefined,
    })
    status = res.status
    text = await res.text()
  }
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      throw new Error(`Service Steam injoignable (réponse invalide, HTTP ${status})`)
    }
  }
  return { ok: status >= 200 && status < 300, status, data }
}

const STATUS_CACHE_TTL_MS = 30_000

type CacheEntry = { value: SteamStatus | null; fetchedAt: number }
const statusCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<SteamStatus | null>>()

export function clearSteamStatusCache(): void {
  statusCache.clear()
}

export async function getSteamStatus(matrixUserId: string): Promise<SteamStatus | null> {
  const now = Date.now()
  const cached = statusCache.get(matrixUserId)
  if (cached && now - cached.fetchedAt < STATUS_CACHE_TTL_MS) {
    return cached.value
  }
  const existing = inflight.get(matrixUserId)
  if (existing) return existing

  const promise = (async () => {
    try {
      const res = await steamRequest('GET', `/status/${encodeURIComponent(matrixUserId)}`)
      if (!res.ok) return null
      const body = res.data as SteamStatus | null
      statusCache.set(matrixUserId, { value: body, fetchedAt: Date.now() })
      return body
    } catch {
      return null
    } finally {
      inflight.delete(matrixUserId)
    }
  })()

  inflight.set(matrixUserId, promise)
  return promise
}

export async function getOwnSteamLink(accessToken: string): Promise<SteamLinkInfo> {
  const res = await steamRequest('GET', '/link/me', accessToken)
  if (!res.ok) throw new Error(`Vérification Steam impossible (HTTP ${res.status})`)
  return res.data as SteamLinkInfo
}

export async function startSteamLink(accessToken: string): Promise<string> {
  const res = await steamRequest('POST', '/link/start', accessToken)
  if (!res.ok) throw new Error(`Démarrage de la liaison Steam impossible (HTTP ${res.status})`)
  return (res.data as { redirectUrl: string }).redirectUrl
}

export async function unlinkSteam(accessToken: string): Promise<void> {
  const res = await steamRequest('DELETE', '/link/me', accessToken)
  if (!res.ok) throw new Error(`Déliaison Steam impossible (HTTP ${res.status})`)
}
