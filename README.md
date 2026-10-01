# Karabirrdt

Das Spielbrett aus dem Dragon Dreaming, als gemeinsame Web-App: Ziele als
Zeilen, die zwölf Stufen von Träumen bis Feiern als Spalten, Karten in den
Zellen und Fäden dazwischen. Alle, die dasselbe Brett offen haben, sehen
Änderungen sofort.

Es gibt die App zweimal: unter `/` die Fassung auf dem
[Real Life Stack](https://github.com/real-life-org/real-life-stack)
(React + Toolkit-Komponenten, Daten als Items und Relationen), unter `/alt`
die ursprüngliche Seite aus einer Datei. Beide zeigen dasselbe Brett.
Wie die Abbildung auf RLS aussieht, steht in
[`docs/rls-kompatibel.md`](docs/rls-kompatibel.md); die Regeln und die
Lesereihenfolge für alle, die hier bauen, in [`AGENTS.md`](AGENTS.md).

## Starten

```bash
npm install
npm run setup      # Abhängigkeiten der App (app/)
npm run build      # baut die App nach public/
npm start          # http://localhost:8124
```

Zum Entwickeln an der Oberfläche: `npm start` in einem Fenster,
`npm run dev:app` in einem zweiten (Vite mit Hot Reload, leitet `/api` und
`/ws` an den Server weiter).

Die Daten liegen in einer SQLite-Datei unter `data/karabirrdt.sqlite`
(Node 22 bringt SQLite mit, es gibt keine nativen Abhängigkeiten).

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` / `HOST` | `8124` / `0.0.0.0` | wo der Server hört |
| `KARABIRRDT_DB` | `data/karabirrdt.sqlite` | Pfad der Datenbank |

## Bretter

Ein Brett ist ein Space: Es wird oben links im Space-Menü gewechselt und
angelegt, und die Adresse folgt — `/` ist das Brett `haupt`, `/emil` das
Brett `emil`. Kleinbuchstaben, Ziffern und Bindestriche; die Adresse eines
neuen Bretts leitet sich aus seinem Namen ab.

## Aufbau

```text
server.mjs      HTTP + WebSocket, liefert public/ aus
speicher.mjs    SQLite: alte Tabellen (für /alt) und die RLS-Tabellen
modell.mjs      die Abbildung Brett ↔ RLS, die Regeln und die Geometrie
app/            Vite + React + @real-life-stack/*, baut nach public/
public/alt.html die ursprüngliche Seite, unverändert in Funktion
```

## Bedienung

- **Bewegen:** Das Brett scrollt in beide Richtungen; die Phasenleiste bleibt
  oben stehen, die Ziele scrollen waagerecht mit.
- **Karte anlegen:** Klick auf eine leere Zelle, oder der Plus-Knopf unten
  rechts (dann auch ein Ziel).
- **Karte öffnen:** Klick auf die Karte. Das Detail kommt aus dem Real Life
  Stack: wer kann oder lernt, „Braucht“, „Ermöglicht“, „Teil von“, Status,
  Aufwand, Kommentare. Bearbeiten und Löschen im ⋮-Menü.
- **Karte verschieben:** ziehen. Fäden dürfen dabei nie nach links laufen.
- **Faden ziehen:** Karte bearbeiten, bei „Braucht“ (was vorher fertig sein
  muss) oder „Ermöglicht“ (was danach kommt) eine Karte suchen oder „Im Modul
  wählen“ und die Karte auf dem Brett anklicken. Ein Faden nach links wird
  abgelehnt.
- **Wer:** „Kann ich“ und „Will lernen“ im Karten-Detail tragen dich ein.
  Wer du bist, wählst du rechts oben im Benutzermenü unter „Profil“ (je Brett,
  im Browser gemerkt). Andere trägst du beim Bearbeiten unter „Zugewiesen“
  ein; ein Tipp auf den Namen wechselt zwischen „kann“ und „lernt“.
  Mitglieder verwaltet das Space-Menü oben links.
- **Traum und Daten:** im Space-Menü oben links, „bearbeiten“, dann unter
  „Karabirrdt“ die Abschnitte „Traum“ und „Daten“.
- **Hell oder dunkel:** der Knopf rechts oben; ohne Wahl folgt die App dem
  System.
- **Prüfung:** Phasenabdeckung je Ziel, Karten ohne Namen, Karten ohne Fäden,
  Hebelpunkte, Summe der Stunden und Euro.
- **Daten:** JSON kopieren, als Datei speichern oder einfügen (ersetzt das
  Brett). Gilt dem offenen Brett.

Der Browser hält zusätzlich eine lokale Kopie, damit die Seite auch ohne
Server lesbar bleibt. Was ohne Verbindung geändert wird, bleibt lokal.

## Mit Docker

```bash
docker run -p 8124:8124 -v "$PWD/data":/data ghcr.io/antontranelis/karabirrdt:latest
```

`docker compose up` tut dasselbe, die `docker-compose.yml` liegt bei.

## Auf einem Server

`deploy/docker-compose.server.yml` ist die Vorlage für den Betrieb hinter
Traefik mit automatischem Zertifikat und Auto-Update über Watchtower. Die App
kennt keine Benutzer: wer die Adresse hat, liest und ändert das Brett. Eine
Basis-Anmeldung in Traefik davor ist deshalb nicht optional.

Der Server zieht das Abbild `latest`. Das entsteht nur aus einem
Versions-Tag, nicht aus einem Merge auf `main`; `main` baut `:main` zum
Ausprobieren. Ausrollen heißt also:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

Vorher die Datenbank auf dem Server sichern.

## API

| Aufruf | Wirkung |
|---|---|
| `GET /api/bretter` | Liste der Bretter |
| `GET /api/gruppen` | dieselben Bretter als RLS-Groups (für den Space-Switch) |
| `GET /api/b/<brett>/rls` | ganzes Brett als `group`, `items`, `relations` |
| `PUT` / `DELETE /api/b/<brett>/items/<id>` | Item setzen oder löschen |
| `PUT` / `DELETE /api/b/<brett>/relations/<id>` | RelationRecord setzen oder löschen |
| `PUT /api/b/<brett>/group` | Group (Merge-Patch auf `data`, `null` löscht) |
| `GET /api/b/<brett>/members` · `PUT` / `DELETE …/members/<id>` | Mitglieder des Spaces |
| `POST /api/b/<brett>/rls/import` | Brett ersetzen (altes **und** neues Format) |
| `DELETE /api/b/<brett>/rls` | Brett ganz entfernen (beide Formen) |
| `GET /api/b/<brett>` | ganzes Brett in der alten Form (`meta`, `goals`, `tasks`) |
| `PUT /api/b/<brett>/meta` | Name, Traumsatz, Horizont |
| `PUT` / `DELETE /api/b/<brett>/goals/<id>` | Ziel setzen oder löschen |
| `PUT` / `DELETE /api/b/<brett>/tasks/<id>` | Karte setzen oder löschen |
| `POST /api/b/<brett>/import` | Brett komplett ersetzen |
| `ws://…/ws/<brett>` | Änderungen live: `{type: item\|relation\|group\|reset, id, data}` — und für `/alt` weiterhin `meta\|goal\|task` |

Der erste Aufruf von `/rls` auf einem alten Brett übersetzt es einmalig:
Ziel → `project`-Item, Karte → `task`-Item, Abhängigkeit → RelationRecord.
Danach ist die RLS-Form die Wahrheit; die alten Endpunkte bedienen `/alt`.

Letzter Schreiber gewinnt. Ein Brett ist Kilobytes groß, Konflikte sind bei
einer Gruppe am Tisch praktisch keine.

## Nachmigration

Karten aus der alten Fassung tragen „Wer" als freie Kürzel. Die Zuordnung
Kürzel → Mitglied steht als Daten am Brett (`Group.data.initialen`), nicht im
Code. Sobald sie gesetzt ist, löst dieses Skript die Kürzel auf:

```bash
npm run nachmigration -- --brett real-life          # schreibt
npm run nachmigration -- --brett real-life --probe  # zeigt nur, was wäre
```

Es fasst nur die Zeile „Wer (noch ohne Mitglied): …" an; jeder andere
Notiztext bleibt stehen (ein Vermerk wie „vorgesehen für Holger" ist eine
Absicht, keine Zuweisung). Zweimal laufen ändert nichts. Der Server muss dabei
gestoppt sein oder das Skript bekommt mit `--db` eine eigene Datei.

## Umzug auf toolkit 0.3.0

Bretter aus der Zeit davor tragen Fäden als eigene Datensätze und „will
lernen“ als eigenes Prädikat. Dieses Skript zieht beides in die Form um, die
das Detail des Stacks liest (Fäden eingebettet an der Voraussetzung, „lernt“
als Rolle an der Zuweisung, „kann“ ausgeschrieben an jeder Zuweisung ohne
Rolle) und entfernt Aufwand 0 („nicht geschätzt“):

```bash
npm run umzug -- --probe                 # alle Bretter, zeigt nur, was wäre
npm run umzug                            # alle Bretter, schreibt
npm run umzug -- --brett real-life --db kopie.sqlite
```

Zweimal laufen ändert nichts. Der Server muss dabei gestoppt sein, und die neue
App muss danach laufen: Ein Browser mit der alten App schriebe Karten ohne ihre
Fäden zurück. Einzelheiten in [`docs/rls-kompatibel.md`](docs/rls-kompatibel.md).

## Tests

```bash
npm test           # Speicher, API, Datenmodell, Umzug (node --test),
                   # danach Register, Formular und Connector der App (Vitest)
npm run typecheck  # TypeScript der App
```

`npm test` prüft auch, dass `/` die gebaute App ausliefert — dafür muss
einmal `npm run build` gelaufen sein.
