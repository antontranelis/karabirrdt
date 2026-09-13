// Die RLS-Seite der API: Items, Relations und Group je Brett, dazu die
// einmalige Migration eines alten Bretts.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { erstelleServer } from "../server.mjs";
import { Speicher } from "../speicher.mjs";
import { AUTOR, KARTEN_TYP, ZIEL_TYP, FADEN_PRAEDIKAT, ZUGEHOERIG_PRAEDIKAT, MODUL } from "../modell.mjs";

let server, basis, speicher;
before(async () => {
  speicher = new Speicher();
  server = erstelleServer({ speicher });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  basis = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const api = (pfad, init) => fetch(basis + pfad, { headers: { "content-type": "application/json" }, ...init });
const json = async (pfad) => (await api(pfad)).json();

test("ein leeres Brett liefert eine leere Group mit dem Modul", async () => {
  const b = await json("/api/b/leer/rls");
  assert.equal(b.group.id, "leer");
  assert.deepEqual(b.group.data.modules, [MODUL]);
  assert.deepEqual(b.items, []);
  assert.deepEqual(b.relations, []);
});

test("Items anlegen, lesen, löschen", async () => {
  let r = await api("/api/b/t1/items/z1", {
    method: "PUT",
    body: JSON.stringify({ type: ZIEL_TYP, createdBy: "u", data: { title: "Ziel", dots: 2, order: 0 } }),
  });
  assert.equal(r.status, 200);
  await api("/api/b/t1/items/k1", {
    method: "PUT",
    body: JSON.stringify({
      type: KARTEN_TYP,
      createdBy: "u",
      data: { title: "Karte", status: "open", stage: 3 },
      relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }],
    }),
  });
  const b = await json("/api/b/t1/rls");
  assert.deepEqual(b.items.map((i) => i.id).sort(), ["k1", "z1"]);
  const karte = b.items.find((i) => i.id === "k1");
  assert.equal(karte.id, "k1");
  assert.equal(karte.data.stage, 3);
  assert.ok(karte.createdAt, "der Server setzt createdAt, wenn keins mitkommt");

  assert.equal((await api("/api/b/t1/items/k1", { method: "DELETE" })).status, 200);
  assert.deepEqual((await json("/api/b/t1/rls")).items.map((i) => i.id), ["z1"]);
});

test("Relations anlegen und löschen", async () => {
  await api("/api/b/t2/relations/rel-a", {
    method: "PUT",
    body: JSON.stringify({ predicate: FADEN_PRAEDIKAT, from: "item:k1", to: "item:k2", createdBy: "u" }),
  });
  let b = await json("/api/b/t2/rls");
  assert.equal(b.relations.length, 1);
  assert.equal(b.relations[0].id, "rel-a");
  assert.equal(b.relations[0].from, "item:k1");
  await api("/api/b/t2/relations/rel-a", { method: "DELETE" });
  assert.deepEqual((await json("/api/b/t2/rls")).relations, []);
});

test("Group wird als Merge-Patch geschrieben, null löscht einen Schlüssel", async () => {
  await api("/api/b/t3/group", { method: "PUT", body: JSON.stringify({ name: "Garten", data: { name: "Garten", dream: "Es ist …" } }) });
  await api("/api/b/t3/group", { method: "PUT", body: JSON.stringify({ data: { horizon: "2027" } }) });
  let g = (await json("/api/b/t3/rls")).group;
  assert.equal(g.name, "Garten");
  assert.equal(g.data.dream, "Es ist …");
  assert.equal(g.data.horizon, "2027");
  await api("/api/b/t3/group", { method: "PUT", body: JSON.stringify({ data: { dream: null } }) });
  g = (await json("/api/b/t3/rls")).group;
  assert.equal(g.data.dream, undefined);
  assert.equal(g.data.horizon, "2027");
});

test("Import ersetzt das ganze Brett und nimmt beide Formate", async () => {
  await api("/api/b/t4/items/weg", { method: "PUT", body: JSON.stringify({ type: ZIEL_TYP, data: { title: "alt" } }) });
  // altes Format
  let r = await api("/api/b/t4/rls/import", {
    method: "POST",
    body: JSON.stringify({ meta: { name: "X", dream: "", horizon: "" }, goals: { g: { title: "g", dots: 1 } }, tasks: { k: { title: "k", goal: "g", stage: 2, deps: [] } } }),
  });
  assert.equal(r.status, 200);
  let b = await json("/api/b/t4/rls");
  assert.equal(b.group.data.name, "X");
  assert.deepEqual(b.items.map((i) => i.id).sort(), ["g", "k"]);
  assert.equal(b.items.find((i) => i.id === "k").type, KARTEN_TYP);
  // neues Format
  r = await api("/api/b/t4/rls/import", {
    method: "POST",
    body: JSON.stringify({ group: { data: { name: "Y" } }, items: [{ id: "n1", type: ZIEL_TYP, data: { title: "n" } }], relations: [] }),
  });
  assert.equal(r.status, 200);
  b = await json("/api/b/t4/rls");
  assert.equal(b.group.data.name, "Y");
  assert.deepEqual(b.items.map((i) => i.id), ["n1"]);
});

test("ein altes Brett wird beim ersten RLS-Zugriff einmalig übersetzt", async () => {
  await api("/api/b/t5/meta", { method: "PUT", body: JSON.stringify({ name: "Alt", dream: "Traum", horizon: "2027" }) });
  await api("/api/b/t5/goals/z", { method: "PUT", body: JSON.stringify({ title: "Ziel", dots: 4 }) });
  await api("/api/b/t5/tasks/a", { method: "PUT", body: JSON.stringify({ title: "A", goal: "z", stage: 0, deps: [] }) });
  await api("/api/b/t5/tasks/b", { method: "PUT", body: JSON.stringify({ title: "B", goal: "z", stage: 4, deps: ["a"] }) });

  const b = await json("/api/b/t5/rls");
  assert.equal(b.group.data.name, "Alt");
  assert.equal(b.group.data.dream, "Traum");
  assert.equal(b.items.find((i) => i.id === "z").type, ZIEL_TYP);
  const karte = b.items.find((i) => i.id === "b");
  assert.equal(karte.type, KARTEN_TYP);
  assert.equal(karte.data.stage, 4);
  assert.equal(karte.relations[0].target, "item:z");
  assert.equal(b.relations.length, 1);
  assert.equal(b.relations[0].from, "item:a");
  assert.equal(b.relations[0].to, "item:b");
  // Eine einzige Kennung für alle: sonst hätte dieselbe Kante je nach
  // Schreiber zwei Datensätze (Spec 08, Regel 4).
  assert.equal(b.relations[0].createdBy, AUTOR);
  assert.equal(b.items.find((i) => i.id === "b").createdBy, AUTOR);

  // einmalig: danach liegen die Daten wirklich da und ändern sich nicht mehr mit
  assert.ok(speicher.hatRls("t5"));
  await api("/api/b/t5/tasks/c", { method: "PUT", body: JSON.stringify({ title: "C", goal: "z", stage: 1 }) });
  assert.equal((await json("/api/b/t5/rls")).items.length, 3);
});

test("Änderungen erreichen die anderen Clients desselben Bretts", async () => {
  const ws = new WebSocket(basis.replace("http", "ws") + "/ws/live");
  await new Promise((r) => ws.on("open", r));
  const naechste = () => new Promise((r) => ws.once("message", (m) => r(JSON.parse(String(m)))));

  let [n] = await Promise.all([
    naechste(),
    api("/api/b/live/items/k9", { method: "PUT", body: JSON.stringify({ type: KARTEN_TYP, data: { title: "neu" } }) }),
  ]);
  assert.equal(n.type, "item");
  assert.equal(n.id, "k9");
  assert.equal(n.data.data.title, "neu");

  [n] = await Promise.all([naechste(), api("/api/b/live/items/k9", { method: "DELETE" })]);
  assert.deepEqual(n, { type: "item", id: "k9", data: null });

  [n] = await Promise.all([
    naechste(),
    api("/api/b/live/relations/rel-x", { method: "PUT", body: JSON.stringify({ predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }) }),
  ]);
  assert.equal(n.type, "relation");
  assert.equal(n.id, "rel-x");

  [n] = await Promise.all([naechste(), api("/api/b/live/group", { method: "PUT", body: JSON.stringify({ data: { name: "L" } }) })]);
  assert.equal(n.type, "group");
  assert.equal(n.data.data.name, "L");

  [n] = await Promise.all([naechste(), api("/api/b/live/rls/import", { method: "POST", body: JSON.stringify({ group: { data: {} }, items: [], relations: [] }) })]);
  assert.equal(n.type, "reset");
  assert.deepEqual(n.data.items, []);
  ws.close();
});

test("ohne Autor schreibt der Server die gemeinsame Kennung", async () => {
  await api("/api/b/t7/items/k1", { method: "PUT", body: JSON.stringify({ type: KARTEN_TYP, data: { title: "x" } }) });
  assert.equal((await json("/api/b/t7/rls")).items[0].createdBy, AUTOR);
});

test("alle Bretter als Groups, auch die noch nicht übersetzten", async () => {
  await api("/api/b/g-neu/group", { method: "PUT", body: JSON.stringify({ name: "Neues Brett", data: { name: "Neues Brett" } }) });
  await api("/api/b/g-alt/meta", { method: "PUT", body: JSON.stringify({ name: "Altes Brett", dream: "", horizon: "" }) });

  const gruppen = await json("/api/gruppen");
  const neu = gruppen.find((g) => g.id === "g-neu");
  assert.equal(neu.name, "Neues Brett");
  assert.deepEqual(neu.data.modules, [MODUL]);

  // Ein Brett, das es nur in der alten Form gibt, erscheint mit seinem Namen,
  // OHNE dass es dafür übersetzt werden müsste.
  const alt = gruppen.find((g) => g.id === "g-alt");
  assert.equal(alt.name, "Altes Brett");
  assert.deepEqual(alt.data.modules, [MODUL]);
  assert.equal(speicher.hatRls("g-alt"), false);

  // Ein Brett ohne jeden Namen heißt wie seine Adresse.
  await api("/api/b/g-namenlos/items/k", { method: "PUT", body: JSON.stringify({ type: KARTEN_TYP, data: {} }) });
  const namenlos = (await json("/api/gruppen")).find((g) => g.id === "g-namenlos");
  assert.equal(namenlos.name, "g-namenlos");
});

test("ein Brett löschen räumt beide Formen weg", async () => {
  await api("/api/b/weg/group", { method: "PUT", body: JSON.stringify({ name: "Weg", data: { name: "Weg" } }) });
  await api("/api/b/weg/items/k", { method: "PUT", body: JSON.stringify({ type: KARTEN_TYP, data: { title: "x" } }) });
  await api("/api/b/weg/relations/r", { method: "PUT", body: JSON.stringify({ predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }) });
  await api("/api/b/weg/tasks/alt", { method: "PUT", body: JSON.stringify({ title: "alt" }) });

  assert.equal((await api("/api/b/weg/rls", { method: "DELETE" })).status, 200);
  const b = await json("/api/b/weg/rls");
  assert.deepEqual(b.items, []);
  assert.deepEqual(b.relations, []);
  assert.equal(b.group.data.name, "");
  assert.equal((await json("/api/gruppen")).some((g) => g.id === "weg"), false);
});

test("kaputte Eingaben werden abgewiesen", async () => {
  assert.equal((await api("/api/b/t6/items/k%2F1", { method: "PUT", body: "{}" })).status, 400);
  assert.equal((await api("/api/b/t6/items/k1", { method: "PUT", body: "[1]" })).status, 400);
  assert.equal((await api("/api/b/t6/relations/r1", { method: "PUT", body: JSON.stringify({ predicate: "blocks" }) })).status, 400);
  assert.equal((await api("/api/b/t6/group", { method: "PUT", body: "null" })).status, 400);
  assert.equal((await api("/api/b/t6/rls/import", { method: "POST", body: "null" })).status, 400);
});

test("die alte Seite bleibt unter /alt erreichbar, die neue liegt auf /", async () => {
  for (const p of ["/", "/emil"]) {
    const r = await fetch(basis + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Karabirrdt/);
  }
  for (const p of ["/alt", "/alt/emil"]) {
    const r = await fetch(basis + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Dragon Dreaming/);
  }
});
