# Karabirrdt

Das Spielbrett aus dem Dragon Dreaming, als gemeinsame Web-App: Ziele als
Zeilen, die zwölf Stufen von Träumen bis Feiern als Spalten, Karten in den
Zellen und Fäden dazwischen. Alle, die dasselbe Brett offen haben, sehen
Änderungen sofort.

## Starten

```bash
npm install
npm start          # http://localhost:8124
```

Die Daten liegen in einer SQLite-Datei unter `data/karabirrdt.sqlite`
(Node 22 bringt SQLite mit, es gibt keine nativen Abhängigkeiten).

| Variable | Standard | Bedeutung |
|---|---|---|
| `PORT` / `HOST` | `8124` / `0.0.0.0` | wo der Server hört |
| `KARABIRRDT_DB` | `data/karabirrdt.sqlite` | Pfad der Datenbank |

## Bretter

Jedes Brett hat eine eigene Adresse: `/` ist das Brett `haupt`, `/emil` das
Brett `emil`. Kleinbuchstaben, Ziffern und Bindestriche. Über den Knopf
„Brett“ in der Kopfzeile wechselt man oder legt ein neues an.

## Bedienung

- **Karte anlegen:** Klick auf eine leere Zelle.
- **Karte verschieben:** ziehen. Fäden dürfen dabei nie nach links laufen.
- **Faden ziehen:** Karte öffnen, „Voraussetzung hinzufügen“, dann die Karte
  anklicken, die vorher fertig sein muss.
- **Wer:** Initialen mit „kann ich“ (gefüllt) oder „will ich lernen“ (umrandet).
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
| `GET /api/b/<brett>` | ganzes Brett (`meta`, `goals`, `tasks`) |
| `PUT /api/b/<brett>/meta` | Name, Traumsatz, Horizont |
| `PUT` / `DELETE /api/b/<brett>/goals/<id>` | Ziel setzen oder löschen |
| `PUT` / `DELETE /api/b/<brett>/tasks/<id>` | Karte setzen oder löschen |
| `POST /api/b/<brett>/import` | Brett komplett ersetzen |
| `ws://…/ws/<brett>` | Änderungen live: `{type: meta\|goal\|task\|reset, id, data}` |

Letzter Schreiber gewinnt. Ein Brett ist Kilobytes groß, Konflikte sind bei
einer Gruppe am Tisch praktisch keine.

## Tests

```bash
npm test
```
