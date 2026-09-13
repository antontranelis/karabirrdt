# Karabirrdt auf dem Real Life Stack

Diese App gibt es zweimal: als ursprüngliche Vanilla-Seite (weiter erreichbar
unter `/alt`) und als RLS-App (`/`). Beide zeigen dasselbe Brett und benutzen
denselben Server. Der Sinn der zweiten Fassung: **sie kann später ohne Umbau
des UI-Codes als Modul im Real Life Stack laufen**, und sie ist ein lesbares
Beispiel „so baue ich eine RLS-kompatible App".

Gelesen und befolgt: [`docs/templates/AGENTS.md`](https://github.com/real-life-org/real-life-stack/blob/master/docs/templates/AGENTS.md),
Spec [06 Schema-Composition](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/06-schema-composition.md)
und [08 Relation Records](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/08-relation-records.md).

**Was zuerst hätte gelesen werden müssen** und beim ersten Bau fehlte:
[01 App Composition](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/01-app-composition.md)
(Modulfläche mit Kopf, Filter-Pille, Erstellen-Knopf, Panel-Ebenen) und
[Shared Module Components](https://github.com/real-life-org/real-life-stack/blob/master/docs/spec/modules/shared-components.md)
(`ItemDetailView`: erst lesen, Löschen im Menü). Rund fünfzehn Korrekturen in
fünf Runden gingen darauf zurück, dazu ein 41 Commits alter lokaler Checkout
des Stacks. Daraus ist die Seite
[Anatomie eines Moduls](https://github.com/real-life-org/real-life-stack/blob/master/docs/anatomie-eines-moduls.md)
im Stack entstanden; die Lesereihenfolge steht in [`AGENTS.md`](../AGENTS.md).

## Die Abbildung

| Karabirrdt | RLS | Felder |
|---|---|---|
| Brett | **Group** (Space) | `data: { name, dream, horizon, scope: "group", modules: ["karabirrdt"] }` |
| Ziel (Zeile) | **Item** `type: "project"`, `@context` + `project/v1` | `data: { title, dots, order }` |
| Karte (Zelle) | **Item** `type: "task"`, `@context` + `task/v1` | `data: { title, description, status, stage, hours, euros, order }` |
| „kann ich" | **eingebettete Relation** `assignedTo` → `global:<userId>` | die normale Task-Zuweisung aus `TaskRelations.forward` |
| „will lernen" | **eingebettete Relation** `wantsToLearn` → `global:<userId>` | zweites Zuweisungsprädikat, siehe Lücke 11 |
| Mitglied | **User** des Spaces (`{id: "user:anton", displayName}`) | eigene Tabelle je Brett, `GET/PUT/DELETE /members` |
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
| `WorkspaceSwitcher` + `GroupDialog` | Bretter wechseln, anlegen, umbenennen, löschen, Mitglieder — ein Brett **ist** ein Space |
| `CreateFab` | der Plus-Knopf unten rechts; die Typ-Auswahl macht der `ItemComposer` selbst |
| `people`-Widget des Composers | „kann ich" (`assignedTo`) **und** „will lernen" (`wantsToLearn`) — dasselbe Feld, zwei Vorlagen |
| `ItemAssignees` | die Gesichter auf der Karte, für beide Zuweisungen |
| `UserMenu` | rechts in der Navbar, wie in der Reference-App |
| `ModuleFrame` (`fill="bleed"`) | die Modulfläche: Kopf im Fluss darüber, das Brett füllt den Rest |
| `ModuleToolbar` + `FilterScope` + `useModuleFilteredItems` | Kopf des Moduls: Suche, Tag-Filter, Modul-Aktionen, Verbindungsstand |
| `ModuleControls` | schwebende Ecke unten links: kleiner / größer / einpassen |
| `ItemPreview` + `ItemAssignees` + `ItemCommentCount` | **jede** Karte auf dem Brett — dieselben Aufrufe wie `KanbanBoard` |
| `ItemComposer` + `ContentTypeConfig` + eigene `widgets` | Karte anlegen **und** bearbeiten — eine Form für beides |
| `ItemDetailView` + `ItemDetailBody` + `ItemDetailActions` | die geöffnete Karte und das geöffnete Ziel: Lesen ↔ Bearbeiten, ⋮-Menü mit Bearbeiten und Löschen, Diskussion |
| `AdaptivePanel` (`allowedModes: ["floating","sidebar","drawer"]`) | die schwebende Detail-Karte; auf schmalen Schirmen der Drawer |
| `DeleteConfirmDialog` | Löschen in zwei Schritten |
| `EmptyState` | das leere Brett |
| `useItems`, `useRelationRecords`, `useCreateItem/useUpdateItem/useDeleteItem`, `useCurrentGroup`, `useUpdateGroup`, `useConnector` | alle Lese- und Schreibwege |
| `cn`, Tokens aus `styles/globals.css`, `Button`/`Input`/`Textarea` | Gestaltung |
| `hasRelationRecordWriter` (data-interface) | Fähigkeitsprüfung statt Annahme |

Nichts davon wurde geforkt oder umgestylt. Die vier Phasenfarben des Dragon
Dreaming sind eigene App-Tokens (`--kb-dream` …) in `app/src/index.css`, in
beiden Signalen (`prefers-color-scheme` **und** `.dark`/`[data-theme]`).

## Upstream-Lücken

**0. ✅ BEHOBEN (toolkit 0.1.7, data-interface 0.2.0, mock-connector 0.1.5).**
Die Pakete trugen in `exports` eine `development`-Bedingung, die auf
`./src/index.ts` zeigte; `src` lag aber nicht im Paket, und Vite wählte im
Dev-Modus genau diese Bedingung („Failed to resolve entry for package
@real-life-stack/toolkit"). Die veröffentlichten `exports` haben sie jetzt
nicht mehr — nur noch `types` und `import`. Die Sonderregel
`resolve.conditions` in `app/vite.config.ts` ist entfernt, `npm run dev`
läuft ohne sie.

Was gefehlt hat, mit konkretem Vorschlag. Nichts davon wurde durch einen Fork
umgangen.

1. **Die Punkte eines Ziels haben keinen Platz auf der Karte.** Seit die
   Karten exakt wie im Kanban gezeichnet werden (`ItemPreview` mit
   `footerAdornment` aus `ItemAssignees`/`ItemCommentCount`), fehlen die
   Klebepunkte auf dem Zeilenkopf — sie sortieren die Zeilen, sind aber
   unsichtbar. Der vorgesehene Ort wäre der `preview`-Slot der
   Type-Presentation von `project`; den besetzt aber schon der Kern, und ein
   zweiter Eintrag für dieselbe Id ist nach Spec 06 ein Konflikt.
   *Offene Entscheidung:* Toolkit-PR (Punkte in `ItemProjectMeta`) oder Punkte
   nur im Ziel-Detail lassen.
3. **Keine Karte unterhalb von `compact`.** Die kleinste `ItemPreview` braucht
   rund 200×90 px. Das ursprüngliche Brett hatte 102×60-Zellen; die RLS-
   Fassung ist darum doppelt so breit (12 × 224 px). Für dichte Raster —
   Karabirrdt, Wochenkalender, Matrizen — fehlt eine dritte Dichte.
   *Vorschlag:* `density="tight"` in `ItemPreviewDensity`: nur Titel (2
   Zeilen, geklemmt) plus `footerAdornment`, kein Autor-Block, `p-1.5`,
   `text-[11px]`. Keine neue Komponente, eine neue Stufe der bestehenden Achse.
3. **Kein vorgesehener Weg „Task gehört zu Projekt".** `TaskRelations.forward`
   kennt `assignedTo` (Person), `childOf` (Eltern-**Task**), `blocks`,
   `relatedTo`. Ein Task in einem Projekt ist keins davon; `relatedTo` wäre
   bedeutungslos. Wir benutzen `partOf`, das Spec 08 in der Motivation und
   `docs/spec/netzwerk-app.md` bereits als Prädikat führt — im Typ-Manifest
   steht es aber nicht.
   *Vorschlag:* im `CORE_TYPE_MANIFEST` beim Typ `task` ergänzen:
   `{ predicate: "partOf", itemRole: "from", otherKind: "project" }`, dazu
   beim Typ `project` die Gegenrichtung `{ partOf, to, item }`.
4. **`who` passt in kein vorhandenes Feld.** Karabirrdt schreibt Initialen mit
   „kann ich" / „will ich lernen" — Menschen ohne Konto, mit einer Aussage
   über Können statt über Zuständigkeit. `assignedTo` verlangt Personen-Items
   bzw. DIDs, `ItemAssignees` verlangt aufgelöste `User`. `who` bleibt darum
   ein App-Feld in `data` und wird über `footerAdornment` gezeichnet.
   *Vorschlag:* keine Änderung am Kern nötig, aber ein Beispiel in der Spec,
   dass Beteiligung ohne Konto ein legitimer App-Fall ist — und langfristig
   ein `skillLevel`-Feld an `assignedTo`-Records („kann" / „lernt"), sobald
   Beteiligte echte Identitäten haben.
5. **Kein Composer-Widget für Zahlenpaare.** Stunden und Euro brauchten ein
   eigenes Widget (`aufwand`). Der vorgesehene Weg (`widgets`,
   `CustomWidgetDefinition`) funktioniert einwandfrei — es fehlt nur ein
   generisches `number`-Widget im Toolkit, das jede zweite App sonst neu baut.
   *Vorschlag:* `WidgetType` um `"number"` erweitern, konfiguriert über
   `widgetLabels` und eine Feldliste im `ContentTypeConfig`.
6. **`ContentComposer` kennt keine reine Ansicht.** `ItemDetailPanel` erwartet
   einen Inhalt; die Kanban-Lösung ist ein Composer im Bearbeiten-Modus. Für
   ein Brett, an dem mehrere gleichzeitig arbeiten, wäre ein Lesemodus mit
   „bearbeiten"-Knopf ruhiger.
   *Vorschlag:* `ItemDetailBody` ist genau das — in einer künftigen Fassung
   dieser App der bessere Inhalt des Panels.
7. **Die Graph-Kamera ist exportiert, passt aber nicht auf eine Fläche mit
   Rändern (teilweise behoben, toolkit 0.1.7).** `GraphCamera`, `fitCamera`,
   `focusCamera` und `interpolateCamera` kommen jetzt aus
   `components/graph/index` — der Export, der vorher fehlte, ist da. Für unser
   Einpassen taugt `fitCamera` trotzdem nicht, und zwar aus drei Gründen, die
   in seiner Rechnung stehen (Bundle `index-CYotuxXr.js`, Funktion `uX`):
   es fasst eine **Punktwolke** zusammen statt eines Rechtecks bekannter
   Größe, es polstert mit einem **festen Faktor 0.82** auf allen vier Seiten,
   und es klemmt den Zoom auf `0.08…1.6` bei einer Mindestausdehnung von 120.
   Wir brauchen **seitenweise Ränder** (oben die schwebende Kopfzeile, unten
   die Ecke mit Filter-Pille und Kamera-Knöpfen, beide am DOM gemessen) und
   die Regel „nie über 1 vergrößern". Die Umrechnung Mitte ↔ Ursprung wäre
   trivial; die Polster- und Klemm-Regeln sind es nicht.
   *Vorschlag:* `fitCamera(rect, viewport, insets?)` — ein Rechteck statt
   einer Punktwolke, Ränder je Seite statt eines festen Faktors, Zoomgrenzen
   als Parameter. Dann fällt unsere Kamera-Rechnung weg.
8. **`GroupManager.createGroup` vergibt die Id selbst.** `MockConnector`
   schreibt `group-<zeit>` und nimmt keine Id entgegen. Ein Connector, der
   den MockConnector benutzt (siehe Lücke 9) kann eine vom Server oder von
   der Spec bestimmte Id also nicht durchreichen; wir laden beim Anlegen
   eines Bretts deshalb die Seite neu. `ItemWriter.createItem` akzeptiert
   eine Client-Id längst — Spec 08 Regel 4 verlangt sie für RelationRecords
   sogar —, Groups können das nicht.
   *Vorschlag:* `createGroup(name, data?, options?: { id?: string })`, und im
   Mock-Connector die übergebene Id übernehmen statt zu erfinden.
9. **`ModuleToolbar` wirft ohne Filter-Kontext.** `useSharedFilter` verlangt
   einen `<FilterProvider>`; die Leiste selbst bringt keinen mit. Der Ausweg
   heißt `FilterScope` (setzt einen, wenn keiner da ist) und steht in keiner
   Typ-Signatur — man findet ihn nur im Quelltext.
   *Vorschlag:* `ModuleToolbar` intern in `FilterScope` wickeln; ein Kopf, der
   ohne unsichtbare Umgebung abstürzt, ist kein Baustein, sondern eine Falle.
10. **Die schwebende Ecke unten links hat nur einen Platz.** `ModuleFrame`
   rendert dort die Filter-Pille; `ModuleControls` legt eine zweite
   `PanelSafeArea` darüber — wer beides benutzt, stapelt seine Knöpfe auf die
   Pille. Wir weichen mit `className="justify-end"` in die rechte Ecke aus.
   *Vorschlag:* `ModuleControls` eine Seite mitgeben (`side="start" | "end"`,
   Vorgabe `start`) und im Frame beides in EINE Zeile legen, damit sich zwei
   Beiträge nebeneinander setzen statt übereinander. Außerdem fehlt eine
   Angabe, wieviel Platz die Ecke belegt — das Einpassen einer Fläche muss
   das heute schätzen (`SCHWEBEND` in `App.tsx`).
11. **✅ BEHOBEN (toolkit 0.1.7).** Ein Typ kann jetzt MEHRERE Personenfelder
   führen: `ContentTypeConfig.peopleRelations: readonly { predicate, label,
   dataKey? }[]`, dazu die Helfer `resolvePeopleFields`,
   `peopleRelationsFromWidgetData` und `peopleRelationsToWidgetData` aus
   `components/composer`. Die Karten-Vorlage deklariert damit
   `{ assignedTo, "Kann ich" }` und `{ wantsToLearn, "Will lernen" }`; beide
   Felder rendern dasselbe `people`-Widget im **selben** Composer, in Anlegen
   wie in Bearbeiten. Der Umweg über einen zweiten `ItemComposer` mit
   `liveUpdate` ist ersatzlos entfernt.
   Offen bleibt nur das Typ-Manifest: `wantsToLearn` steht weiterhin nicht als
   Affordance beim Typ `task`. *Vorschlag:*
   `{ predicate: "wantsToLearn", itemRole: "from", otherKind: "person" }`
   im `CORE_TYPE_MANIFEST`.
12. **Der MockConnector nimmt nach dem Seed keine Menschen mehr auf.**
   `users` ist privat, `inviteMember(groupId, userId)` kennt nur Kennungen,
   und `injectSeedItems` gilt nur für Items. Ein Connector, der ihn benutzt,
   kann Mitglieder eines nachgeladenen Spaces also nicht hineinreichen —
   unsere Schicht führt die Mitgliederliste darum selbst und beantwortet
   `getMembers`/`observeMembers`/`getUser` direkt.
   *Vorschlag:* `injectSeedUsers(users, groupId)` analog zu `injectSeedItems`,
   oder `inviteMember(groupId, user: string | User)`.
13. **Die Space-Konfiguration hat keinen Platz für mehr.** `GroupDialog` nimmt
   keine zusätzlichen Abschnitte und `WorkspaceSwitcher` keinen zweiten
   Menüpunkt je Space. Traum, Traumhorizont und der JSON-Austausch gehören
   zum Space und mussten darum in einen eigenen Dialog neben das Space-Menü.
   *Vorschlag:* ein `sections`-Slot im `GroupDialog` (oder Tabs, in die eine
   App eigene Abschnitte hängt) und ein `actions`-Slot je Space-Eintrag im
   Switcher.
14. **Kein Baustein für Flächen-Bedienelemente oben rechts.** Gesucht in
   0.1.6 nach `ModuleMenu`, `MapControls`, `ZoomControls`, `LocateButton` —
   nichts davon existiert; `components/map/index.d.ts` exportiert nur die
   Adapter-Typen, `LocationPickProvider`, `MapView` und die Marker, und
   `ModuleControls` ist ausdrücklich die Ecke UNTEN LINKS („Heimat der
   Filter-Pille"). Der einzige vorgesehene Ort für Modul-Aktionen ist
   `ModuleToolbar.trailingActions`; dort stehen unsere Kamera-Knöpfe.
   *Vorschlag:* den Baustein, den die Karte für Zoom und Ortung benutzt
   (rls#321/#324), exportieren — dann teilen sich Karte, Graph und Karabirrdt
   dieselben Knöpfe an derselben Stelle.
15. **Kein Ort für den Verbindungsstand außerhalb der Kontakte.** Das Toolkit
   hat `RelayStatusBadge` (`components/contacts/relay-status-badge.d.ts`) und
   den Hook `useRelayStatus`; die Reference-App rendert das Abzeichen in
   `NavbarEnd`, wenn `hasMessaging(connector)` wahr ist. Unser Connector hat
   keine `MessagingCapable`-Fähigkeit, also gibt es dafür keinen Platz — die
   Anzeige ist entfernt und nicht ersetzt.
16. **Kein Connector für „ein Server, viele Clients, keine Anmeldung".** Der
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
- **`panelFit="overlay"` nur, wenn die Fläche den Kopf verträgt.** Karte und
  Graph vertragen einen schwebenden Kopf, weil unter ihm nur Landschaft liegt.
  Ein Raster mit Spaltenköpfen verträgt ihn nicht: Text lag über Text. Die
  Vorgabe (`panelFit: "inset"`) setzt den Kopf in den Fluss, mit eigenem
  Grund — das ist hier die richtige Wahl. Und was danach noch schwebt
  (Filter-Pille, Kamera-Knöpfe), muss das Einpassen als Rand abziehen, sonst
  legt es Karten darunter.
- **Module-Kopfzeilen gehören dem Toolkit.** In die Navbar kommt nur, was für
  die ganze App gilt (Space-Switch, Benutzer). Alles Modul-eigene —
  Aktionen, Suche, Filter, Verbindungsstand — geht über `ModuleToolbar` in
  den Kopf der Modulfläche, die Kamera-Knöpfe über `ModuleControls` in die
  schwebende Ecke. Eine Modul-Schaltfläche in der Navbar ist der sicherste
  Weg, eine App zu bauen, die nie ein zweites Modul verträgt.
- **Ein Space ist ein Brett.** Was in der App „Raum", „Board", „Projekt"
  heißt, ist im Stack eine Group. Dann erledigen `WorkspaceSwitcher` und
  `GroupDialog` Wechseln, Anlegen, Umbenennen und Löschen, ohne dass die App
  eine eigene Verwaltung baut — die wir in Runde 1 noch hatte.
- **`floating` ist die Detail-Karte.** `AdaptivePanel` heißt per Vorgabe
  `["modal","sidebar","drawer"]` — dann steht das Detail als flache Spalte am
  Fensterrand. Die schwebende Karte, die der Stack überall zeigt, ist der
  vierte Modus `floating`, und `resolveAdaptivePanelMode` wählt ihn auf
  breiten Schirmen vor `sidebar`. Er muss ausdrücklich erlaubt werden.
- **Lesen zuerst, Bearbeiten auf Wunsch.** `ItemDetailView` besitzt den
  Wechsel, das ⋮-Menü und den Lösch-Dialog. Eine App, die gleich den Composer
  aufmacht, verliert die Leseansicht und baut sich ihre eigenen Knöpfe
  („Erledigt", „Löschen") daneben — genau das hatten wir.
- **Core-Typen präsentieren sich selbst.** `registerTypePresentation` haben
  wir NICHT benutzt: `project` und `task` sind Core-Typen, ihre Darstellung
  liefert das Toolkit mit, und ein zweiter Eintrag für dieselbe Id ist nach
  Spec 06 ein Konflikt (kein Override in v0.1). Die Regel „der Typ
  entscheidet" gilt also schon, ohne dass die App etwas registriert.
- **Eine Autor-Kennung.** Die Id eines RelationRecords leitet sich aus
  `(createdBy, predicate, from, to)` ab. Wer an zwei Stellen zwei Kennungen
  benutzt (Server-Migration und App), bekommt zwei Datensätze für dieselbe
  Kante. Darum steht `AUTOR` in `modell.mjs` und sonst nirgends.
- **Genau pinnen.** `0.x` bewegt sich: toolkit `0.1.6`, data-interface `0.1.4`,
  mock-connector `0.1.4`, exakt ohne `^`.

## Offene Punkte

- Die Oberfläche ist **nicht in einem echten Browser geprüft** worden (in
  dieser Umgebung ist keiner verfügbar). Geprüft sind: Datenmodell, Kamera und
  Server über `node --test`, Typen über `tsc --noEmit`, Bau über `vite build`,
  die Auslieferung über `curl` — und eine Rauchprobe, die das gebaute Bündel
  unter jsdom startet und Navbar, Brett, Fäden, die vier Panels, das
  Space-Menü, das Kartendetail und den Rad-Zoom anfasst. Was sie nicht sieht,
  ist, wie es aussieht: Abstände, Überlappungen, Lesbarkeit der Karten im
  eingepassten Zoom.
- Die Bündelgröße liegt bei rund 1,2 MB (409 kB gzip) — das Toolkit bringt
  Editor, Karten- und Graph-Bausteine mit, von denen diese App wenig braucht.
  Aufteilen lohnt erst, wenn die App öffentlich läuft.
