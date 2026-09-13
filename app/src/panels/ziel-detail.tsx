import { useState } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { Button, DeleteConfirmDialog, ItemComposer, ItemDetailPanel, useDeleteItem } from "@real-life-stack/toolkit"
import { ZIEL_VORLAGE, useComposerProps, zielMapper, zielVorbelegung } from "../content-types"

interface Props {
  ziel: Item
  onLoeschen: () => Promise<void>
  onGeschlossen: () => void
}

/** Ein Ziel ist ein Item wie jedes andere: dieselbe Form, dasselbe Panel. */
export function ZielDetail({ ziel, onLoeschen, onGeschlossen }: Props) {
  const { mutate: loesche } = useDeleteItem()
  const [offen, setOffen] = useState(false)
  const composerProps = useComposerProps()

  return (
    <ItemDetailPanel itemId={ziel.id}>
      <div className="space-y-4 p-4">
        <ItemComposer
          key={ziel.id}
          contentTypes={[ZIEL_VORLAGE]}
          initialContentType={ZIEL_VORLAGE.id}
          existingItem={ziel}
          initialData={zielVorbelegung(ziel.data)}
          mapper={zielMapper(Number(ziel.data?.order) || 0)}
          composerProps={composerProps}
          onDone={() => {}}
          onCancel={onGeschlossen}
        />

        <Button variant="destructive" onClick={() => setOffen(true)}>
          Ziel löschen
        </Button>
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
