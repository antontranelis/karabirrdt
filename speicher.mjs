// Der Speicher: ein SQLite-File pro Instanz, ein Brett pro Kennung.
// Ziele und Karten liegen als JSON-Dokumente in je einer Tabelle, damit der
// Client dieselbe Form sieht wie im Browser-Speicher. Letzter Schreiber gewinnt.
import { DatabaseSync } from "node:sqlite";
import { leeresRls } from "./modell.mjs";

const KENNUNG = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const gueltigeKennung = (k) => KENNUNG.test(k);

export class Speicher {
  constructor(pfad = ":memory:") {
    this.db = new DatabaseSync(pfad);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS meta  (brett TEXT PRIMARY KEY, json TEXT NOT NULL, geaendert TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS ziele (brett TEXT, id TEXT, json TEXT NOT NULL, geaendert TEXT NOT NULL, PRIMARY KEY (brett, id));
      CREATE TABLE IF NOT EXISTS karten(brett TEXT, id TEXT, json TEXT NOT NULL, geaendert TEXT NOT NULL, PRIMARY KEY (brett, id));
      -- Die RLS-Form desselben Bretts: Items, RelationRecords und die Group.
      CREATE TABLE IF NOT EXISTS rls_items    (brett TEXT, id TEXT, json TEXT NOT NULL, geaendert TEXT NOT NULL, PRIMARY KEY (brett, id));
      CREATE TABLE IF NOT EXISTS rls_relationen(brett TEXT, id TEXT, json TEXT NOT NULL, geaendert TEXT NOT NULL, PRIMARY KEY (brett, id));
      CREATE TABLE IF NOT EXISTS rls_gruppe   (brett TEXT PRIMARY KEY, json TEXT NOT NULL, geaendert TEXT NOT NULL);
      -- Die Mitglieder eines Spaces. Sie gehören dem Brett, nicht seinem
      -- Inhalt: ein Import tauscht Karten, keine Menschen.
      CREATE TABLE IF NOT EXISTS rls_mitglieder(brett TEXT, id TEXT, json TEXT NOT NULL, geaendert TEXT NOT NULL, PRIMARY KEY (brett, id));
    `);
    this.q = {
      meta: this.db.prepare("SELECT json FROM meta WHERE brett = ?"),
      metaSetzen: this.db.prepare("INSERT INTO meta (brett, json, geaendert) VALUES (?, ?, ?) ON CONFLICT(brett) DO UPDATE SET json = excluded.json, geaendert = excluded.geaendert"),
      ziele: this.db.prepare("SELECT id, json FROM ziele WHERE brett = ?"),
      zielSetzen: this.db.prepare("INSERT INTO ziele (brett, id, json, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(brett, id) DO UPDATE SET json = excluded.json, geaendert = excluded.geaendert"),
      zielLoeschen: this.db.prepare("DELETE FROM ziele WHERE brett = ? AND id = ?"),
      karten: this.db.prepare("SELECT id, json FROM karten WHERE brett = ?"),
      karteSetzen: this.db.prepare("INSERT INTO karten (brett, id, json, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(brett, id) DO UPDATE SET json = excluded.json, geaendert = excluded.geaendert"),
      karteLoeschen: this.db.prepare("DELETE FROM karten WHERE brett = ? AND id = ?"),
      zieleLeeren: this.db.prepare("DELETE FROM ziele WHERE brett = ?"),
      kartenLeeren: this.db.prepare("DELETE FROM karten WHERE brett = ?"),
      rlsItems: this.db.prepare("SELECT id, json FROM rls_items WHERE brett = ?"),
      rlsItemSetzen: this.db.prepare("INSERT INTO rls_items (brett, id, json, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(brett, id) DO UPDATE SET json = excluded.json, geaendert = excluded.geaendert"),
      rlsItemLoeschen: this.db.prepare("DELETE FROM rls_items WHERE brett = ? AND id = ?"),
      rlsItemsLeeren: this.db.prepare("DELETE FROM rls_items WHERE brett = ?"),
      rlsRelationen: this.db.prepare("SELECT id, json FROM rls_relationen WHERE brett = ?"),
      rlsRelationSetzen: this.db.prepare("INSERT INTO rls_relationen (brett, id, json, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(brett, id) DO UPDATE SET json = excluded.json, geaendert = excluded.geaendert"),
      rlsRelationLoeschen: this.db.prepare("DELETE FROM rls_relationen WHERE brett = ? AND id = ?"),
      rlsRelationenLeeren: this.db.prepare("DELETE FROM rls_relationen WHERE brett = ?"),
      rlsGruppe: this.db.prepare("SELECT json FROM rls_gruppe WHERE brett = ?"),
      rlsGruppeSetzen: this.db.prepare("INSERT INTO rls_gruppe (brett, json, geaendert) VALUES (?, ?, ?) ON CONFLICT(brett) DO UPDATE SET json = excluded.json, geaendert = excluded.geaendert"),
      mitglieder: this.db.prepare("SELECT id, json FROM rls_mitglieder WHERE brett = ? ORDER BY geaendert"),
      mitgliedSetzen: this.db.prepare("INSERT INTO rls_mitglieder (brett, id, json, geaendert) VALUES (?, ?, ?, ?) ON CONFLICT(brett, id) DO UPDATE SET json = excluded.json"),
      mitgliedLoeschen: this.db.prepare("DELETE FROM rls_mitglieder WHERE brett = ? AND id = ?"),
      mitgliederLeeren: this.db.prepare("DELETE FROM rls_mitglieder WHERE brett = ?"),
      rlsGruppeLoeschen: this.db.prepare("DELETE FROM rls_gruppe WHERE brett = ?"),
      metaLoeschen: this.db.prepare("DELETE FROM meta WHERE brett = ?"),
      rlsZahl: this.db.prepare("SELECT (SELECT count(*) FROM rls_items WHERE brett = ?1) + (SELECT count(*) FROM rls_gruppe WHERE brett = ?1) AS n"),
      altZahl: this.db.prepare("SELECT (SELECT count(*) FROM ziele WHERE brett = ?1) + (SELECT count(*) FROM karten WHERE brett = ?1) + (SELECT count(*) FROM meta WHERE brett = ?1) AS n"),
      bretter: this.db.prepare("SELECT brett, max(geaendert) AS geaendert FROM (SELECT brett, geaendert FROM meta UNION ALL SELECT brett, geaendert FROM ziele UNION ALL SELECT brett, geaendert FROM karten UNION ALL SELECT brett, geaendert FROM rls_items UNION ALL SELECT brett, geaendert FROM rls_relationen UNION ALL SELECT brett, geaendert FROM rls_gruppe) GROUP BY brett ORDER BY geaendert DESC"),
    };
  }

  brett(kennung) {
    const meta = this.q.meta.get(kennung);
    const sammeln = (zeilen) => Object.fromEntries(zeilen.map((z) => [z.id, JSON.parse(z.json)]));
    return {
      meta: meta ? JSON.parse(meta.json) : { name: "", dream: "", horizon: "" },
      goals: sammeln(this.q.ziele.all(kennung)),
      tasks: sammeln(this.q.karten.all(kennung)),
    };
  }

  bretter() {
    return this.q.bretter.all();
  }

  metaSetzen(kennung, meta) {
    this.q.metaSetzen.run(kennung, JSON.stringify(meta), jetzt());
  }
  zielSetzen(kennung, id, ziel) {
    this.q.zielSetzen.run(kennung, id, JSON.stringify({ ...ziel, id }), jetzt());
  }
  zielLoeschen(kennung, id) {
    this.q.zielLoeschen.run(kennung, id);
  }
  karteSetzen(kennung, id, karte) {
    this.q.karteSetzen.run(kennung, id, JSON.stringify({ ...karte, id }), jetzt());
  }
  karteLoeschen(kennung, id) {
    this.q.karteLoeschen.run(kennung, id);
  }

  // Ein ganzes Brett ersetzen (JSON-Import). Alles oder nichts.
  ersetzen(kennung, { meta, goals, tasks }) {
    this.db.exec("BEGIN");
    try {
      this.q.zieleLeeren.run(kennung);
      this.q.kartenLeeren.run(kennung);
      this.metaSetzen(kennung, meta ?? { name: "", dream: "", horizon: "" });
      for (const [id, z] of Object.entries(goals ?? {})) this.zielSetzen(kennung, id, z);
      for (const [id, k] of Object.entries(tasks ?? {})) this.karteSetzen(kennung, id, k);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  // ---------------------------------------------------------------- RLS-Form

  /** Liegen für dieses Brett schon RLS-Daten? */
  hatRls(kennung) {
    return this.q.rlsZahl.get(kennung).n > 0;
  }
  /** Gibt es überhaupt etwas Altes zu übersetzen? */
  hatAlt(kennung) {
    return this.q.altZahl.get(kennung).n > 0;
  }

  /**
   * Alle Bretter als Groups — für den Space-Switch. Ein Brett, das es nur in
   * der alten Form gibt, kommt mit seinem Namen aus `meta` mit, OHNE dafür
   * übersetzt zu werden: Die Liste zu öffnen darf keine Migration auslösen.
   */
  gruppen() {
    const vorlage = leeresRls("").group.data;
    return this.bretter().map(({ brett, geaendert }) => {
      const gespeichert = this.q.rlsGruppe.get(brett);
      if (gespeichert) {
        const g = JSON.parse(gespeichert.json);
        return { ...g, id: brett, name: g.name || brett, data: { ...vorlage, ...(g.data ?? {}) }, geaendert };
      }
      const alt = this.q.meta.get(brett);
      const meta = alt ? JSON.parse(alt.json) : {};
      return { id: brett, name: meta.name || brett, data: { ...vorlage, ...meta }, geaendert };
    });
  }

  rlsBrett(kennung) {
    const gespeichert = this.q.rlsGruppe.get(kennung);
    const group = gespeichert ? { ...JSON.parse(gespeichert.json), id: kennung } : leeresRls(kennung).group;
    return {
      group,
      items: this.q.rlsItems.all(kennung).map((z) => JSON.parse(z.json)),
      relations: this.q.rlsRelationen.all(kennung).map((z) => JSON.parse(z.json)),
      members: this.mitglieder(kennung),
    };
  }

  mitglieder(kennung) {
    return this.q.mitglieder.all(kennung).map((z) => ({ ...JSON.parse(z.json), id: z.id }));
  }
  mitgliedSetzen(kennung, id, nutzer) {
    this.q.mitgliedSetzen.run(kennung, id, JSON.stringify({ ...nutzer, id }), jetzt());
  }
  mitgliedLoeschen(kennung, id) {
    this.q.mitgliedLoeschen.run(kennung, id);
  }

  itemSetzen(kennung, id, item) {
    this.q.rlsItemSetzen.run(kennung, id, JSON.stringify({ ...item, id }), jetzt());
  }
  itemLoeschen(kennung, id) {
    this.q.rlsItemLoeschen.run(kennung, id);
  }
  relationSetzen(kennung, id, record) {
    this.q.rlsRelationSetzen.run(kennung, id, JSON.stringify({ ...record, id }), jetzt());
  }
  relationLoeschen(kennung, id) {
    this.q.rlsRelationLoeschen.run(kennung, id);
  }

  /**
   * Group schreiben. `data` ist ein Merge-Patch in einer Ebene (Spec 04/
   * GroupManager.updateGroup): genannte Schlüssel werden übernommen, `null`
   * löscht, ungenannte bleiben stehen. Sonst überschriebe ein Schreiber die
   * Felder des anderen.
   */
  gruppeSetzen(kennung, patch) {
    const alt = this.rlsBrett(kennung).group;
    const data = { ...(alt.data ?? {}) };
    for (const [k, v] of Object.entries(patch?.data ?? {})) {
      if (v === null) delete data[k];
      else data[k] = v;
    }
    const neu = { id: kennung, name: patch?.name ?? alt.name ?? "", data };
    this.q.rlsGruppeSetzen.run(kennung, JSON.stringify(neu), jetzt());
    return neu;
  }

  /** Ein ganzes Brett in RLS-Form ersetzen. Alles oder nichts. */
  rlsErsetzen(kennung, { group, items, relations }) {
    this.db.exec("BEGIN");
    try {
      this.q.rlsItemsLeeren.run(kennung);
      this.q.rlsRelationenLeeren.run(kennung);
      const g = { id: kennung, name: group?.name ?? "", data: group?.data ?? {} };
      this.q.rlsGruppeSetzen.run(kennung, JSON.stringify(g), jetzt());
      for (const i of items ?? []) this.itemSetzen(kennung, i.id, i);
      for (const r of relations ?? []) this.relationSetzen(kennung, r.id, r);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  /** Ein Brett ganz entfernen — beide Formen, in einem Zug. */
  brettLoeschen(kennung) {
    this.db.exec("BEGIN");
    try {
      this.q.rlsItemsLeeren.run(kennung);
      this.q.rlsRelationenLeeren.run(kennung);
      this.q.rlsGruppeLoeschen.run(kennung);
      this.q.mitgliederLeeren.run(kennung);
      this.q.zieleLeeren.run(kennung);
      this.q.kartenLeeren.run(kennung);
      this.q.metaLoeschen.run(kennung);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  schliessen() {
    this.db.close();
  }
}

const jetzt = () => new Date().toISOString();
