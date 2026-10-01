import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, waitFor } from "@testing-library/react"
import { ConnectorProvider } from "@real-life-stack/toolkit"
import { bindeRegister } from "../register"
import { TISCH, erstelleServerConnector } from "../connector/server-connector"
import { Anlegen } from "./anlegen"

bindeRegister()
afterEach(() => vi.unstubAllGlobals())

// Der echte ServerConnector über einem Server im Speicher (wie in
// server-connector.test.ts): So sieht das Formular, was es im Brett sieht.
const ziel = (id: string, title: string) => ({ id, type: "project", createdAt: "", createdBy: TISCH.id, data: { title } })

class StillerSocket {
  onopen = null
  onmessage = null
  onclose = null
  onerror = null
  close() {}
}

async function verbinde() {
  vi.stubGlobal("WebSocket", StillerSocket)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (pfad: string) => {
      const antwort =
        pfad === "/api/gruppen"
          ? [{ id: "haupt", name: "Haupt", data: {} }]
          : pfad.endsWith("/rls")
            ? { group: { id: "haupt", name: "Haupt", data: {} }, items: [ziel("a", "Ziel Alpha"), ziel("b", "Ziel Beta")], relations: [], members: [] }
            : { ok: true }
      return new Response(JSON.stringify(antwort), { status: 200 })
    }),
  )
  return (await erstelleServerConnector("haupt")).connector
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
