import { useState } from "react"
import type { Group, Item, RelationRecord } from "@real-life-stack/data-interface"
import { Button, Label, Textarea, useConnector } from "@real-life-stack/toolkit"
import { rohVon } from "../connector/brett-regeln"
import { slugVon } from "../brett"
import { rlsNachAlt } from "../../../modell.mjs"
import { importiere, planeUmzug } from "../../../umwandeln.mjs"

interface Props {
  group: Group
  items: Item[]
  relations: RelationRecord[]
}

/**
 * JSON heraus und hinein. Heraus kommt die RLS-Form; hinein gehen beide,
 * die alte `{meta, goals, tasks}` und die neue `{group, items, relations}`.
 * Der Import ist derselbe wie im Umzugsskript (`umwandeln.mjs`): ins offene
 * Brett, Ids bleiben, Autor ist, wer importiert; Karten und Ziele, die das
 * JSON nicht kennt, fallen weg.
 */
export function DatenPanel({ group, items, relations }: Props) {
  const connector = useConnector()
  const brett = slugVon(group)
  const rls = { group, items, relations }
  const [text, setText] = useState(() => JSON.stringify(rls, null, 1))
  const [meldung, setMeldung] = useState<string | null>(null)
  const [sicher, setSicher] = useState(false)

  return (
    <div className="space-y-3 p-4">
      <Textarea rows={12} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setMeldung("Kopiert.")
            } catch {
              setMeldung("Bitte von Hand kopieren (Strg+C).")
            }
          }}
        >
          In die Zwischenablage
        </Button>
        <Button variant="outline" asChild>
          <a href={"data:application/json;charset=utf-8," + encodeURIComponent(text)} download={`karabirrdt-${brett}.json`}>
            Als Datei speichern
          </a>
        </Button>
        <Button variant="outline" onClick={() => setText(JSON.stringify(rlsNachAlt(rls), null, 1))}>
          Altes Format zeigen
        </Button>
      </div>

      <label className="block space-y-1">
        <Label>Aus Datei laden</Label>
        <input
          type="file"
          accept="application/json,.json"
          className="block w-full text-sm"
          onChange={(e) => {
            const datei = e.target.files?.[0]
            if (!datei) return
            void datei.text().then((inhalt) => {
              setText(inhalt)
              try {
                JSON.parse(inhalt)
                setMeldung("Datei geladen. Jetzt „Einfügen und ersetzen“.")
              } catch {
                setMeldung("Die Datei ist kein gültiges JSON.")
              }
            })
          }}
        />
      </label>

      <Button
        variant="destructive"
        onClick={async () => {
          let json: unknown
          try {
            json = JSON.parse(text)
            if (!json || typeof json !== "object") throw new Error()
          } catch {
            setMeldung("Das ist kein gültiges JSON.")
            return
          }
          if (!sicher) {
            setSicher(true)
            setMeldung("Noch einmal drücken: das ersetzt das ganze Brett.")
            setTimeout(() => setSicher(false), 4000)
            return
          }
          setSicher(false)
          try {
            const plan = await planeUmzug(json, { slug: brett })
            const bericht = await importiere(plan, rohVon(connector), { gruppe: group.id, ersetzen: true })
            const ohne = plan.ohneKonto.length ? ` ${plan.ohneKonto.length} Zuweisungen ohne Konto bleiben stehen.` : ""
            setMeldung(
              bericht.fehler.length
                ? `Teilweise ersetzt: ${bericht.fehler.length} Fehler (${bericht.fehler[0].grund}).`
                : `Brett ersetzt: ${bericht.angelegt.length} neu, ${bericht.geaendert.length} geändert, ${bericht.entfernt.length} entfernt.${ohne}`,
            )
          } catch (e) {
            setMeldung(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        {sicher ? "Brett wirklich ersetzen?" : "Einfügen und ersetzen"}
      </Button>
      {meldung && <p className="text-sm">{meldung}</p>}
    </div>
  )
}
