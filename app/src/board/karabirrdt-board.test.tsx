import { describe, expect, it } from "vitest"
import { render } from "@testing-library/react"
import type { Item } from "@real-life-stack/data-interface"
import { KarabirrdtBoard } from "./karabirrdt-board"

const ziel: Item = { id: "z1", type: "project", createdAt: "", createdBy: "u", data: { title: "Ziel: eins", dots: 2 } }

describe("Brett", () => {
  it("lässt unten Platz für Filter-Pille und Plus-Knopf: liest --module-controls-block (Lücke 10)", () => {
    const { container } = render(
      <KarabirrdtBoard ziele={[ziel]} karten={[]} faeden={[]} aktiv={null} pickt={false} mitglieder={[]} onKarte={() => {}} onZelle={() => {}} onZiel={() => {}} onVerschieben={() => {}} />,
    )
    const polster = container.querySelector<HTMLElement>("[data-ecke-polster]")
    expect(polster).not.toBeNull()
    expect(polster!.style.height).toBe("var(--module-controls-block, 0px)")
  })
})
