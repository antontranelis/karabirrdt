// Die Register-Schicht der Karabirrdt-App (Spec 06, Feld- und Kantenregister,
// Regel 20; Katalog 34 „Option D").
//
// Die App führt KEINE eigenen Typen: Ziel ist `project`, Karte ist `task` —
// beides Toolkit-Typen. Sie ergänzt deren Einträge nur additiv
// (Erweiterungsfragmente, „Erweiterung und Merge", Punkt 2):
//
//   Karte (`task`)
//     + hours · euros   B7 number @meta, beide mit Label „Aufwand" → eine Zeile
//     + stage           @module (Spalte des Bretts, nie im Formular)
//     + Werte für den Qualifier `role` an `assignedTo`: can („kann"),
//       learns („lernt") — der Kern kennt nur den Schlüssel
//     + eigene Pills „Kann ich" · „Will lernen" (ersetzen „Übernehmen",
//       die einzige erlaubte Ersetzung, Regel 20)
//   Ziel (`project`)
//     + title, description („Traumsatz"), dots B7 number („Punkte"),
//       order @module, Rückwärts-Liste „Karten" (←partOf), Badge (✦, violett)
//
// Was die App NICHT umdefinieren darf und deshalb vom Toolkit übernimmt
// (Entscheidung Anton 28.09.): die Status-Optionen der Aufgabe
// (To Do · In Arbeit · Erledigt) und die Beschriftungen „Teil von",
// „Braucht", „Ermöglicht". Die Beschriftung des Typ-Badges („Projekt",
// „Task") gehört ebenfalls dem Toolkit.
//
// Dieses Modul wird genau einmal importiert, vor dem ersten Render
// (main.tsx): Das Register liest beim Rendern, nicht beim Import.

import {
  TOOLKIT_TYPE_LAYER,
  composeTypeManifest,
  setTypeManifest as bindeDataInterface,
  type TypeManifestLayer,
} from "@real-life-stack/data-interface"
import { registerTypePresentation, setTypeManifest, type TypePresentationLayer } from "@real-life-stack/toolkit"
import { Sparkle } from "lucide-react"
import { FADEN_PRAEDIKAT, KARTEN_TYP, ROLLE_KANN, ROLLE_LERNT, ZIEL_TYP, ZUGEHOERIG_PRAEDIKAT, ZUWEISUNG } from "../../modell.mjs"

/**
 * Manifest-Schicht der App: Das Ziel nimmt Karten auf (`partOf`, eingehend).
 * Der Toolkit-Eintrag von `project` deklariert keine Kanten; die Aufgabe
 * führt `partOf` ausgehend schon. Ohne diese Gegenrichtung dürfte das
 * Darstellungs-Register die Liste „Karten" nicht zeigen (Regel 1).
 */
export const KARABIRRDT_MANIFEST_LAYER: TypeManifestLayer = {
  name: "karabirrdt",
  extensions: [{ id: ZIEL_TYP, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, itemRole: "to", otherKind: KARTEN_TYP }] }],
}

export const KARABIRRDT_REGISTER: TypePresentationLayer = {
  extensions: [
    {
      id: KARTEN_TYP,
      fields: [
        // Zahlenfelder mit gleichem Label teilen eine Zeile: „Aufwand 12 h · 300 €"
        // (shared-components → Widget-Paare, Regel 1).
        { key: "hours", widget: "number", pos: "meta", label: "Aufwand", unit: "h", min: 0 },
        { key: "euros", widget: "number", pos: "meta", label: "Aufwand", unit: "€", min: 0 },
        // Die Stufe ist die Spalte des Bretts: Modul-Interaktion (Katalog 4).
        { key: "stage", widget: "number", pos: "module", edit: false },
      ],
      qualifierValues: [
        {
          predicate: ZUWEISUNG,
          itemRole: "from",
          values: [
            { id: ROLLE_KANN, label: "kann", action: "Kann ich" },
            { id: ROLLE_LERNT, label: "lernt", action: "Will lernen" },
          ],
        },
      ],
      selfActions: [
        {
          predicate: ZUWEISUNG,
          itemRole: "from",
          selfAction: {
            label: "Kann ich",
            mine: "Dabei",
            qualifiers: [ROLLE_KANN, ROLLE_LERNT],
            // „Erledigt" nach meinem Zustand; erledigt zeigt die Zeile nur
            // Zustände (Katalog 33, Spec 06 Regel 19).
            followUps: { field: "status", complete: { label: "Erledigt" }, release: "Nicht mehr dabei" },
          },
        },
      ],
    },
    {
      id: ZIEL_TYP,
      // Der Toolkit-Eintrag von `project` setzt kein Badge; ein Fragment darf
      // ein Skalar setzen, das die Basis offen lässt (Erweiterung und Merge,
      // Punkt 2). Das Wort bleibt „Projekt" — `label` setzt die Basis.
      badge: { icon: Sparkle, className: "bg-violet-50 text-violet-700 border-violet-200" },
      fields: [
        { key: "title", widget: "title", pos: "head" },
        { key: "description", widget: "text", pos: "content", label: "Traumsatz" },
        // Die Klebepunkte bleiben eine Zahl (Anton 28.09.; Katalog 35 nimmt 16 zurück).
        { key: "dots", widget: "number", pos: "meta", label: "Punkte", min: 0 },
        { key: "order", widget: "number", pos: "module", edit: false },
      ],
      edges: [
        // Flache Liste: ListEntry kennt keine Gruppierung je Stufe und keine
        // Zusatzspalte (Lücke, docs/rls-kompatibel.md).
        { predicate: ZUGEHOERIG_PRAEDIKAT, itemRole: "to", storage: "embedded", widget: "item-relation", pos: "list", label: "Karten" },
      ],
    },
  ],
}

/** Die zusammengesetzte Sicht: Toolkit, dann App. */
export const TYPE_MANIFEST = composeTypeManifest([TOOLKIT_TYPE_LAYER, KARABIRRDT_MANIFEST_LAYER])

let gebunden = false
/** Manifest binden und die Schicht registrieren — einmal, vor dem ersten Render. */
export function bindeRegister(): void {
  if (gebunden) return
  // Zweimal, weil es zwei Kopien gibt: Das Toolkit bringt data-interface
  // eingebaut mit (toolkit 0.3.0 bündelt es, statt es als Abhängigkeit zu
  // importieren), der MockConnector importiert das npm-Paket. Beide müssen
  // dasselbe Manifest sehen (Lücke, docs/rls-kompatibel.md).
  setTypeManifest(TYPE_MANIFEST)
  bindeDataInterface(TYPE_MANIFEST)
  registerTypePresentation("karabirrdt", KARABIRRDT_REGISTER)
  gebunden = true
}

// `blocks` braucht keinen Eintrag der App: Die Aufgabe führt „Braucht" und
// „Ermöglicht" im Toolkit-Register, eingebettet am blockierenden Item —
// genau dort, wo modell.mjs die Fäden ablegt.
void FADEN_PRAEDIKAT
