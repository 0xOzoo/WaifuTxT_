import { useEffect, useRef, useState } from 'react'
import { getOwnAvatarUrl, uploadProfileAvatar, uploadProfileAvatarGif } from '../../lib/matrix'
import { ProfileAvatarCropModal, validateAvatarFile, validateGifAvatarFile } from './ProfileAvatarCropModal'

type ProfileAvatarUploadProps = {
  disabled?: boolean
  onAvatarUpdated: (authenticatedHttpUrl: string | null) => void
}

export function ProfileAvatarUpload({ disabled, onAvatarUpdated }: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const gifInputRef = useRef<HTMLInputElement>(null)
  const gifPreviewBlobRef = useRef<string | null>(null)
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingGif, setUploadingGif] = useState(false)
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null)

  const revokeGifPreview = () => {
    if (gifPreviewBlobRef.current) {
      URL.revokeObjectURL(gifPreviewBlobRef.current)
      gifPreviewBlobRef.current = null
    }
    setGifPreviewUrl(null)
  }

  const setGifPreviewFromFile = (file: File) => {
    revokeGifPreview()
    const url = URL.createObjectURL(file)
    gifPreviewBlobRef.current = url
    setGifPreviewUrl(url)
  }

  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc)
    }
  }, [cropSrc])

  useEffect(() => {
    return () => {
      if (gifPreviewBlobRef.current) URL.revokeObjectURL(gifPreviewBlobRef.current)
    }
  }, [])

  const openPicker = () => {
    setUploadError(null)
    inputRef.current?.click()
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validateAvatarFile(file)
    if (err) {
      setUploadError(err)
      return
    }
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(URL.createObjectURL(file))
  }

  const closeCrop = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const handleCropped = async (blob: Blob) => {
    setUploading(true)
    setUploadError(null)
    try {
      await uploadProfileAvatar(blob)
      revokeGifPreview()
      closeCrop()
      onAvatarUpdated(getOwnAvatarUrl())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de l’envoi au serveur'
      setUploadError(msg)
    } finally {
      setUploading(false)
    }
  }

  const openGifPicker = () => {
    setUploadError(null)
    gifInputRef.current?.click()
  }

  const onGifFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const err = validateGifAvatarFile(file)
    if (err) {
      setUploadError(err)
      return
    }
    void uploadGif(file)
  }

  const uploadGif = async (file: File) => {
    setUploadingGif(true)
    setUploadError(null)
    try {
      await uploadProfileAvatarGif(file)
      setGifPreviewFromFile(file)
      onAvatarUpdated(getOwnAvatarUrl())
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Échec de l’envoi du GIF au serveur'
      setUploadError(msg)
    } finally {
      setUploadingGif(false)
    }
  }

  const busy = uploading || uploadingGif

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />
      <input
        ref={gifInputRef}
        type="file"
        accept="image/gif,.gif"
        className="hidden"
        onChange={onGifFileChange}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={openPicker}
          className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-bg-hover text-text-primary border border-border hover:bg-bg-hover/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Envoi en cours…' : 'Choisir une photo…'}
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={openGifPicker}
          className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-bg-hover text-text-primary border border-border hover:bg-bg-hover/80 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploadingGif ? 'Envoi du GIF…' : 'GIF animé…'}
        </button>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">
        Photo fixe : JPEG, PNG ou WebP, recadrage carré puis envoi sur le homeserver (profil Matrix global).
        GIF animé : envoi tel quel, sans recadrage, pour garder l’animation (fichier .gif uniquement).
      </p>
      {gifPreviewUrl && (
        <div className="rounded-lg border border-border bg-bg-primary/50 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="shrink-0">
            <p className="text-xs font-medium text-text-secondary mb-2">Aperçu du GIF envoyé</p>
            <img
              src={gifPreviewUrl}
              alt="Aperçu de ton avatar animé"
              className="w-28 h-28 rounded-full object-cover border border-border shadow-sm bg-bg-secondary"
            />
          </div>
          <p className="text-xs text-text-muted leading-relaxed flex-1 min-w-0">
            C’est exactement le fichier qui a été téléversé sur ton homeserver. L’avatar compact à côté peut rester une
            image fixe selon le serveur ; ici l’animation est toujours visible.
          </p>
        </div>
      )}
      {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
      {cropSrc && (
        <ProfileAvatarCropModal
          imageSrc={cropSrc}
          onCancel={() => !busy && closeCrop()}
          onConfirm={handleCropped}
        />
      )}
    </div>
  )
}
