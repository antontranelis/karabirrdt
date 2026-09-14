import { useMemo } from "react"
import type { Relation } from "@real-life-stack/data-interface"
import { ListTodo, Target, Timer } from "lucide-react"
import {
  Input,
  Label,
  cn,
  useCurrentGroup,
  useItems,
  useMembers,
  type ContentTypeConfig,
  type CustomWidgetDefinition,
  type ItemEditorMapper,
  type PersonOption,
  peopleRelationsFromWidgetData,
  peopleRelationsToWidgetData,
  type WidgetComponentProps,
} from "@real-life-stack/toolkit"
import {
  KANN_PRAEDIKAT,
  KARTEN_TYP,
  LERNT_PRAEDIKAT,
  VOCAB,
  ZIEL_TYP,
  mitZiel,
} from "../../modell.mjs"

/**
 * Die Vorlagen des Composers. „Kann ich" ist das Personen-Widget des
 * Toolkits auf dem Task-Prädikat `assignedTo` — dasselbe, das die
 * Kanban-Karte für Zuständige benutzt. „Will lernen" ist dieselbe Auswahl
 * auf einem zweiten Prädikat; dafür gibt es im Toolkit kein zweites
 * Personen-Feld (siehe docs/rls-kompatibel.md).
 */

/** Die Mitglieder des offenen Spaces als Auswahl für die Personen-Felder. */
export function useMitgliederOptionen(): PersonOption[] {
  const group = useCurrentGroup()
  const { data } = useMembers(group?.id ?? null)
  return data.map((u) => ({ id: u.id, name: u.displayName || u.id }))
}

/**
 * Die Laufzeit-Verdrahtung, die jeder Composer dieser App braucht: eigene
 * Widgets, die Mitglieder als Auswahl UND als Schnellvorschläge unter dem
 * Feld, die Tags des Spaces ebenso. Alles vorgesehene Props des
 * `ContentComposer` — hier nur befüllt, nirgends nachgebaut.
 */
export function useComposerProps() {
  const personen = useMitgliederOptionen()
  const { data: alle } = useItems()
  const tags = useMemo(() => {
    const menge = new Set<string>()
    for (const i of alle) for (const t of i.tags ?? []) menge.add(t)
    return [...menge].sort()
  }, [alle])
  return useMemo(
    () => ({
      widgets: WIDGETS,
      peopleOptions: personen,
      peopleQuickSuggestions: personen,
      tagSuggestions: tags,
      tagQuickSuggestions: tags,
    }),
    [personen, tags],
  )
}


export interface Aufwand {
  hours: number
  euros: number
}
const alsAufwand = (v: unknown): Aufwand => {
  const a = (v ?? {}) as Partial<Aufwand>
  return { hours: Number(a.hours) || 0, euros: Number(a.euros) || 0 }
}

function AufwandWidget({ value, onChange, label }: WidgetComponentProps<unknown>) {
  const a = alsAufwand(value)
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <label className="flex-1 space-y-1">
          <Label>Stunden</Label>
          <Input type="number" min={0} step={1} value={a.hours} onChange={(e) => onChange({ ...a, hours: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="flex-1 space-y-1">
          <Label>Euro</Label>
          <Input type="number" min={0} step={10} value={a.euros} onChange={(e) => onChange({ ...a, euros: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
      </div>
    </div>
  )
}

/** Die Klebepunkte eines Ziels — sie sortieren die Zeilen des Bretts. */
function PunkteWidget({ value, onChange, label }: WidgetComponentProps<unknown>) {
  const n = Number(value) || 0
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          className="w-20 text-center font-mono"
          type="number"
          min={0}
          max={99}
          value={n}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
        <span className={cn("font-mono text-sm", !n && "text-muted-foreground")}>{n > 0 ? "●".repeat(Math.min(n, 20)) : "keine Punkte"}</span>
      </div>
    </div>
  )
}

export const WIDGETS: CustomWidgetDefinition[] = [
  { id: "aufwand", label: "Aufwand", icon: Timer, component: AufwandWidget },
  { id: "punkte", label: "Punkte", icon: Target, component: PunkteWidget },
]

export const KARTEN_VORLAGE: ContentTypeConfig = {
  id: KARTEN_TYP,
  label: "Karte",
  icon: ListTodo,
  defaultWidgets: ["title", "text", "status", "people", "aufwand", "tags"],
  widgetLabels: { title: "Aufgabe", text: "Notiz", status: "Stand", aufwand: "Aufwand" },
  // Zwei Personenfelder am selben Typ: dasselbe Widget, zwei Prädikate
  // (toolkit 0.1.7, `peopleRelations`).
  peopleRelations: [
    { predicate: KANN_PRAEDIKAT, label: "Kann ich" },
    { predicate: LERNT_PRAEDIKAT, label: "Will lernen" },
  ],
  statusOptions: [
    { id: "open", label: "offen" },
    { id: "done", label: "erledigt, ausgemalt" },
  ],
  defaultStatus: "open",
  submitLabel: "Karte anlegen",
  editLabel: "Speichern",
}

export const ZIEL_VORLAGE: ContentTypeConfig = {
  id: ZIEL_TYP,
  label: "Ziel",
  icon: Target,
  defaultWidgets: ["title", "text", "punkte", "tags"],
  widgetLabels: { title: "Ziel", text: "Beschreibung", punkte: "Punkte" },
  submitLabel: "Ziel anlegen",
  editLabel: "Speichern",
}

/** Die Felder einer Karte aus der Composer-Eingabe, ohne Zelle zu verlieren. */
export function karteMapper(zelle: { zielId: string; stufe: number; order: number }): ItemEditorMapper {
  return (eingabe, ctx) => {
    const alt = (ctx.existingItem?.data ?? {}) as Record<string, unknown>
    const d = eingabe.data
    const aufwand = alsAufwand(d.aufwand)
    const titel = String(d.title ?? "").trim()
    const vorhanden = ctx.existingItem ?? { relations: [] }
    const zielId = ctx.existingItem ? zielVonOderZelle(ctx.existingItem, zelle.zielId) : zelle.zielId
    return {
      type: KARTEN_TYP,
      "@context": [VOCAB.BASE, VOCAB.TASK],
      data: {
        ...alt,
        title: titel || "Ohne Titel",
        description: String(d.text ?? ""),
        status: typeof d.status === "string" && d.status ? d.status : "open",
        stage: ctx.existingItem ? Number(alt.stage) || 0 : zelle.stufe,
        hours: aufwand.hours,
        euros: aufwand.euros,
        order: ctx.existingItem ? Number(alt.order) || 0 : zelle.order,
      },
      tags: eingabe.data.tags,
      // Beide Personenfelder auf einmal: der Helfer ersetzt je eingereichtem
      // Feld die Relationen SEINES Prädikats und lässt alle anderen stehen —
      // auch die Zeile (`partOf`).
      relations: peopleRelationsFromWidgetData(KARTEN_VORLAGE, d, mitZiel(vorhanden, zielId)) ?? mitZiel(vorhanden, zielId),
    }
  }
}

function zielVonOderZelle(item: { relations?: { predicate: string; target: string }[] }, ersatz: string): string {
  const r = (item.relations ?? []).find((x) => x.predicate === "partOf")
  return r ? r.target.replace(/^item:/, "") : ersatz
}

/** Die Composer-Eingaben einer bestehenden Karte. */
export function karteVorbelegung(item: { data: Record<string, unknown>; relations?: Relation[] }) {
  return {
    title: String(item.data.title ?? ""),
    text: String(item.data.description ?? ""),
    status: String(item.data.status ?? "open"),
    ...peopleRelationsToWidgetData(KARTEN_VORLAGE, item.relations),
    aufwand: { hours: Number(item.data.hours) || 0, euros: Number(item.data.euros) || 0 },
  }
}

/** Ein Ziel ist eine Zeile des Bretts — Titel, Beschreibung, Klebepunkte. */
export function zielMapper(order: number): ItemEditorMapper {
  return (eingabe, ctx) => {
    const alt = (ctx.existingItem?.data ?? {}) as Record<string, unknown>
    const titel = String(eingabe.data.title ?? "").trim()
    return {
      type: ZIEL_TYP,
      "@context": [VOCAB.BASE, VOCAB.PROJECT],
      data: {
        ...alt,
        title: titel || "Ohne Titel",
        description: String(eingabe.data.text ?? ""),
        dots: Math.max(0, Number(eingabe.data.punkte) || 0),
        order: ctx.existingItem ? Number(alt.order) || 0 : order,
      },
      tags: eingabe.data.tags,
    }
  }
}

export function zielVorbelegung(data: Record<string, unknown>) {
  return {
    title: String(data.title ?? ""),
    text: String(data.description ?? ""),
    punkte: Number(data.dots) || 0,
  }
}
