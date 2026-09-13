import { useRef, useState, type DragEvent, type PointerEvent, type Ref } from "react"
import type { Item, RelationRecord, User } from "@real-life-stack/data-interface"
import { ItemAssignees, ItemPreview, cn } from "@real-life-stack/toolkit"
import {
  KANN_PRAEDIKAT,
  LERNT_PRAEDIKAT,
  MASSE,
  istErledigt,
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
 * Der Rand der ausgewählten Karte kommt aus `getActivePanelGlow`, und das
 * versteht nur `#rrggbb` — eine CSS-Variable ergäbe dort lautlos gar keinen
 * Rand. Darum die vier Phasenfarben hier zusätzlich als feste Werte.
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
  /** Karte, für die gerade eine Voraussetzung gesucht wird. */
  fadenVon: string | null
  /** Die Mitglieder des Spaces — für die Zuweisungen auf den Karten. */
  mitglieder: User[]
  steuerung?: Ref<FlaechenSteuerung>
  /** Wechselt mit dem Brett — danach wird neu eingepasst. */
  einpassenSchluessel?: string
  /** Freiraum für die schwebenden Bedienelemente. */
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
  const r = bauRaster(sortiert, karten)
  const welt = useRef<HTMLDivElement>(null)
  const [zieht, setZieht] = useState<string | null>(null)
  const [ueber, setUeber] = useState<string | null>(null)

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
            className="absolute overflow-hidden"
            style={{ left: MASSE.start, top: z.y + 4, width: MASSE.label, height: Math.max(60, z.h - 8) }}
          >
            <ItemPreview
              item={z.ziel}
              author={null}
              density="compact"
              active={aktiv === z.ziel.id}
              onClick={() => !hatGeschwenkt() && onZiel(z.ziel.id)}
              className="h-full"
              metaAdornment={
                <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
                  {Number(z.ziel.data?.dots) > 0 ? "●".repeat(Number(z.ziel.data?.dots)) : "keine Punkte"}
                </span>
              }
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
              const phase = phaseVonStufe(stufeVon(k))
              return (
                <div
                  key={k.id}
                  data-karte
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
                    // hier von Hand. Die Kamera rechnet den Zielpunkt zurück.
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
                    activeColor={PHASEN_HEX[phase.key]}
                    onClick={() => onKarte(k.id)}
                    className={cn(
                      "h-full border-l-4 border-l-[var(--kb-phase)]",
                      istErledigt(k) && "bg-[var(--kb-phase)]/15",
                    )}
                    footerAdornment={<KartenFuss item={k} mitglieder={mitglieder} />}
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
 * Die Fußzeile einer Karte: wer sie kann und wer sie lernen will, dazu die
 * Stunden. Die Gesichter zeichnet `ItemAssignees` — dieselbe Darstellung von
 * Zuständigen wie überall im Stack; „will lernen" steht daneben beschriftet,
 * weil es eine andere Aussage ist.
 */
function KartenFuss({ item, mitglieder }: { item: Item; mitglieder: User[] }) {
  const finde = (ids: string[]) => ids.map((id) => mitglieder.find((m) => m.id === id)).filter((u): u is User => !!u)
  const kann = finde(zugewiesen(item, KANN_PRAEDIKAT))
  const lernt = finde(zugewiesen(item, LERNT_PRAEDIKAT))
  const stunden = Number(item.data?.hours) || 0
  if (!kann.length && !lernt.length && !stunden) return null
  return (
    <div className="flex min-w-0 items-center gap-2 overflow-hidden">
      {!!kann.length && <ItemAssignees users={kann} />}
      {!!lernt.length && (
        <span className="flex min-w-0 items-center gap-1 opacity-70">
          <span className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">lernt</span>
          <ItemAssignees users={lernt} />
        </span>
      )}
      {stunden > 0 && <span className="ml-auto font-mono text-[10px] text-muted-foreground">{stunden}h</span>}
    </div>
  )
}
