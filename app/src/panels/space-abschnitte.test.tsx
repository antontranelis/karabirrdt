import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { Group } from "@real-life/data-interface"
import type { GroupDialogMode } from "@real-life/toolkit"
import { liveModus, spaceAbschnitte } from "./space-abschnitte"

const gruppe = (data: Record<string, unknown> = {}, id = "haupt"): Group => ({ id, name: "Haupt", data })

function zeige(id: string, group: Group, patchData = vi.fn(async () => {}), brett = "haupt") {
  const abschnitt = spaceAbschnitte({ brett, items: [], relations: [] }).find((a) => a.id === id)!
  render(<>{abschnitt.render({ group, canEdit: false, patchData })}</>)
  return patchData
}

describe("Traum und Daten als Abschnitte im GroupDialog (Lücke 13)", () => {
  it("zwei Abschnitte: Traum, Daten — keine Id eines eigenen Bereichs des Dialogs", () => {
    const abschnitte = spaceAbschnitte({ brett: "haupt", items: [], relations: [] })
    for (const a of abschnitte) expect(["members", "modules", "invite", "theme"]).not.toContain(a.id)
    expect(abschnitte.map((a) => [a.id, a.label])).toEqual([
      ["traum", "Traum"],
      ["daten", "Daten"],
    ])
  })

  it("Traumsatz und Horizont schreiben flach nach Group.data, nur über patchData", () => {
    const patch = zeige("traum", gruppe({ dream: "Alt", horizon: "2027" }))
    const satz = screen.getByLabelText("Traumsatz")
    fireEvent.change(satz, { target: { value: "  Es ist schön  " } })
    fireEvent.blur(satz)
    expect(patch).toHaveBeenLastCalledWith({ dream: "Es ist schön" })
    const horizont = screen.getByLabelText("Traumhorizont")
    fireEvent.change(horizont, { target: { value: "Mai 2028" } })
    fireEvent.blur(horizont)
    expect(patch).toHaveBeenLastCalledWith({ horizon: "Mai 2028" })
  })

  it("ein unveränderter Wert schreibt nichts", () => {
    const patch = zeige("traum", gruppe({ dream: "Alt" }))
    fireEvent.blur(screen.getByLabelText("Traumsatz"))
    expect(patch).not.toHaveBeenCalled()
  })

  it("zeigt die gelieferte Group: Eine neu gelieferte überschreibt das Feld (shared-components Regel 3)", () => {
    const abschnitt = spaceAbschnitte({ brett: "haupt", items: [], relations: [] }).find((a) => a.id === "traum")!
    const patchData = vi.fn(async () => {})
    const { rerender } = render(<>{abschnitt.render({ group: gruppe({ dream: "Alt" }), canEdit: false, patchData })}</>)
    expect(screen.getByLabelText<HTMLTextAreaElement>("Traumsatz").value).toBe("Alt")
    rerender(<>{abschnitt.render({ group: gruppe({ dream: "Neu" }), canEdit: false, patchData })}</>)
    expect(screen.getByLabelText<HTMLTextAreaElement>("Traumsatz").value).toBe("Neu")
  })

  it("Daten gibt es nur für das offene Brett — ein anderer Space hätte die falschen Karten im Export", () => {
    zeige("daten", gruppe({}, "anderes"))
    expect(screen.queryByText("Einfügen und ersetzen")).toBeNull()
    expect(screen.getByText(/Wechsle zuerst/)).toBeTruthy()
  })

  it("Daten für das offene Brett: Export und Import", () => {
    zeige("daten", gruppe())
    expect(screen.getByText("Einfügen und ersetzen")).toBeTruthy()
  })
})

describe("liveModus: der Dialog bekommt die beobachtete Group, nicht den Schnappschuss vom Öffnen", () => {
  it("ersetzt die Group im Bearbeiten-Modus durch die aktuell gelieferte", () => {
    const alt = gruppe({ dream: "Alt" })
    const neu = gruppe({ dream: "Neu" })
    const modus: GroupDialogMode = { type: "edit", group: alt }
    expect(liveModus(modus, [neu])).toEqual({ type: "edit", group: neu })
  })

  it("lässt Anlegen und eine verschwundene Group, wie sie sind", () => {
    expect(liveModus({ type: "create" }, [])).toEqual({ type: "create" })
    const alt = gruppe()
    expect(liveModus({ type: "edit", group: alt }, [])).toEqual({ type: "edit", group: alt })
  })
})
