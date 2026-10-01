import { useEffect, useState } from "react"
import { hasProfile, type DataInterface, type Item } from "@real-life-stack/data-interface"
import { ProfilePanelContent } from "@real-life-stack/toolkit"

/** Das eigene Profil, sobald der Connector es geladen hat (`undefined`: lädt noch). */
export function useMeinProfil(connector: DataInterface): Item | null | undefined {
  const [profil, setProfil] = useState<Item | null | undefined>(undefined)
  useEffect(() => {
    if (!hasProfile(connector)) return setProfil(null)
    const beobachtet = connector.observeMyProfile()
    const setze = (wert: Item | null) => setProfil(beobachtet.loaded === false ? undefined : wert)
    setze(beobachtet.current)
    return beobachtet.subscribe(setze)
  }, [connector])
  return profil
}

/**
 * Ein Profil ohne Anzeigenamen: Wer sich anonym anmeldet, hat noch keinen.
 * Kein Profil (`null`) heißt hier „noch nicht da“ — jedes Konto hat eine
 * Profilzeile, und kurz nach der Anmeldung liefert der Connector erst `null`.
 * Ohne Namen setzt der Supabase-Connector die Kennung als Namen ein.
 */
export function ohneNamen(profil: Item | null | undefined): boolean {
  if (!profil) return false
  const name = String(profil.data?.displayName ?? "").trim()
  return !name || name === profil.id
}

/**
 * Das eigene Profil im Panel, aus dem Toolkit (`ProfilePanelContent`). Wer
 * sich anonym anmeldet, braucht einen Anzeigenamen: Den zeigen die
 * Selbstaktionen „Kann ich“ und „Will lernen“, die Mitgliederliste und
 * „Erstellt von“.
 */
export function ProfilPanel({ connector, profil, onClose }: { connector: DataInterface; profil: Item | null; onClose: () => void }) {
  if (!hasProfile(connector) || !profil) return null
  const d = profil.data ?? {}
  return (
    <ProfilePanelContent
      mode="edit"
      profile={{
        did: profil.id,
        name: ohneNamen(profil) ? "" : String(d.displayName ?? ""),
        bio: typeof d.bio === "string" ? d.bio : undefined,
        avatar: typeof d.avatarUrl === "string" ? d.avatarUrl : undefined,
      }}
      onSave={async ({ name, bio, avatar }) => {
        await connector.updateMyProfile({ name: name.trim(), bio, ...(avatar !== undefined ? { avatar } : {}) })
      }}
      onClose={onClose}
    />
  )
}
