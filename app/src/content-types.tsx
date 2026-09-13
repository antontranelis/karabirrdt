import { GraduationCap, ListTodo, Target, Timer } from "lucide-react"
import {
  Button,
  Input,
  cn,
  useCurrentGroup,
  useMembers,
  type ContentTypeConfig,
  type CustomWidgetDefinition,
  type ItemEditorMapper,
  type PersonOption,
  type WidgetComponentProps,
} from "@real-life-stack/toolkit"
import {
  KANN_PRAEDIKAT,
  KARTEN_TYP,
  LERNT_PRAEDIKAT,
  VOCAB,
  ZIEL_TYP,
  mitZiel,
  mitZuweisungen,
  zugewiesen,
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

const alsListe = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : [])

/**
 * „Will lernen" — dieselbe Auswahl wie das Personen-Widget, nur auf einem
 * zweiten Prädikat. `PeopleWidget` selbst ist nicht exportiert und
 * `ContentTypeConfig.peopleRelation` kennt nur EIN Prädikat je Typ, darum
 * hier aus Toolkit-Bausteinen nachgebaut statt geforkt.
 */
function LerntWidget({ value, onChange, label }: WidgetComponentProps<unknown>) {
  const optionen = useMitgliederOptionen()
  const gewaehlt = alsListe(value)
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {optionen.map((o) => {
          const an = gewaehlt.includes(o.id)
          return (
            <Button
              key={o.id}
              type="button"
              size="sm"
              variant={an ? "default" : "outline"}
              onClick={() => onChange(an ? gewaehlt.filter((x) => x !== o.id) : [...gewaehlt, o.id])}
            >
              {o.name}
            </Button>
          )
        })}
        {!optionen.length && <span className="text-xs text-muted-foreground">Dieser Space hat noch keine Mitglieder.</span>}
      </div>
    </div>
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
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="flex gap-2">
        <label className="flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Stunden</span>
          <Input type="number" min={0} step={1} value={a.hours} onChange={(e) => onChange({ ...a, hours: Math.max(0, Number(e.target.value) || 0) })} />
        </label>
        <label className="flex-1 space-y-1">
          <span className="text-xs text-muted-foreground">Euro</span>
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
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
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
  { id: "lernt", label: "Will lernen", icon: GraduationCap, component: LerntWidget },
  { id: "aufwand", label: "Aufwand", icon: Timer, component: AufwandWidget },
  { id: "punkte", label: "Punkte", icon: Target, component: PunkteWidget },
]

export const KARTEN_VORLAGE: ContentTypeConfig = {
  id: KARTEN_TYP,
  label: "Karte",
  icon: ListTodo,
  defaultWidgets: ["title", "text", "status", "people", "lernt", "aufwand"],
  widgetLabels: { title: "Aufgabe", text: "Notiz", status: "Stand", people: "Kann ich", lernt: "Will lernen", aufwand: "Aufwand" },
  peopleRelation: { predicate: KANN_PRAEDIKAT },
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
  defaultWidgets: ["title", "text", "punkte"],
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
      relations: mitZuweisungen({ relations: mitZiel(vorhanden, zielId) }, alsListe(d.people), alsListe(d.lernt)),
    }
  }
}

function zielVonOderZelle(item: { relations?: { predicate: string; target: string }[] }, ersatz: string): string {
  const r = (item.relations ?? []).find((x) => x.predicate === "partOf")
  return r ? r.target.replace(/^item:/, "") : ersatz
}

/** Die Composer-Eingaben einer bestehenden Karte. */
export function karteVorbelegung(item: { data: Record<string, unknown>; relations?: { predicate: string; target: string }[] }) {
  return {
    title: String(item.data.title ?? ""),
    text: String(item.data.description ?? ""),
    status: String(item.data.status ?? "open"),
    people: zugewiesen(item, KANN_PRAEDIKAT),
    lernt: zugewiesen(item, LERNT_PRAEDIKAT),
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
