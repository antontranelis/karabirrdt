import { MockConnector, type MockConnectorSeed } from "@real-life-stack/mock-connector"
import {
  createObservable,
  type FullConnector,
  type Group,
  type Item,
  type RelationRecord,
  type RelationRecordInput,
  type RelationRecordUpdate,
  type ReactiveObservable,
  type User,
} from "@real-life-stack/data-interface"
import { AUTOR, KENNUNG, freieKennung, relationItemVonRecord, recordVonRelationItem, leeresRls } from "../../../modell.mjs"

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
 * Ein Brett ist eine Group: `/api/gruppen` ist die Liste aller Bretter, der
 * Space-Switch wechselt zwischen ihnen, und die Adresse `/<brett>` folgt dem
 * Wechsel. Wie man den Connector tauscht, steht in README.md.
 */

/** Die App kennt keine Anmeldung: wer das Brett offen hat, ist „am Tisch". */
export const TISCH = { id: AUTOR, displayName: "Am Tisch" }

export interface BrettDaten {
  group: Group
  items: Item[]
  relations: RelationRecord[]
  members?: User[]
}

const basis = (brett: string) => `/api/b/${encodeURIComponent(brett)}`

export async function ladeGruppen(): Promise<Group[]> {
  const antwort = await fetch("/api/gruppen", { cache: "no-store" })
  if (!antwort.ok) return []
  return (await antwort.json()) as Group[]
}

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
  /** „live" heißt: die WebSocket zum aktuellen Brett steht. */
  aufZustand(hoerer: (live: boolean) => void): () => void
}

export async function erstelleServerConnector(startBrett: string): Promise<Verbindung> {
  const gruppen = await ladeGruppen()
  const daten = await ladeBrett(startBrett)
  const alsItems = [...daten.items, ...daten.relations.map(relationItemVonRecord)]

  // Alle Bretter sind von Anfang an Groups — nur die Items des geöffneten
  // liegen schon da. Die anderen kommen beim Wechsel dazu.
  const alleGruppen = gruppen.some((g) => g.id === startBrett)
    ? gruppen.map((g) => (g.id === startBrett ? daten.group : g))
    : [daten.group, ...gruppen]

  const seed: MockConnectorSeed = {
    items: alsItems,
    groups: alleGruppen,
    users: [TISCH, ...(daten.members ?? [])],
    groupMembers: Object.fromEntries(alleGruppen.map((g) => [g.id, [TISCH.id]])),
    groupItems: { [startBrett]: alsItems.map((i) => i.id) },
  }
  // `allowFixtureAuthors`: Autor und Entstehungszeit kommen vom Server, nicht
  // aus dieser Sitzung — sonst trüge jedes nachgeladene Item die Kennung des
  // Geräts, das es zuletzt gelesen hat. Die Kehrseite steht in README.md.
  const mock = new MockConnector(seed, { allowFixtureAuthors: true })
  await mock.init()
  mock.setCurrentGroup(startBrett)

  let aktuell = startBrett
  const geladen = new Set([startBrett])

  // Die Mitglieder je Brett. Der MockConnector kennt nur, was im Seed stand;
  // nachträglich lassen sich dort weder Nutzer noch Mitgliedschaften
  // ergänzen (Upstream-Lücke, siehe README). Darum führt diese Schicht die
  // Liste selbst und beantwortet die Mitglieder-Fragen des Vertrags.
  const mitglieder = new Map<string, User[]>([[startBrett, daten.members ?? []]])
  const mitgliederObs = new Map<string, ReactiveObservable<User[]>>()
  const beobachteMitglieder = (brett: string) => {
    let obs = mitgliederObs.get(brett)
    if (!obs) {
      obs = createObservable<User[]>(mitglieder.get(brett) ?? [])
      mitgliederObs.set(brett, obs)
    }
    return obs
  }
  const setzeMitglieder = (brett: string, liste: User[]) => {
    mitglieder.set(brett, liste)
    beobachteMitglieder(brett).set(liste)
  }
  setzeMitglieder(startBrett, daten.members ?? [])

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

  const schreibeAn = async (brett: string, pfad: string, methode: string, koerper?: unknown) => {
    try {
      const antwort = await fetch(basis(brett) + pfad, {
        method: methode,
        headers: { "content-type": "application/json" },
        body: koerper === undefined ? undefined : JSON.stringify(koerper),
      })
      if (!antwort.ok) console.warn("Server lehnt ab:", pfad, antwort.status)
      return antwort.ok
    } catch (e) {
      console.warn("Server nicht erreichbar:", pfad, e)
      return false
    }
  }
  const schreibe = (pfad: string, methode: string, koerper?: unknown) => schreibeAn(aktuell, pfad, methode, koerper)

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

  // ---------------------------------------------------- Brett wechseln

  const setzeAdresse = (brett: string) => {
    const ziel = `/${brett}`
    if (location.pathname !== ziel) history.pushState({ brett }, "", ziel)
  }

  const nachladen = async (brett: string) => {
    if (geladen.has(brett)) return
    geladen.add(brett)
    try {
      const b = await ladeBrett(brett)
      setzeMitglieder(brett, b.members ?? [])
      mock.injectSeedItems([...b.items, ...b.relations.map(relationItemVonRecord)], brett)
      await mock.updateGroup(brett, { name: b.group?.name, data: b.group?.data })
    } catch (e) {
      geladen.delete(brett)
      console.warn("Brett nicht ladbar:", brett, e)
    }
  }

  const wechsle = (brett: string) => {
    if (brett === aktuell) return
    aktuell = brett
    mock.setCurrentGroup(brett)
    setzeAdresse(brett)
    verbinde()
    void nachladen(brett)
  }

  window.addEventListener("popstate", () => {
    const brett = location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase() || "haupt"
    if (KENNUNG.test(brett) && brett !== aktuell) wechsle(brett)
  })

  // ---------------------------------------------------- Überschriebenes

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

    // --- Mitglieder ---
    getMembers: async (groupId: string | null) => mitglieder.get(groupId ?? aktuell) ?? [],
    observeMembers: (groupId: string | null) => beobachteMitglieder(groupId ?? aktuell),
    getUser: async (id: string) => {
      for (const liste of mitglieder.values()) {
        const gefunden = liste.find((u) => u.id === id)
        if (gefunden) return gefunden
      }
      return id === TISCH.id ? TISCH : null
    },
    inviteMember: async (groupId: string, userId: string) => {
      const bekannt = (await ueberschrieben.getUser as (id: string) => Promise<User | null>)(userId)
      const nutzer: User = (await bekannt) ?? { id: userId, displayName: userId }
      await schreibeAn(groupId, `/members/${encodeURIComponent(userId)}`, "PUT", { displayName: nutzer.displayName })
      const liste = mitglieder.get(groupId) ?? []
      if (!liste.some((u) => u.id === userId)) setzeMitglieder(groupId, [...liste, nutzer])
    },
    removeMember: async (groupId: string, userId: string) => {
      await schreibeAn(groupId, `/members/${encodeURIComponent(userId)}`, "DELETE")
      setzeMitglieder(groupId, (mitglieder.get(groupId) ?? []).filter((u) => u.id !== userId))
    },

    // --- Bretter als Spaces -------------------------------------------------
    setCurrentGroup: (id: string | null) => {
      if (!id) return
      wechsle(id)
    },
    updateGroup: async (id: string, aenderungen: Partial<Group>) => {
      const group = await mock.updateGroup(id, aenderungen)
      merke("group", group)
      void schreibeAn(id, "/group", "PUT", { name: aenderungen.name, data: aenderungen.data })
      return group
    },
    /**
     * Ein neues Brett. Die Adresse leitet sich aus dem Namen ab, der Server
     * legt es mit `PUT /group` an — und danach lädt die Seite dort neu.
     *
     * Warum neu laden statt weich wechseln: `MockConnector.createGroup` vergibt
     * die Id selbst (`group-<zeit>`) und nimmt keine mit. Ein Connector, der
     * ihn benutzt, kann die Kennung des Servers also nicht durchreichen —
     * Upstream-Lücke, siehe docs/rls-kompatibel.md. Ein Seitenwechsel auf das
     * frische, leere Brett ist die ehrliche Antwort darauf.
     */
    createGroup: async (name: string, data?: Record<string, unknown>) => {
      const belegt = (await mock.getGroups()).map((g) => g.id)
      const id = freieKennung(name, belegt)
      const vorlage = leeresRls(id).group.data
      await schreibeAn(id, "/group", "PUT", { name, data: { ...vorlage, ...(data ?? {}), name } })
      // Wer ein Brett anlegt, ist sein erstes Mitglied.
      await schreibeAn(id, `/members/${encodeURIComponent(TISCH.id)}`, "PUT", { displayName: TISCH.displayName })
      const group: Group = { id, name, data: { ...vorlage, ...(data ?? {}), name } }
      location.assign(`/${id}`)
      return group
    },
    deleteGroup: async (id: string) => {
      await schreibeAn(id, "/rls", "DELETE")
      await mock.deleteGroup(id)
      const rest = (await mock.getGroups()).filter((g) => g.id !== id)
      location.assign(`/${rest[0]?.id ?? "haupt"}`)
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
    else mock.injectSeedItems([item], aktuell)
  }

  const ersetzeAlles = async (neu: BrettDaten) => {
    const neuItems = [...neu.items, ...neu.relations.map(relationItemVonRecord)]
    const behalten = new Set(neuItems.map((i) => i.id))
    for (const alt of await mock.getItems()) if (!behalten.has(alt.id)) await mock.deleteItem(alt.id)
    for (const item of neuItems) await setzeItem(item, item.id)
    setzeMitglieder(aktuell, neu.members ?? [])
    await mock.updateGroup(aktuell, { name: neu.group?.name, data: neu.group?.data })
  }

  const zustandHoerer = new Set<(live: boolean) => void>()
  let lebt = false
  const melde = (live: boolean) => {
    lebt = live
    zustandHoerer.forEach((h) => h(live))
  }

  let warte = 1000
  let generation = 0
  let offen: WebSocket | null = null

  function verbinde() {
    const meine = ++generation
    const brett = aktuell
    offen?.close()
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${encodeURIComponent(brett)}`,
    )
    offen = ws
    ws.onopen = () => {
      if (meine !== generation) return ws.close()
      warte = 1000
      melde(true)
      // Nach einer Unterbrechung kann etwas verpasst worden sein.
      void ladeBrett(brett)
        .then((b) => {
          if (meine === generation) return ersetzeAlles(b)
        })
        .catch(() => {})
    }
    ws.onmessage = async (ev) => {
      if (meine !== generation) return
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
      if (n.type === "member") {
        const liste = (mitglieder.get(brett) ?? []).filter((u) => u.id !== n.id)
        setzeMitglieder(brett, n.data ? [...liste, n.data as User] : liste)
        return
      }
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
      if (meine !== generation) return
      melde(false)
      setTimeout(() => {
        if (meine === generation) verbinde()
      }, warte)
      warte = Math.min(warte * 2, 15000)
    }
    ws.onerror = () => ws.close()
  }
  verbinde()

  return {
    connector,
    aufZustand(hoerer) {
      zustandHoerer.add(hoerer)
      hoerer(lebt)
      return () => zustandHoerer.delete(hoerer)
    },
  }
}
