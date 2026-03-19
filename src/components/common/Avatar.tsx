import { useEffect, useRef, useState } from 'react'
import { getClient, getMediaUrlWithAccessToken } from '../../lib/matrix'

interface AvatarProps {
  src: string | null
  name: string
  size?: number
  className?: string
  status?: 'online' | 'offline' | 'unavailable' | null
  shape?: 'circle' | 'rounded'
}

function getInitials(name: string): string {
  return name
    .split(/[\s@:_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('')
}

function hashColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = ['#ff2d78', '#4dabf7', '#3ddc84', '#ffb347', '#a855f7', '#06b6d4', '#f43f5e']
  return colors[Math.abs(hash) % colors.length]
}

function isVoiceDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem('waifutxt_debug_voice') === '1'
  } catch {
    return false
  }
}

export function Avatar({ src, name, size = 40, className = '', status, shape = 'circle' }: AvatarProps) {
  const initials = getInitials(name)
  const bgColor = hashColor(name)
  const [displaySrc, setDisplaySrc] = useState<string | null>(() => (src ? (getMediaUrlWithAccessToken(src) || src) : null))
  const [showFallback, setShowFallback] = useState(!src)
  const [triedAuthFallback, setTriedAuthFallback] = useState(false)
  const [triedDownloadFallback, setTriedDownloadFallback] = useState(false)
  const [morphClass, setMorphClass] = useState('')
  const blobUrlRef = useRef<string | null>(null)
  const prevShapeRef = useRef(shape)
  const avatarRadiusClass = shape === 'rounded' ? 'rounded-xl' : 'rounded-full'

  useEffect(() => {
    setDisplaySrc(src ? (getMediaUrlWithAccessToken(src) || src) : null)
    setShowFallback(!src)
    setTriedAuthFallback(false)
    setTriedDownloadFallback(false)
  }, [src])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  useEffect(() => {
    if (prevShapeRef.current === shape) return
    const nextMorph = shape === 'rounded' ? 'avatar-liquid-to-rounded' : 'avatar-liquid-to-circle'
    setMorphClass(nextMorph)
    const timeout = setTimeout(() => setMorphClass(''), 420)
    prevShapeRef.current = shape
    return () => clearTimeout(timeout)
  }, [shape])

  const tryAuthenticatedFallback = async () => {
    if (!displaySrc) return false
    const client = getClient()
    const token = client?.getAccessToken()
    if (!token) return false

    try {
      const res = await fetch(displaySrc, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return false
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = blobUrl
      setDisplaySrc(blobUrl)
      return true
    } catch {
      return false
    }
  }

  const handleImageError = async () => {
    if (isVoiceDebugEnabled()) {
      console.debug('[VoiceDebug] Avatar load error', {
        name,
        src,
        displaySrc,
        triedDownloadFallback,
        triedAuthFallback,
      })
    }
    if (!triedDownloadFallback && displaySrc && displaySrc.includes('/media/thumbnail/')) {
      let downloadSrc = displaySrc
      try {
        const u = new URL(displaySrc)
        u.pathname = u.pathname.replace('/media/thumbnail/', '/media/download/')
        const token = u.searchParams.get('access_token')
        u.search = ''
        if (token) u.searchParams.set('access_token', token)
        downloadSrc = u.toString()
      } catch {
        const parts = displaySrc.split('?')
        const base = parts[0].replace('/media/thumbnail/', '/media/download/')
        const accessTokenPart = (parts[1] || '')
          .split('&')
          .find((p) => p.startsWith('access_token='))
        downloadSrc = accessTokenPart ? `${base}?${accessTokenPart}` : base
      }
      setTriedDownloadFallback(true)
      setDisplaySrc(downloadSrc)
      if (isVoiceDebugEnabled()) {
        console.debug('[VoiceDebug] Avatar fallback thumbnail->download', { name, from: displaySrc, to: downloadSrc })
      }
      return
    }
    if (triedAuthFallback) {
      setShowFallback(true)
      return
    }
    setTriedAuthFallback(true)
    const recovered = await tryAuthenticatedFallback()
    if (!recovered) setShowFallback(true)
  }

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      {displaySrc && !showFallback ? (
        <img
          src={displaySrc}
          alt={name}
          className={`w-full h-full object-cover transition-[border-radius,transform] duration-100 ease-out ${avatarRadiusClass} ${morphClass}`}
          onError={handleImageError}
        />
      ) : null}
      <div
        className={`w-full h-full ${avatarRadiusClass} flex items-center justify-center text-white font-semibold transition-[border-radius,transform] duration-100 ease-out ${morphClass} ${displaySrc && !showFallback ? 'hidden' : ''}`}
        style={{ backgroundColor: bgColor, fontSize: size * 0.4 }}
      >
        {initials}
      </div>
      {status && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-bg-secondary ${
            status === 'online' ? 'bg-success' : status === 'unavailable' ? 'bg-warning' : 'bg-text-muted'
          }`}
        />
      )}
    </div>
  )
}
