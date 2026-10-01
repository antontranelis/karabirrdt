import { describe, expect, it } from "vitest"
import { act, render, waitFor } from "@testing-library/react"
import { ConnectorProvider } from "@real-life-stack/toolkit"
import { MockConnector } from "@real-life-stack/mock-connector"
import { bindeRegister } from "../register"
import { mitBrettRegeln } from "../connector/brett-regeln"
import { Anlegen } from "./anlegen"

bindeRegister()

// Ein Connector mit den Brett-Regeln der App (wie im Betrieb um den
// Supabase-Connector, hier um den MockConnector): So sieht das Formular, was
// es im Brett sieht.
const ziel = (id: string, title: string) => ({ id, type: "project", createdAt: "", createdBy: "ich", data: { title } })

async function verbinde() {
  const items = [ziel("a", "Ziel Alpha"), ziel("b", "Ziel Beta")]
  const mock = new MockConnector(
    { items, groups: [{ id: "g", name: "Brett", data: {} }], users: [{ id: "ich", displayName: "Ich" }], groupMembers: { g: ["ich"] }, groupItems: { g: ["a", "b"] } },
    { allowFixtureAuthors: true },
  )
  await mock.init()
  mock.setCurrentGroup("g")
  // Wie der Supabase-Connector: kein Verschieben zwischen Spaces
  // (`ItemGroupCapable` fehlt dort), sonst verlangte das Formular einen Space.
  const wieSupabase = new Proxy(mock, {
    has: (ziel, name) => name !== "moveItemToGroup" && name !== "getItemGroupId" && Reflect.has(ziel, name),
    get: (ziel, name) => {
      if (name === "moveItemToGroup" || name === "getItemGroupId") return undefined
      const wert = Reflect.get(ziel, name, ziel)
      return typeof wert === "function" ? wert.bind(ziel) : wert
    },
  })
  return mitBrettRegeln(wieSupabase)
}

describe("Anlegen aus einer Zelle", () => {
  it("ein Klick in eine Zelle eines anderen Ziels bei offenem Formular zieht „Teil von“ mit (Codex-Runde 2)", async () => {
    const mock = await verbinde()
    const props = { nurKarte: true, composerProps: {}, onFertig: () => {}, onAbbruch: () => {} }
    const ansicht = render(
      <ConnectorProvider connector={mock}>
        <Anlegen zelle={{ zielId: "a", stufe: 1 }} {...props} />
      </ConnectorProvider>,
    )
    // Der Chip unter „Teil von“ zeigt den Titel des Ziels.
    await waitFor(() => expect(ansicht.container.textContent).toContain("Ziel Alpha"))
    await act(async () => {
      ansicht.rerender(
        <ConnectorProvider connector={mock}>
          <Anlegen zelle={{ zielId: "b", stufe: 4 }} {...props} />
        </ConnectorProvider>,
      )
    })
    await waitFor(() => expect(ansicht.container.textContent).toContain("Ziel Beta"))
    expect(ansicht.container.textContent).not.toContain("Ziel Alpha")
  })
})
