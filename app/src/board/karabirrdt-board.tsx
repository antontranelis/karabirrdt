import { useRef, useState, type DragEvent, type PointerEvent } from "react"
import type { Item, RelationRecord } from "@real-life-stack/data-interface"
import { ItemPreview, cn } from "@real-life-stack/toolkit"
import { MASSE, phaseVonStufe, stufeVon, istErledigt, zieleSortiert } from "../../../modell.mjs"
import { raster as bauRaster, zelleBei } from "./raster"
import { ThreadsOverlay } from "./threads-overlay"

interface Props {
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
  aktiv: string | null
  /** Karte, für die gerade eine Voraussetzung gesucht wird. */
  fadenVon: string | null
  onKarte: (id: string) => void
  onZelle: (zielId: string, stufe: number) => void
  onZiel: (id: string) => void
  onVerschieben: (id: string, zielId: string, stufe: number) => void
}

export function KarabirrdtBoard({ ziele, karten, faeden, aktiv, fadenVon, onKarte, onZelle, onZiel, onVerschieben }: Props) {
  const sortiert = zieleSortiert(ziele) as Item[]
  const r = bauRaster(sortiert, karten)
  const flaeche = useRef<HTMLDivElement>(null)
  const [zieht, setZieht] = useState<string | null>(null)
  const [ueber, setUeber] = useState<string | null>(null)

  const ablegen = (id: string, zielId: string, stufe: number) => {
    setZieht(null)
    setUeber(null)
    onVerschieben(id, zielId, stufe)
  }

  return (
    <div className="h-full w-full overflow-auto p-4">
      <div ref={flaeche} className="relative" style={{ width: r.breite, height: r.hoehe }}>
        <ThreadsOverlay raster={r} karten={karten} faeden={faeden} hervorgehoben={aktiv} />

        {/* Ziele als Zeilenköpfe */}
        {r.zeilen.map((z) => (
          <button
            key={z.ziel.id}
            type="button"
            onClick={() => onZiel(z.ziel.id)}
            className="absolute rounded-md p-2 text-left text-xs leading-snug hover:bg-accent/60"
            style={{ left: MASSE.start, top: z.y, width: MASSE.label, height: z.h }}
          >
            <span className="block font-mono text-[10px] tracking-wide text-muted-foreground">
              {Number(z.ziel.data?.dots) > 0 ? "●".repeat(Number(z.ziel.data?.dots)) : "keine Punkte"}
            </span>
            <span className="mt-0.5 block break-words font-semibold">{String(z.ziel.data?.title ?? "")}</span>
          </button>
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
            const phase = phaseVonStufe(stufeVon(k))
            return (
              <div
                key={k.id}
                draggable
                onDragStart={(e: DragEvent) => {
                  e.dataTransfer.setData("text/plain", k.id)
                  e.dataTransfer.effectAllowed = "move"
                  setZieht(k.id)
                }}
                onDragEnd={() => {
                  setZieht(null)
                  setUeber(null)
                }}
                onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
                  // Finger und Stift kennen kein HTML5-Ziehen: dieselbe Bewegung
                  // hier von Hand, mit derselben Zellenberechnung.
                  if (e.pointerType === "mouse") return
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
                    const kasten = flaeche.current?.getBoundingClientRect()
                    if (!kasten) return
                    const zelle = zelleBei(r, ev.clientX - kasten.left, ev.clientY - kasten.top)
                    if (zelle) ablegen(k.id, zelle.zielId, zelle.stufe)
                    else setZieht(null)
                  }
                  knoten.addEventListener("pointermove", bewegen)
                  knoten.addEventListener("pointerup", loslassen)
                  knoten.addEventListener("pointercancel", loslassen)
                }}
                className={cn(
                  "absolute touch-none select-none overflow-hidden rounded-lg",
                  zieht === k.id && "opacity-60",
                  fadenVon && fadenVon !== k.id && "ring-2 ring-dashed ring-primary/60",
                )}
                style={{
                  left: P.x,
                  top: P.y,
                  width: MASSE.cardW,
                  height: MASSE.cardH,
                  ["--kb-phase" as string]: `var(--kb-${phase.key})`,
                }}
              >
                <ItemPreview
                  item={k}
                  author={null}
                  density="compact"
                  active={aktiv === k.id}
                  activeColor="var(--kb-phase)"
                  onClick={() => onKarte(k.id)}
                  className={cn(
                    "h-full border-l-4 border-l-[var(--kb-phase)]",
                    istErledigt(k) && "bg-[var(--kb-phase)]/15",
                  )}
                  footerAdornment={<KartenFuss item={k} />}
                />
              </div>
            )
          })}
      </div>
    </div>
  )
}

/**
 * Die Fußzeile einer Karte: Initialen mit „kann ich" (gefüllt) und „will ich
 * lernen" (umrandet), dazu die Stunden. Sie geht über den `footerAdornment`-
 * Schlitz der geteilten `ItemPreview` — keine eigene Karte.
 */
function KartenFuss({ item }: { item: Item }) {
  const wer = Array.isArray(item.data?.who) ? (item.data.who as { ini: string; can: boolean }[]) : []
  const stunden = Number(item.data?.hours) || 0
  if (!wer.length && !stunden) return null
  return (
    <div className="flex items-center gap-1 overflow-hidden">
      {wer.map((w) => (
        <span
          key={w.ini}
          title={w.can ? "kann ich" : "will ich lernen"}
          className={cn(
            "rounded border border-foreground px-1 font-mono text-[9px] leading-4",
            w.can ? "bg-foreground text-background" : "bg-transparent",
          )}
        >
          {w.ini}
        </span>
      ))}
      {stunden > 0 && <span className="font-mono text-[10px] text-muted-foreground">{stunden}h</span>}
    </div>
  )
}
