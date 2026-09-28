import { useCallback, useEffect, useMemo, useState } from "react"
import type { Group, Item, User } from "@real-life-stack/data-interface"
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
  ItemFocusContext,
  ModuleFrame,
  ModuleToolbar,
  Navbar,
  NavbarEnd,
  NavbarStart,
  UserMenu,
  WorkspaceSwitcher,
  applyFilterBarValue,
  applyItemSearch,
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
  useRelationRecords,
  useRemoveMember,
  useSharedFilter,
  useUpdateGroup,
  useUpdateItem,
  type ContentComposerProps,
  type GroupDialogMode,
  type ItemFocus,
  type Workspace,
} from "@real-life-stack/toolkit"
import { Moon, Settings2, Sparkles, Sun } from "lucide-react"
import { KarabirrdtBoard } from "./board/karabirrdt-board"
import { ItemDetail } from "./panels/item-detail"
import { IchDialog } from "./panels/ich-dialog"
import { PruefungPanel } from "./panels/pruefung-panel"
import { SpaceDialog } from "./panels/space-dialog"
import { STARTZIELE } from "./startziele"
import { TISCH, hatIchWahl } from "./connector/server-connector"
import { mitPosition, useAbbildung, useComposerProps, type Zelle } from "./composer"
import {
  KARTEN_TYP,
  VOCAB,
  ZIEL_TYP,
  faeden as faedenVon,
  mitZiel,
  verschiebenFehler,
  zielVonKarte,
  type Faden,
} from "../../modell.mjs"

type Ansicht =
  | { art: "item"; id: string }
  | { art: "neu"; zelle: Zelle }
  | { art: "anlegen" }
  | { art: "pruefung" }
  | null

/** Ein laufender Modul-Pick (Edit-Regeln 7): das Formular wartet auf einen Klick ins Brett. */
interface Pick {
  predicate: string
  onPick: (itemId: string) => { ok: true } | { ok: false; reason: string }
}

export default function App() {
  const connector = useConnector()
  const group = useCurrentGroup()
  const brett = group?.id ?? "haupt"
  const { data: gruppen } = useGroups()
  const { data: ich } = useCurrentUser()
  const { data: mitglieder } = useMembers(group?.id ?? null)
  const { data: ziele } = useItems({ type: ZIEL_TYP })
  const { data: karten } = useItems({ type: KARTEN_TYP })
  const faeden = useMemo(() => faedenVon(karten), [karten])
  // Übrige RelationRecords (etwa Fäden in einen anderen Space, die der Umzug
  // bewahrt): Sie gehören in den Export, sonst löschte ein Rück-Import sie.
  const { data: datensaetze } = useRelationRecords()
  const anlegen = useCreateItem()
  const aendere = useUpdateItem()
  const gruppeAnlegen = useCreateGroup()
  const gruppeAendern = useUpdateGroup()
  const gruppeLoeschen = useDeleteGroup()
  const einladen = useInviteMember()
  const entfernen = useRemoveMember()

  const [ansicht, setAnsicht] = useState<Ansicht>(null)
  const [bearbeiten, setBearbeiten] = useState(false)
  const [pick, setPick] = useState<Pick | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [gruppenDialog, setGruppenDialog] = useState(false)
  const [spaceDialog, setSpaceDialog] = useState(false)
  const [ichDialog, setIchDialog] = useState(false)
  const [dunkel, setDunkel] = useState(false)
  const [dialogModus, setDialogModus] = useState<GroupDialogMode>({ type: "create" })

  const oeffne = useCallback((a: Ansicht) => {
    setAnsicht(a)
    setBearbeiten(false)
    setPick(null)
  }, [])

  useEffect(() => {
    if (!meldung) return
    const t = setTimeout(() => setMeldung(null), 3200)
    return () => clearTimeout(t)
  }, [meldung])
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (pick) setPick(null)
      else if (!bearbeiten) setAnsicht(null)
    }
    document.addEventListener("keydown", taste)
    return () => document.removeEventListener("keydown", taste)
  }, [pick, bearbeiten])
  useEffect(() => oeffne(null), [brett, oeffne])


  // ------------------------------------------------------------ Fokus
  //
  // Der Fokus-Vertrag des Toolkits (ItemFocus), gehalten im Zustand der App:
  // Chips in der Meta-Box („Teil von", „Braucht") und Zeilen der Liste
  // „Karten" öffnen ihr Ziel damit in derselben Panel-Instanz.
  const offenId = ansicht?.art === "item" ? ansicht.id : undefined
  const fokus = useMemo<ItemFocus>(
    () => ({
      scope: brett,
      module: "karabirrdt",
      itemId: offenId,
      isEditing: bearbeiten,
      isCommenting: false,
      composeType: ansicht?.art === "neu" || ansicht?.art === "anlegen" ? KARTEN_TYP : null,
      focusItem: (id) => oeffne({ art: "item", id }),
      clearFocus: () => oeffne(null),
      editItem: () => setBearbeiten(true),
      stopEditing: () => setBearbeiten(false),
      commentOnItem: (id) => oeffne({ art: "item", id }),
      stopCommenting: () => {},
      startCompose: () => oeffne({ art: "anlegen" }),
      stopCompose: () => oeffne(null),
      focusCreated: (id) => oeffne({ art: "item", id }),
    }),
    [brett, offenId, bearbeiten, ansicht, oeffne],
  )

  // Der Modul-Pick: „Im Modul wählen" im Formular, dann ein Klick aufs Brett.
  const requestItemPick = useCallback<NonNullable<ContentComposerProps["requestItemPick"]>>((anfrage, onPick) => {
    setPick({ predicate: anfrage.predicate, onPick })
    setMeldung(anfrage.predicate === "partOf" ? "Klicke das Ziel an. Esc bricht ab." : "Klicke die Karte an. Esc bricht ab.")
  }, [])
  const composerProps = useComposerProps(requestItemPick)
  const gepickt = (id: string) => {
    if (!pick) return false
    const antwort = pick.onPick(id)
    setPick(null)
    if (!antwort.ok) setMeldung(antwort.reason)
    return true
  }

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

  const verschieben = async (id: string, zielId: string, stufe: number) => {
    const karte = karten.find((k) => k.id === id)
    if (!karte) return
    if (zielVonKarte(karte) === zielId && Number(karte.data?.stage) === stufe) return
    const fehler = verschiebenFehler(karten, faeden, id, stufe)
    if (fehler) return setMeldung(fehler)
    try {
      await aendere(id, {
        data: { ...karte.data, stage: stufe, order: Date.now() },
        relations: mitZiel(karte, zielId),
      })
    } catch (e) {
      setMeldung(e instanceof Error ? e.message : String(e))
    }
  }

  useEffect(() => {
    if (ansicht?.art === "item" && ![...karten, ...ziele].some((i) => i.id === ansicht.id)) oeffne(null)
  }, [ansicht, karten, ziele, oeffne])

  return (
    <ItemFocusContext.Provider value={fokus}>
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
          <UserMenu
            user={ich ?? TISCH}
            subtitle={!ich || ich.id === TISCH.id ? "Wer bist du? Unter Profil wählen" : undefined}
            onProfile={hatIchWahl(connector) ? () => setIchDialog(true) : undefined}
          />
        </NavbarEnd>
      </Navbar>

      <AppShellMain inset={false}>
        {/* Das Brett IST die Fläche und scrollt selbst (fill bleed); der Kopf
            mit Suche und Modul-Aktionen steht darüber im Fluss (panelFit
            inset) — ein Raster mit Spaltenköpfen verträgt keinen schwebenden
            Kopf. Der FilterScope umschließt Kopf UND Inhalt: Die Suche gehört
            der Fläche, die Karten lesen denselben Filter. */}
        <FilterScope>
          <ModuleFrame fill="bleed" panelFit="inset" maxWidth="max-w-none" searchLabel="Karten durchsuchen">
            <BrettModul
              ziele={ziele}
              karten={karten}
              faeden={faeden}
              mitglieder={mitglieder}
              aktiv={offenId ?? null}
              pickt={!!pick}
              ansicht={ansicht}
              horizont={String(group?.data?.horizon ?? "")}
              onAnsicht={oeffne}
              onKarte={(id) => gepickt(id) || oeffne({ art: "item", id })}
              onZiel={(id) => gepickt(id) || oeffne({ art: "item", id })}
              onZelle={(zielId, stufe) => (pick ? setPick(null) : oeffne({ art: "neu", zelle: { zielId, stufe } }))}
              onVerschieben={(id, zielId, stufe) => void verschieben(id, zielId, stufe)}
              onStartziele={async () => {
                for (const [i, titel] of STARTZIELE.entries())
                  await anlegen({
                    type: ZIEL_TYP,
                    createdBy: ich?.id ?? TISCH.id,
                    "@context": [VOCAB.BASE, VOCAB.PROJECT],
                    data: { title: titel, dots: 0, order: i },
                  })
              }}
            />
          </ModuleFrame>
        </FilterScope>
      </AppShellMain>

      {/* Die schwebende Detail-Karte. `floating` ist der Modus des Toolkits
          dafür; `resolveAdaptivePanelMode` wählt ihn auf breiten Schirmen vor
          `sidebar` und auf schmalen den Drawer. Die Maße sind die der
          Reference-App (ModulePanelHost). */}
      <AdaptivePanel
        open={!!ansicht}
        onClose={() => oeffne(null)}
        allowedModes={["floating", "sidebar", "drawer"]}
        sidebarWidth="420px"
        sidebarMinWidth="300px"
        sidebarMaxWidth="70vw"
      >
        {offenId && (
          <ItemDetail
            itemId={offenId}
            bearbeiten={bearbeiten}
            onBearbeiten={(an) => {
              setBearbeiten(an)
              if (!an) setPick(null)
            }}
            composerProps={composerProps}
            onGeschlossen={() => oeffne(null)}
          />
        )}
        {(ansicht?.art === "neu" || ansicht?.art === "anlegen") && (
          <Anlegen
            zelle={ansicht.art === "neu" ? ansicht.zelle : ziele[0] ? { zielId: ziele[0].id, stufe: 0 } : null}
            nurKarte={ansicht.art === "neu"}
            composerProps={composerProps}
            onFertig={(item) => oeffne({ art: "item", id: item.id })}
            onAbbruch={() => oeffne(null)}
          />
        )}
        {ansicht?.art === "pruefung" && <PruefungPanel ziele={ziele} karten={karten} faeden={faeden} />}
      </AdaptivePanel>

      <GroupDialog
        open={gruppenDialog}
        onOpenChange={setGruppenDialog}
        mode={dialogModus}
        currentUserId={ich?.id ?? TISCH.id}
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
        relations={datensaetze}
      />

      <IchDialog
        open={ichDialog}
        onOpenChange={setIchDialog}
        mitglieder={mitglieder}
        ich={ich}
        onWahl={(id) => {
          if (hatIchWahl(connector)) connector.waehleIch(id)
        }}
      />

      {meldung && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {meldung}
        </div>
      )}
    </AppShell>
    </ItemFocusContext.Provider>
  )
}

/**
 * Anlegen — eine Form für beide Arten, aus dem Register. Welche es wird,
 * entscheidet die Typ-Auswahl des Formulars; aus einer Zelle heraus steht
 * sie fest (Karte), und die Karte landet in dieser Zelle.
 */
function Anlegen({
  zelle,
  nurKarte,
  composerProps,
  onFertig,
  onAbbruch,
}: {
  zelle: Zelle | null
  nurKarte: boolean
  composerProps: Partial<ContentComposerProps>
  onFertig: (item: Item) => void
  onAbbruch: () => void
}) {
  const { typen, mapSubmission } = useAbbildung()
  const mapper = useMemo(() => mitPosition(mapSubmission, zelle), [mapSubmission, zelle])
  return (
    <div className="p-4">
      <ItemComposer
        contentTypes={nurKarte ? typen.filter((t) => t.id === KARTEN_TYP) : typen}
        initialContentType={KARTEN_TYP}
        mapper={mapper}
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
  faeden: Faden[]
  mitglieder: User[]
  aktiv: string | null
  pickt: boolean
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
 * Alles, was zum Modul gehört, liegt im Modul: die Modul-Aktionen im Kopf
 * (die Suche stellt die Fläche), die Fläche und der Plus-Knopf unten rechts.
 * Die Navbar bleibt davon frei.
 */
function BrettModul({
  ziele,
  karten,
  faeden,
  mitglieder,
  aktiv,
  pickt,
  ansicht,
  horizont,
  onAnsicht,
  onKarte,
  onZelle,
  onZiel,
  onVerschieben,
  onStartziele,
}: ModulProps) {
  // Genau das, was der Kopf anzeigt: Tags und Typen, dann der Suchtext
  // (Lücke: `useSurfaceItems` ist nicht exportiert, docs/rls-kompatibel.md).
  const { value, searchText } = useSharedFilter()
  const sichtbar = useMemo(() => applyItemSearch(applyFilterBarValue(karten, value), searchText), [karten, value, searchText])

  return (
    <>
      <ModuleToolbar
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
          pickt={pickt}
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
