import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ConnectorProvider } from "@real-life-stack/toolkit"
import { erstelleServerConnector } from "./connector/server-connector"
import { brettAusPfad } from "./brett"
import App from "./App"
import "./index.css"

async function start() {
  const brett = brettAusPfad()
  const wurzel = createRoot(document.getElementById("root")!)
  try {
    const { connector, aufZustand } = await erstelleServerConnector(brett)
    wurzel.render(
      <StrictMode>
        <ConnectorProvider connector={connector}>
          <App brett={brett} aufZustand={aufZustand} />
        </ConnectorProvider>
      </StrictMode>,
    )
  } catch (e) {
    // Ohne das erste Laden gibt es kein Brett. Lieber sagen, was fehlt, als
    // eine leere Seite zeigen.
    console.error(e)
    wurzel.render(
      <div className="mx-auto max-w-prose p-8">
        <h1 className="mb-2 text-xl font-semibold">Das Brett ist gerade nicht erreichbar.</h1>
        <p className="text-muted-foreground">
          Der Server hat „{brett}" nicht geliefert. Die ursprüngliche Fassung liegt unter{" "}
          <a className="underline" href={`/alt/${brett}`}>
            /alt/{brett}
          </a>
          ; sie hält zusätzlich eine lokale Kopie im Browser.
        </p>
      </div>,
    )
  }
}

void start()
