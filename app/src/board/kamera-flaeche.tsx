import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react"
import { kameraBegrenzen, kameraEinpassen, kameraSchwenken, kameraStart, zoomeAmZeiger, type Kamera, type Raender } from "../../../modell.mjs"

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
  /**
   * Was über der Fläche schwebt: der Kopf des Moduls und die Ecke mit den
   * Bedienelementen. Ihre Höhe wird gemessen, nicht geraten — sonst liegt
   * das eingepasste Brett darunter.
   */
  kopfElement?: HTMLElement | null
  fussElement?: HTMLElement | null
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
export function KameraFlaeche({
  breite,
  hoehe,
  ziehbarSelektor,
  steuerung,
  einpassenSchluessel,
  raender,
  kopfElement,
  fussElement,
  children,
}: Props) {
  const flaeche = useRef<HTMLDivElement>(null)
  const [kamera, setKamera] = useState<Kamera>(kameraStart)
  const zeiger = useRef(new Map<number, { x: number; y: number }>())
  const kneifen = useRef<{ abstand: number; zoom: number; x: number; y: number } | null>(null)
  const bewegt = useRef(false)

  const masse = useCallback(() => flaeche.current?.getBoundingClientRect() ?? null, [])

  // Die Höhe der schwebenden Bereiche am DOM messen, nicht schätzen.
  const [gemessen, setGemessen] = useState<Raender>({})
  useEffect(() => {
    const messen = () => {
      const m = flaeche.current?.getBoundingClientRect()
      if (!m) return
      const kopf = kopfElement?.getBoundingClientRect()
      const fuss = fussElement?.getBoundingClientRect()
      setGemessen((alt) => {
        const neu = {
          oben: kopf && kopf.height > 0 ? Math.max(0, kopf.bottom - m.top) + 8 : 0,
          unten: fuss && fuss.height > 0 ? Math.max(0, m.bottom - fuss.top) + 8 : 0,
        }
        return alt.oben === neu.oben && alt.unten === neu.unten ? alt : neu
      })
    }
    messen()
    if (typeof ResizeObserver === "undefined") return
    const beobachter = new ResizeObserver(messen)
    for (const el of [flaeche.current, kopfElement, fussElement]) if (el) beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [kopfElement, fussElement, breite, hoehe])

  const alleRaender = useMemo<Raender>(
    () => ({
      oben: Math.max(raender?.oben ?? 0, gemessen.oben ?? 0),
      unten: Math.max(raender?.unten ?? 0, gemessen.unten ?? 0),
      links: raender?.links ?? 0,
      rechts: raender?.rechts ?? 0,
    }),
    [raender, gemessen],
  )

  // Jede Kamerabewegung geht durch die Grenzen: nicht weiter hinaus als
  // eingepasst, und das Brett bleibt in der Fläche.
  const begrenzt = useCallback(
    (k: Kamera) => {
      const m = masse()
      return m ? kameraBegrenzen(k, breite, hoehe, m.width, m.height, alleRaender) : k
    },
    [breite, hoehe, masse, alleRaender],
  )

  const einpassen = useCallback(() => {
    const m = masse()
    if (!m) return
    setKamera(kameraEinpassen(breite, hoehe, m.width, m.height, alleRaender))
  }, [breite, hoehe, masse, alleRaender])

  useImperativeHandle(
    steuerung,
    () => ({
      einpassen,
      zoomen(faktor) {
        const m = masse()
        if (!m) return
        setKamera((k) => begrenzt(zoomeAmZeiger(k, faktor, m.width / 2, m.height / 2)))
      },
    }),
    [einpassen, masse, begrenzt],
  )

  // Einmal einpassen, sobald es etwas einzupassen gibt — und wieder, wenn das
  // Brett gewechselt wird.
  const zuletztEingepasst = useRef<string | null>(null)
  useEffect(() => {
    if (!(breite > 0) || !(hoehe > 0)) return
    const schluessel = einpassenSchluessel ?? "brett"
    const voll = `${schluessel}:${alleRaender.oben}:${alleRaender.unten}`
    if (zuletztEingepasst.current === voll) return
    zuletztEingepasst.current = voll
    einpassen()
  }, [breite, hoehe, einpassen, einpassenSchluessel, alleRaender])

  // Das Rad muss abgefangen werden, sonst scrollt die Seite. React hängt
  // `onWheel` passiv ein, darum von Hand.
  useEffect(() => {
    const knoten = flaeche.current
    if (!knoten) return
    const rad = (e: WheelEvent) => {
      e.preventDefault()
      const m = knoten.getBoundingClientRect()
      const faktor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
      setKamera((k) => begrenzt(zoomeAmZeiger(k, faktor, e.clientX - m.left, e.clientY - m.top)))
    }
    knoten.addEventListener("wheel", rad, { passive: false })
    return () => knoten.removeEventListener("wheel", rad)
  }, [begrenzt])

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
            return begrenzt(zoomeAmZeiger(c, ziel / c.zoom, k.x, k.y))
          })
          return
        }
        const dx = neu.x - alt.x
        const dy = neu.y - alt.y
        if (Math.abs(dx) + Math.abs(dy) > 0) bewegt.current = true
        setKamera((c) => begrenzt(kameraSchwenken(c, dx, dy)))
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
