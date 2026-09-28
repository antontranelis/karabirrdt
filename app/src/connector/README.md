# Der Connector dieser App

```text
App (Toolkit-Komponenten + Hooks)
        │
        ▼
   DataInterface           ← die App kennt nur diesen Vertrag
        │
  ServerConnector          ← diese Datei: Proxy um den MockConnector
     ├── MockConnector     ← Gedächtnis im Browser, Beobachtbarkeit, Regeln
     └── fetch + WebSocket ← der Karabirrdt-Server (SQLite, ein Brett je Adresse)
```

Ein **Brett ist eine Group**: `/api/gruppen` listet alle Bretter als Groups,
der `WorkspaceSwitcher` wechselt zwischen ihnen, und die Adresse `/<brett>`
folgt dem Wechsel (`history.pushState`, „Zurück" hört mit). Beim Wechsel
werden die Items des anderen Bretts nachgeladen und die WebSocket umgehängt.

`server-connector.ts` ist **kein** eigener Connector von Grund auf, sondern
eine Schicht um `MockConnector`:

1. Beim Start liest er `GET /api/b/<brett>/rls` und macht daraus den Seed —
   Items, RelationRecords (als Items mit `type: "relation"`, Spec 08) und die
   Group.
2. Jede Schreibbewegung geht **erst** in den MockConnector (damit die
   Oberfläche sofort stimmt) und **dann** an den Server.
3. Nachrichten der anderen Clients kommen über die WebSocket und werden in
   den MockConnector gelegt. Die Oberfläche merkt davon nichts: sie hört
   ohnehin nur auf die Observables.
4. `setCurrentGroup` wechselt das Brett, `createGroup` legt eins an
   (`PUT /api/b/<kennung>/group`, Kennung aus dem Namen abgeleitet und gegen
   die vorhandenen geprüft), `deleteGroup` entfernt eins
   (`DELETE /api/b/<kennung>/rls`).

Beim **Anlegen** lädt die Seite auf dem neuen Brett neu, statt weich zu
wechseln: `MockConnector.createGroup` vergibt die Id selbst (`group-<zeit>`)
und nimmt keine mit, also lässt sich die Kennung des Servers nicht
durchreichen — Upstream-Lücke, siehe `docs/rls-kompatibel.md`.

Ein `Proxy` reicht alles durch, was nicht überschrieben ist. Dadurch erbt die
App jede Fähigkeit des MockConnectors — auch die, die erst später dazukommt —
ohne dass hier eine Liste gepflegt werden müsste, die lautlos veraltet.

## Gegen einen anderen Connector tauschen

Die Oberfläche redet ausschließlich über Hooks (`useItems`,
`useRelationRecords`, `useCreateItem`, …) mit dem Connector. Ein Tausch
berührt deshalb genau eine Datei, `src/main.tsx`:

```ts
// statt erstelleServerConnector(brett):
import { WotConnector } from "@real-life-stack/wot-connector"

const connector = new WotConnector({ /* … */ })
await connector.init()
connector.setCurrentGroup(spaceId)
```

Danach ist das Brett ein WoT-Space: verschlüsselt, mehrgerätefähig, ohne
diesen Server. Was dabei zu prüfen ist:

- **Fähigkeiten statt Annahmen.** Der ServerConnector meldet nur, was der
  Server kann: kein `groupScope` (Anlegen in einem anderen Brett, ohne es zu
  öffnen), kein `moveItemToGroup` (Verschieben zwischen Brettern), obwohl der
  MockConnector darunter beides hätte. Das Formular zeigt den Space darum
  fest. Genauso sollte jede neue Fläche vorgehen (`isWritable`, `hasGroups`, …).
- **Regeln des Bretts.** Ein Faden läuft nie nach links, nie im Kreis, nie auf
  sich selbst, und eine Karte gehört zu genau einem Ziel. `createItem` und
  `updateItem` lehnen jede Änderung ab, die einen neuen Verstoß brächte
  (`neuerRegelVerstoss` in `modell.mjs`), gleich ob sie aus dem Formular,
  einer Selbstaktion oder dem Brett kommt. Ein alter Verstoß blockiert nichts.
- **Nacheinander, ein Brett je Schreibbewegung.** Schreibbewegungen laufen in
  einer Schlange: jede prüft die Regeln gegen den Stand nach der vorigen und
  schreibt in das Brett, in dem sie begann; ein Brettwechsel wartet, bis die
  Schlange leer ist. Ein offenes Formular hält das Brett zusätzlich fest
  (`halteBrett`), weil der Composer nach dem Speichern noch an andere Karten
  schreibt („Braucht“); ein Wechsel in der Zeit geschieht danach.
- **Identität.** Dieser Connector kennt keine Anmeldung. Wer am Bildschirm
  sitzt, wählt sich im Benutzermenü („Wer bist du?“, `waehleIch`); gemerkt
  wird das je Brett im Browser und als `getCurrentUser` geliefert, und der
  MockConnector darunter schreibt und prüft Autorenrechte mit derselben
  Person. Ohne Wahl ist es `did:karabirrdt:tisch`. `allowFixtureAuthors: true` bleibt: Autor
  und Entstehungszeit kommen vom Server statt aus der Sitzung.
- **Ids.** Neue Items bekommen hier eine zufällige Id; der MockConnector zählte
  `item-100`, `item-101` … je Sitzung, und zwei Browser überschrieben einander.
- **Fäden sind eingebettet** (`blocks` an der Voraussetzung) und wandern mit
  der Karte. Die Ablage für RelationRecords bleibt für andere Prädikate.
- **Migration.** `GET /api/b/<brett>/rls` übersetzt ein altes Brett einmalig.
  Wer auf einen anderen Connector zieht, exportiert im Daten-Panel und
  importiert dort.
