import { describe, expect, it } from "vitest"
import type { Group } from "@real-life-stack/data-interface"
import { istBrett, neuesBrett, slugAusPfad, slugVon, startBrett } from "./brett"

const brett = (id: string, slug?: string): Group => ({ id, name: id, data: { modules: ["karabirrdt"], ...(slug ? { slug } : {}) } })

describe("Brett-Adresse über den Slug", () => {
  it("liest den Slug aus dem Pfad, `/` ist keiner", () => {
    expect(slugAusPfad("/real-life")).toBe("real-life")
    expect(slugAusPfad("/Real-Life/")).toBe("real-life")
    expect(slugAusPfad("/")).toBeNull()
    expect(slugAusPfad("/a b")).toBeNull()
  })

  it("nur Groups mit dem Modul sind Bretter; ohne Slug gilt die Id", () => {
    expect(istBrett(brett("x"))).toBe(true)
    expect(istBrett({ id: "y", name: "y", data: { modules: ["feed"] } })).toBe(false)
    expect(slugVon(brett("7f3a-uuid"))).toBe("7f3a-uuid")
    expect(slugVon(brett("7f3a-uuid", "garten"))).toBe("garten")
  })

  it("Start: Adresse, sonst das erste Brett; eine fremde Adresse ist unbekannt", () => {
    const bretter = [brett("u1", "eins"), brett("u2", "zwei")]
    expect(startBrett(bretter, "zwei")).toEqual({ art: "brett", gruppe: bretter[1] })
    expect(startBrett(bretter, null)).toEqual({ art: "brett", gruppe: bretter[0] })
    expect(startBrett(bretter, "fremd")).toEqual({ art: "unbekannt", slug: "fremd" })
    expect(startBrett([], null)).toEqual({ art: "keins" })
  })

  it("ein neues Brett bekommt eine freie Adresse aus dem Namen", () => {
    expect(neuesBrett("Garten 2027", ["garten-2027"])).toMatchObject({ slug: "garten-2027-2", modules: ["karabirrdt"], scope: "group" })
  })
})
