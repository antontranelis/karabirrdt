import { useEffect, useMemo, useRef } from "react"
import type { Item } from "@real-life-stack/data-interface"
import { ItemComposer, type ContentComposerHandle, type ContentComposerProps } from "@real-life-stack/toolkit"
import { mitPosition, useAbbildung, vorbelegung, type Zelle } from "../composer"
import { KARTEN_TYP } from "../../../modell.mjs"

/**
 * Anlegen — eine Form für beide Arten, aus dem Register. Welche es wird,
 * entscheidet die Typ-Auswahl des Formulars; aus einer Zelle heraus steht
 * sie fest (Karte), und die Karte landet in dieser Zelle.
 */
export function Anlegen({
  zelle,
  nurKarte,
  composerProps,
  onFertig,
  onAbbruch,
}: {
  zelle: Zelle | null
  nurKarte: boolean
  composerProps: Partial<ContentComposerProps>
  onFertig: (item: Item) => void
  onAbbruch: () => void
}) {
  const { typen, mapSubmission } = useAbbildung()
  // Nach Wert, nicht nach Objekt: Die App reicht beim Anlegen über den
  // Plus-Knopf bei jedem Rendern eine neue Zelle derselben Werte.
  const zielId = zelle?.zielId ?? null
  const stufe = zelle?.stufe ?? null
  const mapper = useMemo(
    () => mitPosition(mapSubmission, zielId === null || stufe === null ? null : { zielId, stufe }),
    [mapSubmission, zielId, stufe],
  )
  // „Teil von“ steht schon im Formular, nicht erst beim Speichern (Lücke 29).
  const vorbelegt = useMemo(() => vorbelegung(zielId === null ? null : { zielId, stufe: 0 }), [zielId])
  // `initialData` liest das Formular nur beim Einhängen. Klickt jemand bei
  // offenem Formular eine Zelle eines anderen Ziels an, zieht „Teil von“ über
  // den Griff des Composers mit (`patchData`, ohne neu einzuhängen: der
  // Entwurf bleibt); die Stufe nimmt `mitPosition` aus derselben Zelle.
  const griff = useRef<ContentComposerHandle | null>(null)
  const erstesZiel = useRef(zielId)
  useEffect(() => {
    if (erstesZiel.current === zielId) return
    erstesZiel.current = zielId
    if (zielId !== null) griff.current?.patchData(vorbelegung({ zielId, stufe: 0 }))
  }, [zielId])
  return (
    <div className="p-4">
      <ItemComposer
        contentTypes={nurKarte ? typen.filter((t) => t.id === KARTEN_TYP) : typen}
        initialContentType={KARTEN_TYP}
        initialData={vorbelegt}
        apiRef={griff}
        mapper={mapper}
        composerProps={composerProps}
        onDone={onFertig}
        onCancel={onAbbruch}
      />
    </div>
  )
}
