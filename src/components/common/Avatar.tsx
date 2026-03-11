import { useEffect, useRef, useState } from 'react'
import { getClient } from '../../lib/matrix'

interface AvatarProps {
  src: string | null
  name: string
  size?: number
  className?: string
  status?: 'online' | 'offline' | 'unavailable' | null
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

export function Avatar({ src, name, size = 40, className = '', status }: AvatarProps) {
  const initials = getInitials(name)
  const bgColor = hashColor(name)
  const [displaySrc, setDisplaySrc] = useState<string | null>(src)
  const [showFallback, setShowFallback] = useState(!src)
  const [triedAuthFallback, setTriedAuthFallback] = useState(false)
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setDisplaySrc(src)
    setShowFallback(!src)
    setTriedAuthFallback(false)
  }, [src])

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

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
          className="w-full h-full rounded-full object-cover"
          onError={handleImageError}
        />
      ) : null}
      <div
        className={`w-full h-full rounded-full flex items-center justify-center text-white font-semibold ${displaySrc && !showFallback ? 'hidden' : ''}`}
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
