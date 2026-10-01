import { afterEach, describe, expect, it, vi } from "vitest"
import { act, render, screen } from "@testing-library/react"
import { createObservable, type AuthState, type DataInterface } from "@real-life-stack/data-interface"
import { Anmeldung } from "./anmeldung"

function connector(start: AuthState) {
  const stand = createObservable<AuthState>(start)
  const c = {
    getAuthState: () => stand,
    getAuthMethods: () => [{ method: "anonymous", label: "Anonym ausprobieren" }],
    authenticate: async () => ({ id: "u" }),
    logout: async () => {},
    getCurrentUser: async () => null,
    observeCurrentUser: () => createObservable(null),
  }
  return { c: c as unknown as DataInterface, stand }
}

afterEach(() => vi.unstubAllGlobals())

describe("Anmeldung", () => {
  it("ohne Sitzung die Anmeldung, mit Sitzung die App", () => {
    const { c, stand } = connector({ status: "unauthenticated" })
    render(<Anmeldung connector={c}><p>Brett</p></Anmeldung>)
    expect(screen.queryByText("Brett")).toBeNull()
    act(() => stand.set({ status: "authenticated", user: { id: "u" } }))
    expect(screen.getByText("Brett")).toBeTruthy()
  })

  it("endet die Sitzung, lädt die Seite neu (kein Rest des alten Kontos)", () => {
    const reload = vi.fn()
    vi.stubGlobal("location", { ...window.location, reload })
    const { c, stand } = connector({ status: "authenticated", user: { id: "a" } })
    render(<Anmeldung connector={c}><p>Brett</p></Anmeldung>)
    act(() => stand.set({ status: "unauthenticated" }))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it("wechselt das Konto ohne Abmelden, lädt die Seite neu; dieselbe Person nicht", () => {
    const reload = vi.fn()
    vi.stubGlobal("location", { ...window.location, reload })
    const { c, stand } = connector({ status: "authenticated", user: { id: "a" } })
    render(<Anmeldung connector={c}><p>Brett</p></Anmeldung>)
    act(() => stand.set({ status: "authenticated", user: { id: "a", displayName: "A" } }))
    expect(reload).not.toHaveBeenCalled()
    act(() => stand.set({ status: "authenticated", user: { id: "b" } }))
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
