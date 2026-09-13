// Typen zu `modell.mjs`. Die Datei selbst ist einfaches JavaScript, damit
// Server (node) und App (Vite) dieselbe benutzen; die Typen stehen hier,
// damit die App sie beim Übersetzen prüfen kann.
import type { Group, Item, RelationRecord } from "@real-life-stack/data-interface"

export interface Phase {
  name: string
  key: "dream" | "plan" | "do" | "fete"
  stufen: string[]
}
export interface Wer {
  ini: string
  can: boolean
}
export interface EingebetteteRelation {
  predicate: string
  target: string
}
export interface Zeile {
  ziel: Item
  y: number
  h: number
}
export interface KartenPos {
  x: number
  y: number
  zeile: Zeile
}
export interface Raster {
  zeilen: Zeile[]
  pos: Record<string, KartenPos>
  hoehe: number
  breite: number
}
export interface AltesBrett {
  meta: { name: string; dream: string; horizon: string }
  goals: Record<string, Record<string, unknown>>
  tasks: Record<string, Record<string, unknown>>
}
export interface RlsBrett {
  group: Group
  items: Item[]
  relations: RelationRecord[]
}
export interface Optionen {
  createdBy?: string
  createdAt?: string
  brett?: string
}

export declare const VOCAB: { BASE: string; TASK: string; PROJECT: string; RELATION: string }
export declare const KARTEN_TYP: "task"
export declare const ZIEL_TYP: "project"
export declare const FADEN_PRAEDIKAT: "blocks"
export declare const ZUGEHOERIG_PRAEDIKAT: "partOf"
export declare const MODUL: "karabirrdt"
export declare const PHASEN: Phase[]
export declare const STUFEN: string[]
export declare function phaseVonStufe(stufe: number): Phase

export declare function istKarte(item: Item | null | undefined): boolean
export declare function istZiel(item: Item | null | undefined): boolean
export declare function ohnePraefix(target: string): string
export declare function zielVonKarte(karte: { relations?: EingebetteteRelation[] } | null | undefined): string | null
export declare function mitZiel(karte: { relations?: EingebetteteRelation[] } | null | undefined, zielId: string): EingebetteteRelation[]
export declare function stufeVon(karte: { data?: Record<string, unknown> } | null | undefined): number
export declare function istErledigt(karte: { data?: Record<string, unknown> } | null | undefined): boolean
export declare function zieleSortiert(items: readonly Item[]): Item[]
export declare function kartenInZelle(items: readonly Item[], zielId: string, stufe: number): Item[]
export declare function voraussetzungen(relations: readonly RelationRecord[], id: string): string[]
export declare function nachfolger(relations: readonly RelationRecord[], id: string): string[]

export declare function fadenFehler(
  karten: readonly Item[],
  relations: readonly RelationRecord[],
  vonId: string,
  nachId: string,
): string | null
export declare function verschiebenFehler(
  karten: readonly Item[],
  relations: readonly RelationRecord[],
  id: string,
  neueStufe: number,
): string | null

export declare const MASSE: {
  start: number
  label: number
  colW: number
  cardW: number
  cardH: number
  gap: number
  rowPad: number
  head: number
  end: number
}
export declare function spaltenX(stufe: number): number
export declare function labelHoehe(titel: string): number
export declare function layout(ziele: readonly Item[], karten: readonly Item[]): Raster
export declare function fadenPfad(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  via?: number | null,
  senkrecht?: boolean,
): string

export declare function fadenId(createdBy: string, from: string, to: string, predicate?: string): Promise<string>
export declare function relationItemVonRecord(rec: RelationRecord): Item
export declare function recordVonRelationItem(item: Item | null | undefined): RelationRecord | null

export declare function istRlsFormat(json: unknown): boolean
export declare function leeresRls(brett?: string): RlsBrett
export declare function altNachRls(brett: Partial<AltesBrett>, optionen?: Optionen): Promise<RlsBrett>
export declare function rlsNachAlt(brett: Partial<RlsBrett>): AltesBrett
export declare function normalisiereRls(json: unknown, optionen?: Optionen): Promise<RlsBrett>
