// Das Umzugsskript auf toolkit 0.3.0: Fäden-Datensätze → eingebettet an der
// Voraussetzung, `wantsToLearn` → `assignedTo` mit Rolle `learns`. Läuft
// gegen eine eigene Datei, mit `--probe` ohne zu schreiben, und zweimal
// hintereinander ohne zweite Änderung.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Speicher } from "../speicher.mjs";
import { FADEN_PRAEDIKAT, KARTEN_TYP, ZIEL_TYP, faeden, zugewiesen } from "../modell.mjs";

const SKRIPT = path.join(import.meta.dirname, "..", "scripts", "umzug-register.mjs");

function datenbank() {
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kb-umzug-")), "t.sqlite");
  const s = new Speicher(datei);
  const karte = (id, rel = []) => ({ id, type: KARTEN_TYP, data: { title: id, stage: 0 }, relations: [{ predicate: "partOf", target: "item:z" }, ...rel] });
  s.rlsErsetzen("eins", {
    group: { name: "Eins", data: {} },
    items: [
      { id: "z", type: ZIEL_TYP, data: { title: "Z", dots: 3 } },
      karte("a", [{ predicate: "wantsToLearn", target: "global:user:timo" }]),
      karte("b"),
    ],
    relations: [
      { id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b", createdBy: "x", createdAt: "2026-01-01T00:00:00Z" },
      { id: "r2", predicate: FADEN_PRAEDIKAT, from: "item:weg", to: "item:b", createdBy: "x", createdAt: "2026-01-01T00:00:00Z" },
    ],
  });
  s.rlsErsetzen("zwei", {
    group: { name: "Zwei", data: {} },
    items: [karte("c", [{ predicate: FADEN_PRAEDIKAT, target: "item:fehlt" }])],
    relations: [],
  });
  s.schliessen();
  return datei;
}

const lauf = (...args) => execFileSync(process.execPath, [SKRIPT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const lies = (datei, brett) => {
  const s = new Speicher(datei);
  const b = s.rlsBrett(brett);
  s.schliessen();
  return b;
};

test("--probe zählt, schreibt aber nichts", () => {
  const datei = datenbank();
  const aus = lauf("--db", datei, "--probe");
  assert.match(aus, /eins: 1 Karten wären geändert/);
  assert.match(aus, /1 Fäden umgezogen/);
  assert.match(aus, /1 Fäden ohne Voraussetzung/);
  const b = lies(datei, "eins");
  assert.equal(b.relations.length, 2, "Datensätze noch da");
  assert.deepEqual(faeden(b.items), []);
});

test("der Umzug bettet Fäden ein, zieht „lernt“ um und repariert Fäden ins Leere — einmal", () => {
  const datei = datenbank();
  lauf("--db", datei);
  const eins = lies(datei, "eins");
  assert.deepEqual(eins.relations, []);
  assert.deepEqual(faeden(eins.items).map((f) => f.id), ["a>b"]);
  const a = eins.items.find((i) => i.id === "a");
  assert.deepEqual(zugewiesen(a, "learns"), ["user:timo"]);
  assert.ok(!a.relations.some((r) => r.predicate === "wantsToLearn"));
  const zwei = lies(datei, "zwei");
  assert.deepEqual(faeden(zwei.items), [], "Faden ins Leere entfernt");

  const nochmal = lauf("--db", datei);
  assert.match(nochmal, /eins: 0 Karten geändert/);
  assert.match(nochmal, /zwei: 0 Karten geändert/);
});

test("--brett beschränkt den Umzug auf ein Brett", () => {
  const datei = datenbank();
  lauf("--db", datei, "--brett", "zwei");
  assert.equal(lies(datei, "eins").relations.length, 2);
  assert.deepEqual(faeden(lies(datei, "zwei").items), []);
});
