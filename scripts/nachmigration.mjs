#!/usr/bin/env node
// Nachmigration: Karten, an denen noch alte Kürzel hängen, bekommen ihre
// Zuweisungen an Mitglieder des Spaces. Die Zuordnung kommt aus
// `Group.data.initialen` — Daten am Brett, nicht im Code. Zweimal laufen
// ändert nichts; dasselbe Skript läuft später auf dem Server.
//
//   npm run nachmigration -- --brett real-life [--db pfad] [--probe]
import path from "node:path";
import { Speicher, gueltigeKennung } from "../speicher.mjs";
import { WER_NOTIZ, istKarte, nachmigriereNotiz, verwaisteFaeden } from "../modell.mjs";

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

const brett = argumente.get("brett");
const probe = argumente.has("probe");
const datei = argumente.get("db") ?? process.env.KARABIRRDT_DB ?? path.join(import.meta.dirname, "..", "data", "karabirrdt.sqlite");

if (!brett || !gueltigeKennung(brett)) {
  console.error("Aufruf: npm run nachmigration -- --brett <kennung> [--db <pfad>] [--probe]");
  process.exit(2);
}

const speicher = new Speicher(datei);
const daten = speicher.rlsBrett(brett);
const mitglieder = speicher.mitglieder(brett);
const tabelle = (daten.group?.data?.initialen ?? {});

console.log(`Brett ${brett} · ${mitglieder.length} Mitglieder · ${Object.keys(tabelle).length} Kürzel in der Tabelle`);
if (!mitglieder.length) {
  console.error("Ohne Mitglieder gibt es nichts zuzuordnen.");
  process.exit(1);
}

let geaendert = 0;
const offeneKarten = [];
for (const item of daten.items) {
  if (!istKarte(item)) continue;
  const ergebnis = nachmigriereNotiz(item, mitglieder, tabelle);
  if (ergebnis.geaendert) {
    geaendert++;
    if (!probe) speicher.itemSetzen(brett, item.id, ergebnis.item);
  }
  const text = ergebnis.item.data?.description;
  if (typeof text === "string" && text.includes(WER_NOTIZ)) {
    offeneKarten.push({ id: item.id, titel: String(item.data?.title ?? ""), offen: ergebnis.offen });
  }
}

console.log(`${geaendert} Karten ${probe ? "wären geändert" : "geändert"}.`);

// Reste früherer Löschungen: Fäden, deren Enden es nicht mehr gibt.
const verwaist = verwaisteFaeden(speicher.rlsBrett(brett).items, daten.relations);
if (verwaist.length) {
  if (!probe) for (const id of verwaist) speicher.relationLoeschen(brett, id);
  console.log(`${verwaist.length} Fäden ins Leere ${probe ? "wären entfernt" : "entfernt"}.`);
} else {
  console.log("Keine Fäden ins Leere.");
}
if (offeneKarten.length) {
  console.log(`${offeneKarten.length} Karten tragen weiterhin eine Wer-Notiz:`);
  for (const k of offeneKarten) console.log(`  ${k.id}  ${k.titel.slice(0, 48)}  (${k.offen.join(", ")})`);
} else {
  console.log("Keine Wer-Notiz bleibt übrig.");
}
speicher.schliessen();
