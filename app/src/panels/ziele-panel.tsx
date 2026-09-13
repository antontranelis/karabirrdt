import type { Item } from "@real-life-stack/data-interface"
import { Button, Input, useCreateItem, useDeleteItem, useUpdateItem } from "@real-life-stack/toolkit"
import { VOCAB, ZIEL_TYP, zieleSortiert, zielVonKarte } from "../../../modell.mjs"
import { TISCH } from "../connector/server-connector"

interface Props {
  ziele: Item[]
  karten: Item[]
  onKarteLoeschen: (id: string) => Promise<void>
}

/**
 * Die Zeilen des Bretts. Punkte kommen aus der Klebepunkt-Runde und
 * sortieren die Zeilen; das ist kein Karten-Kontext, darum ein Formular
 * und keine ItemPreview.
 */
export function ZielePanel({ ziele, karten, onKarteLoeschen }: Props) {
  const { mutate: anlegen } = useCreateItem()
  const { mutate: aendern } = useUpdateItem()
  const { mutate: loeschen } = useDeleteItem()

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">Ziele</h2>
      <p className="text-sm text-muted-foreground">
        Jedes Ziel ist eine Zeile. Punkte = Priorisierung aus der Klebepunkt-Runde; die Zeilen sortieren sich danach.
      </p>
      <ul className="divide-y">
        {(zieleSortiert(ziele) as Item[]).map((z) => {
          const anzahl = karten.filter((k) => zielVonKarte(k) === z.id).length
          return (
            <li key={z.id} className="flex items-center gap-2 py-2">
              <Input
                className="w-16 text-center font-mono"
                type="number"
                min={0}
                max={99}
                defaultValue={Number(z.data?.dots) || 0}
                title="Punkte"
                onBlur={(e) => void aendern(z.id, { data: { ...z.data, dots: Math.max(0, Number(e.target.value) || 0) } })}
              />
              <Input
                className="flex-1"
                defaultValue={String(z.data?.title ?? "")}
                onBlur={(e) => void aendern(z.id, { data: { ...z.data, title: e.target.value.trim() || "Ohne Titel" } })}
              />
              <Button
                size="sm"
                variant="ghost"
                title={anzahl ? `${anzahl} Karten mit löschen` : "löschen"}
                onClick={async () => {
                  if (!confirm(anzahl ? `Ziel und ${anzahl} Karten löschen?` : "Ziel löschen?")) return
                  for (const k of karten.filter((k) => zielVonKarte(k) === z.id)) await onKarteLoeschen(k.id)
                  await loeschen(z.id)
                }}
              >
                ×
              </Button>
            </li>
          )
        })}
      </ul>
      <Button
        onClick={() =>
          void anlegen({
            type: ZIEL_TYP,
            createdBy: TISCH.id,
            "@context": [VOCAB.BASE, VOCAB.PROJECT],
            data: { title: "Neues Ziel", dots: 0, order: Date.now() },
          })
        }
      >
        Ziel hinzufügen
      </Button>
    </div>
  )
}
