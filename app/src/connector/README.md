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

- **Fähigkeiten statt Annahmen.** `useFaeden()` fragt
  `hasRelationRecordWriter()`; kann ein Connector keine RelationRecords,
  bietet die Oberfläche das Fädenziehen gar nicht erst an. Genauso sollte
  jede neue Fläche vorgehen (`isWritable`, `hasGroups`, …).
- **Identität.** Dieser Connector kennt keine Anmeldung: alle sind
  `did:karabirrdt:tisch`, wer die Adresse hat, schreibt. Das ist auch der
  Grund für `allowFixtureAuthors: true` — Autor und Entstehungszeit kommen
  vom Server statt aus der Sitzung. Ein Connector mit echten Identitäten
  braucht das nicht; dort trägt jede Karte, wer sie geschrieben hat, und die
  `author`-Zeile der `ItemPreview` kann sichtbar werden (hier steht sie auf
  `null`, weil „am Tisch" keine Aussage ist).
- **Kennungen der Fäden.** RelationRecord-Ids leiten sich aus
  `(createdBy, predicate, from, to)` ab (Spec 08, Regel 4). Mit einer
  gemeinsamen Kennung konvergieren zwei gleichzeitig gezogene Fäden auf
  denselben Datensatz; mit echten Identitäten entstehen zwei Records über
  dieselben Endpunkte — das ist Absicht (perspektivischer Graph), die
  Faden-Anzeige muss dann entdoppeln.
- **Migration.** `GET /api/b/<brett>/rls` übersetzt ein altes Brett einmalig.
  Wer auf einen anderen Connector zieht, exportiert im Daten-Panel und
  importiert dort.
