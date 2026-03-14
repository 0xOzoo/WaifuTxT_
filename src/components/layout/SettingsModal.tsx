import { useMemo, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { Avatar } from '../common/Avatar'

const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Profil' },
  { id: 'appearance', label: 'Apparence' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'account', label: 'Compte' },
] as const

type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']

export function SettingsModal() {
  const session = useAuthStore((s) => s.session)
  const setSettingsModal = useUiStore((s) => s.setSettingsModal)
  const showRoomMessagePreview = useUiStore((s) => s.showRoomMessagePreview)
  const setRoomMessagePreview = useUiStore((s) => s.setRoomMessagePreview)
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('profile')

  const username = useMemo(
    () => session?.userId?.split(':')[0]?.replace('@', '') || 'Utilisateur',
    [session?.userId],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Fermer les paramètres"
        onClick={() => setSettingsModal(false)}
      />

      <div className="relative w-[900px] max-w-[92vw] h-[620px] max-h-[88vh] rounded-xl overflow-hidden border border-border bg-bg-secondary shadow-2xl flex">
        <div className="w-60 border-r border-border bg-bg-primary/60 p-3">
          <h2 className="text-xs uppercase tracking-wide text-text-muted px-2 py-2">Paramètres</h2>
          <div className="space-y-1">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full px-2.5 py-2 rounded-md text-left text-sm transition-colors cursor-pointer ${
                  activeSection === section.id
                    ? 'bg-bg-hover text-text-primary'
                    : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-w-0 p-6 overflow-y-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-text-primary">
                {SETTINGS_SECTIONS.find((s) => s.id === activeSection)?.label}
              </h3>
              <p className="text-sm text-text-secondary mt-1">
                Cette section est la base des futurs paramètres customisables.
              </p>
            </div>
            <button
              onClick={() => setSettingsModal(false)}
              className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors cursor-pointer"
              aria-label="Fermer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {activeSection === 'profile' && (
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-lg border border-border bg-bg-primary/40 flex items-center gap-4">
                <Avatar src={null} name={session?.userId || '?'} size={56} status="online" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-text-primary truncate">{username}</p>
                  <p className="text-sm text-text-muted truncate">{session?.userId || 'Non connecté'}</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'appearance' && (
            <div className="mt-6 space-y-3">
              <div className="p-4 rounded-lg border border-border bg-bg-primary/40 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-text-primary">Aperçu des messages des salons</p>
                  <p className="text-xs text-text-secondary mt-1">
                    Affiche ou masque la ligne de prévisualisation sous le nom du salon dans la sidebar.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showRoomMessagePreview}
                  onClick={() => setRoomMessagePreview(!showRoomMessagePreview)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    showRoomMessagePreview ? 'bg-accent-pink' : 'bg-bg-hover'
                  }`}
                  title="Activer ou désactiver l'aperçu des messages"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      showRoomMessagePreview ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <div className="p-4 rounded-lg border border-border bg-bg-primary/40 text-sm text-text-secondary">
                Les options d'apparence avancées seront ajoutées ici (thèmes, couleurs, CSS custom, etc.).
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="mt-6 p-4 rounded-lg border border-border bg-bg-primary/40 text-sm text-text-secondary">
              Les préférences de notifications seront ajoutées ici.
            </div>
          )}

          {activeSection === 'account' && (
            <div className="mt-6 p-4 rounded-lg border border-border bg-bg-primary/40 text-sm text-text-secondary">
              Les réglages de compte seront ajoutés ici.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
