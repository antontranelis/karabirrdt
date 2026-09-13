import { useState } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Button, DeleteConfirmDialog, ItemComposer, ItemDetailPanel, useDeleteItem } from "@real-life-stack/toolkit"
import { WIDGETS, ZIEL_VORLAGE, zielMapper, zielVorbelegung } from "../content-types"

interface Props {
  ziel: Item
  /** Wieviele Karten in dieser Zeile hängen — sie gehen beim Löschen mit. */
  karten: number
  onLoeschen: () => Promise<void>
  onGeschlossen: () => void
}

/** Ein Ziel ist ein Item wie jedes andere: dieselbe Form, dasselbe Panel. */
export function ZielDetail({ ziel, karten, onLoeschen, onGeschlossen }: Props) {
  const { mutate: loesche } = useDeleteItem()
  const [offen, setOffen] = useState(false)

  return (
    <ItemDetailPanel itemId={ziel.id}>
      <div className="space-y-4 p-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Ziel · eine Zeile des Bretts</div>
          <div className="text-xs text-muted-foreground">
            Die Punkte kommen aus der Klebepunkt-Runde; die Zeilen sortieren sich danach.
          </div>
        </div>

        <ItemComposer
          key={ziel.id}
          contentTypes={[ZIEL_VORLAGE]}
          initialContentType={ZIEL_VORLAGE.id}
          existingItem={ziel}
          initialData={zielVorbelegung(ziel.data)}
          mapper={zielMapper(Number(ziel.data?.order) || 0)}
          composerProps={{ widgets: WIDGETS }}
          onDone={() => {}}
          onCancel={onGeschlossen}
        />

        <Button variant="destructive" onClick={() => setOffen(true)}>
          Ziel löschen
        </Button>
        <p className="text-xs text-muted-foreground">
          {karten ? `Die ${karten} Karten dieser Zeile gehen mit.` : "In dieser Zeile hängt keine Karte."}
        </p>
      </div>

      <DeleteConfirmDialog
        open={offen}
        onOpenChange={setOffen}
        title={String(ziel.data?.title ?? "")}
        onConfirm={async () => {
          await onLoeschen()
          await loesche(ziel.id)
          onGeschlossen()
        }}
      />
    </ItemDetailPanel>
  )
}
