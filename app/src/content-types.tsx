import { useState } from "react"
import { Users, Timer, ListTodo, Target } from "lucide-react"
import {
  Button,
  Input,
  cn,
  type ContentTypeConfig,
  type CustomWidgetDefinition,
  type WidgetComponentProps,
  type ItemEditorMapper,
} from "@real-life-stack/toolkit"
import { KARTEN_TYP, ZIEL_TYP, mitZiel } from "../../modell.mjs"

/**
 * Die Vorlagen des Composers. Titel, Notiz, Status und Tags bringt das
 * Toolkit mit; „Wer" und „Aufwand" sind eigene Widgets über den dafür
 * vorgesehenen Weg (`widgets`), kein Eingriff in den Composer.
 */

export interface Wer {
  ini: string
  can: boolean
}

const alsWer = (v: unknown): Wer[] =>
  Array.isArray(v) ? v.filter((w) => w && typeof w === "object").map((w) => ({ ini: String((w as Wer).ini ?? ""), can: !!(w as Wer).can })) : []

function WerWidget({ value, onChange, label }: WidgetComponentProps<unknown>) {
  const wer = alsWer(value)
  const [entwurf, setEntwurf] = useState("")
  const hinzu = (can: boolean) => {
    const ini = entwurf.trim().toUpperCase().slice(0, 4)
    if (!ini) return
    onChange([...wer.filter((w) => w.ini !== ini), { ini, can }])
    setEntwurf("")
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="flex gap-2">
        <Input
          value={entwurf}
          maxLength={4}
          placeholder="Initialen, z. B. AT"
          onChange={(e) => setEntwurf(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              hinzu(true)
            }
          }}
        />
        <Button type="button" size="sm" variant="secondary" onClick={() => hinzu(true)}>
          ● kann ich
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => hinzu(false)}>
          ○ will lernen
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {wer.map((w) => (
          <span
            key={w.ini}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs",
              w.can ? "bg-foreground text-background border-foreground" : "bg-transparent",
            )}
          >
            {w.ini}
            <button
              type="button"
              className="opacity-70 underline-offset-2 hover:underline"
              onClick={() => onChange(wer.map((x) => (x.ini === w.ini ? { ...x, can: !x.can } : x)))}
            >
              {w.can ? "kann" : "lernt"}
            </button>
            <button type="button" className="opacity-70" onClick={() => onChange(wer.filter((x) => x.ini !== w.ini))}>
              ×
            </button>
          </span>
        ))}
        {!wer.length && <span className="text-xs text-muted-foreground">Gefüllt = kann ich, umrandet = will ich lernen.</span>}
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
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</div>
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

export const WIDGETS: CustomWidgetDefinition[] = [
  { id: "wer", label: "Wer", icon: Users, component: WerWidget },
  { id: "aufwand", label: "Aufwand", icon: Timer, component: AufwandWidget },
]

export const KARTEN_VORLAGE: ContentTypeConfig = {
  id: KARTEN_TYP,
  label: "Karte",
  icon: ListTodo,
  defaultWidgets: ["title", "text", "status", "wer", "aufwand"],
  widgetLabels: { title: "Aufgabe", text: "Notiz", status: "Stand", wer: "Wer", aufwand: "Aufwand" },
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
  defaultWidgets: ["title", "text"],
  widgetLabels: { title: "Ziel", text: "Beschreibung" },
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
    return {
      type: KARTEN_TYP,
      data: {
        ...alt,
        title: titel || "Ohne Titel",
        description: String(d.text ?? ""),
        status: typeof d.status === "string" && d.status ? d.status : "open",
        stage: ctx.existingItem ? Number(alt.stage) || 0 : zelle.stufe,
        who: alsWer(d.wer),
        hours: aufwand.hours,
        euros: aufwand.euros,
        order: ctx.existingItem ? Number(alt.order) || 0 : zelle.order,
      },
      tags: eingabe.data.tags,
      relations: mitZiel(ctx.existingItem ?? { relations: [] }, ctx.existingItem ? zielVonOderZelle(ctx.existingItem, zelle.zielId) : zelle.zielId),
    }
  }
}

function zielVonOderZelle(item: { relations?: { predicate: string; target: string }[] }, ersatz: string): string {
  const r = (item.relations ?? []).find((x) => x.predicate === "partOf")
  return r ? r.target.replace(/^item:/, "") : ersatz
}

/** Die Composer-Eingaben einer bestehenden Karte. */
export function karteVorbelegung(data: Record<string, unknown>) {
  return {
    title: String(data.title ?? ""),
    text: String(data.description ?? ""),
    status: String(data.status ?? "open"),
    wer: alsWer(data.who),
    aufwand: { hours: Number(data.hours) || 0, euros: Number(data.euros) || 0 },
  }
}
