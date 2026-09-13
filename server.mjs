// Liefert die Oberfläche aus, nimmt Änderungen über eine kleine JSON-API
// entgegen und verteilt sie per WebSocket an alle, die dasselbe Brett offen haben.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";
import { Speicher, gueltigeKennung } from "./speicher.mjs";
import { altNachRls, normalisiereRls } from "./modell.mjs";

const PORT = Number(process.env.PORT ?? 8124);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATEN = process.env.KARABIRRDT_DB ?? path.join(import.meta.dirname, "data", "karabirrdt.sqlite");
const PUBLIC = path.join(import.meta.dirname, "public");
const MAX_BODY = 1024 * 1024; // ein Brett ist Kilobytes, nicht Megabytes

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
};

export function erstelleServer({ speicher }) {
  const server = http.createServer((req, res) => behandle(req, res).catch((e) => fehler(res, e.status ?? 500, e.message)));
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Map(); // ws -> brett

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://x");
    const m = url.pathname.match(/^\/ws\/([^/]+)$/);
    if (!m || !gueltigeKennung(m[1])) return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => {
      clients.set(ws, m[1]);
      ws.on("close", () => clients.delete(ws));
      ws.on("error", () => clients.delete(ws));
    });
  });

  const verteile = (brett, nachricht) => {
    const text = JSON.stringify(nachricht);
    for (const [ws, b] of clients) if (b === brett && ws.readyState === ws.OPEN) ws.send(text);
  };

  async function behandle(req, res) {
    const url = new URL(req.url, "http://x");
    const p = url.pathname;

    if (p === "/api/bretter" && req.method === "GET") return json(res, speicher.bretter());

    const api = p.match(/^\/api\/b\/([^/]+)(?:\/(meta|goals|tasks|import|rls|items|relations|group)(?:\/([^/]+))?)?$/);
    if (api) {
      const [, brett, teil, id] = api;
      if (!gueltigeKennung(brett)) return fehler(res, 400, "Ungültige Brett-Kennung");
      if (!teil && req.method === "GET") return json(res, speicher.brett(brett));
      if (teil === "meta" && req.method === "PUT") {
        const meta = pruefeMeta(await koerper(req));
        speicher.metaSetzen(brett, meta);
        verteile(brett, { type: "meta", data: meta });
        return json(res, { ok: true });
      }
      if ((teil === "goals" || teil === "tasks") && id) {
        if (!gueltigeId(id)) return fehler(res, 400, "Ungültige Kennung");
        const kind = teil === "goals" ? "goal" : "task";
        if (req.method === "PUT") {
          const doc = await koerper(req);
          if (!doc || typeof doc !== "object" || Array.isArray(doc)) return fehler(res, 400, "Kein Objekt");
          const gespeichert = { ...doc, id };
          if (kind === "goal") speicher.zielSetzen(brett, id, gespeichert);
          else speicher.karteSetzen(brett, id, gespeichert);
          verteile(brett, { type: kind, id, data: gespeichert });
          return json(res, { ok: true });
        }
        if (req.method === "DELETE") {
          if (kind === "goal") speicher.zielLoeschen(brett, id);
          else speicher.karteLoeschen(brett, id);
          verteile(brett, { type: kind, id, data: null });
          return json(res, { ok: true });
        }
      }
      if (teil === "rls" && !id && req.method === "GET") return json(res, await rlsBrett(speicher, brett));
      if (teil === "rls" && id === "import" && req.method === "POST") {
        const daten = await koerper(req);
        if (!daten || typeof daten !== "object" || Array.isArray(daten)) return fehler(res, 400, "Kein Objekt");
        speicher.rlsErsetzen(brett, await normalisiereRls(daten, { brett }));
        verteile(brett, { type: "reset", data: speicher.rlsBrett(brett) });
        return json(res, { ok: true });
      }
      if (teil === "group" && !id && req.method === "PUT") {
        const patch = await koerper(req);
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) return fehler(res, 400, "Kein Objekt");
        await rlsBrett(speicher, brett); // eine alte Vorlage erst übersetzen, dann patchen
        const group = speicher.gruppeSetzen(brett, patch);
        verteile(brett, { type: "group", data: group });
        return json(res, { ok: true });
      }
      if ((teil === "items" || teil === "relations") && id) {
        if (!gueltigeId(id)) return fehler(res, 400, "Ungültige Kennung");
        const art = teil === "items" ? "item" : "relation";
        if (req.method === "PUT") {
          const doc = await koerper(req);
          if (!doc || typeof doc !== "object" || Array.isArray(doc)) return fehler(res, 400, "Kein Objekt");
          const gespeichert = art === "item" ? pruefeItem(doc, id) : pruefeRelation(doc, id);
          if (art === "item") speicher.itemSetzen(brett, id, gespeichert);
          else speicher.relationSetzen(brett, id, gespeichert);
          verteile(brett, { type: art, id, data: gespeichert });
          return json(res, { ok: true });
        }
        if (req.method === "DELETE") {
          if (art === "item") speicher.itemLoeschen(brett, id);
          else speicher.relationLoeschen(brett, id);
          verteile(brett, { type: art, id, data: null });
          return json(res, { ok: true });
        }
      }
      if (teil === "import" && req.method === "POST") {
        const daten = await koerper(req);
        if (!daten || typeof daten !== "object") return fehler(res, 400, "Kein Objekt");
        speicher.ersetzen(brett, daten);
        verteile(brett, { type: "reset", data: speicher.brett(brett) });
        return json(res, { ok: true });
      }
      return fehler(res, 404, "Unbekannter Pfad");
    }

    // Oberfläche: `/` und `/<brett>` liefern die RLS-App, `/alt` und
    // `/alt/<brett>` die ursprüngliche Seite, alles andere kommt aus public/.
    if (req.method !== "GET" && req.method !== "HEAD") return fehler(res, 405, "Nur GET");
    const brettPfad = /^\/[a-z0-9][a-z0-9-]*$/;
    let datei = p;
    if (p === "/alt" || (p.startsWith("/alt/") && brettPfad.test(p.slice(4)))) datei = "/alt.html";
    else if (p === "/" || brettPfad.test(p)) datei = "/index.html";
    datei = path.normalize(datei).replace(/^(\.\.[/\\])+/, "");
    const voll = path.join(PUBLIC, datei);
    if (!voll.startsWith(PUBLIC) || !fs.existsSync(voll) || fs.statSync(voll).isDirectory()) return fehler(res, 404, "Nicht gefunden");
    res.writeHead(200, { "content-type": TYPEN[path.extname(voll)] ?? "application/octet-stream", "cache-control": "no-cache" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(voll).pipe(res);
  }

  return server;
}

const gueltigeId = (id) => /^[A-Za-z0-9_-]{1,80}$/.test(id);

/**
 * Das Brett in RLS-Form. Gibt es noch keine, wohl aber ein altes Brett, wird
 * es genau einmal übersetzt und weggeschrieben — danach ist die RLS-Form die
 * Wahrheit und die alten Tabellen bedienen nur noch `/alt`.
 */
async function rlsBrett(speicher, brett) {
  if (!speicher.hatRls(brett) && speicher.hatAlt(brett)) {
    speicher.rlsErsetzen(brett, await altNachRls(speicher.brett(brett), { brett }));
  }
  return speicher.rlsBrett(brett);
}

function pruefeItem(doc, id) {
  if (typeof doc.type !== "string" || !doc.type) throw Object.assign(new Error("Item ohne type"), { status: 400 });
  if (doc.data != null && (typeof doc.data !== "object" || Array.isArray(doc.data)))
    throw Object.assign(new Error("data ist kein Objekt"), { status: 400 });
  return {
    ...doc,
    id,
    data: doc.data ?? {},
    createdBy: typeof doc.createdBy === "string" ? doc.createdBy : "anonymous",
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : new Date().toISOString(),
  };
}

function pruefeRelation(doc, id) {
  for (const f of ["predicate", "from", "to"]) {
    if (typeof doc[f] !== "string" || !doc[f]) throw Object.assign(new Error(`Relation ohne ${f}`), { status: 400 });
  }
  return {
    ...doc,
    id,
    createdBy: typeof doc.createdBy === "string" ? doc.createdBy : "anonymous",
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : new Date().toISOString(),
  };
}

function pruefeMeta(m) {
  if (!m || typeof m !== "object") throw Object.assign(new Error("Kein Objekt"), { status: 400 });
  const s = (v) => (typeof v === "string" ? v.slice(0, 2000) : "");
  return { name: s(m.name), dream: s(m.dream), horizon: s(m.horizon) };
}

function koerper(req) {
  return new Promise((resolve, reject) => {
    let groesse = 0;
    const teile = [];
    req.on("data", (c) => {
      groesse += c.length;
      if (groesse > MAX_BODY) {
        reject(Object.assign(new Error("Zu groß"), { status: 413 }));
        req.destroy();
        return;
      }
      teile.push(c);
    });
    req.on("end", () => {
      try {
        resolve(teile.length ? JSON.parse(Buffer.concat(teile).toString("utf8")) : null);
      } catch {
        reject(Object.assign(new Error("Kein gültiges JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function json(res, daten) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(daten));
}
function fehler(res, status, text) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ error: text }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  fs.mkdirSync(path.dirname(DATEN), { recursive: true });
  const speicher = new Speicher(DATEN);
  const server = erstelleServer({ speicher });
  server.listen(PORT, HOST, () => console.log(`Karabirrdt läuft auf http://${HOST}:${PORT} · Daten in ${DATEN}`));
  const stopp = () => { server.close(); speicher.schliessen(); process.exit(0); };
  process.on("SIGTERM", stopp);
  process.on("SIGINT", stopp);
}
