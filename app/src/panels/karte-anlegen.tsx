import type { Item } from "@real-life-stack/data-interface"
import { ItemComposer } from "@real-life-stack/toolkit"
import { KARTEN_VORLAGE, WIDGETS, karteMapper } from "../content-types"
import { STUFEN, phaseVonStufe } from "../../../modell.mjs"

interface Props {
  zielId: string
  zielTitel: string
  stufe: number
  onFertig: (item: Item) => void
  onAbbruch: () => void
}

/** Eine neue Karte in einer Zelle — dieselbe Form wie beim Bearbeiten. */
export function KarteAnlegen({ zielId, zielTitel, stufe, onFertig, onAbbruch }: Props) {
  const phase = phaseVonStufe(stufe)
  return (
    <div className="space-y-4 p-4">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-wider" style={{ color: `var(--kb-${phase.key})` }}>
          {phase.name} · {STUFEN[stufe]}
        </div>
        <div className="text-xs text-muted-foreground">{zielTitel}</div>
      </div>
      <ItemComposer
        contentTypes={[KARTEN_VORLAGE]}
        initialContentType={KARTEN_VORLAGE.id}
        initialData={{ status: "open" }}
        mapper={karteMapper({ zielId, stufe, order: Date.now() })}
        composerProps={{ widgets: WIDGETS }}
        onDone={onFertig}
        onCancel={onAbbruch}
      />
      <p className="text-xs text-muted-foreground">
        Probe: Kann eine Person das übernehmen, und merkt man, wenn es fertig ist?
      </p>
    </div>
  )
}
