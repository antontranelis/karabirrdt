// Das Karabirrdt in den Begriffen des Real Life Stack.
//
// Diese Datei ist die einzige Stelle, an der steht, wie ein Dragon-Dreaming-Brett
// auf Group, Items und RelationRecords abgebildet wird. Server (Migration,
// Import) und App (Anzeige, Regeln, Geometrie) benutzen sie gemeinsam; sie
// kennt weder DOM noch node-eigene Module und läuft darum in beiden Welten.
//
//   Brett  = Group (Space)   data: { name, dream, horizon, modules: ["karabirrdt"] }
//   Ziel   = Item  project   data: { title, dots, order }                → eine Zeile
//   Karte  = Item  task      data: { title, description, status, stage, who, hours, euros, order }
//            Zugehörigkeit zum Ziel als eingebettete Relation `partOf` (Spec 04, Regel 9:
//            wenige feste Forward-Beziehungen, vom Autor des Items gesetzt).
//   Faden  = RelationRecord  predicate `blocks`, from = Voraussetzung, to = abhängige Karte.

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

// --------------------------------------------------------------- Geometrie

// Die Zelle ist so breit wie eine Kanban-Karte: `ItemPreview` in der Dichte
// `compact` mit Titel, Tags und Fußzeile. `cardH` ist nur das Grundmaß für
// noch nicht gemessene Karten — die wirkliche Höhe misst das Brett am DOM.
export const MASSE = {
  start: 46,
  label: 260,
  colW: 308, // 276 Karte + 16 Luft je Seite: Karten nebeneinander kleben nicht
  cardW: 276,
  cardH: 96,
  gap: 16, // Mindestabstand zwischen gestapelten Karten in einer Zelle
  rowPad: 20,
  head: 76,
  end: 46,
};

export const spaltenX = (s) => MASSE.start + MASSE.label + s * MASSE.colW + MASSE.colW / 2;

/** Grobe Höhe der Ziel-Beschriftung, ohne DOM: rund 28 Zeichen je Zeile. */
export function labelHoehe(titel) {
  const zeilen = Math.max(1, Math.ceil(text(titel).length / 28));
  return zeilen * 16 + 34;
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
    const h = Math.max(stapel + MASSE.rowPad * 2, labelHoehe(z.data?.title));
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

/**
 * Der Pfad eines Fadens.
 * `via` legt einen Umweg über den Zeilenrand, damit der Faden nicht durch
 * fremde Karten läuft; `senkrecht` ist der Fall zweier Karten in derselben Spalte.
 */
export function fadenPfad(x1, y1, x2, y2, via = null, senkrecht = false) {
  if (senkrecht) {
    const dy = (y2 - y1) / 2;
    return `M${x1},${y1} C${x1 + 10},${y1 + dy} ${x1 + 10},${y2 - dy} ${x2},${y2}`;
  }
  const dx = Math.max(28, Math.abs(x2 - x1) / 2);
  if (via != null) {
    const xa = x1 + Math.min(40, dx);
    const xb = x2 - Math.min(40, dx);
    return `M${x1},${y1} C${xa},${y1} ${xa},${via} ${(xa + xb) / 2},${via} S${xb},${y2} ${x2},${y2}`;
  }
  return x2 >= x1
    ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
    : `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`;
}

// ------------------------------------------------------ Fäden als Datensätze

/**
 * Die Kennung eines RelationRecords, deterministisch aus (Autor, Prädikat,
 * from, to) — dieselbe Ableitung wie in `@real-life-stack/data-interface`
 * (Spec 08, Regel 4), damit Server und Connector auf dieselbe Id kommen.
 */
export async function fadenId(createdBy, from, to, predicate = FADEN_PRAEDIKAT) {
  const bytes = new TextEncoder().encode(JSON.stringify([createdBy, predicate, from, to]));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `rel-${Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

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
  const relations = [];
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
        hours: zahl(t?.hours),
        euros: zahl(t?.euros),
        order: zahl(t?.order),
      },
      relations: t?.goal ? [{ predicate: ZUGEHOERIG_PRAEDIKAT, target: ziel(t.goal) }] : [],
    };
    // Mit bekannten Mitgliedern werden aus den Kürzeln gleich Zuweisungen;
    // ohne sie bleibt `who` stehen, statt still verloren zu gehen.
    items.push(mitglieder.length ? migriereWho(karte, mitglieder).item : karte);
    for (const d of Array.isArray(t?.deps) ? t.deps : []) {
      const from = ziel(d);
      const to = ziel(id);
      relations.push({ id: await fadenId(createdBy, from, to), predicate: FADEN_PRAEDIKAT, from, to, createdBy, createdAt });
    }
  }
  return {
    group: { id: brett, name: m.name, data: { scope: "group", ...m, modules: [MODUL] } },
    items,
    relations,
  };
}

/** `{group, items, relations}` → altes Brett, für die alte Seite und alte Exporte. */
export function rlsNachAlt({ group, items = [], relations = [] } = {}, mitglieder = []) {
  const d = group?.data ?? {};
  const goals = {};
  const tasks = {};
  const ini = initialenFuer(mitglieder);
  for (const i of items) {
    if (istZiel(i)) goals[i.id] = { id: i.id, title: text(i.data?.title), dots: zahl(i.data?.dots), order: zahl(i.data?.order) };
    else if (istKarte(i))
      tasks[i.id] = {
        id: i.id,
        title: text(i.data?.title),
        goal: zielVonKarte(i),
        stage: stufeVon(i),
        who: [
          ...zugewiesen(i, KANN_PRAEDIKAT).map((id) => ({ ini: ini.get(id) ?? id, can: true })),
          ...zugewiesen(i, LERNT_PRAEDIKAT).map((id) => ({ ini: ini.get(id) ?? id, can: false })),
          ...(Array.isArray(i.data?.who) ? i.data.who : []),
        ],
        hours: zahl(i.data?.hours),
        euros: zahl(i.data?.euros),
        done: istErledigt(i),
        deps: voraussetzungen(relations, i.id),
        note: text(i.data?.description),
        order: zahl(i.data?.order),
      };
  }
  return { meta: { name: text(d.name), dream: text(d.dream), horizon: text(d.horizon) }, goals, tasks };
}

/** Nimmt beide Formate an und liefert immer das RLS-Format. */
export async function normalisiereRls(json, optionen = {}) {
  if (istRlsFormat(json)) {
    const leer = leeresRls(optionen.brett);
    return {
      group: { ...leer.group, ...json.group, data: { ...leer.group.data, ...(json.group?.data ?? {}) } },
      items: json.items ?? [],
      relations: json.relations ?? [],
    };
  }
  return altNachRls(json ?? {}, optionen);
}

// ------------------------------------------------------------ Mitglieder
//
// „Wer" an einer Karte sind Zuweisungen an Mitglieder des Spaces, keine
// freien Kürzel mehr: „kann ich" ist die normale Task-Zuweisung `assignedTo`
// (TaskRelations.forward), „will lernen" ein zweites Zuweisungsprädikat.
// Beide liegen als eingebettete Relations am Item, Ziel `global:<userId>`
// nach den Target-Konventionen aus Spec 04.

export const GLOBAL = "global:";
export const KANN_PRAEDIKAT = "assignedTo";
export const LERNT_PRAEDIKAT = "wantsToLearn";
export const ZUWEISUNGEN = [KANN_PRAEDIKAT, LERNT_PRAEDIKAT];

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

/** Wem ist diese Karte unter diesem Prädikat zugewiesen? */
export function zugewiesen(item, praedikat) {
  return (item?.relations ?? [])
    .filter((r) => r?.predicate === praedikat && String(r.target ?? "").startsWith(GLOBAL))
    .map((r) => String(r.target).slice(GLOBAL.length));
}

/** Die Relations einer Karte mit neuen Zuweisungen. Alles andere bleibt. */
export function mitZuweisungen(item, kann = [], lernt = []) {
  const rest = (item?.relations ?? []).filter((r) => !ZUWEISUNGEN.includes(r?.predicate));
  return [
    ...rest,
    ...kann.map((id) => ({ predicate: KANN_PRAEDIKAT, target: GLOBAL + id })),
    ...lernt.map((id) => ({ predicate: LERNT_PRAEDIKAT, target: GLOBAL + id })),
  ];
}

/**
 * Das alte Feld `who` (freie Initialen mit „kann/lernt") auf die beiden
 * Zuweisungen abbilden. Was sich keinem Mitglied zuordnen lässt, wird an die
 * Notiz gehängt und zurückgemeldet — es verschwindet nicht still.
 */
export function migriereWho(item, mitglieder = []) {
  const who = item?.data?.who;
  if (!Array.isArray(who) || !who.length) return { item, unbekannt: [] };
  const nachIni = new Map([...initialenFuer(mitglieder)].map(([id, ini]) => [ini, id]));
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
    const hinweis = `Wer (noch ohne Mitglied): ${unbekannt.join(", ")}`;
    daten.description = daten.description ? `${daten.description}\n\n${hinweis}` : hinweis;
  }
  return { item: { ...item, data: daten, relations: mitZuweisungen(item, kann, lernt) }, unbekannt };
}
