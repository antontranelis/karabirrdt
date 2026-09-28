import { describe, expect, it } from "vitest"
import { bindeRegister } from "./register"
import { inhaltstypen, mitPosition } from "./composer"
import { createComposerMapping } from "@real-life-stack/toolkit"

bindeRegister()

describe("Formular aus dem Register", () => {
  const { mapSubmission, editInitialData } = createComposerMapping(inhaltstypen())

  it("eine neue Karte aus einer Zelle bekommt Stufe, Reihenfolge und Zeile", () => {
    const abbildung = mitPosition(mapSubmission, { zielId: "z1", stufe: 4 }, () => 42)
    const payload = abbildung({ contentType: "task", data: { title: "Neu", hours: 3, euros: 50 } } as never, { mode: "create", existingItem: null })
    expect(payload?.type).toBe("task")
    expect(payload?.data).toMatchObject({ title: "Neu", stage: 4, order: 42, hours: 3, euros: 50 })
    expect(payload?.relations).toContainEqual({ predicate: "partOf", target: "item:z1" })
  })

  it("eine im Formular gewählte Zeile („Teil von“) gewinnt gegen die Zelle", () => {
    const abbildung = mitPosition(mapSubmission, { zielId: "z1", stufe: 0 }, () => 1)
    const payload = abbildung(
      { contentType: "task", data: { title: "N", "relation:partOf": ["item:z2"] } } as never,
      { mode: "create", existingItem: null },
    )
    const zeilen = (payload?.relations ?? []).filter((r) => r.predicate === "partOf")
    expect(zeilen.map((r) => r.target)).toEqual(["item:z2"])
  })

  it("Bearbeiten lässt Stufe und Reihenfolge, wo sie sind", () => {
    const karte = { id: "k", type: "task", createdAt: "", createdBy: "u", data: { title: "K", stage: 7, order: 3, status: "open" }, relations: [{ predicate: "partOf", target: "item:z" }] }
    const abbildung = mitPosition(mapSubmission, { zielId: "anders", stufe: 1 }, () => 99)
    const vorbelegt = editInitialData(karte as never)
    const payload = abbildung({ contentType: "task", data: { ...vorbelegt, title: "K2" } } as never, { mode: "edit", existingItem: karte as never })
    expect(payload?.data).toMatchObject({ title: "K2", stage: 7, order: 3 })
  })

  it("ein neues Ziel beginnt ohne Punkte, hinten in der Reihenfolge", () => {
    const payload = mitPosition(mapSubmission, null, () => 5)({ contentType: "project", data: { title: "Ziel" } } as never, { mode: "create", existingItem: null })
    expect(payload?.data).toMatchObject({ title: "Ziel", dots: 0, order: 5 })
  })
})
