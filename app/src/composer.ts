import { useMemo } from "react"
import {
  createComposerMapping,
  itemRelationDataKey,
  pickContentTypes,
  useCurrentGroup,
  useItems,
  useMembers,
  type ContentComposerProps,
  type ContentTypeConfig,
  type ItemEditorMapper,
  type PersonOption,
  type WidgetData,
} from "@real-life-stack/toolkit"
import { KARTEN_TYP, ZIEL_TYP, ZUGEHOERIG_PRAEDIKAT } from "../../modell.mjs"

/**
 * Formular für Karte und Ziel — vollständig aus dem Register (Spec 06,
 * Regel 15/16): Widgets, Reihenfolge, Beschriftungen, Status, Personen- und
 * Item-Kanten liefert `pickContentTypes`, die Abbildung Formular ↔ Item
 * `createComposerMapping`. Die App gibt nur, was zur Laufzeit dazukommt
 * (Mitglieder, Tags, der Modul-Pick auf dem Brett) und die Position einer
 * neuen Karte aus der angeklickten Zelle.
 */

/** Die Inhaltstypen dieser App: Karte, Ziel. Eine Funktion — das Register ist erst nach `bindeRegister` vollständig. */
export const inhaltstypen = (): ContentTypeConfig[] => pickContentTypes(KARTEN_TYP, ZIEL_TYP)

/** Die Mitglieder des offenen Spaces als Auswahl für das Personenfeld. */
function useMitgliederOptionen(): PersonOption[] {
  const group = useCurrentGroup()
  const { data } = useMembers(group?.id ?? null)
  return useMemo(() => data.map((u) => ({ id: u.id, name: u.displayName || u.id })), [data])
}

/**
 * Die Laufzeit-Verdrahtung jedes Formulars dieser App — vorgesehene Props
 * des `ContentComposer`, hier nur befüllt.
 */
export function useComposerProps(requestItemPick?: ContentComposerProps["requestItemPick"]): Partial<ContentComposerProps> {
  const personen = useMitgliederOptionen()
  const { data: alle } = useItems()
  const tags = useMemo(() => {
    const menge = new Set<string>()
    for (const i of alle) for (const t of i.tags ?? []) menge.add(t)
    return [...menge].sort()
  }, [alle])
  return useMemo(
    () => ({
      peopleOptions: personen,
      peopleQuickSuggestions: personen,
      tagSuggestions: tags,
      tagQuickSuggestions: tags,
      requestItemPick,
    }),
    [personen, tags, requestItemPick],
  )
}

/** Wo eine neue Karte hinkommt: die angeklickte Zelle, sonst die erste Zeile, Stufe 1. */
export interface Zelle {
  zielId: string
  stufe: number
}

/**
 * Die Vorbelegung des Formulars für eine Karte aus einer Zelle: „Teil von“
 * zeigt die Zeile schon beim Öffnen (`itemRelationDataKey`, toolkit 0.4.0,
 * Lücke 29). Wer den Chip entfernt oder ändert, bekommt genau das.
 */
export function vorbelegung(zelle: Zelle | null): Partial<WidgetData> {
  if (!zelle?.zielId) return {}
  return { [itemRelationDataKey(ZUGEHOERIG_PRAEDIKAT)]: [`item:${zelle.zielId}`] }
}

/**
 * Die Abbildung des Toolkits, dazu die Position einer NEUEN Karte (Stufe,
 * Reihenfolge) — beides Modul-Felder, die nie im Formular stehen. Die Zeile
 * kommt aus dem Formular selbst (`vorbelegung`). Beim Bearbeiten bleibt alles
 * beim Toolkit: Es lässt `stage` und `order` unangetastet, und „Teil von“ im
 * Formular verschiebt die Karte in eine andere Zeile.
 */
export function mitPosition(abbildung: ItemEditorMapper, zelle: Zelle | null, jetzt: () => number = Date.now): ItemEditorMapper {
  return (eingabe, ctx) => {
    const payload = abbildung(eingabe, ctx)
    if (!payload || ctx.mode !== "create") return payload
    if (payload.type === ZIEL_TYP) {
      // Wird aus der vorbelegten Karte ein Ziel, reicht der Mapper des
      // Toolkits den Formularschlüssel von „Teil von“ als Datenfeld durch
      // (Lücke 32). Das Ziel führt diese Kante nicht; der Schlüssel fällt weg.
      const { [itemRelationDataKey(ZUGEHOERIG_PRAEDIKAT)]: _vorbelegt, ...daten } = payload.data ?? {}
      return { ...payload, data: { dots: 0, ...daten, order: jetzt() } }
    }
    if (payload.type !== KARTEN_TYP) return payload
    return { ...payload, data: { ...payload.data, stage: zelle?.stufe ?? 0, order: jetzt() } }
  }
}

/** Die Abbildung für diese Typen — einmal gebaut, für Anlegen und Bearbeiten. */
export function useAbbildung() {
  return useMemo(() => {
    const typen = inhaltstypen()
    return { typen, ...createComposerMapping(typen) }
  }, [])
}
