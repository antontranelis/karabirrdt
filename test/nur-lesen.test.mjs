// Einfrieren zum Wechsel: Mit `nurLesen` nimmt der Server keine Änderung mehr
// an, liefert den Export aber weiter — und schreibt dabei auch selbst nichts
// (die einmalige Übersetzung beim Lesen bleibt aus).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { erstelleServer } from "../server.mjs";
import { Speicher } from "../speicher.mjs";

let server, basis, speicher;
before(async () => {
  speicher = new Speicher();
  speicher.metaSetzen("alt", { name: "Alt", dream: "", horizon: "" });
  speicher.zielSetzen("alt", "z", { id: "z", title: "Z", dots: 1, order: 0 });
  server = erstelleServer({ speicher, nurLesen: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  basis = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("nurLesen: jede Änderung über die API wird mit 423 abgelehnt", async () => {
  const versuche = [
    ["/api/b/alt/tasks/k1", "PUT"],
    ["/api/b/alt/items/i1", "PUT"],
    ["/api/b/alt/rls", "DELETE"],
    ["/api/b/alt/rls/import", "POST"],
    ["/api/b/alt/group", "PUT"],
  ];
  for (const [pfad, method] of versuche) {
    const r = await fetch(basis + pfad, { method, headers: { "content-type": "application/json" }, body: method === "DELETE" ? undefined : "{}" });
    assert.equal(r.status, 423, `${method} ${pfad}`);
    assert.match((await r.json()).error, /eingefroren/i);
  }
});

test("nurLesen: der Export kommt weiter, ohne dass der Server die RLS-Form wegschreibt", async () => {
  const r = await fetch(basis + "/api/b/alt/rls");
  assert.equal(r.status, 200);
  const rls = await r.json();
  assert.deepEqual(rls.items.map((i) => i.id), ["z"]);
  assert.equal(speicher.hatRls("alt"), false);
});
