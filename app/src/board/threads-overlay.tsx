import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { MASSE, fadenPfad, ohnePraefix, stufeVon, MODUL } from "../../../modell.mjs"
import type { Raster } from "./raster"

interface Props {
  raster: Raster
  karten: Item[]
  faeden: RelationRecord[]
  hervorgehoben: string | null
}

/**
 * Die Fäden zwischen den Karten, als ein einziges SVG hinter den Karten.
 * Die Kopfzeile des Rasters liegt NICHT hier, sondern in `RasterKopf` — sie
 * muss oben kleben können.
 * Die Regeln sind die des Bretts: nur nach rechts, senkrecht in derselben
 * Spalte, Umweg über den Zeilenrand statt quer durch fremde Karten,
 * gestrichelt zu Start und Ziel für alles, was nirgends hängt.
 */
export function ThreadsOverlay({ raster, karten, faeden, hervorgehoben }: Props) {
  const { pos, breite, hoehe } = raster
  const mitte = (MASSE.head + hoehe) / 2
  const sichtbar = karten.filter((k) => pos[k.id])
  const nachId = new Map(sichtbar.map((k) => [k.id, k]))
  const kanten = faeden
    .map((f) => ({ von: ohnePraefix(f.from), nach: ohnePraefix(f.to), id: f.id }))
    .filter((k) => pos[k.von] && pos[k.nach])
  const hatNachfolger = new Set(kanten.map((k) => k.von))
  const hatVoraussetzung = new Set(kanten.map((k) => k.nach))

  const pfade: React.ReactNode[] = []

  for (const k of sichtbar) {
    const P = pos[k.id]
    if (!hatVoraussetzung.has(k.id))
      pfade.push(
        <path key={`start-${k.id}`} className="kb-faden kb-faden-rand" d={fadenPfad(MASSE.start / 2 + 20, mitte, P.x, P.y + MASSE.cardH / 2)} />,
      )
    if (!hatNachfolger.has(k.id))
      pfade.push(
        <path
          key={`ziel-${k.id}`}
          className="kb-faden kb-faden-rand"
          d={fadenPfad(P.x + MASSE.cardW, P.y + MASSE.cardH / 2, breite - MASSE.end / 2 - 20, mitte)}
        />,
      )
  }

  for (const kante of kanten) {
    const Q = pos[kante.von]
    const P = pos[kante.nach]
    const quelle = nachId.get(kante.von)!
    const ziel = nachId.get(kante.nach)!
    const hell = hervorgehoben === kante.von || hervorgehoben === kante.nach
    const klasse = `kb-faden${hell ? " kb-faden-hell" : ""}`
    const y1 = Q.y + MASSE.cardH / 2
    const y2 = P.y + MASSE.cardH / 2

    if (stufeVon(quelle) === stufeVon(ziel)) {
      const x = Q.x + MASSE.cardW / 2
      const ya = P.y > Q.y ? Q.y + MASSE.cardH : Q.y
      const yb = P.y > Q.y ? P.y : P.y + MASSE.cardH
      pfade.push(<path key={kante.id} className={klasse} d={fadenPfad(x, ya, x, yb, null, true)} />)
      continue
    }

    const lo = Math.min(y1, y2) - MASSE.cardH / 2
    const hi = Math.max(y1, y2) + MASSE.cardH / 2
    const blockiert = sichtbar.some(
      (o) =>
        o.id !== kante.von &&
        o.id !== kante.nach &&
        stufeVon(o) > stufeVon(quelle) &&
        stufeVon(o) < stufeVon(ziel) &&
        pos[o.id].y + MASSE.cardH > lo &&
        pos[o.id].y < hi,
    )
    const zeile = Q.zeile
    const via = blockiert ? (y2 >= y1 ? zeile.y + zeile.h - 5 : zeile.y + 5) : null
    pfade.push(<path key={kante.id} className={klasse} d={fadenPfad(Q.x + MASSE.cardW, y1, P.x, y2, via)} />)
  }

  return (
    <svg className="pointer-events-none absolute inset-0" width={breite} height={hoehe} viewBox={`0 0 ${breite} ${hoehe}`} aria-hidden data-modul={MODUL}>
      {/* Zeilentrenner */}
      {raster.zeilen.map((z) => (
        <line key={z.ziel.id} x1={MASSE.start} y1={z.y} x2={breite - MASSE.end} y2={z.y} stroke="var(--border)" strokeWidth={1} />
      ))}
      {/* Start und Ziel */}
      <circle cx={MASSE.start / 2 + 4} cy={mitte} r={16} fill="var(--foreground)" />
      <text x={MASSE.start / 2 + 4} y={mitte + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--background)">
        Start
      </text>
      <circle cx={breite - MASSE.end / 2 - 4} cy={mitte} r={16} fill="var(--kb-fete)" />
      <text x={breite - MASSE.end / 2 - 4} y={mitte + 3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--kb-auf-farbe)">
        Ziel
      </text>
      {pfade}
    </svg>
  )
}
