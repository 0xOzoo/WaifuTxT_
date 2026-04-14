function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback
}

function parseOriginList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean)
}

const allowedOrigins = parseOriginList(required('ALLOWED_ORIGIN'))
if (allowedOrigins.length === 0) {
  throw new Error('ALLOWED_ORIGIN must contain at least one origin')
}

export const config = {
  steamApiKey: required('STEAM_API_KEY'),
  matrixHomeserver: optional('MATRIX_HOMESERVER', 'https://matrix.org').replace(/\/+$/, ''),
  publicBaseUrl: required('PUBLIC_BASE_URL').replace(/\/+$/, ''),
  frontendUrl: required('FRONTEND_URL').replace(/\/+$/, ''),
  allowedOrigins,
  port: Number(optional('PORT', '3000')),
  dbPath: optional('DB_PATH', '/data/steam-presence.db'),
  pollIntervalSec: Number(optional('POLL_INTERVAL_SEC', '60')),
}
