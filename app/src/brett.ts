import { KENNUNG } from "../../modell.mjs"

/** Die Brett-Kennung steckt im Pfad: `/` ist `haupt`, `/emil` ist `emil`. */
export function brettAusPfad(pfad = location.pathname): string {
  const name = pfad.replace(/^\/+|\/+$/g, "").toLowerCase()
  return KENNUNG.test(name) ? name : "haupt"
}
