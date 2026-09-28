// Das Karabirrdt in den Begriffen des Real Life Stack.
//
// Diese Datei ist die einzige Stelle, an der steht, wie ein Dragon-Dreaming-Brett
// auf Group, Items und RelationRecords abgebildet wird. Server (Migration,
// Import) und App (Anzeige, Regeln, Geometrie) benutzen sie gemeinsam; sie
// kennt weder DOM noch node-eigene Module und läuft darum in beiden Welten.
//
//   Brett  = Group (Space)   data: { name, dream, horizon, modules: ["karabirrdt"] }
//   Ziel   = Item  project   data: { title, description, dots, order }   → eine Zeile
//   Karte  = Item  task      data: { title, description, status, stage, hours, euros, order }
//            Zugehörigkeit zum Ziel als eingebettete Relation `partOf` (Spec 04, Regel 9:
//            wenige feste Forward-Beziehungen, vom Autor des Items gesetzt).
//   Faden  = eingebettete Relation `blocks` an der Voraussetzung, Ziel = abhängige Karte
//            (Stack-Register seit S3: „eingebettet am blockierenden Item, 0..n").
//   Wer    = eingebettete Relation `assignedTo` → `global:<userId>`, Qualifier
//            `meta.role`: `can` („kann") oder `learns` („lernt"); ohne Rolle gilt `can`.

export const VOCAB = {
  BASE: "https://real-life-stack.org/vocab/base/v1",
  TASK: "https://real-life-stack.org/vocab/task/v1",
  PROJECT: "https://real-life-stack.org/vocab/project/v1",
  RELATION: "https://real-life-stack.org/vocab/relation/v1",
};

export const KARTEN_TYP = "task";
export const ZIEL_TYP = "project";
export const FADEN_PRAEDIKAT = "blocks";
export const ZUGEHOERIG_PRAEDIKAT = "partOf";
export const MODUL = "karabirrdt";

/** Die Adresse eines Bretts: klein, Ziffern, Bindestriche. */
export const KENNUNG = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * Aus einem Namen eine freie Brett-Adresse machen. Der Server kennt keine
 * „anlegen"-Bewegung — `PUT /group` ist idempotent —, also entscheidet der
 * Client die Adresse und muss selbst dafür sorgen, kein fremdes Brett zu
 * überschreiben.
 */
export function freieKennung(name, belegt = []) {
  const stamm =
    String(name ?? "")
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "brett";
  const anfang = KENNUNG.test(stamm) ? stamm : `brett-${stamm}`.slice(0, 60);
  if (!belegt.includes(anfang)) return anfang;
  for (let n = 2; n < 1000; n++) if (!belegt.includes(`${anfang}-${n}`)) return `${anfang}-${n}`;
  return `${anfang}-${Date.now()}`;
}

/**
 * Die App kennt keine Anmeldung: wer das Brett offen hat, ist „am Tisch".
 * Diese eine Kennung steht in jedem `createdBy` — auch in dem, was der Server
 * bei der Migration schreibt. Sie muss überall dieselbe sein, weil sich die
 * Kennung eines RelationRecords aus ihr ableitet (Spec 08, Regel 4): mit zwei
 * Autoren entstünden zwei Fäden über denselben Endpunkten.
 */
export const AUTOR = "did:karabirrdt:tisch";

export const PHASEN = [
  { name: "Träumen", key: "dream", stufen: ["Bewusstsein", "Motivation", "Information"] },
  { name: "Planen", key: "plan", stufen: ["Alternativen", "Strategie", "Testen"] },
  { name: "Handeln", key: "do", stufen: ["Umsetzen", "Verwalten", "Beobachten"] },
  { name: "Feiern", key: "fete", stufen: ["Anerkennen", "Auswerten", "Weisheit"] },
];
export const STUFEN = PHASEN.flatMap((p) => p.stufen);
export const phaseVonStufe = (s) => PHASEN[Math.max(0, Math.min(3, Math.floor(s / 3)))];

// ---------------------------------------------------------------- Hilfsgriffe

export const istKarte = (item) => item?.type === KARTEN_TYP;
export const istZiel = (item) => item?.type === ZIEL_TYP;
const zahl = (v) => (Number.isFinite(+v) ? +v : 0);
const text = (v) => (typeof v === "string" ? v : "");
const ziel = (id) => `item:${id}`;
export const ohnePraefix = (target) => String(target ?? "").replace(/^(space:[^/]+\/)?item:/, "");

/** Zu welchem Ziel (welcher Zeile) gehört eine Karte. */
export function zielVonKarte(karte) {
  const r = (karte?.relations ?? []).find((x) => x?.predicate === ZUGEHOERIG_PRAEDIKAT);
  return r ? ohnePraefix(r.target) : null;
}

/** Die Relations einer Karte mit neuer Zeile. Andere Kanten bleiben stehen. */
export function mitZiel(karte, zielId) {
  const rest = (karte?.relations ?? []).filter((x) => x?.predicate !== ZUGEHOERIG_PRAEDIKAT);
  return [...rest, { predicate: ZUGEHOERIG_PRAEDIKAT, target: ziel(zielId) }];
}

export const stufeVon = (karte) => Math.max(0, Math.min(11, Math.round(zahl(karte?.data?.stage))));
export const istErledigt = (karte) => karte?.data?.status === "done";

/** Zeilen des Bretts: nach Punkten, dann eigener Reihenfolge, dann Titel. */
export function zieleSortiert(items) {
  return items
    .filter(istZiel)
    .slice()
    .sort(
      (a, b) =>
        zahl(b.data?.dots) - zahl(a.data?.dots) ||
        zahl(a.data?.order) - zahl(b.data?.order) ||
        text(a.data?.title).localeCompare(text(b.data?.title)),
    );
}

/** Alle Karten einer Zelle (Ziel × Stufe), in ihrer Reihenfolge. */
export function kartenInZelle(items, zielId, stufe) {
  return items
    .filter((i) => istKarte(i) && zielVonKarte(i) === zielId && stufeVon(i) === stufe)
    .sort(
      (a, b) =>
        zahl(a.data?.order) - zahl(b.data?.order) ||
        text(a.data?.title).localeCompare(text(b.data?.title)),
    );
}

// ------------------------------------------------------------------ Fäden
//
// Ein Faden liegt eingebettet an der Voraussetzung: `{ predicate: "blocks",
// target: "item:<abhängige Karte>" }`. So führt das Stack-Register die Kante
// seit S3 (TOOLKIT_RELATION_PREDICATES: „eingebettet am blockierenden Item,
// 0..n"); „Braucht" und „Ermöglicht" im Detail lesen und schreiben genau dort.
// Für Regeln, Geometrie und das alte Format sieht ein Faden aber weiter aus
// wie ein Datensatz `{ id, predicate, from, to }` — `faeden(items)` liefert
// diese Sicht, abgeleitet, nie gespeichert.

/** Die Kennung eines eingebetteten Fadens: aus seinen Enden, eindeutig je Paar. */
export const fadenSchluessel = (vonId, nachId) => `${vonId}>${nachId}`;

/** Alle Fäden des Bretts als Sicht `{ id, predicate, from, to }`. */
export function faeden(items) {
  const liste = [];
  const gesehen = new Set();
  for (const item of items ?? []) {
    if (!istKarte(item)) continue;
    for (const r of item.relations ?? []) {
      if (r?.predicate !== FADEN_PRAEDIKAT) continue;
      const nach = ohnePraefix(r.target);
      if (!nach) continue;
      const id = fadenSchluessel(item.id, nach);
      if (gesehen.has(id)) continue;
      gesehen.add(id);
      liste.push({ id, predicate: FADEN_PRAEDIKAT, from: ziel(item.id), to: ziel(nach) });
    }
  }
  return liste;
}

/** Die Relations der Voraussetzung mit einem Faden zu `nachId` (doppelt wird er nicht). */
export function mitFaden(item, nachId) {
  const rel = item?.relations ?? [];
  if (rel.some((r) => r?.predicate === FADEN_PRAEDIKAT && ohnePraefix(r.target) === nachId)) return rel;
  return [...rel, { predicate: FADEN_PRAEDIKAT, target: ziel(nachId) }];
}

/** Die Relations der Voraussetzung ohne den Faden zu `nachId`. */
export function ohneFaden(item, nachId) {
  return (item?.relations ?? []).filter((r) => !(r?.predicate === FADEN_PRAEDIKAT && ohnePraefix(r.target) === nachId));
}

/** Fäden, die in diese Karte laufen (ihre Voraussetzungen). */
export const voraussetzungen = (relations, id) =>
  relations.filter((r) => r.predicate === FADEN_PRAEDIKAT && ohnePraefix(r.to) === id).map((r) => ohnePraefix(r.from));
/** Fäden, die aus dieser Karte laufen (was danach kommt). */
export const nachfolger = (relations, id) =>
  relations.filter((r) => r.predicate === FADEN_PRAEDIKAT && ohnePraefix(r.from) === id).map((r) => ohnePraefix(r.to));

// ------------------------------------------------------------------- Regeln

/**
 * Darf zwischen diesen beiden Karten ein Faden liegen?
 * Gibt den Grund als Satz zurück, oder null, wenn es geht.
 */
export function fadenFehler(karten, relations, vonId, nachId) {
  if (vonId === nachId) return "Eine Karte kann nicht von sich selbst abhängen.";
  const v = karten.find((k) => k.id === vonId);
  const n = karten.find((k) => k.id === nachId);
  if (!v || !n) return "Die Karte gibt es nicht mehr.";
  if (stufeVon(v) > stufeVon(n))
    return "Fäden laufen nur nach rechts. Die Voraussetzung muss in einer früheren oder gleichen Stufe liegen.";
  const gegenlaeufig = relations.some(
    (r) => r.predicate === FADEN_PRAEDIKAT && ohnePraefix(r.from) === nachId && ohnePraefix(r.to) === vonId,
  );
  if (gegenlaeufig) return "Das wäre ein Kreis.";
  return null;
}

/** Darf diese Karte in diese Stufe? Fäden dürfen dabei nie nach links laufen. */
export function verschiebenFehler(karten, relations, id, neueStufe) {
  if (!Number.isInteger(neueStufe) || neueStufe < 0 || neueStufe > 11) return "Diese Stufe gibt es nicht.";
  const stufe = (kid) => {
    const k = karten.find((x) => x.id === kid);
    return k ? stufeVon(k) : null;
  };
  for (const v of voraussetzungen(relations, id)) {
    const s = stufe(v);
    if (s != null && s > neueStufe) return "So würde ein Faden nach links laufen. Erst die Fäden anpassen.";
  }
  for (const n of nachfolger(relations, id)) {
    const s = stufe(n);
    if (s != null && s < neueStufe) return "So würde ein Faden nach links laufen. Erst die Fäden anpassen.";
  }
  return null;
}

/**
 * Alle Fäden, die gegen die Regeln des Bretts verstoßen, mit Grund:
 * Faden auf sich selbst, Faden nach links, zwei Fäden gegeneinander.
 * Der Connector vergleicht vorher und nachher und lehnt eine Änderung ab,
 * die einen NEUEN Verstoß bringt — gleich, woher sie kommt (Formular,
 * Selbstaktion, Modul-Pick, Ziehen).
 */
export function fadenVerstoesse(items) {
  const karten = new Map((items ?? []).filter(istKarte).map((k) => [k.id, k]));
  const liste = faeden(items);
  const paare = new Set(liste.map((f) => fadenSchluessel(ohnePraefix(f.from), ohnePraefix(f.to))));
  const verstoesse = new Map();
  for (const f of liste) {
    const von = ohnePraefix(f.from);
    const nach = ohnePraefix(f.to);
    if (von === nach) verstoesse.set(f.id, "Eine Karte kann nicht von sich selbst abhängen.");
    else if (paare.has(fadenSchluessel(nach, von))) verstoesse.set(f.id, "Das wäre ein Kreis.");
    else {
      const v = karten.get(von);
      const n = karten.get(nach);
      if (v && n && stufeVon(v) > stufeVon(n))
        verstoesse.set(f.id, "Fäden laufen nur nach rechts. Die Voraussetzung muss in einer früheren oder gleichen Stufe liegen.");
    }
  }
  return verstoesse;
}

/** Der Grund des ersten Verstoßes, den `nachher` neu bringt, oder null. */
export function neuerFadenVerstoss(vorher, nachher) {
  const alt = fadenVerstoesse(vorher);
  for (const [id, grund] of fadenVerstoesse(nachher)) if (!alt.has(id)) return grund;
  return null;
}

// --------------------------------------------------------------- Geometrie

/**
 * Die Maße aus dem Entwurf „Brett-Dichte" (Variante 1a, Claude Design):
 * alle zwölf Stufen und sieben Ziele ohne Scrollen auf 1920 px.
 *
 * Alles hängt an EINER Zahl: `KACHEL`. Eine Kachel ist eine `ItemPreview`
 * in der Dichte `dense` (Toolkit 0.3.0, 112×61); das Brett setzt sie gut 5 %
 * schmaler (Anton, Vorschau zu rls#360). Spaltenbreite, Stufenmitten und
 * Kartenbreite folgen daraus.
 */
export const KACHEL = 106; // gut 5 % schmaler als die dichte Kachel des Toolkits (`density="dense"`, 112)
const LUFT = 4;

export const MASSE = {
  start: 16,
  label: 192, // Zielspalte links, 184–200 laut Entwurf
  kachel: KACHEL,
  luft: LUFT,
  colW: KACHEL + LUFT,
  cardW: KACHEL,
  cardH: 62, // Grundmaß der dichten Kachel, bis sie gemessen ist
  gap: LUFT,
  rowPad: 8,
  band: 20, // Höhe eines Phasenbandes
  stufe: 18, // Höhe der Stufenzeile
  head: LUFT + 20 + LUFT + 18 + LUFT, // Innenabstand oben, Band, Luft, Stufenzeile, Luft zur ersten Zeile
  end: 16,
};

/** Strichstärke der Fäden (Entwurf 1a). */
export const FADEN_STRICH = 1.2;

export const spaltenX = (s) => MASSE.start + MASSE.label + s * MASSE.colW + MASSE.colW / 2;

/** Der Kurztitel eines Ziels: was vor dem Doppelpunkt steht. */
export function zielKurz(titel) {
  const t = text(titel).trim();
  if (!t) return "Ohne Titel";
  const i = t.indexOf(":");
  return (i > 0 ? t.slice(0, i) : t).trim();
}

/** Der Rest dahinter — der ausführliche Satz des Ziels. */
export function zielRest(titel) {
  const t = text(titel).trim();
  const i = t.indexOf(":");
  return i > 0 ? t.slice(i + 1).trim() : "";
}

/**
 * Startwert für die Höhe eines Zeilenkopfs, solange er nicht gemessen ist:
 * Punktereihe, Kurztitel und bis zu drei Zeilen Rest (danach Auslassung).
 */
export function labelHoehe(titel) {
  const proZeile = Math.max(12, Math.floor((MASSE.label - 16) / 5.6));
  const zeilen = Math.min(3, Math.ceil(zielRest(titel).length / proZeile));
  return 10 + 16 + zeilen * 14;
}

/**
 * Zeilen, Kartenpositionen und Gesamtmaße des Rasters.
 *
 * `hoehen` sind die am DOM gemessenen Höhen der Karten: `ItemPreview` hat
 * keine feste Höhe — mit Tags und Zugewiesenen wird eine Karte höher als ohne.
 * Was nicht gemessen wurde, zählt mit `MASSE.cardH`.
 */
export function layout(ziele, karten, hoehen = {}) {
  const zeilen = [];
  const pos = {};
  const hoehe = (id) => Math.max(24, Number(hoehen[id]) || MASSE.cardH);
  let y = MASSE.head;
  for (const z of ziele) {
    let stapel = MASSE.cardH;
    for (let s = 0; s < 12; s++) {
      const liste = kartenInZelle(karten, z.id, s);
      if (!liste.length) continue;
      const summe = liste.reduce((a, k) => a + hoehe(k.id), 0) + (liste.length - 1) * MASSE.gap;
      stapel = Math.max(stapel, summe);
    }
    // Die Zielkarte ist eine Karte wie jede andere und wird genauso gemessen;
    // `labelHoehe` ist nur der Startwert, solange noch nichts gemessen wurde.
    const zielHoehe = Number(hoehen[z.id]) || labelHoehe(z.data?.title);
    const h = Math.max(stapel, zielHoehe) + MASSE.rowPad * 2;
    const zeile = { ziel: z, y, h };
    for (let s = 0; s < 12; s++) {
      let oben = y + MASSE.rowPad;
      for (const k of kartenInZelle(karten, z.id, s)) {
        pos[k.id] = { x: spaltenX(s) - MASSE.cardW / 2, y: oben, zeile };
        oben += hoehe(k.id) + MASSE.gap;
      }
    }
    zeilen.push(zeile);
    y += h;
  }
  return {
    zeilen,
    pos,
    hoehe: Math.max(y, MASSE.head + 160),
    breite: MASSE.start + MASSE.label + 12 * MASSE.colW + MASSE.end,
  };
}

/** Der Pfad eines Fadens: eine kubische Kurve von Kante zu Kante. */
export function fadenPfad(x1, y1, x2, y2) {
  const dx = Math.max(30, (x2 - x1) / 2);
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

/**
 * Wie ein Faden aussieht (Entwurf 1a): innerhalb einer Zeile in der
 * Phasenfarbe der ABHÄNGIGEN Karte — dort kommt er an, dorthin zieht er —,
 * über Zeilen hinweg grau und gestrichelt, damit man den Sprung sieht.
 */
export function fadenStil(von, nach) {
  const gleicheZeile = !!zielVonKarte(von) && zielVonKarte(von) === zielVonKarte(nach);
  return {
    farbe: gleicheZeile ? `var(--kb-${phaseVonStufe(stufeVon(nach)).key})` : "var(--muted-foreground)",
    gestrichelt: !gleicheZeile,
    strichmuster: gleicheZeile ? undefined : "3 3",
    strich: FADEN_STRICH,
  };
}

// ------------------------------------------------------------ Datensätze
//
// Fäden sind keine Datensätze mehr. Der Weg für RelationRecords bleibt: Der
// Server führt eine Ablage dafür, der Connector legt sie als Items vom Typ
// `relation` in den MockConnector (Spec 08: ein Record IST ein Item).

/** RelationRecord → Item mit `type: "relation"` (Spec 08: ein Record IST ein Item). */
export function relationItemVonRecord(rec) {
  return {
    id: rec.id,
    type: "relation",
    createdAt: rec.createdAt,
    createdBy: rec.createdBy,
    "@context": [VOCAB.BASE, VOCAB.RELATION],
    data: { predicate: rec.predicate, ...(rec.fields ?? {}) },
    relations: [
      { predicate: "from", target: rec.from },
      { predicate: "to", target: rec.to },
    ],
  };
}

/** Item mit `type: "relation"` → RelationRecord. null, wenn die Endpunkte fehlen. */
export function recordVonRelationItem(item) {
  if (item?.type !== "relation") return null;
  const end = (p) => (item.relations ?? []).filter((r) => r?.predicate === p);
  const from = end("from");
  const to = end("to");
  if (from.length !== 1 || to.length !== 1) return null;
  const { predicate, ...fields } = item.data ?? {};
  const rec = {
    id: item.id,
    predicate: String(predicate ?? ""),
    from: from[0].target,
    to: to[0].target,
    createdBy: item.createdBy,
    createdAt: item.createdAt,
  };
  if (Object.keys(fields).length) rec.fields = fields;
  return rec;
}

// ------------------------------------------------------------ Formate

export const istRlsFormat = (j) => !!j && typeof j === "object" && Array.isArray(j.items) && !!j.group;

export function leeresRls(brett = "haupt") {
  return {
    group: { id: brett, name: "", data: { scope: "group", name: "", dream: "", horizon: "", modules: [MODUL] } },
    items: [],
    relations: [],
  };
}

/** Altes Brett `{meta, goals, tasks}` → `{group, items, relations}`. */
export async function altNachRls({ meta, goals, tasks } = {}, { createdBy = AUTOR, createdAt = new Date().toISOString(), brett = "haupt", mitglieder = [] } = {}) {
  const m = { name: text(meta?.name), dream: text(meta?.dream), horizon: text(meta?.horizon) };
  const items = [];
  for (const [id, g] of Object.entries(goals ?? {})) {
    items.push({
      id,
      type: ZIEL_TYP,
      createdAt,
      createdBy,
      "@context": [VOCAB.BASE, VOCAB.PROJECT],
      data: { title: text(g?.title), dots: zahl(g?.dots), order: zahl(g?.order) },
    });
  }
  const karten = new Map();
  for (const [id, t] of Object.entries(tasks ?? {})) {
    const karte = {
      id,
      type: KARTEN_TYP,
      createdAt,
      createdBy,
      "@context": [VOCAB.BASE, VOCAB.TASK],
      data: {
        title: text(t?.title),
        description: text(t?.note),
        status: t?.done ? "done" : "open",
        stage: Math.max(0, Math.min(11, Math.round(zahl(t?.stage)))),
        who: Array.isArray(t?.who) ? t.who.map((w) => ({ ini: text(w?.ini), can: !!w?.can })) : [],
        ...(zahl(t?.hours) ? { hours: zahl(t.hours) } : {}),
        ...(zahl(t?.euros) ? { euros: zahl(t.euros) } : {}),
        order: zahl(t?.order),
      },
      relations: t?.goal ? [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: ziel(t.goal) }] : [],
    };
    // Mit bekannten Mitgliedern werden aus den Kürzeln gleich Zuweisungen;
    // ohne sie bleibt `who` stehen, statt still verloren zu gehen.
    karten.set(id, mitglieder.length ? migriereWho(karte, mitglieder).item : karte);
  }
  // Fäden: `deps` einer Karte nennt ihre Voraussetzungen; der Faden liegt
  // eingebettet an der Voraussetzung und zeigt auf die abhängige Karte.
  for (const [id, t] of Object.entries(tasks ?? {})) {
    for (const d of Array.isArray(t?.deps) ? t.deps : []) {
      const von = karten.get(String(d));
      if (von) karten.set(von.id, { ...von, relations: mitFaden(von, id) });
    }
  }
  items.push(...karten.values());
  return {
    group: { id: brett, name: m.name, data: { scope: "group", ...m, modules: [MODUL] } },
    items,
    relations: [],
  };
}

/** `{group, items, relations}` → altes Brett, für die alte Seite und alte Exporte. */
export function rlsNachAlt({ group, items = [], relations = [] } = {}, mitglieder = [], tabelle = {}) {
  const d = group?.data ?? {};
  const goals = {};
  const tasks = {};
  const ini = kuerzelFuer(mitglieder, tabelle);
  // Eingebettete Fäden, dazu Datensätze eines noch nicht umgezogenen Bretts.
  const alleFaeden = [...faeden(items), ...relations.filter((r) => r?.predicate === FADEN_PRAEDIKAT)];
  for (const i of items) {
    if (istZiel(i)) goals[i.id] = { id: i.id, title: text(i.data?.title), dots: zahl(i.data?.dots), order: zahl(i.data?.order) };
    else if (istKarte(i))
      tasks[i.id] = {
        id: i.id,
        title: text(i.data?.title),
        goal: zielVonKarte(i),
        stage: stufeVon(i),
        who: [
          ...zugewiesen(i, ROLLE_KANN).map((id) => ({ ini: ini.get(id) ?? id, can: true })),
          ...zugewiesen(i, ROLLE_LERNT).map((id) => ({ ini: ini.get(id) ?? id, can: false })),
          ...(Array.isArray(i.data?.who) ? i.data.who : []),
        ],
        hours: zahl(i.data?.hours),
        euros: zahl(i.data?.euros),
        done: istErledigt(i),
        deps: [...new Set(voraussetzungen(alleFaeden, i.id))],
        note: text(i.data?.description),
        order: zahl(i.data?.order),
      };
  }
  return { meta: { name: text(d.name), dream: text(d.dream), horizon: text(d.horizon) }, goals, tasks };
}

/**
 * Nimmt beide Formate an und liefert immer das RLS-Format in der heutigen
 * Form: Fäden eingebettet, „will lernen" als Rolle an `assignedTo`. Ein
 * Export aus der Zeit davor wird dabei umgezogen.
 */
export async function normalisiereRls(json, optionen = {}) {
  if (istRlsFormat(json)) {
    const leer = leeresRls(optionen.brett);
    const umzug = umziehen(json.items ?? [], json.relations ?? []);
    return {
      group: { ...leer.group, ...json.group, data: { ...leer.group.data, ...(json.group?.data ?? {}) } },
      items: umzug.items,
      relations: umzug.relations,
    };
  }
  return altNachRls(json ?? {}, optionen);
}

// -------------------------------------------------------------- Umzug 0.3
//
// Zwei Formen aus der Zeit vor toolkit 0.3.0 ziehen um:
//   1. Fäden als RelationRecord `blocks` (from = Voraussetzung, to = abhängige
//      Karte) → eingebettet an der Voraussetzung, gleiche Richtung.
//   2. „will lernen" als eigenes Prädikat `wantsToLearn` → `assignedTo` mit
//      `meta.role: "learns"`. Ein `assignedTo` ohne Rolle bleibt, wie es ist
//      (gilt als `can`).
// Beides ist idempotent: ein zweiter Lauf findet nichts mehr.

/**
 * Fäden-Datensätze in die Voraussetzung einbetten.
 * Liefert die geänderten Karten, die umgezogenen Datensätze (`entfernt`) und
 * die, deren Voraussetzung es nicht mehr gibt (`verwaist`, ebenfalls weg).
 */
export function faedenEinbetten(items, relations) {
  const nachId = new Map((items ?? []).map((i) => [i.id, i]));
  const geaendert = new Map();
  const entfernt = [];
  const verwaist = [];
  for (const r of relations ?? []) {
    if (r?.predicate !== FADEN_PRAEDIKAT) continue;
    const vonId = ohnePraefix(r.from);
    const nachKarte = ohnePraefix(r.to);
    const von = geaendert.get(vonId) ?? nachId.get(vonId);
    if (!von || !istKarte(von) || !nachId.has(nachKarte)) {
      verwaist.push(r.id);
      continue;
    }
    const rel = mitFaden(von, nachKarte);
    if (rel !== (von.relations ?? [])) geaendert.set(vonId, { ...von, relations: rel });
    entfernt.push(r.id);
  }
  return { items: [...geaendert.values()], entfernt, verwaist };
}

/** `wantsToLearn` → `assignedTo` mit Rolle `learns`. Wer schon zugewiesen ist, behält seine Kante. */
export function migriereLernen(item) {
  const rel = item?.relations ?? [];
  if (!rel.some((r) => r?.predicate === LERNT_ALT)) return { item, geaendert: false };
  const schon = new Set(rel.filter((r) => r?.predicate === ZUWEISUNG).map((r) => r.target));
  const neu = [];
  for (const r of rel) {
    if (r?.predicate !== LERNT_ALT) {
      neu.push(r);
      continue;
    }
    if (schon.has(r.target)) continue;
    schon.add(r.target);
    neu.push({ predicate: ZUWEISUNG, target: r.target, meta: { ...(r.meta ?? {}), role: ROLLE_LERNT } });
  }
  return { item: { ...item, relations: neu }, geaendert: true };
}

/** Aufwand 0 (Stunden, Euro) als „nicht geschätzt": das Feld fällt weg. */
export function ohneNullAufwand(item) {
  if (!istKarte(item)) return { item, geaendert: false };
  const d = item.data ?? {};
  if (d.hours !== 0 && d.euros !== 0) return { item, geaendert: false };
  const { hours, euros, ...rest } = d;
  const data = { ...rest, ...(hours !== 0 && hours !== undefined ? { hours } : {}), ...(euros !== 0 && euros !== undefined ? { euros } : {}) };
  return { item: { ...item, data }, geaendert: true };
}

/** Alles auf einmal, für Import und Umzugsskript. */
export function umziehen(items, relations) {
  const f = faedenEinbetten(items, relations);
  const weg = new Set([...f.entfernt, ...f.verwaist]);
  const ersetzt = new Map(f.items.map((i) => [i.id, i]));
  const geaendert = new Set(ersetzt.keys());
  const neu = (items ?? []).map((i) => {
    const basis = ersetzt.get(i.id) ?? i;
    const l = migriereLernen(basis);
    const n = ohneNullAufwand(l.item);
    if (l.geaendert || n.geaendert) geaendert.add(i.id);
    return n.item;
  });
  return {
    items: neu,
    relations: (relations ?? []).filter((r) => !weg.has(r.id)),
    geaendert: [...geaendert],
    faedenUmgezogen: f.entfernt.length,
    faedenVerwaist: f.verwaist,
  };
}

// ------------------------------------------------------------ Mitglieder
//
// „Wer" an einer Karte sind Zuweisungen an Mitglieder des Spaces, keine
// freien Kürzel mehr: die normale Task-Zuweisung `assignedTo`, eingebettet,
// Ziel `global:<userId>` (Spec 04). „Kann" oder „lernt" steht als Qualifier
// `meta.role` an der Kante (Spec 06, Regel 20: das Vokabular bringt die
// Register-Schicht der App mit, der Kern kennt nur den Schlüssel `role`).
// Eine Zuweisung ohne Rolle gilt als „kann".

export const GLOBAL = "global:";
export const ZUWEISUNG = "assignedTo";
export const ROLLE_KANN = "can";
export const ROLLE_LERNT = "learns";
/** Das frühere zweite Prädikat für „will lernen" — nur noch für den Umzug. */
export const LERNT_ALT = "wantsToLearn";

/** Die Rolle einer Zuweisung: `learns`, sonst `can` (auch ohne Angabe). */
const rolleVon = (r) => (r?.predicate === LERNT_ALT || r?.meta?.role === ROLLE_LERNT ? ROLLE_LERNT : r?.meta?.role ?? ROLLE_KANN);

/**
 * Die Initialen der Mitglieder, eindeutig innerhalb eines Bretts.
 * Zwei Namen → zwei Anfangsbuchstaben („Anton Tranelis" → AT), sonst die
 * ersten zwei Buchstaben („Emil" → EM). Wer zusammenstößt, weicht auf den
 * nächsten Buchstaben seines Vornamens aus („Janis" neben „Janosch" → JN).
 */
export function initialenFuer(mitglieder = []) {
  const ini = new Map();
  const belegt = new Set();
  for (const m of mitglieder) {
    const name = String(m?.displayName ?? "").trim();
    const worte = name ? name.split(/\s+/) : [];
    const erst = worte[0] ?? String(m?.id ?? "?").replace(/^[^:]*:/, "");
    const gross = (s) => String(s ?? "").toUpperCase();
    const kandidaten = [];
    if (worte.length > 1) kandidaten.push(gross(erst[0] + worte[1][0]));
    kandidaten.push(gross(erst.slice(0, 2)));
    for (let i = 1; i < erst.length; i++) kandidaten.push(gross(erst[0] + erst[i]));
    kandidaten.push(gross(String(m?.id ?? "?").slice(-2)));
    const gewaehlt = kandidaten.find((k) => k && k.length === 2 && !belegt.has(k)) ?? gross(String(m?.id ?? "?").slice(-2));
    belegt.add(gewaehlt);
    ini.set(m.id, gewaehlt);
  }
  return ini;
}

/**
 * Wer steht mit dieser Rolle an der Karte? `can` schließt Zuweisungen ohne
 * Rolle ein; `learns` liest auch das alte Prädikat, bis der Umzug gelaufen ist.
 * Eine Rolle, die keine der beiden ist, zählt zu keiner — sie bleibt aber am
 * Item stehen (Spec 06, Regel 20: Unbekanntes bewahren).
 */
export function zugewiesen(item, rolle) {
  const ids = [];
  for (const r of item?.relations ?? []) {
    if (r?.predicate !== ZUWEISUNG && r?.predicate !== LERNT_ALT) continue;
    if (!String(r.target ?? "").startsWith(GLOBAL)) continue;
    if (rolleVon(r) !== rolle) continue;
    const id = String(r.target).slice(GLOBAL.length);
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Die Relations einer Karte mit neuen Zuweisungen „kann" und „lernt". Alles
 * andere bleibt, auch eine vorhandene Kante mit passender Rolle wird nicht
 * neu geschrieben (ein `assignedTo` ohne Rolle bleibt ohne Rolle).
 */
export function mitZuweisungen(item, kann = [], lernt = []) {
  const alt = item?.relations ?? [];
  const istZuweisung = (r) => r?.predicate === ZUWEISUNG || r?.predicate === LERNT_ALT;
  const rest = alt.filter((r) => !istZuweisung(r));
  const vorhanden = (id, rolle) =>
    alt.find((r) => r?.predicate === ZUWEISUNG && r.target === GLOBAL + id && rolleVon(r) === rolle);
  const neu = [];
  const gesetzt = new Set();
  for (const [ids, rolle] of [[kann, ROLLE_KANN], [lernt, ROLLE_LERNT]]) {
    for (const id of ids) {
      if (gesetzt.has(id)) continue; // eine Kante je Person; „kann" geht vor
      gesetzt.add(id);
      neu.push(vorhanden(id, rolle) ?? { predicate: ZUWEISUNG, target: GLOBAL + id, meta: { role: rolle } });
    }
  }
  // Zuweisungen mit einer Rolle, die diese App nicht kennt, bleiben stehen.
  const fremd = alt.filter(
    (r) => r?.predicate === ZUWEISUNG && ![ROLLE_KANN, ROLLE_LERNT].includes(rolleVon(r)) && !gesetzt.has(String(r.target).slice(GLOBAL.length)),
  );
  return [...rest, ...fremd, ...neu];
}

/** Die Zeile, unter der unaufgelöste Kürzel in der Notiz stehen. */
export const WER_NOTIZ = "Wer (noch ohne Mitglied): ";

/**
 * Kürzel → Mitglied. Zuerst gilt die Tabelle am Space
 * (`Group.data.initialen`, die gewachsenen Kürzel des Teams), danach die
 * Ableitung aus den Namen. Einträge auf Nicht-Mitglieder werden übergangen.
 */
export function initialenTabelle(mitglieder = [], tabelle = {}) {
  const auf = new Map([...initialenFuer(mitglieder)].map(([id, ini]) => [ini, id]));
  const bekannt = new Set(mitglieder.map((m) => m.id));
  for (const [ini, id] of Object.entries(tabelle ?? {})) {
    if (bekannt.has(id)) auf.set(String(ini).toUpperCase(), id);
  }
  return auf;
}

/** Mitglied → Kürzel, mit derselben Rangfolge. */
export function kuerzelFuer(mitglieder = [], tabelle = {}) {
  const abgeleitet = initialenFuer(mitglieder);
  const bekannt = new Set(mitglieder.map((m) => m.id));
  for (const [ini, id] of Object.entries(tabelle ?? {})) {
    if (bekannt.has(id)) abgeleitet.set(id, String(ini).toUpperCase());
  }
  return abgeleitet;
}

/**
 * Das alte Feld `who` (freie Initialen mit „kann/lernt") auf die beiden
 * Zuweisungen abbilden. Was sich keinem Mitglied zuordnen lässt, wird an die
 * Notiz gehängt und zurückgemeldet — es verschwindet nicht still.
 */
export function migriereWho(item, mitglieder = [], tabelle = {}) {
  const who = item?.data?.who;
  if (!Array.isArray(who) || !who.length) return { item, unbekannt: [] };
  const nachIni = initialenTabelle(mitglieder, tabelle);
  const kann = [];
  const lernt = [];
  const unbekannt = [];
  for (const w of who) {
    const id = nachIni.get(String(w?.ini ?? "").toUpperCase());
    if (!id) {
      unbekannt.push(String(w?.ini ?? ""));
      continue;
    }
    ;(w?.can ? kann : lernt).push(id);
  }
  const { who: _weg, ...daten } = item.data;
  if (unbekannt.length) {
    const hinweis = WER_NOTIZ + unbekannt.join(", ");
    daten.description = daten.description ? `${daten.description}\n\n${hinweis}` : hinweis;
  }
  return { item: { ...item, data: daten, relations: mitZuweisungen(item, kann, lernt) }, unbekannt };
}

/**
 * Nachmigration: Karten, an denen noch Kürzel hängen, bekommen ihre
 * Zuweisungen. Zwei Quellen, in dieser Reihenfolge:
 *
 * 1. ein noch vorhandenes `who` — dort steht die Rolle (kann/lernt) mit dabei,
 * 2. die Notizzeile `Wer (noch ohne Mitglied): …` aus einem früheren Lauf —
 *    sie trägt nur Kürzel, also gilt „kann ich".
 *
 * Angefasst wird ausschließlich diese eine Zeile; jeder andere Text der Notiz
 * bleibt Wort für Wort stehen (ein Vermerk wie „vorgesehen für Holger" ist
 * eine Absicht, keine Zuweisung). Kürzel, die weiterhin zu niemandem gehören,
 * bleiben in der Zeile. Zweimal laufen ändert nichts.
 */
export function nachmigriereNotiz(item, mitglieder = [], tabelle = {}) {
  if (!istKarte(item)) return { item, geaendert: false, offen: [] };
  const nachIni = initialenTabelle(mitglieder, tabelle);
  const kann = new Set(zugewiesen(item, ROLLE_KANN));
  const lernt = new Set(zugewiesen(item, ROLLE_LERNT));
  const offen = [];
  let geaendert = false;

  for (const w of Array.isArray(item.data?.who) ? item.data.who : []) {
    const id = nachIni.get(String(w?.ini ?? "").toUpperCase());
    if (!id) offen.push(String(w?.ini ?? ""));
    else (w?.can ? kann : lernt).add(id);
    geaendert = true;
  }

  const text = typeof item.data?.description === "string" ? item.data.description : "";
  const zeile = text.split("\n").find((z) => z.trim().startsWith(WER_NOTIZ));
  if (zeile) {
    for (const roh of zeile.trim().slice(WER_NOTIZ.length).split(",")) {
      const k = roh.trim().toUpperCase();
      if (!k) continue;
      const id = nachIni.get(k);
      if (id) kann.add(id);
      else offen.push(k);
    }
    geaendert = true;
  }

  if (!geaendert) return { item, geaendert: false, offen: [] };

  const rest = offen.length ? WER_NOTIZ + [...new Set(offen)].join(", ") : null;
  const ohneZeile = text
    .split("\n")
    .filter((z) => !z.trim().startsWith(WER_NOTIZ))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const beschreibung = rest ? (ohneZeile ? `${ohneZeile}\n\n${rest}` : rest) : ohneZeile;

  const { who: _weg, ...daten } = item.data ?? {};
  const neu = {
    ...item,
    data: { ...daten, description: beschreibung },
    relations: mitZuweisungen(item, [...kann], [...lernt]),
  };
  // Nichts bewegt? Dann auch nichts schreiben — der zweite Lauf ist ruhig.
  const gleich =
    JSON.stringify(neu.data) === JSON.stringify(item.data) &&
    JSON.stringify(neu.relations) === JSON.stringify(item.relations ?? []);
  return gleich ? { item, geaendert: false, offen } : { item: neu, geaendert: true, offen };
}

// -------------------------------------------------------- Löschen mit Anhang

/**
 * Was mit diesem Item verschwinden muss, damit das Brett heil bleibt.
 *
 * Ein Ziel ist eine Zeile: mit ihm gehen die Karten dieser Zeile. Fäden
 * liegen eingebettet an der Voraussetzung; wer auf ein gelöschtes Item zeigt,
 * verliert diesen Faden (`aendern`: Item-Id und seine neuen Relations). Sonst
 * blieben Karten ohne Zeile (unsichtbar, aber in den Daten) und Fäden ins
 * Leere zurück. `relations` sind übrig gebliebene Datensätze, die ein
 * gelöschtes Item berühren (vor dem Umzug), und gehen ebenfalls mit.
 */
export function kaskade(items, id, relations = []) {
  const item = (items ?? []).find((i) => i.id === id);
  const weg = new Set([id]);
  if (item && istZiel(item)) {
    for (const k of items) if (istKarte(k) && zielVonKarte(k) === id) weg.add(k.id);
  }
  return {
    items: [...weg],
    aendern: fadenReste(items, weg),
    relations: [...new Set((relations ?? []).filter((r) => weg.has(ohnePraefix(r.from)) || weg.has(ohnePraefix(r.to))).map((r) => r.id))],
  };
}

/** Karten, deren eingebettete Fäden in `weg` zeigen, mit bereinigten Relations. */
function fadenReste(items, weg) {
  const aendern = [];
  for (const k of items ?? []) {
    if (weg.has(k.id) || !istKarte(k)) continue;
    const rel = k.relations ?? [];
    const rest = rel.filter((r) => !(r?.predicate === FADEN_PRAEDIKAT && weg.has(ohnePraefix(r.target))));
    if (rest.length !== rel.length) aendern.push({ id: k.id, relations: rest });
  }
  return aendern;
}

/** Fäden, deren Ziel es nicht mehr gibt — Reste früherer Löschungen, als Reparatur. */
export function verwaisteFaeden(items) {
  const da = new Set((items ?? []).map((i) => i.id));
  const fehlt = new Set();
  for (const f of faeden(items)) if (!da.has(ohnePraefix(f.to))) fehlt.add(ohnePraefix(f.to));
  return fadenReste(items, fehlt);
}
