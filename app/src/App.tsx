import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Group, Item, RelationRecord } from "@real-life-stack/data-interface"
import { hasGroups } from "@real-life-stack/data-interface"
import {
  AdaptivePanel,
  AppShell,
  AppShellMain,
  Button,
  EmptyState,
  FilterScope,
  GroupDialog,
  ModuleControls,
  ModuleFrame,
  ModuleToolbar,
  Navbar,
  NavbarEnd,
  NavbarStart,
  UserMenu,
  WorkspaceSwitcher,
  cn,
  useConnector,
  useCreateGroup,
  useCreateItem,
  useCurrentGroup,
  useCurrentUser,
  useDeleteGroup,
  useDeleteItem,
  useGroups,
  useItems,
  useModuleFilteredItems,
  useUpdateGroup,
  useUpdateItem,
  type GroupDialogMode,
  type Workspace,
} from "@real-life-stack/toolkit"
import { Maximize2, Minus, Plus, Sparkles } from "lucide-react"
import { KarabirrdtBoard } from "./board/karabirrdt-board"
import type { FlaechenSteuerung } from "./board/kamera-flaeche"
import { KartenDetail } from "./panels/karten-detail"
import { KarteAnlegen } from "./panels/karte-anlegen"
import { ZielePanel } from "./panels/ziele-panel"
import { PruefungPanel } from "./panels/pruefung-panel"
import { DatenPanel } from "./panels/daten-panel"
import { TraumPanel } from "./panels/traum-panel"
import { useFaeden } from "./faeden"
import { STARTZIELE } from "./startziele"
import { TISCH } from "./connector/server-connector"
import {
  KARTEN_TYP,
  VOCAB,
  ZIEL_TYP,
  fadenFehler,
  mitZiel,
  ohnePraefix,
  verschiebenFehler,
  zielVonKarte,
} from "../../modell.mjs"

type Ansicht =
  | { art: "karte"; id: string }
  | { art: "neu"; zielId: string; stufe: number }
  | { art: "traum" }
  | { art: "ziele" }
  | { art: "pruefung" }
  | { art: "daten" }
  | null

interface Props {
  aufZustand: (hoerer: (live: boolean) => void) => () => void
}

export default function App({ aufZustand }: Props) {
  const connector = useConnector()
  const group = useCurrentGroup()
  const brett = group?.id ?? "haupt"
  const { data: gruppen } = useGroups()
  const { data: nutzer } = useCurrentUser()
  const { data: ziele } = useItems({ type: ZIEL_TYP })
  const { data: karten } = useItems({ type: KARTEN_TYP })
  const { faeden, schreibbar: fadenSchreibbar, ziehe, loese } = useFaeden()
  const { mutate: anlegen } = useCreateItem()
  const { mutate: aendere } = useUpdateItem()
  const { mutate: loesche } = useDeleteItem()
  const gruppeAnlegen = useCreateGroup()
  const gruppeAendern = useUpdateGroup()
  const gruppeLoeschen = useDeleteGroup()

  const [ansicht, setAnsicht] = useState<Ansicht>(null)
  const [fadenVon, setFadenVon] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const [gruppenDialog, setGruppenDialog] = useState(false)
  const [dialogModus, setDialogModus] = useState<GroupDialogMode>({ type: "create" })
  const kamera = useRef<FlaechenSteuerung>(null)

  useEffect(() => aufZustand(setLive), [aufZustand])
  useEffect(() => {
    if (!meldung) return
    const t = setTimeout(() => setMeldung(null), 3200)
    return () => clearTimeout(t)
  }, [meldung])
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (fadenVon) setFadenVon(null)
      else setAnsicht(null)
    }
    document.addEventListener("keydown", taste)
    return () => document.removeEventListener("keydown", taste)
  }, [fadenVon])
  // Beim Brettwechsel schließt, was zum alten Brett gehörte.
  useEffect(() => {
    setAnsicht(null)
    setFadenVon(null)
  }, [brett])

  // --------------------------------------------------------------- Spaces

  const arbeitsraeume: Workspace[] = useMemo(
    () =>
      gruppen.map((g: Group) => ({
        id: g.id,
        name: g.name || g.id,
        scope: typeof g.data?.scope === "string" ? g.data.scope : undefined,
        avatar: typeof g.data?.image === "string" ? g.data.image : undefined,
      })),
    [gruppen],
  )
  const aktiverRaum = arbeitsraeume.find((w) => w.id === brett) ?? null

  const wechsleRaum = useCallback(
    (w: Workspace) => {
      if (hasGroups(connector)) connector.setCurrentGroup(w.id)
    },
    [connector],
  )

  // --------------------------------------------------------------- Brett

  const karteLoeschen = useCallback(
    async (id: string) => {
      for (const f of faeden.filter((f) => ohnePraefix(f.from) === id || ohnePraefix(f.to) === id)) await loese(f.id)
      await loesche(id)
    },
    [faeden, loese, loesche],
  )

  const kartenKlick = async (id: string) => {
    if (!fadenVon) return setAnsicht({ art: "karte", id })
    const fehler = fadenFehler(karten, faeden, id, fadenVon)
    setFadenVon(null)
    if (fehler) return setMeldung(fehler)
    await ziehe(id, fadenVon)
    setMeldung("Faden gezogen.")
    setAnsicht({ art: "karte", id: fadenVon })
  }

  const verschieben = async (id: string, zielId: string, stufe: number) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return
    if (zielVonKarte(karte) === zielId && Number(karte.data?.stage) === stufe) return
    const fehler = verschiebenFehler(karten, faeden, id, stufe)
    if (fehler) return setMeldung(fehler)
    await aendere(id, {
      data: { ...karte.data, stage: stufe, order: Date.now() },
      relations: mitZiel(karte, zielId),
    })
  }

  const aktiv = ansicht?.art === "karte" ? ansicht.id : null
  const offeneKarte = aktiv ? karten.find((k) => k.id === aktiv) : undefined
  useEffect(() => {
    // Eine von jemand anderem gelöschte Karte lässt kein Panel zurück.
    if (aktiv && !offeneKarte) setAnsicht(null)
  }, [aktiv, offeneKarte])

  return (
    <AppShell>
      <Navbar>
        <NavbarStart>
          <WorkspaceSwitcher
            workspaces={arbeitsraeume}
            activeWorkspace={aktiverRaum}
            onWorkspaceChange={wechsleRaum}
            onCreateWorkspace={() => {
              setDialogModus({ type: "create" })
              setGruppenDialog(true)
            }}
            onEditWorkspace={(w) => {
              const g = gruppen.find((x: Group) => x.id === w.id)
              if (!g) return
              setDialogModus({ type: "edit", group: g })
              setGruppenDialog(true)
            }}
          />
        </NavbarStart>
        <NavbarEnd>
          <UserMenu user={{ id: nutzer?.id ?? TISCH.id, name: nutzer?.displayName ?? TISCH.displayName }} />
        </NavbarEnd>
      </Navbar>

      <AppShellMain inset={false}>
        <ModuleFrame fill="bleed" panelFit="overlay">
          {/* Die Steuerleiste des Moduls und das Brett teilen sich einen
              Filter: Was der Kopf zeigt, ist das, was die Fläche anwendet. */}
          <FilterScope>
            <BrettModul
              ziele={ziele}
              karten={karten}
              faeden={faeden}
              aktiv={aktiv}
              fadenVon={fadenVon}
              live={live}
              brett={brett}
              ansicht={ansicht}
              kamera={kamera}
              onAnsicht={setAnsicht}
              onKarte={(id) => void kartenKlick(id)}
              onZelle={(zielId, stufe) => (fadenVon ? setFadenVon(null) : setAnsicht({ art: "neu", zielId, stufe }))}
              onZiel={() => setAnsicht({ art: "ziele" })}
              onVerschieben={(id, zielId, stufe) => void verschieben(id, zielId, stufe)}
              onStartziele={async () => {
                for (const [i, titel] of STARTZIELE.entries())
                  await anlegen({
                    type: ZIEL_TYP,
                    createdBy: TISCH.id,
                    "@context": [VOCAB.BASE, VOCAB.PROJECT],
                    data: { title: titel, dots: 0, order: i },
                  })
              }}
            />
          </FilterScope>
        </ModuleFrame>
      </AppShellMain>

      <AdaptivePanel open={!!ansicht} onClose={() => setAnsicht(null)} allowedModes={["sidebar", "drawer"]}>
        {ansicht?.art === "karte" && offeneKarte && (
          <KartenDetail
            karte={offeneKarte}
            ziele={ziele}
            karten={karten}
            faeden={faeden}
            fadenSchreibbar={fadenSchreibbar}
            onFadenSuchen={() => {
              setFadenVon(offeneKarte.id)
              setMeldung("Klicke die Karte, die VORHER fertig sein muss. Esc bricht ab.")
            }}
            onFadenLoesen={loese}
            onNachbarKarte={(id) => setAnsicht({ art: "karte", id })}
            onWeitereKarte={() =>
              setAnsicht({ art: "neu", zielId: zielVonKarte(offeneKarte) ?? "", stufe: Number(offeneKarte.data?.stage) || 0 })
            }
            onGeschlossen={() => setAnsicht(null)}
          />
        )}
        {ansicht?.art === "neu" && (
          <KarteAnlegen
            zielId={ansicht.zielId}
            zielTitel={String(ziele.find((z: Item) => z.id === ansicht.zielId)?.data?.title ?? "")}
            stufe={ansicht.stufe}
            onFertig={(item) => setAnsicht({ art: "karte", id: item.id })}
            onAbbruch={() => setAnsicht(null)}
          />
        )}
        {ansicht?.art === "traum" && <TraumPanel group={group} />}
        {ansicht?.art === "ziele" && <ZielePanel ziele={ziele} karten={karten} onKarteLoeschen={karteLoeschen} />}
        {ansicht?.art === "pruefung" && <PruefungPanel ziele={ziele} karten={karten} faeden={faeden} />}
        {ansicht?.art === "daten" && <DatenPanel brett={brett} group={group} items={[...ziele, ...karten]} relations={faeden} />}
      </AdaptivePanel>

      <GroupDialog
        open={gruppenDialog}
        onOpenChange={setGruppenDialog}
        mode={dialogModus}
        currentUserId={nutzer?.id ?? TISCH.id}
        onCreateGroup={async (name) => {
          await gruppeAnlegen(name)
        }}
        onUpdateGroup={async (id, aenderungen) => {
          await gruppeAendern(id, aenderungen)
        }}
        onDeleteGroup={async (id) => {
          await gruppeLoeschen(id)
        }}
      />

      {meldung && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {meldung}
        </div>
      )}
    </AppShell>
  )
}


// ------------------------------------------------------------- Modulfläche

interface ModulProps {
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
  aktiv: string | null
  fadenVon: string | null
  live: boolean
  brett: string
  ansicht: Ansicht
  kamera: RefObject<FlaechenSteuerung | null>
  onAnsicht: (a: Ansicht) => void
  onKarte: (id: string) => void
  onZelle: (zielId: string, stufe: number) => void
  onZiel: (id: string) => void
  onVerschieben: (id: string, zielId: string, stufe: number) => void
  onStartziele: () => Promise<void>
}

/**
 * Alles, was zum Modul gehört, liegt im Modul: die Steuerleiste über dem
 * Brett (`ModuleToolbar` — Suche, Filter, Modul-Aktionen, Verbindungsstand),
 * die Fläche selbst und die schwebende Ecke mit der Kamera
 * (`ModuleControls`). Die Navbar bleibt davon frei.
 */
function BrettModul({
  ziele,
  karten,
  faeden,
  aktiv,
  fadenVon,
  live,
  brett,
  ansicht,
  kamera,
  onAnsicht,
  onKarte,
  onZelle,
  onZiel,
  onVerschieben,
  onStartziele,
}: ModulProps) {
  // Suche und Tag-Auswahl kommen aus der Leiste im Kopf. Die Regeln (Fäden,
  // Verschieben) rechnen weiter mit ALLEN Karten — was ausgeblendet ist, ist
  // nicht weg.
  const sichtbar = useModuleFilteredItems(karten)
  const tags = useMemo(() => {
    const alle = new Set<string>()
    for (const k of [...karten, ...ziele]) for (const t of k.tags ?? []) alle.add(t)
    return [...alle].sort()
  }, [karten, ziele])

  const aktion = (art: Exclude<Ansicht, null>["art"], text: string) => (
    <Button
      key={art}
      variant={ansicht?.art === art ? "secondary" : "ghost"}
      size="sm"
      onClick={() => onAnsicht(ansicht?.art === art ? null : ({ art } as Ansicht))}
    >
      {text}
    </Button>
  )

  return (
    <>
      <ModuleToolbar
        availableTags={tags}
        searchLabel="Karten durchsuchen"
        trailingActions={
          <>
            <span
              className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground"
              title={live ? "gemeinsam, live" : "getrennt — Änderungen bleiben lokal"}
            >
              <i className={cn("inline-block h-2 w-2 rounded-full", live ? "bg-primary" : "bg-muted-foreground/40")} />
              {live ? "live" : "getrennt"}
            </span>
            {aktion("traum", "Traum")}
            {aktion("ziele", "Ziele")}
            {aktion("pruefung", "Prüfung")}
            {aktion("daten", "Daten")}
          </>
        }
      />

      {ziele.length === 0 ? (
        <div className="grid h-full place-items-center">
          <EmptyState
            icon={Sparkles}
            title="Das Brett ist leer."
            description="Ein Karabirrdt beginnt mit den Zielen aus dem Traumkreis. Jedes Ziel wird eine Zeile, die zwölf Stufen sind die Spalten, und jede Karte hängt in einer Zelle."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => void onStartziele()}>Die acht Ziele vom Whiteboard laden</Button>
                <Button variant="outline" onClick={() => onAnsicht({ art: "ziele" })}>
                  Mit eigenen Zielen starten
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <KarabirrdtBoard
          ziele={ziele}
          karten={sichtbar}
          faeden={faeden}
          aktiv={aktiv}
          fadenVon={fadenVon}
          steuerung={kamera}
          einpassenSchluessel={brett}
          onKarte={onKarte}
          onZelle={onZelle}
          onZiel={onZiel}
          onVerschieben={onVerschieben}
        />
      )}

      <ModuleControls>
        <div className="flex items-center gap-1 rounded-full border bg-card/90 p-1 shadow-sm backdrop-blur">
          <Button variant="ghost" size="icon-sm" title="Kleiner" onClick={() => kamera.current?.zoomen(1 / 1.25)}>
            <Minus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Größer" onClick={() => kamera.current?.zoomen(1.25)}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" title="Einpassen" onClick={() => kamera.current?.einpassen()}>
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </ModuleControls>
    </>
  )
}
