import { describe, expect, it } from "vitest"
import { contentTypeFromRegister, resolveTypePresentation } from "@real-life-stack/toolkit"
import { TOOLKIT_TYPE_LAYER, composeTypeManifest, getTypeManifest } from "@real-life-stack/data-interface"
import { setTypeManifest as setzeImToolkit } from "@real-life-stack/toolkit"
import { KARABIRRDT_MANIFEST_LAYER, TYPE_MANIFEST, bindeRegister } from "./register"

bindeRegister()

describe("Register-Schicht der Karabirrdt-App", () => {
  it("Toolkit und data-interface teilen EINEN Manifest-Zustand (Lücke 18, toolkit 0.4.0)", () => {
    // Bis toolkit 0.3.0 bündelte das Toolkit eine eigene Kopie: Was über
    // das Toolkit gebunden wurde, sah data-interface nicht.
    const probe = composeTypeManifest([
      TOOLKIT_TYPE_LAYER,
      KARABIRRDT_MANIFEST_LAYER,
      { name: "probe", extensions: [{ id: "project", relations: [{ predicate: "probe", itemRole: "to", otherKind: "task" }] }] },
    ])
    try {
      setzeImToolkit(probe)
      expect(getTypeManifest()).toBe(probe)
    } finally {
      setzeImToolkit(TYPE_MANIFEST)
    }
  })

  it("bindet das Manifest einmal: Das Ziel nimmt Karten auf (←partOf), für MockConnector und Register", () => {
    // Das Manifest, das der MockConnector aus data-interface liest …
    const ziel = getTypeManifest().get("project")
    expect(ziel?.relations).toContainEqual({ predicate: "partOf", itemRole: "to", otherKind: "task" })
    // … ist dasselbe, gegen das das Register die Liste „Karten" prüft.
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
    expect(felder.find((f) => f.key === "stage")?.edit).toBe(false)
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

  it("die Liste „Karten“ ist nach Stufe gegliedert und zeigt rechts den Status (Lücke 20)", () => {
    const liste = resolveTypePresentation("project").edges?.find((e) => e.pos === "list")
    expect(liste?.list).toMatchObject({ group: "stage", trailing: "status" })
    // Die Stufe ist eine Auswahl der zwölf Stufen (Spec 06 Regel 22: nur
    // status/select/number) — so heißt die Gruppe „3 · Information“ statt „2“.
    const stufe = resolveTypePresentation("task").fields?.find((f) => f.key === "stage")
    expect(stufe?.widget).toBe("select")
    expect(stufe?.pos).toBe("module")
    expect(stufe?.options?.map((o) => o.id)).toEqual(Array.from({ length: 12 }, (_, i) => String(i)))
    expect(stufe?.options?.[0]?.label).toBe("1 · Bewusstsein")
    expect(stufe?.options?.[11]?.label).toBe("12 · Weisheit")
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
