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
  meta?: Record<string, unknown>
}
/** Ein Faden als Sicht (abgeleitet aus der Einbettung, nie gespeichert). */
export interface Faden {
  id: string
  predicate: "blocks"
  from: string
  to: string
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
  members?: { id: string; displayName?: string }[]
}
export interface Optionen {
  createdBy?: string
  createdAt?: string
  brett?: string
  mitglieder?: readonly { id: string; displayName?: string }[]
}

export declare const VOCAB: { BASE: string; TASK: string; PROJECT: string; RELATION: string }
export declare const KARTEN_TYP: "task"
export declare const ZIEL_TYP: "project"
export declare const FADEN_PRAEDIKAT: "blocks"
export declare const ZUGEHOERIG_PRAEDIKAT: "partOf"
export declare const MODUL: "karabirrdt"
export declare const AUTOR: string
export declare const KENNUNG: RegExp
export declare function freieKennung(name: string, belegt?: readonly string[]): string
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
export declare function voraussetzungen(relations: readonly Faden[] | readonly RelationRecord[], id: string): string[]
export declare function nachfolger(relations: readonly Faden[] | readonly RelationRecord[], id: string): string[]
export declare function fadenSchluessel(vonId: string, nachId: string): string
export declare function faeden(items: readonly Item[]): Faden[]
export declare function mitFaden(item: { relations?: EingebetteteRelation[] } | null | undefined, nachId: string): EingebetteteRelation[]
export declare function ohneFaden(item: { relations?: EingebetteteRelation[] } | null | undefined, nachId: string): EingebetteteRelation[]
export declare function fadenVerstoesse(items: readonly Item[]): Map<string, string>
export declare function neuerFadenVerstoss(vorher: readonly Item[], nachher: readonly Item[]): string | null

export declare function fadenFehler(
  karten: readonly Item[],
  relations: readonly Faden[],
  vonId: string,
  nachId: string,
): string | null
export declare function verschiebenFehler(
  karten: readonly Item[],
  relations: readonly Faden[],
  id: string,
  neueStufe: number,
): string | null

export declare const KACHEL: number
export declare const FADEN_STRICH: number
export declare const MASSE: {
  start: number
  label: number
  kachel: number
  luft: number
  colW: number
  cardW: number
  cardH: number
  gap: number
  rowPad: number
  band: number
  stufe: number
  head: number
  end: number
}
export interface FadenStil {
  farbe: string
  gestrichelt: boolean
  strichmuster?: string
  strich: number
}
export declare function fadenStil(von: Item, nach: Item): FadenStil
export declare function zielKurz(titel: string): string
export declare function zielRest(titel: string): string
export declare function spaltenX(stufe: number): number
export declare function labelHoehe(titel: string): number
export declare function layout(
  ziele: readonly Item[],
  karten: readonly Item[],
  hoehen?: Record<string, number>,
): Raster
export declare function fadenPfad(x1: number, y1: number, x2: number, y2: number): string

export declare function relationItemVonRecord(rec: RelationRecord): Item
export declare function recordVonRelationItem(item: Item | null | undefined): RelationRecord | null

export declare function istRlsFormat(json: unknown): boolean
export declare function leeresRls(brett?: string): RlsBrett
export declare function altNachRls(brett: Partial<AltesBrett>, optionen?: Optionen): Promise<RlsBrett>
export declare function rlsNachAlt(
  brett: Partial<RlsBrett>,
  mitglieder?: readonly { id: string; displayName?: string }[],
  tabelle?: Record<string, string>,
): AltesBrett
export declare function normalisiereRls(json: unknown, optionen?: Optionen): Promise<RlsBrett>
export declare function faedenEinbetten(
  items: readonly Item[],
  relations: readonly RelationRecord[],
): { items: Item[]; entfernt: string[]; verwaist: string[] }
export declare function migriereLernen(item: Item): { item: Item; geaendert: boolean }
export declare function umziehen(
  items: readonly Item[],
  relations: readonly RelationRecord[],
): { items: Item[]; relations: RelationRecord[]; geaendert: string[]; faedenUmgezogen: number; faedenVerwaist: string[] }

export declare const GLOBAL: "global:"
export declare const ZUWEISUNG: "assignedTo"
export declare const ROLLE_KANN: "can"
export declare const ROLLE_LERNT: "learns"
export declare const LERNT_ALT: "wantsToLearn"
export declare function initialenFuer(mitglieder: readonly { id: string; displayName?: string }[]): Map<string, string>
export declare function zugewiesen(item: { relations?: EingebetteteRelation[] } | null | undefined, rolle: string): string[]
export declare function mitZuweisungen(
  item: { relations?: EingebetteteRelation[] } | null | undefined,
  kann?: readonly string[],
  lernt?: readonly string[],
): EingebetteteRelation[]
export declare function migriereWho(
  item: Item,
  mitglieder?: readonly { id: string; displayName?: string }[],
  tabelle?: Record<string, string>,
): { item: Item; unbekannt: string[] }

export declare const WER_NOTIZ: string
export declare function initialenTabelle(
  mitglieder: readonly { id: string; displayName?: string }[],
  tabelle?: Record<string, string>,
): Map<string, string>
export declare function kuerzelFuer(
  mitglieder: readonly { id: string; displayName?: string }[],
  tabelle?: Record<string, string>,
): Map<string, string>
export declare function nachmigriereNotiz(
  item: Item,
  mitglieder?: readonly { id: string; displayName?: string }[],
  tabelle?: Record<string, string>,
): { item: Item; geaendert: boolean; offen: string[] }

export declare function kaskade(
  items: readonly Item[],
  id: string,
  relations?: readonly RelationRecord[],
): { items: string[]; aendern: { id: string; relations: EingebetteteRelation[] }[]; relations: string[] }
export declare function verwaisteFaeden(items: readonly Item[]): { id: string; relations: EingebetteteRelation[] }[]
