import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { MASSE, MODUL, fadenPfad, fadenStil, ohnePraefix } from "../../../modell.mjs"
import type { Raster } from "./raster"

interface Props {
  raster: Raster
  karten: Item[]
  faeden: RelationRecord[]
  hervorgehoben: string | null
}

/**
 * Die Fäden zwischen den Karten, als ein SVG hinter den Karten.
 *
 * Entwurf 1a: eine kubische Kurve von der rechten Kante der Voraussetzung zur
 * linken Kante der abhängigen Karte. Innerhalb einer Zeile trägt sie die
 * Phasenfarbe der abhängigen Karte, über Zeilen hinweg ist sie grau und
 * gestrichelt. Keine Umwege um fremde Karten, keine Start- und Ziel-Knoten
 * mehr — die Regel „nur nach rechts" gilt weiter, sie steht im Modell.
 *
 * Die Kopfzeile des Rasters liegt NICHT hier, sondern in `RasterKopf` — sie
 * muss oben kleben können.
 */
export function ThreadsOverlay({ raster, karten, faeden, hervorgehoben }: Props) {
  const { pos, breite, hoehe } = raster
  const sichtbar = karten.filter((k) => pos[k.id])
  const nachId = new Map(sichtbar.map((k) => [k.id, k]))
  const kanten = faeden
    .map((f) => ({ id: f.id, von: ohnePraefix(f.from), nach: ohnePraefix(f.to) }))
    .filter((k) => pos[k.von] && pos[k.nach])

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={breite}
      height={hoehe}
      viewBox={`0 0 ${breite} ${hoehe}`}
      aria-hidden
      data-modul={MODUL}
    >
      {raster.zeilen.map((z) => (
        <line key={z.ziel.id} x1={MASSE.start} y1={z.y} x2={breite - MASSE.end} y2={z.y} stroke="var(--border)" strokeWidth={1} />
      ))}

      {kanten.map((kante) => {
        const Q = pos[kante.von]
        const P = pos[kante.nach]
        const von = nachId.get(kante.von)!
        const nach = nachId.get(kante.nach)!
        const stil = fadenStil(von, nach)
        const hell = hervorgehoben === kante.von || hervorgehoben === kante.nach
        return (
          <path
            key={kante.id}
            fill="none"
            strokeLinecap="round"
            d={fadenPfad(Q.x + MASSE.cardW, Q.y + hoeheVon(raster, kante.von) / 2, P.x, P.y + hoeheVon(raster, kante.nach) / 2)}
            stroke={hell ? "var(--primary)" : stil.farbe}
            strokeWidth={hell ? stil.strich * 2 : stil.strich}
            strokeDasharray={stil.strichmuster}
            opacity={hell ? 1 : 0.85}
          />
        )
      })}
    </svg>
  )
}

/** Die gemessene Höhe einer Karte, damit der Faden ihre Mitte trifft. */
function hoeheVon(raster: Raster, id: string): number {
  return raster.kartenHoehe?.[id] ?? MASSE.cardH
}
