import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ConnectorProvider, applyInitialColorScheme, loadRuntimeConfig } from "@real-life-stack/toolkit"
import { erstelleVerbindung } from "./connector/verbindung"
import { bindeRegister } from "./register"
import { Anmeldung } from "./panels/anmeldung"
import App from "./App"
import "./index.css"

async function start() {
  // Hell oder dunkel vor dem ersten await: sonst stünde die Seite beim Laden
  // hell da (gemerkte Wahl, sonst die Systemvorgabe).
  applyInitialColorScheme()
  // Das Register der App vor dem ersten Render binden (Spec 06, Regel 1).
  bindeRegister()
  const wurzel = createRoot(document.getElementById("root")!)
  try {
    // Adresse und öffentlicher Schlüssel des Servers: config.json, sonst
    // die Werte beim Bauen (Spec 11). Vor dem ersten Render.
    await loadRuntimeConfig({
      baseUrl: import.meta.env.BASE_URL,
      buildTimeEnv: {
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
        supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    })
    const connector = await erstelleVerbindung()
    wurzel.render(
      <StrictMode>
        <ConnectorProvider connector={connector}>
          <Anmeldung connector={connector}>
            <App />
          </Anmeldung>
        </ConnectorProvider>
      </StrictMode>,
    )
  } catch (e) {
    // Lieber sagen, was fehlt, als eine leere Seite zeigen.
    console.error(e)
    wurzel.render(
      <div className="mx-auto max-w-prose p-8">
        <h1 className="mb-2 text-xl font-semibold">Der Server ist gerade nicht erreichbar.</h1>
        <p className="text-muted-foreground">{e instanceof Error ? e.message : String(e)}</p>
      </div>,
    )
  }
}

void start()
