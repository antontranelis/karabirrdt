import { useEffect, useState } from "react"
import { Button, Input } from "@real-life-stack/toolkit"
import { KENNUNG } from "../brett"

/** Jedes Brett hat eine eigene Adresse. Hier wechselt oder legt man eins an. */
export function BretterPanel({ brett }: { brett: string }) {
  const [name, setName] = useState(brett)
  const [liste, setListe] = useState<{ brett: string; geaendert?: string }[] | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/bretter")
      .then((r) => r.json())
      .then(setListe)
      .catch(() => setListe([]))
  }, [])

  const oeffne = () => {
    const n = name.trim().toLowerCase()
    if (!KENNUNG.test(n)) return setFehler("Nur Kleinbuchstaben, Ziffern und Bindestriche.")
    location.href = "/" + n
  }

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">Bretter</h2>
      <p className="text-sm text-muted-foreground">
        Jedes Brett hat eine eigene Adresse: <code>/name</code>. Kleinbuchstaben, Ziffern und Bindestriche.
      </p>
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && oeffne()} placeholder="z. B. real-life-2027" />
        <Button onClick={oeffne}>Öffnen</Button>
      </div>
      {fehler && <p className="text-sm text-destructive">{fehler}</p>}
      <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Vorhandene Bretter</h3>
      {liste === null ? (
        <p className="text-sm text-muted-foreground">lade …</p>
      ) : liste.length ? (
        <ul className="divide-y text-sm">
          {liste.map((b) => (
            <li key={b.brett} className="flex justify-between gap-2 py-1.5">
              <a href={"/" + b.brett} className="hover:underline">
                {b.brett}
              </a>
              <span className="text-muted-foreground">{(b.geaendert ?? "").slice(0, 10)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">noch keins gespeichert</p>
      )}
      <p className="text-xs text-muted-foreground">
        Die ursprüngliche Fassung derselben Bretter liegt unter <code>/alt</code>.
      </p>
    </div>
  )
}
