import { beforeEach, describe, expect, it, vi } from "vitest"
import { hasGroupScope, hasItemGroups, hasRelationRecords, hasRelationRecordWriter, type Item } from "@real-life-stack/data-interface"
import { erstelleServerConnector, hatIchWahl, TISCH } from "./server-connector"

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

class StillerSocket {
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  close() {}
}

beforeEach(() => {
  aufrufe = []
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

  it("neue Items bekommen die zufällige Id des MockConnectors (mock-connector 0.2.3, Lücke 26)", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    const zeile = [{ predicate: "partOf", target: "item:z" }]
    const a = await connector.createItem({ type: "task", createdBy: TISCH.id, data: { title: "x" }, relations: zeile })
    const b = await connector.createItem({ type: "task", createdBy: TISCH.id, data: { title: "y" }, relations: zeile })
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(a.id).not.toBe(b.id)
    expect(aufrufe.filter((x) => x.methode === "PUT").map((x) => x.pfad)).toEqual([`/api/b/haupt/items/${a.id}`, `/api/b/haupt/items/${b.id}`])
  })

  it("die Brett-Regeln gelten auch für ein neues Item, bevor es eine Id hat", async () => {
    const { connector } = await erstelleServerConnector("haupt")
    await expect(
      connector.createItem({
        type: "task",
        createdBy: TISCH.id,
        data: { title: "spät", stage: 5 },
        relations: [{ predicate: "partOf", target: "item:z" }, { predicate: "blocks", target: "item:a" }],
      }),
    ).rejects.toThrow()
    expect(aufrufe.filter((x) => x.methode === "PUT")).toEqual([])
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
