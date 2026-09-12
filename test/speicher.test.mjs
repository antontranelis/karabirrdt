import { test } from "node:test";
import assert from "node:assert/strict";
import { Speicher, gueltigeKennung } from "../speicher.mjs";

test("ein leeres Brett hat leere Sammlungen und leere Meta", () => {
  const s = new Speicher();
  assert.deepEqual(s.brett("haupt"), { meta: { name: "", dream: "", horizon: "" }, goals: {}, tasks: {} });
});

test("Ziele und Karten werden pro Brett gespeichert und überschrieben", () => {
  const s = new Speicher();
  s.zielSetzen("a", "z1", { title: "Ziel", dots: 2 });
  s.karteSetzen("a", "k1", { title: "Karte", goal: "z1", stage: 3, deps: [] });
  s.karteSetzen("b", "k1", { title: "Andere", goal: "x", stage: 0, deps: [] });
  s.karteSetzen("a", "k1", { title: "Karte neu", goal: "z1", stage: 4, deps: [] });
  const a = s.brett("a");
  assert.equal(a.goals.z1.title, "Ziel");
  assert.equal(a.goals.z1.id, "z1");
  assert.equal(a.tasks.k1.title, "Karte neu");
  assert.equal(a.tasks.k1.stage, 4);
  assert.equal(s.brett("b").tasks.k1.title, "Andere");
});

test("löschen entfernt nur die eine Karte", () => {
  const s = new Speicher();
  s.karteSetzen("a", "k1", { title: "1" });
  s.karteSetzen("a", "k2", { title: "2" });
  s.karteLoeschen("a", "k1");
  assert.deepEqual(Object.keys(s.brett("a").tasks), ["k2"]);
});

test("ersetzen tauscht das ganze Brett in einem Zug", () => {
  const s = new Speicher();
  s.zielSetzen("a", "alt", { title: "alt" });
  s.ersetzen("a", { meta: { name: "Neu", dream: "", horizon: "2027" }, goals: { n1: { title: "neu" } }, tasks: { k: { title: "k", goal: "n1", stage: 0 } } });
  const b = s.brett("a");
  assert.equal(b.meta.name, "Neu");
  assert.deepEqual(Object.keys(b.goals), ["n1"]);
  assert.equal(b.tasks.k.id, "k");
});

test("Brett-Kennungen sind kurz, klein und ohne Sonderzeichen", () => {
  assert.ok(gueltigeKennung("haupt"));
  assert.ok(gueltigeKennung("real-life-2027"));
  assert.ok(!gueltigeKennung("Groß"));
  assert.ok(!gueltigeKennung("../x"));
  assert.ok(!gueltigeKennung(""));
});

test("die Brett-Liste kennt auch Bretter, die nur Karten haben", () => {
  const s = new Speicher();
  s.karteSetzen("nur-karten", "k", { title: "k" });
  s.metaSetzen("mit-meta", { name: "M", dream: "", horizon: "" });
  assert.deepEqual(s.bretter().map((b) => b.brett).sort(), ["mit-meta", "nur-karten"]);
});
