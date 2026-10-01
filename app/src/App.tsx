import { useCallback, useEffect, useMemo, useState } from "react"
import type { Group, Item, User } from "@real-life-stack/data-interface"
import { hasGroups, isAuthenticatable } from "@real-life-stack/data-interface"
import {
  AdaptivePanel,
  AppShell,
  AppShellMain,
  Button,
  ColorSchemeToggle,
  CreateFab,
  EmptyState,
  FilterScope,
  GroupDialog,
  ItemFocusContext,
  ModuleFrame,
  ModuleToolbar,
  Navbar,
  NavbarEnd,
  NavbarStart,
  UserMenu,
  WorkspaceSwitcher,
  useConnector,
  useContacts,
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
  useRelationRecords,
  useRemoveMember,
  useUpdateGroup,
  useUpdateItem,
  type ContentComposerProps,
  type GroupDialogMode,
  type ItemFocus,
  type Workspace,
} from "@real-life-stack/toolkit"
import { Sparkles } from "lucide-react"
import { KarabirrdtBoard } from "./board/karabirrdt-board"
import { ItemDetail } from "./panels/item-detail"
import { ProfilPanel, ohneNamen, useMeinProfil } from "./panels/profil"
import { PruefungPanel } from "./panels/pruefung-panel"
import { liveModus, spaceAbschnitte } from "./panels/space-abschnitte"
import { STARTZIELE } from "./startziele"
import { istBrett, neuesBrett, slugAusPfad, slugVon, startBrett } from "./brett"
import { useComposerProps, type Zelle } from "./composer"
import { Anlegen } from "./panels/anlegen"
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
  | { art: "profil" }
  | null

/** Ein laufender Modul-Pick (Edit-Regeln 7): das Formular wartet auf einen Klick ins Brett. */
interface Pick {
  predicate: string
  onPick: (itemId: string) => { ok: true } | { ok: false; reason: string }
}

/** Was einen Wechsel des Bretts überdauert; die App selbst hängt je Brett neu ein. */
export interface BrettAdresse {
  /** Eine Adresse, die es unter den eigenen Brettern (noch) nicht gibt. */
  unbekannt: string | null
  setUnbekannt: (slug: string | null) => void
  /** Ein gerade angelegtes Brett, bis die Liste es kennt. */
  neuerSlug: string | null
  setNeuerSlug: (slug: string | null) => void
}

export default function App({ unbekannt, setUnbekannt, neuerSlug, setNeuerSlug }: BrettAdresse) {
  const connector = useConnector()
  const offeneGruppe = useCurrentGroup()
  const { data: alleGruppen, isLoading: gruppenLaden } = useGroups()
  // Die Instanz teilen sich mehrere Apps: Bretter sind nur die Spaces mit dem
  // Modul `karabirrdt`.
  const gruppen = useMemo(() => alleGruppen.filter(istBrett), [alleGruppen])
  // Ein gerade angelegtes oder gewähltes Brett kann noch fehlen, bis die Liste
  // nachgeladen ist; verborgen wird nur ein Space, der bekannt KEIN Brett ist.
  // Offen ist nur ein Brett, das die beobachtete Liste kennt: Die Daten kommen
  // von dort (ein geänderter Traumhorizont erscheint sofort), und ein Brett,
  // in dem man nicht mehr Mitglied ist, schließt sich.
  const group = (offeneGruppe && gruppen.find((g) => g.id === offeneGruppe.id)) || null
  const brett = group?.id ?? ""
  const { data: ich } = useCurrentUser()
  const profil = useMeinProfil(connector)
  const { activeContacts } = useContacts()
  const { data: mitglieder } = useMembers(group?.id ?? null)
  // Gelesen wird ausdrücklich im offenen Brett (`group`, Spec 02): Jedes
  // Brett hat seine eigene Beobachtung, beim Wechsel stehen nie die Karten
  // des vorigen unter dem Kopf des neuen. Ohne Brett liest das nichts.
  // Die App hängt je Brett neu ein (main.tsx, Lücke 38), der Filter ändert
  // sich also nie im selben Leben.
  const { data: ziele, isLoading: zieleLaden } = useItems({ type: ZIEL_TYP, group: brett })
  const { data: karten, isLoading: kartenLaden } = useItems({ type: KARTEN_TYP, group: brett })
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
  const raumAbschnitte = useMemo(
    () => spaceAbschnitte({ brett, items: [...ziele, ...karten], relations: datensaetze }),
    [brett, ziele, karten, datensaetze],
  )

  const wechsleRaum = useCallback(
    (w: Workspace) => {
      setUnbekannt(null)
      if (hasGroups(connector)) connector.setCurrentGroup(w.id)
    },
    [connector],
  )

  // ------------------------------------------------------------- Adresse
  //
  // `/<slug>` öffnet das Brett mit diesem Slug (Group.data.slug); der Wechsel
  // im Space-Switch schreibt die Adresse nach, „Zurück“ hört mit.
  const oeffneAdresse = useCallback(() => {
    if (!hasGroups(connector)) return
    const start = startBrett(gruppen, slugAusPfad(location.pathname))
    if (start.art === "brett") {
      setUnbekannt(null)
      if (connector.getCurrentGroup()?.id !== start.gruppe.id) connector.setCurrentGroup(start.gruppe.id)
    } else {
      setUnbekannt(start.art === "unbekannt" ? start.slug : null)
      if (connector.getCurrentGroup()) connector.setCurrentGroup(null)
    }
  }, [connector, gruppen])
  useEffect(() => {
    if (gruppenLaden || group) return
    // Eine unbekannte Adresse bleibt stehen, bis das Brett erscheint — etwa
    // weil ein Mitglied einen gerade eingeladen hat (Realtime).
    if (unbekannt && !gruppen.some((g) => slugVon(g) === unbekannt)) return
    oeffneAdresse()
  }, [gruppenLaden, group, unbekannt, gruppen, oeffneAdresse])
  useEffect(() => {
    // Erst mit den Daten der Group steht ihr Slug fest (setCurrentGroup
    // liefert sofort eine Group nur mit Id, die Daten folgen).
    if (!group || (!group.name && Object.keys(group.data ?? {}).length === 0)) return
    const ziel = `/${slugVon(group)}`
    if (location.pathname !== ziel) history.pushState(null, "", ziel)
  }, [group])
  useEffect(() => {
    window.addEventListener("popstate", oeffneAdresse)
    return () => window.removeEventListener("popstate", oeffneAdresse)
  }, [oeffneAdresse])

  // Wer sich anonym anmeldet, hat noch keinen Namen: erst das Profil.
  useEffect(() => {
    if (ohneNamen(profil) && ansicht === null) setAnsicht({ art: "profil" })
  }, [profil, ansicht])

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
        </NavbarStart>
        <NavbarEnd>
          {/* Hell und dunkel aus dem Toolkit (toolkit 0.4.0, Lücke 16): führt
              `dark`-Klasse und `data-theme`, merkt die Wahl, folgt sonst dem
              System. Den Startwert setzt main.tsx vor dem ersten Render. */}
          <ColorSchemeToggle />
          <UserMenu
            user={ich ?? { id: "" }}
            subtitle={ohneNamen(profil) ? "Noch ohne Namen" : undefined}
            onProfile={() => oeffne({ art: "profil" })}
            onLogout={isAuthenticatable(connector) ? () => void connector.logout() : undefined}
          />
        </NavbarEnd>
      </Navbar>

      <AppShellMain inset={false}>
        {/* Das Brett IST die Fläche und scrollt selbst (fill bleed); der Kopf
            mit Suche und Modul-Aktionen steht darüber im Fluss (panelFit
            inset) — ein Raster mit Spaltenköpfen verträgt keinen schwebenden
            Kopf. Der FilterScope umschließt Kopf UND Inhalt: Die Suche gehört
            der Fläche, die Karten lesen denselben Filter. */}
        {!group ? (
          <OhneBrett
            unbekannt={unbekannt}
            laedt={gruppenLaden || (!!neuerSlug && unbekannt === neuerSlug)}
            ichId={ich?.id ?? ""}
            onAnlegen={() => {
              setDialogModus({ type: "create" })
              setGruppenDialog(true)
            }}
          />
        ) : (
        <FilterScope>
          <ModuleFrame fill="bleed" panelFit="inset" maxWidth="max-w-none" searchLabel="Karten durchsuchen">
            <BrettModul
              ziele={ziele}
              karten={karten}
              laedt={zieleLaden || kartenLaden}
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
                    createdBy: ich?.id ?? "",
                    "@context": [VOCAB.BASE, VOCAB.PROJECT],
                    data: { title: titel, dots: 0, order: i },
                  })
              }}
            />
          </ModuleFrame>
        </FilterScope>
        )}
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
        {ansicht?.art === "profil" && <ProfilPanel connector={connector} profil={profil ?? null} onClose={() => oeffne(null)} />}
      </AdaptivePanel>

      {/* Traum und Daten sind App-Abschnitte im GroupDialog (toolkit 0.4.0,
          Lücke 13). Der Dialog bekommt die Group live aus useGroups, nicht den
          Schnappschuss vom Öffnen (shared-components, Regel 3). */}
      <GroupDialog
        open={gruppenDialog}
        onOpenChange={setGruppenDialog}
        mode={liveModus(dialogModus, gruppen)}
        appSections={raumAbschnitte}
        appSectionsTitle="Karabirrdt"
        contacts={activeContacts}
        currentUserId={ich?.id}
        onCreateGroup={async (name) => {
          const daten = neuesBrett(name, gruppen.map(slugVon))
          await gruppeAnlegen(name, daten)
          // Über die Adresse öffnen: sobald die Liste das neue Brett kennt.
          setNeuerSlug(daten.slug)
          history.pushState(null, "", `/${daten.slug}`)
          if (hasGroups(connector)) connector.setCurrentGroup(null)
          setUnbekannt(daten.slug)
        }}
        onUpdateGroup={async (id, aenderungen) => {
          await gruppeAendern(id, aenderungen)
        }}
        onDeleteGroup={async (id) => {
          await gruppeLoeschen(id)
          const rest = gruppen.find((g) => g.id !== id)
          if (hasGroups(connector)) connector.setCurrentGroup(rest?.id ?? null)
        }}
        onInviteMember={einladen}
        onRemoveMember={entfernen}
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

// ------------------------------------------------------------- Modulfläche

interface ModulProps {
  ziele: Item[]
  karten: Item[]
  /** Die Items des Bretts sind noch nicht da. */
  laedt: boolean
  faeden: Faden[]
  mitglieder: User[]
  aktiv: string | null
  pickt: boolean
  ansicht: Ansicht
  /** Nur Anzeige — geändert wird er im Abschnitt „Traum“ des GroupDialog. */
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
  laedt,
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
  // Genau das, was der Kopf anzeigt: Tags, Typen und Suchtext — der Hook des
  // Toolkits für eine Fläche außerhalb des Modul-Hosts (toolkit 0.4.0, Lücke 22).
  const sichtbar = useModuleFilteredItems(karten)

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

      {laedt ? (
        <div className="grid h-full place-items-center text-muted-foreground">Lade Brett …</div>
      ) : ziele.length === 0 ? (
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

/** Kein Brett offen: keins angelegt, oder die Adresse gehört zu keinem eigenen. */
function OhneBrett({ unbekannt, laedt, ichId, onAnlegen }: { unbekannt: string | null; laedt: boolean; ichId: string; onAnlegen: () => void }) {
  if (laedt) return <div className="grid h-full place-items-center text-muted-foreground">Lade Bretter …</div>
  return (
    <div className="grid h-full place-items-center p-4">
      <EmptyState
        icon={Sparkles}
        title={unbekannt ? `Das Brett „${unbekannt}“ ist nicht da.` : "Noch kein Brett."}
        description={
          unbekannt
            ? `Entweder gibt es das Brett nicht, oder du bist noch kein Mitglied. Ein Mitglied kann dich einladen; deine Kennung ist ${ichId}.`
            : "Ein Brett ist ein Space: die Ziele aus dem Traumkreis als Zeilen, die zwölf Stufen als Spalten."
        }
        action={<Button onClick={onAnlegen}>Brett anlegen</Button>}
      />
    </div>
  )
}
