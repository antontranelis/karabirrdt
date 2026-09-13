import { useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react"
import { kameraEinpassen, kameraSchwenken, kameraStart, zoomeAmZeiger, type Kamera, type Raender } from "../../../modell.mjs"

export interface FlaechenSteuerung {
  /** Das ganze Brett mittig in die Fläche legen. */
  einpassen: () => void
  /** Um einen Faktor zoomen, Mitte der Fläche als Anker. */
  zoomen: (faktor: number) => void
}

interface Props {
  /** Maße der Welt — hier das Raster des Bretts. */
  breite: number
  hoehe: number
  /** Elemente, die keine Kamera-Geste auslösen (die Karten). */
  ziehbarSelektor: string
  steuerung?: Ref<FlaechenSteuerung>
  /** Bei jedem Wechsel dieses Werts wird neu eingepasst. */
  einpassenSchluessel?: string
  /**
   * Was beim Einpassen frei bleiben muss, weil dort etwas über der Fläche
   * schwebt — unten die Filter-Pille und die Kamera-Knöpfe.
   */
  raender?: Raender
  children: (kamera: Kamera, hatGeschwenkt: () => boolean) => ReactNode
}

/**
 * Zoomen und Schwenken wie in der Graph-Ansicht: Mausrad zoomt zum Zeiger,
 * Ziehen auf leerer Fläche schwenkt, zwei Finger zoomen. Die Rechnung dazu
 * steht in `modell.mjs` und ist dort geprüft; hier stehen nur die Gesten.
 *
 * Die Kamera ist eine CSS-Transformation über dem ganzen Raster — dadurch
 * bleiben die Karten echte DOM-Elemente und HTML5-Drag&Drop trifft weiter
 * die richtigen Zellen, ohne dass irgendwo umgerechnet werden müsste.
 */
export function KameraFlaeche({ breite, hoehe, ziehbarSelektor, steuerung, einpassenSchluessel, raender, children }: Props) {
  const flaeche = useRef<HTMLDivElement>(null)
  const [kamera, setKamera] = useState<Kamera>(kameraStart)
  const zeiger = useRef(new Map<number, { x: number; y: number }>())
  const kneifen = useRef<{ abstand: number; zoom: number; x: number; y: number } | null>(null)
  const bewegt = useRef(false)

  const masse = useCallback(() => flaeche.current?.getBoundingClientRect() ?? null, [])

  const einpassen = useCallback(() => {
    const m = masse()
    if (!m) return
    setKamera(kameraEinpassen(breite, hoehe, m.width, m.height, raender))
  }, [breite, hoehe, masse, raender])

  useImperativeHandle(
    steuerung,
    () => ({
      einpassen,
      zoomen(faktor) {
        const m = masse()
        if (!m) return
        setKamera((k) => zoomeAmZeiger(k, faktor, m.width / 2, m.height / 2))
      },
    }),
    [einpassen, masse],
  )

  // Einmal einpassen, sobald es etwas einzupassen gibt — und wieder, wenn das
  // Brett gewechselt wird.
  const zuletztEingepasst = useRef<string | null>(null)
  useEffect(() => {
    if (!(breite > 0) || !(hoehe > 0)) return
    const schluessel = einpassenSchluessel ?? "brett"
    if (zuletztEingepasst.current === schluessel) return
    zuletztEingepasst.current = schluessel
    einpassen()
  }, [breite, hoehe, einpassen, einpassenSchluessel])

  // Das Rad muss abgefangen werden, sonst scrollt die Seite. React hängt
  // `onWheel` passiv ein, darum von Hand.
  useEffect(() => {
    const knoten = flaeche.current
    if (!knoten) return
    const rad = (e: WheelEvent) => {
      e.preventDefault()
      const m = knoten.getBoundingClientRect()
      const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      setKamera((k) => zoomeAmZeiger(k, faktor, e.clientX - m.left, e.clientY - m.top))
    }
    knoten.addEventListener("wheel", rad, { passive: false })
    return () => knoten.removeEventListener("wheel", rad)
  }, [])

  const abstandUndMitte = () => {
    const [a, b] = [...zeiger.current.values()]
    return { abstand: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  }

  return (
    <div
      ref={flaeche}
      className="relative h-full w-full touch-none overflow-hidden"
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(ziehbarSelektor)) return
        const m = masse()
        if (!m) return
        zeiger.current.set(e.pointerId, { x: e.clientX - m.left, y: e.clientY - m.top })
        e.currentTarget.setPointerCapture(e.pointerId)
        bewegt.current = false
        if (zeiger.current.size === 2) {
          const k = abstandUndMitte()
          kneifen.current = { abstand: k.abstand, zoom: kamera.zoom, x: k.x, y: k.y }
        }
      }}
      onPointerMove={(e) => {
        if (!zeiger.current.has(e.pointerId)) return
        const m = masse()
        if (!m) return
        const neu = { x: e.clientX - m.left, y: e.clientY - m.top }
        const alt = zeiger.current.get(e.pointerId)!
        zeiger.current.set(e.pointerId, neu)
        if (zeiger.current.size >= 2 && kneifen.current) {
          const k = abstandUndMitte()
          const faktor = k.abstand / kneifen.current.abstand
          bewegt.current = true
          setKamera((c) => {
            const ziel = kneifen.current!.zoom * faktor
            return zoomeAmZeiger(c, ziel / c.zoom, k.x, k.y)
          })
          return
        }
        const dx = neu.x - alt.x
        const dy = neu.y - alt.y
        if (Math.abs(dx) + Math.abs(dy) > 0) bewegt.current = true
        setKamera((c) => kameraSchwenken(c, dx, dy))
      }}
      onPointerUp={(e) => {
        zeiger.current.delete(e.pointerId)
        if (zeiger.current.size < 2) kneifen.current = null
      }}
      onPointerCancel={(e) => {
        zeiger.current.delete(e.pointerId)
        kneifen.current = null
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: breite, height: hoehe, transform: `translate(${kamera.ox}px, ${kamera.oy}px) scale(${kamera.zoom})` }}
      >
        {children(kamera, () => bewegt.current)}
      </div>
    </div>
  )
}
