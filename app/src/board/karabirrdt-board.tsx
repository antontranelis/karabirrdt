import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent, type Ref } from "react"
import type { Item, RelationRecord, User } from "@real-life-stack/data-interface"
import { ItemAssignees, ItemCommentCount, ItemPreview, cn } from "@real-life-stack/toolkit"
import {
  KANN_PRAEDIKAT,
  LERNT_PRAEDIKAT,
  MASSE,
  phaseVonStufe,
  schirmZuWelt,
  stufeVon,
  zieleSortiert,
  zugewiesen,
  type Raender,
} from "../../../modell.mjs"
import { raster as bauRaster, zelleBei } from "./raster"
import { ThreadsOverlay } from "./threads-overlay"
import { KameraFlaeche, type FlaechenSteuerung } from "./kamera-flaeche"

/**
 * Die vier Phasenfarben als `#rrggbb` — `ItemPreview` gibt sie über
 * `activeColor` an `getActivePanelGlow` weiter, und das versteht nur Hex.
 */
const PHASEN_HEX: Record<string, string> = {
  dream: "#7c5cbf",
  plan: "#2c7a76",
  do: "#bd5f1c",
  fete: "#b0355c",
}

interface Props {
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
  aktiv: string | null
  fadenVon: string | null
  mitglieder: User[]
  steuerung?: Ref<FlaechenSteuerung>
  einpassenSchluessel?: string
  raender?: Raender
  kopfElement?: HTMLElement | null
  fussElement?: HTMLElement | null
  onKarte: (id: string) => void
  onZelle: (zielId: string, stufe: number) => void
  onZiel: (id: string) => void
  onVerschieben: (id: string, zielId: string, stufe: number) => void
}

export function KarabirrdtBoard({
  ziele,
  karten,
  faeden,
  aktiv,
  fadenVon,
  mitglieder,
  steuerung,
  einpassenSchluessel,
  raender,
  kopfElement,
  fussElement,
  onKarte,
  onZelle,
  onZiel,
  onVerschieben,
}: Props) {
  const sortiert = zieleSortiert(ziele) as Item[]
  const welt = useRef<HTMLDivElement>(null)
  const [zieht, setZieht] = useState<string | null>(null)
  const [ueber, setUeber] = useState<string | null>(null)

  // `ItemPreview` hat keine feste Höhe — mit Tags, Zugewiesenen und
  // Kommentarzähler wird eine Karte höher. Also messen statt raten.
  const [hoehen, setHoehen] = useState<Record<string, number>>({})
  const beobachter = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return
    const o = new ResizeObserver((eintraege) => {
      setHoehen((alt) => {
        let neu = alt
        for (const e of eintraege) {
          const id = (e.target as HTMLElement).dataset.itemId
          const h = Math.round(e.contentRect.height)
          if (!id || !h || alt[id] === h) continue
          if (neu === alt) neu = { ...alt }
          neu[id] = h
        }
        return neu
      })
    })
    beobachter.current = o
    return () => {
      o.disconnect()
      beobachter.current = null
    }
  }, [])
  const messen = useCallback((el: HTMLDivElement | null) => {
    if (el) beobachter.current?.observe(el)
  }, [])

  const r = bauRaster(sortiert, karten, hoehen)

  const ablegen = (id: string, zielId: string, stufe: number) => {
    setZieht(null)
    setUeber(null)
    onVerschieben(id, zielId, stufe)
  }

  return (
    <KameraFlaeche
      breite={r.breite}
      hoehe={r.hoehe}
      ziehbarSelektor="[data-karte]"
      steuerung={steuerung}
      einpassenSchluessel={einpassenSchluessel}
      raender={raender}
      kopfElement={kopfElement}
      fussElement={fussElement}
    >
      {(kamera, hatGeschwenkt) => (
        <div ref={welt} className="relative" style={{ width: r.breite, height: r.hoehe }}>
          <ThreadsOverlay raster={r} karten={karten} faeden={faeden} hervorgehoben={aktiv} />

          {/* Ziele als Zeilenköpfe — dieselbe Karte wie überall */}
          {r.zeilen.map((z) => (
            <div
              key={z.ziel.id}
              data-karte
              className="absolute"
              style={{ left: MASSE.start, top: z.y + MASSE.rowPad, width: MASSE.label }}
            >
              <Karte
                item={z.ziel}
                mitglieder={mitglieder}
                aktiv={aktiv === z.ziel.id}
                onClick={() => !hatGeschwenkt() && onZiel(z.ziel.id)}
              />
            </div>
          ))}

          {/* Zellen: leere Fläche zum Anlegen und Ziel jedes Ablegens */}
          {r.zeilen.flatMap((z) =>
            Array.from({ length: 12 }, (_, s) => {
              const schluessel = `${z.ziel.id}:${s}`
              return (
                <div
                  key={schluessel}
                  role="button"
                  tabIndex={-1}
                  aria-label={`Karte anlegen in ${String(z.ziel.data?.title ?? "")}, Stufe ${s + 1}`}
                  onClick={() => !hatGeschwenkt() && onZelle(z.ziel.id, s)}
                  onDragOver={(e: DragEvent) => {
                    e.preventDefault()
                    e.dataTransfer.dropEffect = "move"
                    setUeber(schluessel)
                  }}
                  onDragLeave={() => setUeber((u) => (u === schluessel ? null : u))}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData("text/plain")
                    if (id) ablegen(id, z.ziel.id, s)
                  }}
                  className={cn(
                    "absolute cursor-copy rounded-md border border-transparent transition-colors",
                    ueber === schluessel ? "border-primary bg-primary/10" : "hover:bg-accent/40",
                  )}
                  style={{ left: r.spalte(s) - MASSE.colW / 2, top: z.y, width: MASSE.colW, height: z.h }}
                />
              )
            }),
          )}

          {/* Karten */}
          {karten
            .filter((k) => r.pos[k.id])
            .map((k) => {
              const P = r.pos[k.id]
              return (
                <div
                  key={k.id}
                  data-karte
                  className="absolute"
                  style={{ left: P.x, top: P.y, width: MASSE.cardW }}
                  onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
                    // Finger und Stift kennen kein HTML5-Ziehen: dieselbe
                    // Bewegung hier von Hand, der Zielpunkt über die Kamera.
                    if (e.pointerType === "mouse") return
                    e.stopPropagation()
                    const start = { x: e.clientX, y: e.clientY }
                    const knoten = e.currentTarget
                    let bewegt = false
                    knoten.setPointerCapture(e.pointerId)
                    const bewegen = (ev: globalThis.PointerEvent) => {
                      if (!bewegt && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
                        bewegt = true
                        setZieht(k.id)
                      }
                      if (bewegt) {
                        const z = kamera.zoom || 1
                        knoten.style.transform = `translate(${(ev.clientX - start.x) / z}px, ${(ev.clientY - start.y) / z}px)`
                        knoten.style.zIndex = "30"
                      }
                    }
                    const loslassen = (ev: globalThis.PointerEvent) => {
                      knoten.removeEventListener("pointermove", bewegen)
                      knoten.removeEventListener("pointerup", loslassen)
                      knoten.removeEventListener("pointercancel", loslassen)
                      knoten.style.transform = ""
                      knoten.style.zIndex = ""
                      if (!bewegt) return
                      const kasten = welt.current?.parentElement?.getBoundingClientRect()
                      if (!kasten) return
                      const p = schirmZuWelt({ x: ev.clientX - kasten.left, y: ev.clientY - kasten.top }, kamera)
                      const zelle = zelleBei(r, p.x, p.y)
                      if (zelle) ablegen(k.id, zelle.zielId, zelle.stufe)
                      else setZieht(null)
                    }
                    knoten.addEventListener("pointermove", bewegen)
                    knoten.addEventListener("pointerup", loslassen)
                    knoten.addEventListener("pointercancel", loslassen)
                  }}
                >
                  <Karte
                    item={k}
                    mitglieder={mitglieder}
                    aktiv={aktiv === k.id}
                    gezogen={zieht === k.id}
                    hervor={!!fadenVon && fadenVon !== k.id}
                    ziehbar
                    messen={messen}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", k.id)
                      e.dataTransfer.effectAllowed = "move"
                      setZieht(k.id)
                    }}
                    onDragEnd={() => {
                      setZieht(null)
                      setUeber(null)
                    }}
                    onClick={() => onKarte(k.id)}
                  />
                </div>
              )
            })}
        </div>
      )}
    </KameraFlaeche>
  )
}

/**
 * Eine Karte auf dem Brett — dieselben Aufrufe, mit denen `KanbanBoard` seine
 * Karten zeichnet (toolkit 0.1.6, `components/kanban/kanban-board`): Item mit
 * Ersatztitel, `author={null}`, `density="compact"`, `active`, und als
 * `footerAdornment` die Zugewiesenen über `ItemAssignees` plus, wenn es
 * welche gibt, der Kommentarzähler über `ItemCommentCount`. Tags, Titel und
 * Rahmen kommen aus `ItemPreview` selbst.
 */
function Karte({
  item,
  mitglieder,
  aktiv,
  gezogen,
  hervor,
  ziehbar,
  messen,
  onDragStart,
  onDragEnd,
  onClick,
}: {
  item: Item
  mitglieder: User[]
  aktiv: boolean
  gezogen?: boolean
  hervor?: boolean
  ziehbar?: boolean
  messen?: (el: HTMLDivElement | null) => void
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
  onClick: () => void
}) {
  const nachId = new Map(mitglieder.map((m) => [m.id, m]))
  const zugeteilt = [...zugewiesen(item, KANN_PRAEDIKAT), ...zugewiesen(item, LERNT_PRAEDIKAT)]
    .map((id) => nachId.get(id))
    .filter((u): u is User => !!u)
  const kommentare = Number(item.data?.commentCount) || 0
  const hatFuss = zugeteilt.length > 0 || kommentare > 0
  const mitTitel =
    typeof item.data?.title === "string" && item.data.title.length > 0
      ? item
      : { ...item, data: { ...item.data, title: "Ohne Titel" } }
  const phase = phaseVonStufe(stufeVon(item))

  return (
    <div
      ref={messen}
      data-item-id={item.id}
      {...(ziehbar ? { draggable: true, onDragStart, onDragEnd } : {})}
      className={cn(ziehbar && "cursor-grab select-none active:cursor-grabbing", gezogen && "opacity-50", hervor && "ring-2 ring-primary/60")}
    >
      <ItemPreview
        item={mitTitel}
        author={null}
        density="compact"
        active={aktiv}
        activeColor={PHASEN_HEX[phase.key]}
        onClick={onClick}
        footerAdornment={
          hatFuss ? (
            <>
              <ItemAssignees users={zugeteilt} />
              {kommentare > 0 && (
                <div className="ml-auto">
                  <ItemCommentCount count={kommentare} />
                </div>
              )}
            </>
          ) : undefined
        }
      />
    </div>
  )
}
