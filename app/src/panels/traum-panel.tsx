import type { Group } from "@real-life-stack/data-interface"
import { Input, Label, Textarea, useUpdateGroup } from "@real-life-stack/toolkit"

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

      <label className="block space-y-1">
        <Label>Traumsatz</Label>
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
        <Label>Traumhorizont</Label>
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
