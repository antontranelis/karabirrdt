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
import {
  AUTOR,
  KENNUNG,
  freieKennung,
  kaskade,
  leeresRls,
  neuerRegelVerstoss,
  recordVonRelationItem,
  relationItemVonRecord,
} from "../../../modell.mjs"

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

/**
 * Was dieser Connector NICHT kann und darum nicht meldet (Spec 03: nichts
 * vortäuschen). Der MockConnector darunter kann beides, der Server nicht:
 *
 * - `groupScope` (Anlegen/Lesen in einem anderen Space, ohne ihn zu öffnen):
 *   geschrieben wird immer in das offene Brett.
 * - `moveItemToGroup` (Item in einen anderen Space verschieben): der Server
 *   kennt kein Umziehen zwischen Brettern.
 *
 * Ohne beides steht der Space im Formular fest, und Item-Kanten lösen sich
 * im offenen Brett auf.
 */
const NICHT_GEMELDET = new Set<string | symbol>(["groupScope", "moveItemToGroup"])

/**
 * „Wer bin ich an diesem Brett?" Ohne Anmeldung sagt es der Mensch vor dem
 * Bildschirm selbst; gemerkt wird es je Brett im Browser. Ohne Wahl ist es
 * der Tisch. Die Selbstaktionen („Kann ich", „Will lernen") schreiben die
 * gewählte Person.
 */
export interface IchWahl {
  waehleIch(userId: string | null): void
}
export const hatIchWahl = (c: unknown): c is IchWahl => typeof (c as Partial<IchWahl>)?.waehleIch === "function"
const ichSchluessel = (brett: string) => `karabirrdt:ich:${brett}`
function liesIch(brett: string): string | null {
  try {
    return localStorage.getItem(ichSchluessel(brett))
  } catch {
    return null
  }
}
function merkeIch(brett: string, id: string | null) {
  try {
    if (id) localStorage.setItem(ichSchluessel(brett), id)
    else localStorage.removeItem(ichSchluessel(brett))
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neuladen.
  }
}

export interface BrettDaten {
  group: Group
  items: Item[]
  relations: RelationRecord[]
  members?: User[]
}

/** Eine Item-Id, die kein anderer Browser zufällig auch vergibt (Form wie die alten: klein, Ziffern). */
export function neueId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("")
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
  // Wird unten gesetzt, sobald es die Beobachtung des eigenen Nutzers gibt.
  let aktualisiereIch: () => void = () => {}
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
    if (brett === aktuell) aktualisiereIch()
  }
  setzeMitglieder(startBrett, daten.members ?? [])

  const ichVon = (brett: string): User => {
    const id = liesIch(brett)
    return (id && (mitglieder.get(brett) ?? []).find((u) => u.id === id)) || TISCH
  }
  const ichObs = createObservable<User | null>(ichVon(startBrett))
  // Der MockConnector schreibt Autor und Änderungsstempel und prüft
  // Autorenrechte (Kommentare) mit SEINEM aktuellen Nutzer. Einen Weg, ihn zu
  // setzen, bietet er nicht (`authenticate` nimmt immer den ersten Seed-
  // Nutzer) — darum setzt diese Schicht die beiden Felder selbst, damit
  // Oberfläche und Speicher dieselbe Person meinen (Lücke, docs/rls-kompatibel.md).
  const mockIntern = mock as unknown as { currentUser: User | null; currentUserObs: ReactiveObservable<User | null> }
  aktualisiereIch = () => {
    const neu = ichVon(aktuell)
    const alt = ichObs.current
    mockIntern.currentUser = neu
    if (mockIntern.currentUserObs.current?.id !== neu.id) mockIntern.currentUserObs.set(neu)
    if (alt?.id !== neu.id || alt?.displayName !== neu.displayName) ichObs.set(neu)
  }
  aktualisiereIch()

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
  /** Ein Item liegt je nach Art in der Items- oder in der Relations-Ablage. */
  const sendeItem = (brett: string, item: Item) => {
    const record = recordVonRelationItem(item)
    if (record) {
      merke(`relation:${record.id}`, record)
      return schreibeAn(brett, `/relations/${encodeURIComponent(record.id)}`, "PUT", record)
    }
    merke(`item:${item.id}`, item)
    return schreibeAn(brett, `/items/${encodeURIComponent(item.id)}`, "PUT", item)
  }

  /**
   * Jede Schreibbewegung gehört dem Brett, in dem sie begann. Der Mock kennt
   * nur ein offenes Brett; wechselte es mitten in einer Folge von Schritten
   * (Löschen mit Anhang), landeten die späteren Schritte im neuen Brett — und
   * löschten dort ein gleichnamiges Item. Darum wartet ein Wechsel, bis alle
   * laufenden Schreibbewegungen fertig sind.
   */
  let laufend = 0
  let wechselNach: string | null = null
  const exklusiv = async <T>(schritt: (brett: string) => Promise<T>): Promise<T> => {
    laufend++
    try {
      return await schritt(aktuell)
    } finally {
      laufend--
      if (laufend === 0 && wechselNach) {
        const ziel = wechselNach
        wechselNach = null
        wechsle(ziel)
      }
    }
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
    aktualisiereIch()
    setzeAdresse(brett)
    verbinde()
    void nachladen(brett)
  }

  /** Wechseln — sofort, oder nach der laufenden Schreibbewegung. */
  const wechsleSobaldFrei = (brett: string) => {
    if (laufend > 0) wechselNach = brett
    else wechsle(brett)
  }

  window.addEventListener("popstate", () => {
    const brett = location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase() || "haupt"
    if (KENNUNG.test(brett) && brett !== aktuell) wechsleSobaldFrei(brett)
  })

  // ---------------------------------------------------- Überschriebenes

  /**
   * Die Regeln des Bretts gelten für jeden Schreibweg — Formular („Braucht",
   * „Ermöglicht", „Teil von"), Selbstaktion, Modul-Pick, Ziehen: Ein Faden
   * läuft nie nach links, nie im Kreis, nie auf sich selbst, und eine Karte
   * gehört zu genau einem Ziel. Was einen NEUEN Verstoß brächte, lehnt der
   * Connector ab; das Formular zeigt den Grund und behält die Eingaben.
   */
  const pruefeRegeln = async (nachher: (vorher: Item[]) => Item[]) => {
    const vorher = await mock.getItems()
    const grund = neuerRegelVerstoss(vorher, nachher(vorher))
    if (grund) throw new Error(grund)
  }

  const ueberschrieben: Record<string, unknown> = {
    createItem: (eingabe: Parameters<FullConnector["createItem"]>[0]) =>
      exklusiv(async (brett) => {
        // Die Id vergibt diese Schicht: Der MockConnector zählt `item-100`,
        // `item-101` … je Sitzung hoch — zwei Browser am selben Brett legten
        // dieselbe Id an und überschrieben einander (Lücke, docs/rls-kompatibel.md).
        const mitId = { ...eingabe, id: eingabe.id ?? neueId() }
        await pruefeRegeln((vorher) => [...vorher, { createdAt: "", ...mitId } as Item])
        // `options.group` fällt weg: Dieser Connector legt nur im offenen Brett an.
        const item = await mock.createItem(mitId)
        void sendeItem(brett, item)
        return item
      }),
    updateItem: (id: string, aenderungen: Partial<Item>) =>
      exklusiv(async (brett) => {
        await pruefeRegeln((vorher) => vorher.map((i) => (i.id === id ? ({ ...i, ...aenderungen, id } as Item) : i)))
        const item = await mock.updateItem(id, aenderungen)
        void sendeItem(brett, item)
        return item
      }),
    /**
     * Löschen nimmt mit, was ohne das Gelöschte keinen Halt mehr hat: ein Ziel
     * seine Zeile (Karten), und jede Voraussetzung verliert ihren Faden auf
     * eine gelöschte Karte. Sonst blieben Karten ohne Zeile und Fäden ins
     * Leere in den Daten stehen — unsichtbar, aber da. Das gilt für JEDEN Weg
     * zum Löschen, auch den des Toolkits (`ItemDetailActions` löscht selbst
     * über den Connector).
     */
    deleteItem: (id: string) =>
      exklusiv(async (brett) => {
        const alle = await mock.getItems()
        const datensaetze = alle.map(recordVonRelationItem).filter((r): r is RelationRecord => !!r)
        const weg = kaskade(alle, id, datensaetze)

        for (const { id: kid, relations } of weg.aendern) {
          const item = await mock.updateItem(kid, { relations })
          await sendeItem(brett, item)
        }
        for (const rid of weg.relations) {
          await mock.deleteItem(rid)
          merke(`relation:${rid}`, null)
          await schreibeAn(brett, `/relations/${encodeURIComponent(rid)}`, "DELETE")
        }
        for (const iid of weg.items) {
          const vorher = await mock.getItem(iid)
          if (!vorher) continue
          await mock.deleteItem(iid)
          const record = recordVonRelationItem(vorher)
          const art = record ? "relations" : "items"
          merke(`${record ? "relation" : "item"}:${iid}`, null)
          await schreibeAn(brett, `/${art}/${encodeURIComponent(iid)}`, "DELETE")
        }
      }),
    createRelationRecord: (eingabe: RelationRecordInput) =>
      exklusiv(async (brett) => {
        const record = await mock.createRelationRecord(eingabe)
        merke(`relation:${record.id}`, record)
        void schreibeAn(brett, `/relations/${encodeURIComponent(record.id)}`, "PUT", record)
        return record
      }),
    updateRelationRecord: (id: string, aenderungen: RelationRecordUpdate) =>
      exklusiv(async (brett) => {
        const record = await mock.updateRelationRecord(id, aenderungen)
        merke(`relation:${record.id}`, record)
        void schreibeAn(brett, `/relations/${encodeURIComponent(id)}`, "PUT", record)
        return record
      }),
    deleteRelationRecord: (id: string) =>
      exklusiv(async (brett) => {
        await mock.deleteRelationRecord(id)
        merke(`relation:${id}`, null)
        await schreibeAn(brett, `/relations/${encodeURIComponent(id)}`, "DELETE")
      }),

    // --- Wer bin ich ---
    getCurrentUser: async () => ichObs.current,
    observeCurrentUser: () => ichObs,
    waehleIch: (userId: string | null) => {
      merkeIch(aktuell, userId)
      aktualisiereIch()
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
      wechsleSobaldFrei(id)
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
    has(ziel, name) {
      if (NICHT_GEMELDET.has(name)) return false
      return Object.hasOwn(ueberschrieben, name as string) || Reflect.has(ziel, name)
    },
    get(ziel, name) {
      if (NICHT_GEMELDET.has(name)) return undefined
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
