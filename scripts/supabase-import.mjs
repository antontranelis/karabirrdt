#!/usr/bin/env node
// Export → Umwandeln → Import: ein Brett in einen Space des Supabase-Connectors.
//
//   npm run import:supabase -- --quelle <url|datei> [--brett <slug>]
//                              [--zuordnung user:<name>=<konto-id> …] [--probe]
//
// `--quelle` ist das JSON von `GET /api/b/<brett>/rls` (URL) oder eine Datei
// damit, nie die SQLite selbst. Vor dem Export das alte Brett einfrieren
// (`KARABIRRDT_NUR_LESEN=1`), damit danach nichts mehr hinzukommt.
//
// Angemeldet wird mit dem Konto der importierenden Person; sie gilt als Autor
// der Karten (Stopp-Punkt 1) und legt den Space an. Zwei Läufe hintereinander
// ändern nichts; `--probe` schreibt nicht.
//
// Umgebung (Werte werden nie ausgegeben):
//   KB_SUPABASE_URL       Vorgabe https://supabase.real-life-stack.de
//   KB_SUPABASE_ANON_KEY  der öffentliche Schlüssel der Instanz
//   KB_EMAIL, KB_PASSWORT Konto der importierenden Person
import fs from "node:fs";
import { importiere, planeUmzug } from "../umwandeln.mjs";

function argumente(argv) {
  const a = { zuordnung: {}, probe: false };
  for (let i = 2; i < argv.length; i++) {
    const name = argv[i];
    const wert = argv[i + 1];
    if (name === "--probe") a.probe = true;
    else if (name === "--quelle" || name === "--brett") {
      a[name.slice(2)] = wert;
      i++;
    } else if (name === "--zuordnung") {
      const [alt, konto] = String(wert ?? "").split("=");
      if (!alt || !konto) throw new Error(`--zuordnung erwartet user:<name>=<konto-id>, nicht ${JSON.stringify(wert)}`);
      a.zuordnung[alt] = konto;
      i++;
    } else throw new Error(`Unbekanntes Argument ${name}`);
  }
  if (!a.quelle) throw new Error("--quelle fehlt");
  return a;
}

async function liesQuelle(quelle) {
  if (/^https?:\/\//.test(quelle)) {
    const antwort = await fetch(quelle, { cache: "no-store" });
    if (!antwort.ok) throw new Error(`Export nicht ladbar (${antwort.status})`);
    return antwort.json();
  }
  return JSON.parse(fs.readFileSync(quelle, "utf8"));
}

async function main() {
  const a = argumente(process.argv);
  const plan = await planeUmzug(await liesQuelle(a.quelle), { slug: a.brett, zuordnung: a.zuordnung });

  console.log(`${a.probe ? "Probe" : "Import"} · Brett „${plan.group.name}“ → /${plan.slug}`);
  console.log(`  ${plan.items.length} Items · ${plan.datensaetze.length} Datensätze im Brett`);
  if (plan.nichtUebernommen.length) console.log(`  nicht übernommen (Ziel in einem anderen Space): ${plan.nichtUebernommen.map((r) => r.id).join(", ")}`);
  for (const o of plan.ohneKonto) console.log(`  ohne Konto: ${o.name} (${o.ziel}) an ${o.karten} Karten — bleibt stehen, Platzhalter offen`);

  const url = process.env.KB_SUPABASE_URL ?? "https://supabase.real-life-stack.de";
  const schluessel = process.env.KB_SUPABASE_ANON_KEY;
  const email = process.env.KB_EMAIL;
  const passwort = process.env.KB_PASSWORT;
  if (!schluessel || !email || !passwort) {
    console.log("  (ohne KB_SUPABASE_ANON_KEY, KB_EMAIL, KB_PASSWORT nur der Plan, kein Abgleich)");
    if (!a.probe) process.exitCode = 2;
    return;
  }

  const { createSupabaseConnector } = await import("@real-life-stack/supabase-connector");
  const c = createSupabaseConnector(url, schluessel);
  await c.init();
  try {
    const ich = await c.authenticate("email", { email, password: passwort });
    console.log(`  angemeldet als ${ich.displayName ?? ich.id}`);
    const b = await importiere(plan, c, { probe: a.probe });
    console.log(`  Space ${b.gruppe.neu ? (a.probe ? "würde angelegt" : "angelegt") : "gefunden"}${b.gruppe.id ? ` (${b.gruppe.id})` : ""}`);
    const w = a.probe ? " würde" : "";
    console.log(`  ${b.angelegt.length}${w} angelegt · ${b.geaendert.length}${w} geändert · ${b.gleich.length} gleich · ${b.datensaetze} Datensätze · ${b.eingeladen.length}${w} eingeladen`);
    for (const f of b.fehler) console.log(`  Fehler ${f.id}: ${f.grund}`);
    if (b.fehler.length) process.exitCode = 1;
  } finally {
    await c.logout().catch(() => {});
    await c.dispose();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(2);
});
