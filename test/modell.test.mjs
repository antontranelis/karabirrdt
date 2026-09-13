// Prüft das gemeinsame Datenmodell: die Abbildung des alten Bretts auf
// RLS-Begriffe (Group, Items, RelationRecords) und zurück, die Faden-Regeln
// und die Geometrie des Rasters. Server und App benutzen dieselbe Datei.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHASEN,
  STUFEN,
  phaseVonStufe,
  VOCAB,
  KARTEN_TYP,
  ZIEL_TYP,
  FADEN_PRAEDIKAT,
  ZUGEHOERIG_PRAEDIKAT,
  altNachRls,
  rlsNachAlt,
  istRlsFormat,
  normalisiereRls,
  leeresRls,
  fadenId,
  relationItemVonRecord,
  recordVonRelationItem,
  zielVonKarte,
  zieleSortiert,
  kartenInZelle,
  fadenFehler,
  verschiebenFehler,
  MASSE,
  spaltenX,
  layout,
  fadenPfad,
} from "../modell.mjs";

test("zwölf Stufen in vier Phasen", () => {
  assert.equal(PHASEN.length, 4);
  assert.equal(STUFEN.length, 12);
  assert.equal(STUFEN[0], "Bewusstsein");
  assert.equal(STUFEN[11], "Weisheit");
  assert.equal(phaseVonStufe(0).key, "dream");
  assert.equal(phaseVonStufe(4).key, "plan");
  assert.equal(phaseVonStufe(8).key, "do");
  assert.equal(phaseVonStufe(11).key, "fete");
});

const altesBrett = {
  meta: { name: "Garten", dream: "Es ist …", horizon: "2027" },
  goals: {
    z1: { id: "z1", title: "Ziel A", dots: 3, order: 0 },
    z2: { id: "z2", title: "Ziel B", dots: 5, order: 1 },
  },
  tasks: {
    k1: { id: "k1", title: "Erste", goal: "z1", stage: 0, who: [{ ini: "AT", can: true }], hours: 4, euros: 20, done: false, deps: [], note: "Notiz", order: 1 },
    k2: { id: "k2", title: "Zweite", goal: "z1", stage: 3, who: [], hours: 0, euros: 0, done: true, deps: ["k1"], note: "", order: 2 },
  },
};

test("altes Brett wird zu Group, Items und RelationRecords", async () => {
  const rls = await altNachRls(altesBrett, { createdBy: "did:example:x", createdAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(rls.group.data.name, "Garten");
  assert.equal(rls.group.data.dream, "Es ist …");
  assert.equal(rls.group.data.horizon, "2027");
  assert.deepEqual(rls.group.data.modules, ["karabirrdt"]);

  const ziel = rls.items.find((i) => i.id === "z1");
  assert.equal(ziel.type, ZIEL_TYP);
  assert.equal(ziel.data.title, "Ziel A");
  assert.equal(ziel.data.dots, 3);
  assert.ok(ziel["@context"].includes(VOCAB.PROJECT));

  const karte = rls.items.find((i) => i.id === "k1");
  assert.equal(karte.type, KARTEN_TYP);
  assert.equal(karte.data.title, "Erste");
  assert.equal(karte.data.description, "Notiz");
  assert.equal(karte.data.status, "open");
  assert.equal(karte.data.stage, 0);
  assert.equal(karte.data.hours, 4);
  assert.equal(karte.data.euros, 20);
  assert.deepEqual(karte.data.who, [{ ini: "AT", can: true }]);
  assert.ok(karte["@context"].includes(VOCAB.TASK));
  // Zugehörigkeit zum Ziel als eingebettete Relation, nicht als Fremdschlüssel
  assert.deepEqual(karte.relations, [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }]);
  assert.equal(zielVonKarte(karte), "z1");

  assert.equal(rls.items.find((i) => i.id === "k2").data.status, "done");

  // Faden k1 → k2: die Voraussetzung blockiert die abhängige Karte
  assert.equal(rls.relations.length, 1);
  const faden = rls.relations[0];
  assert.equal(faden.predicate, FADEN_PRAEDIKAT);
  assert.equal(faden.from, "item:k1");
  assert.equal(faden.to, "item:k2");
  assert.equal(faden.id, await fadenId("did:example:x", "item:k1", "item:k2"));
});

test("RLS-Brett wird wieder zum alten Format", async () => {
  const rls = await altNachRls(altesBrett, { createdBy: "u", createdAt: "2026-01-01T00:00:00.000Z" });
  const alt = rlsNachAlt(rls);
  assert.deepEqual(alt.meta, altesBrett.meta);
  assert.equal(alt.goals.z2.title, "Ziel B");
  assert.equal(alt.goals.z2.dots, 5);
  assert.equal(alt.tasks.k1.title, "Erste");
  assert.equal(alt.tasks.k1.note, "Notiz");
  assert.equal(alt.tasks.k1.goal, "z1");
  assert.equal(alt.tasks.k1.hours, 4);
  assert.equal(alt.tasks.k2.done, true);
  assert.deepEqual(alt.tasks.k2.deps, ["k1"]);
});

test("beide JSON-Formate werden erkannt und vereinheitlicht", async () => {
  assert.equal(istRlsFormat({ group: {}, items: [], relations: [] }), true);
  assert.equal(istRlsFormat(altesBrett), false);
  const a = await normalisiereRls(altesBrett, { createdBy: "u", createdAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(a.items.length, 4);
  const b = await normalisiereRls(a, { createdBy: "u", createdAt: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(b.items.map((i) => i.id).sort(), ["k1", "k2", "z1", "z2"]);
  const leer = leeresRls();
  assert.deepEqual(leer.items, []);
  assert.deepEqual(leer.relations, []);
  assert.equal(leer.group.data.name, "");
});

test("Faden-Id ist deterministisch aus Autor, Prädikat und Endpunkten", async () => {
  const a = await fadenId("u", "item:a", "item:b");
  const b = await fadenId("u", "item:a", "item:b");
  const c = await fadenId("u", "item:b", "item:a");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^rel-[0-9a-f]{64}$/);
});

test("RelationRecord und Relation-Item sind dasselbe, zweimal geschrieben", () => {
  const rec = { id: "rel-1", predicate: "blocks", from: "item:a", to: "item:b", createdBy: "u", createdAt: "2026-01-01T00:00:00.000Z" };
  const item = relationItemVonRecord(rec);
  assert.equal(item.type, "relation");
  assert.equal(item.data.predicate, "blocks");
  assert.ok(item["@context"].includes(VOCAB.RELATION));
  assert.deepEqual(item.relations, [
    { predicate: "from", target: "item:a" },
    { predicate: "to", target: "item:b" },
  ]);
  assert.deepEqual(recordVonRelationItem(item), rec);
  assert.equal(recordVonRelationItem({ id: "x", type: "task", data: {}, relations: [] }), null);
});

test("Ziele sortieren nach Punkten, dann Reihenfolge, dann Titel", () => {
  const items = [
    { id: "a", type: ZIEL_TYP, data: { title: "A", dots: 1, order: 0 } },
    { id: "b", type: ZIEL_TYP, data: { title: "B", dots: 5, order: 1 } },
    { id: "c", type: ZIEL_TYP, data: { title: "C", dots: 5, order: 0 } },
    { id: "k", type: KARTEN_TYP, data: { title: "keine Zeile" } },
  ];
  assert.deepEqual(zieleSortiert(items).map((z) => z.id), ["c", "b", "a"]);
});

test("Karten einer Zelle kommen in ihrer Reihenfolge", () => {
  const karten = [
    { id: "k1", type: KARTEN_TYP, data: { title: "B", stage: 2, order: 5 }, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }] },
    { id: "k2", type: KARTEN_TYP, data: { title: "A", stage: 2, order: 1 }, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }] },
    { id: "k3", type: KARTEN_TYP, data: { title: "C", stage: 3, order: 1 }, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }] },
  ];
  assert.deepEqual(kartenInZelle(karten, "z", 2).map((k) => k.id), ["k2", "k1"]);
  assert.deepEqual(kartenInZelle(karten, "z", 3).map((k) => k.id), ["k3"]);
  assert.deepEqual(kartenInZelle(karten, "anderes", 2), []);
});

const karte = (id, stage) => ({ id, type: KARTEN_TYP, data: { title: id, stage, order: 0 }, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }] });

test("Fäden laufen nur nach rechts, nie im Kreis, nie auf sich selbst", () => {
  const karten = [karte("a", 0), karte("b", 3), karte("c", 3)];
  const fäden = [{ id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }];
  assert.equal(fadenFehler(karten, fäden, "a", "b"), null); // schon da → erlaubt (idempotent)
  assert.equal(fadenFehler(karten, fäden, "b", "c"), null); // gleiche Stufe ist erlaubt
  assert.match(fadenFehler(karten, fäden, "a", "a"), /sich selbst/);
  assert.match(fadenFehler(karten, fäden, "b", "a"), /nur nach rechts/);
  assert.match(fadenFehler(karten, fäden, "b", "a"), /nur nach rechts/);
  const mitKreis = [...fäden, { id: "r2", predicate: FADEN_PRAEDIKAT, from: "item:b", to: "item:c" }];
  assert.match(fadenFehler(karten, mitKreis, "c", "a"), /nur nach rechts|Kreis/);
});

test("Verschieben prüft, ob dabei ein Faden nach links liefe", () => {
  const karten = [karte("a", 0), karte("b", 3)];
  const fäden = [{ id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }];
  assert.equal(verschiebenFehler(karten, fäden, "b", 5), null);
  assert.equal(verschiebenFehler(karten, fäden, "b", 0), null); // gleiche Stufe erlaubt
  assert.match(verschiebenFehler(karten, fäden, "a", 4), /nach links/);
  assert.match(verschiebenFehler(karten, fäden, "b", -1), /Stufe/);
});

test("Raster: Spalten, Zeilenhöhen und Gesamtmaße", () => {
  const ziele = [
    { id: "z1", type: ZIEL_TYP, data: { title: "Ziel", dots: 1, order: 0 } },
    { id: "z2", type: ZIEL_TYP, data: { title: "Anderes", dots: 0, order: 1 } },
  ];
  const karten = [
    { ...karte("k1", 0), relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }] },
    { ...karte("k2", 0), relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }] },
  ];
  const L = layout(ziele, karten);
  assert.equal(L.zeilen.length, 2);
  assert.equal(L.zeilen[0].ziel.id, "z1");
  // zwei Karten übereinander in derselben Zelle → höhere Zeile
  assert.ok(L.zeilen[0].h > L.zeilen[1].h);
  assert.equal(L.zeilen[1].y, L.zeilen[0].y + L.zeilen[0].h);
  assert.equal(L.breite, MASSE.start + MASSE.label + 12 * MASSE.colW + MASSE.end);
  assert.equal(L.pos.k1.y, L.zeilen[0].y + MASSE.rowPad);
  assert.equal(L.pos.k2.y, L.zeilen[0].y + MASSE.rowPad + MASSE.cardH + MASSE.gap);
  assert.equal(L.pos.k1.x, spaltenX(0) - MASSE.cardW / 2);
});

test("gemessene Kartenhöhen bestimmen Stapel und Zeilenhöhe", () => {
  const ziele = [{ id: "z1", type: ZIEL_TYP, data: { title: "Z", dots: 0, order: 0 } }];
  const k = (id) => ({ id, type: KARTEN_TYP, data: { title: id, stage: 0, order: id }, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }] });
  const karten = [k("a"), k("b")];
  const L = layout(ziele, karten, { a: 200, b: 100 });
  assert.equal(L.pos.a.y, L.zeilen[0].y + MASSE.rowPad);
  assert.equal(L.pos.b.y, L.pos.a.y + 200 + MASSE.gap);
  assert.equal(L.zeilen[0].h, 200 + MASSE.gap + 100 + MASSE.rowPad * 2);
  // ohne Messung zählt das Grundmaß
  assert.equal(layout(ziele, karten).pos.b.y, layout(ziele, karten).pos.a.y + MASSE.cardH + MASSE.gap);
});

test("Fadenpfad: Bogen nach rechts, Umweg über den Zeilenrand, senkrecht in derselben Spalte", () => {
  assert.match(fadenPfad(0, 0, 100, 40), /^M0,0 C/);
  assert.ok(fadenPfad(0, 0, 100, 40, 90).includes("S"));
  const senkrecht = fadenPfad(50, 0, 50, 80, null, true);
  assert.match(senkrecht, /^M50,0 C6[0-9],/);
});

// --------------------------------------------------------- Mitglieder

import {
  KANN_PRAEDIKAT,
  LERNT_PRAEDIKAT,
  initialenFuer,
  zugewiesen,
  mitZuweisungen,
  migriereWho,
  GLOBAL,
} from "../modell.mjs";

const MITGLIEDER = [
  { id: "user:anton", displayName: "Anton Tranelis" },
  { id: "user:emil", displayName: "Emil" },
  { id: "user:agnes", displayName: "Agnes" },
  { id: "user:jonathan", displayName: "Jonathan" },
  { id: "user:janosch", displayName: "Janosch" },
  { id: "user:janis", displayName: "Janis" },
  { id: "user:holger", displayName: "Holger" },
  { id: "user:timo", displayName: "Timo" },
];

test("Initialen: zwei Namen ergeben zwei Anfangsbuchstaben, sonst die ersten zwei", () => {
  const ini = initialenFuer(MITGLIEDER);
  assert.equal(ini.get("user:anton"), "AT");
  assert.equal(ini.get("user:emil"), "EM");
  assert.equal(ini.get("user:agnes"), "AG");
  assert.equal(ini.get("user:jonathan"), "JO");
  assert.equal(ini.get("user:janosch"), "JA");
  // Janis stößt mit Janosch zusammen und weicht auf den nächsten Buchstaben aus
  assert.equal(ini.get("user:janis"), "JN");
  assert.equal(ini.get("user:holger"), "HO");
  assert.equal(ini.get("user:timo"), "TI");
  // alle verschieden
  assert.equal(new Set(ini.values()).size, MITGLIEDER.length);
  // ohne Namen bleibt die Kennung die Quelle
  assert.ok(initialenFuer([{ id: "user:x", displayName: "" }]).get("user:x"));
});

test("Zuweisungen liegen als Relationen am Item, nicht als eigenes Feld", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: { title: "K", stage: 0 },
    relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }],
  };
  const neu = { ...karte, relations: mitZuweisungen(karte, ["user:anton"], ["user:emil", "user:timo"]) };
  assert.deepEqual(zugewiesen(neu, KANN_PRAEDIKAT), ["user:anton"]);
  assert.deepEqual(zugewiesen(neu, LERNT_PRAEDIKAT), ["user:emil", "user:timo"]);
  // die Zeile bleibt unangetastet
  assert.equal(zielVonKarte(neu), "z");
  assert.ok(neu.relations.some((r) => r.target === `${GLOBAL}user:anton` && r.predicate === KANN_PRAEDIKAT));
  // leeren
  assert.deepEqual(zugewiesen({ ...neu, relations: mitZuweisungen(neu, [], []) }, KANN_PRAEDIKAT), []);
  assert.equal(zielVonKarte({ ...neu, relations: mitZuweisungen(neu, [], []) }), "z");
});

test("altes who wird auf die beiden Zuweisungen abgebildet", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: { title: "K", stage: 0, description: "Notiz", who: [{ ini: "AT", can: true }, { ini: "em", can: false }, { ini: "XY", can: true }] },
    relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }],
  };
  const { item, unbekannt } = migriereWho(karte, MITGLIEDER);
  assert.deepEqual(zugewiesen(item, KANN_PRAEDIKAT), ["user:anton"]);
  assert.deepEqual(zugewiesen(item, LERNT_PRAEDIKAT), ["user:emil"]);
  assert.equal(item.data.who, undefined, "das alte Feld verschwindet");
  assert.deepEqual(unbekannt, ["XY"]);
  // Was sich niemandem zuordnen lässt, geht nicht verloren
  assert.match(item.data.description, /Notiz/);
  assert.match(item.data.description, /XY/);

  // Ohne who bleibt die Karte, wie sie ist
  const ohne = { id: "o", type: KARTEN_TYP, data: { title: "O" }, relations: [] };
  assert.equal(migriereWho(ohne, MITGLIEDER).item, ohne);
});

test("der Import aus dem alten Format legt die Zuweisungen gleich richtig an", async () => {
  const rls = await altNachRls(
    { meta: {}, goals: { z: { title: "Z" } }, tasks: { k: { title: "K", goal: "z", stage: 0, who: [{ ini: "AT", can: true }, { ini: "JA", can: false }] } } },
    { createdBy: "u", createdAt: "2026-01-01T00:00:00.000Z", mitglieder: MITGLIEDER },
  );
  const karte = rls.items.find((i) => i.id === "k");
  assert.deepEqual(zugewiesen(karte, KANN_PRAEDIKAT), ["user:anton"]);
  assert.deepEqual(zugewiesen(karte, LERNT_PRAEDIKAT), ["user:janosch"]);
  assert.equal(karte.data.who, undefined);

  // Ohne bekannte Mitglieder bleibt who erhalten, statt still zu verschwinden
  const ohne = await altNachRls(
    { meta: {}, goals: {}, tasks: { k: { title: "K", who: [{ ini: "AT", can: true }] } } },
    { createdBy: "u", createdAt: "2026-01-01T00:00:00.000Z" },
  );
  assert.deepEqual(ohne.items[0].data.who, [{ ini: "AT", can: true }]);
});

test("zurück ins alte Format werden die Zuweisungen wieder zu who", () => {
  const rls = {
    group: { id: "b", name: "", data: {} },
    items: [
      {
        id: "k",
        type: KARTEN_TYP,
        data: { title: "K", stage: 1 },
        relations: [
          { predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" },
          { predicate: KANN_PRAEDIKAT, target: `${GLOBAL}user:anton` },
          { predicate: LERNT_PRAEDIKAT, target: `${GLOBAL}user:emil` },
        ],
      },
    ],
    relations: [],
  };
  const alt = rlsNachAlt(rls, MITGLIEDER);
  assert.deepEqual(alt.tasks.k.who, [
    { ini: "AT", can: true },
    { ini: "EM", can: false },
  ]);
});
