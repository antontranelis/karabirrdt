import { beforeEach, describe, expect, it, vi } from "vitest"
import { hasGroupScope, hasItemGroups, hasRelationRecords, hasRelationRecordWriter, type Item } from "@real-life-stack/data-interface"
import { erstelleServerConnector, hatBrettHalt, hatIchWahl, TISCH } from "./server-connector"

// Ein Server im Speicher: GET liefert das Brett, PUT/DELETE werden mitgeschrieben.
const karte = (id: string, stage: number, nach: string[] = []): Item => ({
  id,
  type: "task",
  createdAt: "2026-09-28T00:00:00Z",
  createdBy: TISCH.id,
  data: { title: id, stage, status: "open" },
  relations: [{ predicate: "partOf", target: "item:z" }, ...nach.map((n) => ({ predicate: "blocks", target: `item:${n}` }))],
})
const brett = () => ({
  group: { id: "haupt", name: "Haupt", data: {} },
  items: [
    { id: "z", type: "project", createdAt: "2026-09-28T00:00:00Z", createdBy: TISCH.id, data: { title: "Z", dots: 2 } },
    karte("a", 0, ["b"]),
    karte("b", 3),
    karte("c", 5),
  ],
  relations: [
    // ein Faden in einen anderen Space: bleibt Datensatz (Umzug), muss im Export mitkommen
    { id: "r-fremd", predicate: "blocks", from: "item:a", to: "space:anders/item:b", createdBy: TISCH.id, createdAt: "2026-09-28T00:00:00Z" },
  ],
  members: [{ id: "user:anton", displayName: "Anton" }],
})

let aufrufe: { methode: string; pfad: string; koerper?: unknown }[] = []
/** Solange gesetzt, warten schreibende Anfragen darauf — so lässt sich „mitten im Löschen" nachstellen. */
let bremse: Promise<void> | null = null

let sockets: StillerSocket[] = []
class StillerSocket {
  constructor() {
    sockets.push(this)
  }
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  close() {}
}

beforeEach(() => {
  aufrufe = []
  bremse = null
  sockets = []
  localStorage.clear()
  vi.stubGlobal("WebSocket", StillerSocket)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pfad: string, init?: RequestInit) => {
      const methode = init?.method ?? "GET"
      aufrufe.push({ methode, pfad, koerper: init?.body ? JSON.parse(String(init.body)) : undefined })
      const antwort =
        pfad === "/api/gruppen"
          ? [{ id: "haupt", name: "Haupt", data: {} }, { id: "zwei", name: "Zwei", data: {} }]
          : pfad.endsWith("/rls")
            ? { ...brett(), group: { id: pfad.split("/")[3], name: "", data: {} } }
            : { ok: true }
      if (bremse && methode !== "GET") await bremse
      return new Response(JSON.stringify(antwort), { status: 200 })
    }),
  )
})

describe("ServerConnector", () => {
  it("meldet nicht, was der Server nicht kann: kein Anlegen in fremden Spaces, kein Verschieben", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    expect(hasGroupScope(connector)).toBe(false)
    expect(hasItemGroups(connector)).toBe(false)
    expect("moveItemToGroup" in connector).toBe(false)
    // Was er kann, bleibt: Datensätze schreiben (für andere Prädikate als Fäden)
    expect(hasRelationRecordWriter(connector)).toBe(true)
  })

  it("lehnt einen Faden nach links ab, gleich woher er kommt", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    // c (Stufe 5) als Voraussetzung von b (Stufe 3): nach links
    const c = (await connector.getItem("c"))!
    await expect(connector.updateItem("c", { relations: [...(c.relations ?? []), { predicate: "blocks", target: "item:b" }] })).rejects.toThrow(
      /nur nach rechts/,
    )
    expect(aufrufe.some((a) => a.methode === "PUT")).toBe(false)
    // b (3) → c (5) geht und landet beim Server
    const b = (await connector.getItem("b"))!
    await connector.updateItem("b", { relations: [...(b.relations ?? []), { predicate: "blocks", target: "item:c" }] })
    expect(aufrufe.find((a) => a.methode === "PUT")?.pfad).toBe("/api/b/haupt/items/b")
  })

  it("Löschen einer Karte nimmt den Faden an ihrer Voraussetzung mit", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    await connector.deleteItem("b")
    const a = (await connector.getItem("a"))!
    expect(a.relations?.some((r) => r.predicate === "blocks")).toBe(false)
    expect(aufrufe.filter((x) => x.methode !== "GET").map((x) => `${x.methode} ${x.pfad}`)).toEqual([
      "PUT /api/b/haupt/items/a",
      "DELETE /api/b/haupt/items/b",
    ])
  })

  it("ein Brettwechsel mitten im Löschen wartet, bis das Löschen im alten Brett fertig ist", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    let los!: () => void
    bremse = new Promise<void>((r) => (los = r))
    const loeschen = connector.deleteItem("b")
    await new Promise((r) => setTimeout(r, 0))
    connector.setCurrentGroup("zwei")
    los()
    await loeschen
    await new Promise((r) => setTimeout(r, 0))
    const geschrieben = aufrufe.filter((x) => x.methode !== "GET").map((x) => `${x.methode} ${x.pfad}`)
    expect(geschrieben).toEqual(["PUT /api/b/haupt/items/a", "DELETE /api/b/haupt/items/b"])
    // und danach steht das Brett wirklich auf „zwei"
    expect((await connector.getCurrentGroup())?.id).toBe("zwei")
  })

  it("solange ein Formular das Brett festhält, wartet jeder Wechsel bis zum Loslassen", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    if (!hatBrettHalt(connector)) throw new Error("kein Festhalten")
    connector.halteBrett(true)
    connector.setCurrentGroup("zwei")
    expect((await connector.getCurrentGroup())?.id).toBe("haupt")
    // Schreiben nach dem Wunsch zu wechseln (wie „Braucht“ nach dem Speichern) bleibt im alten Brett
    const a = (await connector.getItem("a"))!
    await connector.updateItem("a", { data: { ...a.data, title: "a2" } })
    expect(aufrufe.filter((x) => x.methode === "PUT").at(-1)?.pfad).toBe("/api/b/haupt/items/a")
    connector.halteBrett(false)
    expect((await connector.getCurrentGroup())?.id).toBe("zwei")
  })

  it("eine Karte ohne Ziel oder mit zwei Zielen wird abgelehnt", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    await expect(connector.updateItem("b", { relations: [] })).rejects.toThrow(/genau einem Ziel/)
    await expect(
      connector.updateItem("b", { relations: [{ predicate: "partOf", target: "item:z" }, { predicate: "partOf", target: "item:y" }] }),
    ).rejects.toThrow(/genau einem Ziel/)
  })

  it("bewahrte Datensätze bleiben über den Connector lesbar (für den Export)", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    if (!hasRelationRecords(connector)) throw new Error("keine Datensätze")
    const alle = await connector.getRelationRecords({})
    expect(alle.map((r) => r.id)).toContain("r-fremd")
  })

  it("zwei gleichzeitige Änderungen, einzeln erlaubt und zusammen ein Kreis, werden nicht beide angenommen", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    // b (3) und c (5) auf dieselbe Stufe bringen wäre Umzug; einfacher: a→b besteht, b→a ergäbe Kreis.
    // Hier zwei neue Fäden zwischen c und d auf gleicher Stufe, parallel:
    await connector.createItem({ id: "d", type: "task", createdBy: TISCH.id, data: { title: "d", stage: 5 }, relations: [{ predicate: "partOf", target: "item:z" }] })
    const c = (await connector.getItem("c"))!
    const d = (await connector.getItem("d"))!
    const ergebnisse = await Promise.allSettled([
      connector.updateItem("c", { relations: [...(c.relations ?? []), { predicate: "blocks", target: "item:d" }] }),
      connector.updateItem("d", { relations: [...(d.relations ?? []), { predicate: "blocks", target: "item:c" }] }),
    ])
    expect(ergebnisse.map((e) => e.status).sort()).toEqual(["fulfilled", "rejected"])
  })

  it("ein verspätetes Echo einer älteren eigenen Änderung setzt die neuere nicht zurück", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    const c = (await connector.getItem("c"))!
    await connector.updateItem("c", { data: { ...c.data, title: "c umbenannt" } })
    const erstePut = aufrufe.filter((x) => x.methode === "PUT").at(-1)!.koerper
    const c2 = (await connector.getItem("c"))!
    await connector.updateItem("c", { relations: [...(c2.relations ?? []), { predicate: "blocks", target: "item:b" }].slice(0, 1).concat([{ predicate: "blocks", target: "item:c-neu" }]) })
    // jetzt kommt das Echo der ERSTEN Änderung an
    sockets.at(-1)!.onmessage?.({ data: JSON.stringify({ type: "item", id: "c", data: erstePut }) })
    await new Promise((r) => setTimeout(r, 0))
    const jetzt = (await connector.getItem("c"))!
    expect(jetzt.relations?.some((r) => r.target === "item:c-neu")).toBe(true)
  })

  it("die Wahl „Wer bist du?“ gilt auch, wenn der Browser nichts speichern darf", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("voll")
    })
    try {
      if (!hatIchWahl(connector)) throw new Error("keine Wahl")
      connector.waehleIch("user:anton")
      expect((await connector.getCurrentUser())?.id).toBe("user:anton")
    } finally {
      setItem.mockRestore()
    }
  })

  it("neue Items bekommen eine zufällige Id, keine hochgezählte", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    const zeile = [{ predicate: "partOf", target: "item:z" }]
    const a = await connector.createItem({ type: "task", createdBy: TISCH.id, data: { title: "x" }, relations: zeile })
    const b = await connector.createItem({ type: "task", createdBy: TISCH.id, data: { title: "y" }, relations: zeile })
    expect(a.id).toMatch(/^[a-z0-9]{10}$/)
    expect(a.id).not.toBe(b.id)
    expect(aufrufe.filter((x) => x.methode === "PUT").map((x) => x.pfad)).toEqual([`/api/b/haupt/items/${a.id}`, `/api/b/haupt/items/${b.id}`])
  })

  it("„Wer bin ich“: ohne Wahl der Tisch, danach das gewählte Mitglied, gemerkt je Brett", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    expect((await connector.getCurrentUser())?.id).toBe(TISCH.id)
    expect(hatIchWahl(connector)).toBe(true)
    if (!hatIchWahl(connector)) return
    connector.waehleIch("user:anton")
    expect((await connector.getCurrentUser())?.displayName).toBe("Anton")
    expect(localStorage.getItem("karabirrdt:ich:haupt")).toBe("user:anton")
    // Auch der Speicher darunter schreibt als Anton, nicht als Tisch
    const geaendert = await connector.updateItem("b", { data: { title: "b2", stage: 3, status: "open" } })
    expect(geaendert.updatedBy).toBe("user:anton")
    // Wer kein Mitglied ist, wird nicht zur Identität
    connector.waehleIch("user:fremd")
    expect((await connector.getCurrentUser())?.id).toBe(TISCH.id)
  })
})
