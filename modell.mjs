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

// Die Zelle ist so breit, dass eine ItemPreview in der Dichte `compact`
// hineinpasst; das Toolkit hat keine kleinere Karte (siehe docs/rls-kompatibel.md).
export const MASSE = {
  start: 46,
  label: 250,
  colW: 224,
  cardW: 208,
  cardH: 92,
  gap: 8,
  rowPad: 16,
  head: 76,
  end: 46,
};

export const spaltenX = (s) => MASSE.start + MASSE.label + s * MASSE.colW + MASSE.colW / 2;

/** Grobe Höhe der Ziel-Beschriftung, ohne DOM: rund 28 Zeichen je Zeile. */
export function labelHoehe(titel) {
  const zeilen = Math.max(1, Math.ceil(text(titel).length / 28));
  return zeilen * 16 + 34;
}

/** Zeilen, Kartenpositionen und Gesamtmaße des Rasters. */
export function layout(ziele, karten) {
  const zeilen = [];
  const pos = {};
  let y = MASSE.head;
  for (const z of ziele) {
    let stapel = 1;
    for (let s = 0; s < 12; s++) stapel = Math.max(stapel, kartenInZelle(karten, z.id, s).length);
    const h = Math.max(stapel * (MASSE.cardH + MASSE.gap) - MASSE.gap + MASSE.rowPad * 2, labelHoehe(z.data?.title));
    const zeile = { ziel: z, y, h };
    for (let s = 0; s < 12; s++) {
      kartenInZelle(karten, z.id, s).forEach((k, i) => {
        pos[k.id] = {
          x: spaltenX(s) - MASSE.cardW / 2,
          y: y + MASSE.rowPad + i * (MASSE.cardH + MASSE.gap),
          zeile,
        };
      });
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
export async function altNachRls({ meta, goals, tasks } = {}, { createdBy = "anonymous", createdAt = new Date().toISOString(), brett = "haupt" } = {}) {
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
    items.push({
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
    });
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
export function rlsNachAlt({ group, items = [], relations = [] } = {}) {
  const d = group?.data ?? {};
  const goals = {};
  const tasks = {};
  for (const i of items) {
    if (istZiel(i)) goals[i.id] = { id: i.id, title: text(i.data?.title), dots: zahl(i.data?.dots), order: zahl(i.data?.order) };
    else if (istKarte(i))
      tasks[i.id] = {
        id: i.id,
        title: text(i.data?.title),
        goal: zielVonKarte(i),
        stage: stufeVon(i),
        who: Array.isArray(i.data?.who) ? i.data.who : [],
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
