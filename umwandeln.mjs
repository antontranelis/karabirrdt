// Export → Umwandeln → Import: ein Brett aus dem eigenen Server (oder einer
// JSON-Datei) in einen Space des Supabase-Connectors.
//
// Grundsatz (Anton 29.09.): Die Daten lassen sich jederzeit als JSON
// exportieren (`GET /api/b/<brett>/rls`) und umformen. Der Umzug ist darum
// keine laufende Migration, und keine Formatfrage ist endgültig.
//
// - `planeUmzug` ist rein: aus dem Export wird die heutige RLS-Form (dieselbe
//   wie nach `npm run umzug`), ohne Autor (Stopp-Punkt 1: wer importiert, gilt
//   als Autor), mit dem Slug in `Group.data.slug` (Stopp-Punkt 3).
// - `importiere` schreibt den Plan über die Fähigkeiten des Data Interface
//   (Groups, `groupScope`, Items) und ist idempotent: Ein zweiter Lauf findet
//   nichts mehr. Dieselbe Funktion benutzt das Skript und der Abschnitt
//   „Daten“ der App.
//
// Mitglieder ohne Konto (`global:user:<name>`, Stopp-Punkt 2) bleiben, wie
// sie sind, und werden gemeldet: Platzhalter-Personen, die beim ersten Login
// mit dem Konto verknüpft werden, trägt der Stack heute nicht (Spec 12,
// Regel 3 und Nicht-Ziele; siehe docs/rls-kompatibel.md). Wer schon ein
// Konto hat, lässt sich über `zuordnung` zuordnen.
import {
  GLOBAL,
  KARTEN_TYP,
  KENNUNG,
  MODUL,
  ZIEL_TYP,
  ZUWEISUNG,
  lokaleId,
  normalisiereRls,
  regelVerstoesse,
  verwaisteFaeden,
} from "./modell.mjs";

/** Was ein Item im Import mitnimmt: Inhalt, nie Autor oder Zeitstempel. */
const INHALT = ["@context", "schema", "schemaVersion", "data", "relations", "tags"];

function nurInhalt(item) {
  const aus = { id: item.id, type: item.type };
  for (const k of INHALT) if (item[k] !== undefined) aus[k] = item[k];
  aus.data = aus.data ?? {};
  return aus;
}

/** Stabile Darstellung zum Vergleichen (Schlüsselreihenfolge egal). */
function stabil(wert) {
  if (Array.isArray(wert)) return `[${wert.map(stabil).join(",")}]`;
  if (wert && typeof wert === "object") {
    return `{${Object.keys(wert)
      .filter((k) => wert[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stabil(wert[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(wert ?? null);
}

/** Unterscheidet sich der Inhalt von `soll` von dem, was gespeichert ist? */
function inhaltAnders(soll, ist) {
  return INHALT.some((k) => stabil(soll[k] ?? (k === "data" ? {} : null)) !== stabil(ist[k] ?? (k === "data" ? {} : null)));
}

/**
 * Export (alt oder RLS-Form) → Plan für den Import.
 *
 * @param {unknown} json  was `GET /api/b/<brett>/rls` liefert, oder eine Datei
 * @param {{ slug?: string, zuordnung?: Record<string, string> }} optionen
 *   `slug`: Adresse des Bretts (Vorgabe: die Kennung aus dem Export);
 *   `zuordnung`: `user:<name>` → Konto-Id für Mitglieder, die schon ein Konto haben.
 */
export async function planeUmzug(json, { slug, zuordnung = {} } = {}) {
  const quelle = /** @type {any} */ (json ?? {});
  const rls = await normalisiereRls(quelle, { brett: slug ?? quelle?.group?.id ?? "haupt" });
  const kennung = slug ?? rls.group.id;
  if (typeof kennung !== "string" || !KENNUNG.test(kennung)) {
    throw new Error(`Ungültiger Slug ${JSON.stringify(kennung)}: Kleinbuchstaben, Ziffern und Bindestriche`);
  }

  const { name: _name, ...gruppenDaten } = rls.group.data ?? {};
  const group = {
    name: String(rls.group.name || _name || kennung),
    data: { ...gruppenDaten, scope: "group", modules: [MODUL], slug: kennung },
  };

  // Fäden ins Leere repariert wie im Umzugsskript.
  const reparatur = new Map(verwaisteFaeden(rls.items).map((r) => [r.id, r.relations]));
  const namen = new Map((quelle.members ?? []).map((m) => [GLOBAL + m.id, m.displayName]));
  const ohneKonto = new Map();
  const einladen = new Set();

  const items = rls.items.map((roh) => {
    const item = nurInhalt({ ...roh, relations: reparatur.get(roh.id) ?? roh.relations });
    if (!Array.isArray(item.relations)) return item;
    item.relations = item.relations.map((r) => {
      if (r?.predicate !== ZUWEISUNG || typeof r.target !== "string" || !r.target.startsWith(GLOBAL)) return r;
      const alt = r.target.slice(GLOBAL.length);
      const konto = zuordnung[alt];
      if (konto) {
        einladen.add(konto);
        return { ...r, target: GLOBAL + konto };
      }
      if (alt.startsWith("user:")) {
        const eintrag = ohneKonto.get(r.target) ?? { ziel: r.target, name: namen.get(r.target) ?? alt.slice(5), karten: new Set() };
        eintrag.karten.add(item.id);
        ohneKonto.set(r.target, eintrag);
      }
      return r;
    });
    return item;
  });

  // Übrige Datensätze: nur solche zwischen Items dieses Bretts. Wer in einen
  // anderen Space zeigt, verlöre beim Umzug sein Ziel (die Space-Id ändert
  // sich) und wird gemeldet statt still übernommen.
  const ids = new Set(items.map((i) => i.id));
  const lokal = (t) => typeof t === "string" && t.startsWith("item:") && ids.has(lokaleId(t));
  const datensaetze = [];
  const nichtUebernommen = [];
  for (const r of rls.relations ?? []) (lokal(r.from) && lokal(r.to) ? datensaetze : nichtUebernommen).push(r);

  return {
    slug: kennung,
    group,
    items,
    datensaetze: datensaetze.map(({ id: _id, createdBy: _b, createdAt: _a, ...rest }) => rest),
    nichtUebernommen,
    ohneKonto: [...ohneKonto.values()]
      .map((e) => ({ ziel: e.ziel, name: e.name, karten: e.karten.size }))
      .sort((a, b) => a.ziel.localeCompare(b.ziel)),
    einladen: [...einladen],
    // Die Regeln des Bretts (Fäden nach rechts, genau ein Ziel) gelten auch
    // für einen Import; ein Plan mit Verstößen wird nicht geschrieben.
    verstoesse: [...new Set(regelVerstoesse(items).values())],
  };
}

/**
 * Warum der Plan nicht geschrieben werden darf, oder null.
 *
 * - Verstöße gegen die Brett-Regeln.
 * - Zuweisungen an Mitglieder ohne Konto: Platzhalter-Personen sind
 *   entschieden (Stopp-Punkt 2), aber im Stack noch nicht da (Lücke 33).
 *   Solche Zuweisungen blieben unsichtbar; geschrieben wird erst, wenn jede
 *   über `zuordnung` einem Konto zugeordnet ist oder `ohneKontoUebernehmen`
 *   es ausdrücklich erlaubt.
 */
export function importSperre(plan, { ohneKontoUebernehmen = false } = {}) {
  if (plan.verstoesse.length) return `Regelverstoß im Import: ${plan.verstoesse.join(" ")}`;
  if (plan.ohneKonto.length && !ohneKontoUebernehmen) {
    return `Zuweisungen an Mitglieder ohne Konto: ${plan.ohneKonto.map((o) => `${o.name} (${o.ziel}, ${o.karten} Karten)`).join(", ")}. Erst einem Konto zuordnen; Platzhalter-Personen gibt es im Stack noch nicht.`;
  }
  return null;
}

/**
 * Den Plan schreiben, idempotent, in vier Phasen:
 *
 * 1. Lesen: den Space (über `gruppe` oder den Slug) und seinen Bestand.
 * 2. Prüfen, bevor irgendetwas geschrieben wird: der ENTSTEHENDE Bestand
 *    (was bleibt plus was kommt) gegen die Brett-Regeln, und keine Id, die
 *    im Space schon mit einem anderen Typ liegt.
 * 3. Schreiben: Space, Items, Datensätze, Einladungen; Fehler je Schritt
 *    werden gesammelt, nicht abgebrochen.
 * 4. Erst danach, und nur ohne jeden Fehler: beim Ersetzen löschen, was der
 *    Plan nicht kennt.
 *
 * @param {Awaited<ReturnType<typeof planeUmzug>>} plan
 * @param {any} c  ein Connector mit Groups, `groupScope` und ItemWriter
 * @param {{ probe?: boolean, gruppe?: string, ersetzen?: boolean, ohneKontoUebernehmen?: boolean }} optionen
 *   `gruppe`: in diese Group statt der mit dem Slug (Abschnitt „Daten“ der App);
 *   `ersetzen`: Karten und Ziele der Group, die der Plan nicht kennt, löschen;
 *   `ohneKontoUebernehmen`: siehe `importSperre`.
 */
export async function importiere(plan, c, { probe = false, gruppe, ersetzen = false, ohneKontoUebernehmen = false } = {}) {
  if (c?.groupScope !== true) throw new Error("Der Connector kann nicht in einen bestimmten Space schreiben (groupScope)");
  const sperre = importSperre(plan, { ohneKontoUebernehmen });
  if (sperre && !probe) throw new Error(sperre);
  const bericht = { gruppe: { id: null, neu: false }, angelegt: [], geaendert: [], gleich: [], entfernt: [], eingeladen: [], datensaetze: 0, fehler: [] };
  const fehler = (id, e) => bericht.fehler.push({ id, grund: e instanceof Error ? e.message : String(e) });

  // 1. Lesen
  const gruppen = await c.getGroups();
  let g = gruppe
    ? gruppen.find((x) => x.id === gruppe)
    : gruppen.find((x) => x.data?.slug === plan.slug && (x.data?.modules ?? []).includes(MODUL));
  if (gruppe && !g) throw new Error(`Space ${gruppe} nicht gefunden`);
  const bestand = g ? await c.getItems({ group: g.id }) : [];
  const vorhanden = new Map(bestand.map((i) => [i.id, i]));
  const imPlan = new Set(plan.items.map((i) => i.id));
  const brettTyp = (i) => i.type === KARTEN_TYP || i.type === ZIEL_TYP;
  const weg = ersetzen ? bestand.filter((i) => !imPlan.has(i.id) && brettTyp(i)) : [];

  // 2. Prüfen, vor dem ersten Schreiben
  const konflikte = plan.items.filter((i) => vorhanden.has(i.id) && vorhanden.get(i.id).type !== i.type);
  if (konflikte.length) {
    throw new Error(`Typkonflikt: ${konflikte.map((i) => `${i.id} liegt als ${vorhanden.get(i.id).type} vor, der Import bringt ${i.type}`).join("; ")}`);
  }
  const wegIds = new Set(weg.map((i) => i.id));
  const entsteht = [...bestand.filter((i) => !imPlan.has(i.id) && !wegIds.has(i.id)), ...plan.items];
  const verstoss = [...new Set(regelVerstoesse(entsteht).values())];
  if (verstoss.length && !probe) throw new Error(`Regelverstoß im entstehenden Brett: ${verstoss.join(" ")}`);

  if (!g && probe) {
    bericht.gruppe.neu = true;
    bericht.angelegt = plan.items.map((i) => i.id);
    bericht.eingeladen = [...plan.einladen];
    bericht.datensaetze = plan.datensaetze.length;
    return bericht;
  }

  // 3. Schreiben
  if (!g) {
    bericht.gruppe.neu = true;
    g = await c.createGroup(plan.group.name, plan.group.data);
  } else {
    // Traum, Horizont und Co. aus dem Import; ein vorhandener Slug bleibt
    // (in eine offene Group importiert, behält sie ihre Adresse).
    const daten = { ...g.data, ...plan.group.data, slug: g.data?.slug ?? plan.slug };
    if (stabil(daten) !== stabil(g.data ?? {}) && !probe) {
      try {
        await c.updateGroup(g.id, { data: daten });
      } catch (e) {
        fehler(`Space ${g.id}`, e);
      }
    }
  }
  bericht.gruppe.id = g.id;

  for (const item of plan.items) {
    const ist = vorhanden.get(item.id);
    try {
      if (!ist) {
        if (!probe) await c.createItem(item, { group: g.id });
        bericht.angelegt.push(item.id);
      } else if (inhaltAnders(item, ist)) {
        if (!probe) await c.updateItem(item.id, Object.fromEntries(INHALT.map((k) => [k, item[k]])));
        bericht.geaendert.push(item.id);
      } else bericht.gleich.push(item.id);
    } catch (e) {
      fehler(item.id, e);
    }
  }

  // Datensätze innerhalb des Bretts: neu angelegt, mit der importierenden
  // Person als Autor (die kanonische Id leitet der Connector ab, Spec 08).
  for (const r of plan.datensaetze) {
    try {
      if (!probe) await c.createRelationRecord(r);
      bericht.datensaetze += 1;
    } catch (e) {
      fehler(`${r.predicate} ${r.from} → ${r.to}`, e);
    }
  }

  const mitglieder = new Set(g.members ?? []);
  for (const konto of plan.einladen) {
    if (mitglieder.has(konto)) continue;
    try {
      if (!probe) await c.inviteMember(g.id, konto);
      bericht.eingeladen.push(konto);
    } catch (e) {
      fehler(`Einladung ${konto}`, e);
    }
  }

  // 4. Löschen zuletzt, nur ohne Fehler: Sonst stünde das Brett nach einem
  // gescheiterten Import ohne alte und ohne neue Karten da. Karten vor
  // Zielen, damit nach einem Teilfehler keine Karte ohne Ziel bleibt.
  if (ersetzen && bericht.fehler.length) bericht.ersetzenAusgelassen = true;
  else {
    for (const ist of [...weg].sort((a, b) => Number(a.type === ZIEL_TYP) - Number(b.type === ZIEL_TYP))) {
      try {
        if (!probe) await c.deleteItem(ist.id);
        bericht.entfernt.push(ist.id);
      } catch (e) {
        fehler(ist.id, e);
      }
    }
  }
  return bericht;
}
