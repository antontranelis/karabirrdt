import type { Item, RelationRecord, User } from "@real-life-stack/data-interface"
import {
  Button,
  ItemComposer,
  ItemDetailBody,
  ItemDetailView,
  ItemPreview,
  ItemTypeBadge,
  Label,
  renderTypeFooter,
  resolveTypePresentation,
  useCurrentUser,
  useMembers,
} from "@real-life-stack/toolkit"
import { KARTEN_VORLAGE, LERNT_VORLAGE, karteMapper, karteVorbelegung, lerntMapper, useComposerProps } from "../content-types"
import { LERNT_PRAEDIKAT, ohnePraefix, stufeVon, zielVonKarte, zugewiesen } from "../../../modell.mjs"

interface Props {
  karte: Item
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
  fadenSchreibbar: boolean
  onFadenSuchen: () => void
  onFadenLoesen: (id: string) => void
  onNachbarKarte: (id: string) => void
  onGeschlossen: () => void
}

/**
 * Die geöffnete Karte: `ItemDetailView` des Toolkits. Es besitzt den Wechsel
 * zwischen Lesen und Bearbeiten, das ⋮-Menü mit Bearbeiten und Löschen samt
 * Bestätigung, und die Diskussion darunter. Diese Datei liefert nur, was am
 * Typ hängt: die Fäden in der Fakten-Box und den Knopf, einen zu ziehen.
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
  onGeschlossen,
}: Props) {
  const composerProps = useComposerProps()
  const ziel = ziele.find((z) => z.id === zielVonKarte(karte))

  return (
    <ItemDetailView
      key={karte.id}
      itemId={karte.id}
      renderRead={(item, actions) => (
        <Leseansicht
          item={item}
          actions={actions}
          karten={karten}
          faeden={faeden}
          fadenSchreibbar={fadenSchreibbar}
          onFadenSuchen={onFadenSuchen}
          onFadenLoesen={onFadenLoesen}
          onNachbarKarte={onNachbarKarte}
          composerProps={composerProps}
        />
      )}
      contentTypes={[KARTEN_VORLAGE]}
      mapper={karteMapper({ zielId: ziel?.id ?? "", stufe: stufeVon(karte), order: Number(karte.data?.order) || 0 })}
      editInitialData={(item) => karteVorbelegung(item)}
      composerProps={composerProps}
      onClose={onGeschlossen}
    />
  )
}

function Leseansicht({
  item,
  actions,
  karten,
  faeden,
  fadenSchreibbar,
  onFadenSuchen,
  onFadenLoesen,
  onNachbarKarte,
  composerProps,
}: {
  item: Item
  actions: React.ReactNode
  karten: Item[]
  faeden: RelationRecord[]
  fadenSchreibbar: boolean
  onFadenSuchen: () => void
  onFadenLoesen: (id: string) => void
  onNachbarKarte: (id: string) => void
  composerProps: ReturnType<typeof useComposerProps>
}) {
  const { data: mitglieder } = useMembers(null)
  const { data: ich } = useCurrentUser()
  const finde = (id: string): User | undefined =>
    mitglieder.find((m) => m.id === id) ?? (ich?.id === id ? ich : undefined)
  const darstellung = resolveTypePresentation(item.type)
  const TypMeta = darstellung.detail
  const hinein = faeden.filter((f) => ohnePraefix(f.to) === item.id)
  const hinaus = faeden.filter((f) => ohnePraefix(f.from) === item.id)

  return (
    <>
      <ItemDetailBody
        item={item}
        author={finde(item.createdBy)}
        headerAdornment={<ItemTypeBadge type={item.type} />}
        actions={actions}
        meta={
          <>
            <TypMeta item={item} />
            {!!hinein.length && (
              <div className="space-y-2">
                <Label>Voraussetzungen</Label>
                <FadenListe faeden={hinein} seite="from" karten={karten} onOeffnen={onNachbarKarte} onLoesen={onFadenLoesen} />
              </div>
            )}
            {!!hinaus.length && (
              <div className="space-y-2">
                <Label>Was danach kommt</Label>
                <FadenListe faeden={hinaus} seite="to" karten={karten} onOeffnen={onNachbarKarte} onLoesen={onFadenLoesen} />
              </div>
            )}
          </>
        }
        footer={
          <>
            {renderTypeFooter(item)}
            {fadenSchreibbar && (
              <Button size="sm" variant="outline" onClick={onFadenSuchen}>
                Voraussetzung hinzufügen
              </Button>
            )}
          </>
        }
      />

      {/* Zweites Zuweisungsfeld. Es steht hier, weil `ItemDetailView` den
          Bearbeiten-Composer selbst besitzt und dort kein Platz für ein
          zweites Personen-Feld vorgesehen ist (siehe docs/rls-kompatibel.md,
          Lücke 10). Es ist dieselbe Komponente des Toolkits, nur mit anderem
          Prädikat. */}
      <div className="px-4 pb-2">
        <ItemComposer
          key={`lernt-${item.id}`}
          contentTypes={[LERNT_VORLAGE]}
          initialContentType={LERNT_VORLAGE.id}
          existingItem={item}
          initialData={{ people: zugewiesen(item, LERNT_PRAEDIKAT) }}
          mapper={lerntMapper}
          composerProps={{ ...composerProps, liveUpdate: true }}
          onDone={() => {}}
          onCancel={() => {}}
        />
      </div>
    </>
  )
}

/** Die Fäden als Karten — dieselbe `ItemPreview` wie überall. */
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
              <Button
                size="icon-sm"
                variant="ghost"
                title="Faden lösen"
                onClick={(e) => {
                  e.stopPropagation()
                  onLoesen(f.id)
                }}
              >
                ×
              </Button>
            }
          />
        )
      })}
    </div>
  )
}
