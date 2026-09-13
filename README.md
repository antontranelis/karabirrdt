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

- **Bewegen:** Mausrad zoomt zum Zeiger, Ziehen auf leerer Fläche schwenkt,
  zwei Finger zoomen. Unten links: kleiner, größer, einpassen.
- **Karte anlegen:** Klick auf eine leere Zelle.
- **Karte verschieben:** ziehen. Fäden dürfen dabei nie nach links laufen.
- **Faden ziehen:** Karte öffnen, „Voraussetzung hinzufügen“, dann die Karte
  anklicken, die vorher fertig sein muss.
- **Wer:** Zuweisungen an Mitglieder des Spaces — „kann ich“ und „will lernen“.
  Mitglieder verwaltet das Space-Menü oben links.
- **Traum und Daten:** im Space-Menü oben links (Zahnrad neben dem Namen).
- **Prüfung:** Phasenabdeckung je Ziel, Karten ohne Namen, Karten ohne Fäden,
  Hebelpunkte, Summe der Stunden und Euro.
- **Daten:** JSON kopieren, als Datei speichern oder einfügen (ersetzt das Brett).

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

## Tests

```bash
npm test           # Speicher, API, Datenmodell (node --test)
npm run typecheck  # TypeScript der App
```

`npm test` prüft auch, dass `/` die gebaute App ausliefert — dafür muss
einmal `npm run build` gelaufen sein.
