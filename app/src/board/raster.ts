import type { Item } from "@real-life-stack/data-interface"
import { layout, spaltenX, MASSE } from "../../../modell.mjs"

export interface Zeile {
  ziel: Item
  y: number
  h: number
}
export interface KartenPos {
  x: number
  y: number
  zeile: Zeile
}
export interface Raster {
  zeilen: Zeile[]
  pos: Record<string, KartenPos>
  hoehe: number
  breite: number
  spalte: (stufe: number) => number
}

/** Das Raster des Bretts. Die Rechnung selbst steht in `modell.mjs`. */
export function raster(ziele: Item[], karten: Item[], hoehen: Record<string, number> = {}): Raster {
  const L = layout(ziele, karten, hoehen) as Omit<Raster, "spalte">
  return { ...L, spalte: spaltenX }
}

/** Welche Zelle liegt unter diesem Punkt im Raster? */
export function zelleBei(r: Raster, x: number, y: number): { zielId: string; stufe: number } | null {
  const zeile = r.zeilen.find((z) => y >= z.y && y < z.y + z.h)
  const stufe = Math.floor((x - MASSE.start - MASSE.label) / MASSE.colW)
  if (!zeile || stufe < 0 || stufe > 11) return null
  return { zielId: zeile.ziel.id, stufe }
}
