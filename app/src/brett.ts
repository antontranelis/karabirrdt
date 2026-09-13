/** Die Brett-Kennung steckt im Pfad: `/` ist `haupt`, `/emil` ist `emil`. */
export const KENNUNG = /^[a-z0-9][a-z0-9-]{0,63}$/

export function brettAusPfad(pfad = location.pathname): string {
  const name = pfad.replace(/^\/+|\/+$/g, "").toLowerCase()
  return KENNUNG.test(name) ? name : "haupt"
}

export const uid = () => Math.random().toString(36).slice(2, 10)
