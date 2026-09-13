import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { cn } from "@real-life-stack/toolkit"
import { KANN_PRAEDIKAT, LERNT_PRAEDIKAT, PHASEN, istErledigt, ohnePraefix, stufeVon, zieleSortiert, zielVonKarte, zugewiesen } from "../../../modell.mjs"

interface Props {
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
}

/** Die Prüfung: Phasenabdeckung, Lücken, Hebelpunkte, Summen. */
export function PruefungPanel({ ziele, karten, faeden }: Props) {
  const stunden = karten.reduce((a, k) => a + (Number(k.data?.hours) || 0), 0)
  const euro = karten.reduce((a, k) => a + (Number(k.data?.euros) || 0), 0)
  const fertig = karten.filter(istErledigt).length
  const grad = (id: string) => faeden.filter((f) => ohnePraefix(f.from) === id || ohnePraefix(f.to) === id).length
  // „Ohne Namen" heißt: niemand kann sie und niemand will sie lernen.
  const ohneNamen = karten.filter((k) => !zugewiesen(k, KANN_PRAEDIKAT).length && !zugewiesen(k, LERNT_PRAEDIKAT).length)
  const ohneFaden = karten.filter((k) => grad(k.id) === 0)
  const hebel = karten
    .map((k) => ({ k, d: grad(k.id) }))
    .filter((x) => x.d >= 3)
    .sort((a, b) => b.d - a.d)
    .slice(0, 5)

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Prüfung</h2>
      <div className="flex gap-5 font-mono text-sm">
        <Zahl wert={karten.length} was="Karten" />
        <Zahl wert={fertig} was="erledigt" />
        <Zahl wert={stunden} was="Stunden" />
        <Zahl wert={euro} was="Euro" />
      </div>

      <Abschnitt titel="Phasen je Ziel">
        <div className="grid grid-cols-[1fr_repeat(4,2rem)] gap-x-2 gap-y-0.5 font-mono text-xs">
          <span />
          {PHASEN.map((p) => (
            <span key={p.key} className="text-center">
              {p.name.slice(0, 2)}
            </span>
          ))}
          {(zieleSortiert(ziele) as Item[]).map((z) => (
            <ZielZeile key={z.id} ziel={z} karten={karten} />
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Ein Strich heißt: diese Phase hat für das Ziel noch keine Karte. Feiern und Träumen fehlen erfahrungsgemäß zuerst.
        </p>
      </Abschnitt>

      <Abschnitt titel="Ohne Namen">
        <Liste eintraege={ohneNamen.map((k) => String(k.data?.title ?? ""))} warnen />
      </Abschnitt>

      <Abschnitt titel="Ohne Fäden">
        <Liste eintraege={ohneFaden.map((k) => String(k.data?.title ?? ""))} warnen />
        <p className="mt-1 text-xs text-muted-foreground">
          Karten, die nur an Start und Ziel hängen. Gehört wirklich nichts davor oder danach?
        </p>
      </Abschnitt>

      <Abschnitt titel="Hebelpunkte">
        <Liste eintraege={hebel.map((x) => `${String(x.k.data?.title ?? "")} (${x.d} Fäden)`)} />
      </Abschnitt>
    </div>
  )
}

const Zahl = ({ wert, was }: { wert: number; was: string }) => (
  <div>
    <b className="block text-lg font-medium">{wert}</b>
    {was}
  </div>
)

const Abschnitt = ({ titel, children }: { titel: string; children: React.ReactNode }) => (
  <section className="border-t pt-3">
    <h3 className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{titel}</h3>
    {children}
  </section>
)

const Liste = ({ eintraege, warnen }: { eintraege: string[]; warnen?: boolean }) =>
  eintraege.length ? (
    <ul className="list-disc pl-5 text-sm">
      {eintraege.map((e) => (
        <li key={e} className={cn(warnen && "text-destructive")}>
          {e}
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">nichts</p>
  )

function ZielZeile({ ziel, karten }: { ziel: Item; karten: Item[] }) {
  const eigene = karten.filter((k) => zielVonKarte(k) === ziel.id)
  return (
    <>
      <span className="truncate" title={String(ziel.data?.title ?? "")}>
        {String(ziel.data?.title ?? "").split(":")[0]}
      </span>
      {PHASEN.map((_, i) => {
        const n = eigene.filter((k) => Math.floor(stufeVon(k) / 3) === i).length
        return (
          <span key={i} className={cn("text-center", !n && "text-destructive")}>
            {n || "–"}
          </span>
        )
      })}
    </>
  )
}
