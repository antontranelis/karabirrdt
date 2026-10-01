import { hasGroups, hasGroupScope, type CreateItemInput, type CreateItemOptions, type DataInterface, type Item, type ItemWriter, type RelationRecord } from "@real-life-stack/data-interface"
import { kaskade, neuerRegelVerstoss, recordVonRelationItem } from "../../../modell.mjs"

/**
 * Die Regeln des Bretts, geprüft von der App vor jedem Schreiben (Stopp-Punkt
 * 5: der Stack ist backend-agnostisch, App-Logik gehört nie ins Backend).
 *
 * Eine dünne Schicht um den Connector (Komposition, kein Nachbau): Sie
 * beantwortet nur `createItem`, `updateItem` und `deleteItem` selbst und
 * reicht alles andere unverändert durch — Gruppen, Realtime, Anmeldung,
 * Profil, Kommentare. Die Regeln gelten so für JEDEN Schreibweg, auch die
 * des Toolkits (Formular, Selbstaktion, ⋮-Menü):
 *
 * - Ein Faden läuft nie nach links, nie im Kreis, nie auf sich selbst, und
 *   eine Karte gehört zu genau einem Ziel (`neuerRegelVerstoss`).
 * - Löschen nimmt mit, was ohne das Gelöschte keinen Halt mehr hat: ein Ziel
 *   seine Karten, und jede Voraussetzung verliert ihren Faden (`kaskade`).
 *
 * Geprüft wird gegen den Stand des Servers unmittelbar vor dem Schreiben.
 * Zwei gleichzeitige Änderungen aus verschiedenen Browsern prüft niemand
 * gemeinsam; eine Prüfung vor dem Speichern im Stack kommt mit rls#563.
 */
type Basis = DataInterface & ItemWriter

const ROH = Symbol("karabirrdt:roh")

/**
 * Ändern und Löschen schreiben über die Id; geprüft wird gegen den Space, der
 * offen ist. Liegt das Item dort nicht (etwa nach einem Brettwechsel), wird
 * nicht ungeprüft geschrieben.
 */
export const NICHT_IM_BRETT = "Dieses Item liegt nicht im offenen Brett – dort ändern."

/** Platzhalter-Id eines neuen Items in der Regelprüfung, vor dem Anlegen. */
const NOCH_OHNE_ID = "\u0000neu"

export function mitBrettRegeln<C extends Basis>(basis: C): C {
  // Der Space, der beim Aufruf offen ist — festgehalten VOR dem ersten await,
  // damit Prüfen und Schreiben denselben meinen, auch wenn jemand dazwischen
  // das Brett wechselt.
  const offen = () => (hasGroups(basis) ? basis.getCurrentGroup()?.id : undefined) ?? undefined
  const lies = (gruppe?: string) => basis.getItems(gruppe ? { group: gruppe } : undefined)
  const pruefe = (vorher: Item[], nachher: Item[]) => {
    const grund = neuerRegelVerstoss(vorher, nachher)
    if (grund) throw new Error(grund)
  }
  /** Die Items des Space, in dem `id` liegt — oder ein Fehler, wenn es nicht im offenen liegt. */
  const imOffenen = async (id: string, gruppe: string | undefined) => {
    const alle = await lies(gruppe)
    if (!alle.some((i) => i.id === id)) throw new Error(NICHT_IM_BRETT)
    return alle
  }

  const eigene: Record<string | symbol, unknown> = {
    [ROH]: basis,
    createItem: async (eingabe: CreateItemInput, optionen?: CreateItemOptions) => {
      const gruppe = optionen?.group ?? offen()
      const vorher = await lies(gruppe)
      pruefe(vorher, [...vorher, { createdAt: "", ...eingabe, id: eingabe.id ?? NOCH_OHNE_ID } as Item])
      // `options.group` gehört zu `groupScope` (02), nicht zum schmalen ItemWriter.
      const anlegen = basis.createItem as (eingabe: CreateItemInput, optionen?: CreateItemOptions) => Promise<Item>
      const ziel = gruppe && hasGroupScope(basis) ? { ...optionen, group: gruppe } : optionen
      return anlegen.call(basis, eingabe, ziel)
    },
    updateItem: async (id: string, aenderungen: Partial<Item>) => {
      const vorher = await imOffenen(id, offen())
      pruefe(vorher, vorher.map((i) => (i.id === id ? ({ ...i, ...aenderungen, id } as Item) : i)))
      return basis.updateItem(id, aenderungen)
    },
    deleteItem: async (id: string) => {
      const alle = await imOffenen(id, offen())
      const datensaetze = alle.map(recordVonRelationItem).filter((r): r is RelationRecord => !!r)
      const weg = kaskade(alle, id, datensaetze)
      for (const { id: kid, relations } of weg.aendern) await basis.updateItem(kid, { relations })
      for (const rid of weg.relations) await basis.deleteItem(rid)
      for (const iid of weg.items) await basis.deleteItem(iid)
    },
  }

  return new Proxy(basis, {
    has(ziel, name) {
      return Object.hasOwn(eigene, name) || Reflect.has(ziel, name)
    },
    get(ziel, name) {
      if (Object.hasOwn(eigene, name)) return eigene[name]
      const wert = Reflect.get(ziel, name, ziel)
      return typeof wert === "function" ? wert.bind(ziel) : wert
    },
  })
}

/**
 * Der Connector unter den Regeln — für den Import im Abschnitt „Daten“, der
 * ein ganzes Brett auf einmal schreibt (die Regeln prüft dort der Umzug).
 */
export function rohVon<C>(connector: C): C {
  return ((connector as Record<symbol, unknown>)[ROH] as C | undefined) ?? connector
}
