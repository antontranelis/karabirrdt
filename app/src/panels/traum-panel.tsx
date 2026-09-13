import type { Group } from "@real-life-stack/data-interface"
import { Input, Textarea, useUpdateGroup } from "@real-life-stack/toolkit"

/**
 * Traumsatz und Traumhorizont. Sie gehören dem Brett, nicht der App-Leiste:
 * beides sind Felder der Group (`data.dream`, `data.horizon`) und werden als
 * Merge-Patch geschrieben, damit zwei Schreiber sich nicht überschreiben.
 */
export function TraumPanel({ group }: { group: Group | null }) {
  const aendere = useUpdateGroup()
  const daten = (group?.data ?? {}) as Record<string, unknown>
  const setze = (patch: Record<string, unknown>) => {
    if (group) void aendere(group.id, { data: patch })
  }

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Der Traum</h2>
      <p className="text-sm text-muted-foreground">
        Der Satz aus dem Traumkreis und der Zeitpunkt, zu dem er wahr sein soll. Beides gehört zum Brett — den Namen
        änderst du im Space-Menü oben links.
      </p>

      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Traumsatz</span>
        <Textarea
          rows={3}
          className="italic"
          placeholder="Es ist … und wir …"
          key={`d-${String(daten.dream ?? "")}`}
          defaultValue={String(daten.dream ?? "")}
          onBlur={(e) => setze({ dream: e.target.value.trim() })}
        />
      </label>

      <label className="block space-y-1">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Traumhorizont</span>
        <Input
          placeholder="September 2027"
          key={`h-${String(daten.horizon ?? "")}`}
          defaultValue={String(daten.horizon ?? "")}
          onBlur={(e) => setze({ horizon: e.target.value.trim() })}
        />
      </label>
    </div>
  )
}
