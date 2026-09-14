import type { Item } from "@real-life-stack/data-interface"
import {
  ItemDetailBody,
  ItemDetailView,
  ItemTypeBadge,
  renderTypeFooter,
  resolveTypePresentation,
  useCurrentUser,
  useMembers,
} from "@real-life-stack/toolkit"
import { ZIEL_VORLAGE, useComposerProps, zielMapper, zielVorbelegung } from "../content-types"

interface Props {
  ziel: Item
  onGeschlossen: () => void
}

/** Ein Ziel ist ein Item wie jedes andere: dieselbe Lese- und Bearbeiten-Ansicht. */
export function ZielDetail({ ziel, onGeschlossen }: Props) {
  const composerProps = useComposerProps()
  return (
    <ItemDetailView
      key={ziel.id}
      itemId={ziel.id}
      renderRead={(item, actions) => <Leseansicht item={item} actions={actions} />}
      contentTypes={[ZIEL_VORLAGE]}
      mapper={zielMapper(Number(ziel.data?.order) || 0)}
      editInitialData={(item) => zielVorbelegung(item.data)}
      composerProps={composerProps}
      onClose={onGeschlossen}
    />
  )
}

function Leseansicht({ item, actions }: { item: Item; actions: React.ReactNode }) {
  const { data: mitglieder } = useMembers(null)
  const { data: ich } = useCurrentUser()
  const autor = mitglieder.find((m) => m.id === item.createdBy) ?? (ich?.id === item.createdBy ? ich : undefined)
  const TypMeta = resolveTypePresentation(item.type).detail
  return (
    <ItemDetailBody
      item={item}
      author={autor}
      headerAdornment={<ItemTypeBadge type={item.type} />}
      actions={actions}
      meta={<TypMeta item={item} />}
      footer={renderTypeFooter(item)}
    />
  )
}
