import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent } from "react"
import type { Item, RelationRecord, User } from "@real-life-stack/data-interface"
import { ItemAssignees, ItemCommentCount, ItemPreview, cn } from "@real-life-stack/toolkit"
import {
  KANN_PRAEDIKAT,
  LERNT_PRAEDIKAT,
  MASSE,
  phaseVonStufe,
  stufeVon,
  zielKurz,
  zielRest,
  zieleSortiert,
  zugewiesen,
} from "../../../modell.mjs"
import { raster as bauRaster, zelleBei } from "./raster"
import { ThreadsOverlay } from "./threads-overlay"
import { LUFT, RasterKopf } from "./raster-kopf"

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
  /** Der schwebende Kopf der Modulfläche — seine Höhe wird gemessen. */
  kopfElement?: HTMLElement | null
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
  kopfElement,
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
  // Der Beobachter entsteht beim ersten Messen, nicht in einem Effect: Die
  // ref-Callbacks der Karten laufen VOR den Effects des ersten Renderns, ein
  // dort angelegter Beobachter hätte die ersten Karten nie gesehen.
  const holeBeobachter = useCallback(() => {
    if (beobachter.current || typeof ResizeObserver === "undefined") return beobachter.current
    const o = new ResizeObserver((eintraege) => {
      setHoehen((alt) => {
        let neu = alt
        for (const e of eintraege) {
          const id = (e.target as HTMLElement).dataset.itemId
          // Außenhöhe, nicht contentRect: Rahmen und Innenabstand der Karte
          // zählen mit, sonst rutscht die nächste Karte in den Mindestabstand.
          const h = Math.round(e.borderBoxSize?.[0]?.blockSize ?? (e.target as HTMLElement).getBoundingClientRect().height)
          if (!id || !h || alt[id] === h) continue
          if (neu === alt) neu = { ...alt }
          neu[id] = h
        }
        return neu
      })
    })
    beobachter.current = o
    return o
  }, [])
  useEffect(
    () => () => {
      beobachter.current?.disconnect()
      beobachter.current = null
    },
    [],
  )
  const messen = useCallback(
    (el: HTMLDivElement | null) => {
      if (el) holeBeobachter()?.observe(el)
    },
    [holeBeobachter],
  )

  // Der Kopf der Modulfläche schwebt über dem Brett (`panelFit="overlay"`,
  // wie Karte und Graph). Was er verdeckt, muss die klebende Phasenleiste
  // mit abdecken — sonst scrollen Karten durch den Streifen darunter. Die
  // Höhe wird gemessen, nicht geraten.
  const [kopfHoehe, setKopfHoehe] = useState(0)
  useEffect(() => {
    if (!kopfElement || typeof ResizeObserver === "undefined") return
    const messen = () => setKopfHoehe(Math.round(kopfElement.getBoundingClientRect().height))
    messen()
    const o = new ResizeObserver(messen)
    o.observe(kopfElement)
    return () => o.disconnect()
  }, [kopfElement])

  const r = bauRaster(sortiert, karten, hoehen)

  const ablegen = (id: string, zielId: string, stufe: number) => {
    setZieht(null)
    setUeber(null)
    onVerschieben(id, zielId, stufe)
  }

  return (
    // Was scrollt, ist der Inhalt (Spec 01). Die Fläche scrollt in beide
    // Richtungen; oben links fängt sie an.
    <div className="relative h-full w-full overflow-auto">
      {/* Die klebenden Schichten sind DIREKTE Kinder des Scroll-Containers,
          und der hat oben kein Polster: `top: 0` klebt an der Kante des
          Scrollbereichs, nicht unter einem Innenabstand. Alle drei haben
          keine eigene Höhe im Fluss, damit das Raster darunter bei y = 0
          beginnt wie bisher. */}
      <KlebenderKopf raster={r} kopfHoehe={kopfHoehe} />
      <div ref={welt} className="relative" style={{ width: r.breite, height: r.hoehe, marginTop: kopfHoehe }}>
          <ThreadsOverlay raster={r} karten={karten} faeden={faeden} hervorgehoben={aktiv} />

          {/* Die Ziele gehören zum Inhalt und scrollen waagerecht mit. */}
          {r.zeilen.map((z) => (
            <div
              key={z.ziel.id}
              className="absolute"
              style={{ left: MASSE.start, top: z.y + MASSE.rowPad, width: MASSE.label }}
            >
              <ZeilenKopf ziel={z.ziel} aktiv={aktiv === z.ziel.id} messen={messen} onClick={() => onZiel(z.ziel.id)} />
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
                  onClick={() => onZelle(z.ziel.id, s)}
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
                    // Keine Rahmen: das Raster trägt keine senkrechten Linien.
                    "absolute cursor-copy rounded-md transition-colors",
                    ueber === schluessel ? "bg-primary/15" : "hover:bg-accent/40",
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
                    // Bewegung hier von Hand, der Zielpunkt aus dem Raster.
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
                        knoten.style.transform = `translate(${ev.clientX - start.x}px, ${ev.clientY - start.y}px)`
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
                      const kasten = welt.current?.getBoundingClientRect()
                      if (!kasten) return
                      const zelle = zelleBei(r, ev.clientX - kasten.left, ev.clientY - kasten.top)
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
    </div>
  )
}

/**
 * Kopfzeile, Zielspalte und Ecke — die drei Schichten, die beim Scrollen
 * stehen bleiben. Sie liegen direkt im Scroll-Container und tragen keine
 * eigene Höhe, damit das Raster daneben unberührt bleibt.
 */
function KlebenderKopf({ raster: r, kopfHoehe }: { raster: ReturnType<typeof bauRaster>; kopfHoehe: number }) {
  return (
    // Die Kopfzeile bleibt senkrecht stehen und wandert waagerecht mit den
    // Spalten. Sie beginnt bei x = 0, also über den Zielen — eine eigene Ecke
    // braucht es dadurch nicht. Sie deckt vom oberen Rand des Scrollbereichs
    // bis unter die Stufenzeile ALLES ab, einschließlich der Höhe des
    // schwebenden Modul-Kopfs: dort darf keine Karte durchscrollen.
    <div data-kb-kopf className="sticky top-0 z-30 h-0">
      <div
        className="absolute left-0 top-0 bg-background"
        style={{ width: r.breite, height: kopfHoehe + MASSE.head, paddingTop: kopfHoehe + LUFT }}
      >
        <RasterKopf raster={r} />
      </div>
    </div>
  )
}

/**
 * Der Kopf einer Zeile: Punktereihe, Kurztitel, Rest.
 *
 * Bewusst KEINE `ItemPreview` — im Entwurf „Brett-Dichte" ist der Zeilenkopf
 * die Beschriftung der Linse, so wie ein Spaltenkopf im Kanban, nicht die
 * Karte des Ziels. Die Karte des Ziels ist sein Detail; ein Klick öffnet es.
 */
function ZeilenKopf({
  ziel,
  aktiv,
  messen,
  onClick,
}: {
  ziel: Item
  aktiv: boolean
  messen: (el: HTMLDivElement | null) => void
  onClick: () => void
}) {
  const punkte = Math.max(0, Math.min(12, Number(ziel.data?.dots) || 0))
  const titel = String(ziel.data?.title ?? "")
  return (
    <div ref={messen} data-item-id={ziel.id}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent/60",
          aktiv && "bg-accent",
        )}
      >
        <span className="mb-1 flex items-center gap-[3px]">
          {Array.from({ length: punkte }, (_, i) => (
            <span key={i} className="inline-block h-[5px] w-[5px] rounded-full bg-primary" />
          ))}
        </span>
        <span className="block text-[11.5px] font-semibold leading-tight text-foreground">{zielKurz(titel)}</span>
        {!!zielRest(titel) && (
          <span className="mt-0.5 line-clamp-3 block text-[10.5px] leading-snug text-muted-foreground">
            {zielRest(titel)}
          </span>
        )}
      </button>
    </div>
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
      className={cn(
        // `touch-none` NUR hier: sonst schluckt die Karte das Scrollen der
        // ganzen Fläche. Wie im Kanban bleibt die Fläche selbst scrollbar.
        ziehbar && "cursor-grab touch-none select-none active:cursor-grabbing",
        gezogen && "opacity-50",
        hervor && "ring-2 ring-primary/60",
      )}
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
