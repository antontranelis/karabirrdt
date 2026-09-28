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
  relationItemVonRecord,
  recordVonRelationItem,
  zielVonKarte,
  zieleSortiert,
  kartenInZelle,
  voraussetzungen,
  nachfolger,
  fadenFehler,
  verschiebenFehler,
  MASSE,
  spaltenX,
  layout,
  fadenPfad,
  faeden,
  mitFaden,
  ohneFaden,
  fadenVerstoesse,
  neuerFadenVerstoss,
  faedenEinbetten,
  migriereLernen,
  umziehen,
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

test("altes Brett wird zu Group und Items, Fäden eingebettet", async () => {
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
  assert.deepEqual(karte.relations[0], { predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" });
  assert.equal(zielVonKarte(karte), "z1");

  assert.equal(rls.items.find((i) => i.id === "k2").data.status, "done");

  // Faden k1 → k2: eingebettet an der Voraussetzung, zeigt auf die abhängige Karte
  assert.deepEqual(rls.relations, []);
  const k1 = rls.items.find((i) => i.id === "k1");
  assert.deepEqual(
    k1.relations.filter((r) => r.predicate === FADEN_PRAEDIKAT),
    [{ predicate: FADEN_PRAEDIKAT, target: "item:k2" }],
  );
  assert.deepEqual(faeden(rls.items).map((f) => [f.from, f.to]), [["item:k1", "item:k2"]]);
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

test("die Zeilenhöhe folgt der gemessenen Zielkarte, wenn diese höher ist", () => {
  const ziele = [{ id: "z1", type: ZIEL_TYP, data: { title: "Z", dots: 0, order: 0 } }];
  const karten = [
    { id: "a", type: KARTEN_TYP, data: { title: "a", stage: 0, order: 0 }, relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }] },
  ];
  // Ziel höher als der Stapel → die Zeile richtet sich nach dem Ziel
  const hoch = layout(ziele, karten, { a: 90, z1: 300 });
  assert.equal(hoch.zeilen[0].h, 300 + MASSE.rowPad * 2);
  // Stapel höher als das Ziel → umgekehrt
  const flach = layout(ziele, karten, { a: 400, z1: 80 });
  assert.equal(flach.zeilen[0].h, 400 + MASSE.rowPad * 2);
  // Zwischen zwei Zielen bleibt der Abstand: die nächste Zeile beginnt erst
  // hinter der ganzen Höhe der vorigen.
  const zwei = layout(
    [...ziele, { id: "z2", type: ZIEL_TYP, data: { title: "Z2", dots: 0, order: 1 } }],
    karten,
    { a: 90, z1: 300 },
  );
  assert.equal(zwei.zeilen[1].y, zwei.zeilen[0].y + zwei.zeilen[0].h);
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


// --------------------------------------------------------- Mitglieder

import {
  ROLLE_KANN as KANN_PRAEDIKAT,
  ROLLE_LERNT as LERNT_PRAEDIKAT,
  ZUWEISUNG,
  LERNT_ALT,
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
  assert.ok(neu.relations.some((r) => r.target === `${GLOBAL}user:anton` && r.predicate === ZUWEISUNG && r.meta.role === "can"));
  assert.ok(neu.relations.some((r) => r.target === `${GLOBAL}user:emil` && r.predicate === ZUWEISUNG && r.meta.role === "learns"));
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
          { predicate: ZUWEISUNG, target: `${GLOBAL}user:anton` },
          { predicate: ZUWEISUNG, target: `${GLOBAL}user:emil`, meta: { role: "learns" } },
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

// ------------------------------------------------- Kürzel-Tabelle am Space

import { WER_NOTIZ, initialenTabelle, nachmigriereNotiz } from "../modell.mjs";

const TABELLE = {
  AT: "user:anton",
  DEK: "user:emil",
  JR: "user:janosch",
  AB: "user:agnes",
  JL: "user:jonathan",
  TM: "user:timo",
  HT: "user:holger",
};

test("die Tabelle am Space geht vor der Ableitung aus den Namen", () => {
  const auf = initialenTabelle(MITGLIEDER, TABELLE);
  // aus der Tabelle
  assert.equal(auf.get("DEK"), "user:emil");
  assert.equal(auf.get("JR"), "user:janosch");
  // abgeleitet, weil die Tabelle nichts sagt
  assert.equal(auf.get("JN"), "user:janis");
  // Groß-/Kleinschreibung ist egal
  assert.equal(initialenTabelle(MITGLIEDER, { at: "user:anton" }).get("AT"), "user:anton");
  // eine Tabelle auf ein unbekanntes Mitglied wird ignoriert
  assert.equal(initialenTabelle(MITGLIEDER, { XX: "user:niemand" }).get("XX"), undefined);
});

test("altes who nimmt zuerst die Tabelle", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: { title: "K", stage: 0, who: [{ ini: "DEK", can: true }, { ini: "JR", can: false }] },
    relations: [],
  };
  const { item, unbekannt } = migriereWho(karte, MITGLIEDER, TABELLE);
  assert.deepEqual(zugewiesen(item, KANN_PRAEDIKAT), ["user:emil"]);
  assert.deepEqual(zugewiesen(item, LERNT_PRAEDIKAT), ["user:janosch"]);
  assert.deepEqual(unbekannt, []);
});

test("zurück ins alte Format gewinnt ebenfalls die Tabelle", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: { title: "K", stage: 0 },
    relations: [{ predicate: ZUWEISUNG, target: `${GLOBAL}user:emil` }],
  };
  const alt = rlsNachAlt({ group: { id: "b", name: "", data: {} }, items: [karte], relations: [] }, MITGLIEDER, TABELLE);
  assert.deepEqual(alt.tasks.k.who, [{ ini: "DEK", can: true }]);
});

test("die Nachmigration löst die Kürzel aus der Notiz auf und räumt sie weg", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: { title: "K", stage: 0, description: `Etwas Wichtiges\n\n${WER_NOTIZ}AT, DEK, QQ` },
    relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z" }],
  };
  const { item, geaendert, offen } = nachmigriereNotiz(karte, MITGLIEDER, TABELLE);
  assert.equal(geaendert, true);
  assert.deepEqual(zugewiesen(item, KANN_PRAEDIKAT), ["user:anton", "user:emil"]);
  assert.equal(zielVonKarte(item), "z", "die Zeile bleibt");
  assert.match(item.data.description, /Etwas Wichtiges/);
  // Was sich weiterhin niemandem zuordnen lässt, bleibt als Notiz stehen
  assert.ok(item.data.description.includes(`${WER_NOTIZ}QQ`));
  assert.deepEqual(offen, ["QQ"]);

  // idempotent: ein zweiter Lauf ändert nichts mehr
  const zweiter = nachmigriereNotiz(item, MITGLIEDER, TABELLE);
  assert.equal(zweiter.geaendert, false);
  assert.equal(zweiter.item, item);
});

test("die Nachmigration lässt alles in Ruhe, was keine Wer-Notiz trägt", () => {
  const karte = { id: "k", type: KARTEN_TYP, data: { title: "K", description: "vorgesehen für Holger" }, relations: [] };
  const { item, geaendert } = nachmigriereNotiz(karte, MITGLIEDER, TABELLE);
  assert.equal(geaendert, false);
  assert.equal(item, karte);
  assert.equal(item.data.description, "vorgesehen für Holger", "der Vermerk bleibt");
  // auch wenn beides dasteht, wird nur die Wer-Zeile angefasst
  const beides = {
    id: "b",
    type: KARTEN_TYP,
    data: { title: "B", description: `vorgesehen für Holger\n\n${WER_NOTIZ}AT` },
    relations: [],
  };
  const r = nachmigriereNotiz(beides, MITGLIEDER, TABELLE);
  assert.deepEqual(zugewiesen(r.item, KANN_PRAEDIKAT), ["user:anton"]);
  assert.equal(r.item.data.description.trim(), "vorgesehen für Holger");
});

test("die Nachmigration nimmt ein noch vorhandenes who mit seinen Rollen", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: { title: "K", who: [{ ini: "AT", can: true }, { ini: "TM", can: false }] },
    relations: [],
  };
  const { item, geaendert } = nachmigriereNotiz(karte, MITGLIEDER, TABELLE);
  assert.equal(geaendert, true);
  assert.deepEqual(zugewiesen(item, KANN_PRAEDIKAT), ["user:anton"]);
  assert.deepEqual(zugewiesen(item, LERNT_PRAEDIKAT), ["user:timo"]);
  assert.equal(item.data.who, undefined);
});

// ------------------------------------------------------- Löschen mit Anhang

import { kaskade, verwaisteFaeden } from "../modell.mjs";

const brettZumLoeschen = () => {
  const ziel = (id) => ({ id, type: ZIEL_TYP, data: { title: id, dots: 0, order: 0 } });
  const karte = (id, zielId, nach = []) => ({
    id,
    type: KARTEN_TYP,
    data: { title: id, stage: 0, order: 0 },
    relations: [
      { predicate: ZUGEHOERIG_PRAEDIKAT, target: `item:${zielId}` },
      ...nach.map((n) => ({ predicate: FADEN_PRAEDIKAT, target: `item:${n}` })),
    ],
  });
  // Fäden a→b, b→c (über die Zeile hinweg), c→c
  return [ziel("z1"), ziel("z2"), karte("a", "z1", ["b"]), karte("b", "z1", ["c"]), karte("c", "z2", ["c"])];
};

test("ein Ziel nimmt seine Zeile mit, und wer auf die Zeile zeigt, verliert den Faden", () => {
  const items = brettZumLoeschen();
  const weg = kaskade(items, "z1");
  assert.deepEqual(weg.items.sort(), ["a", "b", "z1"]);
  // c zeigt nicht in die Zeile, a und b gehen selbst — nichts zu ändern
  assert.deepEqual(weg.aendern, []);
});

test("eine Karte nimmt ihre Fäden mit: die eingehenden verschwinden an der Voraussetzung", () => {
  const items = brettZumLoeschen();
  const weg = kaskade(items, "b");
  assert.deepEqual(weg.items, ["b"]);
  assert.deepEqual(weg.aendern, [{ id: "a", relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }] }]);
});

test("übrig gebliebene Datensätze gehen beim Löschen mit", () => {
  const items = brettZumLoeschen();
  const alt = [{ id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:b", to: "item:c" }, { id: "r2", predicate: "x", from: "item:c", to: "item:z2" }];
  assert.deepEqual(kaskade(items, "b", alt).relations, ["r1"]);
});

test("was es nicht gibt, nimmt nichts mit", () => {
  assert.deepEqual(kaskade(brettZumLoeschen(), "gibtsnicht"), { items: ["gibtsnicht"], aendern: [], relations: [] });
});

test("Fäden ins Leere lassen sich reparieren", () => {
  const items = brettZumLoeschen();
  assert.deepEqual(verwaisteFaeden(items), []);
  const ohneB = items.filter((i) => i.id !== "b");
  assert.deepEqual(verwaisteFaeden(ohneB), [{ id: "a", relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: "item:z1" }] }]);
});

// ------------------------------------------------------- Fäden eingebettet

const kk = (id, stage, nach = [], zielId = "z") => ({
  id,
  type: KARTEN_TYP,
  data: { title: id, stage, order: 0 },
  relations: [
    { predicate: ZUGEHOERIG_PRAEDIKAT, target: `item:${zielId}` },
    ...nach.map((n) => ({ predicate: FADEN_PRAEDIKAT, target: `item:${n}` })),
  ],
});

test("Fäden liegen an der Voraussetzung und lassen sich als Sicht lesen", () => {
  const items = [kk("a", 0, ["b", "b"]), kk("b", 3), { id: "z", type: ZIEL_TYP, data: {}, relations: [{ predicate: FADEN_PRAEDIKAT, target: "item:a" }] }];
  // doppelt eingebettet zählt einmal; ein Ziel trägt keine Fäden
  assert.deepEqual(faeden(items), [{ id: "a>b", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }]);
  // Voraussetzungen und Nachfolger lesen dieselbe Sicht
  assert.deepEqual(voraussetzungen(faeden(items), "b"), ["a"]);
  assert.deepEqual(nachfolger(faeden(items), "a"), ["b"]);
  // space-qualifizierte Ziele zählen wie lokale
  assert.deepEqual(faeden([{ ...kk("a", 0), relations: [{ predicate: FADEN_PRAEDIKAT, target: "space:x/item:b" }] }])[0].to, "item:b");
});

test("Faden ziehen und lösen ändert nur die Relations der Voraussetzung", () => {
  const a = kk("a", 0);
  const mit = mitFaden(a, "b");
  assert.deepEqual(mit.at(-1), { predicate: FADEN_PRAEDIKAT, target: "item:b" });
  assert.equal(mitFaden({ ...a, relations: mit }, "b"), mit, "doppelt wird nichts");
  assert.deepEqual(ohneFaden({ ...a, relations: mit }, "b"), a.relations);
});

test("Regelverstöße: nach links, im Kreis, auf sich selbst", () => {
  assert.equal(fadenVerstoesse([kk("a", 0, ["b"]), kk("b", 3)]).size, 0);
  assert.match([...fadenVerstoesse([kk("a", 5, ["b"]), kk("b", 3)]).values()][0], /nur nach rechts/);
  assert.match([...fadenVerstoesse([kk("a", 3, ["a"])]).values()][0], /sich selbst/);
  assert.equal(fadenVerstoesse([kk("a", 3, ["b"]), kk("b", 3, ["a"])]).size, 2);
  // Nur NEUE Verstöße zählen — ein alter Rest blockiert nicht jede Änderung
  const vorher = [kk("a", 5, ["b"]), kk("b", 3), kk("c", 0)];
  assert.equal(neuerFadenVerstoss(vorher, vorher), null);
  assert.match(neuerFadenVerstoss(vorher, [kk("a", 5, ["b"]), kk("b", 3), kk("c", 6, ["b"])]), /nur nach rechts/);
});

test("Umzug: Fäden-Datensätze wandern an die Voraussetzung, Richtung bleibt", () => {
  const items = [kk("a", 0), kk("b", 3, ["c"]), kk("c", 4)];
  const relations = [
    { id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" },
    { id: "r2", predicate: FADEN_PRAEDIKAT, from: "item:b", to: "item:c" }, // schon eingebettet
    { id: "r3", predicate: FADEN_PRAEDIKAT, from: "item:weg", to: "item:b" }, // Voraussetzung fehlt
    { id: "r4", predicate: "anderes", from: "item:a", to: "item:c" },
  ];
  const f = faedenEinbetten(items, relations);
  assert.deepEqual(f.items.map((i) => i.id), ["a"], "nur a bekommt etwas dazu");
  assert.deepEqual(f.items[0].relations.at(-1), { predicate: FADEN_PRAEDIKAT, target: "item:b" });
  assert.deepEqual(f.entfernt, ["r1", "r2"]);
  assert.deepEqual(f.verwaist, ["r3"]);
});

test("Umzug: wantsToLearn wird assignedTo mit Rolle learns, assignedTo ohne Rolle bleibt", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: {},
    relations: [
      { predicate: ZUWEISUNG, target: "global:user:anton" },
      { predicate: LERNT_ALT, target: "global:user:timo" },
      { predicate: LERNT_ALT, target: "global:user:anton" }, // kann schon — die Kante bleibt
    ],
  };
  const { item, geaendert } = migriereLernen(karte);
  assert.equal(geaendert, true);
  assert.deepEqual(item.relations, [
    { predicate: ZUWEISUNG, target: "global:user:anton" },
    { predicate: ZUWEISUNG, target: "global:user:timo", meta: { role: "learns" } },
  ]);
  assert.deepEqual(zugewiesen(item, "can"), ["user:anton"]);
  assert.deepEqual(zugewiesen(item, "learns"), ["user:timo"]);
  const zweiter = migriereLernen(item);
  assert.equal(zweiter.geaendert, false);
  assert.equal(zweiter.item, item);
});

test("Umzug im Ganzen ist idempotent und lässt fremde Datensätze stehen", () => {
  const items = [kk("a", 0), { ...kk("b", 3), relations: [...kk("b", 3).relations, { predicate: LERNT_ALT, target: "global:u" }] }];
  const relations = [{ id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }, { id: "r9", predicate: "x", from: "item:a", to: "item:b" }];
  const erst = umziehen(items, relations);
  assert.deepEqual(erst.geaendert.sort(), ["a", "b"]);
  assert.equal(erst.faedenUmgezogen, 1);
  assert.deepEqual(erst.relations.map((r) => r.id), ["r9"]);
  const zweit = umziehen(erst.items, erst.relations);
  assert.deepEqual(zweit.geaendert, []);
  assert.deepEqual(zweit.items, erst.items);
});

test("Umzug: Aufwand 0 hieß „nicht geschätzt“ und fällt weg, jeder andere Wert bleibt", () => {
  const karte = (hours, euros) => ({ ...kk("a", 0), data: { title: "a", stage: 0, hours, euros } });
  const { items, geaendert } = umziehen([karte(0, 0), { ...karte(3, 0), id: "b" }, { ...karte(2, 40), id: "c" }], []);
  assert.deepEqual(items.map((i) => [i.data.hours, i.data.euros]), [[undefined, undefined], [3, undefined], [2, 40]]);
  assert.deepEqual(geaendert.sort(), ["a", "b"]);
  assert.equal("hours" in items[0].data, false);
  assert.deepEqual(umziehen(items, []).geaendert, []);
  // das alte Format liest fehlenden Aufwand weiter als 0
  assert.equal(rlsNachAlt({ items }).tasks.a.hours, 0);
});

test("ein Import im Format vor dem Umzug kommt umgezogen an", async () => {
  const alt = {
    group: { id: "b", name: "B", data: {} },
    items: [kk("a", 0), kk("b", 2)],
    relations: [{ id: "r1", predicate: FADEN_PRAEDIKAT, from: "item:a", to: "item:b" }],
  };
  const neu = await normalisiereRls(alt, { brett: "b" });
  assert.deepEqual(neu.relations, []);
  assert.deepEqual(faeden(neu.items).map((f) => f.id), ["a>b"]);
  // und zurück ins alte Format stimmen die deps
  assert.deepEqual(rlsNachAlt(neu).tasks.b.deps, ["a"]);
  // ein noch nicht umgezogenes Brett liefert die deps ebenfalls
  assert.deepEqual(rlsNachAlt(alt).tasks.b.deps, ["a"]);
});

test("Zuweisungen: eine Kante je Person, fremde Rollen bleiben erhalten", () => {
  const karte = {
    id: "k",
    type: KARTEN_TYP,
    data: {},
    relations: [
      { predicate: ZUWEISUNG, target: "global:user:x", meta: { role: "leads" } },
      { predicate: ZUWEISUNG, target: "global:user:anton" },
    ],
  };
  const rel = mitZuweisungen(karte, ["user:anton", "user:emil"], ["user:emil"]);
  assert.deepEqual(rel, [
    { predicate: ZUWEISUNG, target: "global:user:x", meta: { role: "leads" } },
    { predicate: ZUWEISUNG, target: "global:user:anton" },
    { predicate: ZUWEISUNG, target: "global:user:emil", meta: { role: "can" } },
  ]);
  assert.deepEqual(zugewiesen({ relations: rel }, "can"), ["user:anton", "user:emil"]);
  assert.deepEqual(zugewiesen({ relations: rel }, "learns"), []);
});


// ------------------------------------------- Entwurf „Brett-Dichte" (1a)

import { FADEN_STRICH, KACHEL, fadenStil, labelHoehe, zielKurz, zielRest } from "../modell.mjs";

test("das Spaltenraster leitet sich aus einer einzigen Kachelbreite ab", () => {
  assert.equal(KACHEL, 106, "gut 5 % schmaler als die dichte Kachel des Toolkits (112)");
  assert.equal(MASSE.colW, 110, "Spaltenraster mit 4 px Luft");
  assert.equal(MASSE.label, 192, "Zielspalte links");
  // Alle zwölf Stufen plus Zielspalte passen auf einen breiten Schirm.
  assert.ok(MASSE.start + MASSE.label + 12 * MASSE.colW + MASSE.end < 1700);
  assert.equal(MASSE.cardW, KACHEL);
  assert.equal(MASSE.colW, KACHEL + MASSE.luft);
  assert.equal(MASSE.head, MASSE.luft + MASSE.band + MASSE.luft + MASSE.stufe + MASSE.luft);
  assert.equal(spaltenX(0), MASSE.start + MASSE.label + MASSE.colW / 2);
  assert.equal(spaltenX(11) - spaltenX(10), MASSE.colW);
});

test("Fäden sind kubisch, mit mindestens 30 Auslenkung", () => {
  assert.equal(fadenPfad(0, 0, 100, 40), "M0,0 C50,0 50,40 100,40");
  // kurze Strecke: die Auslenkung bleibt bei 30
  assert.equal(fadenPfad(0, 0, 20, 40), "M0,0 C30,0 -10,40 20,40");
});

test("ein Faden in derselben Zeile trägt die Phasenfarbe der abhängigen Karte", () => {
  const karte = (id, stufe, ziel) => ({
    id,
    type: KARTEN_TYP,
    data: { title: id, stage: stufe },
    relations: [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: `item:${ziel}` }],
  });
  // Voraussetzung in Träumen, abhängige Karte in Handeln → Farbe von Handeln
  const gleich = fadenStil(karte("a", 0, "z1"), karte("b", 7, "z1"));
  assert.equal(gleich.farbe, "var(--kb-do)");
  assert.equal(gleich.gestrichelt, false);
  assert.equal(gleich.strich, FADEN_STRICH);

  // über Ziele hinweg: grau und gestrichelt
  const quer = fadenStil(karte("a", 0, "z1"), karte("c", 7, "z2"));
  assert.equal(quer.farbe, "var(--muted-foreground)");
  assert.equal(quer.gestrichelt, true);
  assert.equal(quer.strichmuster, "3 3");
});

test("der Zeilenkopf zerfällt in Kurztitel und Rest", () => {
  assert.equal(zielKurz("Team-Organisation: Aus einem Dokument heraus"), "Team-Organisation");
  assert.equal(zielRest("Team-Organisation: Aus einem Dokument heraus"), "Aus einem Dokument heraus");
  assert.equal(zielKurz("Ohne Doppelpunkt"), "Ohne Doppelpunkt");
  assert.equal(zielRest("Ohne Doppelpunkt"), "");
  assert.equal(zielKurz(""), "Ohne Titel");
});

test("die Höhe des Zeilenkopfs wächst mit dem Text und deckelt bei drei Zeilen", () => {
  const kurz = labelHoehe("Medien");
  const lang = labelHoehe("Medien: Ein Portfolio aus unterschiedlichen Medien, die mit unserer Vision, Konzepten und Werkzeugen gezielt verschiedene Zielgruppen ansprechen.");
  assert.ok(lang > kurz, "mehr Text, mehr Höhe");
  const sehrLang = labelHoehe("Medien: " + "sehr viel Text ".repeat(40));
  assert.equal(sehrLang, lang, "nach drei Zeilen wird abgeschnitten, nicht höher");
  // und die Zeile folgt dem gemessenen Block, nicht der Schätzung
  const ziele = [{ id: "z1", type: ZIEL_TYP, data: { title: "Z", dots: 0, order: 0 } }];
  assert.equal(layout(ziele, [], { z1: 140 }).zeilen[0].h, 140 + MASSE.rowPad * 2);
});
