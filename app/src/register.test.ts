import { describe, expect, it } from "vitest"
import { contentTypeFromRegister, resolveTypePresentation } from "@real-life-stack/toolkit"
import { getTypeManifest } from "@real-life-stack/data-interface"
import { bindeRegister } from "./register"

bindeRegister()

describe("Register-Schicht der Karabirrdt-App", () => {
  it("bindet das Manifest: Das Ziel nimmt Karten auf (←partOf) — in beiden Kopien", () => {
    // Die Kopie, die der MockConnector importiert …
    const ziel = getTypeManifest().get("project")
    expect(ziel?.relations).toContainEqual({ predicate: "partOf", itemRole: "to", otherKind: "task" })
    // … und die im Toolkit gebündelte: Sie hätte die Liste ohne Manifest-Kante abgelehnt.
    expect(resolveTypePresentation("project").edges?.some((e) => e.predicate === "partOf" && e.itemRole === "to")).toBe(true)
  })

  it("die Karte führt Aufwand, Stufe im Modul und die Kanten des Toolkits", () => {
    const karte = resolveTypePresentation("task")
    const felder = karte.fields ?? []
    expect(felder.filter((f) => f.label === "Aufwand").map((f) => [f.key, f.unit])).toEqual([
      ["hours", "h"],
      ["euros", "€"],
    ])
    expect(felder.find((f) => f.key === "stage")?.pos).toBe("module")
    // Kern-Status und Kern-Beschriftungen bleiben (Anton 28.09.)
    expect(felder.find((f) => f.key === "status")?.options?.map((o) => o.label)).toEqual(["To Do", "In Arbeit", "Erledigt"])
    const kanten = karte.edges ?? []
    expect(kanten.map((e) => [e.predicate, e.itemRole, e.label])).toEqual(
      expect.arrayContaining([
        ["blocks", "to", "Braucht"],
        ["blocks", "from", "Ermöglicht"],
        ["partOf", "from", "Teil von"],
      ]),
    )
  })

  it("„kann“ und „lernt“ sind Werte am Qualifier, die Pills heißen „Kann ich“ · „Will lernen“", () => {
    const zuweisung = resolveTypePresentation("task").edges?.find((e) => e.predicate === "assignedTo")
    expect(zuweisung?.qualifier?.key).toBe("role")
    expect(zuweisung?.qualifier?.values.map((v) => [v.id, v.label, v.action])).toEqual([
      ["can", "kann", "Kann ich"],
      ["learns", "lernt", "Will lernen"],
    ])
    expect(zuweisung?.selfAction?.label).toBe("Kann ich")
    expect(zuweisung?.selfAction?.qualifiers).toEqual(["can", "learns"])
  })

  it("das Ziel: Titel, Traumsatz, Punkte, Liste „Karten“", () => {
    const ziel = resolveTypePresentation("project")
    expect(ziel.fields?.map((f) => [f.key, f.widget, f.pos, f.label])).toEqual([
      ["title", "title", "head", undefined],
      ["description", "text", "content", "Traumsatz"],
      ["dots", "number", "meta", "Punkte"],
      ["order", "number", "module", undefined],
    ])
    expect(ziel.edges?.find((e) => e.pos === "list")?.label).toBe("Karten")
    // Badge vom Fragment, Wort von der Basis
    expect(ziel.badge?.className).toMatch(/violet/)
    expect(ziel.label).toBe("Projekt")
  })

  it("der Composer leitet sich daraus ab — ohne eigene Widgets", () => {
    const karte = contentTypeFromRegister("task")
    expect(karte.defaultWidgets).toContain("number")
    expect(karte.defaultWidgets).not.toContain("aufwand")
    const ziel = contentTypeFromRegister("project")
    expect(ziel.defaultWidgets).toEqual(expect.arrayContaining(["title", "text", "number"]))
  })

  it("zweimal binden schadet nicht", () => {
    expect(() => bindeRegister()).not.toThrow()
  })
})
