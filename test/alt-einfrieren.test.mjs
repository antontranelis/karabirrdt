// `/alt` einfrieren: je Brett die alte Form als Datei, dazu ein Verzeichnis.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Speicher } from "../speicher.mjs";
import { einfrieren } from "../scripts/alt-einfrieren.mjs";

test("einfrieren: schreibt index.json und je altem Brett dessen meta/goals/tasks", () => {
  const s = new Speicher();
  s.metaSetzen("garten", { name: "Garten", dream: "Es ist …", horizon: "2027" });
  s.zielSetzen("garten", "z", { id: "z", title: "Z", dots: 2, order: 0 });
  s.karteSetzen("garten", "k", { id: "k", title: "K", goal: "z", stage: 1, deps: [] });
  s.rlsErsetzen("nur-rls", { group: { name: "Neu", data: {} }, items: [{ id: "i", type: "task", data: {} }], relations: [] });
  const aus = fs.mkdtempSync(path.join(os.tmpdir(), "kb-alt-"));
  assert.deepEqual(einfrieren(s, aus, "2026-10-01T00:00:00.000Z"), ["garten"]);
  const index = JSON.parse(fs.readFileSync(path.join(aus, "index.json"), "utf8"));
  assert.equal(index.eingefroren, "2026-10-01T00:00:00.000Z");
  assert.deepEqual(index.bretter.map((b) => b.brett), ["garten"]);
  const garten = JSON.parse(fs.readFileSync(path.join(aus, "garten.json"), "utf8"));
  assert.equal(garten.meta.name, "Garten");
  assert.equal(garten.goals.z.title, "Z");
  assert.equal(garten.tasks.k.goal, "z");
  assert.equal(fs.existsSync(path.join(aus, "nur-rls.json")), false);
});
