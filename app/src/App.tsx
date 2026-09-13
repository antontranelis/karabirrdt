import { useCallback, useEffect, useState } from "react"
import type { Item } from "@real-life-stack/data-interface"
import {
  AdaptivePanel,
  AppShell,
  AppShellMain,
  Button,
  EmptyState,
  Input,
  Navbar,
  NavbarEnd,
  NavbarStart,
  Textarea,
  cn,
  useCreateItem,
  useCurrentGroup,
  useDeleteItem,
  useItems,
  useUpdateGroup,
  useUpdateItem,
} from "@real-life-stack/toolkit"
import { Sparkles } from "lucide-react"
import { KarabirrdtBoard } from "./board/karabirrdt-board"
import { KartenDetail } from "./panels/karten-detail"
import { KarteAnlegen } from "./panels/karte-anlegen"
import { ZielePanel } from "./panels/ziele-panel"
import { PruefungPanel } from "./panels/pruefung-panel"
import { DatenPanel } from "./panels/daten-panel"
import { BretterPanel } from "./panels/bretter-panel"
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
  | { art: "ziele" }
  | { art: "pruefung" }
  | { art: "daten" }
  | { art: "bretter" }
  | null

interface Props {
  brett: string
  aufZustand: (hoerer: (live: boolean) => void) => () => void
}

export default function App({ brett, aufZustand }: Props) {
  const group = useCurrentGroup()
  const aendereGroup = useUpdateGroup()
  const { data: ziele } = useItems({ type: ZIEL_TYP })
  const { data: karten } = useItems({ type: KARTEN_TYP })
  const { faeden, schreibbar: fadenSchreibbar, ziehe, loese } = useFaeden()
  const { mutate: anlegen } = useCreateItem()
  const { mutate: aendere } = useUpdateItem()
  const { mutate: loesche } = useDeleteItem()

  const [ansicht, setAnsicht] = useState<Ansicht>(null)
  const [fadenVon, setFadenVon] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [live, setLive] = useState(false)

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

  const daten = (group?.data ?? {}) as Record<string, unknown>
  const setzeGroup = (patch: Record<string, unknown>) => void aendereGroup(brett, { data: patch })

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
          <div className="min-w-0 flex-1 py-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Karabirrdt · Dragon Dreaming · {brett}
            </div>
            <Input
              className="h-8 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
              placeholder="Name des Projekts"
              aria-label="Projektname"
              defaultValue={String(daten.name ?? "")}
              key={`n-${String(daten.name ?? "")}`}
              onBlur={(e) => setzeGroup({ name: e.target.value.trim() })}
            />
            <Textarea
              rows={1}
              className="min-h-0 resize-none border-0 bg-transparent px-0 italic shadow-none focus-visible:ring-0"
              placeholder="Traumsatz aus dem Traumkreis: „Es ist … und wir …“"
              aria-label="Traumsatz"
              defaultValue={String(daten.dream ?? "")}
              key={`d-${String(daten.dream ?? "")}`}
              onBlur={(e) => setzeGroup({ dream: e.target.value.trim() })}
            />
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              Traumhorizont
              <Input
                className="h-6 w-36 px-1 text-xs"
                placeholder="September 2027"
                aria-label="Traumhorizont"
                defaultValue={String(daten.horizon ?? "")}
                key={`h-${String(daten.horizon ?? "")}`}
                onBlur={(e) => setzeGroup({ horizon: e.target.value.trim() })}
              />
            </div>
          </div>
        </NavbarStart>
        <NavbarEnd>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground" title="Verbindung zum Server">
            <i className={cn("inline-block h-2 w-2 rounded-full", live ? "bg-primary" : "bg-muted-foreground/40")} />
            {live ? "gemeinsam, live" : "getrennt"}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setAnsicht({ art: "bretter" })}>
            Brett
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnsicht({ art: "ziele" })}>
            Ziele
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnsicht({ art: "pruefung" })}>
            Prüfung
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAnsicht({ art: "daten" })}>
            Daten
          </Button>
        </NavbarEnd>
      </Navbar>

      <AppShellMain>
        {ziele.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Das Brett ist leer."
            description="Ein Karabirrdt beginnt mit den Zielen aus dem Traumkreis. Jedes Ziel wird eine Zeile, die zwölf Stufen sind die Spalten, und jede Karte hängt in einer Zelle."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  onClick={async () => {
                    for (const [i, titel] of STARTZIELE.entries())
                      await anlegen({
                        type: ZIEL_TYP,
                        createdBy: TISCH.id,
                        "@context": [VOCAB.BASE, VOCAB.PROJECT],
                        data: { title: titel, dots: 0, order: i },
                      })
                  }}
                >
                  Die acht Ziele vom Whiteboard laden
                </Button>
                <Button variant="outline" onClick={() => setAnsicht({ art: "ziele" })}>
                  Mit eigenen Zielen starten
                </Button>
              </div>
            }
          />
        ) : (
          <KarabirrdtBoard
            ziele={ziele}
            karten={karten}
            faeden={faeden}
            aktiv={aktiv}
            fadenVon={fadenVon}
            onKarte={(id) => void kartenKlick(id)}
            onZelle={(zielId, stufe) => (fadenVon ? setFadenVon(null) : setAnsicht({ art: "neu", zielId, stufe }))}
            onZiel={() => setAnsicht({ art: "ziele" })}
            onVerschieben={(id, zielId, stufe) => void verschieben(id, zielId, stufe)}
          />
        )}
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
        {ansicht?.art === "ziele" && <ZielePanel ziele={ziele} karten={karten} onKarteLoeschen={karteLoeschen} />}
        {ansicht?.art === "pruefung" && <PruefungPanel ziele={ziele} karten={karten} faeden={faeden} />}
        {ansicht?.art === "daten" && <DatenPanel brett={brett} group={group} items={[...ziele, ...karten]} relations={faeden} />}
        {ansicht?.art === "bretter" && <BretterPanel brett={brett} />}
      </AdaptivePanel>

      {meldung && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg">
          {meldung}
        </div>
      )}
    </AppShell>
  )
}
