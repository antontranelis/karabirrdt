import type { Group } from "@real-life-stack/data-interface"
import { KENNUNG, MODUL, freieKennung } from "../../modell.mjs"

/**
 * Ein Brett ist eine Group mit dem Modul `karabirrdt`. Seine Adresse ist der
 * Slug in `Group.data.slug` (Stopp-Punkt 3): Eine Group-Id vom Aufrufer gibt
 * es im Stack nicht (rls#549), die Id vergibt der Server. `/<slug>` löst
 * unter den Brettern auf, die die angemeldete Person sieht.
 */
export const istBrett = (g: Group) => Array.isArray(g.data?.modules) && (g.data.modules as unknown[]).includes(MODUL)

export const slugVon = (g: Group): string => (typeof g.data?.slug === "string" && g.data.slug ? g.data.slug : g.id)

/** Der Slug im Pfad, oder null für `/` und alles, was kein Slug sein kann. */
export function slugAusPfad(pfad: string): string | null {
  const name = pfad.replace(/^\/+|\/+$/g, "").toLowerCase()
  return KENNUNG.test(name) ? name : null
}

export type Start = { art: "brett"; gruppe: Group } | { art: "unbekannt"; slug: string } | { art: "keins" }

/**
 * Welches Brett beim Öffnen gilt: das der Adresse, sonst das erste. Eine
 * Adresse, die es unter den eigenen Brettern nicht gibt, ist „unbekannt“ —
 * das Brett gibt es nicht, oder man ist (noch) kein Mitglied.
 */
export function startBrett(bretter: readonly Group[], slug: string | null): Start {
  if (slug) {
    const treffer = bretter.find((g) => slugVon(g) === slug)
    return treffer ? { art: "brett", gruppe: treffer } : { art: "unbekannt", slug }
  }
  return bretter[0] ? { art: "brett", gruppe: bretter[0] } : { art: "keins" }
}

/** Die Daten eines neuen Bretts: eine freie Adresse aus dem Namen. */
export function neuesBrett(name: string, belegt: readonly string[]) {
  return { scope: "group", modules: [MODUL], slug: freieKennung(name, [...belegt]), dream: "", horizon: "" }
}
