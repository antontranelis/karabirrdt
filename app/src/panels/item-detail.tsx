import { useMemo } from "react"
import { ItemDetailRead, ItemDetailView, useCurrentGroup, type ContentComposerProps } from "@real-life/toolkit"
import { mitPosition, useAbbildung } from "../composer"

interface Props {
  itemId: string
  bearbeiten: boolean
  onBearbeiten: (an: boolean) => void
  composerProps: Partial<ContentComposerProps>
  onGeschlossen: () => void
}

/**
 * Das geöffnete Item — Karte oder Ziel — ganz aus dem Toolkit: Lesen über
 * `ItemDetailRead` (Meta-Box, Selbstaktionen, Rückwärts-Listen, Reaktionen,
 * alles aus dem Register des Typs), Bearbeiten über den Composer derselben
 * `ItemDetailView`, Löschen im ⋮-Menü. Kein `if (type === …)`: Ob Karte oder
 * Ziel, sagt das Register (Spec 06, Regel 3).
 */
export function ItemDetail({ itemId, bearbeiten, onBearbeiten, composerProps, onGeschlossen }: Props) {
  const { typen, mapSubmission, editInitialData } = useAbbildung()
  const group = useCurrentGroup()
  const mapper = useMemo(() => mitPosition(mapSubmission, null), [mapSubmission])
  return (
    <ItemDetailView
      key={itemId}
      itemId={itemId}
      mode={bearbeiten ? "edit" : "read"}
      onModeChange={(modus) => onBearbeiten(modus === "edit")}
      renderRead={(item, actions) => <ItemDetailRead item={item} actions={actions} groupId={group?.id ?? null} />}
      contentTypes={typen}
      mapper={mapper}
      editInitialData={editInitialData}
      composerProps={composerProps}
      onClose={onGeschlossen}
    />
  )
}
