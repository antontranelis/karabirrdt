import { useEffect, useState, type ReactNode } from "react"
import { isAuthenticatable, type AuthState, type DataInterface } from "@real-life-stack/data-interface"
import { AuthScreen } from "@real-life-stack/toolkit"

/**
 * Ohne Anmeldung kein Brett. Die Anmeldung kommt aus dem Toolkit
 * (`AuthScreen`): anonym für den schnellen Einstieg am Tisch, E-Mail für alle,
 * die schon ein Konto haben. Die Schranke folgt dem Anmeldestand des
 * Connectors: Läuft die Sitzung ab oder meldet sich jemand in einem anderen
 * Tab ab, ist das Brett wieder zu.
 */
export function Anmeldung({ connector, children }: { connector: DataInterface; children: ReactNode }) {
  const [stand, setStand] = useState<AuthState["status"]>(() =>
    isAuthenticatable(connector) ? connector.getAuthState().current.status : "authenticated",
  )
  useEffect(() => {
    if (!isAuthenticatable(connector)) return
    const beobachtet = connector.getAuthState()
    setStand(beobachtet.current.status)
    return beobachtet.subscribe((s) => setStand(s.status))
  }, [connector])

  if (stand === "authenticated" || !isAuthenticatable(connector)) return <>{children}</>
  if (stand === "loading") return <div className="grid h-full place-items-center text-muted-foreground">Melde an …</div>
  return <AuthScreen connector={connector} title="Karabirrdt" onAuthenticated={() => setStand("authenticated")} />
}
