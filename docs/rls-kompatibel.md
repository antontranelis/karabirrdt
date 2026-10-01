# Karabirrdt auf dem Real Life Stack

Diese App gibt es zweimal: als ursprüngliche Vanilla-Seite (unter `/alt`, zum
Wechsel eingefroren und nur lesend) und als RLS-App (`/`) auf dem
Supabase-Connector des Stacks. Der Sinn der zweiten Fassung: **sie kann später ohne Umbau
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

Stand: toolkit 0.4.0, data-interface 0.4.0, supabase-connector 0.3.2
(exakt gepinnt; der mock-connector 0.2.3 nur noch für die Tests; data-interface ist seit toolkit 0.4.0 nicht mehr im Toolkit
gebündelt, sondern dessen Abhängigkeit). Seit toolkit 0.3.0 kommen Karten- und Ziel-Detail samt Formular aus
dem **Register des Stacks** (Spec 06, Feld- und Kantenregister); die App
liefert nur noch eine Register-Schicht dazu (`app/src/register.ts`).

| Karabirrdt | RLS | Felder |
|---|---|---|
| Brett | **Group** (Space) | `data: { slug, dream, horizon, scope: "group", modules: ["karabirrdt"] }`; Adresse `/<slug>` |
| Ziel (Zeile) | **Item** `type: "project"`, `@context` + `project/v1` | `data: { title, description, dots, order }` |
| Karte (Zelle) | **Item** `type: "task"`, `@context` + `task/v1` | `data: { title, description, status, stage, hours, euros, order }` |
| „kann" | **eingebettete Relation** `assignedTo` → `global:<userId>`, `meta.role: "can"` | ohne `role` gilt ebenfalls „kann" |
| „lernt" | **eingebettete Relation** `assignedTo` → `global:<userId>`, `meta.role: "learns"` | früher eigenes Prädikat `wantsToLearn`, `npm run umzug` zieht um |
| Mitglied | **User** des Spaces: ein Konto auf der Supabase-Instanz (anonym oder E-Mail) | Mitgliedschaft im Space (`group_members`), Name aus dem Profil |
| Kürzel eines Mitglieds | `Group.data.initialen: { AT: "user:anton", … }` | gewachsene Kürzel des Teams, als Daten am Space statt im Code |
| Karte → Zeile | **eingebettete Relation** `partOf` → `item:<zielId>` | im Detail „Teil von" |
| Faden | **eingebettete Relation** `blocks` an der Voraussetzung → `item:<abhängige Karte>` | im Detail „Ermöglicht" (an der Voraussetzung) und „Braucht" (an der abhängigen Karte); früher RelationRecord, `npm run umzug` zieht um |

Die ganze Abbildung steht in **einer** Datei, [`modell.mjs`](../modell.mjs) —
einfaches JavaScript ohne DOM, damit Server (Migration, Import) und App
(Anzeige, Regeln, Geometrie) buchstäblich dieselbe benutzen. Die Typen dazu
liegen daneben in `modell.d.mts`.

### Warum diese Entscheidungen

- **Ziel = `project`, nicht ein eigener Typ.** Ein Ziel aus dem Traumkreis ist
  ein Vorhaben mit Titel und Priorisierung; `project` ist der Toolkit-Typ
  dafür. Die Klebepunkte bleiben eine Zahl (`dots`, B7 `number`, „Punkte");
  eine Priorität Hoch · Mittel · Niedrig ist verworfen (Anton, 28.09.;
  Katalog 35 nimmt 16 zurück). Die Zeilen sortieren weiter nach Punkten.
- **Karte = `task`** mit den Status des Toolkits (To Do · In Arbeit ·
  Erledigt). Eine Register-Schicht darf vorhandene Felder nicht umdefinieren
  (Spec 06, Erweiterung und Merge), also auch nicht auf „Offen · Erledigt"
  kürzen; Anton hat entschieden, die Kern-Status zu übernehmen. `stage`
  (0–11) ist die Spalte des Karabirrdt und bewusst **nicht** `status`: der
  Status beantwortet „wie weit", die Stufe „in welchem Schritt des
  Kreislaufs" — zwei Achsen. Die Stufe steht nie im Formular (`pos: "module"`).
- **Zeile als eingebettete Relation.** Spec 04, Regel 9 erlaubt eingebettete
  Relations für „wenige, feste Forward-Beziehungen, vom Autor des Items
  gesetzt". Genau das ist die Zeile: höchstens eine je Karte. Seit S3 führt
  das Toolkit-Register `partOf` an der Aufgabe selbst.
- **Faden eingebettet an der Voraussetzung.** Bis toolkit 0.1.7 war ein Faden
  ein RelationRecord (Begründung damals: Spec 08, Regel 9 — Fäden wachsen
  mit der Nutzung). Der Stack hat mit S3 entschieden, `blocks` eingebettet am
  blockierenden Item zu führen (`TOOLKIT_RELATION_PREDICATES`: „eingebettet am
  blockierenden Item, 0..n"), und das Widget `item-relation` liest nur
  eingebettete Kanten. Eine App-Schicht darf `storage` nicht ändern (Regel
  20). Anton hat am 28.09. entschieden, mitzuziehen (Option A). Die Richtung
  bleibt: Voraussetzung → abhängige Karte. Für Regeln, Raster und das alte
  Format liefert `faeden(items)` weiter die Sicht `{ id, from, to }`. Nur
  lokale Ziele (`item:<id>`) sind Fäden dieses Bretts; ein space-qualifiziertes
  Ziel (`space:{id}/item:<id>`) bleibt, wie es ist, und wird nicht umgezogen.
- **„lernt" als Qualifier, nicht als zweites Prädikat** (Katalog 3, 30, 34;
  Spec 06, Regel 20): Der Kern erlaubt `role` an `assignedTo` ohne Werte, die
  Karabirrdt-Schicht bringt `can` („kann") und `learns` („lernt") samt der
  Pills „Kann ich" · „Will lernen" mit. Die Pills ersetzen „Übernehmen" — die
  einzige Ersetzung, die eine Schicht vornehmen darf.

### Die Register-Schicht (`app/src/register.ts`)

| Typ | ergänzt | übernimmt vom Toolkit |
|---|---|---|
| Karte (`task`) | `hours` · `euros` B7 @meta („Aufwand", eine Zeile „12 h · 300 €"), `stage` @module als Auswahl der zwölf Stufen („1 · Bewusstsein“ …), Qualifier-Werte `can`/`learns`, Pills „Kann ich" · „Will lernen" mit Folgeaktion „Erledigt" | Titel, Beschreibung, Status (To Do · In Arbeit · Erledigt), Fällig, Tags, `assignedTo` („Zugewiesen"), `blocks` („Braucht" · „Ermöglicht"), `partOf` („Teil von") |
| Ziel (`project`) | Titel, Beschreibung („Traumsatz"), `dots` B7 („Punkte", min 0), `order` @module, Rückwärts-Liste „Karten" (←`partOf`, gegliedert nach Stufe, rechts der Status), Badge ✦ violett | Typ-Wort „Projekt" |

Dazu eine Manifest-Schicht: `project` bekommt `{ partOf, to, task }`, damit
die Liste „Karten" eine Manifest-Kante hat (Regel 1). Beides wird in
`main.tsx` vor dem ersten Render gebunden (`bindeRegister`), einmal über
`setTypeManifest` des Toolkits; data-interface sieht dasselbe Manifest.

**Warum die Stufe eine Auswahl ist und die Liste nach ihr gliedert**
(toolkit 0.4.0, `list.group`/`list.trailing`, Spec 06 Regel 22). Erlaubt
sind nur Felder mit `status`, `select` oder `number`. Als Zahl hieße die
Gruppe „0“ für die erste Stufe (gespeichert ist 0–11, das Brett zählt 1–12);
als Auswahl mit den Optionen `"0"` … `"11"` heißt sie „1 · Bewusstsein“, und
die Gruppen stehen in der Reihenfolge des Kreislaufs. Gespeichert bleibt die
Zahl, das Feld steht nie im Formular (`pos: "module"`, `edit: false`).
**Gruppen nach Stufe, rechts der Status**, nicht umgekehrt: Die Liste am Ziel
beantwortet „was liegt in welchem Schritt“ — das ist die Zeile des Bretts,
nur senkrecht. Die Stufe noch einmal rechts zu zeigen, wiederholte die
Überschrift; der Status ist die zweite Achse der Karte („wie weit“) und
fehlt sonst in der Liste.

### Umzug bestehender Bretter

`npm run umzug -- [--brett <kennung>] [--db <pfad>] [--probe]` zieht die
Daten aus der Zeit vor toolkit 0.3.0 um, idempotent:

1. Fäden-Datensätze `blocks` → eingebettet an der Voraussetzung; Datensätze
   mit einem Endpunkt in einem anderen Space bleiben Datensätze; Datensätze
   ohne Voraussetzung fallen weg, eingebettete Fäden ins Leere werden entfernt.
2. `wantsToLearn` → `assignedTo` mit `meta.role: "learns"`. Ein `assignedTo`
   ohne Rolle bekommt `meta.role: "can"` ausgeschrieben (Lücke 19). Neue
   Zuweisungen aus dem Formular tragen die Rolle schon: Das Toolkit setzt
   ohne Standard den ersten Wert („kann").
3. Aufwand 0: Das alte Formular schrieb in jede Karte 0 Stunden und 0 Euro,
   gemeint war „nicht geschätzt". Nach der Stack-Regel erzeugt ein leeres Feld
   keine Zeile, eine 0 aber „0 h · 0 €" — die 0 fällt weg. `/alt` liest
   Fehlendes weiter als 0.

Der Server muss dabei gestoppt sein, oder das Skript läuft gegen eine Kopie
(`--db`): Ein Browser mit der alten App schriebe sonst Karten ohne ihre Fäden
zurück. Ein JSON-Import im alten Format wird beim Import genauso umgezogen.

## Abgleich: der Supabase-Connector

Bis 01.10.2026 glich ein Eigenbau Browser und Server ab (`ServerConnector`:
MockConnector im Browser, ganze Dokumente per PUT an einen eigenen Server, der
letzte Schreiber gewann). Die Codex-Runden 2 bis 5 zu PR #2 fanden dort je
einen neuen Fehler. Seit dem Umzug auf den Supabase-Connector entfallen die
drei bekannten Einschränkungen von damals:

- **Brettwechsel bei offenem Formular:** Der Connector schreibt in den Space,
  der beim Schreiben gilt, und liest „Braucht“ und Co. frisch vom Server; es
  gibt keinen Browser-Speicher je Brett mehr, in den ein späterer Schritt
  fallen könnte.
- **Gleichzeitiges Bearbeiten derselben Karte:** Jede Änderung ist ein Update
  der Zeile auf dem Server, Realtime (`postgres_changes`) liefert sie allen
  anderen; kein verspätetes Echo setzt mehr einen neueren Stand zurück. Zwei
  Änderungen desselben Items zur selben Zeit: die spätere gilt.
- **Wer bin ich:** Die Anmeldung ist echt (anonym oder E-Mail); „Kann ich“
  schreibt die angemeldete Person, der Server bindet den Autor (RLS-Policy).

Geblieben ist eine Einschränkung, bewusst: **Die Regeln des Bretts prüft die
App** (Stopp-Punkt 5, der Stack ist backend-agnostisch). Sie prüft gegen den
Stand des Servers unmittelbar vor dem Schreiben; zwei gleichzeitige
Änderungen aus zwei Browsern, einzeln erlaubt, können zusammen einen Kreis
ergeben. Die Prüfung vor dem Speichern im Stack kommt mit rls#563. Offline
arbeitet die App nicht (Stopp-Punkt 6: später).

## Welche Toolkit-Bausteine benutzt werden

| Baustein | wofür |
|---|---|
| `ConnectorProvider`, `AppShell`, `AppShellMain`, `Navbar` | Rahmen |
| `WorkspaceSwitcher` + `GroupDialog` | Bretter wechseln, anlegen, umbenennen, löschen, Mitglieder — ein Brett **ist** ein Space |
| `GroupDialog.appSections` | die Abschnitte „Traum“ (Traumsatz, Traumhorizont) und „Daten“ (JSON-Export und -Import) im Space-Dialog; geschrieben nur über `patchData`, flach nach `Group.data`; die Group kommt live aus `useGroups` |
| `ColorSchemeToggle` + `applyInitialColorScheme` | hell und dunkel: führt `dark`-Klasse und `data-theme`, merkt die Wahl, folgt sonst dem System |
| `setTypeManifest`, `registerTypePresentation` (+ `composeTypeManifest` aus data-interface) | die Register-Schicht der App |
| `ItemDetailView` + `ItemDetailRead` | das geöffnete Item, Karte wie Ziel: Meta-Box, Selbstaktionen, Rückwärts-Liste, Reaktionen, Kommentare, ⋮-Menü mit Bearbeiten und Löschen — alles aus dem Register |
| `ItemComposer` + `pickContentTypes` + `createComposerMapping` | Anlegen und Bearbeiten, Formular aus dem Register; die App ergänzt nur Stufe und Reihenfolge einer neuen Karte (Modul-Felder) |
| `itemRelationDataKey` | eine Karte aus einer Zelle zeigt „Teil von“ schon im Formular (`initialData`) |
| `requestItemPick` des Composers | „Im Modul wählen" bei „Braucht", „Ermöglicht", „Teil von": Klick auf eine Karte oder einen Zeilenkopf im Brett |
| `ItemFocusContext` | der Fokus-Vertrag, gehalten im Zustand der App: Chips in der Meta-Box und Zeilen der Liste öffnen ihr Ziel im selben Panel |
| `CreateFab` | der Plus-Knopf unten rechts |
| `UserMenu` | rechts in der Navbar; „Profil" öffnet das eigene Profil, „Abmelden“ |
| `AuthScreen` | die Anmeldung vor der App: anonym oder E-Mail (Methoden aus `getAuthMethods` des Connectors) |
| `ProfilePanelContent` | das eigene Profil im Panel; wer anonym kommt, setzt hier zuerst den Namen |
| `loadRuntimeConfig`, `getRuntimeConfig` | Adresse und öffentlicher Schlüssel der Instanz aus `config.json` (Spec 11) |
| `useContacts` | die Kontakte, aus denen der `GroupDialog` einlädt |
| `ModuleFrame` (`fill="bleed"`, `panelFit="inset"`) + `FilterScope` | die Modulfläche: Suche und Filter-Pille stellt die Fläche, darunter das scrollende Brett |
| `ModuleToolbar` (`trailingActions`) | Modul-Aktionen im Kopf: Traumhorizont, Prüfung |
| `useModuleFilteredItems` | die Karten, gefiltert wie der Kopf es zeigt |
| `--module-controls-block` | Platz unter der letzten Zeile des Bretts für Filter-Pille und Plus-Knopf |
| `ItemPreview density="dense"` + `ItemAssignees size="xs"` | **jede** Karte auf dem Brett: die Matrix-Kachel aus rls#360, gefüllt „kann", umrandet „lernt" |
| `AdaptivePanel` (`allowedModes: ["floating","sidebar","drawer"]`) | die schwebende Detail-Karte; auf schmalen Schirmen der Drawer |
| `EmptyState` | das leere Brett; kein Brett oder eine fremde Adresse |
| `useItems`, `useCreateItem`/`useUpdateItem`, `useCurrentGroup`, `useCurrentUser`, `useMembers`, `useConnector` | alle Lese- und Schreibwege |
| `cn`, Tokens aus `styles/globals.css`, `Button` | Gestaltung |

Nichts davon wurde geforkt oder umgestylt. Die vier Phasenfarben des Dragon
Dreaming sind eigene App-Tokens (`--kb-dream` …) in `app/src/index.css`, in
beiden Signalen (`prefers-color-scheme` **und** `.dark`/`[data-theme]`).

**Entfallen** sind mit diesem Stand: die eigenen Panels `karten-detail.tsx`
und `ziel-detail.tsx`, die Widgets `AufwandWidget` und `PunkteWidget`,
`peopleRelations` mit zwei Personenfeldern, der Fäden-Block mit
„Voraussetzung hinzufügen" und der eigene Hook `faeden.ts`. **Geblieben**,
weil das Toolkit dafür nichts hat: das Prüfungs-Panel und das Raster mit Fäden und Zeilenköpfen (die
Fachlichkeit des Moduls). Die Wahl „Wer bist du?“ ist mit der Anmeldung
entfallen (Lücke 24).

### Abweichungen vom Entwurf (Detail-Simulator, KB-Karte und KB-Ziel)

- „Führt zu" heißt „Teil von", der Stand heißt „Status" mit To Do · In
  Arbeit · Erledigt (Kern-Register, keine Umdefinition, Anton 28.09.).
- Die Zeile „Offen · noch kein Aufwand geschätzt" gibt es nicht: Ein leeres
  Feld erzeugt keine Zeile; der Status steht als eigener Chip.
- Am Ziel steht „Punkte 6" statt „Priorität hoch"; die aggregierte
  Personenzeile (alle Menschen der Karten) kennt das Register nicht (Lücke 23).
- Die Liste „Karten" ist nach Stufe gegliedert, rechts steht der Status
  statt der Stufe (Begründung oben, Register-Schicht).
- Die Typ-Wörter sind die des Toolkits: „Task" und „Projekt" statt
  „Aufgabe" und „Ziel" (Lücke 25).

## Der Entwurf „Brett-Dichte" (Variante 1a)

Anton hat das Brett im Claude-Design-Projekt „RLS System Design" entwerfen
lassen und Variante 1a gewählt: alle zwölf Stufen und sieben Ziele ohne
Scrollen auf 1920 px. Was daraus im Code steht:

- **Ein Maß trägt alles.** `KACHEL` in `modell.mjs` ist die Kachelbreite;
  Spaltenraster, Kartenbreite und Stufenmitten leiten sich daraus ab. Eine
  Kachel ist eine `ItemPreview` in der Dichte `dense` (toolkit 0.3.0, 112×61),
  gesetzt auf **106 px** — gut 5 % schmaler, Antons Wahl aus der Vorschau zu
  rls#360.
- **Phasenband 20 hoch, Stufenzeile 18, 4 px Luft** (`MASSE.band`,
  `MASSE.stufe`, `MASSE.luft`). Die Stufenschrift nimmt die dunkle
  Phasenfarbe (`--kb-<phase>-dunkel`), die Fläche die helle.
- **Der Zeilenkopf ist KEINE Item-Karte**, sondern die Beschriftung der Linse
  — so wie der Spaltenkopf im Kanban: Punktereihe, Kurztitel (vor dem
  Doppelpunkt), darunter der Rest in drei Zeilen mit Auslassung. Ein Klick
  öffnet weiterhin das Ziel als Item (`ItemDetailView`). Das ist eine
  Entscheidung aus dem Entwurf, kein Eigenbau am Toolkit vorbei: die Karte
  des Ziels ist sein Detail, nicht sein Zeilenkopf.
- **Fäden** liegen bei 1.2 Strichstärke, kubisch mit
  `dx = max(30, (x2−x1)/2)` von Kante zu Kante. Innerhalb einer Zeile tragen
  sie die Phasenfarbe der abhängigen Karte, über Zeilen hinweg sind sie grau
  (`--muted-foreground`) und gestrichelt (`3 3`). Die Umwege um fremde Karten
  und die Start-/Ziel-Knoten mit ihren gestrichelten Kanten sind entfallen;
  die Regel „Fäden laufen nur nach rechts" bleibt und steht im Modell.
- **Erledigt** zeigt die dichte Karte selbst (Häkchen, Opazität 0.55) — das
  Brett färbt nichts zusätzlich ein.
- **Der Traumhorizont** steht als Text rechts im Modul-Kopf, neben „Prüfung";
  geändert wird er im Abschnitt „Traum“ des Space-Dialogs.
- **Noch nicht gebaut:** die Pille „Brett · Phase · Ziel" unten links neben
  dem Filter. Sie schaltet im Entwurf zwischen drei Linsen desselben Bretts;
  die Varianten 1b und 1c gibt es noch nicht.

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

1. **Teilweise behoben (toolkit 0.3.0).** Im Ziel-Detail stehen die Punkte jetzt als Zeile „Punkte“ (B7 `number` aus der Register-Schicht). Offen bleibt der Zeilenkopf des Bretts: Er ist bewusst keine Item-Karte und zeichnet die Punktereihe selbst. Ursprünglich: **Die Punkte eines Ziels haben keinen Platz auf der Karte.** Seit die
   Karten exakt wie im Kanban gezeichnet werden (`ItemPreview` mit
   `footerAdornment` aus `ItemAssignees`/`ItemCommentCount`), fehlen die
   Klebepunkte auf dem Zeilenkopf — sie sortieren die Zeilen, sind aber
   unsichtbar. Der vorgesehene Ort wäre der `preview`-Slot der
   Type-Presentation von `project`; den besetzt aber schon der Kern, und ein
   zweiter Eintrag für dieselbe Id ist nach Spec 06 ein Konflikt.
   *Offene Entscheidung:* Toolkit-PR (Punkte in `ItemProjectMeta`) oder Punkte
   nur im Ziel-Detail lassen.
3. **✅ BEHOBEN (toolkit 0.3.0, rls#360): `density="dense"`, die Matrix-Kachel.** Ursprünglich: **Keine Karte unterhalb von `compact`.** Die kleinste `ItemPreview` braucht
   rund 200×90 px. Das ursprüngliche Brett hatte 102×60-Zellen; die RLS-
   Fassung ist darum doppelt so breit (12 × 224 px). Für dichte Raster —
   Karabirrdt, Wochenkalender, Matrizen — fehlt eine dritte Dichte.
   *Vorschlag:* `density="tight"` in `ItemPreviewDensity`: nur Titel (2
   Zeilen, geklemmt) plus `footerAdornment`, kein Autor-Block, `p-1.5`,
   `text-[11px]`. Keine neue Komponente, eine neue Stufe der bestehenden Achse.
3b. **✅ BEHOBEN (toolkit 0.3.0, S3):** Das Manifest führt `{ partOf, from, project }` an der Aufgabe, im Detail „Teil von“. Die Gegenrichtung am Projekt fehlt im Toolkit weiter; die App ergänzt sie in ihrer Manifest-Schicht, damit die Liste „Karten“ entsteht. Ursprünglich: **Kein vorgesehener Weg „Task gehört zu Projekt".** `TaskRelations.forward`
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
5. **✅ BEHOBEN (toolkit 0.3.0, S4a):** B7 `number` mit Einheit und `min`; zwei Zahlenfelder mit gleichem Label teilen eine Zeile. `AufwandWidget` und `PunkteWidget` sind entfernt. Ursprünglich: **Kein Composer-Widget für Zahlenpaare.** Stunden und Euro brauchten ein
   eigenes Widget (`aufwand`). Der vorgesehene Weg (`widgets`,
   `CustomWidgetDefinition`) funktioniert einwandfrei — es fehlt nur ein
   generisches `number`-Widget im Toolkit, das jede zweite App sonst neu baut.
   *Vorschlag:* `WidgetType` um `"number"` erweitern, konfiguriert über
   `widgetLabels` und eine Feldliste im `ContentTypeConfig`.
6. **✅ BEHOBEN:** `ItemDetailView` mit `ItemDetailRead` liest zuerst und bearbeitet auf Wunsch. Ursprünglich: **`ContentComposer` kennt keine reine Ansicht.** `ItemDetailPanel` erwartet
   einen Inhalt; die Kanban-Lösung ist ein Composer im Bearbeiten-Modus. Für
   ein Brett, an dem mehrere gleichzeitig arbeiten, wäre ein Lesemodus mit
   „bearbeiten"-Knopf ruhiger.
   *Vorschlag:* `ItemDetailBody` ist genau das — in einer künftigen Fassung
   dieser App der bessere Inhalt des Panels.
7. **~~Kamera~~ — nicht mehr benötigt.** Das Brett hatte eine eigene Kamera
   (Zoom, Schwenken, Einpassen) im Muster der Graph-Ansicht, weil deren
   Kamera nicht exportiert war; seit toolkit 0.1.7 ist sie es
   (`fitCamera`, `focusCamera`, `interpolateCamera`, `GraphCamera` aus
   `components/graph/index`). Inzwischen ist der Zoom wieder draußen: das
   Brett ist eine normale scrollende Fläche wie Kanban und Kalender
   (Spec 01 — „Was scrollt, ist der Inhalt"). Die Lücke besteht also nicht
   mehr; falls je wieder eine Fläche mit Rändern eingepasst werden soll,
   gilt der alte Einwand gegen `fitCamera` weiter (feste Polsterung 0.82,
   Zoomklemme 0.08…1.6, Punktwolke statt Rechteck).
8. **Entfallen mit dem Umzug auf Supabase (Stopp-Punkt 3).** Eine Group-Id vom Aufrufer gibt es im Stack nicht (rls#549 geschlossen: im WoT unzulässig, auf Supabase ein Existenz-Leck); die Adresse steht als Slug in `Group.data.slug`, ein neues Brett öffnet ohne Neuladen. Ursprünglich: **`GroupManager.createGroup` vergibt die Id selbst.** `MockConnector`
   schreibt eine eigene Id (bis 0.2.2 `group-<zeit>`, seit 0.2.3 eine UUID) und nimmt keine entgegen. Ein Connector, der
   den MockConnector benutzt (siehe Lücke 9) kann eine vom Server oder von
   der Spec bestimmte Id also nicht durchreichen; wir laden beim Anlegen
   eines Bretts deshalb die Seite neu. `ItemWriter.createItem` akzeptiert
   eine Client-Id längst — Spec 08 Regel 4 verlangt sie für RelationRecords
   sogar —, Groups können das nicht.
   *Vorschlag:* `createGroup(name, data?, options?: { id?: string })`, und im
   Mock-Connector die übergebene Id übernehmen statt zu erfinden.
9. **✅ BEHOBEN (toolkit 0.4.0, rls#570).** Der `ModuleFrame` zeichnet die Modul-Aktionen auch ohne Filter-Besitzer und warnt (`[rls]`), wenn der `FilterScope` innerhalb des Frames steht. Hier steht er außerhalb; Kopf-Aktionen erscheinen, die Konsole bleibt still (geprüft im Browser). Ursprünglich: **`ModuleToolbar` wirft ohne Filter-Kontext.** `useSharedFilter` verlangt
   einen `<FilterProvider>`; die Leiste selbst bringt keinen mit. Der Ausweg
   heißt `FilterScope` (setzt einen, wenn keiner da ist) und steht in keiner
   Typ-Signatur — man findet ihn nur im Quelltext.
   *Vorschlag:* `ModuleToolbar` intern in `FilterScope` wickeln; ein Kopf, der
   ohne unsichtbare Umgebung abstürzt, ist kein Baustein, sondern eine Falle.
10. **✅ BEHOBEN (toolkit 0.4.0, rls#567).** `ModuleControls` gibt es nicht mehr; Modul-Knöpfe gehen über `ModuleToolbar.trailingActions` in den Kopf. Der Frame meldet die Höhe der Zeile aus Pille und Plus-Knopf als `--module-controls-block`; das Brett lässt genau so viel Platz unter der letzten Zeile. (Kamera-Knöpfe und die Schätzung `SCHWEBEND` gab es seit dem Ende des Zooms schon nicht mehr.) Ursprünglich: **Die schwebende Ecke unten links hat nur einen Platz.** `ModuleFrame`
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
   **Seit toolkit 0.3.0 ganz erledigt:** „lernt“ ist kein zweites Prädikat mehr, sondern der Qualifier `role: learns` an `assignedTo` (Spec 06, Regel 20); `peopleRelations` wird nicht mehr gebraucht.
   Früher offen: das Typ-Manifest, `wantsToLearn` stand nicht als
   Affordance beim Typ `task`. *Vorschlag:*
   `{ predicate: "wantsToLearn", itemRole: "from", otherKind: "person" }`
   im `CORE_TYPE_MANIFEST`.
12. **Entfallen mit dem Umzug auf Supabase:** Mitglieder sind Konten, `inviteMember` und `getMembers` kommen vom Connector. Ursprünglich: **Der MockConnector nimmt nach dem Seed keine Menschen mehr auf.**
   `users` ist privat, `inviteMember(groupId, userId)` kennt nur Kennungen,
   und `injectSeedItems` gilt nur für Items. Ein Connector, der ihn benutzt,
   kann Mitglieder eines nachgeladenen Spaces also nicht hineinreichen —
   unsere Schicht führt die Mitgliederliste darum selbst und beantwortet
   `getMembers`/`observeMembers`/`getUser` direkt.
   *Vorschlag:* `injectSeedUsers(users, groupId)` analog zu `injectSeedItems`,
   oder `inviteMember(groupId, user: string | User)`.
13. **✅ BEHOBEN (toolkit 0.4.0, rls#551).** Traum und Daten sind App-Abschnitte im `GroupDialog` (`appSections`, `appSectionsTitle="Karabirrdt"`), geschrieben nur über `patchData` (flach nach `Group.data`, Spec 04 Regeln 2 und 3). Der Dialog bekommt die Group live aus `useGroups` (shared-components, Regel 3); der eigene Dialog und das Zahnrad daneben sind entfernt. Offen bleibt der `actions`-Slot je Space im Switcher; er wird nicht mehr gebraucht. Ursprünglich: **Die Space-Konfiguration hat keinen Platz für mehr.** `GroupDialog` nimmt
   keine zusätzlichen Abschnitte und `WorkspaceSwitcher` keinen zweiten
   Menüpunkt je Space. Traum, Traumhorizont und der JSON-Austausch gehören
   zum Space und mussten darum in einen eigenen Dialog neben das Space-Menü.
   *Vorschlag:* ein `sections`-Slot im `GroupDialog` (oder Tabs, in die eine
   App eigene Abschnitte hängt) und ein `actions`-Slot je Space-Eintrag im
   Switcher.
14. **Gegenstandslos** seit das Brett nicht mehr zoomt; Modul-Knöpfe stehen nach toolkit 0.4.0 ohnehin in `trailingActions` (bis rls#552). Ursprünglich: **Kein Baustein für Flächen-Bedienelemente oben rechts.** Gesucht in
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
16. **✅ BEHOBEN (toolkit 0.4.0, rls#568).** `ColorSchemeToggle` in `NavbarEnd`, `applyInitialColorScheme()` in `main.tsx` vor dem ersten `await`. Neu dadurch: Die App folgt beim ersten Besuch der Systemvorgabe (vorher startete sie immer hell) und merkt eine Wahl. Ursprünglich: **Kein Umschalter für den Dunkelmodus.** Das Toolkit liefert nur die
   **Leser** `resolveColorScheme` und `observeColorScheme`
   (`lib/color-scheme.d.ts`) — ausdrücklich „for consumers that cannot express
   their theme in CSS" (eine WebGL-Karte), und die Doku hält fest: „The app
   shell does not seed the class from the OS preference". Den Schalter baut
   jede App selbst; die Reference-App tut es in `App.tsx` mit `useState` plus
   `document.documentElement.classList.toggle("dark")` und einem
   `Button variant="ghost" size="icon"` mit Mond/Sonne in `NavbarEnd`. Genau
   diese Zusammensetzung ist hier übernommen.
   *Vorschlag:* ein `ColorSchemeToggle` im Toolkit, der die `dark`-Klasse
   führt, die Wahl merkt und beim ersten Besuch `prefers-color-scheme` liest —
   sonst schreibt jede App diese fünf Zeilen neu und sie laufen auseinander.
17. **✅ Erledigt durch den Umzug auf den Supabase-Connector** (01.10.2026); der `ServerConnector` ist entfernt. Ursprünglich: **Kein Connector für „ein Server, viele Clients, keine Anmeldung".** Der
   Mock-Connector ist speicherflüchtig, der Local-Connector einsam, Supabase
   und WoT bringen Identität mit. Diese App braucht dazwischen einen
   geteilten Raum ohne Konten — deshalb `ServerConnector`.
   *Vorschlag:* das hier gezeigte Muster (MockConnector + Proxy + Transport)
   als `@real-life-stack/remote-connector` mit austauschbarem Transport.

### Neu mit toolkit 0.3.0 (Umzug auf das Register, 28.09.2026)

18. **✅ BEHOBEN (toolkit 0.4.0, rls#555).** Das Manifest wird einmal gebunden; ein Test belegt, dass `getTypeManifest()` aus data-interface sieht, was über das Toolkit gebunden wurde. Ursprünglich: **Das Toolkit bündelt data-interface, statt es zu importieren.** In
   `toolkit/dist/module-register-*.js` steckt eine eigene Kopie von
   `composeTypeManifest`, `setTypeManifest` und Co.; der MockConnector
   importiert das npm-Paket. `setTypeManifest` des Toolkits bindet nur seine
   Kopie; `getTypeManifest()` aus `@real-life-stack/data-interface` sah danach
   das Manifest ohne App-Schicht. Wir binden darum beide (`register.ts`).
   *Vorschlag:* data-interface im Toolkit-Build als `external` führen; es ist
   ohnehin Abhängigkeit.
19. **Im Toolkit behoben (toolkit 0.4.0, rls#556):** `QualifierValuesEntry.default`. Das Karabirrdt nutzt es noch nicht; der Umzug schreibt `role: "can"` weiter aus (nicht Teil dieses Nachzugs). Ursprünglich: **Eine Schicht kann den Standardwert eines Qualifiers nicht setzen.**
   `EdgeEntry.qualifier.default` („ein fehlender Wert gilt als …“, Regel 7)
   gibt es, `QualifierValuesEntry` nimmt aber nur `values`. Folge: Ein
   `assignedTo` ohne Rolle (alle Zuweisungen aus der Zeit vor dem Umzug)
   steht als „Jonas“ statt „Jonas kann“ da, im Formular als „Jonas · …“, und
   die Pill-Zeile zeigt für mich „✓ Dabei“ neben „Kann ich“ · „Will lernen“.
   *Im Karabirrdt gelöst (Anton 29.09.):* Der Umzug schreibt `role: "can"`
   ausdrücklich; die Daten lassen sich jederzeit als JSON exportieren und
   anders umformen. *Für andere Apps bleibt der Vorschlag:* `default` am
   `QualifierValuesEntry` (höchstens eine Schicht je Kante).
20. **✅ BEHOBEN (toolkit 0.4.0, rls#557).** `list: { group: "stage", trailing: "status" }`; die Stufe ist dafür eine Auswahl (Begründung in „Die Register-Schicht“). Ursprünglich: **Rückwärts-Listen kennen keine Gruppierung und keine Zusatzspalte.**
   `EdgeEntry.list` hat nur `filter` und `sort`; die Zeilen-Dekoration
   (`ListRowDecoration.trailing`) gibt es nur für benannte Abfragen. Die
   Liste „Karten“ am Ziel ist darum flach, ohne die Stufe rechts.
   *Vorschlag:* `list.trailing: <feld>` (ein Feld rechts in der Zeile) und
   `list.group: <feld>`.
21. **Keine Umdefinition von Status-Optionen und Beschriftungen.** Die
   Karabirrdt-Karte hätte „Offen · Erledigt“ und „Führt zu“ gebraucht
   (Entwurf; Spec 06 nennt sie selbst als Beispiel). Merge-Regel: Ein
   vorhandener Feld- oder Kanten-Schlüssel ist ein Konflikt. Anton hat
   entschieden, die Kern-Werte zu übernehmen; kein Toolkit-PR.
22. **✅ BEHOBEN (toolkit 0.4.0, rls#558).** Das Brett liest `useModuleFilteredItems(karten)`. Ursprünglich: **`useSurfaceItems` und `useModuleFilteredItems` sind nicht exportiert.**
   Eine Fläche außerhalb des Modul-Hosts wendet den geteilten Filter selbst an
   (`useSharedFilter` + `applyFilterBarValue` + `applyItemSearch`), genau das,
   was der Hook verhindern soll.
23. **Keine aggregierte Personenzeile am Ziel.** Der Entwurf zeigt am Ziel alle
   Menschen seiner Karten; das Register kennt keine Zeile, die über eine
   Rückwärts-Kante sammelt.
24. **✅ Erledigt durch die anonyme Anmeldung** (`AuthScreen`, Methode `anonymous`); „Kann ich“ schreibt die angemeldete Person. Ursprünglich: **Keine Identität ohne Konto.** Die Selbstaktionen schreiben den aktuellen
   Nutzer; diese App hat keine Anmeldung. Sie fragt darum selbst „Wer bist
   du?“ (Profil im Benutzermenü), merkt die Wahl je Brett im Browser und
   liefert sie als `getCurrentUser`. Ohne Wahl ist es der Tisch, dann trüge
   „Kann ich“ den Tisch ein.
   *Vorschlag:* ein Baustein „Ich bin …“ für geteilte Räume ohne Konten, oder
   `UserMenu` mit einer Personenauswahl.
25. **Typ-Wörter gehören dem Toolkit.** `label` ist ein Skalar, den die Basis
   setzt: Die Karte heißt im Badge „Task“, das Ziel „Projekt“. Das Badge des
   Ziels (✦, violett) setzt die Schicht, weil die Basis keines hat.
26. **✅ BEHOBEN (mock-connector 0.2.3, rls#561).** Der Mock vergibt `crypto.randomUUID()`; die eigene Id-Vergabe im ServerConnector ist entfernt (für die Regelprüfung vor dem Anlegen steht ein Platzhalter). Ursprünglich: **Der MockConnector zählt Item-Ids hoch** (`item-100`, `item-101` … je
   Sitzung). Zwei Browser am selben Brett legten dieselbe Id an und
   überschrieben einander. Der ServerConnector vergibt deshalb selbst eine
   zufällige Id. *Vorschlag:* `crypto.randomUUID()` im Mock.
27. **✅ BEHOBEN (toolkit 0.4.0, rls#562).** `ItemDetailRead` fragt `connector.getUser`, sonst „Unbekannt“. Karten des Tischs stehen jetzt auch nach der Wahl „Wer bist du?“ als „Erstellt von Am Tisch“ da, nie mehr als DID (geprüft im Browser). Ursprünglich: **`ItemDetailRead` löst den Autor nur über Mitglieder und den eigenen
   Nutzer auf.** Items, die der Tisch angelegt hat (alle aus der Zeit vor der
   Wahl „Wer bist du?“), stehen als „Erstellt von did:karabirrdt:tisch“ da,
   sobald jemand gewählt hat. *Vorschlag:* `connector.getUser` als Rückfall.
   *Entscheidung Anton 29.09.:* Wer die Karten angelegt hat, muss niemand
   wissen; bis dahin bleibt die Anzeige so. Wenn das Karabirrdt ein fertiges
   Modul im Real Life Stack ist, gilt wie bei den Aussagen: Wer das JSON
   importiert, gilt als Autor der Karten.
28. **Brett-Regeln haben keinen Haken im Formular.** „Fäden laufen nur nach
   rechts“ und „eine Karte gehört zu genau einem Ziel“ (das Formular erlaubt
   bei „Teil von“ keinen und mehrere Chips) prüft der Connector bei jedem
   Schreiben und lehnt ab; das Formular
   zeigt den Grund. Weil „Braucht“ erst NACH dem Speichern am anderen Item
   geschrieben wird, kann die Karte gespeichert sein und nur der neue Faden
   fehlen („Konnte nicht gespeichert werden … Erneut“). *Vorschlag:* eine
   optionale Prüfung je Typ vor dem Speichern.
30. **Entfallen mit dem Umzug auf Supabase.** Ursprünglich: **Der MockConnector lässt seinen Nutzer nicht setzen.** `authenticate`
   nimmt immer den ersten Seed-Nutzer; für „Wer bist du?" setzt der
   ServerConnector `currentUser` und `currentUserObs` des Mocks selbst, sonst
   schriebe der Speicher „Tisch" als Bearbeiter und verweigerte das Bearbeiten
   eigener Kommentare. *Vorschlag:* `setCurrentUser(user)` im Mock.

29. **✅ BEHOBEN (toolkit 0.4.0, rls#564).** Eine Karte aus einer Zelle bekommt `initialData` mit `itemRelationDataKey("partOf")`; „Teil von“ steht schon im Formular. `mitPosition` setzt nur noch Stufe und Reihenfolge, keine Zeile mehr nach. Entfernt jemand den Chip, lehnt die Brett-Regel ab und das Formular zeigt den Grund. Ursprünglich: **Keine Vorbelegung einer Item-Kante beim Anlegen.** Der Datenschlüssel
   (`relation:partOf`) ist nicht exportiert; eine Karte aus einer Zelle zeigt
   „Teil von“ im Formular leer und bekommt die Zeile erst beim Speichern
   (`mitPosition` in `composer.ts`). *Vorschlag:* `itemRelationDataKey`
   exportieren.

31. **Im Betrieb entfallen** (der Mock läuft nur noch in den Tests). Ursprünglich: **Der MockConnector braucht einen sicheren Kontext.** Er ruft
   `crypto.randomUUID()` beim Anlegen (Item-Id, seit 0.2.3) und schon bei
   jedem Anlegen, Ändern und Löschen für den Aktivitätseintrag
   (`appendActivity`, auch in 0.2.2). `randomUUID` gibt es nur über HTTPS und
   auf `localhost`; über `http://<LAN-IP>:8124` scheitert jedes Schreiben mit
   „crypto.randomUUID is not a function“. Das war vor diesem Nachzug genauso
   (die eigene Id half nicht, `appendActivity` warf danach); ausgerollt läuft
   das Karabirrdt hinter HTTPS. Keine Umgehung in der App.
   *Vorschlag:* im Mock eine Id aus `crypto.getRandomValues()` bilden, wenn
   `randomUUID` fehlt.

32. **Die Formular-Abbildung reicht Kanten-Schlüssel eines anderen Typs als
   Datenfeld durch.** Belegt man „Teil von“ einer Karte vor
   (`itemRelationDataKey("partOf")`) und wechselt im Formular den Typ auf das
   Ziel, behält der `ContentComposer` die Daten, und `createComposerMapping`
   schreibt `"relation:partOf"` in `data` des Ziels. Im Karabirrdt nimmt
   `mitPosition` diesen einen Schlüssel beim Ziel heraus (Test in
   `composer.test.ts`). *Vorschlag:* Die Abbildung lässt `relation:`-Schlüssel
   fallen, deren Kante der gewählte Typ nicht führt.

### Neu mit dem Umzug auf Supabase (01.10.2026)

33. **Platzhalter-Personen trägt der Stack nicht (Stopp-Punkt 2, offen).**
   Entschieden ist: Mitglieder ohne Konto (`global:user:<name>`) werden
   Platzhalter-Personen (Profil ohne Konto), die beim ersten Login mit dem
   Konto verknüpft werden. Geprüft am 01.10.:
   - Spec 12 Regel 3 kennt den Platzhalter (ein `person`-Item ohne
     `data.did`, angelegt von einem Mitglied). Die Verknüpfung
     Platzhalter ↔ Profil beim Beitritt ist ausdrücklich nicht Teil der Spec
     (Regel 3, Nicht-Ziele).
   - Der Supabase-Connector legt ein solches Item an wie jedes andere, mehr
     nicht; Profile sind Zeilen in `profiles` und hängen an einem Konto.
   - Das Toolkit löst Zuweisungen nur über `global:<userId>` gegen Nutzer auf
     (`ItemAssignees`, Personen-Feld im Formular, Selbstaktionen). Eine
     Zuweisung an einen Platzhalter (`item:<id>`) erschiene weder auf der
     Karte noch im Detail noch im Formular.
   Das braucht eine Erweiterung von Spec und Toolkit (Zuweisung an einen
   Platzhalter, Verknüpfen beim Login) und ist darum nicht im Karabirrdt
   nachgebaut. Bis dahin hält der Import an, solange ein Mitglied ohne Konto
   Zuweisungen hat; `--zuordnung` schreibt sie für Mitglieder mit Konto um,
   `--ohne-konto-uebernehmen` übernimmt sie ausdrücklich unverändert
   (unsichtbar). Im echten Brett „real-life“ trägt nur ein Mitglied
   Zuweisungen.
34. **Anonym angemeldet heißt namenlos.** `AuthScreen` fragt beim anonymen
   Einstieg keinen Namen ab; die Instanz legt das Profil mit leerem Namen an.
   Die App öffnet darum danach das Profil (`ProfilePanelContent`).
   *Vorschlag:* ein optionaler Anzeigename bei der Methode `anonymous`.
35. **Einladen nur aus den Kontakten.** Der `GroupDialog` lädt aus `contacts`
   ein; auf Supabase braucht ein Kontakt erst eine angenommene Anfrage. Wer
   zum ersten Mal an den Tisch kommt, kann die eigene Kennung zeigen (die App
   zeigt sie bei einer fremden Adresse), ein Mitglied hat aber keinen Weg, sie
   einzugeben. *Vorschlag:* Einladung per Link oder Kennung im Dialog.
36. **Traum und Horizont ändert nur, wer das Brett angelegt hat.** Die Policy
   der Instanz erlaubt Änderungen an einer Group nur ihrem Ersteller; bisher
   durfte jede Person am Tisch den Traum ändern. Ein abgelehnter Patch
   erscheint als Fehler im Abschnitt „Traum“.
37. **Ein Slug ist nur unter den eigenen Brettern eindeutig.** Groups sind nur
   für Mitglieder lesbar; zwei Personen können Bretter mit demselben Slug
   anlegen, und `/<slug>` löst unter den eigenen auf.

### Stand nach toolkit 0.4.0

Offen sind: **1** (Punkte im Zeilenkopf), **17** (kein Connector für einen
geteilten Raum ohne Konten), **23** (keine aggregierte Personenzeile am
Ziel), **24** (keine Identität ohne Konto), **25** (Typ-Wörter gehören dem
Toolkit), **28** (keine Prüfung je Typ vor dem Speichern); dazu im
Mock-Connector **8** (Group-Id nicht übergebbar), **12** (keine Menschen nach
dem Seed) und **30** (kein `setCurrentUser`) — deren Umgehungen im
ServerConnector bleiben bis zum Umzug auf Supabase — sowie neu **31**
(Mock schreibt nur in einem sicheren Kontext) und **32** (Formular-Abbildung
behält Kanten-Schlüssel nach einem Typwechsel). **4** und **15** sind
Hinweise ohne Handlungsbedarf, **21** ist entschieden.

### Stand nach dem Umzug auf Supabase

Offen sind: **1**, **23**, **25**, **28** (wie zuvor), dazu **32** und neu
**33** (Platzhalter-Personen, braucht Spec und Toolkit), **34** bis **37**.
Geschlossen oder entfallen durch den Umzug: **8**, **12**, **17**, **24**,
**30**, im Betrieb **31**, und die drei bekannten Einschränkungen des
Eigenbau-Syncs.

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
- **Eigene Felder über die Register-Schicht**, nicht über eigene Widgets:
  Ein Fragment für den Toolkit-Typ (`registerTypePresentation`) ergänzt
  Felder, Qualifier-Werte und Pills; Detail und Formular folgen von selbst.
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
  den Kopf der Modulfläche, auch Knöpfe der Fläche (`trailingActions`; die
  schwebende Ecke gehört seit toolkit 0.4.0 allein Filter-Pille und
  Plus-Knopf). Eine Modul-Schaltfläche in der Navbar ist der sicherste
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
- **Toolkit-Typen erweitern, nicht ersetzen.** Eine zweite Typdefinition für
  `task` wäre ein Konflikt; ein Erweiterungsfragment ergänzt additiv. Was die
  Basis schon setzt (Status-Optionen, Beschriftungen, Typ-Wort), bleibt.
- **Eine Autor-Kennung.** (Galt für Fäden als Datensätze, bis zum Umzug.) Die Id eines RelationRecords leitet sich aus
  `(createdBy, predicate, from, to)` ab. Wer an zwei Stellen zwei Kennungen
  benutzt (Server-Migration und App), bekommt zwei Datensätze für dieselbe
  Kante. Darum steht `AUTOR` in `modell.mjs` und sonst nirgends.
- **Genau pinnen.** `0.x` bewegt sich: toolkit `0.4.0`, data-interface `0.4.0`,
  mock-connector `0.2.3`, exakt ohne `^`.
- **Space-Einstellungen der App gehören in den `GroupDialog`** (`appSections`),
  nicht in einen zweiten Dialog. Und die Group, die der Dialog bekommt, muss
  die beobachtete sein, nicht die beim Öffnen gemerkte — sonst steht nach dem
  Speichern der alte Wert im Feld.

## Offene Punkte

- **Geprüft** mit `npm test` (Modell, Server, Umzugsskript unter
  `node --test`; Register, Formular-Abbildung und Connector unter Vitest mit
  jsdom), `npm run typecheck`, `npm run build` und im Browser: Headless-Chrome
  gegen Vite (5174) und Server (8124) mit einem Testbrett aus den
  Beispieldaten, vorher in die alte Form zurückgesetzt und mit
  `npm run umzug` umgezogen. Screenshots von Brett, Karten-Detail,
  Selbstaktion, Formular, Modul-Pick mit abgelehntem Faden und Ziel-Detail
  hängen am Pull Request.
- **Nachzug auf toolkit 0.4.0 (01.10.2026)** geprüft mit `npm test`,
  `npm run typecheck`, `npm run build` und Headless-Chrome gegen Vite (5184)
  und Server (8126) auf einer umgezogenen Kopie der Brett-Datenbank: Brett mit
  Kopf-Aktionen ohne `[rls]`-Warnung, Space-Dialog mit Abschnitt „Traum“
  (Änderung erscheint im Dialog und im Kopf, liegt auf dem Server), Ziel mit
  gegliederter Liste, neue Karte aus einer Zelle mit vorbelegtem „Teil von“
  (gespeichert mit Stufe, Zeile und UUID), Autor „Am Tisch“; Desktop und
  Telefon, hell und dunkel. Screenshots liegen lokal vor (nicht im Repo).
- **Umzug auf Supabase (01.10.2026)** geprüft mit `npm test`, `npm run
  typecheck`, `npm run build` und live gegen die Instanz im freigegebenen
  Testraum (Nutzer und Space mit `kb-test-`, danach gelöscht): Umzugsskript
  mit einem anonymisierten Export einer Kopie (78 Items, 89 Fäden-Datensätze
  eingebettet; Probe, Import, zweiter Lauf ohne Änderung, Zuordnung mit
  Einladung); im Browser Anmeldung mit E-Mail, Brett unter `/<slug>`,
  Karten-Detail, „Kann ich“ schreibt die angemeldete Person, eine Änderung
  aus einem zweiten Konto erscheint per Realtime in unter einer Sekunde,
  anonyme Anmeldung mit Profil, fremde Adresse mit Kennung, nach der Einladung
  öffnet das Brett ohne Neuladen; `/alt` eingefroren (Änderungen gehen auf
  den Stand zurück, keine Schreibanfrage). Desktop und Telefon.
- Die Bündelgröße liegt bei rund 1,2 MB (409 kB gzip) — das Toolkit bringt
  Editor, Karten- und Graph-Bausteine mit, von denen diese App wenig braucht.
  Aufteilen lohnt erst, wenn die App öffentlich läuft.
