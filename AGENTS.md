# AGENTS.md — Karabirrdt als RLS-kompatible App

Dieses Repo ist das erste externe Beispiel für eine App auf den veröffentlichten Paketen des [Real Life Stack](https://github.com/real-life-org/real-life-stack). Es ist bewusst standalone (eigener Server, SQLite, WebSocket) und trotzdem so gebaut, dass es später ohne Umbau des UI-Codes als Modul in den Stack wandern kann. Wer hier arbeitet, Mensch oder Agent, hält sich an die Regeln des Stacks, nicht an eigene.

## Zuerst lesen, in dieser Reihenfolge

1. [Anatomie eines Moduls](https://github.com/real-life-org/real-life-stack/blob/master/docs/anatomie-eines-moduls.md): welche Zone wem gehört, welcher Baustein sie füllt, die Abläufe anlegen, öffnen, löschen.
2. [01 App Composition](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/01-app-composition.md) und [Shared Module Components](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/modules/shared-components.md).
3. [Toolkit-Index](https://github.com/real-life-org/real-life-stack/blob/master/docs/toolkit-index.md) der installierten Version (siehe `app/package.json`, exakt gepinnt). Was dort nicht steht, existiert nicht.
4. [`docs/rls-kompatibel.md`](docs/rls-kompatibel.md) in diesem Repo: die Abbildung des Bretts auf Items und Relationen, die benutzten Bausteine, und jede gefundene Lücke mit Fundstelle.

Die Doku gilt in der Version, die installiert ist. Exporte gegen `app/node_modules/@real-life-stack/toolkit/dist` prüfen, nie gegen einen lokalen Checkout des Stack-Repos.

## Wie diese App zusammengesetzt ist

| Zone | Hier |
|---|---|
| Navbar | `Navbar` mit `WorkspaceSwitcher`, `ColorSchemeToggle` und `UserMenu` („Profil“ = Wahl „Wer bist du?“). Sonst nichts. |
| Space-Konfiguration | `GroupDialog` des Toolkits für Name und Mitglieder; Traumsatz und Horizont („Traum“) sowie JSON-Export und -Import („Daten“) als `appSections` (`app/src/panels/space-abschnitte.tsx`). Schreiben nur über `patchData`; die Group geht live an den Dialog (`liveModus`). |
| Modul-Kopf | `ModuleFrame fill="bleed" panelFit="inset"` unter einem `FilterScope`: Suche und Filter-Pille stellt die Fläche, `ModuleToolbar` trägt Traumhorizont und Prüfung (`trailingActions`); das Brett liest die Karten über `useModuleFilteredItems`. |
| Inhalt | eigenes Raster Ziele × zwölf Stufen (`app/src/board/`), Karten als `ItemPreview density="dense"` (106 px), Fäden als SVG-Overlay. Das ist die Fachlichkeit des Moduls. |
| Ecken | `FilterPill` unten links (von der Fläche), `CreateFab` unten rechts. Sonst nichts; Knöpfe der Fläche gehören in den Kopf. Das Brett lässt unten `--module-controls-block` frei. |
| Panel | `ItemDetailView` mit `ItemDetailRead`: alles aus dem Register (`app/src/register.ts`), ⋮-Menü mit Bearbeiten und Löschen. Kein eigenes Panel für Karte oder Ziel. |
| Formular | `ItemComposer` aus dem Register (`pickContentTypes`, `createComposerMapping`); die App belegt „Teil von“ aus der Zelle vor (`itemRelationDataKey`), ergänzt Stufe und Reihenfolge und gibt den Modul-Pick („Im Modul wählen“ → Klick aufs Brett). |

Datenmodell: Brett = Group, Ziel = Item `project` (`dots` als Zahl), Karte = Item `task` mit `stage`, Zeile über eingebettete Relation `partOf`, Faden = eingebettete Relation `blocks` an der Voraussetzung, Zuweisung `assignedTo` auf `global:<userId>` mit `meta.role` `can` oder `learns`. Alles in `modell.mjs`, ohne DOM, getestet. Die Register-Schicht in `app/src/register.ts` ergänzt die Toolkit-Typen additiv; umdefinieren darf sie nichts.

Connector: `app/src/connector/server-connector.ts` komponiert den `MockConnector` und reicht Schreibzugriffe an den Server weiter. Der Tausch gegen den WoT-Connector ist dort beschrieben.

## Regeln

- Kein Baustein wird neu gebaut, den das Toolkit hat. Vorher im Toolkit-Index und in der Reference-App nachsehen.
- Fehlt ein Baustein wirklich: nicht bauen. Fundstelle im Paket, fehlende Prop, Vorschlag, und die Lücke in `docs/rls-kompatibel.md` eintragen. Anton entscheidet, ob es ein Toolkit-PR oder ein weggelassenes Feld wird.
- Keine Erklärtexte, Legenden oder eigenen Kopfzeilen in Panels. Ein Karten-Detail sieht aus wie ein Task-Detail in der Reference-App.
- Server und Modell mit `node --test`, die App-Schicht (Register, Formular, Connector) mit Vitest unter jsdom; erst Test, dann Code. `npm test`, `npm run typecheck`, `npm run build` vor jedem Handoff.
- Sichtbare Änderungen im Browser prüfen (Server 8124, Vite 5174; eine Kopie der Datenbank per `KARABIRRDT_DB`) und gegen den Entwurf im Detail-Simulator vergleichen; nie gegen die Live-Datenbank.
- Kein Push auf `main` ohne Freigabe. Arbeit auf Branches, Pull Request, Beschreibung auf Deutsch.

## Was hier gelernt wurde

Der erste Bau wich an rund fünfzehn Stellen von der Spec ab, obwohl fast alles definiert war. Ursachen: ein veralteter lokaler Checkout des Stacks, Aufträge nach Funktionen statt nach Anatomie, und Eigenbauten statt gemeldeter Lücken. Die Liste der Korrekturen und Lücken steht in `docs/rls-kompatibel.md` und ist der Grund für die Anatomie-Seite im Stack.
