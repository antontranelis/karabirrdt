import { useCallback, useEffect, useMemo, useState } from "react"
import type { Group, Item, RelationRecord, User } from "@real-life-stack/data-interface"
import { hasGroups } from "@real-life-stack/data-interface"
import {
  AdaptivePanel,
  AppShell,
  AppShellMain,
  Button,
  CreateFab,
  EmptyState,
  FilterScope,
  GroupDialog,
  ItemComposer,
  ModuleFrame,
  ModuleToolbar,
  Navbar,
  NavbarEnd,
  NavbarStart,
  UserMenu,
  WorkspaceSwitcher,
  useConnector,
  useCreateGroup,
  useCreateItem,
  useCurrentGroup,
  useCurrentUser,
  useDeleteGroup,
  useGroups,
  useInviteMember,
  useItems,
  useMembers,
  useModuleFilteredItems,
  useRemoveMember,
  useUpdateGroup,
  useUpdateItem,
  type GroupDialogMode,
  type Workspace,
} from "@real-life-stack/toolkit"
import { Moon, Settings2, Sparkles, Sun } from "lucide-react"
import { KarabirrdtBoard } from "./board/karabirrdt-board"
import { KartenDetail } from "./panels/karten-detail"
import { ZielDetail } from "./panels/ziel-detail"
import { PruefungPanel } from "./panels/pruefung-panel"
import { SpaceDialog } from "./panels/space-dialog"
import { useFaeden } from "./faeden"
import { STARTZIELE } from "./startziele"
import { TISCH } from "./connector/server-connector"
import { KARTEN_VORLAGE, ZIEL_VORLAGE, karteMapper, useComposerProps, zielMapper } from "./content-types"
import {
  KARTEN_TYP,
  VOCAB,
  ZIEL_TYP,
  fadenFehler,
  mitZiel,
  verschiebenFehler,
  zielVonKarte,
} from "../../modell.mjs"

type Ansicht =
  | { art: "karte"; id: string }
  | { art: "ziel"; id: string }
  | { art: "neu"; zielId: string; stufe: number }
  | { art: "anlegen" }
  | { art: "pruefung" }
  | null

export default function App() {
  const connector = useConnector()
  const group = useCurrentGroup()
  const brett = group?.id ?? "haupt"
  const { data: gruppen } = useGroups()
  const { data: nutzer } = useCurrentUser()
  const { data: mitglieder } = useMembers(group?.id ?? null)
  const { data: ziele } = useItems({ type: ZIEL_TYP })
  const { data: karten } = useItems({ type: KARTEN_TYP })
  const { faeden, schreibbar: fadenSchreibbar, ziehe, loese } = useFaeden()
  const { mutate: anlegen } = useCreateItem()
  const { mutate: aendere } = useUpdateItem()
  const gruppeAnlegen = useCreateGroup()
  const gruppeAendern = useUpdateGroup()
  const gruppeLoeschen = useDeleteGroup()
  const einladen = useInviteMember()
  const entfernen = useRemoveMember()

  const [ansicht, setAnsicht] = useState<Ansicht>(null)
  const [fadenVon, setFadenVon] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [gruppenDialog, setGruppenDialog] = useState(false)
  const [spaceDialog, setSpaceDialog] = useState(false)
  const [dunkel, setDunkel] = useState(false)
  const [dialogModus, setDialogModus] = useState<GroupDialogMode>({ type: "create" })

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

  const aktiv = ansicht?.art === "karte" || ansicht?.art === "ziel" ? ansicht.id : null
  const offeneKarte = ansicht?.art === "karte" ? karten.find((k) => k.id === ansicht.id) : undefined
  const offenesZiel = ansicht?.art === "ziel" ? ziele.find((z) => z.id === ansicht.id) : undefined
  useEffect(() => {
    if (ansicht?.art === "karte" && !offeneKarte) setAnsicht(null)
    if (ansicht?.art === "ziel" && !offenesZiel) setAnsicht(null)
  }, [ansicht, offeneKarte, offenesZiel])

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
          <Button variant="ghost" size="icon-sm" title="Traum und Daten dieses Spaces" onClick={() => setSpaceDialog(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </NavbarStart>
        <NavbarEnd>
          {/* Genau die Zusammensetzung der Reference-App: das Toolkit hat
              keinen Umschalter, nur die Leser `resolveColorScheme` und
              `observeColorScheme` (siehe docs/rls-kompatibel.md). Die
              `dark`-Klasse an <html> ist das einzige Signal. */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title={dunkel ? "Heller Modus" : "Dunkler Modus"}
            aria-label={dunkel ? "Heller Modus" : "Dunkler Modus"}
            onClick={() => {
              setDunkel(!dunkel)
              document.documentElement.classList.toggle("dark")
            }}
          >
            {dunkel ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <UserMenu user={{ id: nutzer?.id ?? TISCH.id, name: nutzer?.displayName ?? TISCH.displayName }} />
        </NavbarEnd>
      </Navbar>

      <AppShellMain>
        {/* Eine scrollende Fläche (Spec 01: „Was scrollt, ist der Inhalt"):
            `fill="bleed"` gibt dem Brett die ganze Breite, die Vorgabe
            `panelFit: "inset"` setzt den Kopf IN den Fluss und rückt die
            Fläche neben dem offenen Panel ein. Ein schwebender Kopf läge
            sonst auf dem, was gerade unter ihm durchscrollt. */}
        <ModuleFrame fill="bleed" maxWidth="max-w-none">
          <FilterScope>
            <BrettModul
              ziele={ziele}
              karten={karten}
              faeden={faeden}
              mitglieder={mitglieder}
              aktiv={aktiv}
              fadenVon={fadenVon}
              ansicht={ansicht}
              horizont={String(group?.data?.horizon ?? "")}
              onAnsicht={setAnsicht}
              onKarte={(id) => void kartenKlick(id)}
              onZelle={(zielId, stufe) => (fadenVon ? setFadenVon(null) : setAnsicht({ art: "neu", zielId, stufe }))}
              onZiel={(id) => setAnsicht({ art: "ziel", id })}
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

      {/* Die schwebende Detail-Karte. `floating` ist der Modus des Toolkits
          dafür; `resolveAdaptivePanelMode` wählt ihn auf breiten Schirmen vor
          `sidebar` und auf schmalen den Drawer. Die Maße sind die der
          Reference-App (ModulePanelHost). */}
      <AdaptivePanel
        open={!!ansicht}
        onClose={() => setAnsicht(null)}
        allowedModes={["floating", "sidebar", "drawer"]}
        sidebarWidth="420px"
        sidebarMinWidth="300px"
        sidebarMaxWidth="70vw"
      >
        {offeneKarte && (
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
            onGeschlossen={() => setAnsicht(null)}
          />
        )}
        {offenesZiel && (
          <ZielDetail ziel={offenesZiel} onGeschlossen={() => setAnsicht(null)} />
        )}
        {(ansicht?.art === "neu" || ansicht?.art === "anlegen") && (
          <Anlegen
            zielId={ansicht.art === "neu" ? ansicht.zielId : (ziele[0]?.id ?? "")}
            stufe={ansicht.art === "neu" ? ansicht.stufe : 0}
            nurKarte={ansicht.art === "neu"}
            onFertig={(item) => setAnsicht({ art: item.type === ZIEL_TYP ? "ziel" : "karte", id: item.id })}
            onAbbruch={() => setAnsicht(null)}
          />
        )}
        {ansicht?.art === "pruefung" && <PruefungPanel ziele={ziele} karten={karten} faeden={faeden} />}
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
        onInviteMember={einladen}
        onRemoveMember={entfernen}
      />

      <SpaceDialog
        open={spaceDialog}
        onOpenChange={setSpaceDialog}
        brett={brett}
        group={group}
        items={[...ziele, ...karten]}
        relations={faeden}
      />

      {meldung && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {meldung}
        </div>
      )}
    </AppShell>
  )
}

/**
 * Anlegen — eine Form für beide Arten. Welche es wird, entscheidet die
 * Typ-Auswahl des `ItemComposer`; aus einer Zelle heraus steht sie fest.
 */
function Anlegen({
  zielId,
  stufe,
  nurKarte,
  onFertig,
  onAbbruch,
}: {
  zielId: string
  stufe: number
  nurKarte: boolean
  onFertig: (item: Item) => void
  onAbbruch: () => void
}) {
  const composerProps = useComposerProps()
  const karte = karteMapper({ zielId, stufe, order: Date.now() })
  const ziel = zielMapper(Date.now())
  return (
    <div className="p-4">
      <ItemComposer
        contentTypes={nurKarte ? [KARTEN_VORLAGE] : [KARTEN_VORLAGE, ZIEL_VORLAGE]}
        initialContentType={KARTEN_VORLAGE.id}
        initialData={{ status: "open" }}
        mapper={(eingabe, ctx) => (eingabe.contentType === ZIEL_TYP ? ziel(eingabe, ctx) : karte(eingabe, ctx))}
        composerProps={composerProps}
        onDone={onFertig}
        onCancel={onAbbruch}
      />
    </div>
  )
}

// ------------------------------------------------------------- Modulfläche

interface ModulProps {
  ziele: Item[]
  karten: Item[]
  faeden: RelationRecord[]
  mitglieder: User[]
  aktiv: string | null
  fadenVon: string | null
  ansicht: Ansicht
  /** Nur Anzeige — geändert wird er im Space-Dialog. */
  horizont: string
  onAnsicht: (a: Ansicht) => void
  onKarte: (id: string) => void
  onZelle: (zielId: string, stufe: number) => void
  onZiel: (id: string) => void
  onVerschieben: (id: string, zielId: string, stufe: number) => void
  onStartziele: () => Promise<void>
}

/**
 * Alles, was zum Modul gehört, liegt im Modul: die Steuerleiste (Suche links,
 * Modul-Aktionen und Kamera rechts), die Fläche und der Plus-Knopf unten
 * rechts. Die Navbar bleibt davon frei.
 */
function BrettModul({
  ziele,
  karten,
  faeden,
  mitglieder,
  aktiv,
  fadenVon,
  ansicht,
  horizont,
  onAnsicht,
  onKarte,
  onZelle,
  onZiel,
  onVerschieben,
  onStartziele,
}: ModulProps) {
  const sichtbar = useModuleFilteredItems(karten)
  const tags = useMemo(() => {
    const alle = new Set<string>()
    for (const k of [...karten, ...ziele]) for (const t of k.tags ?? []) alle.add(t)
    return [...alle].sort()
  }, [karten, ziele])

  return (
    <>
      <ModuleToolbar
        availableTags={tags}
        searchLabel="Karten durchsuchen"
        trailingActions={
          <>
            {!!horizont && (
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                Traumhorizont · {horizont}
              </span>
            )}
            <Button
              variant={ansicht?.art === "pruefung" ? "secondary" : "outline"}
              size="sm"
              onClick={() => onAnsicht(ansicht?.art === "pruefung" ? null : { art: "pruefung" })}
            >
              Prüfung
            </Button>
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
                <Button variant="outline" onClick={() => onAnsicht({ art: "anlegen" })}>
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
          mitglieder={mitglieder}
          aktiv={aktiv}
          fadenVon={fadenVon}
          onKarte={onKarte}
          onZelle={onZelle}
          onZiel={onZiel}
          onVerschieben={onVerschieben}
        />
      )}

      <CreateFab label="Neu" onClick={() => onAnsicht({ art: "anlegen" })} />
    </>
  )
}
