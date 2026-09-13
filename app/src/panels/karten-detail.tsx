import { useState } from "react"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import {
  Button,
  DeleteConfirmDialog,
  ItemComposer,
  ItemDetailPanel,
  ItemPreview,
  Label,
  Separator,
  useDeleteItem,
  useUpdateItem,
} from "@real-life-stack/toolkit"
import { KARTEN_VORLAGE, LERNT_VORLAGE, karteMapper, karteVorbelegung, lerntMapper, useComposerProps } from "../content-types"
import { LERNT_PRAEDIKAT, stufeVon, istErledigt, ohnePraefix, zielVonKarte, zugewiesen } from "../../../modell.mjs"

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
  const composerProps = useComposerProps()
  const { mutate: loesche } = useDeleteItem()
  const [loeschenOffen, setLoeschenOffen] = useState(false)

  const ziel = ziele.find((z) => z.id === zielVonKarte(karte))
  const hinein = faeden.filter((f) => ohnePraefix(f.to) === karte.id)
  const hinaus = faeden.filter((f) => ohnePraefix(f.from) === karte.id)

  const alleFaeden = () => faeden.filter((f) => ohnePraefix(f.from) === karte.id || ohnePraefix(f.to) === karte.id)

  return (
    <ItemDetailPanel itemId={karte.id}>
      <div className="space-y-4 p-4">
        <ItemComposer
          key={karte.id}
          contentTypes={[KARTEN_VORLAGE]}
          initialContentType={KARTEN_VORLAGE.id}
          existingItem={karte}
          initialData={karteVorbelegung(karte)}
          mapper={karteMapper({ zielId: ziel?.id ?? "", stufe: stufeVon(karte), order: Number(karte.data?.order) || 0 })}
          composerProps={composerProps}
          onDone={() => {}}
          onCancel={onGeschlossen}
        />

        {/* Zweites Zuweisungsfeld: dasselbe Personen-Widget des Composers,
            nur auf dem Prädikat `wantsToLearn`. `liveUpdate` blendet den
            eigenen Fußbereich aus, damit es als Feld und nicht als zweites
            Formular wirkt. */}
        <ItemComposer
          key={`lernt-${karte.id}`}
          contentTypes={[LERNT_VORLAGE]}
          initialContentType={LERNT_VORLAGE.id}
          existingItem={karte}
          initialData={{ people: zugewiesen(karte, LERNT_PRAEDIKAT) }}
          mapper={lerntMapper}
          composerProps={{ ...composerProps, liveUpdate: true }}
          onDone={() => {}}
          onCancel={() => {}}
        />

        <Separator />

        <section className="space-y-2">
          <Label>Voraussetzungen</Label>
          <FadenListe faeden={hinein} seite="from" karten={karten} onOeffnen={onNachbarKarte} onLoesen={onFadenLoesen} />
          {fadenSchreibbar && (
            <Button size="sm" variant="outline" onClick={onFadenSuchen}>
              Voraussetzung hinzufügen
            </Button>
          )}
        </section>

        <section className="space-y-2">
          <Label>Was danach kommt</Label>
          <FadenListe faeden={hinaus} seite="to" karten={karten} onOeffnen={onNachbarKarte} onLoesen={onFadenLoesen} />
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

/** Die Fäden als Karten — dieselbe `ItemPreview` wie überall, kein eigener Stil. */
function FadenListe({
  faeden,
  seite,
  karten,
  onOeffnen,
  onLoesen,
}: {
  faeden: RelationRecord[]
  seite: "from" | "to"
  karten: Item[]
  onOeffnen: (id: string) => void
  onLoesen: (id: string) => void
}) {
  if (!faeden.length) return null
  return (
    <div className="space-y-2">
      {faeden.map((f) => {
        const anderer = ohnePraefix(seite === "from" ? f.from : f.to)
        const item = karten.find((k) => k.id === anderer)
        if (!item) return null
        return (
          <ItemPreview
            key={f.id}
            item={item}
            author={null}
            density="compact"
            onClick={() => onOeffnen(anderer)}
            actions={
              <Button size="icon-sm" variant="ghost" title="Faden lösen" onClick={(e) => { e.stopPropagation(); onLoesen(f.id) }}>
                ×
              </Button>
            }
          />
        )
      })}
    </div>
  )
}
