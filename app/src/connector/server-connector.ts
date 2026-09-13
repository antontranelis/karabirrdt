import { MockConnector, type MockConnectorSeed } from "@real-life-stack/mock-connector"
import type {
  FullConnector,
  Group,
  Item,
  RelationRecord,
  RelationRecordInput,
  RelationRecordUpdate,
} from "@real-life-stack/data-interface"
import { relationItemVonRecord, recordVonRelationItem, leeresRls } from "../../../modell.mjs"

/**
 * Der Connector dieser App: ein `MockConnector` als Gedächtnis im Browser,
 * davor eine Schicht, die jede Schreibbewegung zusätzlich an den Server
 * schickt und Nachrichten der anderen Clients wieder hineinlegt.
 *
 * Er ist KEINE Kopie des MockConnector, sondern benutzt ihn (Komposition):
 * ein Proxy reicht alles durch, was er nicht selbst beantwortet. Dadurch
 * erbt die App jede Fähigkeit, die der MockConnector heute und morgen hat —
 * Items, RelationRecords, Groups, Aktivität, Benachrichtigungen — ohne dass
 * hier eine Liste gepflegt werden müsste, die lautlos veraltet.
 *
 * Wie man ihn gegen einen anderen Connector tauscht, steht in README.md.
 */

/** Die App kennt keine Anmeldung: wer das Brett offen hat, ist „am Tisch". */
export const TISCH = { id: "did:karabirrdt:tisch", displayName: "Am Tisch" }

export interface BrettDaten {
  group: Group
  items: Item[]
  relations: RelationRecord[]
}

const basis = (brett: string) => `/api/b/${encodeURIComponent(brett)}`

export async function ladeBrett(brett: string): Promise<BrettDaten> {
  const antwort = await fetch(`${basis(brett)}/rls`, { cache: "no-store" })
  if (!antwort.ok) throw new Error(`Brett ${brett} nicht ladbar (${antwort.status})`)
  return (await antwort.json()) as BrettDaten
}

/** Alles in einem Rutsch ersetzen (JSON-Import). Beide Formate sind erlaubt. */
export async function importiereBrett(brett: string, json: unknown): Promise<void> {
  const antwort = await fetch(`${basis(brett)}/rls/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(json),
  })
  if (!antwort.ok) throw new Error(`Import abgelehnt (${antwort.status})`)
}

export interface Verbindung {
  connector: FullConnector
  /** „live" heißt: die WebSocket steht. */
  aufZustand(hoerer: (live: boolean) => void): () => void
}

export async function erstelleServerConnector(brett: string): Promise<Verbindung> {
  const daten = await ladeBrett(brett)
  const alsItems = [...daten.items, ...daten.relations.map(relationItemVonRecord)]
  const seed: MockConnectorSeed = {
    items: alsItems,
    groups: [daten.group ?? leeresRls(brett).group],
    users: [TISCH],
    groupMembers: { [brett]: [TISCH.id] },
    groupItems: { [brett]: alsItems.map((i) => i.id) },
  }
  // `allowFixtureAuthors`: Autor und Entstehungszeit kommen vom Server, nicht
  // aus dieser Sitzung — sonst trüge jedes nachgeladene Item die Kennung des
  // Geräts, das es zuletzt gelesen hat. Die Kehrseite steht in README.md.
  const mock = new MockConnector(seed, { allowFixtureAuthors: true })
  await mock.init()
  mock.setCurrentGroup(brett)

  // Was wir gerade selbst geschrieben haben, kommt über die WebSocket zurück.
  // Signatur merken und die Rückmeldung überspringen, statt sie erneut
  // anzuwenden.
  const eigene = new Map<string, string>()
  const merke = (schluessel: string, wert: unknown) => eigene.set(schluessel, JSON.stringify(wert ?? null))
  const warSelbst = (schluessel: string, wert: unknown) => {
    const erwartet = eigene.get(schluessel)
    if (erwartet === undefined || erwartet !== JSON.stringify(wert ?? null)) return false
    eigene.delete(schluessel)
    return true
  }

  const schreibe = async (pfad: string, methode: string, koerper?: unknown) => {
    try {
      const antwort = await fetch(basis(brett) + pfad, {
        method: methode,
        headers: { "content-type": "application/json" },
        body: koerper === undefined ? undefined : JSON.stringify(koerper),
      })
      if (!antwort.ok) console.warn("Server lehnt ab:", pfad, antwort.status)
    } catch (e) {
      console.warn("Server nicht erreichbar:", pfad, e)
    }
  }

  /** Ein Item liegt je nach Art in der Items- oder in der Relations-Ablage. */
  const sendeItem = (item: Item) => {
    const record = recordVonRelationItem(item)
    if (record) {
      merke(`relation:${record.id}`, record)
      return schreibe(`/relations/${encodeURIComponent(record.id)}`, "PUT", record)
    }
    merke(`item:${item.id}`, item)
    return schreibe(`/items/${encodeURIComponent(item.id)}`, "PUT", item)
  }

  const ueberschrieben: Record<string, unknown> = {
    createItem: async (eingabe: Parameters<FullConnector["createItem"]>[0]) => {
      const item = await mock.createItem(eingabe)
      void sendeItem(item)
      return item
    },
    updateItem: async (id: string, aenderungen: Partial<Item>) => {
      const item = await mock.updateItem(id, aenderungen)
      void sendeItem(item)
      return item
    },
    deleteItem: async (id: string) => {
      const vorher = await mock.getItem(id)
      await mock.deleteItem(id)
      const record = vorher ? recordVonRelationItem(vorher) : null
      const art = record ? "relations" : "items"
      merke(`${record ? "relation" : "item"}:${id}`, null)
      await schreibe(`/${art}/${encodeURIComponent(id)}`, "DELETE")
    },
    createRelationRecord: async (eingabe: RelationRecordInput) => {
      const record = await mock.createRelationRecord(eingabe)
      merke(`relation:${record.id}`, record)
      void schreibe(`/relations/${encodeURIComponent(record.id)}`, "PUT", record)
      return record
    },
    updateRelationRecord: async (id: string, aenderungen: RelationRecordUpdate) => {
      const record = await mock.updateRelationRecord(id, aenderungen)
      merke(`relation:${record.id}`, record)
      void schreibe(`/relations/${encodeURIComponent(id)}`, "PUT", record)
      return record
    },
    deleteRelationRecord: async (id: string) => {
      await mock.deleteRelationRecord(id)
      merke(`relation:${id}`, null)
      await schreibe(`/relations/${encodeURIComponent(id)}`, "DELETE")
    },
    updateGroup: async (id: string, aenderungen: Partial<Group>) => {
      const group = await mock.updateGroup(id, aenderungen)
      if (id === brett) {
        merke("group", group)
        void schreibe("/group", "PUT", { name: aenderungen.name, data: aenderungen.data })
      }
      return group
    },
  }

  const connector = new Proxy(mock, {
    get(ziel, name) {
      if (Object.hasOwn(ueberschrieben, name as string)) return ueberschrieben[name as string]
      const wert = Reflect.get(ziel, name, ziel)
      return typeof wert === "function" ? wert.bind(ziel) : wert
    },
  }) as unknown as FullConnector

  // --------------------------------------------------- Nachrichten der anderen

  const setzeItem = async (item: Item | null, id: string) => {
    const vorhanden = await mock.getItem(id)
    if (!item) {
      if (vorhanden) await mock.deleteItem(id)
      return
    }
    if (vorhanden) await mock.updateItem(id, item)
    else mock.injectSeedItems([item], brett)
  }

  const ersetzeAlles = async (neu: BrettDaten) => {
    const neuItems = [...neu.items, ...neu.relations.map(relationItemVonRecord)]
    const behalten = new Set(neuItems.map((i) => i.id))
    for (const alt of await mock.getItems()) if (!behalten.has(alt.id)) await mock.deleteItem(alt.id)
    for (const item of neuItems) await setzeItem(item, item.id)
    await mock.updateGroup(brett, { name: neu.group?.name, data: neu.group?.data })
  }

  const zustandHoerer = new Set<(live: boolean) => void>()
  const melde = (live: boolean) => zustandHoerer.forEach((h) => h(live))

  let warte = 1000
  const verbinde = () => {
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${encodeURIComponent(brett)}`,
    )
    ws.onopen = () => {
      warte = 1000
      melde(true)
      // Nach einer Unterbrechung kann etwas verpasst worden sein.
      void ladeBrett(brett).then(ersetzeAlles).catch(() => {})
    }
    ws.onmessage = async (ev) => {
      let n: { type: string; id?: string; data?: unknown }
      try {
        n = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (n.type === "reset") return void ersetzeAlles(n.data as BrettDaten)
      if (n.type === "group") {
        if (warSelbst("group", n.data)) return
        const g = n.data as Group
        return void mock.updateGroup(brett, { name: g?.name, data: g?.data })
      }
      if (!n.id) return
      if (n.type === "item") {
        if (warSelbst(`item:${n.id}`, n.data)) return
        return void setzeItem((n.data as Item) ?? null, n.id)
      }
      if (n.type === "relation") {
        if (warSelbst(`relation:${n.id}`, n.data)) return
        const record = n.data as RelationRecord | null
        return void setzeItem(record ? relationItemVonRecord(record) : null, n.id)
      }
    }
    ws.onclose = () => {
      melde(false)
      setTimeout(verbinde, warte)
      warte = Math.min(warte * 2, 15000)
    }
    ws.onerror = () => ws.close()
  }
  verbinde()

  return {
    connector,
    aufZustand(hoerer) {
      zustandHoerer.add(hoerer)
      return () => zustandHoerer.delete(hoerer)
    },
  }
}
