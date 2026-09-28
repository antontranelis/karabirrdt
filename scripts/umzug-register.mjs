#!/usr/bin/env node
// Umzug auf toolkit 0.3.0 (Register aus dem Stack):
//
//   1. Fäden: RelationRecord `blocks` (from = Voraussetzung, to = abhängige
//      Karte) → eingebettete Relation `blocks` an der Voraussetzung. Die
//      Richtung bleibt. Datensätze, deren Voraussetzung es nicht mehr gibt,
//      fallen weg; eingebettete Fäden ins Leere werden entfernt.
//   2. „Will lernen": `wantsToLearn` → `assignedTo` mit `meta.role: "learns"`.
//      Ein `assignedTo` ohne Rolle bleibt, wie es ist (gilt als „kann").
//
// Zweimal laufen ändert nichts. Der Server muss gestoppt sein (oder das
// Skript läuft gegen eine Kopie mit `--db`): Ein Browser mit der alten App
// schriebe sonst Karten ohne ihre Fäden zurück.
//
//   npm run umzug -- [--brett <kennung>] [--db <pfad>] [--probe]
import path from "node:path";
import { Speicher, gueltigeKennung } from "../speicher.mjs";
import { umziehen, verwaisteFaeden } from "../modell.mjs";

const argumente = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith("--")) continue;
  const name = a.slice(2);
  const wert = process.argv[i + 1];
  if (wert && !wert.startsWith("--")) {
    argumente.set(name, wert);
    i++;
  } else argumente.set(name, "1");
}

const nurBrett = argumente.get("brett");
const probe = argumente.has("probe");
const datei = argumente.get("db") ?? process.env.KARABIRRDT_DB ?? path.join(import.meta.dirname, "..", "data", "karabirrdt.sqlite");

if (nurBrett && !gueltigeKennung(nurBrett)) {
  console.error("Aufruf: npm run umzug -- [--brett <kennung>] [--db <pfad>] [--probe]");
  process.exit(2);
}

const speicher = new Speicher(datei);
const bretter = nurBrett ? [nurBrett] : speicher.bretter().map((b) => b.brett).filter((b) => speicher.hatRls(b));
const verb = probe ? "wären geändert" : "geändert";

console.log(`${probe ? "Probe" : "Umzug"} · ${datei} · ${bretter.length} Bretter`);
for (const brett of bretter) {
  const daten = speicher.rlsBrett(brett);
  const u = umziehen(daten.items, daten.relations);
  // Nach dem Einbetten: Fäden, deren Ziel es nicht gibt, als Reparatur.
  const reparatur = new Map(verwaisteFaeden(u.items).map((r) => [r.id, r.relations]));
  const geaendert = new Set([...u.geaendert, ...reparatur.keys()]);
  const wegDatensaetze = daten.relations.filter((r) => !u.relations.some((x) => x.id === r.id)).map((r) => r.id);

  if (!probe) {
    for (const item of u.items) {
      if (!geaendert.has(item.id)) continue;
      const relations = reparatur.get(item.id) ?? item.relations;
      speicher.itemSetzen(brett, item.id, { ...item, relations });
    }
    for (const id of wegDatensaetze) speicher.relationLoeschen(brett, id);
  }
  console.log(
    `${brett}: ${geaendert.size} Karten ${verb} · ${u.faedenUmgezogen} Fäden umgezogen · ` +
      `${u.faedenVerwaist.length} Fäden ohne Voraussetzung · ${reparatur.size} Karten mit Fäden ins Leere`,
  );
}
speicher.schliessen();
