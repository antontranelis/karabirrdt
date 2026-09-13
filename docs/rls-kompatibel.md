# Karabirrdt auf dem Real Life Stack

Diese App gibt es zweimal: als ursprüngliche Vanilla-Seite (weiter erreichbar
unter `/alt`) und als RLS-App (`/`). Beide zeigen dasselbe Brett und benutzen
denselben Server. Der Sinn der zweiten Fassung: **sie kann später ohne Umbau
des UI-Codes als Modul im Real Life Stack laufen**, und sie ist ein lesbares
Beispiel „so baue ich eine RLS-kompatible App".

Gelesen und befolgt: [`docs/templates/AGENTS.md`](https://github.com/real-life-org/real-life-stack/blob/master/docs/templates/AGENTS.md),
Spec [06 Schema-Composition](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/06-schema-composition.md)
und [08 Relation Records](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/08-relation-records.md).

## Die Abbildung

| Karabirrdt | RLS | Felder |
|---|---|---|
| Brett | **Group** (Space) | `data: { name, dream, horizon, scope: "group", modules: ["karabirrdt"] }` |
| Ziel (Zeile) | **Item** `type: "project"`, `@context` + `project/v1` | `data: { title, dots, order }` |
| Karte (Zelle) | **Item** `type: "task"`, `@context` + `task/v1` | `data: { title, description, status, stage, who, hours, euros, order }` |
| Karte → Zeile | **eingebettete Relation** `partOf` → `item:<zielId>` | |
| Faden | **RelationRecord** `blocks`, `from` = Voraussetzung, `to` = abhängige Karte | |

Die ganze Abbildung steht in **einer** Datei, [`modell.mjs`](../modell.mjs) —
einfaches JavaScript ohne DOM, damit Server (Migration, Import) und App
(Anzeige, Regeln, Geometrie) buchstäblich dieselbe benutzen. Die Typen dazu
liegen daneben in `modell.d.mts`.

### Warum diese Entscheidungen

- **Ziel = `project`, nicht ein eigener Typ.** Ein Ziel aus dem Traumkreis ist
  ein Vorhaben mit Titel und Priorisierung; `project` ist der Core-Typ dafür.
  `dots` (Klebepunkte) und `order` sind App-Felder in `data` — `task/v1` und
  `project/v1` erlauben zusätzliche Felder.
- **Karte = `task`.** `status` trägt „erledigt, ausgemalt" (`done`) im Werte-
  raum von `task/v1`; `stage` (0–11) ist die Spalte des Karabirrdt. `stage`
  ist bewusst **nicht** `status`: der Kanban-Status beantwortet „wie weit",
  die Stufe „in welchem Schritt des Kreislaufs" — zwei Achsen.
- **Zeile als eingebettete Relation.** Spec 04, Regel 9 erlaubt eingebettete
  Relations für „wenige, feste Forward-Beziehungen, vom Autor des Items
  gesetzt". Genau das ist die Zeile: höchstens eine je Karte, gesetzt beim
  Anlegen oder Ziehen. Ein Fremdschlüssel `goalId` in `data` wäre ein
  zweiter Zeiger-Dialekt neben `item.relations[]` gewesen.
- **Faden als RelationRecord.** Fäden wachsen unbegrenzt mit der Nutzung und
  sind selbst Inhalt — nach Spec 08, Regel 9 also Records, keine eingebettete
  Liste. Das Prädikat `blocks` steht im Typ-Manifest der `TaskRelations`
  („Task blockiert andere Tasks"); die Richtung Voraussetzung → abhängige
  Karte ist genau die Faden-Richtung des Bretts.

## Welche Toolkit-Bausteine benutzt werden

| Baustein | wofür |
|---|---|
| `ConnectorProvider`, `AppShell`, `AppShellMain`, `Navbar` | Rahmen |
| `ItemPreview` (`density="compact"`, `footerAdornment`) | **jede** Karte auf dem Brett |
| `ItemComposer` + `ContentTypeConfig` + eigene `widgets` | Karte anlegen **und** bearbeiten — eine Form für beides |
| `ItemDetailPanel` | die geöffnete Karte, inklusive Diskussion |
| `AdaptivePanel` | eine Fläche für alle Panels (Karte, Ziele, Prüfung, Daten, Bretter) |
| `DeleteConfirmDialog` | Löschen in zwei Schritten |
| `EmptyState` | das leere Brett |
| `useItems`, `useRelationRecords`, `useCreateItem/useUpdateItem/useDeleteItem`, `useCurrentGroup`, `useUpdateGroup`, `useConnector` | alle Lese- und Schreibwege |
| `cn`, Tokens aus `styles/globals.css`, `Button`/`Input`/`Textarea` | Gestaltung |
| `hasRelationRecordWriter` (data-interface) | Fähigkeitsprüfung statt Annahme |

Nichts davon wurde geforkt oder umgestylt. Die vier Phasenfarben des Dragon
Dreaming sind eigene App-Tokens (`--kb-dream` …) in `app/src/index.css`, in
beiden Signalen (`prefers-color-scheme` **und** `.dark`/`[data-theme]`).

## Upstream-Lücken

Was gefehlt hat, mit konkretem Vorschlag. Nichts davon wurde durch einen Fork
umgangen.

1. **Keine Karte unterhalb von `compact`.** Die kleinste `ItemPreview` braucht
   rund 200×90 px. Das ursprüngliche Brett hatte 102×60-Zellen; die RLS-
   Fassung ist darum doppelt so breit (12 × 224 px). Für dichte Raster —
   Karabirrdt, Wochenkalender, Matrizen — fehlt eine dritte Dichte.
   *Vorschlag:* `density="tight"` in `ItemPreviewDensity`: nur Titel (2
   Zeilen, geklemmt) plus `footerAdornment`, kein Autor-Block, `p-1.5`,
   `text-[11px]`. Keine neue Komponente, eine neue Stufe der bestehenden Achse.
2. **Kein vorgesehener Weg „Task gehört zu Projekt".** `TaskRelations.forward`
   kennt `assignedTo` (Person), `childOf` (Eltern-**Task**), `blocks`,
   `relatedTo`. Ein Task in einem Projekt ist keins davon; `relatedTo` wäre
   bedeutungslos. Wir benutzen `partOf`, das Spec 08 in der Motivation und
   `docs/spec/netzwerk-app.md` bereits als Prädikat führt — im Typ-Manifest
   steht es aber nicht.
   *Vorschlag:* im `CORE_TYPE_MANIFEST` beim Typ `task` ergänzen:
   `{ predicate: "partOf", itemRole: "from", otherKind: "project" }`, dazu
   beim Typ `project` die Gegenrichtung `{ partOf, to, item }`.
3. **`who` passt in kein vorhandenes Feld.** Karabirrdt schreibt Initialen mit
   „kann ich" / „will ich lernen" — Menschen ohne Konto, mit einer Aussage
   über Können statt über Zuständigkeit. `assignedTo` verlangt Personen-Items
   bzw. DIDs, `ItemAssignees` verlangt aufgelöste `User`. `who` bleibt darum
   ein App-Feld in `data` und wird über `footerAdornment` gezeichnet.
   *Vorschlag:* keine Änderung am Kern nötig, aber ein Beispiel in der Spec,
   dass Beteiligung ohne Konto ein legitimer App-Fall ist — und langfristig
   ein `skillLevel`-Feld an `assignedTo`-Records („kann" / „lernt"), sobald
   Beteiligte echte Identitäten haben.
4. **Kein Composer-Widget für Zahlenpaare.** Stunden und Euro brauchten ein
   eigenes Widget (`aufwand`). Der vorgesehene Weg (`widgets`,
   `CustomWidgetDefinition`) funktioniert einwandfrei — es fehlt nur ein
   generisches `number`-Widget im Toolkit, das jede zweite App sonst neu baut.
   *Vorschlag:* `WidgetType` um `"number"` erweitern, konfiguriert über
   `widgetLabels` und eine Feldliste im `ContentTypeConfig`.
5. **`ContentComposer` kennt keine reine Ansicht.** `ItemDetailPanel` erwartet
   einen Inhalt; die Kanban-Lösung ist ein Composer im Bearbeiten-Modus. Für
   ein Brett, an dem mehrere gleichzeitig arbeiten, wäre ein Lesemodus mit
   „bearbeiten"-Knopf ruhiger.
   *Vorschlag:* `ItemDetailBody` ist genau das — in einer künftigen Fassung
   dieser App der bessere Inhalt des Panels.
6. **Kein Connector für „ein Server, viele Clients, keine Anmeldung".** Der
   Mock-Connector ist speicherflüchtig, der Local-Connector einsam, Supabase
   und WoT bringen Identität mit. Diese App braucht dazwischen einen
   geteilten Raum ohne Konten — deshalb `ServerConnector`.
   *Vorschlag:* das hier gezeigte Muster (MockConnector + Proxy + Transport)
   als `@real-life-stack/remote-connector` mit austauschbarem Transport.

## Was ein Vibe-Coder beim nächsten Mal wissen muss

- **Das Datenmodell zuerst.** Erst in RLS-Begriffen sagen, was die Dinge
  *sind* (Item-Typ, Felder, Relation), dann bauen. Ein eigenes Modell daneben
  rächt sich beim ersten Modul, das es auch lesen soll.
- **Eine Datei für die Abbildung.** `modell.mjs` wird von Server und App
  benutzt und ist mit `node --test` prüfbar, ohne Browser. Regeln („Fäden nur
  nach rechts") und Geometrie gehören dort hin, nicht in eine Komponente.
- **Karten immer aus `ItemPreview`.** Die eigene Karte ist schneller
  geschrieben und altert sofort. Was fehlt, kommt über die drei Schlitze
  (`headerAdornment`, `metaAdornment`, `footerAdornment`).
- **Eine Form für Anlegen und Bearbeiten.** `ItemComposer` mit und ohne
  `existingItem` — nicht zwei Formulare, die auseinanderlaufen.
- **Eigene Felder über `widgets`**, nicht über einen geänderten Composer.
- **Fähigkeiten prüfen, nicht annehmen** (`hasRelationRecordWriter` &co.).
  Dann läuft dieselbe Oberfläche auf einem Connector, der weniger kann.
- **Tailwind braucht die Toolkit-Quellen.** Das npm-Paket liefert nur `dist`;
  ohne `@source ".../toolkit/dist/**/*.js"` in der eigenen CSS fehlen alle
  Toolkit-Klassen und die App sieht unformatiert aus. Das ist die Falle, die
  am meisten Zeit kostet.
- **Eine Autor-Kennung.** Die Id eines RelationRecords leitet sich aus
  `(createdBy, predicate, from, to)` ab. Wer an zwei Stellen zwei Kennungen
  benutzt (Server-Migration und App), bekommt zwei Datensätze für dieselbe
  Kante. Darum steht `AUTOR` in `modell.mjs` und sonst nirgends.
- **Genau pinnen.** `0.x` bewegt sich: toolkit `0.1.6`, data-interface `0.1.4`,
  mock-connector `0.1.4`, exakt ohne `^`.

## Offene Punkte

- Die Oberfläche ist **nicht im Browser geprüft** worden (in dieser Umgebung
  war keiner verfügbar). Geprüft sind: Datenmodell und Server über
  `node --test`, Typen über `tsc --noEmit`, Bau über `vite build`, die
  Auslieferung über `curl`. Ein Blick auf Raster, Fäden und Panel steht aus.
- Die Bündelgröße liegt bei rund 1,2 MB (409 kB gzip) — das Toolkit bringt
  Editor, Karten- und Graph-Bausteine mit, von denen diese App wenig braucht.
  Aufteilen lohnt erst, wenn die App öffentlich läuft.
