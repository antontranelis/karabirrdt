#!/usr/bin/env node
// `/alt` einfrieren (Stopp-Punkt 4): ein statischer Export der alten Tabellen
// (`meta`/`ziele`/`karten`) je Brett, den die alte Seite nur noch liest.
//
//   npm run alt:einfrieren -- [--db <pfad>] [--aus <verzeichnis>]
//
// Schreibt `<aus>/index.json` (`{ eingefroren, bretter }`) und je Brett
// `<aus>/<brett>.json` (`{ meta, goals, tasks }`, die Form von
// `GET /api/b/<brett>`). Vorgabe für `--aus` ist `public/alt-daten`; dort
// findet `alt.html` den Export und schaltet auf „nur lesend“. Die Dateien
// enthalten echte Bretter und gehören nicht ins Repository (.gitignore).
// Gegen eine Kopie der Datenbank laufen lassen, nie gegen die laufende.
import fs from "node:fs";
import path from "node:path";
import { Speicher } from "../speicher.mjs";

export function einfrieren(speicher, aus, jetzt = new Date().toISOString()) {
  fs.mkdirSync(aus, { recursive: true });
  const bretter = speicher.bretter().filter((b) => speicher.hatAlt(b.brett));
  for (const { brett } of bretter) fs.writeFileSync(path.join(aus, `${brett}.json`), JSON.stringify(speicher.brett(brett)));
  fs.writeFileSync(path.join(aus, "index.json"), JSON.stringify({ eingefroren: jetzt, bretter }));
  return bretter.map((b) => b.brett);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
  };
  const datei = arg("db") ?? process.env.KARABIRRDT_DB ?? path.join(import.meta.dirname, "..", "data", "karabirrdt.sqlite");
  const aus = arg("aus") ?? path.join(import.meta.dirname, "..", "public", "alt-daten");
  if (!fs.existsSync(datei)) {
    console.error(`Keine Datenbank unter ${datei}`);
    process.exit(2);
  }
  const speicher = new Speicher(datei);
  const bretter = einfrieren(speicher, aus);
  speicher.schliessen();
  console.log(`Eingefroren · ${bretter.length} Bretter nach ${aus}: ${bretter.join(", ")}`);
}
