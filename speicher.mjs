// Der Speicher: ein SQLite-File pro Instanz, ein Brett pro Kennung.
// Ziele und Karten liegen als JSON-Dokumente in je einer Tabelle, damit der
// Client dieselbe Form sieht wie im Browser-Speicher. Letzter Schreiber gewinnt.
import { DatabaseSync } from "node:sqlite";

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
      bretter: this.db.prepare("SELECT brett, max(geaendert) AS geaendert FROM (SELECT brett, geaendert FROM meta UNION ALL SELECT brett, geaendert FROM ziele UNION ALL SELECT brett, geaendert FROM karten) GROUP BY brett ORDER BY geaendert DESC"),
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

  schliessen() {
    this.db.close();
  }
}

const jetzt = () => new Date().toISOString();
