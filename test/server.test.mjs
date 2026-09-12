import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import WebSocket from "ws";
import { erstelleServer } from "../server.mjs";
import { Speicher } from "../speicher.mjs";

let server, basis;
before(async () => {
  server = erstelleServer({ speicher: new Speicher() });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  basis = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const api = (pfad, init) => fetch(basis + pfad, { headers: { "content-type": "application/json" }, ...init });

test("liefert die Oberfläche unter / und unter /<brett>", async () => {
  for (const p of ["/", "/emil"]) {
    const r = await fetch(basis + p);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Karabirrdt/);
  }
  assert.equal((await fetch(basis + "/gibtesnicht.js")).status, 404);
});

test("Karte anlegen, lesen, löschen", async () => {
  let r = await api("/api/b/t1/tasks/k1", { method: "PUT", body: JSON.stringify({ title: "Traumkreis", goal: "z", stage: 0, deps: [] }) });
  assert.equal(r.status, 200);
  const brett = await (await api("/api/b/t1")).json();
  assert.equal(brett.tasks.k1.title, "Traumkreis");
  assert.equal(brett.tasks.k1.id, "k1");
  r = await api("/api/b/t1/tasks/k1", { method: "DELETE" });
  assert.equal(r.status, 200);
  assert.deepEqual((await (await api("/api/b/t1")).json()).tasks, {});
});

test("Meta wird auf drei Textfelder beschnitten", async () => {
  await api("/api/b/t2/meta", { method: "PUT", body: JSON.stringify({ name: "Garten", dream: "Es ist …", horizon: "2027", extra: 1 }) });
  assert.deepEqual((await (await api("/api/b/t2")).json()).meta, { name: "Garten", dream: "Es ist …", horizon: "2027" });
});

test("ungültige Kennungen und kaputtes JSON werden abgewiesen", async () => {
  assert.equal((await api("/api/b/Groß")).status, 400);
  assert.equal((await api("/api/b/t3/tasks/k%2F1", { method: "PUT", body: "{}" })).status, 400);
  assert.equal((await api("/api/b/t3/tasks/k1", { method: "PUT", body: "{kaputt" })).status, 400);
  assert.equal((await api("/api/b/t3/tasks/k1", { method: "PUT", body: "[1,2]" })).status, 400);
});

test("Änderungen erreichen alle, die dasselbe Brett offen haben, aber kein anderes", async () => {
  const oeffne = (brett) =>
    new Promise((resolve, reject) => {
      const ws = new WebSocket(basis.replace("http", "ws") + "/ws/" + brett);
      ws.on("open", () => resolve(ws));
      ws.on("error", reject);
    });
  const a = await oeffne("gleich"), b = await oeffne("gleich"), c = await oeffne("anders");
  const empfangen = [];
  c.on("message", (m) => empfangen.push(String(m)));
  const naechste = (ws) => new Promise((r) => ws.once("message", (m) => r(JSON.parse(m))));
  const [na, nb] = await Promise.all([
    naechste(a),
    naechste(b),
    api("/api/b/gleich/goals/z1", { method: "PUT", body: JSON.stringify({ title: "Ziel", dots: 1 }) }),
  ]);
  assert.deepEqual(na, { type: "goal", id: "z1", data: { title: "Ziel", dots: 1, id: "z1" } });
  assert.deepEqual(nb, na);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(empfangen.length, 0);
  for (const ws of [a, b, c]) ws.close();
});

test("Import ersetzt das Brett und meldet reset", async () => {
  await api("/api/b/t4/tasks/alt", { method: "PUT", body: JSON.stringify({ title: "alt" }) });
  const r = await api("/api/b/t4/import", { method: "POST", body: JSON.stringify({ meta: { name: "X" }, goals: { g: { title: "g" } }, tasks: {} }) });
  assert.equal(r.status, 200);
  const brett = await (await api("/api/b/t4")).json();
  assert.equal(brett.meta.name, "X");
  assert.deepEqual(brett.tasks, {});
  assert.equal(brett.goals.g.title, "g");
});
