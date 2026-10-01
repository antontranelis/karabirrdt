// Typen zu `umwandeln.mjs` (Export → Umwandeln → Import, Supabase-Umzug).
import type { Item, RelationRecordInput } from "@real-life-stack/data-interface"

export interface UmzugPlan {
  slug: string
  group: { name: string; data: Record<string, unknown> }
  items: Array<Pick<Item, "id" | "type" | "data"> & Partial<Pick<Item, "@context" | "schema" | "schemaVersion" | "relations" | "tags">>>
  datensaetze: RelationRecordInput[]
  nichtUebernommen: unknown[]
  ohneKonto: { ziel: string; name: string; karten: number }[]
  einladen: string[]
  verstoesse: string[]
}

export interface ImportBericht {
  gruppe: { id: string | null; neu: boolean }
  angelegt: string[]
  geaendert: string[]
  gleich: string[]
  entfernt: string[]
  eingeladen: string[]
  datensaetze: number
  fehler: { id: string; grund: string }[]
  ersetzenAusgelassen?: boolean
}

export function importSperre(plan: UmzugPlan, optionen?: { ohneKontoUebernehmen?: boolean }): string | null

export function planeUmzug(json: unknown, optionen?: { slug?: string; zuordnung?: Record<string, string> }): Promise<UmzugPlan>
export function importiere(
  plan: UmzugPlan,
  connector: unknown,
  optionen?: { probe?: boolean; gruppe?: string; ersetzen?: boolean; ohneKontoUebernehmen?: boolean },
): Promise<ImportBericht>
