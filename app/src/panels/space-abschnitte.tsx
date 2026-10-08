import { useId } from "react"
import type { Group, Item, RelationRecord } from "@real-life/data-interface"
import { Input, Label, Textarea, type AppSpaceSection, type AppSpaceSectionContext, type GroupDialogMode } from "@real-life/toolkit"
import { FileJson, Sparkles } from "lucide-react"
import { DatenPanel } from "./daten-panel"

/**
 * Was zum Space gehört und nicht zum Modul — der Traum und die Daten — als
 * App-Abschnitte im `GroupDialog` des Toolkits (toolkit 0.4.0, rls#551).
 *
 * Geschrieben wird nur über `patchData`: ein flacher Merge-Patch auf
 * `Group.data` (Spec 04, Space-Metadaten, Regeln 2 und 3). Angezeigt wird die
 * Group, die der Dialog bekommt; die App liefert sie live (`liveModus`), so
 * erscheint eine gespeicherte Änderung, ohne dass ein Abschnitt einen eigenen
 * Schreibstand hält (shared-components, Regel 3).
 *
 * `canEdit` bleibt hier unbeachtet: Das Karabirrdt kennt keine Konten
 * (Lücke 24), „Admin“ wäre nur das zufällig erste Mitglied der Liste. Den
 * Traum durfte schon bisher jeder am Tisch ändern.
 */
export function spaceAbschnitte({
  brett,
  items,
  relations,
}: {
  /** Das offene Brett: Nur dessen Karten und Ziele hat die App geladen. */
  brett: string
  items: Item[]
  relations: RelationRecord[]
}): AppSpaceSection[] {
  return [
    { id: "traum", label: "Traum", icon: Sparkles, render: (ctx) => <TraumAbschnitt {...ctx} /> },
    {
      id: "daten",
      label: "Daten",
      icon: FileJson,
      render: ({ group }) =>
        group.id === brett ? (
          <DatenPanel brett={brett} group={group} items={items} relations={relations} />
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            Export und Import gelten dem offenen Brett. Wechsle zuerst in „{group.name || group.id}“.
          </p>
        ),
    },
  ]
}

function TraumAbschnitt({ group, patchData }: AppSpaceSectionContext) {
  const id = useId()
  const daten = (group.data ?? {}) as Record<string, unknown>
  const traum = String(daten.dream ?? "")
  const horizont = String(daten.horizon ?? "")
  // Ein Patch je Feld und nur bei einer Änderung: Zwei Schreiber, die
  // verschiedene Felder ändern, überschreiben einander nicht.
  const setze = (schluessel: "dream" | "horizon", alt: string, neu: string) => {
    const wert = neu.trim()
    if (wert !== alt) void patchData({ [schluessel]: wert }).catch(() => {})
  }

  return (
    <div className="space-y-4 p-4">
      <div className="space-y-1">
        <Label htmlFor={`${id}-traum`}>Traumsatz</Label>
        <Textarea
          id={`${id}-traum`}
          rows={3}
          className="italic"
          placeholder="Es ist … und wir …"
          // Ein neu gelieferter Wert ersetzt das Feld.
          key={`d-${traum}`}
          defaultValue={traum}
          onBlur={(e) => setze("dream", traum, e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-horizont`}>Traumhorizont</Label>
        <Input
          id={`${id}-horizont`}
          placeholder="September 2027"
          key={`h-${horizont}`}
          defaultValue={horizont}
          onBlur={(e) => setze("horizon", horizont, e.target.value)}
        />
      </div>
    </div>
  )
}

/**
 * Der Modus des `GroupDialog` mit der Group, wie der Connector sie JETZT
 * liefert — nicht dem Schnappschuss vom Öffnen. Sonst stünde nach dem
 * Speichern der alte Traum im Feld (shared-components, Regel 3).
 */
export function liveModus(modus: GroupDialogMode, gruppen: readonly Group[]): GroupDialogMode {
  if (modus.type !== "edit") return modus
  const aktuell = gruppen.find((g) => g.id === modus.group.id)
  return aktuell ? { type: "edit", group: aktuell } : modus
}
