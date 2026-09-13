import { useState } from "react"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import {
  Button,
  DeleteConfirmDialog,
  ItemComposer,
  ItemDetailPanel,
  useDeleteItem,
  useUpdateItem,
} from "@real-life-stack/toolkit"
import { KARTEN_VORLAGE, WIDGETS, karteMapper, karteVorbelegung, useMitgliederOptionen } from "../content-types"
import { STUFEN, phaseVonStufe, stufeVon, istErledigt, ohnePraefix, zielVonKarte } from "../../../modell.mjs"

interface Props {
  karte: Item
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
  fadenSchreibbar: boolean
  onFadenSuchen: () => void
  onFadenLoesen: (id: string) => void
  onNachbarKarte: (id: string) => void
  onWeitereKarte: () => void
  onGeschlossen: () => void
}

/**
 * Die geöffnete Karte: dieselbe Form wie beim Anlegen (`ItemComposer` im
 * Bearbeiten-Modus), eingefasst in `ItemDetailPanel`, das darunter die
 * Diskussion mitbringt. Die Fäden stehen als Listen daneben.
 */
export function KartenDetail({
  karte,
  ziele,
  karten,
  faeden,
  fadenSchreibbar,
  onFadenSuchen,
  onFadenLoesen,
  onNachbarKarte,
  onWeitereKarte,
  onGeschlossen,
}: Props) {
  const { mutate: aendere } = useUpdateItem()
  const personen = useMitgliederOptionen()
  const { mutate: loesche } = useDeleteItem()
  const [loeschenOffen, setLoeschenOffen] = useState(false)

  const stufe = stufeVon(karte)
  const phase = phaseVonStufe(stufe)
  const ziel = ziele.find((z) => z.id === zielVonKarte(karte))
  const titel = (id: string) => String(karten.find((k) => k.id === id)?.data?.title ?? "gelöschte Karte")
  const hinein = faeden.filter((f) => ohnePraefix(f.to) === karte.id)
  const hinaus = faeden.filter((f) => ohnePraefix(f.from) === karte.id)

  const alleFaeden = () => faeden.filter((f) => ohnePraefix(f.from) === karte.id || ohnePraefix(f.to) === karte.id)

  return (
    <ItemDetailPanel itemId={karte.id}>
      <div className="space-y-4 p-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider" style={{ color: `var(--kb-${phase.key})` }}>
            {phase.name} · {STUFEN[stufe]}
          </div>
          <div className="text-xs text-muted-foreground">
            {ziel ? String(ziel.data?.title ?? "").split(":")[0] : "ohne Ziel"} · Zeile und Spalte änderst du durch Ziehen der Karte.
          </div>
        </div>

        <ItemComposer
          key={karte.id}
          contentTypes={[KARTEN_VORLAGE]}
          initialContentType={KARTEN_VORLAGE.id}
          existingItem={karte}
          initialData={karteVorbelegung(karte)}
          mapper={karteMapper({ zielId: ziel?.id ?? "", stufe, order: Number(karte.data?.order) || 0 })}
          composerProps={{ widgets: WIDGETS, peopleOptions: personen }}
          onDone={() => {}}
          onCancel={onGeschlossen}
        />

        <section className="space-y-1">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Voraussetzungen (Fäden hinein)</h3>
          <FadenListe faeden={hinein} seite="from" titel={titel} onOeffnen={onNachbarKarte} onLoesen={onFadenLoesen} />
          {fadenSchreibbar && (
            <Button size="sm" variant="outline" onClick={onFadenSuchen}>
              Voraussetzung hinzufügen
            </Button>
          )}
        </section>

        <section className="space-y-1">
          <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Was danach kommt (Fäden hinaus)</h3>
          <FadenListe faeden={hinaus} seite="to" titel={titel} onOeffnen={onNachbarKarte} onLoesen={onFadenLoesen} />
        </section>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant={istErledigt(karte) ? "outline" : "default"}
            onClick={() => void aendere(karte.id, { data: { ...karte.data, status: istErledigt(karte) ? "open" : "done" } })}
          >
            {istErledigt(karte) ? "Wieder öffnen" : "Erledigt, ausmalen"}
          </Button>
          <Button variant="outline" onClick={onWeitereKarte}>
            Weitere Karte in dieser Zelle
          </Button>
          <Button variant="destructive" onClick={() => setLoeschenOffen(true)}>
            Karte löschen
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={loeschenOffen}
        onOpenChange={setLoeschenOffen}
        title={String(karte.data?.title ?? "")}
        onConfirm={async () => {
          // Erst die Fäden, dann die Karte — sonst blieben Kanten ins Leere stehen.
          for (const f of alleFaeden()) await onFadenLoesen(f.id)
          await loesche(karte.id)
          onGeschlossen()
        }}
      />
    </ItemDetailPanel>
  )
}

function FadenListe({
  faeden,
  seite,
  titel,
  onOeffnen,
  onLoesen,
}: {
  faeden: RelationRecord[]
  seite: "from" | "to"
  titel: (id: string) => string
  onOeffnen: (id: string) => void
  onLoesen: (id: string) => void
}) {
  if (!faeden.length)
    return <p className="text-sm text-muted-foreground">{seite === "from" ? "Keine. Hängt am Start." : "Keine. Läuft zum Ziel."}</p>
  return (
    <ul className="divide-y">
      {faeden.map((f) => {
        const anderer = ohnePraefix(seite === "from" ? f.from : f.to)
        return (
          <li key={f.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <button type="button" className="flex-1 text-left hover:underline" onClick={() => onOeffnen(anderer)}>
              {titel(anderer)}
            </button>
            <Button size="sm" variant="ghost" title="Faden lösen" onClick={() => onLoesen(f.id)}>
              ×
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
