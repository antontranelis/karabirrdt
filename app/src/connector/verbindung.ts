import { createSupabaseConnector, type SupabaseConnector } from "@real-life-stack/supabase-connector"
import { getRuntimeConfig } from "@real-life-stack/toolkit"
import { mitBrettRegeln } from "./brett-regeln"

/** Die Instanz auf dem NixOS-Server; eine andere setzt `config.json` (Spec 11). */
export const SUPABASE_VORGABE = "https://supabase.real-life-stack.de"

/**
 * Der Connector dieser App: der Supabase-Connector des Stacks (Space-Scope,
 * Realtime, zeilenweise Rechte, Anmeldung), darum die Brett-Regeln der App.
 * Adresse und öffentlicher Schlüssel kommen aus der Laufzeit-Konfiguration
 * (`config.json`, sonst `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` beim
 * Bauen); der gebaute Code trägt keinen Schlüssel.
 */
export async function erstelleVerbindung(): Promise<SupabaseConnector> {
  const { supabaseUrl, supabaseAnonKey } = getRuntimeConfig().endpoints
  if (!supabaseAnonKey) throw new Error("Kein Schlüssel für den Server konfiguriert (config.json: endpoints.supabaseAnonKey)")
  const connector = createSupabaseConnector(supabaseUrl || SUPABASE_VORGABE, supabaseAnonKey)
  await connector.init()
  return mitBrettRegeln(connector)
}
