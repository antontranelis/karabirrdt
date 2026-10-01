import { describe, expect, it } from "vitest"
import { MockConnector } from "@real-life-stack/mock-connector"
import { hasGroups, hasGroupScope, type Item } from "@real-life-stack/data-interface"
import { mitBrettRegeln, rohVon } from "./brett-regeln"

const karte = (id: string, stage: number, nach: string[] = []): Item => ({
  id,
  type: "task",
  createdAt: "2026-10-01T00:00:00Z",
  createdBy: "ich",
  data: { title: id, stage, status: "open" },
  relations: [{ predicate: "partOf", target: "item:z" }, ...nach.map((n) => ({ predicate: "blocks", target: `item:${n}` }))],
})

async function brett() {
  const items: Item[] = [
    { id: "z", type: "project", createdAt: "2026-10-01T00:00:00Z", createdBy: "ich", data: { title: "Z", dots: 2 } },
    karte("a", 0, ["b"]),
    karte("b", 3),
    karte("c", 5),
  ]
  const mock = new MockConnector(
    {
      items,
      groups: [{ id: "g", name: "Brett", data: {} }, { id: "h", name: "Anderes", data: {} }],
      users: [{ id: "ich", displayName: "Ich" }],
      groupMembers: { g: ["ich"], h: ["ich"] },
      groupItems: { g: items.map((i) => i.id) },
    },
    { allowFixtureAuthors: true },
  )
  await mock.init()
  mock.setCurrentGroup("g")
  return { mock, connector: mitBrettRegeln(mock) }
}

describe("Brett-Regeln um den Connector", () => {
  it("lehnt einen Faden nach links ab, auch für ein neues Item ohne Id", async () => {
    const { mock, connector } = await brett()
    await expect(
      connector.createItem({
        type: "task",
        createdBy: "ich",
        data: { title: "spät", stage: 5 },
        relations: [{ predicate: "partOf", target: "item:z" }, { predicate: "blocks", target: "item:a" }],
      }),
    ).rejects.toThrow(/rechts|links/i)
    expect((await mock.getItems()).length).toBe(4)
  })

  it("lehnt eine Änderung ab, die einen Kreis schlösse; erlaubt eine harmlose", async () => {
    const { connector } = await brett()
    await expect(connector.updateItem("b", { relations: [{ predicate: "partOf", target: "item:z" }, { predicate: "blocks", target: "item:a" }] })).rejects.toThrow()
    const neu = await connector.updateItem("c", { data: { title: "c2", stage: 5, status: "done" } })
    expect(neu.data.title).toBe("c2")
  })

  it("Löschen eines Ziels nimmt seine Karten mit; eine gelöschte Karte verliert ihre Fäden", async () => {
    const { mock, connector } = await brett()
    await connector.deleteItem("b")
    expect((await mock.getItem("a"))?.relations?.some((r) => r.predicate === "blocks")).toBe(false)
    await connector.deleteItem("z")
    expect(await mock.getItems()).toEqual([])
  })

  it("ein Brettwechsel während des Anlegens schreibt in das Brett, gegen das geprüft wurde", async () => {
    const { mock, connector } = await brett()
    const laufend = connector.createItem({ type: "project", createdBy: "ich", data: { title: "neu" } })
    mock.setCurrentGroup("h")
    const neu = await laufend
    expect((await mock.getItems({ group: "g" })).map((i) => i.id)).toContain(neu.id)
    expect((await mock.getItems({ group: "h" })).map((i) => i.id)).not.toContain(neu.id)
  })

  it("Ändern und Löschen eines Items außerhalb des offenen Bretts wird nicht ungeprüft geschrieben", async () => {
    const { mock, connector } = await brett()
    mock.setCurrentGroup("h")
    await expect(connector.updateItem("b", { relations: [{ predicate: "partOf", target: "item:z" }, { predicate: "blocks", target: "item:a" }] })).rejects.toThrow(/nicht im offenen Brett/)
    await expect(connector.deleteItem("z")).rejects.toThrow(/nicht im offenen Brett/)
    mock.setCurrentGroup("g")
    expect((await mock.getItems({ group: "g" })).length).toBe(4)
  })

  it("ohne offenes Brett: kein Anlegen, Ändern oder Löschen", async () => {
    const { mock, connector } = await brett()
    mock.setCurrentGroup(null)
    await expect(connector.createItem({ type: "project", createdBy: "ich", data: { title: "x" } })).rejects.toThrow(/Kein Brett/)
    await expect(connector.updateItem("c", { data: { title: "c2", stage: 5 } })).rejects.toThrow(/nicht im offenen Brett/)
    await expect(connector.deleteItem("z")).rejects.toThrow(/nicht im offenen Brett/)
  })

  it("Löschen eines Ziels: scheitert eine Karte, bleibt das Ziel, und ein zweiter Versuch räumt auf", async () => {
    const { mock, connector } = await brett()
    const original = mock.deleteItem.bind(mock)
    let einmal = true
    mock.deleteItem = async (id: string) => {
      if (id === "c" && einmal) {
        einmal = false
        throw new Error("Netz weg")
      }
      return original(id)
    }
    await expect(connector.deleteItem("z")).rejects.toThrow(/Netz weg/)
    expect(await mock.getItem("z")).not.toBeNull()
    await connector.deleteItem("z")
    expect(await mock.getItems({ group: "g" })).toEqual([])
  })

  it("reicht alles andere durch und meldet die Fähigkeiten des Connectors darunter", async () => {
    const { mock, connector } = await brett()
    expect(hasGroups(connector)).toBe(true)
    expect(hasGroupScope(connector)).toBe(hasGroupScope(mock))
    expect(rohVon(connector)).toBe(mock)
    expect(rohVon(mock)).toBe(mock)
  })
})
