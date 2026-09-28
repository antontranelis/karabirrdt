// jsdom kennt einige Browser-APIs nicht, die das Toolkit beim Rendern anfasst.
import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

afterEach(() => cleanup())

class Beobachter {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= Beobachter as unknown as typeof ResizeObserver
globalThis.IntersectionObserver ??= Beobachter as unknown as typeof IntersectionObserver
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList
}
Element.prototype.scrollIntoView ??= function () {}
