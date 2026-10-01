import { useEffect, useRef, useState, type ReactNode } from "react"
import { isAuthenticatable, type AuthState, type DataInterface } from "@real-life-stack/data-interface"
import { AuthScreen } from "@real-life-stack/toolkit"

/**
 * Ohne Anmeldung kein Brett. Die Anmeldung kommt aus dem Toolkit
 * (`AuthScreen`): anonym für den schnellen Einstieg am Tisch, E-Mail für alle,
 * die schon ein Konto haben. Die Schranke folgt dem Anmeldestand des
 * Connectors: Läuft die Sitzung ab oder meldet sich jemand in einem anderen
 * Tab ab, ist das Brett wieder zu.
 *
 * Endet eine Sitzung oder wechselt das Konto, lädt die Seite neu: Der Connector hält Space und
 * gelesene Items über die Sitzung hinaus, und ein anderes Konto dürfte sie
 * nie sehen. Ein frischer Connector ist die einzige saubere Grenze.
 */
export function Anmeldung({ connector, children }: { connector: DataInterface; children: ReactNode }) {
  const [stand, setStand] = useState<AuthState["status"]>(() =>
    isAuthenticatable(connector) ? connector.getAuthState().current.status : "authenticated",
  )
  // Wer angemeldet war (Kennung); eine Token-Erneuerung derselben Person
  // ändert sie nicht.
  const konto = useRef<string | null>(null)
  useEffect(() => {
    if (!isAuthenticatable(connector)) return
    const beobachtet = connector.getAuthState()
    const setze = (s: AuthState) => {
      if (s.status === "authenticated") {
        if (konto.current !== null && konto.current !== s.user.id) return location.reload()
        konto.current = s.user.id
      } else if (s.status === "unauthenticated" && konto.current !== null) return location.reload()
      setStand(s.status)
    }
    setze(beobachtet.current)
    return beobachtet.subscribe(setze)
  }, [connector])

  if (stand === "authenticated" || !isAuthenticatable(connector)) return <>{children}</>
  if (stand === "loading") return <div className="grid h-full place-items-center text-muted-foreground">Melde an …</div>
  return (
    <AuthScreen
      connector={connector}
      title="Karabirrdt"
      onAuthenticated={() => setStand("authenticated")}
    />
  )
}
