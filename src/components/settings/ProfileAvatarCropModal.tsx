import { useCallback, useEffect, useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { getCroppedImageBlob } from '../../lib/canvasCrop'

const MAX_FILE_BYTES = 15 * 1024 * 1024

type ProfileAvatarCropModalProps = {
  imageSrc: string
  onCancel: () => void
  onConfirm: (croppedPng: Blob) => void | Promise<void>
}

export function ProfileAvatarCropModal({ imageSrc, onCancel, onConfirm }: ProfileAvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (!busy) onCancel()
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [busy, onCancel])

  const handleConfirm = async () => {
    if (!croppedAreaPixels) {
      setError('Ajuste le cadrage avant de valider.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, 512)
      await onConfirm(blob)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Échec du recadrage')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
      data-waifutxt-avatar-crop-open=""
    >
      <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div className="relative w-[min(420px,94vw)] rounded-xl border border-border bg-bg-secondary shadow-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2 border-b border-border">
          <h4 id="avatar-crop-title" className="text-base font-semibold text-text-primary">
            Recadrer la photo
          </h4>
          <p className="text-xs text-text-muted mt-1">Glisse pour centrer, utilise le zoom si besoin.</p>
        </div>

        <div className="relative h-[min(52vh,320px)] w-full bg-bg-primary">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-4 py-3 space-y-3 border-t border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-muted shrink-0 w-10">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-accent-pink"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="flex-1 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-hover transition-colors cursor-pointer disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirm()}
              className="flex-1 py-2 rounded-md text-sm font-medium bg-accent-pink text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Envoi…' : 'Valider et envoyer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function validateAvatarFile(file: File): string | null {
  if (!file.type.startsWith('image/')) return 'Choisis une image (JPEG, PNG ou WebP).'
  if (file.type === 'image/gif') {
    return 'Pour un GIF animé, utilise le bouton « GIF animé » (sans recadrage).'
  }
  if (file.size > MAX_FILE_BYTES) return 'Image trop lourde (max. 15 Mo).'
  return null
}

/** GIF avatar upload: no canvas crop, animation preserved. */
export function validateGifAvatarFile(file: File): string | null {
  const isGifMime = file.type === 'image/gif'
  const isGifName = file.name.toLowerCase().endsWith('.gif')
  if (!isGifMime && !isGifName) return 'Choisis un fichier .gif.'
  if (file.size > MAX_FILE_BYTES) return 'GIF trop lourd (max. 15 Mo).'
  return null
}
