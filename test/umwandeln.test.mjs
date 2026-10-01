// Export → Umwandeln → Import (Supabase-Umzug). Das Umwandeln ist rein und
// läuft ohne Netz; das Importieren schreibt über die Fähigkeiten des
// Data Interface (hier ein kleiner Connector im Arbeitsspeicher, live gegen
// den Testraum siehe docs/rls-kompatibel.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { FADEN_PRAEDIKAT, KARTEN_TYP, MODUL, ZIEL_TYP, faeden, zugewiesen } from "../modell.mjs";
import { importSperre, importiere, planeUmzug } from "../umwandeln.mjs";

/** Ein Export aus der Zeit vor `npm run umzug`, wie `GET /api/b/<brett>/rls` ihn liefert. */
function altExport() {
  const karte = (id, stufe, rel = []) => ({
    id,
    type: KARTEN_TYP,
    createdBy: "did:karabirrdt:tisch",
    createdAt: "2026-09-13T00:00:00Z",
    data: { title: id, stage: stufe, hours: 0, euros: 0 },
    relations: [{ predicate: "partOf", target: "item:z" }, ...rel],
  });
  return {
    group: { id: "real-life", name: "Real Life", data: { scope: "group", name: "Real Life", dream: "Traum", horizon: "2027", modules: [MODUL] } },
    items: [
      { id: "z", type: ZIEL_TYP, createdBy: "did:karabirrdt:tisch", createdAt: "2026-09-13T00:00:00Z", data: { title: "Z", dots: 3 } },
      karte("a", 0, [{ predicate: "assignedTo", target: "global:user:anton" }]),
      karte("b", 2, [{ predicate: "wantsToLearn", target: "global:user:emil" }]),
    ],
    relations: [
      { id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b", createdBy: "x", createdAt: "2026-01-01T00:00:00Z" },
      { id: "r2", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "space:anders/item:q", createdBy: "x", createdAt: "2026-01-01T00:00:00Z" },
    ],
    members: [
      { id: "user:anton", displayName: "Anton" },
      { id: "user:emil", displayName: "Emil" },
    ],
  };
}

test("planeUmzug: RLS-Form nach dem Umzug, Slug in Group.data, ohne Autor", async () => {
  const plan = await planeUmzug(altExport());
  assert.equal(plan.slug, "real-life");
  assert.equal(plan.group.name, "Real Life");
  assert.equal(plan.group.data.slug, "real-life");
  assert.deepEqual(plan.group.data.modules, [MODUL]);
  assert.equal(plan.group.data.dream, "Traum");
  assert.equal("name" in plan.group.data, false, "der Name steht in Group.name, nicht doppelt in data");
  // Autor ist, wer importiert (Stopp-Punkt 1): das Skript schickt keinen mit.
  for (const item of plan.items) {
    assert.equal("createdBy" in item, false);
    assert.equal("createdAt" in item, false);
  }
  // Fäden eingebettet, „will lernen" als Rolle, Aufwand 0 entfernt.
  assert.deepEqual(faeden(plan.items).map((f) => [f.from, f.to]), [["item:a", "item:b"]]);
  const b = plan.items.find((i) => i.id === "b");
  assert.deepEqual(zugewiesen(b, "learns"), ["user:emil"]);
  assert.equal("hours" in b.data, false);
});

test("planeUmzug: Datensätze in einen anderen Space werden nicht übernommen, sondern gemeldet", async () => {
  const plan = await planeUmzug(altExport());
  assert.deepEqual(plan.nichtUebernommen.map((r) => r.id), ["r2"]);
  assert.deepEqual(plan.datensaetze, []);
});

test("planeUmzug: Zuweisungen ohne Konto bleiben stehen und werden gezählt (Platzhalter offen)", async () => {
  const plan = await planeUmzug(altExport());
  assert.deepEqual(plan.ohneKonto, [
    { ziel: "global:user:anton", name: "Anton", karten: 1 },
    { ziel: "global:user:emil", name: "Emil", karten: 1 },
  ]);
  assert.deepEqual(plan.einladen, []);
});

test("planeUmzug: eine Zuordnung schreibt Zuweisungen auf vorhandene Konten um und lädt sie ein", async () => {
  const plan = await planeUmzug(altExport(), { zuordnung: { "user:anton": "8f0c-uuid" } });
  const a = plan.items.find((i) => i.id === "a");
  assert.deepEqual(zugewiesen(a, "can"), ["8f0c-uuid"]);
  assert.deepEqual(plan.einladen, ["8f0c-uuid"]);
  assert.deepEqual(plan.ohneKonto.map((o) => o.ziel), ["global:user:emil"]);
});

test("planeUmzug: eigener Slug, ungültiger Slug wird abgelehnt", async () => {
  assert.equal((await planeUmzug(altExport(), { slug: "kb-test-brett" })).group.data.slug, "kb-test-brett");
  await assert.rejects(() => planeUmzug(altExport(), { slug: "Kein Slug" }), /Slug/);
});

// --------------------------------------------------------------- Import

/** Ein Plan, in dem jedes Mitglied einem Konto zugeordnet ist (sonst hält der Import an). */
const zugeordnet = (json = altExport(), konten = { "user:anton": "u-anton", "user:emil": "u-emil" }) => planeUmzug(json, { zuordnung: konten });

/** Ein kleiner Connector mit den Fähigkeiten, die der Import braucht. */
function speicherConnector(ich = "ich") {
  const groups = [];
  const items = new Map(); // id → { item, group }
  const aufrufe = [];
  let n = 0;
  return {
    aufrufe,
    items,
    groups,
    groupScope: true,
    async getCurrentUser() {
      return { id: ich };
    },
    async getGroups() {
      return groups.map((g) => ({ ...g, data: { ...g.data } }));
    },
    async createGroup(name, data) {
      aufrufe.push(["createGroup", name]);
      const g = { id: `g${++n}`, name, data: data ?? {}, members: [ich] };
      groups.push(g);
      return g;
    },
    async updateGroup(id, aenderungen) {
      aufrufe.push(["updateGroup", id]);
      const g = groups.find((x) => x.id === id);
      Object.assign(g, aenderungen);
      return g;
    },
    async inviteMember(groupId, userId) {
      aufrufe.push(["inviteMember", userId]);
      groups.find((x) => x.id === groupId).members.push(userId);
    },
    async getItems(filter) {
      return [...items.values()].filter((e) => e.group === filter?.group).map((e) => structuredClone(e.item));
    },
    async createItem(item, optionen) {
      if (items.has(item.id)) throw new Error(`duplicate key value violates unique constraint "items_pkey"`);
      aufrufe.push(["createItem", item.id]);
      const gespeichert = { ...structuredClone(item), createdBy: ich, createdAt: "jetzt" };
      items.set(item.id, { item: gespeichert, group: optionen?.group });
      return gespeichert;
    },
    async updateItem(id, aenderungen) {
      aufrufe.push(["updateItem", id]);
      const e = items.get(id);
      e.item = { ...e.item, ...structuredClone(aenderungen) };
      return e.item;
    },
    async deleteItem(id) {
      aufrufe.push(["deleteItem", id]);
      items.delete(id);
    },
  };
}

test("importiere: legt die Group mit Slug an, übernimmt die Ids, Autor ist die importierende Person", async () => {
  const c = speicherConnector("anton-uuid");
  const plan = await zugeordnet();
  const bericht = await importiere(plan, c);
  assert.equal(bericht.gruppe.neu, true);
  assert.equal(c.groups.length, 1);
  assert.equal(c.groups[0].data.slug, "real-life");
  assert.deepEqual(bericht.angelegt.sort(), ["a", "b", "z"]);
  for (const { item, group } of c.items.values()) {
    assert.equal(group, c.groups[0].id);
    assert.equal(item.createdBy, "anton-uuid");
  }
});

test("importiere: ein zweiter Lauf ändert nichts (idempotent), eine Änderung wird nachgezogen", async () => {
  const c = speicherConnector();
  const plan = await zugeordnet();
  await importiere(plan, c);
  c.aufrufe.length = 0;
  const zweiter = await importiere(plan, c);
  assert.equal(zweiter.gruppe.neu, false);
  assert.deepEqual(zweiter.angelegt, []);
  assert.deepEqual(zweiter.geaendert, []);
  assert.equal(zweiter.gleich.length, 3);
  assert.deepEqual(c.aufrufe, []);

  const geaendert = await zugeordnet({ ...altExport(), items: altExport().items.map((i) => (i.id === "z" ? { ...i, data: { title: "Z neu", dots: 4 } } : i)) });
  const dritter = await importiere(geaendert, c);
  assert.deepEqual(dritter.geaendert, ["z"]);
  assert.equal(c.items.get("z").item.data.title, "Z neu");
});

test("importiere --probe: schreibt nichts und sagt, was geschähe", async () => {
  const c = speicherConnector();
  const bericht = await importiere(await zugeordnet(), c, { probe: true });
  assert.equal(bericht.gruppe.neu, true);
  assert.deepEqual(bericht.angelegt.sort(), ["a", "b", "z"]);
  assert.deepEqual(c.aufrufe, []);
});

test("importiere: eine Id, die schon in einem anderen Space liegt, ist ein Fehler je Item, kein Abbruch", async () => {
  const c = speicherConnector();
  await c.createItem({ id: "a", type: KARTEN_TYP, data: {} }, { group: "fremd" });
  const bericht = await importiere(await zugeordnet(), c);
  assert.deepEqual(bericht.fehler.map((f) => f.id), ["a"]);
  assert.deepEqual(bericht.angelegt.sort(), ["b", "z"]);
});

test("importiere: in eine gegebene Group, ersetzen entfernt nur Karten und Ziele, die der Import nicht kennt", async () => {
  const c = speicherConnector();
  const g = await c.createGroup("Offen", { slug: "offen", modules: [MODUL] });
  await c.createItem({ id: "alt", type: KARTEN_TYP, data: {} }, { group: g.id });
  await c.createItem({ id: "notiz", type: "comment", data: {} }, { group: g.id });
  const bericht = await importiere(await zugeordnet(), c, { gruppe: g.id, ersetzen: true });
  assert.equal(bericht.gruppe.id, g.id);
  assert.deepEqual(bericht.entfernt, ["alt"]);
  assert.ok(c.items.has("notiz"));
  // Der Slug der offenen Group bleibt; Traum und Horizont kommen aus dem Import.
  assert.equal(c.groups[0].data.slug, "offen");
  assert.equal(c.groups[0].data.dream, "Traum");
});

test("importiere: lädt zugeordnete Konten einmal ein", async () => {
  const c = speicherConnector();
  const plan = await zugeordnet();
  await importiere(plan, c);
  await importiere(plan, c);
  assert.deepEqual(c.aufrufe.filter(([art]) => art === "inviteMember"), [["inviteMember", "u-anton"], ["inviteMember", "u-emil"]]);
});

test("Skript --probe ohne Anmeldung: zeigt den Plan aus einer Datei und schreibt nichts", async () => {
  const { execFileSync } = await import("node:child_process");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const datei = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kb-import-")), "export.json");
  fs.writeFileSync(datei, JSON.stringify(altExport()));
  const env = { ...process.env };
  for (const k of ["KB_SUPABASE_ANON_KEY", "KB_EMAIL", "KB_PASSWORT"]) delete env[k];
  const aus = execFileSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "supabase-import.mjs"), "--quelle", datei, "--brett", "kb-test-x", "--probe"], { env, encoding: "utf8" });
  assert.match(aus, /Probe · Brett „Real Life“ → \/kb-test-x/);
  assert.match(aus, /3 Items · 0 Datensätze/);
  assert.match(aus, /ohne Konto: Anton \(global:user:anton\) an 1 Karten/);
  // Ohne --probe hält der Import vor dem Anmelden an.
  let fehler = null;
  try {
    execFileSync(process.execPath, [path.join(import.meta.dirname, "..", "scripts", "supabase-import.mjs"), "--quelle", datei], { env, encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    fehler = e;
  }
  assert.equal(fehler?.status, 2);
  assert.match(String(fehler?.stderr), /angehalten: Zuweisungen an Mitglieder ohne Konto/);
  assert.match(aus, /nicht übernommen .*r2/);
});

test("importiere hält an: Mitglieder ohne Konto (Platzhalter fehlen) oder ein Regelverstoß; schreibt dann nichts", async () => {
  const c = speicherConnector();
  await assert.rejects(async () => importiere(await planeUmzug(altExport()), c), /ohne Konto/);
  assert.deepEqual(c.aufrufe, []);
  // ausdrücklich erlaubt: unverändert übernehmen
  const b = await importiere(await planeUmzug(altExport()), c, { ohneKontoUebernehmen: true });
  assert.equal(b.angelegt.length, 3);

  const links = altExport();
  links.items.push({ id: "spaet", type: KARTEN_TYP, data: { title: "spät", stage: 9 }, relations: [{ predicate: "partOf", target: "item:z" }, { predicate: FADEN_PRAEDIKAT, target: "item:a" }] });
  const plan = await zugeordnet(links);
  assert.match(importSperre(plan), /Regelverstoß/);
  const c2 = speicherConnector();
  await assert.rejects(() => importiere(plan, c2), /Regelverstoß/);
  assert.deepEqual(c2.aufrufe, []);
});

test("importiere --ersetzen löscht nicht, wenn Schreiben scheiterte", async () => {
  const c = speicherConnector();
  const g = await c.createGroup("Offen", { slug: "offen", modules: [MODUL] });
  await c.createItem({ id: "alt", type: KARTEN_TYP, data: {} }, { group: g.id });
  await c.createItem({ id: "a", type: KARTEN_TYP, data: {} }, { group: "fremd" });
  const bericht = await importiere(await zugeordnet(), c, { gruppe: g.id, ersetzen: true });
  assert.deepEqual(bericht.fehler.map((f) => f.id), ["a"]);
  assert.equal(bericht.ersetzenAusgelassen, true);
  assert.deepEqual(bericht.entfernt, []);
  assert.ok(c.items.has("alt"));
});

test("importiere prüft den ENTSTEHENDEN Bestand: ein bleibender Faden darf durch den Import nicht nach links zeigen", async () => {
  const c = speicherConnector();
  const g = await c.createGroup("Offen", { slug: "offen", modules: [MODUL] });
  // vorhandene Voraussetzung in Stufe 2 → Faden auf b
  await c.createItem({ id: "v", type: KARTEN_TYP, data: { title: "v", stage: 2 }, relations: [{ predicate: "partOf", target: "item:z" }, { predicate: FADEN_PRAEDIKAT, target: "item:b" }] }, { group: g.id });
  c.aufrufe.length = 0;
  // Import bringt b in Stufe 0 (Original 2 → hier 0)
  const json = altExport();
  json.relations = [];
  json.items = json.items.map((i) => (i.id === "b" ? { ...i, data: { ...i.data, stage: 0 } } : i));
  await assert.rejects(async () => importiere(await zugeordnet(json), c, { gruppe: g.id }), /entstehenden Brett/);
  assert.deepEqual(c.aufrufe, []);
});

test("importiere: eine Id mit anderem Typ im Space ist ein Konflikt vor jedem Schreiben", async () => {
  const c = speicherConnector();
  const g = await c.createGroup("Offen", { slug: "offen", modules: [MODUL] });
  await c.createItem({ id: "z", type: KARTEN_TYP, data: {}, relations: [{ predicate: "partOf", target: "item:q" }] }, { group: g.id });
  c.aufrufe.length = 0;
  await assert.rejects(async () => importiere(await zugeordnet(), c, { gruppe: g.id }), /Typkonflikt/);
  assert.deepEqual(c.aufrufe, []);
});

test("importiere --ersetzen: eine gescheiterte Einladung verhindert das Löschen und steht im Bericht", async () => {
  const c = speicherConnector();
  const g = await c.createGroup("Offen", { slug: "offen", modules: [MODUL] });
  await c.createItem({ id: "alt", type: KARTEN_TYP, data: {}, relations: [{ predicate: "partOf", target: "item:z" }] }, { group: g.id });
  c.inviteMember = async () => {
    throw new Error("kein Recht");
  };
  const bericht = await importiere(await zugeordnet(), c, { gruppe: g.id, ersetzen: true });
  assert.ok(bericht.fehler.some((f) => /Einladung/.test(f.id)));
  assert.equal(bericht.ersetzenAusgelassen, true);
  assert.ok(c.items.has("alt"));
});
