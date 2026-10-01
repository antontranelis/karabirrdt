import { describe, expect, it } from "vitest"
import type { Item } from "@real-life-stack/data-interface"
import { ohneNamen } from "./profil"

const profil = (displayName: unknown): Item => ({ id: "u1", type: "person", createdAt: "", createdBy: "u1", data: { displayName } })

describe("ohneNamen", () => {
  it("anonym angemeldet: leerer Name oder die Kennung als Ersatz", () => {
    expect(ohneNamen(profil(""))).toBe(true)
    expect(ohneNamen(profil("  "))).toBe(true)
    expect(ohneNamen(profil("u1"))).toBe(true)
  })
  it("mit Namen, oder das Profil ist noch nicht da: nichts zu tun", () => {
    expect(ohneNamen(profil("Emil"))).toBe(false)
    expect(ohneNamen(null)).toBe(false)
    expect(ohneNamen(undefined)).toBe(false)
  })
})
