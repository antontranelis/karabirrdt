import { MASSE, PHASEN } from "../../../modell.mjs"

/** Luft über den Bändern — Innenabstand des klebenden Kopfes. */
export const LUFT = 6
import type { Raster } from "./raster"

/**
 * Die Kopfzeile des Rasters: vier Phasenbänder, darunter die zwölf Stufen.
 * Sie steht in einem eigenen Element, damit sie beim senkrechten Scrollen
 * oben kleben kann — im SVG der Fäden ginge das nicht.
 */
export function RasterKopf({ raster }: { raster: Raster }) {
  // Die Bänder beginnen bei 0: die Luft darüber gehört INS klebende Element
  // (als Innenabstand), nicht davor — sonst bleibt dort ein durchsichtiger
  // Streifen, durch den die Karten scrollen. Maße aus Entwurf 1a:
  // Phasenband 20 hoch, Stufenzeile 18, dazwischen 4.
  return (
    <svg
      className="block"
      width={raster.breite}
      height={MASSE.head - LUFT}
      viewBox={`0 0 ${raster.breite} ${MASSE.head - LUFT}`}
      aria-hidden
    >
      {PHASEN.map((phase, i) => {
        const x0 = raster.spalte(i * 3) - MASSE.kachel / 2
        const x1 = raster.spalte(i * 3 + 2) + MASSE.kachel / 2
        return (
          <g key={phase.key}>
            <rect x={x0} y={0} width={x1 - x0} height={MASSE.band} rx={4} fill={`var(--kb-${phase.key})`} />
            <text
              x={(x0 + x1) / 2}
              y={MASSE.band / 2 + 4}
              textAnchor="middle"
              fontSize={11.5}
              fontWeight={600}
              fill="var(--kb-auf-farbe)"
            >
              {phase.name}
            </text>
            {phase.stufen.map((stufe: string, j: number) => {
              const x = raster.spalte(i * 3 + j)
              return (
                <g key={stufe}>
                  <rect
                    x={x - MASSE.kachel / 2}
                    y={MASSE.band + MASSE.luft}
                    width={MASSE.kachel}
                    height={MASSE.stufe}
                    rx={3}
                    fill={`var(--kb-${phase.key}-weich)`}
                  />
                  <text
                    x={x}
                    y={MASSE.band + MASSE.luft + MASSE.stufe / 2 + 3.5}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontWeight={600}
                    fill={`var(--kb-${phase.key}-dunkel)`}
                  >
                    {stufe}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
