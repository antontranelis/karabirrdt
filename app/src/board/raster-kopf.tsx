import { MASSE, PHASEN } from "../../../modell.mjs"
import type { Raster } from "./raster"

/**
 * Die Kopfzeile des Rasters: vier Phasenbänder, darunter die zwölf Stufen.
 * Sie steht in einem eigenen Element, damit sie beim senkrechten Scrollen
 * oben kleben kann — im SVG der Fäden ginge das nicht.
 */
export function RasterKopf({ raster }: { raster: Raster }) {
  return (
    <svg width={raster.breite} height={MASSE.head} viewBox={`0 0 ${raster.breite} ${MASSE.head}`} aria-hidden>
      {PHASEN.map((phase, i) => {
        const x0 = raster.spalte(i * 3) - MASSE.colW / 2 + 3
        const x1 = raster.spalte(i * 3 + 2) + MASSE.colW / 2 - 3
        return (
          <g key={phase.key}>
            <rect x={x0} y={8} width={x1 - x0} height={26} rx={5} fill={`var(--kb-${phase.key})`} />
            <text x={(x0 + x1) / 2} y={26} textAnchor="middle" fontSize={13.5} fontWeight={700} fill="var(--kb-auf-farbe)">
              {phase.name}
            </text>
            {phase.stufen.map((stufe: string, j: number) => {
              const x = raster.spalte(i * 3 + j)
              return (
                <g key={stufe}>
                  <rect x={x - MASSE.colW / 2 + 3} y={40} width={MASSE.colW - 6} height={24} rx={4} fill={`var(--kb-${phase.key}-weich)`} />
                  <text x={x} y={56} textAnchor="middle" fontSize={11.5} fill="var(--kb-auf-weich)">
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
